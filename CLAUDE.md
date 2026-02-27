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
│   ├── main.py             # CLI entry point (legacy, still works)
│   ├── data_loader.py      # Loads and merges price + spread data
│   ├── data_source.py      # CSV/API abstraction
│   ├── alpha_vantage.py    # Price/dividend data source
│   ├── fred.py             # Credit spread data source
│   ├── indicators.py       # Technical indicator calculations
│   ├── strategy_base.py    # Abstract strategy interface
│   ├── strategy_sphy.py    # SPHY-specific trading rules
│   ├── strategy_buyhold.py # Buy-and-hold baseline
│   ├── backtester.py       # Converts positions to equity curves
│   └── optimizer_sphy.py   # Grid search optimizer
├── frontend/               # React/Vite UI
│   ├── src/
│   │   ├── App.tsx         # Main app with tab navigation
│   │   ├── components/     # UI components
│   │   ├── hooks/          # React hooks for API calls
│   │   ├── lib/            # API client and themes
│   │   └── types/          # TypeScript interfaces
│   └── package.json
├── inputs/                 # CSV data files
│   ├── weekly-adjusted.csv # Alpha Vantage price/dividend data
│   └── fred.csv            # FRED credit spread data
├── .env                    # Environment variables (API keys)
├── start.bat               # Dev: launches both frontend and backend
└── start-prod.bat          # Prod: builds frontend, serves via FastAPI
```

## Running the Application

### Development Mode
```bash
# From project root - launches both servers
start.bat

# Or manually:
# Terminal 1 - Backend (port 8000)
cd api && uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2 - Frontend (port 5173, proxies /api to backend)
cd frontend && npm run dev
```

### Production Mode
```bash
start-prod.bat  # Builds frontend, serves everything from FastAPI on port 8000
```

### Legacy CLI (still functional)
```bash
cd backend
python main.py --ticker SPHY              # Run with best parameters
python main.py --ticker SPHY --optimize   # Run optimizer
python main.py --ticker SPHY --buyhold    # Run buy-and-hold baseline
python main.py --ticker SPHY --invested 0 # Start in cash
python main.py --ticker SPHY --input-type api  # Use live APIs
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
- `WeeklyDataLoader` loads weekly prices/dividends and FRED daily spreads, resamples FRED to weekly (W-FRI), merges them, computes total return factor (`TR_factor`, `TR`)
- `DataSource` / `CsvSource` / `ApiSource` abstract CSV vs live API data sources

**Indicators** (`indicators.py`):
- `IndicatorEngine.apply_all()` adds: `MA` (n-week moving average), `chg4` (4-week spread change), `ret3` (3-week price return), `spread_delta` (week-over-week spread change)

**Strategy** (`strategy_base.py`, `strategy_sphy.py`, `strategy_buyhold.py`):
- `BaseStrategy` defines abstract interface: `evaluate_sell()`, `evaluate_buy()`, `run()`
- `SPHYStrategy` implements SPHY rules (see Trading Logic below)
- `BuyAndHoldStrategy` always invested, used as baseline

**Backtester** (`backtester.py`):
- Converts positions array to cumulative equity curve
- Applies weekly TR when invested, cash yield when not
- Computes final value and APY

**Optimizer** (`optimizer_sphy.py`):
- Grid search over parameter combinations
- Supports `progress_callback` for streaming progress to frontend

### API Server (api/)

FastAPI server with endpoints:
- `GET /api/securities` — Returns available tickers (currently just SPHY)
- `GET /api/config` — Returns externalized parameter defaults from `config.json`
- `POST /api/config` — Saves parameter defaults to `config.json`
- `POST /api/run/buyhold` — Runs buy-and-hold backtest
- `POST /api/run/signal` — Runs strategy and returns current signal + trade history
- `POST /api/run/optimizer` — Runs grid search with SSE streaming progress

### Frontend (frontend/)

React/Vite SPA with three tabs:
- **Optimizer** — Grid search with parameter range inputs, streaming progress, sortable results table, drill-down charts
- **Buy & Hold** — Baseline comparison run
- **Current Signal** — Shows BUY/SELL/HOLD signal with current metrics and trade history

Key features:
- Theming system (4 themes: Slate, Navy & Gold, Charcoal & Green, High Contrast)
- Settings persisted to localStorage (theme, input type, cash rate, start position)
- Parameter defaults persisted to `api/config.json` via API
- Equity curve charts with buy/sell markers, CSV/PNG export
- Recharts for visualization

## SPHY Trading Logic

**SELL if ANY of:**
- `spread > SPREAD_LVL` (absolute spread too high)
- `chg4 > CHG4_THR` (4-week spread change too high)
- `ret3 < RET3_THR` (3-week price return too negative)

**BUY if ALL of** (and only after a prior SELL):
- `close > MA` (price above moving average)
- Last 2 weekly `spread_delta` values are negative (spreads falling)
- `spread ≤ recent_4wk_peak × (1 − DROP)` (spread dropped from peak)

## Externalized Configuration

Parameter defaults and optimizer ranges are stored in `api/config.json`, not hardcoded:

```json
{
  "defaultParams": {
    "MA": { "name": "MA", "value": 50.0, "desc": "Buy rule: price must be above its n-week moving average" },
    "DROP": { "name": "DROP", "value": 0.016, "desc": "Buy rule: spread must drop this % from its 4-week peak" },
    ...
  },
  "defaultRanges": {
    "MA": { "min": 50.0, "max": 50.0, "step": 5.0 },
    ...
  }
}
```

The frontend loads this on startup and uses it to populate parameter inputs. Users can edit and save permanently via the Settings panel.

## Key Design Decisions

- **CSV is default** — API mode is available but rate-limited; CSV provides consistent, fast local testing
- **Streaming optimizer** — SSE pushes progress updates to frontend for responsive UI during long grid searches
- **Strategy abstraction** — `BaseStrategy` supports additional securities; new strategies inherit and implement `evaluate_sell()` / `evaluate_buy()`
- **Externalized parameters** — Defaults and ranges in `config.json`, not source code, enabling UI-driven tuning
- **Decoupled backtester** — Reusable for any asset/strategy combination

## Future Direction

- Add more securities/strategies (each with own strategy class + parameter definitions)
- Security/strategy package selection in UI
- Potentially move config to database for multi-user scenarios