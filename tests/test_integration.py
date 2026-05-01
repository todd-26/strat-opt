"""
Integration tests: full pipeline on real SPHY CSV data.

Skipped automatically if any required input file is missing.
Run data fetch first if skipped: Settings → Manage Securities → Update All / Update Economic Data.
"""
import sys
import json
import pytest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from data_loader import WeeklyDataLoader
from indicators import IndicatorEngine
from strategy_generic import GenericStrategy
from backtester import Backtester

# ---------------------------------------------------------------------------
# Skip entire module if any CSV is absent
# ---------------------------------------------------------------------------

INPUTS_DIR = Path(__file__).parent.parent / "inputs"
TICKER = "SPHY"

_REQUIRED = [
    INPUTS_DIR / f"{TICKER.lower()}-weekly-adjusted.csv",
    INPUTS_DIR / "BAMLH0A0HYM2.csv",
    INPUTS_DIR / "DGS10.csv",
    INPUTS_DIR / "DGS2.csv",
]

pytestmark = pytest.mark.skipif(
    not all(f.exists() for f in _REQUIRED),
    reason="Integration CSV files missing from inputs/ — fetch data first",
)

# ---------------------------------------------------------------------------
# Load live SPHY config so tests always reflect current saved parameters
# ---------------------------------------------------------------------------

def _load_sphy_config():
    cfg = json.loads(
        (Path(__file__).parent.parent / "api" / "securities_config.json").read_text()
    )
    sec = cfg["securities"][TICKER]
    params_cfg = sec["parameters"]
    params, ignore = {}, set()
    for factor, v in {**params_cfg["sell_triggers"], **params_cfg["buy_conditions"]}.items():
        params[factor] = v["default"]
        if v["ignore"]:
            ignore.add(factor)
    return params, ignore, sec["cash_rate"], sec["start_invested"]


_PARAMS, _IGNORE, _CASH_RATE, _START_INVESTED = _load_sphy_config()


# ---------------------------------------------------------------------------
# Shared fixture — loads and prepares data once for all tests in this module
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def pipeline_df():
    loader = WeeklyDataLoader("csv", INPUTS_DIR, TICKER)
    df = loader.load()
    return IndicatorEngine.apply_all(df, ma_length=int(_PARAMS.get("MA", 50)))


# ---------------------------------------------------------------------------
# Economic data integrity — oldest record must be 2000-01-03
# If these fail, the CSV was likely overwritten with a truncated fetch
# ---------------------------------------------------------------------------

import pandas as pd

_FRED_FILES = {
    "BAMLH0A0HYM2": INPUTS_DIR / "BAMLH0A0HYM2.csv",
    "DGS10":        INPUTS_DIR / "DGS10.csv",
    "DGS2":         INPUTS_DIR / "DGS2.csv",
}
_EXPECTED_START = pd.Timestamp("2000-01-03")


@pytest.mark.parametrize("series_id,path", list(_FRED_FILES.items()))
def test_fred_history_starts_at_2000(series_id, path):
    """Oldest row must be 2000-01-03 — detects accidental truncation to FRED's 3-year window."""
    df = pd.read_csv(path, parse_dates=["date"])
    oldest = df["date"].min()
    assert oldest == _EXPECTED_START, (
        f"{series_id}: oldest entry is {oldest.date()}, expected 2000-01-03. "
        f"File may have been overwritten by a full fetch instead of an append."
    )


# ---------------------------------------------------------------------------
# Pipeline integration
# ---------------------------------------------------------------------------

def test_pipeline_loads_data(pipeline_df):
    """DataFrame is non-empty with all required columns present."""
    assert len(pipeline_df) > 50
    for col in ["close", "Spread", "DGS10", "DGS2", "Ret",
                "chg4", "ret3", "spread_delta", "yield10_chg4"]:
        assert col in pipeline_df.columns


def test_pipeline_date_range_is_sane(pipeline_df):
    assert pipeline_df.index.min().year >= 2000
    assert pipeline_df.index.max().year >= 2020
    assert pipeline_df.index.is_monotonic_increasing


def test_pipeline_strategy_produces_trades(pipeline_df):
    strat = GenericStrategy(_PARAMS, ignore=_IGNORE)
    positions, buy_dates, sell_dates = strat.run(pipeline_df, start_invested=_START_INVESTED)

    assert len(positions) == len(pipeline_df)
    assert len(sell_dates) > 0
    assert len(buy_dates) > 0
    assert abs(len(buy_dates) - len(sell_dates)) <= 1


def test_pipeline_backtester_runs(pipeline_df):
    strat = GenericStrategy(_PARAMS, ignore=_IGNORE)
    positions, buy_dates, sell_dates = strat.run(pipeline_df, start_invested=_START_INVESTED)

    result = Backtester(cash_rate=_CASH_RATE).run(pipeline_df, positions, buy_dates, sell_dates)

    assert result["final_value"] > 0
    assert result["apy"] > -1.0       # can't lose more than 100%
    assert "Strategy" in result["df"].columns


# ---------------------------------------------------------------------------
# Vectorized vs row-by-row consistency
# ---------------------------------------------------------------------------

def _run_row_by_row(strat, df, start_invested):
    """
    Mirrors GenericStrategy.run() exactly, substituting evaluate_sell/evaluate_buy
    for the precomputed masks from _compute_signals(). Any divergence is a bug.
    """
    invested = int(start_invested)
    was_sold = (start_invested == 0)
    positions, buy_dates, sell_dates = [], [], []

    for idx, row in df.iterrows():
        if invested:
            if strat.evaluate_sell(row, df, idx):
                invested = 0
                was_sold = True
                sell_dates.append(idx)
        else:
            sell_active = strat.evaluate_sell(row, df, idx)
            if was_sold and strat.evaluate_buy(row, df, idx, was_sold) and not sell_active:
                invested = 1
                buy_dates.append(idx)
        positions.append(invested)

    return positions, buy_dates, sell_dates


def test_vectorized_matches_row_by_row(pipeline_df):
    """
    _compute_signals() and evaluate_sell/evaluate_buy must produce identical positions.
    This test would have caught the DROP window off-by-one bug before it shipped.
    """
    strat = GenericStrategy(_PARAMS, ignore=_IGNORE)
    positions_vec, buy_vec, sell_vec = strat.run(pipeline_df, start_invested=_START_INVESTED)
    positions_row, buy_row, sell_row = _run_row_by_row(strat, pipeline_df, _START_INVESTED)

    mismatches = [i for i, (v, r) in enumerate(zip(positions_vec, positions_row)) if v != r]
    assert mismatches == [], (
        f"{len(mismatches)} position mismatch(es) at rows: {mismatches[:10]}"
    )
    assert buy_vec == buy_row
    assert sell_vec == sell_row
