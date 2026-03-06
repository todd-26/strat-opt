import sys
import re
import json
import math
import asyncio
import concurrent.futures
from pathlib import Path
from typing import AsyncGenerator
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")
load_dotenv(Path(__file__).parent.parent / ".env.local", override=True)

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles

# Add the code/ directory to sys.path so we can import the pipeline modules
CODE_DIR = Path(__file__).resolve().parent.parent / "backend"
INPUT_DIR = Path(__file__).resolve().parent.parent / "inputs"
sys.path.insert(0, str(CODE_DIR))

from data_loader import WeeklyDataLoader          # noqa: E402
from indicators import IndicatorEngine             # noqa: E402
from strategy_sphy import SPHYStrategy             # noqa: E402
from strategy_shym import SHYMStrategy             # noqa: E402
from strategy_nea import NEAStrategy               # noqa: E402
from strategy_buyhold import BuyAndHoldStrategy    # noqa: E402
from backtester import Backtester                  # noqa: E402
from optimizer_sphy import SPHYOptimizer           # noqa: E402
from optimizer_shym import SHYMOptimizer           # noqa: E402
from optimizer_nea import NEAOptimizer             # noqa: E402

from models import (                               # noqa: E402
    BuyHoldRequest,
    SignalRequest,
    OptimizerRequest,
    BacktestResult,
    EquityPoint,
    TradeEvent,
    SignalResponse,
    SignalMetrics,
    OptimizerResponse,
    OptimizerResultRow,
    StrategyParams,
    AppConfig,
)

app = FastAPI(title="strat-opt API")

CONFIG_PATH = Path(__file__).parent / "config.json"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _safe_float(val) -> float | None:
    """Return None for NaN/None, otherwise float."""
    try:
        if val is None or math.isnan(float(val)):
            return None
        return float(val)
    except (TypeError, ValueError):
        return None


def _build_trade_history(bt_df, buy_dates, sell_dates, spread_delta_n=2, yield10_delta_n=2) -> list[TradeEvent]:
    # Auto-detect the MA column (e.g. "MA50")
    ma_cols = [c for c in bt_df.columns if re.match(r'^MA\d+$', c)]
    ma_col = ma_cols[0] if ma_cols else None

    events: list[TradeEvent] = []

    for d in sell_dates:
        pos = bt_df.index.get_loc(d)
        row = bt_df.iloc[pos]
        events.append(TradeEvent(
            date=d.strftime("%Y-%m-%d"),
            action="SELL",
            price=float(row["close"]),
            spread=_safe_float(row.get("Spread")),
            chg4=_safe_float(row.get("chg4")),
            ret3=_safe_float(row.get("ret3")),
            spread_delta=_safe_float(row.get("spread_delta")),
            ma_value=_safe_float(row.get(ma_col)) if ma_col else None,
            spread_4wk_ago=_safe_float(bt_df.iloc[pos - 4]["Spread"]) if pos >= 4 else None,
            close_3wk_ago=_safe_float(bt_df.iloc[pos - 3]["close"]) if pos >= 3 else None,
            yield10_chg4=_safe_float(row.get("yield10_chg4")),
            yield2_chg4=_safe_float(row.get("yield2_chg4")),
            curve_chg4=_safe_float(row.get("curve_chg4")),
            yield10_delta=_safe_float(row.get("yield10_delta")),
            yield10_4wk_ago=_safe_float(bt_df.iloc[pos - 4]["DGS10"]) if pos >= 4 else None,
            yield2_4wk_ago=_safe_float(bt_df.iloc[pos - 4]["DGS2"]) if pos >= 4 else None,
            curve_4wk_ago=_safe_float(bt_df.iloc[pos - 4]["YieldCurve"]) if pos >= 4 else None,
        ))

    for d in buy_dates:
        pos = bt_df.index.get_loc(d)
        row = bt_df.iloc[pos]
        # Compute drop from 4-week spread peak (buy rule: spread <= peak * (1 - DROP))
        start = max(0, pos - 3)
        spreads_window = bt_df.iloc[start:pos + 1]["Spread"]
        peak = spreads_window.max()
        spread_val = row.get("Spread")
        drop = 1 - (spread_val / peak) if (peak and not math.isnan(peak) and spread_val is not None and not math.isnan(spread_val)) else None
        events.append(TradeEvent(
            date=d.strftime("%Y-%m-%d"),
            action="BUY",
            price=float(row["close"]),
            spread=_safe_float(row.get("Spread")),
            chg4=_safe_float(row.get("chg4")),
            ret3=_safe_float(row.get("ret3")),
            spread_delta=_safe_float(row.get("spread_delta")),
            ma_value=_safe_float(row.get(ma_col)) if ma_col else None,
            spread_delta_history=[
                _safe_float(bt_df.iloc[pos - (spread_delta_n - 1 - i)].get("spread_delta"))
                for i in range(spread_delta_n) if pos - (spread_delta_n - 1 - i) >= 0
            ] or None,
            spread_drop=_safe_float(drop),
            spread_4wk_peak=_safe_float(peak),
            yield10_chg4=_safe_float(row.get("yield10_chg4")),
            yield2_chg4=_safe_float(row.get("yield2_chg4")),
            curve_chg4=_safe_float(row.get("curve_chg4")),
            yield10_delta=_safe_float(row.get("yield10_delta")),
            yield10_delta_history=[
                _safe_float(bt_df.iloc[pos - (yield10_delta_n - 1 - i)].get("yield10_delta"))
                for i in range(yield10_delta_n) if pos - (yield10_delta_n - 1 - i) >= 0
            ] or None,
        ))

    events.sort(key=lambda e: e.date, reverse=True)
    return events


