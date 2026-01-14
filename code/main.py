import argparse
from pathlib import Path
from itertools import zip_longest

from data_loader import WeeklyDataLoader
from indicators import IndicatorEngine
from strategy_sphy import SPHYStrategy
from strategy_buyhold import BuyAndHoldStrategy
from backtester import Backtester
from optimizer_sphy import SPHYOptimizer


# ----------------------------------------------------------------------
# Command-line parsing
# ----------------------------------------------------------------------
def parse_args():
    p = argparse.ArgumentParser(description="Security Weekly Strategy Framework")

    p.add_argument(
        "--input-type",
        type=str,
        choices=["api", "csv"],
        default="csv",         # YOUR PREFERENCE
        help="Data source type (default: csv)"
    )

    p.add_argument(
        "--invested",
        type=int,
        choices=[0, 1],
        default=1,
        help="Initial invested state (1=invested, 0=cash)"
    )

    p.add_argument(
        "--optimize",
        action="store_true",
        help="Run full SPHY optimizer instead of single backtest"
    )

    p.add_argument(
        "--cash-rate",
        type=float,
        default=0.04,
        help="Annual cash rate (default 0.04)"
    )

    p.add_argument(
    "--buyhold",
    action="store_true",
    help="Run buy-and-hold instead of SPHY strategy"
    )

    p.add_argument(
    "--ticker",
    type=str,
    required=True,
    help="Stock ticker to run the strategy on",
    )


    return p.parse_args()


# ----------------------------------------------------------------------
# Main execution
# ----------------------------------------------------------------------
def run_single_backtest(input_type: str, input_dir: Path, invested: int, cash_rate: float, ticker: str):
    """
    Runs a single backtest using the hard-coded best parameters.
    """

    print(f"\n=== Running {ticker} Strategy (Single Backtest) ===")
    print(f"Input type: {input_type}   |   Start invested: {invested}\n")

    # Load weekly data
    loader = WeeklyDataLoader(input_type, input_dir, ticker)
    df = loader.load()

    # Use your historically optimal defaults
    params = {
        "MA": 50,
        "DROP": 0.017,
        "CHG4": 0.165,
        "RET3": -0.021,
        "SPREAD_LVL": 7.0,
    }

    # Apply indicators
    df_ind = IndicatorEngine.apply_all(df.copy(), params["MA"])

    # Instantiate strategy
    strat = SPHYStrategy(
        MA_LENGTH=params["MA"],
        DROP=params["DROP"],
        CHG4_THR=params["CHG4"],
        RET3_THR=params["RET3"],
        SPREAD_LVL=params["SPREAD_LVL"],
    )

    # Run strategy to get positions
    positions, buys, sells = strat.run(df_ind, start_invested=invested)

    # Run backtest
    bt = Backtester(cash_rate)
    result = bt.run(df_ind, positions, buys, sells)

    # Output results
    print(f"Final Value: {result['final_value']:.6f}")
    print(f"APY: {result['apy'] * 100:.2f}%")

    # Print event list
    print("\nTransactions:")
    for buy, sell in zip_longest(result["buy_dates"], result["sell_dates"]):
        if buy and sell:
            print(f"Sell on {sell.date()}   |   Buy on {buy.date()}")
        elif buy:
            print(f"Buy on {buy.date()}")
        elif sell:
            print(f"Sell on {sell.date()}")

    # Save output
    result["df"].to_csv("strategy_output.csv")
    print("\nSaved results → strategy_output.csv\n")


def run_optimizer(input_type: str, input_dir: Path, invested: int, cash_rate: float, ticker : str):
    """
    Runs the full SPHY optimizer.
    """

    print("\n=== Running SPHY Optimizer ===")
    print("This may take a few seconds...\n")

    opt = SPHYOptimizer(input_type, input_dir, cash_rate)
    best_params, results_df, best_result = opt.run(ticker, start_invested=invested)

    print("=== BEST PARAMETERS ===")
    for k, v in best_params.items():
        print(f"{k}: {v}")

    print(f"\nBest APY: {best_result['apy'] * 100:.2f}%")
    print(f"Final Value: {best_result['final_value']:.6f}\n")

    results_df.to_csv("optimizer_results.csv", index=False)
    best_result["df"].to_csv("best_strategy_output.csv")

    print("Saved:")
    print(" - optimizer_results.csv")
    print(" - best_strategy_output.csv\n")

def run_buy_and_hold(input_type: str, input_dir: Path, cash_rate: float, ticker: str):
    print("\n=== Running Buy & Hold Strategy ===\n")

    loader = WeeklyDataLoader(input_type, input_dir, ticker)
    df = loader.load()

    # Buy-and-hold strategy instance
    strat = BuyAndHoldStrategy()

    # Produce constant position vector
    positions, buys, sells = strat.run(df)

    bt = Backtester(cash_rate)
    result = bt.run(df, positions, buys, sells)

    print(f"Final Value: {result['final_value']:.4f}")
    print(f"APY: {result['apy'] * 100:.2f}%")

    result["df"].to_csv("buyhold_output.csv")
    print("\nSaved results → buyhold_output.csv\n")


def main():
    args = parse_args()

    input_type = args.input_type
    invested = args.invested
    cash_rate = args.cash_rate
    optimize_flag = args.optimize
    ticker = args.ticker

    input_dir = Path(__file__).resolve().parent.parent / "inputs"

    if args.buyhold:
        run_buy_and_hold(input_type, input_dir, cash_rate, ticker)
    elif optimize_flag:
        run_optimizer(input_type, input_dir, invested, cash_rate, ticker)
    else:
        run_single_backtest(input_type, input_dir, invested, cash_rate, ticker)


if __name__ == "__main__":
    main()
