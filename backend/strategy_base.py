from abc import ABC, abstractmethod
import pandas as pd


class BaseStrategy(ABC):
    """
    Abstract base class for all trading strategies.
    
    Strategy lifecycle:
    -------------------
    - evaluate_sell() is checked when invested.
    - evaluate_buy() is checked when not invested.
    - run() loops across weekly rows and produces:
        - positions (0/1 per week)
        - buy_dates
        - sell_dates
    """

    @abstractmethod
    def evaluate_sell(self, row: pd.Series, df: pd.DataFrame, idx) -> bool:
        """
        Return True if a SELL should occur on this row.
        Executed only when currently invested.
        """
        pass

    @abstractmethod
    def evaluate_buy(self, row: pd.Series, df: pd.DataFrame, idx, last_action_was_sell: bool) -> bool:
        """
        Return True if a BUY should occur on this row.
        Executed only when currently out of the market.
        The flag last_action_was_sell ensures that BUYs occur only after a SELL event.
        """
        pass

    # ------------------------------------------------------------
    # Main trading loop used by all strategies
    # ------------------------------------------------------------
    def run(self, df: pd.DataFrame, start_invested: int):
        """
        Core strategy loop for all assets.

        Parameters
        ----------
        df : pd.DataFrame
            Weekly DataFrame with indicators already applied.
        start_invested : int
            1 = start invested
            0 = start in cash

        Returns
        -------
        positions : list[int]
        buy_dates : list[pd.Timestamp]
        sell_dates : list[pd.Timestamp]
        """

        invested = int(start_invested)
        was_sold = False   # Tracks whether we have sold previously
        positions = []
        buy_dates = []
        sell_dates = []

        for idx, row in df.iterrows():

            if invested == 1:
                # Check SELL conditions
                do_sell = self.evaluate_sell(row, df, idx)
                if do_sell:
                    invested = 0
                    was_sold = True
                    sell_dates.append(idx)

            else:
                # Check BUY conditions (only allowed after at least one SELL)
                do_buy = self.evaluate_buy(row, df, idx, was_sold)
                if do_buy:
                    invested = 1
                    buy_dates.append(idx)

            positions.append(invested)

        return positions, buy_dates, sell_dates
