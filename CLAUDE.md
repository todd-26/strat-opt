# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**strat-opt** is a financial strategy backtesting and optimization framework with a React/Vite frontend and FastAPI backend. It generates buy/sell signals for income-focused ETFs (currently SPHY — SPDR Portfolio High Yield Bond ETF), backtests those signals against historical weekly price/dividend data merged with FRED credit spread data, and optimizes strategy parameters via grid search.

## Project Structure

```
strat-opt/
├── api/                    # FastAPI backend server
│   ├── main.py             # API routes and SSE streaming
│   ├── models.py           # Pydantic models
│   ├── config.json         # Externalized parameter defaults and ranges
│   └── requirements.txt
├── backend/                # Core Python pipeline (strategy logic)
│   ├── data_loader.py      # Loads and merges price + spread data
│   ├── data_source.py      # CSV/API abstraction
│   ├── alpha_vantage.py    # Price/dividend data source
│   ├── fred.py             # Credit spread data source
│   ├── indicators.py       # Technical indicator calculations
│   ├── strategy_base.py    # Abstract strategy interface
│   ├── strategy_spread.py  # Shared spread-strategy logic (SpreadStrategy)
│   ├── strategy_sphy.py    # SPHY-specific trading rules
│   ├── strategy_shym.py    # SHYM-specific trading rules
│   ├── strategy_buyhold.py # Buy-and-hold baseline
│   ├── backtester.py       # Converts positions to equity curves
│   ├── optimizer_base.py   # Abstract BaseOptimizer with grid-search loop
│   ├── optimizer_sphy.py   # SPHY grid-search optimizer
│   └── optimizer_shym.py   # SHYM grid-search optimizer
├── frontend/               # React/Vite UI
│   ├── src/
│   │   ├── App.tsx         # Main app with tab navigation
│   │   ├── components/     # UI components
│   │   ├── hooks/          # React hooks for API calls
│   │   ├── lib/            # API client and themes
│   │   └── types/          # TypeScript interfaces
│   └── package.json
├── inputs/                 # CSV data files
│   ├── sphy-weekly-adjusted.csv  # Alpha Vantage data for SPHY
│   ├── shym-weekly-adjusted.csv  # Alpha Vantage data for SHYM
│   ├── BAMLH0A0HYM2.csv          # FRED credit spread data
│   ├── DGS10.csv                 # FRED 10yr Treasury yield
│   └── DGS2.csv                  # FRED 2yr Treasury yield
├── .env                    # Environment variables (API keys)
├── serve.bat               # Normal use: serves pre-built frontend + API on :8000
└── start-prod.bat          # Rebuilds frontend then serves on :8000
```

## Context Efficiency

### Subagent Discipline
- Prefer inline work for tasks under ~5 tool calls. Subagents have overhead — don't delegate trivially.
- When using subagents, include output rules: "Final response under 2000 characters. List outcomes, not process."
- Never call TaskOutput twice for the same subagent. If it times out, increase the timeout — don't re-read.

### File Reading
- Read files with purpose. Before reading a file, know what you're looking for.
- Use Grep to locate relevant sections before reading entire large files.
- Never re-read a file you've already read in this session.
- For files over 500 lines, use offset/limit to read only the relevant section.

### Responses
- Don't echo back file contents you just read — the user can see them.
- Don't narrate tool calls ("Let me read the file..." / "Now I'll edit..."). Just do it.
- Keep explanations proportional to complexity. Simple changes need one sentence, not three paragraphs.

## Running the Application

### Normal Use
```bash
serve.bat       # Serves pre-built frontend + API on port 8000
```

### After Frontend Changes
```bash
start-prod.bat  # Rebuilds frontend, then serves on port 8000
```

### Individual Servers (dev)
```bash
# Backend only
api\dev.bat     # or: cd api && uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Frontend only (proxies /api to :8000)
frontend\dev.bat  # or: cd frontend && npm run dev
```

## Environment Setup

Copy `.env` to `.env.local` and add your API keys:
```
ALPHA_VANTAGE_API_KEY=your_key_here
ALPHA_VANTAGE_URL=https://www.alphavantage.co/query?function=TIME_SERIES_WEEKLY_ADJUSTED&symbol={ticker}&outputsize=full&datatype=csv&apikey={apikey}
FRED_API_KEY=your_key_here
FRED_URL=https://api.stlouisfed.org/fred/series/observations
```

