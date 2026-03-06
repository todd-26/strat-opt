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

    def __init__(self, MA_LENGTH, DROP, CHG4_THR, RET3_THR, SPREAD_LVL,
                 YIELD10_CHG4_THR=0, YIELD2_CHG4_THR=0, CURVE_CHG4_THR=0,
                 SPREAD_DELTA_N=2, YIELD10_DELTA_N=2, disabled=()):
        self.MA_LENGTH = MA_LENGTH
        self.DROP = DROP
        self.CHG4_THR = CHG4_THR
        self.RET3_THR = RET3_THR
        self.SPREAD_LVL = SPREAD_LVL
        self.YIELD10_CHG4_THR = YIELD10_CHG4_THR
        self.YIELD2_CHG4_THR = YIELD2_CHG4_THR
        self.CURVE_CHG4_THR = CURVE_CHG4_THR
        self.SPREAD_DELTA_N = int(SPREAD_DELTA_N)
        self.YIELD10_DELTA_N = int(YIELD10_DELTA_N)
        self.disabled = set(disabled)

    # ------------------------------------------------------------------
    # Abstract method implementations (satisfy BaseStrategy contract)
    # ------------------------------------------------------------------

    def evaluate_sell(self, row: pd.Series, df: pd.DataFrame, idx) -> bool:
        c1 = False if "SPREAD_LVL" in self.disabled else ((not pd.isna(row["Spread"])) and (row["Spread"] > self.SPREAD_LVL))
        c2 = False if "CHG4" in self.disabled else ((not pd.isna(row["chg4"])) and (row["chg4"] > self.CHG4_THR))
        c3 = False if "RET3" in self.disabled else ((not pd.isna(row["ret3"])) and (row["ret3"] < self.RET3_THR))
        c4 = False if "YIELD10_CHG4" in self.disabled else ((not pd.isna(row["yield10_chg4"])) and (row["yield10_chg4"] > self.YIELD10_CHG4_THR))
        c5 = False if "YIELD2_CHG4" in self.disabled else ((not pd.isna(row["yield2_chg4"])) and (row["yield2_chg4"] > self.YIELD2_CHG4_THR))
        c6 = False if "CURVE_CHG4" in self.disabled else ((not pd.isna(row["curve_chg4"])) and (row["curve_chg4"] < -self.CURVE_CHG4_THR))
        return c1 or c2 or c3 or c4 or c5 or c6

    def evaluate_buy(self, row: pd.Series, df: pd.DataFrame, idx, last_action_was_sell: bool) -> bool:
        if not last_action_was_sell:
            return False
        ma_col = f"MA{self.MA_LENGTH}"
        if "MA" not in self.disabled and pd.isna(row[ma_col]):
            return False
        cond1 = True if "MA" in self.disabled else (row["close"] > row[ma_col])
        past = df.loc[:idx]
        if len(past) < 3:
            return False
        cond2 = True if "SPREAD_DELTA" in self.disabled else (past["spread_delta"].tail(self.SPREAD_DELTA_N) < 0).all()
        spreads = past["Spread"].iloc[-4:]
        recent_peak = spreads.max()
        if "DROP" not in self.disabled and (pd.isna(recent_peak) or pd.isna(row["Spread"])):
            return False
        cond3 = True if "DROP" in self.disabled else (row["Spread"] <= recent_peak * (1 - self.DROP))
        cond4 = True if "YIELD10_DELTA" in self.disabled else (past["yield10_delta"].tail(self.YIELD10_DELTA_N) < 0).all()
        return bool(cond1 and cond2 and cond3 and cond4)

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

        # Sell: any condition true. Disabled factors → False (never trigger).
        sell_spread      = pd.Series(False, index=df.index) if "SPREAD_LVL" in self.disabled else (df["Spread"] > self.SPREAD_LVL)
        sell_chg4        = pd.Series(False, index=df.index) if "CHG4" in self.disabled else (df["chg4"] > self.CHG4_THR)
        sell_ret3        = pd.Series(False, index=df.index) if "RET3" in self.disabled else (df["ret3"] < self.RET3_THR)
        sell_yield10_chg4 = pd.Series(False, index=df.index) if "YIELD10_CHG4" in self.disabled else (df["yield10_chg4"] > self.YIELD10_CHG4_THR)
        sell_yield2_chg4  = pd.Series(False, index=df.index) if "YIELD2_CHG4" in self.disabled else (df["yield2_chg4"] > self.YIELD2_CHG4_THR)
        sell_curve_chg4   = pd.Series(False, index=df.index) if "CURVE_CHG4" in self.disabled else (df["curve_chg4"] < -self.CURVE_CHG4_THR)
        sell_mask = (sell_spread | sell_chg4 | sell_ret3 | sell_yield10_chg4 | sell_yield2_chg4 | sell_curve_chg4).fillna(False).to_numpy()

        # Buy: all conditions true. Disabled factors → True (always pass).
        buy_ma          = pd.Series(True, index=df.index) if "MA" in self.disabled else (df["close"] > df[ma_col])
        buy_delta       = pd.Series(True, index=df.index) if "SPREAD_DELTA" in self.disabled else (df["spread_delta"].rolling(self.SPREAD_DELTA_N).max() < 0)
        buy_drop        = pd.Series(True, index=df.index) if "DROP" in self.disabled else (df["Spread"] <= df["Spread"].rolling(4).max() * (1 - self.DROP))
        buy_yield10_delta = pd.Series(True, index=df.index) if "YIELD10_DELTA" in self.disabled else (df["yield10_delta"].rolling(self.YIELD10_DELTA_N).max() < 0)
        buy_mask = (buy_ma & buy_delta & buy_drop & buy_yield10_delta).fillna(False).to_numpy()

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
                if was_sold and buy_mask[i] and not sell_mask[i]:
                    invested = 1
                    buy_dates.append(index[i])
            positions.append(invested)

        return positions, buy_dates, sell_dates
