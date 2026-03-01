import pandas as pd
from strategy_base import BaseStrategy


class SpreadStrategy(BaseStrategy):
    """
    Shared credit-spread strategy logic for high-yield bond ETFs.

    SELL if ANY:
        - spread > SPREAD_LVL
        - chg4 > CHG4_THR
        - ret3 < RET3_THR

    BUY if ALL (and only after a prior SELL):
        - close > MA
        - last 2 weekly spread deltas are negative
        - spread <= recent 4-week peak * (1 - DROP)

    Subclasses (SPHYStrategy, SHYMStrategy, etc.) inherit this logic and
    may override evaluate_sell / evaluate_buy if their rules diverge.
    """

    def __init__(self, MA_LENGTH, DROP, CHG4_THR, RET3_THR, SPREAD_LVL):
        self.MA_LENGTH = MA_LENGTH
        self.DROP = DROP
        self.CHG4_THR = CHG4_THR
        self.RET3_THR = RET3_THR
        self.SPREAD_LVL = SPREAD_LVL

    def evaluate_sell(self, row: pd.Series, df: pd.DataFrame, idx) -> bool:
        c1 = (not pd.isna(row["Spread"])) and (row["Spread"] > self.SPREAD_LVL)
        c2 = (not pd.isna(row["chg4"])) and (row["chg4"] > self.CHG4_THR)
        c3 = (not pd.isna(row["ret3"])) and (row["ret3"] < self.RET3_THR)
        return c1 or c2 or c3

    def evaluate_buy(self, row: pd.Series, df: pd.DataFrame, idx, last_action_was_sell: bool) -> bool:
        if not last_action_was_sell:
            return False

        ma_col = f"MA{self.MA_LENGTH}"
        if pd.isna(row[ma_col]):
            return False

        cond1 = row["close"] > row[ma_col]

        past = df.loc[:idx]
        if len(past) < 3:
            return False

        deltas = past["spread_delta"].tail(2)
        cond2 = (deltas < 0).all()

        spreads = past["Spread"].iloc[-4:]
        recent_peak = spreads.max()
        if pd.isna(recent_peak) or pd.isna(row["Spread"]):
            return False

        cond3 = row["Spread"] <= recent_peak * (1 - self.DROP)

        return bool(cond1 and cond2 and cond3)
