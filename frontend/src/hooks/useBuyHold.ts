import { useState } from 'react'
import { runBuyHold } from '../lib/api'
import type { BacktestResult } from '../types'

export function useBuyHold() {
  const [result, setResult] = useState<BacktestResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(ticker: string, cashRate: number, inputType: string) {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const data = await runBuyHold(ticker, cashRate, inputType)
      setResult(data)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  return { result, loading, error, run }
}
