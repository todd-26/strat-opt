import { useState, useRef } from 'react'
import { streamOptimizer } from '../lib/api'
import type { OptimizerResponse, OptimizerGrids } from '../types'

export function useOptimizer() {
  const [result, setResult] = useState<OptimizerResponse | null>(null)
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  function run(
    ticker: string,
    grids: OptimizerGrids,
    startInvested: number,
    cashRate: number,
    inputType: string,
    startDate?: string,
    endDate?: string,
    disabledFactors?: string[],
  ) {
    // Cancel any in-flight run
    if (abortRef.current) {
      abortRef.current.abort()
    }

    setLoading(true)
    setError(null)
    setResult(null)
    setProgress(null)

    const req = {
      ticker,
      MA: grids.MA,
      DROP: grids.DROP,
      CHG4: grids.CHG4,
      RET3: grids.RET3,
      YIELD10_CHG4: grids.YIELD10_CHG4,
      YIELD2_CHG4: grids.YIELD2_CHG4,
      CURVE_CHG4: grids.CURVE_CHG4,
      SPREAD_DELTA: grids.SPREAD_DELTA,
      YIELD10_DELTA: grids.YIELD10_DELTA,
      start_invested: startInvested,
      cash_rate: cashRate,
      input_type: inputType,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      disabled_factors: disabledFactors?.length ? disabledFactors : undefined,
    }

    const controller = streamOptimizer(req, {
      onProgress(current, total) {
        setProgress({ current, total })
      },
      onResult(data) {
        setResult(data)
        setLoading(false)
        setProgress(null)
      },
      onError(msg) {
        setError(msg)
        setLoading(false)
        setProgress(null)
      },
    })

    abortRef.current = controller
  }

  function cancel() {
    abortRef.current?.abort()
    setLoading(false)
    setProgress(null)
  }

  return { result, progress, loading, error, run, cancel }
}
