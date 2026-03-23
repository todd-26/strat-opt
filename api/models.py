from pydantic import BaseModel
from typing import Optional


class StrategyParams(BaseModel):
    MA: int
    DROP: float
    CHG4: float
    RET3: float
    YIELD10_CHG4: float
    YIELD2_CHG4: float
    CURVE_CHG4: float
    SPREAD_DELTA: int
    YIELD10_DELTA: int


class BuyHoldRequest(BaseModel):
    ticker: str
    cash_rate: float = 0.04
    input_type: str = "csv"
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class SignalRequest(BaseModel):
    ticker: str
    params: StrategyParams
    start_invested: int = 1
    cash_rate: float = 0.04
    input_type: str = "csv"
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    disabled_factors: list[str] = []


class OptimizerRequest(BaseModel):
    ticker: str
    MA: list[int]
    DROP: list[float]
    CHG4: list[float]
    RET3: list[float]
    YIELD10_CHG4: list[float]
    YIELD2_CHG4: list[float]
    CURVE_CHG4: list[float]
    SPREAD_DELTA: list[int]
    YIELD10_DELTA: list[int]
    start_invested: int
    cash_rate: float
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
    spread_4wk_ago: Optional[float] = None
    close_3wk_ago: Optional[float] = None
    spread_delta_history: Optional[list[float]] = None
    spread_drop: Optional[float] = None
    spread_4wk_peak: Optional[float] = None
    # Treasury yield indicators
    yield10_chg4: Optional[float] = None
    yield2_chg4: Optional[float] = None
    curve_chg4: Optional[float] = None
    yield10_delta: Optional[float] = None
    # Source data for treasury popup derivations
    yield10_4wk_ago: Optional[float] = None
    yield2_4wk_ago: Optional[float] = None
    curve_4wk_ago: Optional[float] = None
    yield10_delta_history: Optional[list[float]] = None


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


# ---------------------------------------------------------------------------
# Config models — mirrors securities_config.json structure
# ---------------------------------------------------------------------------

class ParamRange(BaseModel):
    min: float
    max: float
    step: float


class ParamConfig(BaseModel):
    description: str
    ignore: bool
    default: float
    range: ParamRange


class AppConfig(BaseModel):
    """Per-security config returned by GET /api/config and accepted by POST /api/config."""
    name: str
    cash_rate: float
    cash_vehicle: str
    start_invested: int = 1
    sell_triggers: dict[str, ParamConfig]
    buy_conditions: dict[str, ParamConfig]


class AddSecurityRequest(BaseModel):
    ticker: str
    name: str
    template: str  # ticker to copy parameters from


class ReorderSecuritiesRequest(BaseModel):
    tickers: list[str]


# ---------------------------------------------------------------------------
# Walk-forward models
# ---------------------------------------------------------------------------

class WalkForwardRequest(BaseModel):
    ticker: str
    input_type: str = "csv"
    window_size_months: int = 12
    window_type: str = "anchored"          # "anchored" | "rolling"
    initial_training_months: int = 36      # anchored only
    training_window_months: int = 36       # rolling only
    mode: str = "validate"                 # "validate" | "discover"
    # Discover-specific
    apy_tolerance_bps: float = 10.0
    max_combinations: int = 3000
    seed_source: str = "saved"             # "saved" | "previous"


class ValidateWindowResult(BaseModel):
    test_start: str
    test_end: str
    strategy_apy: Optional[float] = None
    buyhold_apy: Optional[float] = None
    edge: Optional[float] = None
    trades: int
    stdev_strategy: Optional[float] = None
    stdev_buyhold: Optional[float] = None
    is_partial: bool


class DiscoverWindowResult(BaseModel):
    train_start: str
    train_end: str
    test_start: str
    test_end: str
    active_factors: list[str]
    key_params: dict
    insample_apy: Optional[float] = None
    outsample_apy: Optional[float] = None
    buyhold_apy: Optional[float] = None
    edge: Optional[float] = None
    trades: int
    is_partial: bool


class FactorStability(BaseModel):
    survived: int
    total: int


class WalkForwardResponse(BaseModel):
    mode: str
    validate_results: Optional[list[ValidateWindowResult]] = None
    discover_results: Optional[list[DiscoverWindowResult]] = None
    factor_stability: Optional[dict[str, FactorStability]] = None
