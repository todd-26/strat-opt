import numpy as np
import pandas as pd
import pytest
from helpers import make_weekly_df
from indicators import IndicatorEngine


# ---------------------------------------------------------------------------
# Moving average
# ---------------------------------------------------------------------------

def test_add_ma_values():
    df = make_weekly_df(5, close=[10.0, 20.0, 30.0, 40.0, 50.0])
    df = IndicatorEngine.add_ma(df, length=3)
    assert pd.isna(df["MA3"].iloc[0])
    assert pd.isna(df["MA3"].iloc[1])
    assert df["MA3"].iloc[2] == pytest.approx(20.0)
    assert df["MA3"].iloc[3] == pytest.approx(30.0)
    assert df["MA3"].iloc[4] == pytest.approx(40.0)


def test_add_ma_custom_output_name():
    df = make_weekly_df(5)
    df = IndicatorEngine.add_ma(df, length=3, out="MY_MA")
    assert "MY_MA" in df.columns
    assert "MA3" not in df.columns


# ---------------------------------------------------------------------------
# 4-week spread % change
# ---------------------------------------------------------------------------

def test_add_chg4_values():
    sp = [2.0, 2.1, 2.2, 2.3, 2.4, 2.5]
    df = make_weekly_df(6, spread=sp)
    df = IndicatorEngine.add_chg4(df)
    assert pd.isna(df["chg4"].iloc[0])
    assert df["chg4"].iloc[4] == pytest.approx((2.4 - 2.0) / 2.0)
    assert df["chg4"].iloc[5] == pytest.approx((2.5 - 2.1) / 2.1)


def test_add_chg4_nans_for_first_four():
    df = make_weekly_df(8)
    df = IndicatorEngine.add_chg4(df)
    assert all(pd.isna(df["chg4"].iloc[:4]))


# ---------------------------------------------------------------------------
# 3-week price return
# ---------------------------------------------------------------------------

def test_add_ret3_values():
    cl = [100.0, 101.0, 102.0, 103.0, 97.0]
    df = make_weekly_df(5, close=cl)
    df = IndicatorEngine.add_ret3(df)
    assert pd.isna(df["ret3"].iloc[0])
    assert df["ret3"].iloc[3] == pytest.approx((103.0 - 100.0) / 100.0)
    assert df["ret3"].iloc[4] == pytest.approx((97.0 - 101.0) / 101.0)


# ---------------------------------------------------------------------------
# Spread delta (1-week diff)
# ---------------------------------------------------------------------------

def test_add_spread_delta_values():
    sp = [3.0, 3.2, 3.1, 2.9]
    df = make_weekly_df(4, spread=sp)
    df = IndicatorEngine.add_spread_delta(df)
    assert pd.isna(df["spread_delta"].iloc[0])
    assert df["spread_delta"].iloc[1] == pytest.approx(0.2)
    assert df["spread_delta"].iloc[2] == pytest.approx(-0.1)
    assert df["spread_delta"].iloc[3] == pytest.approx(-0.2)


# ---------------------------------------------------------------------------
# Treasury yield indicators
# ---------------------------------------------------------------------------

def test_add_yield10_chg4():
    y10 = [4.0, 4.1, 4.2, 4.3, 4.8, 4.6]
    df = make_weekly_df(6, dgs10=y10)
    df = IndicatorEngine.add_yield10_chg4(df)
    assert pd.isna(df["yield10_chg4"].iloc[3])
    assert df["yield10_chg4"].iloc[4] == pytest.approx((4.8 - 4.0) / 4.0)
    assert df["yield10_chg4"].iloc[5] == pytest.approx((4.6 - 4.1) / 4.1)


def test_add_yield2_chg4():
    y2 = [2.0, 2.0, 2.0, 2.0, 2.5, 2.4]
    df = make_weekly_df(6, dgs2=y2)
    df = IndicatorEngine.add_yield2_chg4(df)
    assert pd.isna(df["yield2_chg4"].iloc[3])
    assert df["yield2_chg4"].iloc[4] == pytest.approx((2.5 - 2.0) / 2.0)


def test_add_yield10_delta():
    y10 = [4.0, 4.1, 3.9, 3.7]
    df = make_weekly_df(4, dgs10=y10)
    df = IndicatorEngine.add_yield10_delta(df)
    assert pd.isna(df["yield10_delta"].iloc[0])
    assert df["yield10_delta"].iloc[1] == pytest.approx(0.1)
    assert df["yield10_delta"].iloc[2] == pytest.approx(-0.2)
    assert df["yield10_delta"].iloc[3] == pytest.approx(-0.2)


def test_add_curve_chg4_flat_curve():
    # When DGS10 - DGS2 is constant, curve_chg4 = 0 after warmup
    y10 = [4.0, 4.1, 4.2, 4.3, 4.4, 4.5]
    y2  = [2.0, 2.1, 2.2, 2.3, 2.4, 2.5]
    # YieldCurve = 2.0 throughout → diff(4) = 0
    df = make_weekly_df(6, dgs10=y10, dgs2=y2)
    df = IndicatorEngine.add_curve_chg4(df)
    assert pd.isna(df["curve_chg4"].iloc[3])
    assert df["curve_chg4"].iloc[4] == pytest.approx(0.0)
    assert df["curve_chg4"].iloc[5] == pytest.approx(0.0)


# ---------------------------------------------------------------------------
# apply_all
# ---------------------------------------------------------------------------

def test_apply_all_adds_expected_columns():
    df = make_weekly_df(20)
    df = IndicatorEngine.apply_all(df, ma_length=10)
    expected = ["MA10", "chg4", "ret3", "spread_delta",
                "yield10_chg4", "yield2_chg4", "curve_chg4", "yield10_delta"]
    for col in expected:
        assert col in df.columns, f"Missing column: {col}"


def test_apply_all_does_not_drop_source_columns():
    df = make_weekly_df(20)
    df = IndicatorEngine.apply_all(df, ma_length=5)
    for col in ["close", "Spread", "DGS10", "DGS2", "YieldCurve", "TR", "Ret"]:
        assert col in df.columns
