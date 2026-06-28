import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState, useCallback } from 'react'
import { Download, ImageOff, Loader, Film, Clapperboard } from 'lucide-react'
import { getImageProxyUrl } from '#/lib/comfyui'
import type { GenerationImage } from '#/lib/comfyui'
import type { HistoryEntry, VideoFile } from './api/history'
import { Lightbox, type LightboxItem } from '#/components/Lightbox'

export const Route = createFileRoute('/library')({ component: LibraryPage })

function getVideoProxyUrl(video: VideoFile) {
  const params = new URLSearchParams({
    filename: video.filename,
    subfolder: video.subfolder ?? '',
    type: video.type ?? 'output',
  })
  return `/api/video/file?${params.toString()}`
}

function LibraryPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<LightboxItem | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    fetch('/api/history')
      .then((r) => r.json())
      .then((data) => setEntries(data.entries ?? []))
      .catch(() => setError('Could not load history from ComfyUI'))
      .finally(() => setLoading(false))
  }, [])

  // Flat list of images only for lightbox navigation (includes comfyParams for Animate)
  const allImages: LightboxItem[] = entries
    .flatMap((entry) =>
      entry.images.map((img: GenerationImage) => ({
        src: getImageProxyUrl(img),
        filename: img.filename,
        prompt: entry.prompt,
        index: 0,
        comfyParams: {
          filename: img.filename,
          subfolder: img.subfolder ?? '',
          type: img.type ?? 'output',
        },
      })),
    )
    .map((item, i) => ({ ...item, index: i }))

  const allVideos = entries.flatMap((entry) =>
    entry.videos.map((v) => ({
      src: getVideoProxyUrl(v),
      filename: v.filename,
      prompt: entry.prompt,
    })),
  )

  const openLightbox = useCallback(
    (src: string, filename: string, prompt: string) => {
      const index = allImages.findIndex((img) => img.src === src)
      setLightbox({ src, filename, prompt, index: index === -1 ? 0 : index })
    },
    [allImages],
  )

  const closeLightbox = useCallback(() => setLightbox(null), [])

  const handleAnimate = useCallback(
    (item: LightboxItem) => {
      if (!item.comfyParams) return
      closeLightbox()
      navigate({
        to: '/video',
        search: {
          imageFilename: item.comfyParams.filename,
          imageSubfolder: item.comfyParams.subfolder,
          imageType: item.comfyParams.type,
        },
      })
    },
    [closeLightbox, navigate],
  )

  const stepLightbox = useCallback(
    (dir: -1 | 1) => {
      if (!lightbox) return
      const next = allImages[lightbox.index + dir]
      if (next) setLightbox(next)
    },
    [lightbox, allImages],
  )

  useEffect(() => {
    if (!lightbox) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox()
      if (e.key === 'ArrowLeft') stepLightbox(-1)
      if (e.key === 'ArrowRight') stepLightbox(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox, closeLightbox, stepLightbox])

  useEffect(() => {
    document.body.style.overflow = lightbox ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [lightbox])

  const isEmpty = !loading && !error && allImages.length === 0 && allVideos.length === 0

  return (
    <main className="page-wrap px-4 pb-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--sea-ink)]">Library</h1>
          <p className="mt-1 text-sm text-[var(--sea-ink-soft)]">
            All images and videos generated in this ComfyUI session
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

      {isEmpty && (
        <div className="flex flex-col items-center justify-center py-24 text-[var(--sea-ink-soft)]">
          <ImageOff size={40} className="mb-4 opacity-40" />
          <p className="text-sm">No images or videos generated yet.</p>
          <Link to="/" className="mt-4 text-sm text-[var(--lagoon-deep)] no-underline hover:underline">
            Generate your first image →
          </Link>
        </div>
      )}

      {/* Videos section */}
      {allVideos.length > 0 && (
        <section className="mb-10">
          <div className="mb-4 flex items-center gap-2">
            <Film size={15} className="text-[var(--sea-ink-soft)]" />
            <h2 className="text-sm font-semibold text-[var(--sea-ink-soft)]">
              Videos
              <span className="ml-2 font-normal opacity-60">{allVideos.length}</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {allVideos.map((item) => (
              <VideoLibraryCard
                key={item.src}
                src={item.src}
                filename={item.filename}
                prompt={item.prompt}
              />
            ))}
          </div>
        </section>
      )}

      {/* Images section */}
      {allImages.length > 0 && (
        <section>
          {allVideos.length > 0 && (
            <div className="mb-4 flex items-center gap-2">
              <h2 className="text-sm font-semibold text-[var(--sea-ink-soft)]">
                Images
                <span className="ml-2 font-normal opacity-60">{allImages.length}</span>
              </h2>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {allImages.map((item) => (
              <LibraryCard
                key={item.src}
                src={item.src}
                filename={item.filename}
                prompt={item.prompt ?? ''}
                comfyParams={item.comfyParams!}
                onOpen={openLightbox}
              />
            ))}
          </div>
        </section>
      )}

      {lightbox && (
        <Lightbox
          item={lightbox}
          hasPrev={lightbox.index > 0}
          hasNext={lightbox.index < allImages.length - 1}
          onClose={closeLightbox}
          onPrev={() => stepLightbox(-1)}
          onNext={() => stepLightbox(1)}
          onAnimate={handleAnimate}
        />
      )}
    </main>
  )
}

function VideoLibraryCard({
  src,
  filename,
  prompt,
}: {
  src: string
  filename: string
  prompt: string
}) {
  function handleDownload(e: React.MouseEvent) {
    e.stopPropagation()
    const a = document.createElement('a')
    a.href = src
    a.download = filename
    a.click()
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="group relative overflow-hidden rounded-2xl bg-black">
        <video
          src={src}
          controls
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
      <p className="line-clamp-2 px-1 text-xs leading-snug text-[var(--sea-ink-soft)]">
        {prompt || <span className="italic">No prompt</span>}
      </p>
    </div>
  )
}

function LibraryCard({
  src,
  filename,
  prompt,
  comfyParams,
  onOpen,
}: {
  src: string
  filename: string
  prompt: string
  comfyParams: { filename: string; subfolder: string; type: string }
  onOpen: (src: string, filename: string, prompt: string) => void
}) {
  const navigate = useNavigate()

  function handleDownload(e: React.MouseEvent) {
    e.stopPropagation()
    const a = document.createElement('a')
    a.href = src
    a.download = filename
    a.click()
  }

  function handleAnimate(e: React.MouseEvent) {
    e.stopPropagation()
    navigate({
      to: '/video',
      search: {
        imageFilename: comfyParams.filename,
        imageSubfolder: comfyParams.subfolder,
        imageType: comfyParams.type,
      },
    })
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
        <div className="absolute inset-0 flex items-end justify-between bg-gradient-to-t from-black/60 via-transparent to-transparent p-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <button
            onClick={handleAnimate}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--surface-strong)] px-3 py-1.5 text-xs font-semibold text-[var(--sea-ink)] transition hover:bg-[var(--chip-bg)]"
          >
            <Clapperboard size={12} />
            Animate
          </button>
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
