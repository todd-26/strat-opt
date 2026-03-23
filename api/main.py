import os
import sys
import re
import json
import math
import asyncio
import threading
import requests as _requests
import concurrent.futures
import pandas as _pd
from pathlib import Path
from typing import AsyncGenerator
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")
load_dotenv(Path(__file__).parent.parent / ".env.local", override=True)

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles

CODE_DIR  = Path(__file__).resolve().parent.parent / "backend"
INPUT_DIR = Path(__file__).resolve().parent.parent / "inputs"
sys.path.insert(0, str(CODE_DIR))

from data_loader import WeeklyDataLoader          # noqa: E402
from indicators import IndicatorEngine             # noqa: E402
from strategy_generic import GenericStrategy       # noqa: E402
from strategy_buyhold import BuyAndHoldStrategy    # noqa: E402
from backtester import Backtester                  # noqa: E402
from optimizer_generic import GenericOptimizer     # noqa: E402
from walk_forward import WalkForwardEngine         # noqa: E402

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
    AddSecurityRequest,
    ReorderSecuritiesRequest,
    WalkForwardRequest,
    WalkForwardResponse,
    ValidateWindowResult,
    DiscoverWindowResult,
    FactorStability,
)

app = FastAPI(title="strat-opt API")

CONFIG_PATH = Path(__file__).parent / "securities_config.json"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _load_config() -> dict:
    return json.loads(CONFIG_PATH.read_text())


def _safe_float(val) -> float | None:
    try:
        if val is None or math.isnan(float(val)):
            return None
        return float(val)
    except (TypeError, ValueError):
        return None


def _build_trade_history(bt_df, buy_dates, sell_dates, spread_delta_n=2, yield10_delta_n=2) -> list[TradeEvent]:
    ma_cols = [c for c in bt_df.columns if re.match(r'^MA\d+$', c)]
    ma_col  = ma_cols[0] if ma_cols else None

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
        start = max(0, pos - 3)
        spreads_window = bt_df.iloc[start:pos + 1]["Spread"]
        peak = spreads_window.max()
        spread_val = row.get("Spread")
        drop = 1 - (spread_val / peak) if (peak and not math.isnan(peak) and spread_val is not None and not math.isnan(float(spread_val))) else None
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
                v for v in (
                    _safe_float(bt_df.iloc[pos - (spread_delta_n - 1 - i)].get("spread_delta"))
                    for i in range(spread_delta_n) if pos - (spread_delta_n - 1 - i) >= 0
                ) if v is not None
            ] or None,
            spread_drop=_safe_float(drop),
            spread_4wk_peak=_safe_float(peak),
            yield10_chg4=_safe_float(row.get("yield10_chg4")),
            yield2_chg4=_safe_float(row.get("yield2_chg4")),
            curve_chg4=_safe_float(row.get("curve_chg4")),
            yield10_delta=_safe_float(row.get("yield10_delta")),
            yield10_delta_history=[
                v for v in (
                    _safe_float(bt_df.iloc[pos - (yield10_delta_n - 1 - i)].get("yield10_delta"))
                    for i in range(yield10_delta_n) if pos - (yield10_delta_n - 1 - i) >= 0
                ) if v is not None
            ] or None,
        ))

    events.sort(key=lambda e: e.date, reverse=True)
    return events


def _build_backtest_result(bt_result: dict, spread_delta_n=2, yield10_delta_n=2) -> BacktestResult:
    df         = bt_result["df"]
    buy_dates  = bt_result["buy_dates"]
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


def _fetch_and_save_csv(ticker: str) -> None:
    """Fetch weekly adjusted CSV from Alpha Vantage and save to inputs dir."""
    api_key = os.environ.get("ALPHA_VANTAGE_API_KEY")
    if not api_key:
        raise ValueError("ALPHA_VANTAGE_API_KEY is not set in the environment.")
    url_template = os.environ.get(
        "ALPHA_VANTAGE_URL",
        "https://www.alphavantage.co/query?function=TIME_SERIES_WEEKLY_ADJUSTED&symbol={ticker}&outputsize=full&datatype=csv&apikey={apikey}",
    )
    url = url_template.format(ticker=ticker, apikey=api_key)
    resp = _requests.get(url, timeout=30)
    resp.raise_for_status()
    content = resp.text
    # Alpha Vantage returns JSON error messages even for CSV requests
    if content.strip().startswith("{"):
        try:
            err = json.loads(content)
            msg = (err.get("Error Message") or err.get("Note") or
                   err.get("Information") or "Unknown Alpha Vantage error")
            raise ValueError(msg)
        except json.JSONDecodeError:
            pass
    csv_path = INPUT_DIR / f"{ticker.lower()}-weekly-adjusted.csv"
    csv_path.write_text(content, encoding="utf-8")


