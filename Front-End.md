# Front-End Specification

## Overview

A React/Vite single-page application that provides a polished, professional interface for running the strat-opt strategy tools. Runs on localhost initially; designed to be accessible from other devices on the local network without any changes. A local Python backend (FastAPI recommended) serves as the API layer between the UI and the existing Python pipeline.

---

## Visual Style

**Default theme**: Neutral/corporate — light background, slate gray, white, and teal accents. Structured, data-focused, and businesslike (similar to Morningstar or a wealth management tool). Not flashy.

**Typography**: Clean sans-serif (e.g., Inter). Comfortable line height. Data tables use monospace or tabular number rendering for alignment.

**Themes**: The default is slate gray + white + teal. Additional themes are selectable in Settings:
- Navy + white + gold (classic finance)
- Charcoal + white + green (buy/sell signal-friendly)
- Dark mode (dark background, light text, colored accents)
- High contrast (strong black/white, maximum readability)

Themes are applied globally and persisted in localStorage.

---

## Layout

### Header
A persistent top header containing:
- App name on the left (e.g., **strat-opt**)
- Currently selected security as a badge next to the name (e.g., `SPHY`)
- Gear icon on the right to open Settings

### Tab Navigation
Below the header: a single row of tabs, one per run type:
- **Optimizer**
- **Buy & Hold**
- **Current Signal**

Each tab has its own independent state (parameters, results).

### Parameter Panel (per tab)
Each tab has a collapsible parameter panel. It starts expanded. After a run completes successfully, it collapses automatically so results get full focus. The user can re-expand it at any time.

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

**Export**: CSV download of the full results table. PNG export of the chart.

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

**Right — Trade History**:
A simple table of all historical buy/sell events with columns:
- Date
- Action (Buy / Sell)
- Price
- Key metric values at the time of the signal

**Export**: CSV download of the trade history table.

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

---

## Settings (Gear Icon → Modal or Slide-over Panel)

Accessible via the gear icon in the header. Contains:

1. **Color Theme** — radio or card selector for the four available themes; applied immediately on selection.
2. **Input Source** — toggle between CSV (local files) and API (live Alpha Vantage / FRED).
3. **Default Cash Rate** — annual cash yield rate (decimal, e.g., 0.04).
4. **Default Starting Position** — radio: Invested or Cash.
5. **Default Parameter Values** — inputs to set the default parameter values that pre-fill the Current Signal tab on page load. Edits are local until "Save Permanently" is clicked.
6. **Default Optimizer Ranges** — min/max/step inputs for each of the 5 strategy parameters, pre-filling the Optimizer tab's range grid on page load. Edits are local until "Save Permanently" is clicked.
7. **Save Permanently** — button at the bottom. POSTs `defaultParams` and `defaultRanges` to `POST /api/config`, which writes `api/config.json` to disk. Button shows: "Save Permanently" (idle), "Saving…" (in-flight), "Saved!" (success, reverts after 2 s), "Error — try again" (failure).

**Persistence split**:
- Theme, Input Source, Cash Rate, Starting Position are persisted in `localStorage`.
- Default Parameters and Default Optimizer Ranges are persisted in `api/config.json` via the API. They are **not** stored in `localStorage`.

---

## Config File and API

### `api/config.json`
Server-side JSON file storing the two sets of editable defaults. Created on first save; a hardcoded fallback is used if the file is absent.

```json
{
  "defaultParams": {
    "MA": 50, "DROP": 0.017, "CHG4": 0.165, "RET3": -0.021, "SPREAD_LVL": 7.0
  },
  "defaultRanges": {
    "MA":         { "min": 50,      "max": 50,      "step": 5      },
    "DROP":       { "min": 0.016,   "max": 0.016,   "step": 0.001  },
    "CHG4":       { "min": 0.16,    "max": 0.16,    "step": 0.005  },
    "RET3":       { "min": -0.0225, "max": -0.0225, "step": 0.0005 },
    "SPREAD_LVL": { "min": 7.0,     "max": 7.0,     "step": 0.1    }
  }
}
```

### `GET /api/config`
Returns the contents of `api/config.json`. Falls back to hardcoded defaults if the file does not exist.

### `POST /api/config`
Accepts an `AppConfig` body and writes it to `api/config.json`. Returns `{"ok": true}`.

### TypeScript types
`ParamRange`, `ParamRanges`, and `AppConfig` are defined in `frontend/src/types/index.ts`:
```typescript
interface ParamRange { min: number; max: number; step: number }
interface ParamRanges { MA: ParamRange; DROP: ParamRange; CHG4: ParamRange; RET3: ParamRange; SPREAD_LVL: ParamRange }
interface AppConfig { defaultParams: StrategyParams; defaultRanges: ParamRanges }
```
`ParameterPanel.tsx` re-exports `ParamRange` and `ParamRanges` for backwards compatibility.

### Data flow
`App.tsx` holds `config` state (initialized to fallback, updated from `GET /api/config` on mount). It passes `config.defaultParams` to `SignalTab` and `config.defaultRanges` to `OptimizerTab` as props. `SettingsSheet` receives `config` and `onSaveConfig` to support editing and saving.

---

## Security / Multi-Security

- A security **dropdown** is present in the UI from day one, pre-populated with SPHY only.
- The selected security is shown as a badge in the header.
- The architecture should not hardcode SPHY in the UI logic — the dropdown drives the selection, making it straightforward to add more securities later.

---

## Deployment

- **Initial**: Runs on `localhost` — React dev server (or built static files) + Python backend on a local port.
- **Near-term**: Accessible from other devices on the local network by binding to `0.0.0.0`. No authentication required.
- **No cloud hosting planned.** Keep deployment simple — a single `start.bat` or similar script to launch both the backend and frontend is desirable.
