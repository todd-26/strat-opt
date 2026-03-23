# Front-End Specification

## Overview

A React/Vite single-page application providing a polished, professional interface for **SignalVane** — a financial strategy backtesting and signal tool for income-focused ETFs. Runs on localhost; accessible from other devices on the local network without any changes. A local Python/FastAPI backend serves as the API layer between the UI and the Python pipeline.

---

## Visual Style

**Default theme**: Neutral/corporate — light background, slate gray, white, and teal accents. Structured, data-focused, and businesslike (similar to Morningstar or a wealth management tool). Not flashy.

**Typography**: Clean sans-serif (Inter). Comfortable line height. Data tables use monospace or tabular number rendering for alignment.

**Themes**: The default is slate gray + white + teal. Additional themes are selectable in Settings:
- Navy + white + gold (classic finance)
- Charcoal + white + green (buy/sell signal-friendly; dark-ish)
- High contrast (strong black/white, maximum readability)

Themes are applied globally and persisted in localStorage.

---

## Layout

### Header
A persistent top header containing:
- App name **SignalVane** on the left
- Security **dropdown** next to the name (populated from `GET /api/securities`; securities are user-configurable via Settings)
- **From / To date inputs** for a global date range filter (not persisted; applies to Backtester, Buy & Hold, and Current Signal tabs). Hidden when the **Signals** tab is active (via `hideDates` prop) since that tab always uses full history. By default they display the actual data range (min/max) for the selected security, fetched from `GET /api/date-range`; internally stored as `''` (no filter) until the user changes them. Uses `<input type="date">` — browser native calendar. An **X** button appears when either date is customized to reset both to default. On blur, validates: end < start or date out of data range shows an error popup and clears the bad field.
- Gear icon on the right to open Settings

### Tab Navigation
Below the header: a single row of tabs:
- **Backtester**
- **Buy & Hold**
- **Current Signal**
- **Signals**
- **Walk-Forward**

Each tab has its own independent state (parameters, results). Selecting a different security does **not** reset the active tab.

### Parameter Panel (Backtester, Buy & Hold, Current Signal)
Each of these three tabs has a collapsible parameter panel. It starts expanded. After a run completes successfully, it collapses automatically so results get full focus. The user can re-expand it at any time.

**Factor Checkboxes**: Each factor has a checkbox to enable/disable it. Factors are grouped under "Sell Factors" (CHG4, RET3, YIELD10_CHG4, YIELD2_CHG4, CURVE_CHG4) and "Buy Factors" (MA, DROP, SPREAD_DELTA, YIELD10_DELTA) headers — 9 factors total. Disabled factors grey out their inputs (opacity 0.45). `SPREAD_DELTA` and `YIELD10_DELTA` are fully numeric inputs (integer, default 2) controlling how many consecutive falling weeks are required — they behave identically to all other parameters. In the backtester, disabled factors collapse their grid to a single placeholder value, reducing total combinations.

**Settings isolation**: Opening or saving Settings does **not** affect parameter values in the Backtester or Current Signal tabs. Each tab initializes from config on mount (React `key={ticker}` remounts on ticker change). Two buttons in the controls row manage the relationship explicitly:
- **Reset from Settings** — restores all tab parameters to the current saved defaults; accent-colored and enabled only when values differ from saved defaults; muted and disabled otherwise.
- **Save to Settings** — writes the tab's current values back to `securities_config.json` (updates defaults, ranges, ignore flags, cash rate, start position); accent-colored and enabled only when values differ from saved defaults; shows Saving… / Saved! / Error feedback.
- **Save Permanently** (Settings sheet) — same pattern: accent + enabled only when `localConfig` differs from the loaded `config`; muted + disabled when no changes.

### Results Area
Results are displayed **side by side**: the chart on the left, key summary metrics on the right. Both are given equal visual prominence.

---

## Run Types

### Backtester Tab

