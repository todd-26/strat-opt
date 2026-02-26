import sys
import json
import asyncio
from pathlib import Path
from typing import AsyncGenerator

from fastapi import FastAPI
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
from strategy_buyhold import BuyAndHoldStrategy    # noqa: E402
from backtester import Backtester                  # noqa: E402
from optimizer_sphy import SPHYOptimizer           # noqa: E402

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

FALLBACK_CONFIG = {
    "defaultParams": {
        "MA": 50,
        "DROP": 0.017,
        "CHG4": 0.165,
        "RET3": -0.021,
        "SPREAD_LVL": 7.0,
    },
    "defaultRanges": {
        "MA":         {"min": 50,      "max": 50,      "step": 5},
        "DROP":       {"min": 0.016,   "max": 0.016,   "step": 0.001},
        "CHG4":       {"min": 0.16,    "max": 0.16,    "step": 0.005},
        "RET3":       {"min": -0.0225, "max": -0.0225, "step": 0.0005},
        "SPREAD_LVL": {"min": 7.0,     "max": 7.0,     "step": 0.1},
    },
}

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
        import math
        if val is None or math.isnan(float(val)):
            return None
        return float(val)
    except (TypeError, ValueError):
        return None


def _build_trade_history(bt_df, buy_dates, sell_dates) -> list[TradeEvent]:
    events: list[TradeEvent] = []

    for d in sell_dates:
        row = bt_df.loc[d]
        events.append(TradeEvent(
            date=d.strftime("%Y-%m-%d"),
            action="SELL",
            price=float(row["close"]),
            spread=_safe_float(row.get("Spread")),
            chg4=_safe_float(row.get("chg4")),
            ret3=_safe_float(row.get("ret3")),
            spread_delta=_safe_float(row.get("spread_delta")),
        ))

    for d in buy_dates:
        row = bt_df.loc[d]
        events.append(TradeEvent(
            date=d.strftime("%Y-%m-%d"),
            action="BUY",
            price=float(row["close"]),
            spread=_safe_float(row.get("Spread")),
            chg4=_safe_float(row.get("chg4")),
            ret3=_safe_float(row.get("ret3")),
            spread_delta=_safe_float(row.get("spread_delta")),
        ))

    events.sort(key=lambda e: e.date, reverse=True)
    return events


def _build_backtest_result(bt_result: dict) -> BacktestResult:
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
        trade_history=_build_trade_history(df, buy_dates, sell_dates),
        final_value=bt_result["final_value"],
        apy=bt_result["apy"],
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/api/securities")
def get_securities():
    return ["SPHY"]


@app.post("/api/run/buyhold", response_model=BacktestResult)
def run_buyhold(req: BuyHoldRequest):
    loader = WeeklyDataLoader(req.input_type, INPUT_DIR, req.ticker)
    df = loader.load()

    strat = BuyAndHoldStrategy()
    positions, buys, sells = strat.run(df)

    bt = Backtester(req.cash_rate)
    bt_result = bt.run(df, positions, buys, sells)

    return _build_backtest_result(bt_result)


@app.post("/api/run/signal", response_model=SignalResponse)
def run_signal(req: SignalRequest):
    p = req.params

    loader = WeeklyDataLoader(req.input_type, INPUT_DIR, req.ticker)
    df = loader.load()

    df_ind = IndicatorEngine.apply_all(df.copy(), p.MA)

    strat = SPHYStrategy(
        MA_LENGTH=p.MA,
        DROP=p.DROP,
        CHG4_THR=p.CHG4,
        RET3_THR=p.RET3,
        SPREAD_LVL=p.SPREAD_LVL,
    )

    positions, buy_dates, sell_dates = strat.run(df_ind, start_invested=req.start_invested)

    bt = Backtester(0.04)
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

    metrics = SignalMetrics(
        spread=_safe_float(last_row.get("Spread")),
        ma=_safe_float(last_row.get(ma_col)),
        ret3=_safe_float(last_row.get("ret3")),
        chg4=_safe_float(last_row.get("chg4")),
        spread_delta=_safe_float(last_row.get("spread_delta")),
        last_date=last_idx.strftime("%Y-%m-%d"),
        close=float(last_row["close"]),
    )

    trade_history = _build_trade_history(bt_result["df"], buy_dates, sell_dates)

    return SignalResponse(
        signal=signal,
        metrics=metrics,
        trade_history=trade_history,
        apy=bt_result["apy"],
        final_value=bt_result["final_value"],
    )


@app.post("/api/run/optimizer")
async def run_optimizer(req: OptimizerRequest):
    async def event_stream() -> AsyncGenerator[str, None]:
        loop = asyncio.get_event_loop()
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
                }
                opt = SPHYOptimizer(
                    input_type=req.input_type,
                    input_dir=INPUT_DIR,
                    cash_rate=req.cash_rate,
                    param_grids=param_grids,
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
        import concurrent.futures
        executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
        future = loop.run_in_executor(executor, run_sync)

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

                best_bt = _build_backtest_result(best_result)

                best_params_model = StrategyParams(
                    MA=int(best_params["MA"]),
                    DROP=float(best_params["DROP"]),
                    CHG4=float(best_params["CHG4"]),
                    RET3=float(best_params["RET3"]),
                    SPREAD_LVL=float(best_params["SPREAD_LVL"]),
                )

                all_results = [
                    OptimizerResultRow(
                        MA=int(row["MA"]),
                        DROP=float(row["DROP"]),
                        CHG4=float(row["CHG4"]),
                        RET3=float(row["RET3"]),
                        SPREAD_LVL=float(row["SPREAD_LVL"]),
                        APY=float(row["APY"]),
                        final_value=float(row["final_value"]),
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
def get_config():
    if CONFIG_PATH.exists():
        return json.loads(CONFIG_PATH.read_text())
    return FALLBACK_CONFIG


@app.post("/api/config")
def save_config(config: AppConfig):
    CONFIG_PATH.write_text(config.model_dump_json(indent=2))
    return {"ok": True}


# ---------------------------------------------------------------------------
# Static file serving (production build)
# ---------------------------------------------------------------------------
DIST_DIR = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if DIST_DIR.exists():
    app.mount("/", StaticFiles(directory=str(DIST_DIR), html=True), name="static")
