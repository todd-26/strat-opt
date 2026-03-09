# Strategy Definitions

## SPHY

### SELL Triggers — sell if **ANY** of these are true

| Parameter | What it measures | Role | Best value |
|-----------|-----------------|------|------------|
| **SPREAD_LVL** | Absolute level of the credit spread | If spread is above this threshold, risk is too high — sell | 7.0 |
| **CHG4_THR** | 4-week % change in credit spread (`chg4`) | If spread has risen more than this over 4 weeks, momentum is bad — sell | 16% |
| **RET3_THR** | 3-week price return of SPHY (`ret3`) | If the price has dropped more than this over 3 weeks, sell | −2.25% |
| **YIELD10_CHG4** | 4-week % change in 10yr Treasury yield (`yield10_chg4`) | If 10yr yield has risen more than this over 4 weeks — sell | disabled |
| **YIELD2_CHG4** | 4-week % change in 2yr Treasury yield (`yield2_chg4`) | If 2yr yield has risen more than this over 4 weeks — sell | disabled |
| **CURVE_CHG4** | 4-week absolute change in yield curve 10y-2y (`curve_chg4`) | If curve has flattened by more than this — sell (stored positive, compared as `curve_chg4 < -threshold`) | disabled |

### BUY Triggers — buy only if **ALL** of these are true AND no sell condition is active (when not currently invested; starting in cash counts as already sold)

| Parameter | What it measures | Role | Best value |
|-----------|-----------------|------|------------|
| **MA** | n-week moving average of close price | Price must be above its MA — confirms uptrend | 50 weeks |
| **spread_delta** | Week-over-week change in credit spread (`Spread.diff()`) | Last `SPREAD_DELTA` consecutive weekly values must be negative — confirms spreads actively falling | n/a (derived) |
| **SPREAD_DELTA** | Number of consecutive falling spread_delta weeks required for BUY | Configurable numeric param (default 2); replaces hardcoded "2 consecutive" | 2 |
| **DROP** | Required % drop from the 4-week spread peak | Spread must have fallen this much from its recent high before re-entering | 1.6% |
| **YIELD10_DELTA** | Number of consecutive falling yield10_delta weeks required for BUY | Configurable numeric param (default 2); replaces hardcoded "2 consecutive"; starts disabled | 2, disabled |

### Data Sources

| Source | Series | Column | Frequency |
|--------|--------|--------|-----------|
| FRED | `BAMLH0A0HYM2` | `Spread` | Daily → resampled W-FRI |
| FRED | `DGS10` | `DGS10` | Daily → resampled W-FRI |
| FRED | `DGS2` | `DGS2` | Daily → resampled W-FRI |
| Derived | — | `YieldCurve = DGS10 - DGS2` | Computed after merge |

The `Fred` class in `backend/fred.py` accepts `series_id` and `col_name` params, making it reusable for any FRED series. `WeeklyDataLoader.load_treasury()` loads DGS10 and DGS2 and merges them into the main weekly frame via a second `merge_asof`.

### Derived Indicators (not tunable, but feed the parameters)

| Indicator | How it's computed | Used by |
|-----------|-------------------|---------|
| `chg4` | `Spread.pct_change(4)` — 4-week % change in credit spread | CHG4_THR sell rule |
| `ret3` | `close.pct_change(3)` — 3-week price return | RET3_THR sell rule |
| `spread_delta` | `Spread.diff()` — week-over-week spread change | BUY rule: last 2 must both be negative |
| `MA{n}` | `close.rolling(n).mean()` | BUY rule: price > MA |
| `yield10_chg4` | `DGS10.pct_change(4)` — 4-week % change in 10yr yield | YIELD10_CHG4 sell rule |
| `yield2_chg4` | `DGS2.pct_change(4)` — 4-week % change in 2yr yield | YIELD2_CHG4 sell rule |
| `curve_chg4` | `YieldCurve.diff(4)` — 4-week absolute change in 10y-2y curve | CURVE_CHG4 sell rule |
| `yield10_delta` | `DGS10.diff()` — week-over-week change in 10yr yield | BUY rule: last 2 must both be negative |

