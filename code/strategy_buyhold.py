import pandas as pd
from strategy_base import BaseStrategy

class BuyAndHoldStrategy(BaseStrategy):
    """
    Buy-and-hold strategy:
    - Always fully invested
    - Never triggers buy or sell signals
    - Works with the existing Backtester without special cases
    """

    def evaluate_buy(self, row: pd.Series, df: pd.DataFrame, idx, last_action_was_sell: bool) -> bool:
        # Buy-and-hold never generates a buy signal
        return False

    def evaluate_sell(self, row: pd.Series, df: pd.DataFrame, idx) -> bool:
        # Buy-and-hold never generates a sell signal
        return False

    def run(self, df, start_invested=1):
        # Start_invested should have no effect — always fully invested
        n = len(df)
        positions = [1] * n

        # No trades ever occur in buy-and-hold
        buys = []
        sells = []

        return positions, buys, sells
