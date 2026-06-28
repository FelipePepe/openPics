import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState, useCallback } from 'react'
import { Download, ImageOff, Loader } from 'lucide-react'
import { getImageProxyUrl } from '#/lib/comfyui'
import type { HistoryEntry } from './api/history'
import { Lightbox, type LightboxItem } from '#/components/Lightbox'

export const Route = createFileRoute('/library')({ component: LibraryPage })

function LibraryPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<LightboxItem | null>(null)

  useEffect(() => {
    fetch('/api/history')
      .then((r) => r.json())
      .then((data) => setEntries(data.entries ?? []))
      .catch(() => setError('Could not load history from ComfyUI'))
      .finally(() => setLoading(false))
  }, [])

  // Flat list of all images across all entries, for prev/next navigation
  const allImages: LightboxItem[] = entries.flatMap((entry) =>
    entry.images.map((img) => ({
      src: getImageProxyUrl(img),
      filename: img.filename,
      prompt: entry.prompt,
      index: 0, // will be set below
    })),
  ).map((item, i) => ({ ...item, index: i }))

  const openLightbox = useCallback(
    (src: string, filename: string, prompt: string) => {
      const index = allImages.findIndex((img) => img.src === src)
      setLightbox({ src, filename, prompt, index: index === -1 ? 0 : index })
    },
    [allImages],
  )

  const closeLightbox = useCallback(() => setLightbox(null), [])

  const navigate = useCallback(
    (dir: -1 | 1) => {
      if (!lightbox) return
      const next = allImages[lightbox.index + dir]
      if (next) setLightbox(next)
    },
    [lightbox, allImages],
  )

  // Keyboard navigation
  useEffect(() => {
    if (!lightbox) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox()
      if (e.key === 'ArrowLeft') navigate(-1)
      if (e.key === 'ArrowRight') navigate(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox, closeLightbox, navigate])

  // Lock body scroll when lightbox is open
  useEffect(() => {
    document.body.style.overflow = lightbox ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [lightbox])

  return (
    <main className="page-wrap px-4 pb-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--sea-ink)]">Library</h1>
          <p className="mt-1 text-sm text-[var(--sea-ink-soft)]">
            All images generated in this ComfyUI session
          </p>
        </div>
        <Link
          to="/"
          className="rounded-xl border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--sea-ink-soft)] no-underline transition hover:border-[var(--lagoon)] hover:text-[var(--sea-ink)]"
        >
          + New prompt
        </Link>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-24 text-[var(--sea-ink-soft)]">
          <Loader size={20} className="mr-2 animate-spin" />
          Loading history…
        </div>
      )}

      {error && (
        <div className="island-shell rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-400">
          {error}
        </div>
      )}

      {!loading && !error && entries.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-[var(--sea-ink-soft)]">
          <ImageOff size={40} className="mb-4 opacity-40" />
          <p className="text-sm">No images generated yet.</p>
          <Link to="/" className="mt-4 text-sm text-[var(--lagoon-deep)] no-underline hover:underline">
            Generate your first image →
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {allImages.map((item) => (
          <LibraryCard
            key={item.src}
            src={item.src}
            filename={item.filename}
            prompt={item.prompt}
            onOpen={openLightbox}
          />
        ))}
      </div>

      {lightbox && (
        <Lightbox
          item={lightbox}
          hasPrev={lightbox.index > 0}
          hasNext={lightbox.index < allImages.length - 1}
          onClose={closeLightbox}
          onPrev={() => navigate(-1)}
          onNext={() => navigate(1)}
        />
      )}
    </main>
  )
}

function LibraryCard({
  src,
  filename,
  prompt,
  onOpen,
}: {
  src: string
  filename: string
  prompt: string
  onOpen: (src: string, filename: string, prompt: string) => void
}) {
  function handleDownload(e: React.MouseEvent) {
    e.stopPropagation()
    const a = document.createElement('a')
    a.href = src
    a.download = filename
    a.click()
  }

  return (
    <div className="flex cursor-zoom-in flex-col gap-2" onClick={() => onOpen(src, filename, prompt)}>
      <div className="group relative aspect-square overflow-hidden rounded-2xl">
        <img
          src={src}
          alt={prompt}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          loading="lazy"
        />
        <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 via-transparent to-transparent p-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--surface-strong)] px-3 py-1.5 text-xs font-semibold text-[var(--sea-ink)] transition hover:bg-[var(--chip-bg)]"
          >
            <Download size={12} />
            Download
          </button>
        </div>
      </div>
      <p className="line-clamp-2 px-1 text-xs leading-snug text-[var(--sea-ink-soft)]">
        {prompt || <span className="italic">No prompt</span>}
      </p>
    </div>
  )
}

