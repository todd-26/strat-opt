import pandas as pd
import requests
import io
from datetime import date
from enum import Enum

# Keyed by (url, frozen params, fetch date). Cleared automatically on day change
# (new date → new key) or process restart.
_api_cache: dict = {}

class ApiData(Enum):
    CSV = 1
    JSON = 2

class DataSource:
    '''
    Base class for data sources.
    '''
    def __init__(self, params):
        self.data = None
        self.params = params

class CsvSource(DataSource):
    '''
    Data source from a local CSV file.

        :param path: Path to the CSV file.
        :param params: Optional parameters for data loading.
    '''
    def __init__(self, path: str, params=None):
        super().__init__(params)
        self.path = path
        self.data = pd.read_csv(path)

class ApiSource(DataSource):
    '''
    Data source from a web API.
    
        :param url: URL of the API endpoint.
        :param api_data: Type of data returned by the API call(CSV or JSON).
        :param data_node: For JSON data, the key to extract the relevant data.
        :param params: Optional parameters for the API request.
    '''
    def __init__(self, url: str, api_data: ApiData, data_node=None, params=None):
        super().__init__(params)
        self.url = url

        params_key = frozenset(params.items()) if params else frozenset()
        cache_key = (url, params_key, date.today())
        if cache_key in _api_cache:
            self.data = _api_cache[cache_key].copy()
            self.from_cache = True
            return

        self.from_cache = False
        response = requests.get(self.url, params=params)
        response.raise_for_status()
        if api_data == ApiData.JSON:
            if data_node is None:
                raise ValueError("data_node must be provided for JSON data.")
            self.data = pd.DataFrame(response.json()[data_node])
        elif api_data == ApiData.CSV:
            if response.text.lstrip().startswith('{'):
                import json
                try:
                    msg = next(iter(json.loads(response.text).values()))
                except Exception:
                    msg = response.text[:200]
                raise ValueError(f"API returned an error instead of CSV data: {msg}")
            self.data = pd.read_csv(io.StringIO(response.text))

        _api_cache[cache_key] = self.data.copy()

