"""
Unit tests for GenericStrategy.

Key behaviors covered:
- Each sell factor fires independently
- Disabled factors (ignore set) are truly skipped
- was_sold gating: buy only after a prior sell
- start_invested=0 initializes was_sold=True (bug fix regression test)
- Buy fires on the first eligible row after a sell
"""
import numpy as np
import pandas as pd
import pytest
from helpers import make_weekly_df
from indicators import IndicatorEngine
from strategy_generic import GenericStrategy


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_ALL_SELL = {"CHG4", "RET3", "YIELD10_CHG4", "YIELD2_CHG4", "CURVE_CHG4"}
_ALL_BUY  = {"MA", "DROP", "SPREAD_DELTA", "YIELD10_DELTA"}
_ALL      = _ALL_SELL | _ALL_BUY

_BASE_PARAMS = {
    "MA": 3, "DROP": 0.01, "CHG4": 0.165, "RET3": -0.021,
    "YIELD10_CHG4": 0.20, "YIELD2_CHG4": 0.20, "CURVE_CHG4": 0.50,
    "SPREAD_DELTA": 2, "YIELD10_DELTA": 2,
}


def _make_and_apply(n, **kwargs):
    df = make_weekly_df(n, **kwargs)
    return IndicatorEngine.apply_all(df, ma_length=_BASE_PARAMS["MA"])


# ---------------------------------------------------------------------------
# Sell: CHG4
# ---------------------------------------------------------------------------

def test_sell_fires_on_chg4():
    """4-week spread spike above threshold triggers a sell."""
    n = 10
    spread = np.full(n, 3.0)
    spread[5] = 3.6   # chg4[5] = (3.6 - 3.0) / 3.0 = 0.20 > 0.165

    df = _make_and_apply(n, spread=spread)
    strat = GenericStrategy(_BASE_PARAMS, ignore=_ALL_SELL - {"CHG4"})
    positions, _, sell_dates = strat.run(df, start_invested=1)

    assert df.index[5] in sell_dates
    assert positions[5] == 0


def test_no_sell_when_chg4_below_threshold():
    n = 10
    spread = np.full(n, 3.0)
    spread[5] = 3.4   # chg4[5] = 0.133 < 0.165 → no sell

    df = _make_and_apply(n, spread=spread)
    strat = GenericStrategy(_BASE_PARAMS, ignore=_ALL_SELL - {"CHG4"})
    _, _, sell_dates = strat.run(df, start_invested=1)

    assert len(sell_dates) == 0


# ---------------------------------------------------------------------------
# Sell: RET3
# ---------------------------------------------------------------------------

def test_sell_fires_on_ret3():
    """3-week price return below threshold triggers a sell."""
    n = 10
    close = np.full(n, 100.0)
    close[3] = 97.0   # ret3[3] = (97 - 100) / 100 = -0.03 < -0.021

    df = _make_and_apply(n, close=close)
    strat = GenericStrategy(_BASE_PARAMS, ignore=_ALL_SELL - {"RET3"})
    positions, _, sell_dates = strat.run(df, start_invested=1)

    assert df.index[3] in sell_dates
    assert positions[3] == 0


# ---------------------------------------------------------------------------
# Ignore set: disables sell factors
# ---------------------------------------------------------------------------

def test_ignore_disables_chg4():
    """CHG4 in ignore set → spike does not trigger a sell."""
    n = 10
    spread = np.full(n, 3.0)
    spread[5] = 3.6   # would sell if CHG4 were active

    df = _make_and_apply(n, spread=spread)
    strat = GenericStrategy(_BASE_PARAMS, ignore=_ALL)   # all factors off
    _, _, sell_dates = strat.run(df, start_invested=1)

    assert len(sell_dates) == 0


def test_ignore_disables_ret3():
    """RET3 in ignore set → price drop does not trigger a sell."""
    n = 10
    close = np.full(n, 100.0)
    close[3] = 90.0   # very large drop; still ignored

    df = _make_and_apply(n, close=close)
    strat = GenericStrategy(_BASE_PARAMS, ignore=_ALL)
    _, _, sell_dates = strat.run(df, start_invested=1)

    assert len(sell_dates) == 0


# ---------------------------------------------------------------------------
# was_sold gating
# ---------------------------------------------------------------------------

def test_no_buy_without_prior_sell():
    """start_invested=1 with no sell → buy conditions never evaluated."""
    n = 10
    df = _make_and_apply(n)
    # Sell thresholds impossibly high → never sells
    params = {**_BASE_PARAMS, "CHG4": 9999.0, "RET3": -9999.0,
              "YIELD10_CHG4": 9999.0, "YIELD2_CHG4": 9999.0, "CURVE_CHG4": 9999.0}
    strat = GenericStrategy(params, ignore=_ALL_BUY)   # buy factors off so buy_mask=True
    positions, buy_dates, sell_dates = strat.run(df, start_invested=1)

    assert len(sell_dates) == 0
    assert len(buy_dates)  == 0
    assert all(p == 1 for p in positions)


