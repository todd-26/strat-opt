from strategy_spread import SpreadStrategy


class SHYMStrategy(SpreadStrategy):
    """
    SHYM (SPDR Bloomberg High Yield Municipal Bond ETF) trading strategy.
    Inherits credit-spread rules from SpreadStrategy.
    Override evaluate_sell / evaluate_buy here if SHYM rules diverge from SPHY.
    """
    pass
