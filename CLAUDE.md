# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**SignalVane** is a financial strategy backtesting and signal tool for income-focused ETFs. It has a React/Vite frontend and FastAPI backend. It generates buy/sell signals based on credit spread and price data, backtests those signals against historical weekly price/dividend data merged with FRED credit spread and treasury yield data, and optimizes strategy parameters via grid search. Securities are fully config-driven — adding a new one requires only a new entry in `api/securities_config.json`.

## Project Structure

```
strat-opt/
├── api/                    # FastAPI backend server
│   ├── main.py             # API routes and SSE streaming
│   ├── models.py           # Pydantic models
│   ├── securities_config.json  # Externalized parameter defaults and ranges (per-security)
│   └── requirements.txt
├── backend/                # Core Python pipeline (strategy logic)
│   ├── data_loader.py      # Loads and merges price + spread data
│   ├── data_source.py      # CSV/API abstraction
│   ├── alpha_vantage.py    # Price/dividend data source
│   ├── fred.py             # Credit spread data source
│   ├── indicators.py       # Technical indicator calculations
│   ├── strategy_base.py    # Abstract strategy interface
│   ├── strategy_generic.py # GenericStrategy — config-driven, handles all securities
│   ├── strategy_buyhold.py # Buy-and-hold baseline
│   ├── backtester.py       # Converts positions to equity curves
│   ├── optimizer_generic.py # GenericOptimizer — config-driven, handles all securities
│   └── walk_forward.py     # WalkForwardEngine — validate and discover walk-forward modes
├── frontend/               # React/Vite UI
│   ├── src/
│   │   ├── App.tsx         # Main app with tab navigation
│   │   ├── components/     # UI components
│   │   ├── hooks/          # React hooks for API calls
│   │   ├── lib/            # API client and themes
│   │   └── types/          # TypeScript interfaces
│   └── package.json
├── inputs/                 # CSV data files
│   ├── {ticker}-weekly-adjusted.csv  # Alpha Vantage data (one file per security)
│   ├── BAMLH0A0HYM2.csv              # FRED credit spread data
│   ├── DGS10.csv                     # FRED 10yr Treasury yield
│   └── DGS2.csv                      # FRED 2yr Treasury yield
├── .env                    # Environment variables (API keys)
├── serve.bat               # Normal use: serves pre-built frontend + API on :8000
└── start-prod.bat          # Rebuilds frontend then serves on :8000
```

## Doc Maintenance Hook (MANDATORY)

A `PostToolUse` hook runs `.claude/hooks/check-md.py` after every `Edit` or `Write` to a non-.md file. It exits with code 2 to block and force doc updates before continuing.

**After every non-.md edit, update ALL FOUR doc files if relevant:**
- `CLAUDE.md` — project instructions (this file)
- `MEMORY.md` — persistent cross-session memory (`~/.claude/projects/.../memory/MEMORY.md`)
- `definitions.md` — strategy/parameter definitions (project root)
- `Front-End.md` — frontend architecture (project root)

