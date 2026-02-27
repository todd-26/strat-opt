import { useState } from 'react'
import { runSignal } from '../lib/api'
import type { SignalResponse, StrategyParams } from '../types'

export function useSignal() {
  const [result, setResult] = useState<SignalResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(
    ticker: string,
    params: StrategyParams,
    startInvested: number,
    cashRate: number,
    inputType: string,
  ) {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const data = await runSignal(ticker, params, startInvested, cashRate, inputType)
      setResult(data)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  return { result, loading, error, run }
}