**Parameters panel** (collapsible):
Each strategy parameter gets three inputs: **min**, **max**, and **step**. Pre-filled from saved defaults in `securities_config.json`. Layout is a clean form — labeled rows, compact, not overwhelming.

**After running:**
- A **summary card** at the top highlights the best parameter combination and its APY.
- Below it, a **full sortable results table** lists all combinations with their APY and parameter values.
- Clicking a row in the table **selects** it and shows a chart icon to expand a drill-down chart for that parameter set.

**Chart**: Equity curve for the selected drill-down row. Buy & Hold overlay is off by default; toggled on via checkbox. The chart header (visible in PNG export) shows: ticker, Strategy APY, Buy & Hold APY (when overlay active), and date range right-justified.

**Export**: CSV download of the full results table. PNG export of the chart.

---

### Buy & Hold Tab

**Parameters panel** (collapsible):
- Cash rate (annual yield %)
- Input source (CSV or Live API)

**After running:**
- Summary card: final value, APY, date range.
- Equity curve chart. Chart header shows ticker and Buy & Hold APY.

**Export**: CSV download of weekly equity data. PNG export of chart.

---

### Current Signal Tab

**Parameters panel** (collapsible):
Each strategy parameter gets a single value input (not a range). Pre-filled with saved defaults.

**After running**, two things are shown side by side:

**Left — Current Signal**:
- A large, prominent signal badge: **▲ BUY**, **● HOLD**, or **▼ SELL**, color-coded (green / amber / red).
- The current values of the key metrics that drove the decision (spread, MA, ret3, chg4, spread_delta, etc.).
- Below the metrics: a **MetricsCard** showing APY and final value.

**Right — Factor Values**:
A panel showing the current metric reading for each factor, grouped into **Sell** (trigger if ANY true) and **Buy** (ALL must be true) sections. Disabled factors are shown at reduced opacity with an "(off)" label. Each row: factor label on the left, current metric value on the right (percentage factors shown as %). Implemented via `ThresholdRow` component in `SignalTab.tsx`.

Sell factors: chg4, ret3, 10yr chg4, 2yr chg4, ΔCurve.

Buy factors: Close, MA, 4wk Spread Peak (spread_4wk_peak, the rolling 4-week max of Spread), Drop (spread_drop = 1 − spread/4wk-peak, shown as %), Δspread, Δyield10.

`ThresholdRow` accepts an optional `history` prop (used for Δspread and Δyield10). When provided, it displays all N history values inline (oldest → newest, comma-separated) and appends a green ✓ or red ✗ badge indicating whether all N values are negative (i.e., the consecutive-weeks condition passes). `SignalMetrics` includes `spread_delta_history` and `yield10_delta_history` (list of floats, oldest first, length = SPREAD_DELTA / YIELD10_DELTA param value) populated in `run_signal`.

**Trade History** (full width, below the signal/metrics):
A table of all historical buy/sell events with columns: Date, Action, Price, MA, Spread, Drop, chg4, ret3, Δspread, Δ10yr%, Δ2yr%, ΔCurve, Δyield10 (13 columns total).

Column headers have ⓘ hover tooltips explaining each metric (drop downward to avoid clipping; last column tooltip is right-aligned to avoid right-edge overflow).

Values that contributed to the decision are **bolded** (dotted underline, pointer cursor). **Disabled factors** are never bolded and their popups are suppressed:
- SELL: bold any of spread / chg4 / ret3 / yield10_chg4 / yield2_chg4 / curve_chg4 that exceeded its threshold (unless that factor is disabled)
- BUY: bold Price and MA (close > MA), Drop (spread drop from 4-week peak ≥ DROP threshold), Δspread (falling spreads), and Δyield10 (falling 10yr yield) (unless that factor is disabled)

Clicking a bolded value opens a popup showing the derivation:
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

### Walk-Forward Tab

Out-of-sample validation of the strategy. Always uses full history; date pickers hidden via `hideDates`. Uses the currently selected ticker; ticker name is displayed prominently at the top of the settings card. Remounts on ticker change via `key={ticker}`.

