import pandas as pd
from strategy_base import BaseStrategy


class SPHYStrategy(BaseStrategy):
    """
    Implements the SPHY trading strategy rules:

    SELL if ANY:
        - Spread > SPREAD_LVL
        - chg4 > CHG4
        - ret3 < RET3

    BUY if ALL:
        - close > MA
        - last 2 weekly spread deltas negative
        - spread <= recent_peak * (1 - DROP)
        (and only after a SELL)

    Parameters are supplied at initialization.
    """

    def __init__(self, MA_LENGTH, DROP, CHG4_THR, RET3_THR, SPREAD_LVL):
        self.MA_LENGTH = MA_LENGTH
        self.DROP = DROP
        self.CHG4_THR = CHG4_THR
        self.RET3_THR = RET3_THR
        self.SPREAD_LVL = SPREAD_LVL

    # ------------------------------------------------------------
    # SELL logic
    # ------------------------------------------------------------
    def evaluate_sell(self, row: pd.Series, df: pd.DataFrame, idx) -> bool:
        """
        SELL if ANY of the following conditions are true:
            1. Spread > SPREAD_LVL
            2. chg4 > CHG4_THR
            3. ret3 < RET3_THR
        """

        # Condition checks must handle NaN safely
        c1 = (not pd.isna(row["Spread"])) and (row["Spread"] > self.SPREAD_LVL)
        c2 = (not pd.isna(row["chg4"])) and (row["chg4"] > self.CHG4_THR)
        c3 = (not pd.isna(row["ret3"])) and (row["ret3"] < self.RET3_THR)

        return c1 or c2 or c3

    # ------------------------------------------------------------
    # BUY logic
    # ------------------------------------------------------------
    def evaluate_buy(self, row: pd.Series, df: pd.DataFrame, idx, last_action_was_sell: bool) -> bool:
        """
        BUY if ALL of the following hold, and only after a SELL event:

            1. close > MA
            2. last 2 weekly spread delta values are negative
            3. spread <= recent 4-week peak * (1 - DROP)
        """

        # Cannot buy before the first SELL event
        if not last_action_was_sell:
            return False

        # Require MA to be defined
        ma_col = f"MA{self.MA_LENGTH}"
        if pd.isna(row[ma_col]):
            return False

        # -----------------------
        # Condition 1: price > MA
        # -----------------------
        cond1 = row["close"] > row[ma_col]

        # ---------------------------------------------------
        # Condition 2: last 2 spread deltas must be negative
        # ---------------------------------------------------
        past = df.loc[:idx]
        if len(past) < 3:
            return False  # need history

        deltas = past["spread_delta"].tail(2)
        cond2 = (deltas < 0).all()

        # ---------------------------------------------------
        # Condition 3: spread drop from recent 4-week peak
        # ---------------------------------------------------
        spreads = past["Spread"].iloc[-4:]  # last 4 weeks
        recent_peak = spreads.max()
        if pd.isna(recent_peak) or pd.isna(row["Spread"]):
            return False

        cond3 = row["Spread"] <= recent_peak * (1 - self.DROP)

        return bool(cond1 and cond2 and cond3)
