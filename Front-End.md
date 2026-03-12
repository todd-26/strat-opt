# Front-End Specification

## Overview

A React/Vite single-page application that provides a polished, professional interface for running the strat-opt strategy tools. Runs on localhost initially; designed to be accessible from other devices on the local network without any changes. A local Python backend (FastAPI recommended) serves as the API layer between the UI and the existing Python pipeline.

---

## Visual Style

**Default theme**: Neutral/corporate — light background, slate gray, white, and teal accents. Structured, data-focused, and businesslike (similar to Morningstar or a wealth management tool). Not flashy.

**Typography**: Clean sans-serif (e.g., Inter). Comfortable line height. Data tables use monospace or tabular number rendering for alignment.

**Themes**: The default is slate gray + white + teal. Additional themes are selectable in Settings:
- Navy + white + gold (classic finance)
- Charcoal + white + green (buy/sell signal-friendly; dark-ish)
- High contrast (strong black/white, maximum readability)

Themes are applied globally and persisted in localStorage.

---

## Layout

### Header
A persistent top header containing:
- App name on the left (e.g., **strat-opt**)
- Security **dropdown** next to the name (populated from `GET /api/securities`; currently SPHY and SHYM)
- **From / To date inputs** for a global date range filter (not persisted; applies to Backtester, Buy & Hold, and Current Signal tabs). Hidden when the **Signals** tab is active (via `hideDates` prop) since that tab always uses full history. By default they display the actual data range (min/max) for the selected security, fetched from `GET /api/date-range`; internally stored as `''` (no filter) until the user changes them. Uses `<input type="date">` — browser native calendar, enforces valid dates. A small popover appears below each field on focus with **Today** (clamped to data range) and **Clear** (resets field to default range) buttons. On blur, validates: end < start or date out of data range shows an error popup and clears the bad field. An **X** button appears when either date is customized to reset both to default.
- Gear icon on the right to open Settings

### Tab Navigation
Below the header: a single row of tabs, one per run type:
- **Optimizer**
- **Buy & Hold**
- **Current Signal**
- **Signals**

Each tab has its own independent state (parameters, results). Selecting a different security does **not** reset the active tab.

### Parameter Panel (per tab)
Each tab has a collapsible parameter panel. It starts expanded. After a run completes successfully, it collapses automatically so results get full focus. The user can re-expand it at any time.

**Factor Checkboxes**: Each factor has a checkbox to enable/disable it. Factors are grouped under "Sell Factors" (SPREAD_LVL, CHG4, RET3, YIELD10_CHG4, YIELD2_CHG4, CURVE_CHG4) and "Buy Factors" (MA, DROP, SPREAD_DELTA, YIELD10_DELTA) headers. Disabled factors grey out their inputs (opacity 0.45). `SPREAD_DELTA` and `YIELD10_DELTA` are fully numeric inputs (integer, default 2) controlling how many consecutive falling weeks are required — they behave identically to all other parameters. In the optimizer, disabled factors collapse their grid to a single placeholder value, reducing total combinations.

### Results Area
Results are displayed **side by side**: the chart on the left, key summary metrics on the right. Both are given equal visual prominence.

---

## Run Types

### Optimizer Tab

**Parameters panel** (collapsible):
Each strategy parameter gets three inputs: **min**, **max**, and **step**. Pre-filled with sensible defaults. Layout is a clean form — labeled rows, compact, not overwhelming.

**After running:**
- A **summary card** at the top highlights the best parameter combination and its APY.
- Below it, a **full sortable results table** lists all combinations with their APY and parameter values.
- Clicking a row in the table **selects** it and shows a **"Run Backtest"** button. Confirming runs a backtest with those parameters and displays the result inline.

**Chart**: Equity curve for the best-performing parameter set (or the selected row after drill-down). Buy-and-hold overlay is shown by default but can be toggled off.

**Export**: CSV download of the full results table. PNG export of the chart. The ticker and APY labels appear **only inside the PNG-captured div** (not in the toolbar). `EquityCurveChart` accepts a `strategyLabel` prop (default `"Strategy"`) so Buy & Hold tab can pass `"Buy & Hold"` instead. `buyholdApy` label is only shown when the overlay is active.

