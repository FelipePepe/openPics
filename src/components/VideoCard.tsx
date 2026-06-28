import { RefreshCw, Download, Play } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { VideoOutput } from '#/lib/wan_workflow'

interface VideoCardProps {
  promptId: string
}

type CardState =
  | { phase: 'generating'; tick: number }
  | { phase: 'complete'; video: VideoOutput }
  | { phase: 'error' }

const POLL_INTERVAL = 3000

function getVideoProxyUrl(video: VideoOutput) {
  const params = new URLSearchParams({
    filename: video.filename,
    subfolder: video.subfolder ?? '',
    type: video.type ?? 'output',
  })
  return `/api/video/file?${params.toString()}`
}

export function VideoCard({ promptId }: VideoCardProps) {
  const [state, setState] = useState<CardState>({ phase: 'generating', tick: 0 })
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    let tick = 0

    intervalRef.current = setInterval(async () => {
      tick++
      try {
        const res = await fetch(`/api/video/status/${promptId}`)
        const data = await res.json()

        if (data.status === 'complete' && data.video) {
          clearInterval(intervalRef.current!)
          setState({ phase: 'complete', video: data.video })
        } else if (data.status === 'error') {
          clearInterval(intervalRef.current!)
          setState({ phase: 'error' })
        } else {
          setState({ phase: 'generating', tick })
        }
      } catch {
        clearInterval(intervalRef.current!)
        setState({ phase: 'error' })
      }
    }, POLL_INTERVAL)

    return () => clearInterval(intervalRef.current!)
  }, [promptId])

  if (state.phase === 'error') {
    return (
      <div className="island-shell flex aspect-video w-full items-center justify-center rounded-2xl p-8 text-center">
        <div>
          <RefreshCw className="mx-auto mb-3 text-[var(--sea-ink-soft)]" size={28} />
          <p className="text-sm font-medium text-[var(--sea-ink-soft)]">Generation failed</p>
          <p className="mt-1 text-xs text-[var(--sea-ink-soft)] opacity-70">
            Check ComfyUI logs for details
          </p>
        </div>
      </div>
    )
  }

  if (state.phase === 'generating') {
    // Slow progress: each tick is 3s, reaches 90% around 4.5 min (realistic for 50-step Wan2.2)
    const progress = Math.min(state.tick * 1, 90)
    const elapsed = state.tick * 3
    const minutes = Math.floor(elapsed / 60)
    const seconds = elapsed % 60
    const elapsedLabel = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`

    return (
      <div className="island-shell relative aspect-video w-full overflow-hidden rounded-2xl">
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-[var(--sand)] to-[var(--foam)]" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8">
          <div className="flex items-center gap-2 text-[var(--sea-ink-soft)]">
            <Play size={16} className="opacity-60" />
            <span className="text-sm font-medium">Generating video…</span>
          </div>
          <div className="h-1.5 w-64 overflow-hidden rounded-full bg-[var(--line)]">
            <div
              className="h-full rounded-full bg-[var(--lagoon-deep)] transition-all duration-1000"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-[var(--sea-ink-soft)] opacity-60">
            {elapsedLabel} elapsed · ~3–8 min total
          </p>
        </div>
      </div>
    )
  }

  const src = getVideoProxyUrl(state.video)

  function handleDownload() {
    const a = document.createElement('a')
    a.href = src
    a.download = state.phase === 'complete' ? state.video.filename : 'video.mp4'
    a.click()
  }

  return (
    <div className="rise-in group relative w-full overflow-hidden rounded-2xl bg-black">
      <video
        src={src}
        controls
        autoPlay
        loop
        playsInline
        className="aspect-video w-full object-contain"
      />
      <div className="absolute right-3 top-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <button
          onClick={handleDownload}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--surface-strong)] px-3 py-1.5 text-xs font-semibold text-[var(--sea-ink)] transition hover:bg-[var(--chip-bg)]"
        >
          <Download size={12} />
          Download
        </button>
      </div>
    </div>
  )
}
