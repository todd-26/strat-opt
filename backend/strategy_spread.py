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
    may override _compute_signals() if their rules diverge.
    """

    def __init__(self, MA_LENGTH, DROP, CHG4_THR, RET3_THR, SPREAD_LVL):
        self.MA_LENGTH = MA_LENGTH
        self.DROP = DROP
        self.CHG4_THR = CHG4_THR
        self.RET3_THR = RET3_THR
        self.SPREAD_LVL = SPREAD_LVL

    # ------------------------------------------------------------------
    # Abstract method implementations (satisfy BaseStrategy contract)
    # ------------------------------------------------------------------

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
        cond2 = (past["spread_delta"].tail(2) < 0).all()
        spreads = past["Spread"].iloc[-4:]
        recent_peak = spreads.max()
        if pd.isna(recent_peak) or pd.isna(row["Spread"]):
            return False
        cond3 = row["Spread"] <= recent_peak * (1 - self.DROP)
        return bool(cond1 and cond2 and cond3)

    # ------------------------------------------------------------------
    # Vectorized signal computation — override in subclasses if rules differ
    # ------------------------------------------------------------------

    def _compute_signals(self, df: pd.DataFrame):
        """
        Pre-compute sell and buy signals across the entire DataFrame at once.

        Returns
        -------
        sell_mask : numpy bool array  — True where a sell should fire
        buy_mask  : numpy bool array  — True where a buy should fire (ignoring
                                        state; the run() loop enforces "after sell")
        """
        ma_col = f"MA{self.MA_LENGTH}"

        # Sell: any condition true. NaN comparisons return False naturally.
        sell_mask = (
            (df["Spread"] > self.SPREAD_LVL) |
            (df["chg4"]   > self.CHG4_THR)   |
            (df["ret3"]   < self.RET3_THR)
        ).fillna(False).to_numpy()

        # Buy: all conditions true.
        #   cond1 — price above MA
        #   cond2 — both of the last 2 spread deltas are negative
        #           (rolling max of 2 < 0 means both are negative)
        #   cond3 — spread has dropped enough from its 4-week peak
        #           (rolling max of 4 includes the current row)
        buy_mask = (
            (df["close"] > df[ma_col]) &
            (df["spread_delta"].rolling(2).max() < 0) &
            (df["Spread"] <= df["Spread"].rolling(4).max() * (1 - self.DROP))
        ).fillna(False).to_numpy()

        return sell_mask, buy_mask

    # ------------------------------------------------------------------
    # Strategy loop — overrides BaseStrategy's row-by-row implementation
    # ------------------------------------------------------------------

    def run(self, df: pd.DataFrame, start_invested: int = 1):
        """
        Vectorized strategy loop.

        Signals are computed in bulk (pandas/numpy, C-speed), then the
        state machine walks numpy bool arrays — no per-row DataFrame access.
        """
        sell_mask, buy_mask = self._compute_signals(df)
        index = df.index

        invested = int(start_invested)
        was_sold = (start_invested == 0)
        positions = []
        buy_dates = []
        sell_dates = []

        for i in range(len(df)):
            if invested:
                if sell_mask[i]:
                    invested = 0
                    was_sold = True
                    sell_dates.append(index[i])
            else:
                if was_sold and buy_mask[i]:
                    invested = 1
                    buy_dates.append(index[i])
            positions.append(invested)

        return positions, buy_dates, sell_dates
