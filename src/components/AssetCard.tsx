import { Download, RefreshCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { GenerationImage } from '#/lib/comfyui'
import { getImageProxyUrl } from '#/lib/comfyui'

interface AssetCardProps {
  promptId: string
  index: number
  onComplete?: (src: string, filename: string, cardIndex: number) => void
  onOpen?: (src: string, filename: string, cardIndex: number) => void
}

type CardState =
  | { phase: 'queued'; position: number }
  | { phase: 'running'; startedAt: number }
  | { phase: 'complete'; image: GenerationImage }
  | { phase: 'error' }

const POLL_INTERVAL = 1500

export function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes === 0) return `${seconds}s`
  return `${minutes}m ${seconds}s`
}

function ordinal(n: number): string {
  if (n === 1) return '1st'
  if (n === 2) return '2nd'
  if (n === 3) return '3rd'
  return `${n}th`
}

export function AssetCard({ promptId, index, onComplete, onOpen }: AssetCardProps) {
  const [state, setState] = useState<CardState>({ phase: 'queued', position: 0 })
  const [elapsed, setElapsed] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startedAtRef = useRef<number | null>(null)
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    intervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/status/${promptId}`)
        const data = await res.json()

        if (data.status === 'complete' && data.image) {
          clearInterval(intervalRef.current!)
          clearInterval(elapsedTimerRef.current!)
          setState({ phase: 'complete', image: data.image })
          onComplete?.(getImageProxyUrl(data.image), data.image.filename, index)
        } else if (data.status === 'running') {
          if (startedAtRef.current === null) {
            startedAtRef.current = Date.now()
            elapsedTimerRef.current = setInterval(() => {
              setElapsed(Date.now() - startedAtRef.current!)
            }, 1000)
          }
          setState((prev) => prev.phase === 'running' ? prev : { phase: 'running', startedAt: startedAtRef.current! })
        } else if (data.status === 'queued') {
          setState({ phase: 'queued', position: data.queuePosition ?? 0 })
        } else {
          clearInterval(intervalRef.current!)
          clearInterval(elapsedTimerRef.current!)
          setState({ phase: 'error' })
        }
      } catch {
        clearInterval(intervalRef.current!)
        clearInterval(elapsedTimerRef.current!)
        setState({ phase: 'error' })
      }
    }, POLL_INTERVAL)

    return () => {
      clearInterval(intervalRef.current!)
      clearInterval(elapsedTimerRef.current!)
    }
  }, [promptId])

  function handleDownload() {
    if (state.phase !== 'complete') return
    const url = getImageProxyUrl(state.image)
    const a = document.createElement('a')
    a.href = url
    a.download = state.image.filename
    a.click()
  }

  const delay = `${index * 80}ms`

  if (state.phase === 'error') {
    return (
      <div
        className="island-shell flex aspect-square items-center justify-center rounded-2xl p-6 text-center"
        style={{ animationDelay: delay }}
      >
        <div>
          <RefreshCw className="mx-auto mb-2 text-[var(--sea-ink-soft)]" size={24} />
          <p className="text-sm text-[var(--sea-ink-soft)]">Generation failed</p>
        </div>
      </div>
    )
  }

  if (state.phase === 'queued') {
    return (
      <div
        className="island-shell relative aspect-square overflow-hidden rounded-2xl"
        style={{ animationDelay: delay }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--sand)] to-[var(--foam)]" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6">
          {state.position > 0 && (
            <span className="rounded-full border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-1 text-xs font-semibold text-[var(--sea-ink)]">
              {ordinal(state.position)} in queue
            </span>
          )}
          <p className="text-xs text-[var(--sea-ink-soft)]">Waiting…</p>
        </div>
      </div>
    )
  }

  if (state.phase === 'running') {
    return (
      <div
        className="island-shell relative aspect-square overflow-hidden rounded-2xl"
        style={{ animationDelay: delay }}
      >
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-[var(--sand)] to-[var(--foam)]" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6">
          <div className="h-1 w-24 overflow-hidden rounded-full bg-[var(--line)]">
            <div className="h-full w-full origin-left animate-[shimmer_1.5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-[var(--lagoon-deep)] to-transparent" />
          </div>
          <p className="text-xs font-medium tabular-nums text-[var(--sea-ink-soft)]">
            Generating · {formatElapsed(elapsed)}
          </p>
        </div>
      </div>
    )
  }

  const src = getImageProxyUrl(state.image)

  return (
    <div
      className="rise-in group relative aspect-square cursor-zoom-in overflow-hidden rounded-2xl"
      style={{ animationDelay: delay }}
      onClick={() => onOpen?.(src, state.image.filename, index)}
    >
      <img
        src={src}
        alt="Generated image"
        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
        loading="lazy"
      />
      <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 via-transparent to-transparent p-4 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <button
          onClick={(e) => { e.stopPropagation(); handleDownload() }}
          className="flex items-center gap-2 rounded-xl bg-[var(--surface-strong)] px-4 py-2 text-xs font-semibold text-[var(--sea-ink)] transition hover:bg-[var(--chip-bg)]"
        >
          <Download size={14} />
          Download
        </button>
      </div>
    </div>
  )
}