**Inputs** (all in a single settings card; every label has an `InfoTooltip` hover explanation):
- Window size (months, default 12)
- Window type: Anchored or Rolling toggle
  - Anchored: training always starts at data start; initial training size input (months, default 36)
  - Rolling: fixed training window that slides; training window length input (months, default 36)
- Mode: Validate or Discover toggle
- Discover-only inputs: APY tolerance (bps, default 10), Max combinations (default 3000), Seed source (Saved params / Prev window toggle)

`InfoTooltip` is defined as a local helper function inside `WalkForwardTab` (same pattern as `ParameterPanel.tsx` and `OptimizerTable.tsx`).

**Run/Cancel button** with a progress bar and status line. Validate: N/M windows. Discover: N/(M×5) steps — bar advances at each sub-step; combo-elim and grid-search both update status every 10 combos. Cancel works via a `watch_disconnect` asyncio task (polls every 0.25s) that sets a `threading.Event` — stops the Python thread within ~10 iterations.

**Validate mode output** — table columns: Test Period, Strategy APY, B&H APY, Edge, Trades, Std Dev (Strat), Std Dev (B&H). Edge is color-coded green/red. Partial windows flagged with `*`.

**Discover mode output** — table columns: Train Period, Test Period, Active Factors, Key Params, In-Sample APY, OOS APY, B&H APY, Edge, Trades. Followed by a **Factor Stability** panel: grid of all 9 factors, each showing survived/total windows count and a mini bar (green if ≥ 50%, red otherwise).

**CSV Export** — an "Export CSV" button appears above each results table once results are available. Validate export includes one row per window (test start/end, APYs, edge, trades, std devs, partial flag). Discover export includes one row per window (train/test periods, active factors, key params, APYs, edge, trades, partial flag) followed by a factor stability summary block. Discover export also includes factor stability data appended after the window rows. Filenames: `{ticker}-walkforward-validate.csv` / `{ticker}-walkforward-discover.csv`. Implemented via `exportValidateCsv` / `exportDiscoverCsv` / `exportCsv` helper functions defined as module-level functions in `WalkForwardTab.tsx`.

Implemented in `frontend/src/components/tabs/WalkForwardTab.tsx`. Streaming via `streamWalkForward()` in `lib/api.ts` (same SSE pattern as optimizer).

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

- **Library**: Recharts (React-native, lightweight).
- **Buy/sell signal markers**: Up-triangles below the line for buys, down-triangles above the line for sells, color-coded green/red.
- **Buy & Hold overlay**: Shown as a second dashed line on the same chart. Off by default; toggled on via checkbox near the chart.
- **PNG export**: Available on all charts. The PNG-captured area includes a header row showing: ticker, APY label (configurable via `strategyLabel` prop, default `"Strategy"`; Buy & Hold tab passes `"Buy & Hold"`), Buy & Hold APY (when overlay active), and date range right-justified.

---

## Loading & Progress

- While any run is executing, a loading state is shown in the results area.
- For the backtester, SSE streaming reports progress (combinations evaluated / total) with a live progress bar.
- The Run button is disabled while a run is in progress.

---

## Error Handling

- Errors (backend failures, bad parameters, etc.) appear as a **dismissible error banner** at the top of the results area.
- The banner includes the error message and a close (×) button.
- Form validation errors appear inline before a run is triggered.
- Backtester tab validates that max ≥ min for every **enabled** parameter range before submitting; disabled factors skip validation. Shows an inline error naming the offending parameter(s) and does not run.
- If the selected date range produces no data for a security, the backend returns HTTP 400 with a message showing the available data range.

---

## Settings (Gear Icon → Slide-over Panel)

Accessible via the gear icon in the header. Contains:

