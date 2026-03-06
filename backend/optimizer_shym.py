from pathlib import Path

from optimizer_base import BaseOptimizer
from strategy_shym import SHYMStrategy


class SHYMOptimizer(BaseOptimizer):
    """
    Grid-search optimizer for the SHYM strategy.
    Default grids are broad starting points; tune via the UI optimizer.
    """

    def __init__(self, input_type: str, input_dir: Path, cash_rate: float, param_grids: dict = None,
                 start_date: str = None, end_date: str = None, disabled_factors: set = ()):
        # SHYM default grids — starting points until optimizer discovers best values
        self.MA_grid = [50]
        self.DROP_grid = [0.016]
        self.CHG4_grid = [0.16]
        self.RET3_grid = [-0.021]
        self.SPREAD_grid = [7.0]
        self.YIELD10_CHG4_grid = [0]
        self.YIELD2_CHG4_grid = [0]
        self.CURVE_CHG4_grid = [0]
        self.SPREAD_DELTA_grid = [2]
        self.YIELD10_DELTA_grid = [2]

        super().__init__(input_type, input_dir, cash_rate, param_grids, start_date, end_date, disabled_factors)

    def _create_strategy(self, MA, DROP, CHG4, RET3, SPREAD_LVL,
                         YIELD10_CHG4=0, YIELD2_CHG4=0, CURVE_CHG4=0,
                         SPREAD_DELTA=2, YIELD10_DELTA=2, disabled=()):
        return SHYMStrategy(
            MA_LENGTH=MA,
            DROP=DROP,
            CHG4_THR=CHG4,
            RET3_THR=RET3,
            SPREAD_LVL=SPREAD_LVL,
            YIELD10_CHG4_THR=YIELD10_CHG4,
            YIELD2_CHG4_THR=YIELD2_CHG4,
            CURVE_CHG4_THR=CURVE_CHG4,
            SPREAD_DELTA_N=SPREAD_DELTA,
            YIELD10_DELTA_N=YIELD10_DELTA,
            disabled=disabled,
        )