CSV input is the default and preferred mode; API mode hits Alpha Vantage and FRED live but is rate-limited.

## Architecture

### Data Flow
```
Frontend (React/Vite)
    ↓ HTTP/SSE
FastAPI Server (api/main.py)
    ↓ imports
Backend Pipeline:
    data_loader → indicators → strategy → backtester
                                  ↑
                             optimizer (wraps strategy + backtester)
```

### Backend Pipeline (backend/)

**Data layer** (`data_loader.py`, `data_source.py`, `alpha_vantage.py`, `fred.py`):
- `WeeklyDataLoader` loads weekly prices/dividends, FRED daily spreads, and FRED daily treasury yields (DGS10, DGS2); resamples all FRED series to weekly (W-FRI); merges via two `merge_asof` calls; computes total return factor (`TR_factor`, `TR`) and `YieldCurve = DGS10 - DGS2`
- `Fred` class accepts `series_id` and `col_name` params — reusable for any FRED series (defaults: `BAMLH0A0HYM2` / `Spread`)
- `DataSource` / `CsvSource` / `ApiSource` abstract CSV vs live API data sources
- `ApiSource` caches responses in a module-level dict keyed by `(url, params, date)`; cache is valid for the calendar day and cleared on process restart

**Indicators** (`indicators.py`):
- `IndicatorEngine.apply_all()` adds: `MA` (n-week moving average), `chg4` (4-week spread change), `ret3` (3-week price return), `spread_delta` (week-over-week spread change), `yield10_chg4` (4-week % change in 10yr yield), `yield2_chg4` (4-week % change in 2yr yield), `curve_chg4` (4-week absolute change in yield curve), `yield10_delta` (week-over-week change in 10yr yield)

**Strategy** (`strategy_base.py`, `strategy_spread.py`, `strategy_sphy.py`, `strategy_shym.py`, `strategy_buyhold.py`):
- `BaseStrategy` defines abstract interface: `evaluate_sell()`, `evaluate_buy()`, `run()`
- `SpreadStrategy(BaseStrategy)` holds shared credit-spread logic; SPHY and SHYM inherit from it
- `SPHYStrategy` / `SHYMStrategy` are siblings implementing security-specific rules
- `BuyAndHoldStrategy` always invested, used as baseline
- `SpreadStrategy` accepts `disabled` set of factor names; disabled sell factors → never trigger, disabled buy factors → always pass
- Valid sell factor names: `SPREAD_LVL`, `CHG4`, `RET3`, `YIELD10_CHG4`, `YIELD2_CHG4`, `CURVE_CHG4`
- Valid buy factor names: `MA`, `DROP`, `SPREAD_DELTA`, `YIELD10_DELTA`

**Backtester** (`backtester.py`):
- Converts positions array to cumulative equity curve
- Applies weekly TR when invested, cash yield when not
- Computes final value and APY

**Optimizer** (`optimizer_base.py`, `optimizer_sphy.py`, `optimizer_shym.py`, `optimizer_nea.py`):
- `BaseOptimizer` (abstract) contains the grid-search loop; subclasses set default grids and implement `_create_strategy()`
- `SPHYOptimizer` / `SHYMOptimizer` / `NEAOptimizer` are siblings
- All accept `start_date`/`end_date` kwargs passed through to `loader.load()`
- All accept `disabled_factors` set; disabled grids collapse to `[0]` (single placeholder) to reduce combinations
- Supports `progress_callback` for streaming progress to frontend

### API Server (api/)

FastAPI server with endpoints:
- `GET /api/securities` — Returns available tickers (`["SPHY", "SHYM", "NEA"]`)
- `GET /api/date-range` — Returns `{ min, max }` date strings for a ticker's data
- `GET /api/config` — Returns externalized parameter defaults from `config.json`
- `POST /api/config` — Saves parameter defaults to `config.json`
- `POST /api/run/buyhold` — Runs buy-and-hold backtest
- `POST /api/run/signal` — Runs strategy and returns current signal + trade history
- `POST /api/run/optimizer` — Runs grid search with SSE streaming progress

