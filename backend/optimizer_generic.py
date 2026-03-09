import pandas as pd
import itertools
from pathlib import Path

from data_loader import WeeklyDataLoader
from indicators import IndicatorEngine
from backtester import Backtester
from strategy_generic import GenericStrategy

PARAM_NAMES = ['MA', 'DROP', 'CHG4', 'RET3', 'SPREAD_LVL', 'YIELD10_CHG4', 'YIELD2_CHG4', 'CURVE_CHG4', 'SPREAD_DELTA', 'YIELD10_DELTA']
INT_PARAMS  = {'MA', 'SPREAD_DELTA', 'YIELD10_DELTA'}


class GenericOptimizer:
    """
    Single generic grid-search optimizer for all securities.
    Grids are passed in as a dict; disabled factors collapse to [0].
    """

    def __init__(self, input_type: str, input_dir: Path, cash_rate: float,
                 param_grids: dict = None, start_date: str = None,
                 end_date: str = None, disabled_factors=()) :
        self.input_type = input_type
        self.input_dir  = input_dir
        self.cash_rate  = cash_rate
        self.start_date = start_date
        self.end_date   = end_date
        self.ignore     = set(disabled_factors)

        # Default single-value grids (overridden by param_grids)
        self.grids = {
            'MA':          [50],
            'DROP':        [0.016],
            'CHG4':        [0.16],
            'RET3':        [-0.0225],
            'SPREAD_LVL':  [7.0],
            'YIELD10_CHG4':  [0.12],
            'YIELD2_CHG4':   [0.10],
            'CURVE_CHG4':  [0.30],
            'SPREAD_DELTA':[2],
            'YIELD10_DELTA': [2],
        }
        if param_grids:
            self.grids.update(param_grids)

    def run(self, ticker: str, start_invested: int = 1, progress_callback=None):
        # Collapse ignored factors to single placeholder
        active = {k: ([0] if k in self.ignore else v) for k, v in self.grids.items()}

        # Validate non-empty grids
        empty = [k for k, v in active.items() if not v and k not in self.ignore]
        if empty:
            raise ValueError(f"Empty parameter grid(s): {', '.join(empty)} — check min/max/step values.")

        loader = WeeklyDataLoader(self.input_type, self.input_dir, ticker)
        df = loader.load(start_date=self.start_date, end_date=self.end_date)

        grid_lists = [active[k] for k in PARAM_NAMES]
        total = 1
        for g in grid_lists:
            total *= len(g)

        results = []
        current = 0

        for combo in itertools.product(*grid_lists):
            params = dict(zip(PARAM_NAMES, combo))
            df_ind = IndicatorEngine.apply_all(df.copy(), params['MA'])
            strat  = GenericStrategy(params, ignore=self.ignore)
            positions, buys, sells = strat.run(df_ind, start_invested=start_invested)

            bt = Backtester(self.cash_rate)
            bt_result = bt.run(df_ind, positions, buys, sells)

            results.append({**params, 'APY': bt_result['apy'], 'final_value': bt_result['final_value'], 'trade_count': len(sells)})
            current += 1
            if progress_callback:
                progress_callback(current, total)

        results_df = pd.DataFrame(results)
        for k in INT_PARAMS:
            results_df[k] = results_df[k].apply(int)

        best_row    = results_df.loc[results_df['APY'].idxmax()]
        best_params = {
            k: (int(best_row[k]) if k in INT_PARAMS else float(best_row[k]))
            for k in PARAM_NAMES
        }

        df_best    = IndicatorEngine.apply_all(df.copy(), best_params['MA'])
        best_strat = GenericStrategy(best_params, ignore=self.ignore)
        positions, buys, sells = best_strat.run(df_best, start_invested=start_invested)
        bt = Backtester(self.cash_rate)
        best_result = bt.run(df_best, positions, buys, sells)

        return best_params, results_df, best_result
