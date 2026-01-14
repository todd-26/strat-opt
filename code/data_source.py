import pandas as pd
import requests
import io
from enum import Enum

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
        response = requests.get(self.url, params=params)
        response.raise_for_status()
        if api_data == ApiData.JSON:
            if data_node is None:
                raise ValueError("data_node must be provided for JSON data.")
            self.data = response.json()
            json_data = self.data[data_node] #if data_node else self.data
            self.data = pd.DataFrame(json_data)
        elif api_data == ApiData.CSV:
            self.data = pd.read_csv(io.StringIO(response.text))

