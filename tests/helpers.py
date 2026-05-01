import numpy as np
import pandas as pd


def make_weekly_df(n, close=None, spread=None, dgs10=None, dgs2=None, tr_drift=0.001):
    """
    Build a minimal weekly DataFrame with all columns required by
    IndicatorEngine and GenericStrategy.

    Ret[0] is 0.0 (not NaN) so backtester tests have clean arithmetic.
    """
    dates  = pd.date_range("2020-01-03", periods=n, freq="W-FRI")
    c      = np.asarray(close)  if close  is not None else np.linspace(100.0, 105.0, n)
    sp     = np.asarray(spread) if spread is not None else np.full(n, 3.0)
    y10    = np.asarray(dgs10)  if dgs10  is not None else np.linspace(4.0, 3.8, n)
    y2     = np.asarray(dgs2)   if dgs2   is not None else np.full(n, 2.0)
    tr     = np.cumprod(np.full(n, 1.0 + tr_drift))
    ret    = np.concatenate([[0.0], np.diff(tr) / tr[:-1]])

    return pd.DataFrame({
        "close":      c,
        "Spread":     sp,
        "DGS10":      y10,
        "DGS2":       y2,
        "YieldCurve": y10 - y2,
        "TR":         tr,
        "Ret":        ret,
    }, index=dates)
