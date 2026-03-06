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
    # Treasury yield indicators
    # ------------------------------------------------------------
    @staticmethod
    def add_yield10_chg4(df: pd.DataFrame) -> pd.DataFrame:
        """Adds 4-week % change in 10yr yield → 'yield10_chg4'."""
        df["yield10_chg4"] = df["DGS10"].pct_change(4)
        return df

    @staticmethod
    def add_yield2_chg4(df: pd.DataFrame) -> pd.DataFrame:
        """Adds 4-week % change in 2yr yield → 'yield2_chg4'."""
        df["yield2_chg4"] = df["DGS2"].pct_change(4)
        return df

    @staticmethod
    def add_curve_chg4(df: pd.DataFrame) -> pd.DataFrame:
        """Adds 4-week absolute change in yield curve (10y-2y) → 'curve_chg4'."""
        df["curve_chg4"] = df["YieldCurve"].diff(4)
        return df

    @staticmethod
    def add_yield10_delta(df: pd.DataFrame) -> pd.DataFrame:
        """Adds 1-week change in 10yr yield → 'yield10_delta'."""
        df["yield10_delta"] = df["DGS10"].diff()
        return df

    # ------------------------------------------------------------
    # Convenience: apply full indicator suite
    # ------------------------------------------------------------
    @staticmethod
    def apply_all(df: pd.DataFrame, ma_length) -> pd.DataFrame:
        """
        Applies the full required indicator set:
        - MA length (parameterized)
        - chg4 (4-week change in spread)
        - ret3 (3-week price return)
        - delta in spread
        - treasury yield indicators
        """
        df = IndicatorEngine.add_ma(df, ma_length)
        df = IndicatorEngine.add_chg4(df)
        df = IndicatorEngine.add_ret3(df)
        df = IndicatorEngine.add_spread_delta(df)
        df = IndicatorEngine.add_yield10_chg4(df)
        df = IndicatorEngine.add_yield2_chg4(df)
        df = IndicatorEngine.add_curve_chg4(df)
        df = IndicatorEngine.add_yield10_delta(df)
        return df
