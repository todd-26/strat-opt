export interface StrategyParams {
  MA: number
  DROP: number
  CHG4: number
  RET3: number
  SPREAD_LVL: number
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
  APY: number
  final_value: number
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
}

export interface OptimizerRequest {
  ticker: string
  MA: number[]
  DROP: number[]
  CHG4: number[]
  RET3: number[]
  SPREAD_LVL: number[]
  start_invested: number
  cash_rate: number
  input_type: string
}

export interface ParamRange { min: number; max: number; step: number }
export interface ParamRanges {
  MA: ParamRange
  DROP: ParamRange
  CHG4: ParamRange
  RET3: ParamRange
  SPREAD_LVL: ParamRange
}
export interface AppConfig { defaultParams: StrategyParams; defaultRanges: ParamRanges }

export interface Settings {
  theme: string
  inputType: 'csv' | 'api'
  cashRate: number
  startInvested: 0 | 1
}
