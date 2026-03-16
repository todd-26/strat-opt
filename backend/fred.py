###################################################################################
#  FRED API Module
#
# The spread data comes from FRED (Federal Reserve Bank of St. Louis).
###################################################################################
import os
import pandas as pd
import numpy as np
from pathlib import Path
from data_source import ApiSource, ApiData, CsvSource

class Fred:
    '''
    FRED data source for any FRED series.

    :param input_type: Type of input data source to use (api or csv).
    :param input_dir: Directory for input CSV files.
    :param series_id: FRED series ID (default: 'BAMLH0A0HYM2').
    :param col_name: Column name for the data values (default: 'Spread').
    '''
    def __init__(self, input_type: str, input_dir: Path, series_id: str = 'BAMLH0A0HYM2', col_name: str = 'Spread') -> None:
        self.input_type = input_type
        self.input_dir = input_dir
        self.series_id = series_id
        self.col_name = col_name
        if input_type == "api":
            apikey = os.environ.get("FRED_API_KEY")
            url = os.environ.get("FRED_URL")
            if not apikey:
                raise ValueError("FRED_API_KEY environment variable is not set")
            if not url:
                raise ValueError("FRED_URL environment variable is not set")
            self.url = url
            self.params = {
                'api_key': apikey,
                'series_id': self.series_id,
                'file_type': 'json',
                'observation_start': '2000-01-01',
                'frequency': 'wef',  # weekly frequency taken on Fridays
                'aggregation_method': 'eop'  # end of period values
            }

    def get_data(self) -> pd.DataFrame:
        '''
        Gets data from FRED and returns it as a DataFrame.

        :return: DataFrame with 'date' and col_name columns.
        '''
        if self.input_type == "api":
            data_source = ApiSource(self.url, ApiData.JSON, "observations", self.params)
            if not data_source.from_cache:
                csv_path = Path(self.input_dir) / f"{self.series_id}.csv"
                data_source.data[['date', 'value']].to_csv(csv_path, index=False)
        else:
            data_source = CsvSource(f"{self.input_dir}/{self.series_id}.csv")
        df = data_source.data
        df = df[['date', 'value']].copy()
        df['date'] = pd.to_datetime(df['date'], errors='coerce')
        df.rename(columns={'value': self.col_name}, inplace=True)
        df = df.dropna(subset=['date']).sort_values('date').reset_index(drop=True)
        # Normalize col_name: strip whitespace and coerce non-numeric entries to NaN (blank)
        # For some reason the FRED API will return a period '.' for missing values
        df[self.col_name] = df[self.col_name].astype(str).str.strip()
        df.loc[df[self.col_name] == '', self.col_name] = np.nan
        df[self.col_name] = pd.to_numeric(df[self.col_name], errors='coerce')
        return df
