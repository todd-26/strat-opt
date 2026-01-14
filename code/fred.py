###################################################################################
#  FRED API Module 
# 
# The spread data comes from FRED (Federal Reserve Bank of St. Louis).
###################################################################################
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
    APIKEY = "71972aa18002734b7900f9f5a399e997"
    URL = f"https://api.stlouisfed.org/fred/series/observations"

    def __init__(self, input_type: str, input_dir: Path) -> None:
        self.url = self.URL
        self.input_type = input_type
        self.input_dir = input_dir
        self.params = {
        'api_key': self.APIKEY,
        'series_id': 'BAMLH0A0HYM2',
        'file_type': 'json',
        'observation_start': '2012-06-29',
        'frequency': 'wef', # weekly frequency taken on Fridays
        'aggregation_method': 'eop' # end of period values
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
