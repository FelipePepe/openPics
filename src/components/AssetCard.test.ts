// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { createElement } from 'react'
import { formatElapsed, AssetCard } from './AssetCard'

describe('formatElapsed', () => {
  it('returns "0s" for 0ms', () => {
    expect(formatElapsed(0)).toBe('0s')
  })

  it('returns seconds only when under 1 minute', () => {
    expect(formatElapsed(59000)).toBe('59s')
  })

  it('returns minutes and seconds when 90s elapsed', () => {
    expect(formatElapsed(90000)).toBe('1m 30s')
  })

  it('handles large values correctly', () => {
    expect(formatElapsed(3661000)).toBe('61m 1s')
  })
})

describe('AssetCard poll sequence', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

  it('transitions queued → running → complete across polls', async () => {
    const responses = [
      { status: 'queued', queuePosition: 2 },
      { status: 'running' },
      { status: 'complete', image: { filename: 'out.png', subfolder: '', type: 'output' } },
    ]
    let call = 0
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(responses[Math.min(call++, responses.length - 1)]) }),
    ))

    render(createElement(AssetCard, { promptId: 'p1', index: 0 }))

    // After first poll → queued
    await act(async () => { vi.advanceTimersByTime(1500); await Promise.resolve() })
    expect(screen.getByText('2nd in queue')).toBeTruthy()

    // After second poll → running
    await act(async () => { vi.advanceTimersByTime(1500); await Promise.resolve() })
    expect(screen.getByText(/Generating/)).toBeTruthy()

    // After third poll → complete (image rendered)
    await act(async () => { vi.advanceTimersByTime(1500); await Promise.resolve() })
    expect(screen.getByAltText('Generated image')).toBeTruthy()
  })
})
