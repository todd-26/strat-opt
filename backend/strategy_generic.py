import pandas as pd
from strategy_base import BaseStrategy

PARAM_NAMES = ['MA', 'DROP', 'CHG4', 'RET3', 'YIELD10_CHG4', 'YIELD2_CHG4', 'CURVE_CHG4', 'SPREAD_DELTA', 'YIELD10_DELTA']
INT_PARAMS  = {'MA', 'SPREAD_DELTA', 'YIELD10_DELTA'}


class GenericStrategy(BaseStrategy):
    """
    Generic credit-spread strategy driven by a params dict and an ignore set.

    SELL if ANY (where factor not in ignore):
        - chg4 > CHG4
        - ret3 < RET3
        - yield10_chg4 > YIELD10_CHG4
        - yield2_chg4 > YIELD2_CHG4
        - curve_chg4 < -CURVE_CHG4

    BUY if ALL (where factor not in ignore), only after a prior SELL:
        - close > MA{n}
        - last SPREAD_DELTA weekly spread_delta values are negative
        - spread <= recent_4wk_peak * (1 - DROP)
        - last YIELD10_DELTA weekly yield10_delta values are negative
    """

    def __init__(self, params: dict, ignore=()):
        self.MA_LENGTH    = int(params.get('MA', 50))
        self.DROP         = float(params.get('DROP', 0.016))
        self.CHG4_THR     = float(params.get('CHG4', 0.16))
        self.RET3_THR     = float(params.get('RET3', -0.0225))
        self.YIELD10_CHG4   = float(params.get('YIELD10_CHG4', 0))
        self.YIELD2_CHG4    = float(params.get('YIELD2_CHG4', 0))
        self.CURVE_CHG4   = float(params.get('CURVE_CHG4', 0))
        self.SPREAD_DELTA = int(params.get('SPREAD_DELTA', 2))
        self.YIELD10_DELTA  = int(params.get('YIELD10_DELTA', 2))
        self.ignore = set(ignore)

    def evaluate_sell(self, row: pd.Series, df: pd.DataFrame, idx) -> bool:
        c2 = False if 'CHG4'        in self.ignore else ((not pd.isna(row['chg4']))          and (row['chg4']          > self.CHG4_THR))
        c3 = False if 'RET3'        in self.ignore else ((not pd.isna(row['ret3']))          and (row['ret3']          < self.RET3_THR))
        c4 = False if 'YIELD10_CHG4'  in self.ignore else ((not pd.isna(row['yield10_chg4'])) and (row['yield10_chg4']  > self.YIELD10_CHG4))
        c5 = False if 'YIELD2_CHG4'   in self.ignore else ((not pd.isna(row['yield2_chg4']))  and (row['yield2_chg4']   > self.YIELD2_CHG4))
        c6 = False if 'CURVE_CHG4'  in self.ignore else ((not pd.isna(row['curve_chg4']))   and (row['curve_chg4']    < -self.CURVE_CHG4))
        return c2 or c3 or c4 or c5 or c6

    def evaluate_buy(self, row: pd.Series, df: pd.DataFrame, idx, last_action_was_sell: bool) -> bool:
        if not last_action_was_sell:
            return False
        ma_col = f'MA{self.MA_LENGTH}'
        if 'MA' not in self.ignore and pd.isna(row[ma_col]):
            return False
        cond1 = True if 'MA'           in self.ignore else (row['close'] > row[ma_col])
        past  = df.loc[:idx]
        if len(past) < 3 and not {'SPREAD_DELTA', 'YIELD10_DELTA'}.issubset(self.ignore):
            return False
        cond2 = True if 'SPREAD_DELTA' in self.ignore else (past['spread_delta'].tail(self.SPREAD_DELTA) < 0).all()
        spreads = pd.concat([past['Spread'].iloc[-3:], pd.Series([row['Spread']], dtype=float)])
        recent_peak = spreads.max()
        if 'DROP' not in self.ignore and (pd.isna(recent_peak) or pd.isna(row['Spread'])):
            return False
        cond3 = True if 'DROP'         in self.ignore else (row['Spread'] <= recent_peak * (1 - self.DROP))
        cond4 = True if 'YIELD10_DELTA'  in self.ignore else (past['yield10_delta'].tail(self.YIELD10_DELTA) < 0).all()
        return bool(cond1 and cond2 and cond3 and cond4)

    def _compute_signals(self, df: pd.DataFrame):
        ma_col = f'MA{self.MA_LENGTH}'

        sell_chg4        = pd.Series(False, index=df.index) if 'CHG4'       in self.ignore else (df['chg4']          > self.CHG4_THR)
        sell_ret3        = pd.Series(False, index=df.index) if 'RET3'       in self.ignore else (df['ret3']          < self.RET3_THR)
        sell_yld10_chg4  = pd.Series(False, index=df.index) if 'YIELD10_CHG4' in self.ignore else (df['yield10_chg4']  > self.YIELD10_CHG4)
        sell_yld2_chg4   = pd.Series(False, index=df.index) if 'YIELD2_CHG4'  in self.ignore else (df['yield2_chg4']   > self.YIELD2_CHG4)
        sell_curve_chg4  = pd.Series(False, index=df.index) if 'CURVE_CHG4' in self.ignore else (df['curve_chg4']    < -self.CURVE_CHG4)
        sell_mask = (sell_chg4 | sell_ret3 | sell_yld10_chg4 | sell_yld2_chg4 | sell_curve_chg4).fillna(False).to_numpy()

        buy_ma    = pd.Series(True, index=df.index) if 'MA'           in self.ignore else (df['close'] > df[ma_col])
        buy_delta = pd.Series(True, index=df.index) if 'SPREAD_DELTA' in self.ignore else (df['spread_delta'].rolling(self.SPREAD_DELTA).max() < 0)
        buy_drop  = pd.Series(True, index=df.index) if 'DROP'         in self.ignore else (df['Spread'] <= df['Spread'].rolling(4).max() * (1 - self.DROP))
        buy_yld10 = pd.Series(True, index=df.index) if 'YIELD10_DELTA'  in self.ignore else (df['yield10_delta'].rolling(self.YIELD10_DELTA).max() < 0)
        buy_mask = (buy_ma & buy_delta & buy_drop & buy_yld10).fillna(False).to_numpy()

        return sell_mask, buy_mask

    def run(self, df: pd.DataFrame, start_invested: int = 1):
        sell_mask, buy_mask = self._compute_signals(df)
        index = df.index

        invested = int(start_invested)
        was_sold = (start_invested == 0)
        positions = []
        buy_dates = []
        sell_dates = []

        for i in range(len(df)):
            if invested:
                if sell_mask[i]:
                    invested = 0
                    was_sold = True
                    sell_dates.append(index[i])
            else:
                if was_sold and buy_mask[i] and not sell_mask[i]:
                    invested = 1
                    buy_dates.append(index[i])
            positions.append(invested)

        return positions, buy_dates, sell_dates
