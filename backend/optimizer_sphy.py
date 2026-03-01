from pathlib import Path

from optimizer_base import BaseOptimizer
from strategy_sphy import SPHYStrategy


class SPHYOptimizer(BaseOptimizer):
    """
    Grid-search optimizer for the SPHY strategy.
    """

    def __init__(self, input_type: str, input_dir: Path, cash_rate: float, param_grids: dict = None):
        # SPHY default grids
        self.MA_grid = [50]
        self.DROP_grid = [0.016]
        self.CHG4_grid = [0.16]
        self.RET3_grid = [-0.021, -0.0215, -0.022, -0.0225, -0.023]
        self.SPREAD_grid = [7.0]

        super().__init__(input_type, input_dir, cash_rate, param_grids)

    def _create_strategy(self, MA, DROP, CHG4, RET3, SPREAD_LVL):
        return SPHYStrategy(
            MA_LENGTH=MA,
            DROP=DROP,
            CHG4_THR=CHG4,
            RET3_THR=RET3,
            SPREAD_LVL=SPREAD_LVL,
        )
