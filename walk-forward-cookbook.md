# Walk-Forward Testing — Cookbook for Implementation

## Overview

Add a new **Walk-Forward** tab to SignalVane. This tab allows the user to validate their strategy parameters and discover optimal parameters across rolling or anchored time windows.

---

## Tab UI — Inputs

### Required Inputs

- **Security**: Dropdown of configured securities
- **Window size**: Integer input in months (default: 12)
- **Window type**: Toggle — Anchored or Rolling
  - **Anchored**: Training period always starts at the beginning of available data. Training window grows each step.
  - **Rolling**: Training period is a fixed length that slides forward.
  - If Anchored: additional input for **initial training size in months** (default: 36). The first test window won't begin until this much history is available for training.
  - If Rolling: additional input for **training window length in months**
- **Mode**: Selection — Validate or Discover (run one at a time; user selects mode and triggers the run independently)
- **Step size**: Equals the window size (i.e., test windows are non-overlapping and advance by window_size months each step)

### Discover Mode — Additional Inputs

- **APY tolerance**: Numeric input in basis points (default: 10). During factor elimination, a factor is considered "no impact" if removing it keeps APY within this tolerance of the baseline.
- **Trade count tiebreaker**: Always on. When APY is within tolerance, prefer the option with fewer trades.
- **Max combinations for range refinement**: Integer input (default: 3000). Controls how wide ranges can expand during the optimization step.
- **Seed source for each window**: Toggle
  - **Use saved parameters**: Every window seeds from the security's current saved config values (both active and ignored factors).
  - **Use previous window result**: First window seeds from saved config. Each subsequent window seeds from the previous window's Discover result.

---

## Mode 1: Validate

### Purpose

Test the user's current saved parameters (fixed, no optimization) across each time window to see how they would have performed.

### Algorithm

1. Load the security's current saved parameters and ignore flags.
2. Divide the available history into test windows based on window_size and window_type.
   - **Anchored**: Training starts at beginning of data. First test window begins after the initial training size is met. Training window grows each subsequent step.
   - **Rolling**: Train on the trailing training_window_length before window N. Test on window N.
   - Note: In Validate mode, the training period is informational only — no optimization is run, so the training/test split doesn't affect computation.
3. For each test window:
   - Run the strategy using the saved parameters over just that window's date range.
   - Record: test period start/end, strategy APY, buy-and-hold APY, number of trades, and (when available) standard deviation.
4. Output a summary table with one row per window.

### Output Table Columns (Validate)

| Test Period | Strategy APY | B&H APY | Edge | Trades | Std Dev (strategy) | Std Dev (B&H) |

---

## Mode 2: Discover

### Purpose

For each time window, run the full parameter discovery process using only data available up to that point. Then test the discovered parameters on the next window (out of sample). This validates whether the optimization process itself produces parameters that generalize.

### Algorithm — Per Window

For each window, the training period is used for optimization and the test period is used for out-of-sample evaluation.

#### Step 1: Seed

Load seed values for ALL parameters (sell triggers and buy conditions), including factors that are currently ignored. Seed source depends on user selection:
- **Use saved parameters**: Load from config every time.
- **Use previous window result**: Use the previous window's discovered parameters (first window uses saved config).

All factors start ENABLED (ignore = false) regardless of the current config's ignore flags.

#### Step 2: Baseline Run

Run the strategy on the training period using all seed values as fixed point values (no ranges). Record APY and trade count. This is the baseline.

#### Step 3: Single-Factor Elimination Pass

For each enabled factor, one at a time:
- Disable (ignore) that factor.
- Run the strategy on the training period with the same fixed values.
- Record APY and trade count.
- Compare to baseline:
  - If APY drop is within the configured tolerance AND trades decreased (or stayed the same): mark factor as **candidate for elimination**.
  - If APY actually improved: mark factor as **strong candidate for elimination**.
  - If APY drops beyond tolerance: factor is **required**, keep it.

#### Step 4: Combination Elimination (if needed)

If multiple factors are candidates for elimination:
- Test all combinations of eliminating the candidate factors together.
- For each combination, record APY and trade count.
- Select the combination that maximizes APY (within tolerance of baseline) with fewest trades.
- The surviving factors after this step are the **active set**.

#### Step 5: Range Refinement (Joint Optimization)

With only the active factors remaining:
1. Take each active factor's configured step size from the security config.
2. Widen all ranges symmetrically around the seed value, expanding by equal number of steps in each direction for all factors.
3. Keep expanding until total combinations (product of steps per factor) would exceed the configured max combinations ceiling.
4. Run the optimizer over the training period with these ranges.
5. Record the best parameters (highest APY, with trade count as tiebreaker).

#### Step 6: Out-of-Sample Test

Take the parameters discovered in Step 5 and run them (fixed, no optimization) on the TEST window. Record APY, B&H APY, trades.

#### Step 7: Record Results

Store for this window:
- Training period dates
- Test period dates
- Discovered parameters and which factors are active
- Training APY (in-sample)
- Test APY (out-of-sample)
- B&H APY (test period)
- Trade count (test period)

### Output Table Columns (Discover)

| Train Period | Test Period | Active Factors | Key Params | In-Sample APY | Out-of-Sample APY | B&H APY | Edge | Trades |

Additionally, produce a **Factor Stability Summary**: for each factor, show how many windows it survived elimination. This reveals which factors are robust across time periods.

---

## Important Notes

### Factor List

**Sell triggers** (any fires → SELL):
- CHG4 — 4-week credit spread change
- RET3 — 3-week price return
- YLD10_CHG4 — 10-year yield 4-week change
- YLD2_CHG4 — 2-year yield 4-week change
- CURVE_CHG4 — yield curve 4-week change

**Buy conditions** (all must be met → BUY):
- MA — moving average period
- DROP — price drop threshold
- SPREAD_DELTA — consecutive weeks of declining spreads
- YLD10_DELTA — 10-year yield declining for N weeks

### Data Considerations

- Use Alpha Vantage's **adjusted close** column for all price calculations (not unadjusted close). This handles stock splits correctly.
- Window boundaries should align to the weekly data points SignalVane already uses.
- If a test window has no trades, still report APY (which would equal B&H for that window if holding from start, or cash rate if starting out of position).

### Performance Considerations

- Validate mode should be fast — no optimization, just strategy execution per window.
- Discover mode Steps 2-4 are fast — single point value runs, no grid search.
- Discover mode Step 5 is the slow step — constrained by the max combinations setting.
- Consider showing a progress indicator since Discover mode over many windows could take significant time.

### Edge Cases

- If window_size doesn't divide evenly into available history, the last test window may be shorter. Include it but flag it in the output.
- For anchored windows, the first test window starts after the configured initial training size is met.
- If Step 5 produces the same APY for multiple parameter sets, prefer fewer trades. If still tied, prefer the parameters closer to the seed values (less deviation = more conservative).
