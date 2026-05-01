import numpy as np
import pandas as pd
import pytest
from helpers import make_weekly_df
from backtester import Backtester


# ---------------------------------------------------------------------------
# Always invested
# ---------------------------------------------------------------------------

def test_always_invested_no_cash():
    """All-invested, 0% cash: equity compounds at the asset's weekly return."""
    n, weekly_ret = 10, 0.01
    df = make_weekly_df(n, tr_drift=weekly_ret)
    # Ret = [0.0, 0.01, 0.01, ...] — no NaN; pos_shifted all 1
    bt = Backtester(cash_rate=0.0)
    result = bt.run(df, [1] * n, [], [])
    # (1+0) * (1+0.01)^9
    assert result["final_value"] == pytest.approx((1 + weekly_ret) ** (n - 1), rel=1e-6)


def test_always_invested_positive_apy():
    df = make_weekly_df(52, tr_drift=0.005)
    bt = Backtester(cash_rate=0.0)
    result = bt.run(df, [1] * 52, [], [])
    assert result["apy"] > 0.0


# ---------------------------------------------------------------------------
# Always cash
# ---------------------------------------------------------------------------

def test_always_cash_final_value():
    """All-cash: equity grows at cash rate regardless of asset return."""
    n, cash_rate = 52, 0.04
    df = make_weekly_df(n)
    bt = Backtester(cash_rate=cash_rate)
    cash_weekly = (1 + cash_rate) ** (1 / 52) - 1
    result = bt.run(df, [0] * n, [], [])
    # pos=0 every row → StratRet = cash_weekly each row → (1+cw)^52 ≈ 1.04
    assert result["final_value"] == pytest.approx((1 + cash_weekly) ** n, rel=1e-6)


# ---------------------------------------------------------------------------
# Mixed positions
# ---------------------------------------------------------------------------

def test_mixed_positions_equity_curve():
    """Only invested periods compound the asset return."""
    n, weekly_ret = 5, 0.10
    df = make_weekly_df(n, tr_drift=weekly_ret)
    # Ret = [0.0, 0.10, 0.10, 0.10, 0.10]
    # positions = [1, 0, 0, 1, 1]
    # pos_shifted = [1, 1, 0, 0, 1]   (shift(1).fillna(pos[0]))
    # StratRet    = [0, 0.1, 0,  0,  0.1]
    # Strategy    = [1, 1.1, 1.1, 1.1, 1.21]
    positions = [1, 0, 0, 1, 1]
    bt = Backtester(cash_rate=0.0)
    result = bt.run(df, positions, [], [])

    strat = result["df"]["Strategy"]
    assert strat.iloc[1] == pytest.approx(1.10, rel=1e-5)
    assert strat.iloc[2] == pytest.approx(1.10, rel=1e-5)  # cash period, no growth
    assert result["final_value"] == pytest.approx(1.21, rel=1e-5)


# ---------------------------------------------------------------------------
# Output structure
# ---------------------------------------------------------------------------

def test_strategy_column_present():
    df = make_weekly_df(5)
    bt = Backtester(cash_rate=0.04)
    result = bt.run(df, [1] * 5, [], [])
    assert "Strategy" in result["df"].columns


def test_buy_sell_dates_pass_through():
    df = make_weekly_df(5)
    buy_dates  = [df.index[1]]
    sell_dates = [df.index[3]]
    bt = Backtester(cash_rate=0.04)
    result = bt.run(df, [1, 0, 0, 1, 1], buy_dates, sell_dates)
    assert result["buy_dates"]  == buy_dates
    assert result["sell_dates"] == sell_dates


def test_result_keys():
    df = make_weekly_df(5)
    bt = Backtester(cash_rate=0.04)
    result = bt.run(df, [1] * 5, [], [])
    assert set(result.keys()) == {"df", "buy_dates", "sell_dates", "final_value", "apy"}


# ---------------------------------------------------------------------------
# APY formula sanity
# ---------------------------------------------------------------------------

def test_apy_roughly_matches_annual_return():
    """52 weeks at 1% each → APY ≈ 68% (compounding effect)."""
    n = 52
    df = make_weekly_df(n, tr_drift=0.01)
    bt = Backtester(cash_rate=0.0)
    result = bt.run(df, [1] * n, [], [])
    # (1.01)^51 ≈ 1.661 over ~1 year → APY ≈ 66%
    assert result["apy"] == pytest.approx(result["final_value"] ** (1 / ((df.index[-1] - df.index[0]).days / 365.25)) - 1, rel=1e-6)
