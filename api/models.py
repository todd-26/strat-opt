from pydantic import BaseModel
from typing import Optional


class StrategyParams(BaseModel):
    MA: int = 50
    DROP: float = 0.017
    CHG4: float = 0.165
    RET3: float = -0.021
    SPREAD_LVL: float = 7.0


class BuyHoldRequest(BaseModel):
    ticker: str = "SPHY"
    cash_rate: float = 0.04
    input_type: str = "csv"


class SignalRequest(BaseModel):
    ticker: str = "SPHY"
    params: StrategyParams = StrategyParams()
    start_invested: int = 1
    cash_rate: float = 0.04
    input_type: str = "csv"


class OptimizerRequest(BaseModel):
    ticker: str = "SPHY"
    # Each field is a list of values to test in the grid search
    MA: list[int] = [50]
    DROP: list[float] = [0.017]
    CHG4: list[float] = [0.165]
    RET3: list[float] = [-0.02, -0.0205, -0.021, -0.0215, -0.022]
    SPREAD_LVL: list[float] = [7.0]
    start_invested: int = 1
    cash_rate: float = 0.04
    input_type: str = "csv"


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
    APY: float
    final_value: float


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
    last_date: str
    close: float


class SignalResponse(BaseModel):
    signal: str  # "BUY", "SELL", or "HOLD"
    metrics: SignalMetrics
    trade_history: list[TradeEvent]
    apy: float
    final_value: float


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


class AppConfig(BaseModel):
    defaultParams: DefaultParams
    defaultRanges: DefaultRanges
