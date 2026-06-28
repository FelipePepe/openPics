import { useEffect } from 'react'
import { X, ChevronLeft, ChevronRight, Download, Clapperboard } from 'lucide-react'

export interface LightboxItem {
  src: string
  filename: string
  prompt?: string
  index: number
  comfyParams?: { filename: string; subfolder: string; type: string }
}

interface LightboxProps {
  item: LightboxItem
  hasPrev: boolean
  hasNext: boolean
  onClose: () => void
  onPrev: () => void
  onNext: () => void
  onAnimate?: (item: LightboxItem) => void
}

export function Lightbox({ item, hasPrev, hasNext, onClose, onPrev, onNext, onAnimate }: LightboxProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') onPrev()
      if (e.key === 'ArrowRight') onNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onPrev, onNext])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  function handleDownload() {
    const a = document.createElement('a')
    a.href = item.src
    a.download = item.filename
    a.click()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[92dvh] max-w-[92dvw] flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute -right-4 -top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/25"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <img
          src={item.src}
          alt={item.prompt ?? 'Generated image'}
          className="max-h-[80dvh] max-w-full rounded-2xl object-contain shadow-2xl"
        />

        <div className="mt-4 flex w-full items-center justify-between gap-4">
          {item.prompt && (
            <p className="line-clamp-2 flex-1 text-sm text-white/70">{item.prompt}</p>
          )}
          <div className="flex shrink-0 items-center gap-2">
            {onAnimate && (
              <button
                onClick={() => onAnimate(item)}
                className="flex items-center gap-1.5 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/20"
              >
                <Clapperboard size={14} />
                Animate
              </button>
            )}
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/20"
            >
              <Download size={14} />
              Download
            </button>
          </div>
        </div>
      </div>

      {hasPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrev() }}
          className="absolute left-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/25"
          aria-label="Previous image"
        >
          <ChevronLeft size={24} />
        </button>
      )}

      {hasNext && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext() }}
          className="absolute right-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/25"
          aria-label="Next image"
        >
          <ChevronRight size={24} />
        </button>
      )}
    </div>
  )
}
