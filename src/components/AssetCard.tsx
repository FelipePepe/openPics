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
  | { phase: 'generating'; progress: number }
  | { phase: 'complete'; image: GenerationImage }
  | { phase: 'error' }

const POLL_INTERVAL = 1500

export function AssetCard({ promptId, index, onComplete, onOpen }: AssetCardProps) {
  const [state, setState] = useState<CardState>({ phase: 'generating', progress: 0 })
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    let tick = 0

    intervalRef.current = setInterval(async () => {
      tick++
      try {
        const res = await fetch(`/api/status/${promptId}`)
        const data = await res.json()

        if (data.status === 'complete' && data.image) {
          clearInterval(intervalRef.current!)
          setState({ phase: 'complete', image: data.image })
          onComplete?.(getImageProxyUrl(data.image), data.image.filename, index)
        } else {
          setState({ phase: 'generating', progress: Math.min(tick * 8, 90) })
        }
      } catch {
        clearInterval(intervalRef.current!)
        setState({ phase: 'error' })
      }
    }, POLL_INTERVAL)

    return () => clearInterval(intervalRef.current!)
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

  if (state.phase === 'generating') {
    return (
      <div
        className="island-shell relative aspect-square overflow-hidden rounded-2xl"
        style={{ animationDelay: delay }}
      >
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-[var(--sand)] to-[var(--foam)]" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6">
          <div className="h-1.5 w-40 overflow-hidden rounded-full bg-[var(--line)]">
            <div
              className="h-full rounded-full bg-[var(--lagoon-deep)] transition-all duration-700"
              style={{ width: `${state.progress}%` }}
            />
          </div>
          <p className="text-xs font-medium text-[var(--sea-ink-soft)]">
            Generating…
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
