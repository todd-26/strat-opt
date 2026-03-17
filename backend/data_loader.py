import pandas as pd
from pathlib import Path
from alpha_vantage import AlphaVantage
from fred import Fred

class WeeklyDataLoader:
    """
    Loads weekly price/dividend data + daily FRED spread data,
    converts spreads to weekly, merges all, and computes TR & weekly returns.

    Parameters
    ----------
    input_type : str
        "csv" or "api"
    input_dir : Path
        Path to directory where CSV input files are stored.
    ticker : str
        Ticker symbol
    """

    def __init__(self, input_type: str, input_dir: Path, ticker: str):
        self.input_type = input_type
        self.input_dir = input_dir
        self.ticker = ticker.upper()

    # ------------------------------------------------------------
    # Load price + dividend data (already weekly)
    # ------------------------------------------------------------
    def load_price_dividend(self) -> pd.DataFrame:
        av = AlphaVantage(self.ticker, self.input_type, self.input_dir)
        df = av.get_data().copy()

        df = df.sort_values("date").reset_index(drop=True)

        # close is already adjusted close (split + dividend adjusted); TR from period returns.
        df["close_prev"] = df["close"].shift(1).fillna(df["close"])
        df["TR_factor"] = df["close"] / df["close_prev"]
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
    # Load FRED treasury yields (daily → weekly)
    # ------------------------------------------------------------
    def load_treasury(self) -> pd.DataFrame:
        dgs10 = Fred(self.input_type, self.input_dir, series_id='DGS10', col_name='DGS10').get_data().copy()
        dgs2 = Fred(self.input_type, self.input_dir, series_id='DGS2', col_name='DGS2').get_data().copy()

        dgs10 = dgs10.set_index("date").resample("W-FRI").last().reset_index()
        dgs2 = dgs2.set_index("date").resample("W-FRI").last().reset_index()

        treasury = pd.merge_asof(
            dgs10.sort_values("date"),
            dgs2.sort_values("date"),
            on="date",
            direction="backward"
        )
        treasury["YieldCurve"] = treasury["DGS10"] - treasury["DGS2"]
        return treasury

    # ------------------------------------------------------------
    # Merge price weekly + FRED weekly spreads
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
    def load(self, start_date: str = None, end_date: str = None) -> pd.DataFrame:
        """
        Returns weekly DataFrame with: close, dividend, TR, Spread, DGS10, DGS2, YieldCurve.
        Optionally sliced to [start_date, end_date] (inclusive, YYYY-MM-DD).
        """
        price_df = self.load_price_dividend()
        spread_df = self.load_spread()
        treasury_df = self.load_treasury()

        weekly = self.merge_price_spread(price_df, spread_df)

        # Merge treasury columns
        treasury_df["date"] = pd.to_datetime(treasury_df["date"])
        weekly = pd.merge_asof(
            weekly.reset_index().sort_values("date"),
            treasury_df.sort_values("date"),
            on="date",
            direction="backward"
        ).set_index("date")

        # Cap at the latest date where FRED data is available.
        # merge_asof carries the last FRED value forward into newer price rows,
        # which would produce misleading signals using stale spread/yield data.
        fred_max = min(spread_df["date"].max(), treasury_df["date"].max())
        weekly = weekly[weekly.index <= fred_max]

        print("Data range:", weekly.index.min().date(), "to", weekly.index.max().date())

        data_min = weekly.index.min().date()
        data_max = weekly.index.max().date()
        if start_date:
            weekly = weekly.loc[pd.Timestamp(start_date):]
        if end_date:
            weekly = weekly.loc[:pd.Timestamp(end_date)]
        if weekly.empty:
            raise ValueError(
                f"Date range {start_date or 'start'} – {end_date or 'end'} "
                f"is outside available data for this security ({data_min} to {data_max})"
            )

        # Weekly return from TR
        weekly["Ret"] = weekly["TR"].pct_change()

        return weekly
