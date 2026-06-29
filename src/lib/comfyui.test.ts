import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getGenerationStatus } from './comfyui'

const PROMPT_ID = 'test-prompt-id'

const MOCK_IMAGE = { filename: 'out.png', subfolder: '', type: 'output' }

function mockFetch(responses: Record<string, unknown>) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      const key = Object.keys(responses).find((k) => url.includes(k))
      if (!key) return Promise.resolve({ ok: false, status: 404 })
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(responses[key]),
      })
    }),
  )
}

beforeEach(() => vi.restoreAllMocks())

describe('getGenerationStatus', () => {
  it('returns complete when promptId is in /history', async () => {
    mockFetch({
      [`/history/${PROMPT_ID}`]: {
        [PROMPT_ID]: { outputs: { '9': { images: [MOCK_IMAGE] } } },
      },
    })

    const result = await getGenerationStatus(PROMPT_ID)

    expect(result.status).toBe('complete')
    expect(result.image).toEqual(MOCK_IMAGE)
  })

  it('returns running when promptId is in queue_running', async () => {
    mockFetch({
      [`/history/${PROMPT_ID}`]: {},
      '/queue': {
        queue_running: [[1, PROMPT_ID, {}, {}, []]],
        queue_pending: [],
      },
    })

    const result = await getGenerationStatus(PROMPT_ID)

    expect(result.status).toBe('running')
    expect(result.queuePosition).toBeUndefined()
  })

  it('returns queued with 1-based position when promptId is in queue_pending', async () => {
    mockFetch({
      [`/history/${PROMPT_ID}`]: {},
      '/queue': {
        queue_running: [],
        queue_pending: [
          [1, 'other-id', {}, {}, []],
          [2, PROMPT_ID, {}, {}, []],
        ],
      },
    })

    const result = await getGenerationStatus(PROMPT_ID)

    expect(result.status).toBe('queued')
    expect(result.queuePosition).toBe(2)
  })

  it('returns error when promptId is not found in history or queue', async () => {
    mockFetch({
      [`/history/${PROMPT_ID}`]: {},
      '/queue': {
        queue_running: [],
        queue_pending: [],
      },
    })

    const result = await getGenerationStatus(PROMPT_ID)

    expect(result.status).toBe('error')
  })
})
