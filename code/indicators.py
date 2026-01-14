import pandas as pd


class IndicatorEngine:
    """
    Applies all technical/statistical indicators required by strategies.

    This class is intentionally simple and stateless:
    each method adds one indicator to the DataFrame and returns it.
    """

    # ------------------------------------------------------------
    # Moving average
    # ------------------------------------------------------------
    @staticmethod
    def add_ma(df: pd.DataFrame, length: int, col: str = "close", out: str = "") -> pd.DataFrame:
        """
        Adds a moving average of given length on the specified column.
        """
        out = out or f"MA{length}"
        df[out] = df[col].rolling(length).mean()
        return df

    # ------------------------------------------------------------
    # 4-week spread % change
    # ------------------------------------------------------------
    @staticmethod
    def add_chg4(df: pd.DataFrame) -> pd.DataFrame:
        """
        Adds 4-week percentage change in Spread → 'chg4'.
        """
        df["chg4"] = df["Spread"].pct_change(4)
        return df

    # ------------------------------------------------------------
    # 3-week price return % change
    # ------------------------------------------------------------
    @staticmethod
    def add_ret3(df: pd.DataFrame) -> pd.DataFrame:
        """
        Adds 3-week price return % change → 'ret3'.
        """
        df["ret3"] = df["close"].pct_change(3)
        return df

    # ------------------------------------------------------------
    # Spread delta (1-week difference)
    # ------------------------------------------------------------
    @staticmethod
    def add_spread_delta(df: pd.DataFrame) -> pd.DataFrame:
        """
        Adds 1-week change in spreads → 'spread_delta'.
        """
        df["spread_delta"] = df["Spread"].diff()
        return df

    # ------------------------------------------------------------
    # Convenience: apply full indicator suite
    # ------------------------------------------------------------
    @staticmethod
    def apply_all(df: pd.DataFrame, ma_length) -> pd.DataFrame:
        """
        Applies the full required indicator set for SPHY:
        - MA length (parameterized)
        - chg4 (4-week change in spread)
        - ret3 (3-week price return)
        - delta in spread
        """
        df = IndicatorEngine.add_ma(df, ma_length)
        df = IndicatorEngine.add_chg4(df)
        df = IndicatorEngine.add_ret3(df)
        df = IndicatorEngine.add_spread_delta(df)
        return df
