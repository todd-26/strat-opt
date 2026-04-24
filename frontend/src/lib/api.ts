import type {
  AppConfig, BacktestResult, OptimizerRequest, OptimizerResponse,
  SignalResponse, StrategyParams, WalkForwardRequest, WalkForwardResponse,
} from '../types'

const BASE = '/api'

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(body || `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export function fetchSecurities(): Promise<string[]> {
  return fetchJson(`${BASE}/securities`)
}

export function addSecurity(ticker: string, name: string, template: string): Promise<void> {
  return fetchJson(`${BASE}/securities`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticker, name, template }),
  })
}

export function removeSecurity(ticker: string): Promise<void> {
  return fetchJson(`${BASE}/securities/${ticker}`, { method: 'DELETE' })
}

export function reorderSecurities(tickers: string[]): Promise<void> {
  return fetchJson(`${BASE}/securities/reorder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tickers }),
  })
}

export function updateSecurityData(ticker: string): Promise<boolean> {
  return fetchJson<{ ok: boolean; already_current: boolean }>(`${BASE}/securities/${ticker}/fetch-data`, {
    method: 'POST',
  }).then(r => r.already_current)
}

export function getConfig(ticker: string): Promise<AppConfig> {
  return fetchJson(`${BASE}/config?ticker=${encodeURIComponent(ticker)}`)
}

export function saveConfig(ticker: string, config: AppConfig): Promise<void> {
  return fetchJson(`${BASE}/config?ticker=${encodeURIComponent(ticker)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  })
}

export function getDateRange(ticker: string): Promise<{ min: string; max: string }> {
  return fetchJson(`${BASE}/date-range?ticker=${encodeURIComponent(ticker)}`)
}

export function updateEconomicData(): Promise<boolean> {
  return fetchJson<{ ok: boolean; already_current: boolean }>(`${BASE}/economic-data/fetch`, {
    method: 'POST',
  }).then(r => r.already_current)
}

export function getEconomicDates(): Promise<{ spread: string | null; dgs2: string | null; dgs10: string | null }> {
  return fetchJson(`${BASE}/economic-data/dates`)
}

export function runBuyHold(
  ticker: string,
  cashRate: number,
  inputType: string,
  startDate?: string,
  endDate?: string,
): Promise<BacktestResult> {
  return fetchJson(`${BASE}/run/buyhold`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ticker,
      cash_rate: cashRate,
      input_type: inputType,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
    }),
  })
}

export function runSignal(
  ticker: string,
  params: StrategyParams,
  startInvested: number,
  isInvested: number,
  cashRate: number,
  inputType: string,
  startDate?: string,
  endDate?: string,
  disabledFactors?: string[],
): Promise<SignalResponse> {
  return fetchJson(`${BASE}/run/signal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ticker,
      MA: params.MA,
      DROP: params.DROP,
      CHG4: params.CHG4,
      RET3: params.RET3,
      YIELD10_CHG4: params.YIELD10_CHG4,
      YIELD2_CHG4: params.YIELD2_CHG4,
      CURVE_CHG4: params.CURVE_CHG4,
      SPREAD_DELTA: params.SPREAD_DELTA,
      YIELD10_DELTA: params.YIELD10_DELTA,
      start_invested: startInvested,
      is_invested: isInvested,
      cash_rate: cashRate,
      input_type: inputType,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      disabled_factors: disabledFactors?.length ? disabledFactors : undefined,
    }),
  })
}

interface OptimizerCallbacks {
  onProgress: (current: number, total: number) => void
  onResult: (data: OptimizerResponse) => void
  onError: (msg: string) => void
}

export function streamOptimizer(req: OptimizerRequest, cbs: OptimizerCallbacks): AbortController {
  const controller = new AbortController()
  void (async () => {
    try {
      const res = await fetch(`${BASE}/run/optimizer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
        signal: controller.signal,
      })
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        cbs.onError(body || `HTTP ${res.status}`)
        return
      }
      await parseSSE(res, (event) => {
        if (event.type === 'progress') {
          cbs.onProgress(event.current as number, event.total as number)
        } else if (event.type === 'result') {
          cbs.onResult(event.data as OptimizerResponse)
        } else if (event.type === 'error') {
          cbs.onError(event.message as string)
        }
      })
    } catch (e) {
      if ((e as Error).name !== 'AbortError') cbs.onError(String(e))
    }
  })()
  return controller
}

interface WalkForwardCallbacks {
  onProgress: (current: number, total: number, status: string) => void
  onResult: (data: WalkForwardResponse) => void
  onError: (msg: string) => void
}

export function streamWalkForward(req: WalkForwardRequest, cbs: WalkForwardCallbacks): AbortController {
  const controller = new AbortController()
  void (async () => {
    try {
      const res = await fetch(`${BASE}/run/walk-forward`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
        signal: controller.signal,
      })
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        cbs.onError(body || `HTTP ${res.status}`)
        return
      }
      await parseSSE(res, (event) => {
        if (event.type === 'progress') {
          cbs.onProgress(event.current as number, event.total as number, (event.status as string) ?? '')
        } else if (event.type === 'result') {
          cbs.onResult(event.data as WalkForwardResponse)
        } else if (event.type === 'error') {
          cbs.onError(event.message as string)
        }
      })
    } catch (e) {
      if ((e as Error).name !== 'AbortError') cbs.onError(String(e))
    }
  })()
  return controller
}

async function parseSSE(res: Response, onEvent: (event: Record<string, unknown>) => void) {
  const reader = res.body?.getReader()
  if (!reader) return
  const decoder = new TextDecoder()
  let buf = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const parts = buf.split('\n\n')
    buf = parts.pop() ?? ''
    for (const part of parts) {
      const dataLine = part.split('\n').find(l => l.startsWith('data: '))
      if (dataLine) {
        try {
          onEvent(JSON.parse(dataLine.slice(6)) as Record<string, unknown>)
        } catch { /* ignore malformed */ }
      }
    }
  }
}
