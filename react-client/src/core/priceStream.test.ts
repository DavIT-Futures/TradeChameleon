import { act, renderHook } from '@testing-library/react'
import type { Quote } from '../api/types'
import { onQuotes, useQuote, useStream } from './priceStream'

const quote = (symbol: string, mid: number): Quote => ({
  symbol, bid: mid - 0.1, ask: mid + 0.1, mid, change: 0, changePct: 0, timestamp: new Date().toISOString(),
})

describe('price stream store (useSyncExternalStore)', () => {
  it('re-renders subscribers on every tick and builds sparklines', () => {
    const { result } = renderHook(() => useStream())
    act(() => onQuotes([quote('AAPL', 100), quote('SAP', 200)]))
    act(() => onQuotes([quote('AAPL', 101), quote('SAP', 199)]))
    expect(result.current.status).toBe('live')
    expect(result.current.quotes.get('AAPL')?.mid).toBe(101)
    expect(result.current.sparklines['SAP']?.slice(-2)).toEqual([200, 199])
  })

  it('useQuote selects a single instrument', () => {
    const { result } = renderHook(() => useQuote('SAP'))
    act(() => onQuotes([quote('SAP', 210)]))
    expect(result.current?.ask).toBeCloseTo(210.1)
  })
})
