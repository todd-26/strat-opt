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
      SPREAD_LVL: grids.SPREAD_LVL,
      start_invested: startInvested,
      cash_rate: cashRate,
      input_type: inputType,
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