Rules:
- If more code edits remain, finish them first then update all relevant docs in one batch
- Do NOT only update MEMORY.md and skip CLAUDE.md
- `definitions.md` and `Front-End.md` are in the project root; use `ls` or `Read` directly (Glob may miss them)

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
- `WeeklyDataLoader` loads weekly prices, FRED daily spreads, and FRED daily treasury yields (DGS10, DGS2); resamples all FRED series to weekly (W-FRI); merges via two `merge_asof` calls; computes total return factor (`TR_factor`, `TR`) and `YieldCurve = DGS10 - DGS2`
- **Price series uses `adjusted close`** (not raw close): split-corrected and continuous across split events (e.g. HYMB 2:1 split Jan 2023). `TR_factor = adj_close / adj_close_prev` — dividends are already embedded in adj_close, so no separate dividend addition. Raw `close` and `dividend amount` columns are discarded in `alpha_vantage.py`.
- After merging, `load()` caps the result at `min(spread_df["date"].max(), treasury_df["date"].max())` — prevents `merge_asof` from silently carrying stale FRED values into price rows newer than the latest FRED data
- `Fred.get_data()` auto-saves `['date', 'value']` to `inputs/{series_id}.csv` on cache miss (fresh API call); `observation_start` set to `'2000-01-01'` for full history
- `ApiSource` exposes `from_cache: bool` so callers can detect whether data came from cache or a live fetch
- `main.py` `_fetch_and_save_csv(ticker)` returns `bool` (True = already current). Checks in order: (1) `_api_cache` — free hit if same-process API run fetched today; (2) CSV file mtime == today — loads into cache, skips API call; (3) Alpha Vantage via `ApiSource` — fetches, populates cache, writes CSV. `fetch_security_data` endpoint returns `{"ok": True, "already_current": bool}`
- `main.py` `_fetch_and_save_fred(series_id)` fetches full FRED history directly (bypasses `_api_cache`); `_update_fred_if_stale(ticker)` refreshes all three FRED CSVs if older than the AV CSV; called from both `fetch_security_data` and `add_security`
- `POST /api/economic-data/fetch` — refreshes all three FRED CSVs; guarded by `_fred_last_fetched` module-level datetime (1-hour in-memory TTL); returns `{"ok": True, "already_current": bool}`; `_fred_last_fetched` and `_FRED_CACHE_SECONDS = 3600` declared at module level alongside `_FRED_SERIES`
- `WeeklyDataLoader.load()` raises `ValueError` (with available data range in message) if date slice produces empty DataFrame; all three run endpoints catch it and return HTTP 400
- `Fred` class accepts `series_id` and `col_name` params — reusable for any FRED series
- `DataSource` / `CsvSource` / `ApiSource` abstract CSV vs live API data sources
- `ApiSource` caches responses in a module-level dict keyed by `(url, params, date)`; cache is valid for the calendar day and cleared on process restart
- `ApiSource` detects JSON error responses when expecting CSV (Alpha Vantage quirk — returns JSON on rate limit/invalid ticker); raises `ValueError` with the API's message

**Indicators** (`indicators.py`):
- `IndicatorEngine.apply_all()` adds: `MA` (n-week moving average), `chg4` (4-week spread change), `ret3` (3-week price return), `spread_delta` (week-over-week spread change), `yield10_chg4` (4-week % change in 10yr yield), `yield2_chg4` (4-week % change in 2yr yield), `curve_chg4` (4-week absolute change in yield curve), `yield10_delta` (week-over-week change in 10yr yield)

**Strategy** (`strategy_base.py`, `strategy_generic.py`, `strategy_buyhold.py`):
- `BaseStrategy` defines abstract interface: `evaluate_sell()`, `evaluate_buy()`, `run()`
- `GenericStrategy(BaseStrategy)` — single config-driven strategy for all securities
- `BuyAndHoldStrategy` always invested, used as baseline
- `GenericStrategy` accepts `params: dict` and `ignore: set` of factor names; disabled sell factors → never trigger, disabled buy factors → always pass
- Valid sell factor names: `CHG4`, `RET3`, `YIELD10_CHG4`, `YIELD2_CHG4`, `CURVE_CHG4`
- Valid buy factor names: `MA`, `DROP`, `SPREAD_DELTA`, `YIELD10_DELTA`

**Backtester** (`backtester.py`):
- Converts positions array to cumulative equity curve
- Applies weekly TR when invested, cash yield when not
- Computes final value and APY

**Optimizer** (`optimizer_generic.py`):
- `GenericOptimizer` — single config-driven optimizer for all securities (UI calls this the Backtester)
- Accepts `param_grids: dict`, `start_date`/`end_date`, `disabled_factors` set
- Disabled grids collapse to `[0]` (single placeholder) to reduce combinations
- Supports `progress_callback` for streaming progress to frontend