---

### Buy & Hold Tab

**Parameters panel** (collapsible):
- Security selector (dropdown — SPHY only initially, ready to expand)
- Starting position (invested or cash)
- Cash rate (annual yield %)
- Input source (CSV or API)

**After running:**
- Summary card: final value, APY, date range.
- Equity curve chart.

**Export**: CSV download of weekly equity data. PNG export of chart.

---

### Current Signal Tab

**Parameters panel** (collapsible):
Each strategy parameter gets a single value input (not a range). Pre-filled with the current best known parameters.

**After running**, two things are shown side by side:

**Left — Current Signal**:
- A large, prominent signal badge: **BUY**, **HOLD**, or **SELL**, color-coded (green / neutral / red).
- The current values of the key metrics that drove the decision (spread, MA, ret3, chg4, spread_delta, etc.).
- The date the current signal was first triggered.
- Below the metrics: a **MetricsCard** showing APY and final value.

**Right — Factor Values**:
A panel showing the current metric reading for each factor, grouped into **Sell** (trigger if ANY true) and **Buy** (ALL must be true) sections. Disabled factors are shown at reduced opacity with an "(off)" label. Each row: factor label on the left, current metric value on the right (percentage factors shown as %). Implemented via `ThresholdRow` component in `SignalTab.tsx`.

Sell factors: Spread, chg4, ret3, 10yr chg4, 2yr chg4, ΔCurve.

Buy factors: Close, MA, 4wk Spread Peak (spread_4wk_peak, the rolling 4-week max of Spread), Drop (spread_drop = 1 − spread/4wk-peak, shown as %), Δspread, Δyield10.

`ThresholdRow` accepts an optional `history` prop (used for Δspread and Δyield10). When provided, it displays all N history values inline (oldest → newest, comma-separated) and appends a green ✓ or red ✗ badge indicating whether all N values are negative (i.e., the consecutive-weeks condition passes). `SignalMetrics` includes `spread_delta_history` and `yield10_delta_history` (list of floats, oldest first, length = SPREAD_DELTA / YIELD10_DELTA param value) populated in `run_signal`.

**Trade History** (full width, below the signal/metrics):
A table of all historical buy/sell events with columns: Date, Action, Price, MA, Spread, Drop, chg4, ret3, Δspread, Δ10yr%, Δ2yr%, ΔCurve, Δyield10 (13 columns total).

Column headers have ⓘ hover tooltips explaining each metric (drop downward to avoid clipping; last column tooltip is right-aligned to avoid right-edge overflow).

Values that contributed to the decision are **bolded** (dotted underline, pointer cursor). **Disabled factors** are never bolded and their popups are suppressed:
- SELL: bold any of spread / chg4 / ret3 / yield10_chg4 / yield2_chg4 / curve_chg4 that exceeded its threshold (unless that factor is disabled)
- BUY: bold Price and MA (close > MA), Drop (spread drop from 4-week peak ≥ DROP threshold), Δspread (falling spreads), and Δyield10 (falling 10yr yield) (unless that factor is disabled)

Clicking a bolded value opens a popup showing the derivation:
- spread: value vs SPREAD_LVL threshold
- chg4: % change vs threshold + spread 4 wks ago → now
- ret3: % return vs threshold + price 3 wks ago → now
- Price / MA: close vs MA value (shown to 4 decimal places to avoid rounding ambiguity)
- Drop: 4-week peak spread, current spread, actual drop %, and DROP threshold
- Δspread: this week's delta + prior week's delta (confirms both negative)
- Δ10yr%: 4-week % change vs YIELD10_CHG4 threshold + yield 4 wks ago
- Δ2yr%: 4-week % change vs YIELD2_CHG4 threshold + yield 4 wks ago
- ΔCurve: 4-week absolute change vs −CURVE_CHG4 threshold + curve 4 wks ago
- Δyield10: this week's delta + prior week's delta (confirms both negative)

**Export**: CSV download of the trade history table.

---

