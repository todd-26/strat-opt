# Strategy Definitions

All securities in SignalVane use the same `GenericStrategy` driven by `api/securities_config.json`. Parameter values are tuned per-security via the backtester optimizer, but the rules are identical.

---

## SELL Triggers — sell if **ANY** of these are true

| Parameter | What it measures | Trigger condition |
|-----------|-----------------|-------------------|
| **CHG4** | 4-week % change in credit spread (`chg4`) | `chg4 > CHG4` — spread has risen too much over 4 weeks |
| **RET3** | 3-week price return (`ret3`) | `ret3 < RET3` — price has dropped too much over 3 weeks (RET3 is negative) |
| **YIELD10_CHG4** | 4-week % change in 10yr Treasury yield | `yield10_chg4 > YIELD10_CHG4` — 10yr yield rose too much over 4 weeks |
| **YIELD2_CHG4** | 4-week % change in 2yr Treasury yield | `yield2_chg4 > YIELD2_CHG4` — 2yr yield rose too much over 4 weeks |
| **CURVE_CHG4** | 4-week absolute change in yield curve (10y−2y) | `curve_chg4 < -CURVE_CHG4` — curve has flattened by more than threshold (stored positive, compared as negative) |

---

## BUY Conditions — buy only if **ALL** of these are true AND no sell condition is active

Only evaluated when not currently invested. Starting in cash (`start_invested = 0`) counts as already sold, so buy conditions can fire immediately.

| Parameter | What it measures | Pass condition |
|-----------|-----------------|----------------|
| **MA** | n-week moving average of close price | `close > MA` — price is above its moving average (uptrend confirmed) |
| **DROP** | Required % drop from the 4-week spread peak | `spread ≤ peak × (1 − DROP)` — spread has pulled back meaningfully from its recent high |
| **SPREAD_DELTA** | Number of consecutive falling `spread_delta` weeks required | Last `SPREAD_DELTA` weekly `spread_delta` values must all be negative (spreads actively falling) |
| **YIELD10_DELTA** | Number of consecutive falling `yield10_delta` weeks required | Last `YIELD10_DELTA` weekly `yield10_delta` values must all be negative (10yr yield falling) |

---

## Derived Indicators

These are computed by `IndicatorEngine.apply_all()` and feed the parameters above. They are not directly tunable.

| Indicator | How it's computed | Used by |
|-----------|-------------------|---------|
| `chg4` | `Spread.pct_change(4)` — 4-week % change in credit spread | CHG4 sell rule |
| `ret3` | `close.pct_change(3)` — 3-week price return | RET3 sell rule |
| `spread_delta` | `Spread.diff()` — week-over-week spread change | SPREAD_DELTA buy rule |
| `MA{n}` | `close.rolling(n).mean()` — n-week moving average | MA buy rule |
| `yield10_chg4` | `DGS10.pct_change(4)` — 4-week % change in 10yr yield | YIELD10_CHG4 sell rule |
| `yield2_chg4` | `DGS2.pct_change(4)` — 4-week % change in 2yr yield | YIELD2_CHG4 sell rule |
| `curve_chg4` | `YieldCurve.diff(4)` — 4-week absolute change in 10y−2y curve | CURVE_CHG4 sell rule |
| `yield10_delta` | `DGS10.diff()` — week-over-week change in 10yr yield | YIELD10_DELTA buy rule |
| `YieldCurve` | `DGS10 − DGS2` — yield curve spread | Feeds curve_chg4 |

---

## Data Sources

| Source | Series | Column | Frequency |
|--------|--------|--------|-----------|
| Alpha Vantage | Weekly adjusted prices | `close`, `dividend` | Weekly (W-FRI) |
| FRED | `BAMLH0A0HYM2` | `Spread` | Daily → resampled W-FRI |
| FRED | `DGS10` | `DGS10` | Daily → resampled W-FRI |
| FRED | `DGS2` | `DGS2` | Daily → resampled W-FRI |
| Derived | — | `YieldCurve = DGS10 − DGS2` | Computed after merge |

FRED daily data is resampled to weekly using `.resample('W-FRI').last()` — each weekly value is the last available FRED reading on or before that Friday.

---

## Disabling Individual Factors

Any of the 10 factors can be disabled via a checkbox in the UI or the `ignore` flag in `securities_config.json`.

- **Disabled sell factor** → never triggers (treated as `False`)
- **Disabled buy factor** → always passes (treated as `True`)
- `SPREAD_DELTA` and `YIELD10_DELTA` are integer parameters (default 2) — they control the number of consecutive falling weeks required

In the backtester optimizer, disabled factors collapse their grid to a single placeholder `[0]`, reducing total combinations.

Backend: `GenericStrategy.__init__` accepts `params: dict` and `ignore: set`. `GenericOptimizer` accepts `disabled_factors: set`. API endpoints accept `disabled_factors: list[str]`.

---

## The Intuition

The strategy is designed around credit spreads (FRED `BAMLH0A0HYM2`) as a risk signal for high-yield bond ETFs, since their value falls when credit risk rises:

- **Sell early** if spreads spike (by level or momentum), price drops sharply, or interest rate conditions deteriorate
- **Buy back cautiously** only when price is recovering (above MA), spreads are actively falling (consecutive negative deltas), and spreads have meaningfully pulled back from a recent peak (DROP threshold)

A flattening yield curve (`curve_chg4` negative) is a warning sign — it typically signals Fed tightening or reduced growth expectations, both bad for high-yield bonds. `CURVE_CHG4` is stored as a positive magnitude; the sell fires when `curve_chg4 < -CURVE_CHG4` (i.e., the curve dropped by more than that many percentage points over 4 weeks). One unit = 100 basis points.