def test_start_not_invested_enables_immediate_buy():
    """
    Regression: was_sold was previously False when start_invested=0,
    preventing any buy from ever firing. Fix: was_sold = (start_invested == 0).
    """
    n = 10
    df = _make_and_apply(n)
    # Sell thresholds impossibly high; all buy factors disabled → buy_mask always True
    params = {**_BASE_PARAMS, "CHG4": 9999.0, "RET3": -9999.0,
              "YIELD10_CHG4": 9999.0, "YIELD2_CHG4": 9999.0, "CURVE_CHG4": 9999.0}
    strat = GenericStrategy(params, ignore=_ALL_BUY)
    positions, buy_dates, _ = strat.run(df, start_invested=0)

    assert len(buy_dates) >= 1
    assert positions[-1] == 1


# ---------------------------------------------------------------------------
# Buy fires after sell
# ---------------------------------------------------------------------------

def test_buy_fires_after_sell():
    """After a CHG4 sell, buy fires on the next row where sell is cleared."""
    n = 15
    spread = np.full(n, 3.0)
    spread[5] = 3.6   # chg4[5] = 0.20 → SELL at row 5
    # chg4[6] = (3.0 - 3.0)/3.0 = 0.0 → no sell at row 6

    df = _make_and_apply(n, spread=spread)
    # Only CHG4 sell active; all buy factors disabled → buy_mask always True
    strat = GenericStrategy(_BASE_PARAMS, ignore=(_ALL_SELL - {"CHG4"}) | _ALL_BUY)
    positions, buy_dates, sell_dates = strat.run(df, start_invested=1)

    assert df.index[5] in sell_dates
    assert len(buy_dates) >= 1
    assert buy_dates[0] > sell_dates[0]   # buy must follow sell


def test_positions_reflect_sell_then_buy():
    """Position array is 0 between sell and buy, 1 after buy."""
    n = 15
    spread = np.full(n, 3.0)
    spread[5] = 3.6

    df = _make_and_apply(n, spread=spread)
    strat = GenericStrategy(_BASE_PARAMS, ignore=(_ALL_SELL - {"CHG4"}) | _ALL_BUY)
    positions, buy_dates, sell_dates = strat.run(df, start_invested=1)

    sell_idx = df.index.get_loc(sell_dates[0])
    buy_idx  = df.index.get_loc(buy_dates[0])

    assert positions[sell_idx] == 0
    assert all(p == 0 for p in positions[sell_idx:buy_idx])
    assert positions[buy_idx] == 1


# ===========================================================================
# evaluate_sell: row-by-row method (lines 36-41)
# ===========================================================================

def _sell_row(**overrides):
    """Minimal pd.Series with all sell indicator columns at neutral values."""
    data = {"chg4": 0.0, "ret3": 0.0, "yield10_chg4": 0.0,
            "yield2_chg4": 0.0, "curve_chg4": 0.0}
    data.update(overrides)
    return pd.Series(data)


def test_evaluate_sell_no_conditions():
    strat = GenericStrategy(_BASE_PARAMS)
    assert not strat.evaluate_sell(_sell_row(), None, None)


def test_evaluate_sell_chg4():
    strat = GenericStrategy(_BASE_PARAMS)
    assert strat.evaluate_sell(_sell_row(chg4=0.20), None, None)


def test_evaluate_sell_ret3():
    strat = GenericStrategy(_BASE_PARAMS)
    assert strat.evaluate_sell(_sell_row(ret3=-0.05), None, None)


def test_evaluate_sell_yield10_chg4():
    strat = GenericStrategy(_BASE_PARAMS)
    assert strat.evaluate_sell(_sell_row(yield10_chg4=0.25), None, None)


def test_evaluate_sell_yield2_chg4():
    strat = GenericStrategy(_BASE_PARAMS)
    assert strat.evaluate_sell(_sell_row(yield2_chg4=0.25), None, None)


def test_evaluate_sell_curve_chg4():
    """curve_chg4 < -CURVE_CHG4 (0.50) triggers sell."""
    strat = GenericStrategy(_BASE_PARAMS)
    assert strat.evaluate_sell(_sell_row(curve_chg4=-0.60), None, None)


def test_evaluate_sell_nan_is_safe():
    """NaN indicator value does not trigger a sell."""
    strat = GenericStrategy(_BASE_PARAMS)
    assert not strat.evaluate_sell(_sell_row(chg4=float("nan")), None, None)