### Signals Tab

A quick-check dashboard that runs the current signal across multiple securities at once.

**Controls** (top panel):
- **Data Source** dropdown (CSV / Live API) — local to this tab, initialized from `settings.inputType`
- **Select All / Deselect All** buttons
- **Run Signals** button — disabled while running or when nothing is checked

**Securities list**: One row per security. Each row has: checkbox (all checked by default), ticker, an **Invested / Not Invested toggle**, and a signal badge that appears as results arrive. Results paint **serially** (one at a time) as each security completes. Each run uses the security's saved default params and disabled factors from `securities_config.json`; no date range filter is applied (full history).

The **Invested/Not Invested toggle** shows the current `start_invested` value. Clicking it immediately flips the value and persists it via `POST /api/config` (fire-and-forget with revert on failure). Toggle is green-tinted for Invested, amber-tinted for Not Invested.

Signal badges: `▲ BUY` (green), `▼ SELL` (red), `● HOLD` (amber). Errors show the message inline in red. Rows for unchecked securities are dimmed (opacity 0.45).

**Config prefetch** — `SignalsTab` fetches all security configs on mount (in parallel) so the toggles are populated immediately. Falls back to fetching at run time if a config wasn't loaded yet.

---

## Chart Behavior

- **Library**: No strong preference; Recharts is the default recommendation (React-native, lightweight, good toggle and export support).
- **Buy/sell signal markers**: Up-triangles below the line for buys, down-triangles above the line for sells, color-coded green/red.
- **Buy-and-hold overlay**: Shown as a second line on the same chart. Toggleable via a checkbox or toggle button near the chart.
- **PNG export**: Available on all charts via an export button.

---

## Loading & Progress

- While any run is executing, a **progress bar** is shown in the results area.
- For the optimizer, the progress bar reflects how many parameter combinations have been evaluated (requires the backend to stream or report progress).
- The Run button is disabled while a run is in progress.

---

## Error Handling

- Errors (backend failures, bad parameters, etc.) appear as a **dismissible error banner** at the top of the results area.
- The banner includes the error message and a close (×) button.
- Form validation errors appear inline below the relevant input field before a run is triggered.
- Optimizer tab validates that max ≥ min for every **enabled** parameter range before submitting; disabled factors skip validation. Shows an inline error naming the offending parameter(s) and does not run.

---

## Settings (Gear Icon → Modal or Slide-over Panel)

Accessible via the gear icon in the header. Contains:

0. **Manage Securities** — at the top of the settings sheet. Lists all current securities; each has a trash icon to delete (disabled when only one remains; requires inline confirmation before deleting) and an "Update" button to re-fetch historical data from Alpha Vantage. Below the list, an "Add Security" form: Ticker (text), Name (text), Model after (dropdown of existing tickers), and an Add button. Adding auto-fetches the CSV from Alpha Vantage if not already present. After add/remove, the securities list in the header refreshes; if the active ticker was removed, the app switches to the first remaining one.
1. **Color Theme** — radio or card selector for the four available themes; applied immediately on selection.
2. **Input Source** — toggle between CSV (local files) and API (live Alpha Vantage / FRED).
3. **Default Cash Rate** — annual cash yield rate (decimal, e.g., 0.04).
4. **Default Starting Position** — radio: Invested or Cash.
5. **Enabled Factors** — checkboxes for all 10 factors, grouped under "Sell Factors" (SPREAD_LVL, CHG4, RET3, YIELD10_CHG4, YIELD2_CHG4, CURVE_CHG4) and "Buy Factors" (MA, DROP, SPREAD_DELTA, YIELD10_DELTA). Checked = enabled (unchecked = disabled). Persisted in `securities_config.json` via `ignore` flag per parameter; tabs initialize from these on page load.
6. **Default Parameter Values** — inputs to set the default parameter values that pre-fill the Current Signal tab on page load. Includes all 10 params. Edits are local until "Save Permanently" is clicked.
7. **Default Optimizer Ranges** — min/max/step inputs for each of the 10 strategy parameters, pre-filling the Optimizer tab's range grid on page load. Edits are local until "Save Permanently" is clicked.
8. **Save Permanently** — button at the bottom. POSTs `defaultParams` and `defaultRanges` to `POST /api/config`, which writes `api/config.json` to disk. Button shows: "Save Permanently" (idle), "Saving…" (in-flight), "Saved!" (success, reverts after 2 s), "Error — try again" (failure).

