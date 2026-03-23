export interface StrategyParams {
  MA: number
  DROP: number
  CHG4: number
  RET3: number
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
  spread_delta_history?: number[] | null
  yield10_chg4?: number | null
  yield2_chg4?: number | null
  curve_chg4?: number | null
  yield_curve?: number | null
  curve_4wk_ago?: number | null
  yield10_delta?: number | null
  yield10_delta_history?: number[] | null
  spread_drop?: number | null
  spread_4wk_peak?: number | null
  last_date: string
  close: number
}

export interface SignalResponse {
  signal: 'BUY' | 'SELL' | 'HOLD'
  metrics: SignalMetrics
  trade_history: TradeEvent[]
  apy: number
  final_value: number
  data_start: string
  data_end: string
}

export interface OptimizerRequest {
  ticker: string
  MA: number[]
  DROP: number[]
  CHG4: number[]
  RET3: number[]
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

export type OptimizerGrids = Pick<OptimizerRequest, 'MA' | 'DROP' | 'CHG4' | 'RET3' | 'YIELD10_CHG4' | 'YIELD2_CHG4' | 'CURVE_CHG4' | 'SPREAD_DELTA' | 'YIELD10_DELTA'>

export interface ParamRange { min: number; max: number; step: number }

// ParamRanges: one entry per strategy parameter
export interface ParamRanges {
  MA: ParamRange
  DROP: ParamRange
  CHG4: ParamRange
  RET3: ParamRange
  YIELD10_CHG4: ParamRange
  YIELD2_CHG4: ParamRange
  CURVE_CHG4: ParamRange
  SPREAD_DELTA: ParamRange
  YIELD10_DELTA: ParamRange
}

// New config structure — mirrors securities_config.json
export interface ParamConfig {
  description: string
  ignore: boolean
  default: number
  range: ParamRange
}

export interface AppConfig {
  name: string
  cash_rate: number
  cash_vehicle: string
  start_invested: 0 | 1
  sell_triggers: {
    CHG4: ParamConfig
    RET3: ParamConfig
    YIELD10_CHG4: ParamConfig
    YIELD2_CHG4: ParamConfig
    CURVE_CHG4: ParamConfig
  }
  buy_conditions: {
    MA: ParamConfig
    DROP: ParamConfig
    SPREAD_DELTA: ParamConfig
    YIELD10_DELTA: ParamConfig
  }
}

export interface Settings {
  theme: string
  inputType: 'csv' | 'api'
}

// ---------------------------------------------------------------------------
// Walk-forward types
// ---------------------------------------------------------------------------

export interface WalkForwardRequest {
  ticker: string
  input_type: string
  window_size_months: number
  window_type: 'anchored' | 'rolling'
  initial_training_months: number
  training_window_months: number
  mode: 'validate' | 'discover'
  apy_tolerance_bps: number
  max_combinations: number
  seed_source: 'saved' | 'previous'
}

export interface ValidateWindowResult {
  test_start: string
  test_end: string
  strategy_apy: number | null
  buyhold_apy: number | null
  edge: number | null
  trades: number
  stdev_strategy: number | null
  stdev_buyhold: number | null
  is_partial: boolean
}

export interface DiscoverWindowResult {
  train_start: string
  train_end: string
  test_start: string
  test_end: string
  active_factors: string[]
  key_params: Record<string, number>
  insample_apy: number | null
  outsample_apy: number | null
  buyhold_apy: number | null
  edge: number | null
  trades: number
  is_partial: boolean
}

export interface FactorStability {
  survived: number
  total: number
}

export interface WalkForwardResponse {
  mode: string
  validate_results?: ValidateWindowResult[]
  discover_results?: DiscoverWindowResult[]
  factor_stability?: Record<string, FactorStability>
}
