from pydantic import BaseModel
from typing import Optional


class StrategyParams(BaseModel):
    MA: int = 50
    DROP: float = 0.017
    CHG4: float = 0.165
    RET3: float = -0.021
    SPREAD_LVL: float = 7.0
    YIELD10_CHG4: float = 0.0
    YIELD2_CHG4: float = 0.0
    CURVE_CHG4: float = 0.0
    SPREAD_DELTA: int = 2
    YIELD10_DELTA: int = 2


class BuyHoldRequest(BaseModel):
    ticker: str = "SPHY"
    cash_rate: float = 0.04
    input_type: str = "csv"
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class SignalRequest(BaseModel):
    ticker: str = "SPHY"
    params: StrategyParams = StrategyParams()
    start_invested: int = 1
    cash_rate: float = 0.04
    input_type: str = "csv"
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    disabled_factors: list[str] = []


class OptimizerRequest(BaseModel):
    ticker: str = "SPHY"
    # Each field is a list of values to test in the grid search
    MA: list[int] = [50]
    DROP: list[float] = [0.017]
    CHG4: list[float] = [0.165]
    RET3: list[float] = [-0.02, -0.0205, -0.021, -0.0215, -0.022]
    SPREAD_LVL: list[float] = [7.0]
    YIELD10_CHG4: list[float] = [0.0]
    YIELD2_CHG4: list[float] = [0.0]
    CURVE_CHG4: list[float] = [0.0]
    SPREAD_DELTA: list[int] = [2]
    YIELD10_DELTA: list[int] = [2]
    start_invested: int = 1
    cash_rate: float = 0.04
    input_type: str = "csv"
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    disabled_factors: list[str] = []


class EquityPoint(BaseModel):
    date: str
    strategy: float


class TradeEvent(BaseModel):
    date: str
    action: str  # "BUY" or "SELL"
    price: float
    spread: Optional[float] = None
    chg4: Optional[float] = None
    ret3: Optional[float] = None
    spread_delta: Optional[float] = None
    ma_value: Optional[float] = None
    # Source data for popup derivations
    spread_4wk_ago: Optional[float] = None   # for chg4 explanation
    close_3wk_ago: Optional[float] = None    # for ret3 explanation
    spread_delta_history: Optional[list[float]] = None  # last N weeks of spread_delta, oldest first
    spread_drop: Optional[float] = None      # 1 - (spread / 4wk_peak) — actual drop %
    spread_4wk_peak: Optional[float] = None  # the 4-week peak used in the calculation
    # Treasury yield indicators
    yield10_chg4: Optional[float] = None
    yield2_chg4: Optional[float] = None
    curve_chg4: Optional[float] = None
    yield10_delta: Optional[float] = None
    # Source data for treasury popup derivations
    yield10_4wk_ago: Optional[float] = None
    yield2_4wk_ago: Optional[float] = None
    curve_4wk_ago: Optional[float] = None
    yield10_delta_history: Optional[list[float]] = None  # last N weeks of yield10_delta, oldest first


class BacktestResult(BaseModel):
    equity_curve: list[EquityPoint]
    buy_dates: list[str]
    sell_dates: list[str]
    trade_history: list[TradeEvent]
    final_value: float
    apy: float


class OptimizerResultRow(BaseModel):
    MA: int
    DROP: float
    CHG4: float
    RET3: float
    SPREAD_LVL: float
    YIELD10_CHG4: float
    YIELD2_CHG4: float
    CURVE_CHG4: float
    SPREAD_DELTA: int
    YIELD10_DELTA: int
    APY: float
    final_value: float
    trade_count: int


class OptimizerResponse(BaseModel):
    best_params: StrategyParams
    best_result: BacktestResult
    all_results: list[OptimizerResultRow]


class SignalMetrics(BaseModel):
    spread: Optional[float] = None
    ma: Optional[float] = None
    ret3: Optional[float] = None
    chg4: Optional[float] = None
    spread_delta: Optional[float] = None
    spread_delta_history: Optional[list[float]] = None
    yield10_chg4: Optional[float] = None
    yield2_chg4: Optional[float] = None
    curve_chg4: Optional[float] = None
    yield_curve: Optional[float] = None
    curve_4wk_ago: Optional[float] = None
    yield10_delta: Optional[float] = None
    yield10_delta_history: Optional[list[float]] = None
    spread_drop: Optional[float] = None
    spread_4wk_peak: Optional[float] = None
    last_date: str
    close: float


class SignalResponse(BaseModel):
    signal: str  # "BUY", "SELL", or "HOLD"
    metrics: SignalMetrics
    trade_history: list[TradeEvent]
    apy: float
    final_value: float
    data_start: str
    data_end: str


class ParamRange(BaseModel):
    min: float
    max: float
    step: float


class DefaultRanges(BaseModel):
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


class ParamDef(BaseModel):
    name: str
    value: float
    desc: str = ""


class DefaultParams(BaseModel):
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


class AppConfig(BaseModel):
    defaultParams: DefaultParams
    defaultRanges: DefaultRanges
    cashRate: float = 0.04
    startInvested: int = 1
    disabledFactors: list[str] = []