### Disabling Individual Factors

Any of the 10 factors can be disabled via a checkbox in the UI. This enables "what if" testing.

- **Disabled sell factor** → never triggers (treated as `False`)
- **Disabled buy factor** → always passes (treated as `True`)
- `SPREAD_DELTA` and `YIELD10_DELTA` are fully numeric parameters (integer, default 2) — they control the number of consecutive falling weeks required and appear as regular inputs in the UI

In the optimizer, disabled factors collapse their grid to a single placeholder `[0]`, reducing total combinations. The 4 treasury factors start with `ignore: true` in `securities_config.json` for all tickers.

Backend: `GenericStrategy.__init__` accepts `params: dict` and `ignore: set` of factor names. `GenericOptimizer` accepts `disabled_factors: set`. API endpoints accept `disabled_factors: list[str]`.

### The Intuition

The strategy is designed around credit spreads (FRED data) as a risk signal for SPHY, since SPHY holds high-yield bonds whose value falls when credit risk rises:

- **Sell early** if spreads spike (level or momentum), or if price already dropped
- **Buy back cautiously** only when price is recovering (above MA), spreads are actively falling (2 consecutive negative deltas), and spreads have meaningfully pulled back from a recent peak (DROP threshold)

---

## SHYM

SHYM (Xtrackers Short Duration High Yield Bond ETF) uses the **same strategy rules and parameters** as SPHY. Both use `GenericStrategy` driven by `securities_config.json`.

The parameter values are tuned independently via the optimizer for each security. SHYM default grids are broad starting points until the optimizer finds security-specific best values.

| Parameter | Role | Same as SPHY? |
|-----------|------|---------------|
| SPREAD_LVL | Absolute spread threshold for sell | Same rule, different optimal value |
| CHG4_THR | 4-week spread momentum sell trigger | Same rule, different optimal value |
| RET3_THR | 3-week price return sell trigger | Same rule, different optimal value |
| MA | Moving average length for buy confirmation | Same rule, different optimal value |
| DROP | Required spread pullback from 4-week peak for buy | Same rule, different optimal value |
| YIELD10_CHG4 | 10yr yield 4-week change sell trigger | Same rule, starts disabled |
| YIELD2_CHG4 | 2yr yield 4-week change sell trigger | Same rule, starts disabled |
| CURVE_CHG4 | Yield curve flattening sell trigger | Same rule, starts disabled |
| YIELD10_DELTA | 10yr yield falling buy condition | Same rule, starts disabled |

---

## NEA

NEA (Nuveen AMT-Free Quality Municipal Income Fund) uses the **same strategy rules and parameters** as SPHY. Both use `GenericStrategy` driven by `securities_config.json`.

The parameter values are tuned independently via the optimizer for each security. NEA default grids are broad starting points until the optimizer finds security-specific best values.

| Parameter | Role | Same as SPHY? |
|-----------|------|---------------|
| SPREAD_LVL | Absolute spread threshold for sell | Same rule, different optimal value |
| CHG4_THR | 4-week spread momentum sell trigger | Same rule, different optimal value |
| RET3_THR | 3-week price return sell trigger | Same rule, different optimal value |
| MA | Moving average length for buy confirmation | Same rule, different optimal value |
| DROP | Required spread pullback from 4-week peak for buy | Same rule, different optimal value |
| YIELD10_CHG4 | 10yr yield 4-week change sell trigger | Same rule, starts disabled |
| YIELD2_CHG4 | 2yr yield 4-week change sell trigger | Same rule, starts disabled |
| CURVE_CHG4 | Yield curve flattening sell trigger | Same rule, starts disabled |
| YIELD10_DELTA | 10yr yield falling buy condition | Same rule, starts disabled |
