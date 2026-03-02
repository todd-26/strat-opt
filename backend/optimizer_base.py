import pandas as pd
import itertools
from abc import ABC, abstractmethod
from pathlib import Path

from data_loader import WeeklyDataLoader
from indicators import IndicatorEngine
from backtester import Backtester


class BaseOptimizer(ABC):
    """
    Shared grid-search optimizer for credit-spread strategies.

    Subclasses must implement _create_strategy() to return the appropriate
    strategy instance for their security. Each subclass also sets its own
    default parameter grids.

    Parameters
    ----------
    input_type : str
        'csv' or 'api'
    input_dir : Path
        Directory containing CSV inputs.
    cash_rate : float
        Annualized cash rate.
    param_grids : dict, optional
        Override any of the default grids. Keys: 'MA', 'DROP', 'CHG4', 'RET3', 'SPREAD_LVL'.
    """

    def __init__(self, input_type: str, input_dir: Path, cash_rate: float, param_grids: dict = None):
        self.input_type = input_type
        self.input_dir = input_dir
        self.cash_rate = cash_rate

        if param_grids:
            if "MA" in param_grids:
                self.MA_grid = param_grids["MA"]
            if "DROP" in param_grids:
                self.DROP_grid = param_grids["DROP"]
            if "CHG4" in param_grids:
                self.CHG4_grid = param_grids["CHG4"]
            if "RET3" in param_grids:
                self.RET3_grid = param_grids["RET3"]
            if "SPREAD_LVL" in param_grids:
                self.SPREAD_grid = param_grids["SPREAD_LVL"]

    @abstractmethod
    def _create_strategy(self, MA, DROP, CHG4, RET3, SPREAD_LVL):
        """Return a strategy instance for this security."""
        pass

    def run(self, ticker: str, start_invested: int = 1, progress_callback=None):
        """
        Executes the full grid search.

        Returns
        -------
        best_params : dict
        results_df : DataFrame
        best_result : dict
        """
        loader = WeeklyDataLoader(self.input_type, self.input_dir, ticker)
        df = loader.load()

        results = []
        total = (len(self.MA_grid) * len(self.DROP_grid) * len(self.CHG4_grid) *
                 len(self.RET3_grid) * len(self.SPREAD_grid))
        current = 0

        for MA, DROP, CHG4, RET3, SPREAD_LVL in itertools.product(
            self.MA_grid,
            self.DROP_grid,
            self.CHG4_grid,
            self.RET3_grid,
            self.SPREAD_grid,
        ):
            df_ind = IndicatorEngine.apply_all(df.copy(), MA)
            strat = self._create_strategy(MA, DROP, CHG4, RET3, SPREAD_LVL)
            positions, buys, sells = strat.run(df_ind, start_invested=start_invested)

            bt = Backtester(self.cash_rate)
            bt_result = bt.run(df_ind, positions, buys, sells)

            results.append({
                "MA": MA,
                "DROP": DROP,
                "CHG4": CHG4,
                "RET3": RET3,
                "SPREAD_LVL": SPREAD_LVL,
                "APY": bt_result["apy"],
                "final_value": bt_result["final_value"],
                "trade_count": len(sells),
            })

            current += 1
            if progress_callback is not None:
                progress_callback(current, total)

        results_df = pd.DataFrame(results)
        results_df["MA"] = results_df["MA"].apply(int)

        best_row = results_df.loc[results_df["APY"].idxmax()]
        best_params = {
            "MA": int(best_row["MA"]),
            "DROP": best_row["DROP"],
            "CHG4": best_row["CHG4"],
            "RET3": best_row["RET3"],
            "SPREAD_LVL": best_row["SPREAD_LVL"],
        }

        df_best = IndicatorEngine.apply_all(df.copy(), best_params["MA"])
        best_strat = self._create_strategy(
            best_params["MA"],
            best_params["DROP"],
            best_params["CHG4"],
            best_params["RET3"],
            best_params["SPREAD_LVL"],
        )
        positions, buys, sells = best_strat.run(df_best, start_invested=start_invested)
        bt = Backtester(self.cash_rate)
        best_result = bt.run(df_best, positions, buys, sells)

        return best_params, results_df, best_result