def _build_backtest_result(bt_result: dict, spread_delta_n=2, yield10_delta_n=2) -> BacktestResult:
    df = bt_result["df"]
    buy_dates = bt_result["buy_dates"]
    sell_dates = bt_result["sell_dates"]

    equity_curve = [
        EquityPoint(date=idx.strftime("%Y-%m-%d"), strategy=float(row["Strategy"]))
        for idx, row in df.iterrows()
    ]

    return BacktestResult(
        equity_curve=equity_curve,
        buy_dates=[d.strftime("%Y-%m-%d") for d in buy_dates],
        sell_dates=[d.strftime("%Y-%m-%d") for d in sell_dates],
        trade_history=_build_trade_history(df, buy_dates, sell_dates, spread_delta_n, yield10_delta_n),
        final_value=bt_result["final_value"],
        apy=bt_result["apy"],
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

STRATEGY_CLASSES = {
    "SPHY": SPHYStrategy,
    "SHYM": SHYMStrategy,
    "NEA":  NEAStrategy,
}

OPTIMIZER_CLASSES = {
    "SPHY": SPHYOptimizer,
    "SHYM": SHYMOptimizer,
    "NEA":  NEAOptimizer,
}

SECURITIES = list(STRATEGY_CLASSES.keys())


@app.get("/api/securities")
def get_securities():
    return SECURITIES


@app.get("/api/date-range")
def get_date_range(ticker: str = Query(default="SPHY"), input_type: str = Query(default="csv")):
    """Return the min/max dates available for a ticker's data."""
    loader = WeeklyDataLoader(input_type, INPUT_DIR, ticker)
    price_df = loader.load_price_dividend()
    spread_df = loader.load_spread()
    weekly = loader.merge_price_spread(price_df, spread_df)
    return {
        "min": weekly.index.min().strftime("%Y-%m-%d"),
        "max": weekly.index.max().strftime("%Y-%m-%d"),
    }


@app.post("/api/run/buyhold", response_model=BacktestResult)
def run_buyhold(req: BuyHoldRequest):
    loader = WeeklyDataLoader(req.input_type, INPUT_DIR, req.ticker)
    df = loader.load(start_date=req.start_date, end_date=req.end_date)

    strat = BuyAndHoldStrategy()
    positions, buys, sells = strat.run(df)

    bt = Backtester(req.cash_rate)
    bt_result = bt.run(df, positions, buys, sells)

    return _build_backtest_result(bt_result)


@app.post("/api/run/signal", response_model=SignalResponse)
def run_signal(req: SignalRequest):
    p = req.params

    loader = WeeklyDataLoader(req.input_type, INPUT_DIR, req.ticker)
    df = loader.load(start_date=req.start_date, end_date=req.end_date)

    df_ind = IndicatorEngine.apply_all(df.copy(), p.MA)

    strategy_cls = STRATEGY_CLASSES.get(req.ticker.upper(), SPHYStrategy)
    strat = strategy_cls(
        MA_LENGTH=p.MA,
        DROP=p.DROP,
        CHG4_THR=p.CHG4,
        RET3_THR=p.RET3,
        SPREAD_LVL=p.SPREAD_LVL,
        YIELD10_CHG4_THR=p.YIELD10_CHG4,
        YIELD2_CHG4_THR=p.YIELD2_CHG4,
        CURVE_CHG4_THR=p.CURVE_CHG4,
        SPREAD_DELTA_N=p.SPREAD_DELTA,
        YIELD10_DELTA_N=p.YIELD10_DELTA,
        disabled=set(req.disabled_factors),
    )

    positions, buy_dates, sell_dates = strat.run(df_ind, start_invested=req.start_invested)

    bt = Backtester(req.cash_rate)
    bt_result = bt.run(df_ind, positions, buy_dates, sell_dates)

    # Determine current signal from last two positions
    if len(positions) >= 2:
        prev_pos = positions[-2]
        last_pos = positions[-1]
    else:
        prev_pos = positions[-1] if positions else 0
        last_pos = prev_pos

    if last_pos == 1 and prev_pos == 0:
        signal = "BUY"
    elif last_pos == 0 and prev_pos == 1:
        signal = "SELL"
    else:
        signal = "HOLD"

    # Current metrics from last row
    last_idx = df_ind.index[-1]
    last_row = df_ind.iloc[-1]
    ma_col = f"MA{p.MA}"

    last_pos = len(df_ind) - 1
    spread_window = df_ind.iloc[max(0, last_pos - 3):last_pos + 1]["Spread"]
    spread_peak = spread_window.max()
    spread_val = last_row.get("Spread")
    spread_drop_val = (
        1 - (spread_val / spread_peak)
        if (spread_peak and not math.isnan(spread_peak) and spread_val is not None and not math.isnan(float(spread_val)))
        else None
    )

    metrics = SignalMetrics(
        spread=_safe_float(last_row.get("Spread")),
        ma=_safe_float(last_row.get(ma_col)),
        ret3=_safe_float(last_row.get("ret3")),
        chg4=_safe_float(last_row.get("chg4")),
        spread_delta=_safe_float(last_row.get("spread_delta")),
        yield10_chg4=_safe_float(last_row.get("yield10_chg4")),
        yield2_chg4=_safe_float(last_row.get("yield2_chg4")),
        curve_chg4=_safe_float(last_row.get("curve_chg4")),
        yield10_delta=_safe_float(last_row.get("yield10_delta")),
        spread_drop=_safe_float(spread_drop_val),
        spread_4wk_peak=_safe_float(spread_peak),
        last_date=last_idx.strftime("%Y-%m-%d"),
        close=float(last_row["close"]),
    )

    trade_history = _build_trade_history(bt_result["df"], buy_dates, sell_dates, p.SPREAD_DELTA, p.YIELD10_DELTA)

    return SignalResponse(
        signal=signal,
        metrics=metrics,
        trade_history=trade_history,
        apy=bt_result["apy"],
        final_value=bt_result["final_value"],
        data_start=df_ind.index[0].strftime("%Y-%m-%d"),
        data_end=df_ind.index[-1].strftime("%Y-%m-%d"),
    )


@app.post("/api/run/optimizer")
async def run_optimizer(req: OptimizerRequest):
    async def event_stream() -> AsyncGenerator[str, None]:
        loop = asyncio.get_running_loop()
        queue: asyncio.Queue = asyncio.Queue()

        def progress_callback(current: int, total: int):
            # Thread-safe enqueue from blocking thread
            loop.call_soon_threadsafe(queue.put_nowait, ("progress", current, total))

        def run_sync():
            try:
                param_grids = {
                    "MA": req.MA,
                    "DROP": req.DROP,
                    "CHG4": req.CHG4,
                    "RET3": req.RET3,
                    "SPREAD_LVL": req.SPREAD_LVL,
                    "YIELD10_CHG4": req.YIELD10_CHG4,
                    "YIELD2_CHG4": req.YIELD2_CHG4,
                    "CURVE_CHG4": req.CURVE_CHG4,
                    "SPREAD_DELTA": req.SPREAD_DELTA,
                    "YIELD10_DELTA": req.YIELD10_DELTA,
                }
                optimizer_cls = OPTIMIZER_CLASSES.get(req.ticker.upper(), SPHYOptimizer)
                opt = optimizer_cls(
                    input_type=req.input_type,
                    input_dir=INPUT_DIR,
                    cash_rate=req.cash_rate,
                    param_grids=param_grids,
                    start_date=req.start_date,
                    end_date=req.end_date,
                    disabled_factors=set(req.disabled_factors),
                )
                best_params, results_df, best_result = opt.run(
                    ticker=req.ticker,
                    start_invested=req.start_invested,
                    progress_callback=progress_callback,
                )
                loop.call_soon_threadsafe(queue.put_nowait, ("result", best_params, results_df, best_result))
            except Exception as exc:
                loop.call_soon_threadsafe(queue.put_nowait, ("error", str(exc)))

        # Run optimizer in a thread pool so it doesn't block the event loop
        executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
        loop.run_in_executor(executor, run_sync)

        try:
            while True:
                try:
                    item = await asyncio.wait_for(queue.get(), timeout=300.0)
                except asyncio.TimeoutError:
                    yield "event: error\ndata: {\"message\": \"Optimizer timed out\"}\n\n"
                    break

                kind = item[0]

                if kind == "progress":
                    _, current, total = item
                    data = json.dumps({"current": current, "total": total})
                    yield f"event: progress\ndata: {data}\n\n"

                elif kind == "result":
                    _, best_params, results_df, best_result = item

                    best_bt = _build_backtest_result(best_result, int(best_params["SPREAD_DELTA"]), int(best_params["YIELD10_DELTA"]))

                    best_params_model = StrategyParams(
                        MA=int(best_params["MA"]),
                        DROP=float(best_params["DROP"]),
                        CHG4=float(best_params["CHG4"]),
                        RET3=float(best_params["RET3"]),
                        SPREAD_LVL=float(best_params["SPREAD_LVL"]),
                        YIELD10_CHG4=float(best_params["YIELD10_CHG4"]),
                        YIELD2_CHG4=float(best_params["YIELD2_CHG4"]),
                        CURVE_CHG4=float(best_params["CURVE_CHG4"]),
                        SPREAD_DELTA=int(best_params["SPREAD_DELTA"]),
                        YIELD10_DELTA=int(best_params["YIELD10_DELTA"]),
                    )

                    all_results = [
                        OptimizerResultRow(
                            MA=int(row["MA"]),
                            DROP=float(row["DROP"]),
                            CHG4=float(row["CHG4"]),
                            RET3=float(row["RET3"]),
                            SPREAD_LVL=float(row["SPREAD_LVL"]),
                            YIELD10_CHG4=float(row["YIELD10_CHG4"]),
                            YIELD2_CHG4=float(row["YIELD2_CHG4"]),
                            CURVE_CHG4=float(row["CURVE_CHG4"]),
                            SPREAD_DELTA=int(row["SPREAD_DELTA"]),
                            YIELD10_DELTA=int(row["YIELD10_DELTA"]),
                            APY=float(row["APY"]),
                            final_value=float(row["final_value"]),
                            trade_count=int(row["trade_count"]),
                        )
                        for _, row in results_df.iterrows()
                    ]

                    response = OptimizerResponse(
                        best_params=best_params_model,
                        best_result=best_bt,
                        all_results=all_results,
                    )
                    data = response.model_dump_json()
                    yield f"event: result\ndata: {data}\n\n"
                    break

                elif kind == "error":
                    _, msg = item
                    data = json.dumps({"message": msg})
                    yield f"event: error\ndata: {data}\n\n"
                    break
        finally:
            executor.shutdown(wait=False)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/config")
def get_config(ticker: str = Query(default="SPHY")):
    full = json.loads(CONFIG_PATH.read_text())
    ticker = ticker.upper()
    if ticker not in full:
        raise HTTPException(status_code=404, detail=f"No config found for ticker {ticker}")
    return AppConfig(**full[ticker]).model_dump()


@app.post("/api/config")
def save_config(config: AppConfig, ticker: str = Query(default="SPHY")):
    ticker = ticker.upper()
    full = json.loads(CONFIG_PATH.read_text())
    full[ticker] = json.loads(config.model_dump_json())
    CONFIG_PATH.write_text(json.dumps(full, indent=2))
    return {"ok": True}


# ---------------------------------------------------------------------------
# Static file serving (production build)
# ---------------------------------------------------------------------------
DIST_DIR = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if DIST_DIR.exists():
    app.mount("/", StaticFiles(directory=str(DIST_DIR), html=True), name="static")