_FRED_SERIES = ('BAMLH0A0HYM2', 'DGS10', 'DGS2')


def _fetch_and_save_fred(series_id: str) -> None:
    """Fetch full FRED series history from API and save to inputs CSV, bypassing app cache."""
    api_key = os.environ.get("FRED_API_KEY")
    url = os.environ.get("FRED_URL")
    if not api_key:
        raise ValueError("FRED_API_KEY is not set")
    if not url:
        raise ValueError("FRED_URL is not set")
    params = {
        'api_key': api_key,
        'series_id': series_id,
        'file_type': 'json',
        'observation_start': '2000-01-01',
    }
    resp = _requests.get(url, params=params, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    if 'observations' not in data:
        msg = next(iter(data.values()), "Unknown FRED error") if data else "Empty response"
        raise ValueError(f"FRED API error for {series_id}: {msg}")
    df = _pd.DataFrame(data['observations'])[['date', 'value']]
    (INPUT_DIR / f"{series_id}.csv").write_text(df.to_csv(index=False), encoding='utf-8')


def _update_fred_if_stale(av_ticker: str) -> None:
    """Refresh any FRED CSVs that are older than the given security's AV CSV."""
    av_path = INPUT_DIR / f"{av_ticker.lower()}-weekly-adjusted.csv"
    if not av_path.exists():
        return
    av_mtime = av_path.stat().st_mtime
    for series_id in _FRED_SERIES:
        fred_path = INPUT_DIR / f"{series_id}.csv"
        if not fred_path.exists() or fred_path.stat().st_mtime < av_mtime:
            _fetch_and_save_fred(series_id)


def _security_to_appconfig(sec: dict) -> AppConfig:
    """Convert a securities_config.json security block to an AppConfig model."""
    p = sec["parameters"]
    return AppConfig(
        name=sec["name"],
        cash_rate=sec["cash_rate"],
        cash_vehicle=sec.get("cash_vehicle", ""),
        start_invested=sec.get("start_invested", 1),
        sell_triggers={k: v for k, v in p["sell_triggers"].items()},
        buy_conditions={k: v for k, v in p["buy_conditions"].items()},
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/api/securities")
def get_securities():
    try:
        cfg = _load_config()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Cannot read securities_config.json: {exc}")
    secs = cfg.get("securities", {})
    if not secs:
        raise HTTPException(status_code=500, detail="securities_config.json contains no securities. Add at least one entry.")
    return list(secs.keys())


@app.post("/api/securities")
def add_security(req: AddSecurityRequest):
    import copy
    ticker   = req.ticker.upper().strip()
    template = req.template.upper().strip()

    if not re.match(r'^[A-Z]{1,10}$', ticker):
        raise HTTPException(status_code=400, detail=f"Invalid ticker '{ticker}': use 1–10 uppercase letters only.")

    full = _load_config()
    if ticker in full["securities"]:
        raise HTTPException(status_code=409, detail=f"{ticker} already exists.")
    if template not in full["securities"]:
        raise HTTPException(status_code=400, detail=f"Template ticker '{template}' not found.")

    csv_path = INPUT_DIR / f"{ticker.lower()}-weekly-adjusted.csv"
    if not csv_path.exists():
        try:
            _fetch_and_save_csv(ticker)
            _update_fred_if_stale(ticker)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to fetch data for {ticker}: {e}")

    new_sec = copy.deepcopy(full["securities"][template])
    new_sec["name"] = req.name.strip()
    new_sec["data_sources"]["price"]["symbol"] = ticker
    full["securities"][ticker] = new_sec

    CONFIG_PATH.write_text(json.dumps(full, indent=2))
    return {"ok": True}


@app.post("/api/securities/{ticker}/fetch-data")
def fetch_security_data(ticker: str):
    ticker = ticker.upper()
    full   = _load_config()
    if ticker not in full["securities"]:
        raise HTTPException(status_code=404, detail=f"{ticker} not found.")
    try:
        _fetch_and_save_csv(ticker)
        _update_fred_if_stale(ticker)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fetch failed: {e}")
    return {"ok": True}


@app.post("/api/securities/reorder")
def reorder_securities(body: ReorderSecuritiesRequest):
    full = _load_config()
    existing = full["securities"]
    # Rebuild dict in requested order, ignoring unknown tickers
    full["securities"] = {t: existing[t] for t in body.tickers if t in existing}
    CONFIG_PATH.write_text(json.dumps(full, indent=2))
    return {"ok": True}


@app.delete("/api/securities/{ticker}")
def remove_security(ticker: str):
    ticker = ticker.upper()
    full   = _load_config()
    if ticker not in full["securities"]:
        raise HTTPException(status_code=404, detail=f"{ticker} not found.")
    if len(full["securities"]) <= 1:
        raise HTTPException(status_code=400, detail="Cannot remove the last security.")
    del full["securities"][ticker]
    CONFIG_PATH.write_text(json.dumps(full, indent=2))
    return {"ok": True}


@app.get("/api/date-range")
def get_date_range(ticker: str = Query(), input_type: str = Query(default="csv")):
    loader    = WeeklyDataLoader(input_type, INPUT_DIR, ticker)
    price_df  = loader.load_price_dividend()
    spread_df = loader.load_spread()
    weekly    = loader.merge_price_spread(price_df, spread_df)
    return {
        "min": weekly.index.min().strftime("%Y-%m-%d"),
        "max": weekly.index.max().strftime("%Y-%m-%d"),
    }


@app.post("/api/run/buyhold", response_model=BacktestResult)
def run_buyhold(req: BuyHoldRequest):
    loader = WeeklyDataLoader(req.input_type, INPUT_DIR, req.ticker)
    try:
        df = loader.load(start_date=req.start_date, end_date=req.end_date)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    strat = BuyAndHoldStrategy()
    positions, buys, sells = strat.run(df)

    bt = Backtester(req.cash_rate)
    bt_result = bt.run(df, positions, buys, sells)

    return _build_backtest_result(bt_result)


@app.post("/api/run/signal", response_model=SignalResponse)
def run_signal(req: SignalRequest):
    p = req.params

    loader = WeeklyDataLoader(req.input_type, INPUT_DIR, req.ticker)
    try:
        df = loader.load(start_date=req.start_date, end_date=req.end_date)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    df_ind = IndicatorEngine.apply_all(df.copy(), p.MA)

    strat = GenericStrategy(
        params={
            'MA': p.MA, 'DROP': p.DROP, 'CHG4': p.CHG4, 'RET3': p.RET3,
            'YIELD10_CHG4': p.YIELD10_CHG4,
            'YIELD2_CHG4': p.YIELD2_CHG4, 'CURVE_CHG4': p.CURVE_CHG4,
            'SPREAD_DELTA': p.SPREAD_DELTA, 'YIELD10_DELTA': p.YIELD10_DELTA,
        },
        ignore=set(req.disabled_factors),
    )

    positions, buy_dates, sell_dates = strat.run(df_ind, start_invested=req.start_invested)

    bt        = Backtester(req.cash_rate)
    bt_result = bt.run(df_ind, positions, buy_dates, sell_dates)

    if len(positions) >= 2:
        prev_pos = positions[-2]
        last_pos_val = positions[-1]
    else:
        prev_pos = positions[-1] if positions else 0
        last_pos_val = prev_pos

    if last_pos_val == 1 and prev_pos == 0:
        signal = "BUY"
    elif last_pos_val == 0 and prev_pos == 1:
        signal = "SELL"
    else:
        signal = "HOLD"

    last_idx  = df_ind.index[-1]
    last_row  = df_ind.iloc[-1]
    ma_col    = f"MA{p.MA}"
    last_pos  = len(df_ind) - 1

    spread_window  = df_ind.iloc[max(0, last_pos - 3):last_pos + 1]["Spread"]
    spread_peak    = spread_window.max()
    spread_val     = last_row.get("Spread")
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
        spread_delta_history=[
            v for v in (
                _safe_float(df_ind.iloc[last_pos - (p.SPREAD_DELTA - 1 - i)].get("spread_delta"))
                for i in range(p.SPREAD_DELTA) if last_pos - (p.SPREAD_DELTA - 1 - i) >= 0
            ) if v is not None
        ] or None,
        yield10_chg4=_safe_float(last_row.get("yield10_chg4")),
        yield2_chg4=_safe_float(last_row.get("yield2_chg4")),
        curve_chg4=_safe_float(last_row.get("curve_chg4")),
        yield_curve=_safe_float(last_row.get("YieldCurve")),
        curve_4wk_ago=_safe_float(df_ind.iloc[last_pos - 4]["YieldCurve"]) if last_pos >= 4 else None,
        yield10_delta=_safe_float(last_row.get("yield10_delta")),
        yield10_delta_history=[
            v for v in (
                _safe_float(df_ind.iloc[last_pos - (p.YIELD10_DELTA - 1 - i)].get("yield10_delta"))
                for i in range(p.YIELD10_DELTA) if last_pos - (p.YIELD10_DELTA - 1 - i) >= 0
            ) if v is not None
        ] or None,
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
        loop  = asyncio.get_running_loop()
        queue: asyncio.Queue = asyncio.Queue()

        def progress_callback(current: int, total: int):
            loop.call_soon_threadsafe(queue.put_nowait, ("progress", current, total))

        def run_sync():
            try:
                param_grids = {
                    'MA': req.MA, 'DROP': req.DROP, 'CHG4': req.CHG4,
                    'RET3': req.RET3,
                    'YIELD10_CHG4': req.YIELD10_CHG4, 'YIELD2_CHG4': req.YIELD2_CHG4,
                    'CURVE_CHG4': req.CURVE_CHG4, 'SPREAD_DELTA': req.SPREAD_DELTA,
                    'YIELD10_DELTA': req.YIELD10_DELTA,
                }
                opt = GenericOptimizer(
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
                    yield f"event: progress\ndata: {json.dumps({'current': current, 'total': total})}\n\n"

                elif kind == "result":
                    _, best_params, results_df, best_result = item

                    best_bt = _build_backtest_result(
                        best_result,
                        int(best_params["SPREAD_DELTA"]),
                        int(best_params["YIELD10_DELTA"]),
                    )

                    best_params_model = StrategyParams(
                        MA=int(best_params["MA"]),
                        DROP=float(best_params["DROP"]),
                        CHG4=float(best_params["CHG4"]),
                        RET3=float(best_params["RET3"]),
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
                    yield f"event: result\ndata: {response.model_dump_json()}\n\n"
                    break

                elif kind == "error":
                    _, msg = item
                    yield f"event: error\ndata: {json.dumps({'message': msg})}\n\n"
                    break
        finally:
            executor.shutdown(wait=False)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/api/config")
def get_config(ticker: str = Query()):
    full   = _load_config()
    ticker = ticker.upper()
    if ticker not in full["securities"]:
        raise HTTPException(status_code=404, detail=f"No config found for ticker {ticker}")
    return _security_to_appconfig(full["securities"][ticker]).model_dump()


@app.post("/api/config")
def save_config(config: AppConfig, ticker: str = Query()):
    ticker = ticker.upper()
    full   = _load_config()
    if ticker not in full["securities"]:
        raise HTTPException(status_code=404, detail=f"No config found for ticker {ticker}")

    sec = full["securities"][ticker]
    sec["cash_rate"]     = config.cash_rate
    sec["start_invested"] = config.start_invested

    for k, v in config.sell_triggers.items():
        if k in sec["parameters"]["sell_triggers"]:
            sec["parameters"]["sell_triggers"][k].update(v.model_dump())

    for k, v in config.buy_conditions.items():
        if k in sec["parameters"]["buy_conditions"]:
            sec["parameters"]["buy_conditions"][k].update(v.model_dump())

    CONFIG_PATH.write_text(json.dumps(full, indent=2))
    return {"ok": True}


# ---------------------------------------------------------------------------
# Walk-forward endpoint
# ---------------------------------------------------------------------------

@app.post("/api/run/walk-forward")
async def run_walk_forward(req: WalkForwardRequest, request: Request):
    async def event_stream():
        loop  = asyncio.get_running_loop()
        queue: asyncio.Queue = asyncio.Queue()
        cancel_event = threading.Event()

        def progress_callback(current: int, total: int, status: str = ""):
            loop.call_soon_threadsafe(queue.put_nowait, ("progress", current, total, status))

        def run_sync():
            try:
                full    = _load_config()
                ticker  = req.ticker.upper()
                if ticker not in full["securities"]:
                    raise ValueError(f"Unknown ticker: {ticker}")
                sec_cfg = _security_to_appconfig(full["securities"][ticker])

                # Build seed params from saved config defaults
                seed_params = {
                    **{k: v.default for k, v in sec_cfg.sell_triggers.items()},
                    **{k: v.default for k, v in sec_cfg.buy_conditions.items()},
                }
                seed_ignore = set(
                    [k for k, v in sec_cfg.sell_triggers.items() if v.ignore] +
                    [k for k, v in sec_cfg.buy_conditions.items() if v.ignore]
                )

                engine = WalkForwardEngine(
                    input_type=req.input_type,
                    input_dir=INPUT_DIR,
                    ticker=ticker,
                    cash_rate=sec_cfg.cash_rate,
                    start_invested=sec_cfg.start_invested,
                    config=sec_cfg,
                )

                if req.mode == "validate":
                    rows = engine.run_validate(
                        window_size_months=req.window_size_months,
                        window_type=req.window_type,
                        initial_training_months=req.initial_training_months,
                        training_window_months=req.training_window_months,
                        seed_params=seed_params,
                        seed_ignore=seed_ignore,
                        progress_callback=progress_callback,
                        cancel_event=cancel_event,
                    )
                    response = WalkForwardResponse(
                        mode="validate",
                        validate_results=[ValidateWindowResult(**r) for r in rows],
                    )
                else:  # discover
                    rows, stability = engine.run_discover(
                        window_size_months=req.window_size_months,
                        window_type=req.window_type,
                        initial_training_months=req.initial_training_months,
                        training_window_months=req.training_window_months,
                        seed_params=seed_params,
                        apy_tolerance_bps=req.apy_tolerance_bps,
                        max_combinations=req.max_combinations,
                        seed_source=req.seed_source,
                        progress_callback=progress_callback,
                        cancel_event=cancel_event,
                    )
                    response = WalkForwardResponse(
                        mode="discover",
                        discover_results=[DiscoverWindowResult(**r) for r in rows],
                        factor_stability={k: FactorStability(**v) for k, v in stability.items()},
                    )

                if not cancel_event.is_set():
                    loop.call_soon_threadsafe(queue.put_nowait, ("result", response))
            except Exception as exc:
                if not cancel_event.is_set():
                    loop.call_soon_threadsafe(queue.put_nowait, ("error", str(exc)))

        # Separate task watches for client disconnect and sets cancel_event
        async def watch_disconnect():
            while not cancel_event.is_set():
                if await request.is_disconnected():
                    cancel_event.set()
                    queue.put_nowait(("cancelled",))
                    return
                await asyncio.sleep(0.25)

        executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
        loop.run_in_executor(executor, run_sync)
        watcher = asyncio.create_task(watch_disconnect())

        deadline = loop.time() + 600.0
        try:
            while True:
                try:
                    item = await asyncio.wait_for(queue.get(), timeout=1.0)
                except asyncio.TimeoutError:
                    if loop.time() > deadline:
                        yield "event: error\ndata: {\"message\": \"Walk-forward timed out\"}\n\n"
                        break
                    continue

                kind = item[0]
                if kind == "cancelled":
                    break
                elif kind == "progress":
                    _, current, total, status = item
                    yield f"event: progress\ndata: {json.dumps({'current': current, 'total': total, 'status': status})}\n\n"
                elif kind == "result":
                    _, response = item
                    yield f"event: result\ndata: {response.model_dump_json()}\n\n"
                    break
                elif kind == "error":
                    _, msg = item
                    yield f"event: error\ndata: {json.dumps({'message': msg})}\n\n"
                    break
        finally:
            cancel_event.set()
            watcher.cancel()
            executor.shutdown(wait=False)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ---------------------------------------------------------------------------
# Static file serving (production build)
# ---------------------------------------------------------------------------
DIST_DIR = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if DIST_DIR.exists():
    app.mount("/", StaticFiles(directory=str(DIST_DIR), html=True), name="static")