0. **Manage Securities** — at the top of the settings sheet. Lists all current securities; each row has a **grip handle** (six-dot GripVertical icon) for drag-to-reorder, a refresh icon (re-fetches historical data from Alpha Vantage), and a trash icon (delete; disabled when only one remains; requires inline confirmation). Dragging a row reorders the list immediately and persists via `POST /api/securities/reorder`; the new order is reflected in all dropdowns. Below the list, an "Add Security" form: Ticker (auto-uppercased), Name, Template (dropdown of existing tickers), and an Add button. Adding auto-fetches the CSV from Alpha Vantage if not already present. After add/remove, the securities list in the header refreshes; if the active ticker was removed, the app switches to the first remaining one.
1. **Color Theme** — selector for the four available themes; applied immediately on selection.
2. **Input Source** — toggle between CSV (local files) and API (live Alpha Vantage / FRED). Persisted in localStorage.
3. **Default Cash Rate** — annual cash yield rate (decimal, e.g., 0.04). Per-security, saved to `securities_config.json`.
4. **Default Starting Position** — radio: Invested or Not Invested. Per-security, saved to `securities_config.json`.
5. **Enabled Factors** — checkboxes for all 10 factors, grouped under "Sell Factors" and "Buy Factors". Checked = enabled. Persisted via `ignore` flag per parameter in `securities_config.json`; tabs initialize from these on page load.
6. **Default Parameter Values** — inputs to set the default parameter values that pre-fill the Current Signal tab on page load. Includes all 10 params. Edits are local until "Save Permanently" is clicked.
7. **Default Backtester Ranges** — min/max/step inputs for each of the 10 strategy parameters, pre-filling the Backtester tab's range grid on page load. Edits are local until "Save Permanently" is clicked.
8. **Save Permanently** — button at the bottom. POSTs changes to `POST /api/config`, which writes `api/securities_config.json` to disk. Button shows: "Save Permanently" (idle), "Saving…" (in-flight), "Saved!" (success, reverts after 2 s), "Error — try again" (failure).

**Persistence split**:
- Theme and Input Source are persisted in `localStorage`.
- Cash Rate, Starting Position, Disabled Factors, Default Parameters, and Default Backtester Ranges are persisted in `api/securities_config.json` via the API (per-security). They are **not** stored in `localStorage`.

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
  sell_triggers: { CHG4: ParamConfig; RET3: ParamConfig; YIELD10_CHG4: ParamConfig; YIELD2_CHG4: ParamConfig; CURVE_CHG4: ParamConfig }
  buy_conditions: { MA: ParamConfig; DROP: ParamConfig; SPREAD_DELTA: ParamConfig; YIELD10_DELTA: ParamConfig }
}
```

### Data flow
`App.tsx` holds `config: AppConfig | null` state, loaded from `GET /api/config` on ticker change. It derives `defaultStrategyParams`, `defaultRanges`, `defaultDisabledFactors`, and `paramDescriptions` from the config and passes them as props to each tab. `SettingsSheet` receives `config`, `onSaveConfig`, `securities`, `onAddSecurity`, `onRemoveSecurity`, and `onFetchData` props. `handleFetchData` in App.tsx calls `updateSecurityData`, then resets startDate/endDate and reloads dateRange when the updated ticker matches the current one. `lastConfigRef` (useRef) holds the last non-null config so SettingsSheet is rendered outside the `config &&` gate and never unmounts during ticker reload. `dateRangeError` state captures failures from `getDateRange`; passed to Header as optional `dateRangeError?: string | null` prop and displayed inline next to the date pickers. `hideDates` optional bool prop hides date pickers when active tab is `'signals'` or `'walkforward'`.

---

## Deployment

- Runs on `localhost` — pre-built static frontend + FastAPI backend on port 8000.
- Accessible from other devices on the local network (bound to `0.0.0.0`). No authentication required.
- **No cloud hosting planned.**
- `serve.bat` — launches pre-built frontend + backend on port 8000 (normal use).
- `start-prod.bat` — rebuilds frontend then serves on port 8000 (use after frontend changes).
