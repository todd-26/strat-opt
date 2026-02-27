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
    FRED data source for yield spread data.

    :param input_type: Type of input data source to use (api or csv).
    :param input_dir: Directory for input CSV files.
    '''
    def __init__(self, input_type: str, input_dir: Path) -> None:
        self.input_type = input_type
        self.input_dir = input_dir
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
                'series_id': 'BAMLH0A0HYM2',
                'file_type': 'json',
                'observation_start': '2012-06-29',
                'frequency': 'wef',  # weekly frequency taken on Fridays
                'aggregation_method': 'eop'  # end of period values
            }

    def get_data(self) -> pd.DataFrame:
        '''
        Gets yield spread data from FRED and returns it as a DataFrame.
        
        :return: DataFrame with 'date' and 'Spread' columns.
        '''
        if self.input_type == "api":
            data_source = ApiSource(self.url, ApiData.JSON, "observations", self.params)
        else:
            data_source = CsvSource(f"{self.input_dir}/fred.csv")
        df = data_source.data
        df = df[['date', 'value']].copy()
        df['date'] = pd.to_datetime(df['date'], errors='coerce')
        df.rename(columns={'value': 'Spread'}, inplace=True)
        df = df.dropna(subset=['date']).sort_values('date').reset_index(drop=True)
        # Normalize Spread: strip whitespace and coerce non-numeric entries to NaN (blank)
        # For some reason the FRED API will return a period '.' for missing values
        df['Spread'] = df['Spread'].astype(str).str.strip()
        df.loc[df['Spread'] == '', 'Spread'] = np.nan
        df['Spread'] = pd.to_numeric(df['Spread'], errors='coerce')
        return df