All three run endpoints accept optional `start_date`/`end_date` (YYYY-MM-DD strings) to restrict the data window.
Signal and optimizer endpoints accept `disabled_factors` (list of factor names to ignore).

### Frontend (frontend/)

React/Vite SPA with three tabs:
- **Optimizer** — Grid search with parameter range inputs, streaming progress, sortable results table, drill-down charts
- **Buy & Hold** — Baseline comparison run
- **Current Signal** — Shows BUY/SELL/HOLD signal with current metrics, a Factor Values panel (showing current metric readings per sell/buy factor including spread_drop computed from 4-week peak, disabled factors dimmed), and full trade history

Key features:
- Theming system (4 themes: Slate, Navy & Gold, Charcoal & Green, High Contrast)
- Theme and input type persisted to localStorage; cash rate and start position persisted to `api/config.json` (per-security)
- Parameter defaults, cash rate, and start position persisted to `api/config.json` via API
- Equity curve charts with buy/sell markers, CSV/PNG export
- Recharts for visualization
- Global date range picker in `Header.tsx` (From/To); filters data for all three tabs; not persisted; shows actual data range as placeholder when empty
- Factor disable checkboxes in ParameterPanel (both single and range modes); disabled factors are skipped in strategy evaluation and optimizer grid iteration
- Trade history table has 13 columns (Date, Action, Price, MA, Spread, Drop, chg4, ret3, Δspread, Δ10yr%, Δ2yr%, ΔCurve, Δyield10); triggered values are bolded per trade action with clickable popups showing derivations

## SPHY Trading Logic

**SELL if ANY of:**
- `spread > SPREAD_LVL` (absolute spread too high)
- `chg4 > CHG4_THR` (4-week spread change too high)
- `ret3 < RET3_THR` (3-week price return too negative)
- `yield10_chg4 > YIELD10_CHG4_THR` (10yr yield rose too much over 4 weeks)
- `yield2_chg4 > YIELD2_CHG4_THR` (2yr yield rose too much over 4 weeks)
- `curve_chg4 < -CURVE_CHG4_THR` (yield curve flattened too much over 4 weeks)

**BUY if ALL of** (only when not currently invested; starting in cash counts as already sold; also requires no sell condition active):
- `close > MA` (price above moving average)
- Last `SPREAD_DELTA` weekly `spread_delta` values are negative (spreads falling; configurable, default 2)
- `spread ≤ recent_4wk_peak × (1 − DROP)` (spread dropped from peak)
- Last `YIELD10_DELTA` weekly `yield10_delta` values are negative (10yr yield falling; configurable, default 2)
- No sell condition is true

## Externalized Configuration

Parameter defaults and optimizer ranges are stored in `api/config.json`, not hardcoded:

```json
{
  "SPHY": {
    "defaultParams": {
      "MA": { "name": "MA", "value": 50.0, "desc": "..." },
      ...
    },
    "defaultRanges": {
      "MA": { "min": 50.0, "max": 50.0, "step": 5.0 },
      ...
    },
    "cashRate": 0.04,
    "startInvested": 1,
    "disabledFactors": ["YIELD10_CHG4", "YIELD2_CHG4", "CURVE_CHG4", "YIELD10_DELTA"]
  },
  "SHYM": { ... }
}
```

The frontend loads this on startup and uses it to populate parameter inputs, initialize disabled factor checkboxes, and set run defaults. Users can edit and save permanently via the Settings panel.

## Key Design Decisions

- **CSV is default** — API mode is available but rate-limited; CSV provides consistent, fast local testing
- **Streaming optimizer** — SSE pushes progress updates to frontend for responsive UI during long grid searches
- **Strategy abstraction** — `BaseStrategy` supports additional securities; new strategies inherit and implement `evaluate_sell()` / `evaluate_buy()`
- **Externalized parameters** — Defaults and ranges in `config.json`, not source code, enabling UI-driven tuning
- **Decoupled backtester** — Reusable for any asset/strategy combination

## Future Direction

- Add more securities/strategies (each with own strategy class + parameter definitions)
- Potentially move config to database for multi-user scenarios