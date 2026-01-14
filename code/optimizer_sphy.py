import pandas as pd
import itertools
from pathlib import Path

from data_loader import WeeklyDataLoader
from indicators import IndicatorEngine
from strategy_sphy import SPHYStrategy
from backtester import Backtester


class SPHYOptimizer:
    """
    Grid-search optimizer for the SPHY strategy.

    Parameters
    ----------
    input_type : str
        'csv' or 'api'
    input_dir : Path
        Directory containing CSV inputs.
    cash_rate : float
        Annualized cash rate (same as strategy).
    """

    def __init__(self, input_type: str, input_dir: Path, cash_rate: float):
        self.input_type = input_type
        self.input_dir = input_dir
        self.cash_rate = cash_rate

        # Fixed grids you approved
        self.MA_grid = [40, 45, 50, 55, 60]
        self.DROP_grid = [0.03, 0.04, 0.05]
        self.CHG4_grid = [0.15, 0.18, 0.20]
        self.RET3_grid = [-0.015, -0.02, -0.025]
        self.SPREAD_grid = [7.0, 7.2, 7.4, 7.6, 7.8]

        # this was my last test with the winner of 50, .017, .165, -0.021, 7.0
        self.MA_grid = [50]
        self.DROP_grid = [0.017]
        self.CHG4_grid = [0.165]
        self.RET3_grid =  [-0.02, -0.0205, -0.021, -0.0215, -0.022]
        self.SPREAD_grid = [7.0]

    # ------------------------------------------------------------
    # Full optimization run
    # ------------------------------------------------------------
    def run(self, ticker: str, start_invested: int = 1):
        """
        Executes the full grid search.

        Parameters
        ----------
        start_invested : int
            1 = start invested
            0 = start in cash

        Returns
        -------
        best_params : dict
        results_df : DataFrame
        best_result : dict (full backtest dict for best parameters)
        """

        # Load merged weekly dataset
        loader = WeeklyDataLoader(self.input_type, self.input_dir, ticker)
        df = loader.load()

        results = []

        # Cartesian product of all parameter sets
        for MA, DROP, CHG4, RET3, SPREAD_LVL in itertools.product(
            self.MA_grid,
            self.DROP_grid,
            self.CHG4_grid,
            self.RET3_grid,
            self.SPREAD_grid
        ):
            # Apply indicators
            df_ind = df.copy()
            df_ind = IndicatorEngine.apply_all(df_ind, MA)

            # Instantiate strategy
            strat = SPHYStrategy(
                MA_LENGTH=MA,
                DROP=DROP,
                CHG4_THR=CHG4,
                RET3_THR=RET3,
                SPREAD_LVL=SPREAD_LVL
            )

            # Obtain positions
            positions, buys, sells = strat.run(df_ind, start_invested=start_invested)

            # Backtest
            bt = Backtester(self.cash_rate)
            bt_result = bt.run(df_ind, positions, buys, sells)

            apy = bt_result["apy"]

            results.append({
                "MA": MA,
                "DROP": DROP,
                "CHG4": CHG4,
                "RET3": RET3,
                "SPREAD_LVL": SPREAD_LVL,
                "APY": apy,
            })

        results_df = pd.DataFrame(results)
        results_df["MA"] = results_df["MA"].apply(int)

        # Find best parameters (max APY)
        best_row = results_df.loc[results_df["APY"].idxmax()]
        # ignore the warning about possible precision loss from float to int. It is not correct.
        best_params = {
            "MA": int(best_row["MA"]),
            "DROP": best_row["DROP"],
            "CHG4": best_row["CHG4"],
            "RET3": best_row["RET3"],
            "SPREAD_LVL": best_row["SPREAD_LVL"],
        }

        # best_params = {
        #     "MA": best_row["MA"],
        #     "DROP": best_row["DROP"],
        #     "CHG4": best_row["CHG4"],
        #     "RET3": best_row["RET3"],
        #     "SPREAD_LVL": best_row["SPREAD_LVL"],
        # }

        # Run best strategy again to return full results
        df_best = IndicatorEngine.apply_all(df.copy(), best_params["MA"])
        best_strat = SPHYStrategy(
            MA_LENGTH=best_params["MA"],
            DROP=best_params["DROP"],
            CHG4_THR=best_params["CHG4"],
            RET3_THR=best_params["RET3"],
            SPREAD_LVL=best_params["SPREAD_LVL"],
        )

        positions, buys, sells = best_strat.run(df_best, start_invested=start_invested)
        bt = Backtester(self.cash_rate)
        best_result = bt.run(df_best, positions, buys, sells)

        return best_params, results_df, best_result