**Walk-Forward** (`walk_forward.py`):
- `WalkForwardEngine` — loads full data once, applies non-MA indicators; adds MA columns lazily per run
- Two modes: `run_validate()` (fixed params across test windows) and `run_discover()` (optimize on training, test out-of-sample)
- Window types: Anchored (training grows from data start) or Rolling (fixed training window slides)
- Discover mode: per window — seed, baseline, single-factor elimination, combination elimination, range refinement grid search, OOS test
- **Refinement grid** (`_build_refinement_grids`): builds a symmetric grid around the seed value for each active factor. Step size and min/max bounds come from that factor's `range` in `securities_config.json`. Grid = `[seed - k*step, ..., seed, ..., seed + k*step]` clamped to `[min, max]`. `k` is incremented until total combinations across all active factors exceeds `max_combinations`, then the largest valid `k` is used. Inactive factors get a `[0]` placeholder (not searched). The resulting grid is never shown to the user — only the winning params appear in the results table. **Fallback**: if the seed is outside `[min, max]` (e.g. carried as `0` from a prior window where the factor was eliminated), the fallback clamps to `max(min, min(max, seed))` rather than using the raw seed — prevents out-of-range values from leaking into the grid search.
- Returns results list + factor stability dict; streams progress via SSE with `progress_callback(current, total, status="")`
- **Validate**: `total = n_windows`, advances 1 tick per window
- **Discover**: `total = n_windows * 5`; combo elimination fires progress/cancel-check every 10 combos; `_grid_search` fires every 10 combos
- **Cancellation**: `cancel_event: threading.Event` checked at top of window loop, every 10 combo-elim combos, every 10 grid-search combos. `main.py` uses a separate `watch_disconnect` asyncio task (polls `request.is_disconnected()` every 0.25s) that sets `cancel_event` and puts `("cancelled",)` on the queue — reliable regardless of whether the generator is mid-await. `finally` sets event + cancels watcher task.
- `_build_refinement_grids`: early-return `{p: [0]}` when `active_factors` is empty (combo elimination eliminated all factors → `total` stays 1 forever in the `while True` loop → infinite hang); also added `k > 500` safety cap for factors pinned at bounds. This was the root cause of the "stuck at combo elimination 120/127" symptom.
- `_generate_windows`: guard `if cursor > max_date: break` before calling `_snap_fwd` — without it, `_snap_fwd` returns `df.index[-1]` when past end of data, so the termination check never fires and cursor overflows to year 2262

### API Server (api/)

FastAPI server with endpoints:
- `GET /api/securities` — Returns available tickers; raises HTTP 500 if config missing/invalid or no securities defined
- `POST /api/securities` — Adds a new security (body: `AddSecurityRequest{ticker, name, template}`); validates ticker format (1–10 uppercase letters), auto-fetches CSV from Alpha Vantage if not already present, clones parameters from template ticker
- `POST /api/securities/reorder` — Accepts `{tickers: string[]}` and rewrites `securities_config.json` with keys in the given order; Python dict insertion order preserves the sequence for all subsequent reads
- `POST /api/securities/{ticker}/fetch-data` — Fetches/overwrites CSV data for an existing security from Alpha Vantage
- `DELETE /api/securities/{ticker}` — Removes a security; blocks (HTTP 400) if it is the last one
- `GET /api/date-range` — Returns `{ min, max }` date strings for a ticker's data; errors include response body text
- `GET /api/config` — Returns `AppConfig` for a ticker (derived from `securities_config.json`)
- `POST /api/config` — Saves `AppConfig` changes back to `securities_config.json`
- `POST /api/run/buyhold` — Runs buy-and-hold backtest
- `POST /api/run/signal` — Runs strategy and returns current signal + trade history
- `POST /api/run/optimizer` — Runs grid search with SSE streaming progress (UI label: Backtester)
- `POST /api/run/walk-forward` — Runs walk-forward validation or discovery with SSE streaming progress; accepts `WalkForwardRequest`; uses full history (no date filter); reads seed params from saved config

All three run endpoints accept optional `start_date`/`end_date` (YYYY-MM-DD strings) to restrict the data window; return HTTP 400 if range is empty.
Signal and optimizer endpoints accept `disabled_factors` (list of factor names to ignore).

### Frontend (frontend/)

React/Vite SPA with five tabs:
- **Backtester** — Grid search with parameter range inputs, streaming progress, sortable results table, drill-down charts
- **Buy & Hold** — Baseline comparison run
- **Current Signal** — Shows BUY/SELL/HOLD signal with current metrics, Factor Values panel, and full trade history
- **Signals** — Runs current signal across all (or selected) securities at once; uses each security's saved defaults; results painted serially as they complete; no date range filter (always uses full history); shows Invested/Not Invested toggle per row (saves immediately via POST /api/config); configs prefetched on mount
- **Walk-Forward** — Out-of-sample walk-forward testing in Validate or Discover mode; date pickers hidden; uses selected ticker; `WalkForwardTab.tsx`; `streamWalkForward()` in api.ts; "Export CSV" button above results table when results are available