**Persistence split**:
- Theme and Input Source are persisted in `localStorage`.
- Cash Rate, Starting Position, Disabled Factors, Default Parameters, and Default Optimizer Ranges are persisted in `api/securities_config.json` via the API (per-security). They are **not** stored in `localStorage`.

---

## Config File and API

### `api/securities_config.json`
Server-side JSON file storing all per-security defaults. Each parameter has `description`, `ignore`, `default`, and `range` fields. `ignore: true` means the factor is disabled.

```json
{
  "securities": {
    "SPHY": {
      "cash_rate": 0.04,
      "start_invested": 1,
      "sell_triggers": {
        "CHG4":       { "description": "...", "ignore": false, "default": 0.165, "range": { "min": 0.1, "max": 0.2, "step": 0.005 } },
        "YIELD10_CHG4": { "ignore": true, "default": 0.10, "range": { ... } },
        ...
      },
      "buy_conditions": {
        "MA":         { "ignore": false, "default": 50, "range": { ... } },
        "YIELD10_DELTA":{ "ignore": true,  "default": 2,  "range": { ... } },
        ...
      }
    }
  }
}
```

### `GET /api/config?ticker=SPHY`
Returns `AppConfig` derived from `securities_config.json` for the given ticker.

### `POST /api/config?ticker=SPHY`
Accepts an `AppConfig` body and merges changes back into `securities_config.json`. Returns `{"ok": true}`.

### TypeScript types
`ParamConfig` and `AppConfig` are defined in `frontend/src/types/index.ts`:
```typescript
interface ParamConfig { description: string; ignore: boolean; default: number; range: { min: number; max: number; step: number } }
interface AppConfig {
  name: string; cash_rate: number; cash_vehicle: string; start_invested: 0 | 1
  sell_triggers: { CHG4: ParamConfig; RET3: ParamConfig; SPREAD_LVL: ParamConfig; YIELD10_CHG4: ParamConfig; YIELD2_CHG4: ParamConfig; CURVE_CHG4: ParamConfig }
  buy_conditions: { MA: ParamConfig; DROP: ParamConfig; SPREAD_DELTA: ParamConfig; YIELD10_DELTA: ParamConfig }
}
```

### Data flow
`App.tsx` holds `config: AppConfig | null` state, loaded from `GET /api/config` on ticker change. It derives `defaultStrategyParams`, `defaultRanges`, `defaultDisabledFactors`, and `paramDescriptions` from the config and passes them as props to each tab. `SettingsSheet` receives `config`, `onSaveConfig`, `securities`, `onAddSecurity`, `onRemoveSecurity`, and `onFetchData` props. `handleFetchData` in App.tsx calls `updateSecurityData`, then resets startDate/endDate and reloads dateRange when the updated ticker matches the current one. `lastConfigRef` (useRef) holds the last non-null config so SettingsSheet is rendered outside the `config &&` gate and never unmounts during ticker reload. `dateRangeError` state captures failures from `getDateRange`; passed to Header as optional `dateRangeError?: string | null` prop and displayed inline below the date pickers.

---

## Security / Multi-Security

- A security **dropdown** is present in the UI from day one, pre-populated with SPHY only.
- The selected security is shown as a badge in the header.
- The architecture should not hardcode SPHY in the UI logic — the dropdown drives the selection, making it straightforward to add more securities later.

---

## Deployment

- **Initial**: Runs on `localhost` — React dev server (or built static files) + Python backend on a local port.
- **Near-term**: Accessible from other devices on the local network by binding to `0.0.0.0`. No authentication required.
- **No cloud hosting planned.** `serve.bat` launches the pre-built frontend + backend on port 8000. `start-prod.bat` rebuilds the frontend first, then serves.
