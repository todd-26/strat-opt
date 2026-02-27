###################################################################################
#  Alpha Vantage API Module 
# 
# The price and dividend data come from the Alpha Vantage API.
###################################################################################
import os
import pandas as pd
from pathlib import Path
from data_source import ApiSource, ApiData, CsvSource


class AlphaVantage:
    '''
    Alpha Vantage data source for price and dividend data.

    :param ticker: Stock ticker symbol.
    :param input_type: Type of input data source to use (api or csv).
    :param input_dir: Directory for input CSV files.
    '''
    DATE_FMT = "%Y-%m-%d"

    def __init__(self, ticker: str, input_type: str, input_dir: Path) -> None:
        self.ticker = ticker.upper()
        self.input_type = input_type
        self.input_dir = input_dir
        if input_type == "api":
            apikey = os.environ.get("ALPHA_VANTAGE_API_KEY")
            url_template = os.environ.get("ALPHA_VANTAGE_URL")
            if not apikey:
                raise ValueError("ALPHA_VANTAGE_API_KEY environment variable is not set")
            if not url_template:
                raise ValueError("ALPHA_VANTAGE_URL environment variable is not set")
            self.url = url_template.format(ticker=self.ticker, apikey=apikey)

    def get_data(self) -> pd.DataFrame:
        '''
        Gets price and dividend data from Alpha Vantage and returns it as a DataFrame.

        :return: DataFrame with 'date', 'close', and 'dividend amount' columns.
        '''
        if self.input_type == "api":
            data_source = ApiSource(self.url, ApiData.CSV)
        else:
            data_source = CsvSource(f"{self.input_dir}/weekly-adjusted.csv")
        df = data_source.data
        df["date"] = pd.to_datetime(df["timestamp"], format=self.DATE_FMT, errors="coerce").dt.normalize()
        df = df.drop(columns=["open", "high", "low", "volume", "timestamp", "adjusted close"])  # Keep only relevant columns
        return df