Key features:
- Theming system (4 themes: Slate, Navy & Gold, Charcoal & Green, High Contrast)
- Theme and input type persisted to localStorage; all other settings (cash rate, start position, params, ranges, disabled factors) persisted to `api/securities_config.json` (per-security)
- Equity curve charts with buy/sell markers, CSV/PNG export; ticker + APY labels embedded inside PNG-captured div only (not in toolbar); `strategyLabel` prop (default `"Strategy"`) lets BuyHoldTab label it `"Buy & Hold"`; date range shown right-justified in chart header
- Recharts for visualization
- Global date range picker in `Header.tsx` (From/To); filters data for Backtester, Buy & Hold, and Current Signal tabs; hidden on Signals and Walk-Forward tabs via `hideDates` prop; not persisted
- Factor disable checkboxes in ParameterPanel (both single and range modes); disabled factors are skipped in strategy evaluation and backtester grid iteration
- **Settings isolation**: Opening/saving Settings does NOT reset Backtester or Current Signal tab state. Tabs initialize from config on mount; `key={ticker}` remount handles ticker changes. Prop-syncing `useEffect` hooks were removed from both `OptimizerTab` and `SignalTab`. Each tab has "Reset from Settings" and "Save to Settings" buttons — both styled accent and enabled only when the tab's current values differ from saved defaults (`hasChanges`); muted and disabled otherwise. Both tabs accept `config: AppConfig` and `onSaveConfig` props.
- **Settings "Save Permanently"** button is also only active (accent) when `localConfig` differs from the `config` prop (`hasChanges = JSON.stringify(localConfig) !== JSON.stringify(config)`).
- **Settings → Manage Securities** has an **"Update All Securities"** button (accent, full-width, above the list) that refreshes all securities serially with a 1500ms pause between each. Uses `ApiSource` day-level cache — no duplicate AV call if a Signals/Backtester run already fetched the data today. `updatingAll` state disables individual refresh buttons while running and vice versa.
- Trade history table has 13 columns (Date, Action, Price, MA, Spread, Drop, chg4, ret3, Δspread, Δ10yr%, Δ2yr%, ΔCurve, Δyield10); triggered values are bolded per trade action with clickable popups showing derivations

## Trading Logic

**SELL if ANY of:**
- `chg4 > CHG4` (4-week spread change too high)
- `ret3 < RET3` (3-week price return too negative)
- `yield10_chg4 > YIELD10_CHG4` (10yr yield rose too much over 4 weeks)
- `yield2_chg4 > YIELD2_CHG4` (2yr yield rose too much over 4 weeks)
- `curve_chg4 < -CURVE_CHG4` (yield curve flattened too much over 4 weeks)

**BUY if ALL of** (only when not currently invested; starting Not Invested counts as already sold; also requires no sell condition active):
- `close > MA` (price above moving average)
- Last `SPREAD_DELTA` weekly `spread_delta` values are negative (spreads falling; configurable, default 2)
- `spread ≤ recent_4wk_peak × (1 − DROP)` (spread dropped from peak)
- Last `YIELD10_DELTA` weekly `yield10_delta` values are negative (10yr yield falling; configurable, default 2)
- No sell condition is true

## Externalized Configuration

Parameter defaults and backtester ranges are stored in `api/securities_config.json`, not hardcoded. Each security has `sell_triggers` and `buy_conditions` dicts where every parameter has `{description, ignore, default, range: {min, max, step}}`:

```json
{
  "securities": {
    "SPHY": {
      "name": "SPDR Portfolio High Yield Bond ETF",
      "cash_rate": 0.04,
      "start_invested": 1,
      "sell_triggers": {
        "CHG4":     { "description": "...", "ignore": false, "default": 0.165, "range": { "min": 0.1, "max": 0.2, "step": 0.005 } },
        "YIELD10_CHG4": { "ignore": true, ... },
        ...
      },
      "buy_conditions": {
        "MA":       { "ignore": false, "default": 50, ... },
        "YIELD10_DELTA": { "ignore": true, ... },
        ...
      }
    }
  }
}
```

The `ignore` flag controls whether a factor is disabled. The frontend loads `AppConfig` on startup and uses it to populate parameter inputs, initialize disabled factor checkboxes, and set run defaults. Users can edit and save permanently via the Settings panel.

## Key Design Decisions

- **CSV is default** — API mode is available but rate-limited; CSV provides consistent, fast local testing
- **Streaming backtester** — SSE pushes progress updates to frontend for responsive UI during long grid searches
- **Generic strategy/optimizer** — `GenericStrategy` and `GenericOptimizer` are fully config-driven; adding a new security only requires a new entry in `securities_config.json`
- **Externalized parameters** — Defaults, ranges, and `ignore` flags in `securities_config.json`, not source code, enabling UI-driven tuning
- **Decoupled backtester** — Reusable for any asset/strategy combination

## Future Direction

- Potentially move config to database for multi-user scenarios