def test_evaluate_sell_ignore_chg4():
    strat = GenericStrategy(_BASE_PARAMS, ignore={"CHG4"})
    assert not strat.evaluate_sell(_sell_row(chg4=9.0), None, None)


def test_evaluate_sell_ignore_all():
    strat = GenericStrategy(_BASE_PARAMS, ignore=_ALL_SELL)
    row = _sell_row(chg4=9.0, ret3=-9.0, yield10_chg4=9.0, yield2_chg4=9.0, curve_chg4=-9.0)
    assert not strat.evaluate_sell(row, None, None)


# ===========================================================================
# evaluate_buy: row-by-row method (lines 44-60)
# ===========================================================================

def _buy_df(n=6):
    """DataFrame where every buy condition passes on the final row."""
    close  = np.linspace(103.0, 108.0, n)   # rising → close > MA3 on last row
    spread = np.linspace(3.5, 3.0, n)        # falling → spread_delta < 0, dropped from peak
    dgs10  = np.linspace(4.5, 4.0, n)        # falling → yield10_delta < 0
    df = make_weekly_df(n, close=close, spread=spread, dgs10=dgs10)
    return IndicatorEngine.apply_all(df, ma_length=3)


def test_evaluate_buy_no_prior_sell():
    """last_action_was_sell=False always returns False."""
    df = _buy_df()
    strat = GenericStrategy(_BASE_PARAMS)
    assert not strat.evaluate_buy(df.iloc[-1], df, df.index[-1], last_action_was_sell=False)


def test_evaluate_buy_ma_nan_blocks():
    """MA column is NaN on an early row → returns False before checking other conditions."""
    df = _buy_df()
    strat = GenericStrategy(_BASE_PARAMS)
    # MA3[1] is NaN (rolling(3) needs 3 rows)
    assert not strat.evaluate_buy(df.iloc[1], df, df.index[1], last_action_was_sell=True)


def test_evaluate_buy_too_few_rows():
    """len(past) < 3 returns False — MA ignored to bypass the NaN check on the same early row."""
    df = _buy_df()
    strat = GenericStrategy(_BASE_PARAMS, ignore={"MA"})
    # df.loc[:index[1]] = rows 0 and 1 → len 2 < 3
    assert not strat.evaluate_buy(df.iloc[1], df, df.index[1], last_action_was_sell=True)


def test_evaluate_buy_all_conditions_pass():
    df = _buy_df()
    strat = GenericStrategy(_BASE_PARAMS)
    assert strat.evaluate_buy(df.iloc[-1], df, df.index[-1], last_action_was_sell=True)


def test_evaluate_buy_fails_price_below_ma():
    df = _buy_df().copy()
    df.loc[df.index[-1], "close"] = 50.0   # well below MA ≈ 107
    strat = GenericStrategy(_BASE_PARAMS, ignore=_ALL_BUY - {"MA"})
    assert not strat.evaluate_buy(df.iloc[-1], df, df.index[-1], last_action_was_sell=True)


def test_evaluate_buy_fails_spread_delta_positive():
    """Spread rising on the last two rows → SPREAD_DELTA condition fails."""
    df = _buy_df().copy()
    df.loc[df.index[-1], "spread_delta"] = 0.4
    df.loc[df.index[-2], "spread_delta"] = 0.2
    strat = GenericStrategy(_BASE_PARAMS, ignore=_ALL_BUY - {"SPREAD_DELTA"})
    assert not strat.evaluate_buy(df.iloc[-1], df, df.index[-1], last_action_was_sell=True)


def test_evaluate_buy_fails_drop_condition():
    """Spread dropped only ~6% from recent peak; DROP=0.20 requires 20% → fails."""
    df = _buy_df()
    params = {**_BASE_PARAMS, "DROP": 0.20}
    strat = GenericStrategy(params, ignore=_ALL_BUY - {"DROP"})
    assert not strat.evaluate_buy(df.iloc[-1], df, df.index[-1], last_action_was_sell=True)


def test_evaluate_buy_fails_yield10_rising():
    """10yr yield rising on the last two rows → YIELD10_DELTA condition fails."""
    df = _buy_df().copy()
    df.loc[df.index[-1], "yield10_delta"] = 0.5
    df.loc[df.index[-2], "yield10_delta"] = 0.3
    strat = GenericStrategy(_BASE_PARAMS, ignore=_ALL_BUY - {"YIELD10_DELTA"})
    assert not strat.evaluate_buy(df.iloc[-1], df, df.index[-1], last_action_was_sell=True)


def test_evaluate_buy_all_ignored_passes():
    """All buy conditions ignored → returns True when history >= 3 and prior sell occurred."""
    df = _buy_df()
    strat = GenericStrategy(_BASE_PARAMS, ignore=_ALL_BUY)
    assert strat.evaluate_buy(df.iloc[-1], df, df.index[-1], last_action_was_sell=True)
