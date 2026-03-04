# Strategy Definitions

## SPHY

### SELL Triggers — sell if **ANY** of these are true

| Parameter | What it measures | Role | Best value |
|-----------|-----------------|------|------------|
| **SPREAD_LVL** | Absolute level of the credit spread | If spread is above this threshold, risk is too high — sell | 7.0 |
| **CHG4_THR** | 4-week % change in credit spread (`chg4`) | If spread has risen more than this over 4 weeks, momentum is bad — sell | 16% |
| **RET3_THR** | 3-week price return of SPHY (`ret3`) | If the price has dropped more than this over 3 weeks, sell | −2.25% |

### BUY Triggers — buy only if **ALL** of these are true (when not currently invested; starting in cash counts as already sold)

| Parameter | What it measures | Role | Best value |
|-----------|-----------------|------|------------|
| **MA** | n-week moving average of close price | Price must be above its MA — confirms uptrend | 50 weeks |
| **spread_delta** | Week-over-week change in credit spread (`Spread.diff()`) | Last 2 consecutive weekly spread deltas must both be negative — confirms spreads are actively falling | n/a (derived) |
| **DROP** | Required % drop from the 4-week spread peak | Spread must have fallen this much from its recent high before re-entering | 1.6% |

### Derived Indicators (not tunable, but feed the parameters)

| Indicator | How it's computed | Used by |
|-----------|-------------------|---------|
| `chg4` | `Spread.pct_change(4)` — 4-week % change in credit spread | CHG4_THR sell rule |
| `ret3` | `close.pct_change(3)` — 3-week price return | RET3_THR sell rule |
| `spread_delta` | `Spread.diff()` — week-over-week spread change | BUY rule: last 2 must both be negative |
| `MA{n}` | `close.rolling(n).mean()` | BUY rule: price > MA |

### The Intuition

The strategy is designed around credit spreads (FRED data) as a risk signal for SPHY, since SPHY holds high-yield bonds whose value falls when credit risk rises:

- **Sell early** if spreads spike (level or momentum), or if price already dropped
- **Buy back cautiously** only when price is recovering (above MA), spreads are actively falling (2 consecutive negative deltas), and spreads have meaningfully pulled back from a recent peak (DROP threshold)

---

## SHYM

SHYM (Xtrackers Short Duration High Yield Bond ETF) uses the **same strategy rules and parameters** as SPHY. Both inherit from `SpreadStrategy` in `strategy_spread.py`.

The parameter values are tuned independently via the optimizer for each security. SHYM default grids are broad starting points until the optimizer finds security-specific best values.

| Parameter | Role | Same as SPHY? |
|-----------|------|---------------|
| SPREAD_LVL | Absolute spread threshold for sell | Same rule, different optimal value |
| CHG4_THR | 4-week spread momentum sell trigger | Same rule, different optimal value |
| RET3_THR | 3-week price return sell trigger | Same rule, different optimal value |
| MA | Moving average length for buy confirmation | Same rule, different optimal value |
| DROP | Required spread pullback from 4-week peak for buy | Same rule, different optimal value |
