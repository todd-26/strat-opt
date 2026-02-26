import pandas as pd
from pathlib import Path
from alpha_vantage import AlphaVantage
from fred import Fred

DIV_COLUMN = "dividend amount"


class WeeklyDataLoader:
    """
    Loads weekly SPHY price/dividend data + daily FRED spread data,
    converts spreads to weekly, merges all, and computes TR & weekly returns.

    Parameters
    ----------
    input_type : str
        "csv" or "api"
    input_dir : Path
        Path to directory where CSV input files are stored.
    ticker : str
        Ticker symbol (default "SPHY")
    """

    def __init__(self, input_type: str, input_dir: Path, ticker: str = "SPHY"):
        self.input_type = input_type
        self.input_dir = input_dir
        self.ticker = ticker.upper()

    # ------------------------------------------------------------
    # Load SPHY price + dividend data (already weekly)
    # ------------------------------------------------------------
    def load_price_dividend(self) -> pd.DataFrame:
        av = AlphaVantage(self.ticker, self.input_type, self.input_dir)
        df = av.get_data().copy()

        df = df.sort_values("date").reset_index(drop=True)
        df[DIV_COLUMN] = pd.to_numeric(df[DIV_COLUMN], errors="coerce").fillna(0.0)

        # Compute total return factor
        df["close_prev"] = df["close"].shift(1).fillna(df["close"])
        df["TR_factor"] = (df["close"] + df[DIV_COLUMN]) / df["close_prev"]
        df["TR"] = df["TR_factor"].cumprod()

        return df

    # ------------------------------------------------------------
    # Load FRED spread (daily → weekly)
    # ------------------------------------------------------------
    def load_spread(self) -> pd.DataFrame:
        fr = Fred(self.input_type, self.input_dir)
        df = fr.get_data().copy()

        # Convert daily to weekly (Friday)
        df = df.set_index("date").resample("W-FRI").last()

        df = df.sort_index().reset_index()
        return df

    # ------------------------------------------------------------
    # Merge SPHY weekly + FRED weekly spreads
    # ------------------------------------------------------------
    def merge_price_spread(self, price_df: pd.DataFrame, spread_df: pd.DataFrame) -> pd.DataFrame:
        w_price = price_df.copy()
        w_price["date"] = pd.to_datetime(w_price["date"])

        w_spread = spread_df.copy()
        w_spread["date"] = pd.to_datetime(w_spread["date"])

        # merge_asof is safest for forward/backward alignment in weekly domains
        merged = pd.merge_asof(
            w_price.sort_values("date"),
            w_spread.sort_values("date"),
            on="date",
            direction="backward"
        )

        merged = merged.set_index("date")
        return merged

    # ------------------------------------------------------------
    # Public entry: load everything
    # ------------------------------------------------------------
    def load(self) -> pd.DataFrame:
        """
        Returns full weekly DataFrame with:
        close, dividend, TR, Spread
        """
        price_df = self.load_price_dividend()
        spread_df = self.load_spread()

        weekly = self.merge_price_spread(price_df, spread_df)
        print("Data range:", weekly.index.min().date(), "to", weekly.index.max().date())

        # Weekly return from TR
        weekly["Ret"] = weekly["TR"].pct_change()

        return weekly
