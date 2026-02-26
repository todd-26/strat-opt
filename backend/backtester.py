import pandas as pd


class Backtester:
    """
    Converts strategy positions into performance metrics.

    Parameters
    ----------
    cash_rate : float
        Annualized cash rate, e.g., 0.04
        It will be converted internally to weekly rate.

    Notes
    -----
    Expects DataFrame containing:
        - Ret  (weekly return of the asset's TR series)
    """

    def __init__(self, cash_rate: float):
        self.cash_rate = cash_rate
        # Convert annual cash rate to weekly
        self.cash_weekly = (1 + cash_rate) ** (1 / 52) - 1

    # ------------------------------------------------------------
    # Execute the backtest
    # ------------------------------------------------------------
    def run(self, df: pd.DataFrame, positions: list[int], buy_dates, sell_dates):
        """
        Computes the strategy's equity curve from positions.

        Parameters
        ----------
        df : DataFrame
            Weekly merged dataset (from loader + indicators)
        positions : list[int]
            1/0 values aligned with df.index
        buy_dates : list[Timestamps]
        sell_dates : list[Timestamps]

        Returns
        -------
        result : dict
            {
                "df": DataFrame with Strategy column,
                "buy_dates": list,
                "sell_dates": list,
                "final_value": float,
                "apy": float
            }
        """

        out = df.copy()
        out["pos"] = positions

        # Shift to apply position decided at week t to return on t+1
        # (classic backtest convention). You may switch to same-week
        # application if preferred.
        pos_shifted = out["pos"].shift(1).fillna(out["pos"].iloc[0])

        out["StratRet"] = (
            out["Ret"] * pos_shifted +
            self.cash_weekly * (1 - pos_shifted)
        )

        # Build cumulative strategy equity
        out["Strategy"] = (1 + out["StratRet"]).cumprod()

        # Performance metrics
        final_value = float(out["Strategy"].iloc[-1])
        years = (out.index[-1] - out.index[0]).days / 365.25
        apy = final_value ** (1 / years) - 1 if years > 0 else 0.0

        return {
            "df": out,
            "buy_dates": buy_dates,
            "sell_dates": sell_dates,
            "final_value": final_value,
            "apy": apy,
        }
