import itertools

import numpy as np
import pandas as pd
from pathlib import Path

from data_loader import WeeklyDataLoader
from indicators import IndicatorEngine
from strategy_generic import GenericStrategy, PARAM_NAMES, INT_PARAMS
from strategy_buyhold import BuyAndHoldStrategy
from backtester import Backtester


class WalkForwardEngine:
    """
    Runs walk-forward validation or discovery on a security.

    Parameters
    ----------
    input_type : str
        "csv" or "api"
    input_dir : Path
        Directory for CSV input files.
    ticker : str
        Security ticker symbol.
    cash_rate : float
        Annualized cash rate (e.g. 0.04).
    start_invested : int
        1 = start invested, 0 = start in cash.
    config : AppConfig (Pydantic model)
        Per-security config with sell_triggers and buy_conditions.
    """

    def __init__(self, input_type: str, input_dir: Path, ticker: str,
                 cash_rate: float, start_invested: int, config):
        self.input_type = input_type
        self.input_dir = input_dir
        self.ticker = ticker
        self.cash_rate = cash_rate
        self.start_invested = start_invested
        self.config = config

    # ------------------------------------------------------------------
    # Data loading
    # ------------------------------------------------------------------

    def _prepare_base(self) -> pd.DataFrame:
        """Load full data and apply all non-MA indicators."""
        loader = WeeklyDataLoader(self.input_type, self.input_dir, self.ticker)
        df = loader.load()  # full history, no date filter
        # Apply all non-MA indicators (MA depends on params, added lazily)
        df = IndicatorEngine.add_chg4(df)
        df = IndicatorEngine.add_ret3(df)
        df = IndicatorEngine.add_spread_delta(df)
        df = IndicatorEngine.add_yield10_chg4(df)
        df = IndicatorEngine.add_yield2_chg4(df)
        df = IndicatorEngine.add_curve_chg4(df)
        df = IndicatorEngine.add_yield10_delta(df)
        return df

    def _ensure_ma(self, base_df: pd.DataFrame, n: int) -> None:
        """Add MA{n} column to base_df in-place if not already present."""
        col = f'MA{n}'
        if col not in base_df.columns:
            base_df[col] = base_df['close'].rolling(n).mean()

    def _get_window(self, base_df: pd.DataFrame, ma: int,
                    start: str, end: str) -> pd.DataFrame:
        """Ensure MA is computed, then return a copy of the date-sliced window."""
        self._ensure_ma(base_df, ma)
        return base_df.loc[pd.Timestamp(start):pd.Timestamp(end)].copy()

    # ------------------------------------------------------------------
    # Window generation
    # ------------------------------------------------------------------

    def _snap_fwd(self, df: pd.DataFrame, dt) -> pd.Timestamp:
        """First index date >= dt."""
        dt = pd.Timestamp(dt)
        idx = df.index[df.index >= dt]
        return idx[0] if len(idx) > 0 else df.index[-1]

    def _snap_back(self, df: pd.DataFrame, dt) -> pd.Timestamp:
        """Last index date <= dt."""
        dt = pd.Timestamp(dt)
        idx = df.index[df.index <= dt]
        return idx[-1] if len(idx) > 0 else df.index[0]

    def _generate_windows(self, df: pd.DataFrame, window_size_months: int,
                           window_type: str, initial_training_months: int = 36,
                           training_window_months: int = 36) -> list[dict]:
        min_date = df.index.min()
        max_date = df.index.max()
        windows = []

        if window_type == 'anchored':
            cursor = min_date + pd.DateOffset(months=initial_training_months)
            while True:
                if cursor > max_date:
                    break
                test_start = self._snap_fwd(df, cursor)
                if test_start > max_date:
                    break
                test_end_target = cursor + pd.DateOffset(months=window_size_months)
                test_end = self._snap_back(df, test_end_target - pd.Timedelta(days=1))
                train_end = self._snap_back(df, cursor - pd.Timedelta(days=1))
                is_partial = test_end < (test_end_target - pd.Timedelta(days=7))
                windows.append({
                    'train_start': min_date.strftime('%Y-%m-%d'),
                    'train_end':   train_end.strftime('%Y-%m-%d'),
                    'test_start':  test_start.strftime('%Y-%m-%d'),
                    'test_end':    test_end.strftime('%Y-%m-%d'),
                    'is_partial':  is_partial,
                })
                cursor += pd.DateOffset(months=window_size_months)
        else:  # rolling
            cursor = min_date + pd.DateOffset(months=training_window_months)
            while True:
                if cursor > max_date:
                    break
                test_start = self._snap_fwd(df, cursor)
                if test_start > max_date:
                    break
                train_start = self._snap_fwd(df, cursor - pd.DateOffset(months=training_window_months))
                train_end = self._snap_back(df, cursor - pd.Timedelta(days=1))
                test_end_target = cursor + pd.DateOffset(months=window_size_months)
                test_end = self._snap_back(df, test_end_target - pd.Timedelta(days=1))
                is_partial = test_end < (test_end_target - pd.Timedelta(days=7))
                windows.append({
                    'train_start': train_start.strftime('%Y-%m-%d'),
                    'train_end':   train_end.strftime('%Y-%m-%d'),
                    'test_start':  test_start.strftime('%Y-%m-%d'),
                    'test_end':    test_end.strftime('%Y-%m-%d'),
                    'is_partial':  is_partial,
                })
                cursor += pd.DateOffset(months=window_size_months)

        return windows

    # ------------------------------------------------------------------
    # Strategy / backtester helpers
    # ------------------------------------------------------------------

    def _run_params(self, df_window: pd.DataFrame, params: dict,
                    ignore: set) -> tuple[float, int]:
        """Run strategy on a window df (all indicators present). Returns (apy, trades)."""
        strat = GenericStrategy(params, ignore=ignore)
        positions, buys, sells = strat.run(df_window, start_invested=self.start_invested)
        bt = Backtester(self.cash_rate)
        result = bt.run(df_window, positions, buys, sells)
        return result['apy'], len(sells)

    def _run_on_window(self, base_df: pd.DataFrame, params: dict,
                       ignore: set, start: str, end: str) -> tuple[float, int]:
        """Ensure MA, slice, and run strategy. Returns (apy, trades)."""
        ma = int(params.get('MA', 50))
        df_w = self._get_window(base_df, ma, start, end)
        if len(df_w) < 4:
            return 0.0, 0
        return self._run_params(df_w, params, ignore)

    def _buyhold_apy(self, df_window: pd.DataFrame) -> float:
        """Buy-and-hold APY on a window df."""
        strat = BuyAndHoldStrategy()
        positions, buys, sells = strat.run(df_window, start_invested=1)
        bt = Backtester(self.cash_rate)
        result = bt.run(df_window, positions, buys, sells)
        return result['apy']

    def _stdev_strategy(self, bt_df: pd.DataFrame) -> float | None:
        """Annualized weekly std dev of strategy returns from backtester output df."""
        rets = bt_df['StratRet'].dropna()
        if len(rets) < 2:
            return None
        return float(rets.std() * np.sqrt(52))

    def _stdev_bh(self, df_window: pd.DataFrame) -> float | None:
        """Annualized weekly std dev of asset returns (= B&H std dev)."""
        rets = df_window['Ret'].dropna()
        if len(rets) < 2:
            return None
        return float(rets.std() * np.sqrt(52))

    # ------------------------------------------------------------------
    # Discover mode helpers
    # ------------------------------------------------------------------

    def _build_refinement_grids(self, seed_params: dict, active_factors: list,
                                 max_combinations: int) -> dict:
        """
        Build symmetric grids around seed values for active factors,
        expanding k steps in each direction until total combos > max_combinations.
        Inactive factors get [0] placeholder.
        """
        step_sizes = {}
        bounds = {}
        for k in active_factors:
            cfg = (self.config.sell_triggers.get(k) or
                   self.config.buy_conditions.get(k))
            if cfg is None:
                step_sizes[k] = 1
                bounds[k] = (-1e9, 1e9)
            else:
                step_sizes[k] = cfg.range.step
                bounds[k] = (cfg.range.min, cfg.range.max)

        def build_at_k(k: int) -> dict:
            grids = {p: [0] for p in PARAM_NAMES if p not in active_factors}
            for factor in active_factors:
                seed = seed_params[factor]
                step = step_sizes[factor]
                lo, hi = bounds[factor]
                if factor in INT_PARAMS:
                    si = int(round(seed))
                    st = max(1, int(round(step)))
                    vals = [v for v in range(si - k * st, si + k * st + 1, st)
                            if lo <= v <= hi]
                    grids[factor] = vals or [int(round(max(lo, min(hi, si))))]
                else:
                    vals = [seed + i * step for i in range(-k, k + 1)
                            if lo <= seed + i * step <= hi]
                    grids[factor] = vals or [max(lo, min(hi, seed))]
            return grids

        # Find the largest k that keeps total combos <= max_combinations
        if not active_factors:
            return {p: [0] for p in PARAM_NAMES}

        # Fast path: all active factors have a degenerate range (min == max), no expansion possible
        if all(bounds[f][0] == bounds[f][1] for f in active_factors):
            return build_at_k(1)

        k = 0
        while True:
            k += 1
            candidate = build_at_k(k)
            combo_count = 1
            for factor in active_factors:
                combo_count *= len(candidate[factor])
            if combo_count > max_combinations or k > 500:
                break
        k = max(0, k - 1)
        return build_at_k(k)

    def _grid_search(self, base_df: pd.DataFrame, param_grids: dict,
                     ignore: set, start: str, end: str,
                     progress_callback=None, bar_current: int = 0,
                     bar_total: int = 0, label: str = "",
                     cancel_event=None) -> dict:
        """Grid search over param_grids on the given window. Returns best_params."""
        best_apy = -float('inf')
        best_trades = float('inf')
        best_params = None

        grid_lists = [param_grids[k] for k in PARAM_NAMES]
        all_combos = list(itertools.product(*grid_lists))
        n_combos = len(all_combos)
        for done, combo in enumerate(all_combos):
            if cancel_event and cancel_event.is_set():
                break
            params = dict(zip(PARAM_NAMES, combo))
            apy, trades = self._run_on_window(base_df, params, ignore, start, end)
            if apy > best_apy or (apy == best_apy and trades < best_trades):
                best_apy = apy
                best_trades = trades
                best_params = params
            if progress_callback and done % 10 == 0 and done > 0:
                progress_callback(bar_current, bar_total,
                                  f"{label}: grid search {done}/{n_combos} combos")

        if best_params is None:
            return {}
        return {k: (int(best_params[k]) if k in INT_PARAMS else float(best_params[k]))
                for k in PARAM_NAMES}

    # ------------------------------------------------------------------
    # Public: Validate mode
    # ------------------------------------------------------------------

    def run_validate(self, window_size_months: int, window_type: str,
                     initial_training_months: int, training_window_months: int,
                     seed_params: dict, seed_ignore: set,
                     progress_callback=None, cancel_event=None) -> list[dict]:
        """
        Run fixed saved parameters across each test window.
        Returns list of result dicts.
        """
        base_df = self._prepare_base()
        ma = int(seed_params.get('MA', 50))
        self._ensure_ma(base_df, ma)
        windows = self._generate_windows(
            base_df, window_size_months, window_type,
            initial_training_months, training_window_months,
        )

        results = []
        total = len(windows)
        for i, w in enumerate(windows):
            if cancel_event and cancel_event.is_set():
                break
            if progress_callback:
                progress_callback(i, total, f"Window {i+1}/{total}: {w['test_start']} → {w['test_end']}")
            df_w = base_df.loc[pd.Timestamp(w['test_start']):pd.Timestamp(w['test_end'])].copy()
            if len(df_w) < 4:
                if progress_callback:
                    progress_callback(i + 1, total, f"Window {i+1}/{total}: skipped (too few rows)")
                continue

            # Determine starting position for test window by running strategy
            # through the training window — avoids resetting to start_invested
            # each window when the strategy would actually be invested.
            df_train = base_df.loc[pd.Timestamp(w['train_start']):pd.Timestamp(w['train_end'])].copy()
            if len(df_train) > 0:
                train_strat = GenericStrategy(seed_params, ignore=seed_ignore)
                train_positions, _, _ = train_strat.run(df_train, start_invested=self.start_invested)
                test_start_invested = int(train_positions[-1]) if len(train_positions) > 0 else self.start_invested
            else:
                test_start_invested = self.start_invested

            strat = GenericStrategy(seed_params, ignore=seed_ignore)
            positions, buys, sells = strat.run(df_w, start_invested=test_start_invested)
            bt = Backtester(self.cash_rate)
            bt_result = bt.run(df_w, positions, buys, sells)

            bh_apy = self._buyhold_apy(df_w)
            stdev_s = self._stdev_strategy(bt_result['df'])
            stdev_bh = self._stdev_bh(df_w)
            s_apy = bt_result['apy']

            results.append({
                'test_start':     w['test_start'],
                'test_end':       w['test_end'],
                'strategy_apy':   s_apy,
                'buyhold_apy':    bh_apy,
                'edge':           s_apy - bh_apy,
                'trades':         len(sells),
                'stdev_strategy': stdev_s,
                'stdev_buyhold':  stdev_bh,
                'is_partial':     w['is_partial'],
            })
            if progress_callback:
                progress_callback(i + 1, total, f"Window {i+1}/{total}: done")

        return results

    # ------------------------------------------------------------------
    # Public: Discover mode
    # ------------------------------------------------------------------

    def run_discover(self, window_size_months: int, window_type: str,
                     initial_training_months: int, training_window_months: int,
                     seed_params: dict, apy_tolerance_bps: float,
                     max_combinations: int, seed_source: str,
                     progress_callback=None, cancel_event=None) -> tuple[list[dict], dict]:
        """
        For each window: eliminate unneeded factors on training data, optimize
        remaining factors, then test out-of-sample.
        Returns (results_list, factor_stability_dict).
        """
        tolerance = apy_tolerance_bps / 10000.0
        base_df = self._prepare_base()
        windows = self._generate_windows(
            base_df, window_size_months, window_type,
            initial_training_months, training_window_months,
        )

        results = []
        factor_counts = {f: 0 for f in PARAM_NAMES}
        total_windows_completed = 0
        prev_params = None
        n_windows = len(windows)
        total = n_windows * 5  # 5 steps per window for finer progress bar

        for win_i, w in enumerate(windows):
            if cancel_event and cancel_event.is_set():
                break
            base_step = win_i * 5  # bar position at start of this window's steps
            label = f"Window {win_i+1}/{n_windows}"

            # Ensure MA for seed is computed before slicing training window
            seed_ma = int(seed_params.get('MA', 50))
            self._ensure_ma(base_df, seed_ma)
            train_df = base_df.loc[
                pd.Timestamp(w['train_start']):pd.Timestamp(w['train_end'])
            ].copy()

            if len(train_df) < 10:
                if progress_callback:
                    progress_callback(base_step + 5, total, f"{label}: skipped (too few rows)")
                continue

            # Step 1: Seed
            current_seed = (prev_params.copy()
                            if seed_source == 'previous' and prev_params is not None
                            else seed_params.copy())
            current_ignore = set()  # all factors enabled for discovery

            # Step 2: Baseline on training period
            if progress_callback:
                progress_callback(base_step + 1, total, f"{label}: baseline ({w['train_start']} → {w['train_end']})")
            baseline_apy, baseline_trades = self._run_params(train_df, current_seed, current_ignore)

            # Step 3: Single-factor elimination
            if progress_callback:
                progress_callback(base_step + 2, total, f"{label}: single-factor elimination (9 factors)")
            candidates = []
            for factor in PARAM_NAMES:
                test_ignore = {factor}
                f_apy, f_trades = self._run_params(train_df, current_seed, test_ignore)
                diff = baseline_apy - f_apy
                if diff < 0:
                    candidates.append(factor)
                elif diff <= tolerance and f_trades <= baseline_trades:
                    candidates.append(factor)

            # Step 4: Combination elimination
            best_ignore: set = set()
            if len(candidates) > 1:
                all_combos = [(set(combo), r)
                              for r in range(1, len(candidates) + 1)
                              for combo in itertools.combinations(candidates, r)]
                n_combos = len(all_combos)
                if progress_callback:
                    progress_callback(base_step + 3, total,
                                      f"{label}: combo elimination 0/{n_combos}")
                best_combo_apy = -float('inf')
                best_combo_trades = float('inf')
                for done, (test_ignore_c, _) in enumerate(all_combos):
                    if cancel_event and cancel_event.is_set():
                        break
                    c_apy, c_trades = self._run_params(train_df, current_seed, test_ignore_c)
                    diff = baseline_apy - c_apy
                    if diff <= tolerance:
                        if (c_apy > best_combo_apy or
                                (c_apy == best_combo_apy and c_trades < best_combo_trades)):
                            best_combo_apy = c_apy
                            best_combo_trades = c_trades
                            best_ignore = test_ignore_c
                    if progress_callback and (done + 1) % 10 == 0:
                        progress_callback(base_step + 3, total,
                                          f"{label}: combo elimination {done+1}/{n_combos}")
            elif len(candidates) == 1:
                best_ignore = {candidates[0]}

            current_ignore = best_ignore
            active_factors = [f for f in PARAM_NAMES if f not in current_ignore]
            for f in active_factors:
                factor_counts[f] += 1
            total_windows_completed += 1

            # Step 5: Range refinement grid search on training period
            grids = self._build_refinement_grids(current_seed, active_factors, max_combinations)
            n_combos = 1
            for v in grids.values():
                if v != [0]:
                    n_combos *= len(v)
            if progress_callback:
                progress_callback(base_step + 4, total,
                                  f"{label}: grid search ({len(active_factors)} factors, {n_combos} combos)")
            best_params = self._grid_search(
                base_df, grids, current_ignore, w['train_start'], w['train_end'],
                progress_callback=progress_callback,
                bar_current=base_step + 4, bar_total=total, label=label,
                cancel_event=cancel_event,
            )
            if not best_params:
                best_params = {k: (int(current_seed[k]) if k in INT_PARAMS else float(current_seed[k]))
                               for k in PARAM_NAMES}

            # Recompute in-sample APY with best_params
            best_ma = int(best_params.get('MA', 50))
            self._ensure_ma(base_df, best_ma)
            train_final = base_df.loc[
                pd.Timestamp(w['train_start']):pd.Timestamp(w['train_end'])
            ].copy()
            insample_apy, _ = self._run_params(train_final, best_params, current_ignore)

            # Step 6 (counted as step 5): Out-of-sample test
            if progress_callback:
                progress_callback(base_step + 5, total,
                                  f"{label}: OOS test ({w['test_start']} → {w['test_end']})")
            test_df = base_df.loc[
                pd.Timestamp(w['test_start']):pd.Timestamp(w['test_end'])
            ].copy()
            if len(test_df) < 4:
                if progress_callback:
                    progress_callback(base_step + 5, total, f"{label}: skipped OOS (too few rows)")
                continue

            oos_apy, oos_trades = self._run_params(test_df, best_params, current_ignore)
            bh_apy = self._buyhold_apy(test_df)
            key_params = {k: v for k, v in best_params.items() if k in active_factors}

            results.append({
                'train_start':   w['train_start'],
                'train_end':     w['train_end'],
                'test_start':    w['test_start'],
                'test_end':      w['test_end'],
                'active_factors': active_factors,
                'key_params':    key_params,
                'insample_apy':  insample_apy,
                'outsample_apy': oos_apy,
                'buyhold_apy':   bh_apy,
                'edge':          oos_apy - bh_apy,
                'trades':        oos_trades,
                'is_partial':    w['is_partial'],
            })

            if seed_source == 'previous':
                prev_params = best_params.copy()

        factor_stability = {
            k: {'survived': factor_counts[k], 'total': total_windows_completed}
            for k in PARAM_NAMES
        }
        return results, factor_stability
