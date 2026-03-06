export interface StrategyParams {
  MA: number
  DROP: number
  CHG4: number
  RET3: number
  SPREAD_LVL: number
  YIELD10_CHG4: number
  YIELD2_CHG4: number
  CURVE_CHG4: number
  SPREAD_DELTA: number
  YIELD10_DELTA: number
}

export interface EquityPoint {
  date: string
  strategy: number
}

export interface TradeEvent {
  date: string
  action: 'BUY' | 'SELL'
  price: number
  spread?: number | null
  chg4?: number | null
  ret3?: number | null
  spread_delta?: number | null
  ma_value?: number | null
  spread_4wk_ago?: number | null
  close_3wk_ago?: number | null
  spread_delta_history?: number[] | null
  spread_drop?: number | null
  spread_4wk_peak?: number | null
  yield10_chg4?: number | null
  yield2_chg4?: number | null
  curve_chg4?: number | null
  yield10_delta?: number | null
  yield10_4wk_ago?: number | null
  yield2_4wk_ago?: number | null
  curve_4wk_ago?: number | null
  yield10_delta_history?: number[] | null
}

export interface BacktestResult {
  equity_curve: EquityPoint[]
  buy_dates: string[]
  sell_dates: string[]
  trade_history: TradeEvent[]
  final_value: number
  apy: number
}

export interface OptimizerResultRow {
  MA: number
  DROP: number
  CHG4: number
  RET3: number
  SPREAD_LVL: number
  YIELD10_CHG4: number
  YIELD2_CHG4: number
  CURVE_CHG4: number
  SPREAD_DELTA: number
  YIELD10_DELTA: number
  APY: number
  final_value: number
  trade_count: number
}

export interface OptimizerResponse {
  best_params: StrategyParams
  best_result: BacktestResult
  all_results: OptimizerResultRow[]
}

export interface SignalMetrics {
  spread?: number | null
  ma?: number | null
  ret3?: number | null
  chg4?: number | null
  spread_delta?: number | null
  yield10_chg4?: number | null
  yield2_chg4?: number | null
  curve_chg4?: number | null
  yield10_delta?: number | null
  last_date: string
  close: number
}

export interface SignalResponse {
  signal: 'BUY' | 'SELL' | 'HOLD'
  metrics: SignalMetrics
  trade_history: TradeEvent[]
  apy: number
  final_value: number
}

export interface OptimizerGrids {
  MA: number[]
  DROP: number[]
  CHG4: number[]
  RET3: number[]
  SPREAD_LVL: number[]
  YIELD10_CHG4: number[]
  YIELD2_CHG4: number[]
  CURVE_CHG4: number[]
  SPREAD_DELTA: number[]
  YIELD10_DELTA: number[]
}

export interface OptimizerRequest {
  ticker: string
  MA: number[]
  DROP: number[]
  CHG4: number[]
  RET3: number[]
  SPREAD_LVL: number[]
  YIELD10_CHG4: number[]
  YIELD2_CHG4: number[]
  CURVE_CHG4: number[]
  SPREAD_DELTA: number[]
  YIELD10_DELTA: number[]
  start_invested: number
  cash_rate: number
  input_type: string
  start_date?: string
  end_date?: string
  disabled_factors?: string[]
}

export interface ParamRange { min: number; max: number; step: number }
export interface ParamRanges {
  MA: ParamRange
  DROP: ParamRange
  CHG4: ParamRange
  RET3: ParamRange
  SPREAD_LVL: ParamRange
  YIELD10_CHG4: ParamRange
  YIELD2_CHG4: ParamRange
  CURVE_CHG4: ParamRange
  SPREAD_DELTA: ParamRange
  YIELD10_DELTA: ParamRange
}

export interface ParamDef { name: string; value: number; desc: string }
export interface DefaultParams {
  MA: ParamDef
  DROP: ParamDef
  CHG4: ParamDef
  RET3: ParamDef
  SPREAD_LVL: ParamDef
  YIELD10_CHG4: ParamDef
  YIELD2_CHG4: ParamDef
  CURVE_CHG4: ParamDef
  SPREAD_DELTA: ParamDef
  YIELD10_DELTA: ParamDef
}
export interface AppConfig {
  defaultParams: DefaultParams
  defaultRanges: ParamRanges
  cashRate: number
  startInvested: 0 | 1
  disabledFactors: string[]
}

export interface Settings {
  theme: string
  inputType: 'csv' | 'api'
}
