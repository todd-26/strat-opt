# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**strat-opt** is a financial strategy backtesting and optimization framework. It generates buy/sell signals for income-focused ETFs (currently SPHY — Invesco S&P 500 High Dividend ETF), backtests those signals against historical weekly price/dividend data merged with FRED credit spread data, and optimizes strategy parameters via grid search. This was originally created to find the optimal time to buy and sell SPHY. It was changed to take a stock symbol (ticker) as a parameter but it may not make sense to do so. The signals being tested will likely not apply to other securities. That remains to be seen.

## History and purpose of this application
I own a lot of SPHY and have been very happy with the return. However, I much prefer to own bonds as opposed to bond funds because their price can sometimes nosedive. If you own a bond you have default risk but other than that if you hold to maturity you know what you have. I trialed a free month of ChatGPT and had it help me discern what factors may influence SPHY going up or down. We then set up this framework to try different permutations of those factors. I took the results and use them in another application that will show me whether to buy, hold or sell.

## Future Direction
The end goal is a dynamic, multi-security framework driven by a React/Vite UI. The current SPHY-specific hardcoding is a starting point, not a target state. When making changes, avoid entrenching SPHY-specific logic further — prefer patterns that generalize.

**Security/strategy packages**: Each security will have its own strategy class (already supported via `BaseStrategy`) paired with its own parameter definitions and data sources. These form a "package" that is selected at runtime, not hardcoded. Parameter definitions and their valid ranges will be externalized — stored in config files or a database — not in source code.

**Runtime selection**: The user selects a security/strategy package, specifies parameter ranges to explore, and chooses a run type (backtest, current signal, buy-and-hold comparison, optimizer). The application loads the appropriate package and executes the requested run type.

**UI**: A React/Vite frontend will replace the current CLI. It will present:
- Security/strategy package selection
- Parameter range inputs (driven by the selected package's parameter definitions)
- Run type selection
- Results displayed in the UI, exportable to CSV
- Line graph visualization for backtest and buy-and-hold equity curves

## Running the Code

All commands run from the `backend/` directory. Python 3.13+ required. Dependencies: `pandas`, `numpy`, `requests`, `pandas-datareader`.

```bash
# Run SPHY strategy with current best parameters
python main.py --ticker SPHY

# Run parameter grid-search optimizer
python main.py --ticker SPHY --optimize

# Run buy-and-hold baseline for comparison
python main.py --ticker SPHY --buyhold

# Start in cash position (default is invested)
python main.py --ticker SPHY --invested 0

# Set annual cash yield rate (default 0.04)
python main.py --ticker SPHY --cash-rate 0.05

# Use live APIs instead of local CSVs (CSV is default)
python main.py --ticker SPHY --input-type api
```

Input CSVs are in `inputs/`: `weekly-adjusted.csv` (Alpha Vantage price/dividend) and `fred.csv` (FRED daily spread data).

Output CSVs are written to `backend/`: `strategy_output.csv`, `buyhold_output.csv`, `optimizer_results.csv`, `best_strategy_output.csv`.

## Architecture

The pipeline is strictly layered — each module has one job and no cross-layer dependencies:

```
main.py  →  data_loader  →  indicators  →  strategy  →  backtester
                                               ↑
                                          optimizer (wraps strategy + backtester)
```

**Data layer** (`data_loader.py`, `data_source.py`, `alpha_vantage.py`, `fred.py`):
- `WeeklyDataLoader` loads SPHY weekly prices/dividends and FRED daily spreads, resamples FRED to weekly (W-FRI), merges them, and computes total return factor (`TR_factor`, `TR`). No indicators here.
- `DataSource` / `CsvSource` / `ApiSource` abstract whether data comes from CSV files or live APIs. All external API keys are hardcoded in `alpha_vantage.py` and `fred.py`.

**Indicators** (`indicators.py`):
- `IndicatorEngine` is stateless/functional. `apply_all()` adds: `MA` (n-week moving average of close), `chg4` (4-week spread change), `ret3` (3-week price return), `spread_delta` (week-over-week spread change).

**Strategy** (`strategy_base.py`, `strategy_sphy.py`, `strategy_buyhold.py`):
- `BaseStrategy` defines the abstract interface: `evaluate_sell(row, df, idx)`, `evaluate_buy(row, df, idx, was_sold)`, `run(df, start_invested)`. `run()` iterates weekly and maintains invested/cash state.
- `SPHYStrategy` implements the SPHY rules (see below).
- `BuyAndHoldStrategy` always returns positions = 1, used as baseline.

**SPHY Strategy Rules** (the core trading logic):
- **SELL if ANY of**:
  - `spread > SPREAD_LVL`
  - `chg4 > CHG4_THR`
  - `ret3 < RET3_THR`
- **BUY if ALL of** (and only after a prior SELL):
  - `close > MA`
  - Last 2 weekly `spread_delta` values are negative
  - `spread ≤ recent_4wk_peak_spread × (1 − DROP)`

**Backtester** (`backtester.py`):
- Converts positions array (0 or 1 per week) into a cumulative equity curve. Applies weekly `TR` when invested, weekly cash yield (annual rate ÷ 52) when not. Computes final value and APY.

**Optimizer** (`optimizer_sphy.py`):
- `SPHYOptimizer` runs a grid search over parameter combinations (`MA`, `DROP`, `CHG4_THR`, `RET3_THR`, `SPREAD_LVL`). For each combo: load data → apply indicators → run strategy → backtest → record APY. Returns `best_params`, `results_df`, and the full backtest result for best params.

## Key Design Decisions

- CSV input is the default and preferred mode; API mode (`--input-type api`) hits Alpha Vantage and FRED live but is rate-limited.
- The optimizer grid in `optimizer_sphy.py` is currently narrowed around previously found best parameters (not a wide search). Widen the grids when exploring new parameter space.
- `strategy_base.py` is designed to support additional assets (NEA, etc.) — new strategies just inherit `BaseStrategy` and implement the two evaluate methods.
- The backtester is fully decoupled from strategy logic and reusable for any asset.
