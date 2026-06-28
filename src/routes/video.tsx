import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { Upload, Clapperboard } from 'lucide-react'
import { SearchBar } from '#/components/SearchBar'
import { VideoCard } from '#/components/VideoCard'

export const Route = createFileRoute('/video')({
  validateSearch: (search: Record<string, unknown>) => ({
    q: String(search.q ?? ''),
    imageFilename: String(search.imageFilename ?? ''),
    imageSubfolder: String(search.imageSubfolder ?? ''),
    imageType: String(search.imageType ?? 'output'),
  }),
  component: VideoPage,
})

const VIDEO_PROMPTS = [
  {
    label: 'Ocean waves',
    emoji: '🌊',
    prompt: 'slow motion ocean waves crashing on a rocky shore, sea spray catching golden sunlight, cinematic wide shot, 4k',
  },
  {
    label: 'Storm timelapse',
    emoji: '⛈️',
    prompt: 'timelapse of dramatic storm clouds forming and rolling over mountain peaks, dark sky, lightning in the distance, epic atmosphere',
  },
  {
    label: 'Candle flame',
    emoji: '🕯️',
    prompt: 'macro close-up of a single candle flame flickering gently in a breeze, soft dark background, warm orange glow, shallow depth of field',
  },
  {
    label: 'Cherry blossoms',
    emoji: '🌸',
    prompt: 'cherry blossom petals falling slowly in spring wind, sunlight filtering through branches, soft bokeh, slow motion, Japanese garden',
  },
  {
    label: 'City at night',
    emoji: '🌆',
    prompt: 'rain-soaked city street at night, neon signs reflecting on wet pavement, slow pan, cinematic film look, people with umbrellas',
  },
  {
    label: 'Aurora borealis',
    emoji: '🌌',
    prompt: 'aurora borealis dancing in vivid green and purple across a clear night sky above a snow-covered pine forest, stars visible, timelapse',
  },
  {
    label: 'Waterfall mist',
    emoji: '💧',
    prompt: 'tropical waterfall cascading into a turquoise pool, mist rising in golden afternoon light, lush jungle surrounding, slow motion',
  },
  {
    label: 'Butterfly macro',
    emoji: '🦋',
    prompt: 'macro shot of a monarch butterfly slowly opening and closing its wings on a flower, morning dew on petals, soft green bokeh background',
  },
]

function VideoPage() {
  const { q, imageFilename, imageSubfolder, imageType } = Route.useSearch()
  const [promptId, setPromptId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [motionPrompt, setMotionPrompt] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isI2V = Boolean(imageFilename)
  const imageSrc = isI2V
    ? `/api/image?filename=${encodeURIComponent(imageFilename)}&subfolder=${encodeURIComponent(imageSubfolder)}&type=${encodeURIComponent(imageType)}`
    : null

  // T2V: auto-submit when q is set
  useEffect(() => {
    if (!q || isI2V) return

    const controller = new AbortController()
    setLoading(true)
    setError(null)
    setPromptId(null)

    fetch('/api/video/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: q }),
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.promptId) setPromptId(data.promptId)
        else setError(data.error ?? 'Unknown error')
      })
      .catch((e) => { if (e.name !== 'AbortError') setError('Failed to connect to ComfyUI') })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [q, isI2V])

  // I2V: manual submit (user optionally adds motion prompt first)
  function handleAnimate() {
    if (!imageFilename) return
    setLoading(true)
    setError(null)
    setPromptId(null)

    fetch('/api/video/generate-from-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: motionPrompt.trim(),
        comfyFilename: imageFilename,
        comfySubfolder: imageSubfolder,
        comfyType: imageType,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.promptId) setPromptId(data.promptId)
        else setError(data.error ?? 'Unknown error')
      })
      .catch(() => setError('Failed to connect to ComfyUI'))
      .finally(() => setLoading(false))
  }

  // PC upload → navigate to I2V setup
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('image', file)
      const res = await fetch('/api/video/upload-image', { method: 'POST', body: form })
      const data = await res.json()
      if (data.filename) {
        // Navigate to I2V setup with the uploaded filename (type=input = already in ComfyUI input folder)
        window.location.href = `/video?imageFilename=${encodeURIComponent(data.filename)}&imageSubfolder=&imageType=input`
      } else {
        setError(data.error ?? 'Upload failed')
      }
    } catch {
      setError('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  // ── Empty state (T2V hero) ────────────────────────────────────────────────
  if (!q && !isI2V) {
    return (
      <main className="page-wrap">
        <section className="island-shell rise-in relative overflow-hidden rounded-[2rem] px-6 py-20 text-center sm:px-10 sm:py-28">
          <div className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-[radial-gradient(circle,var(--hero-a),transparent_66%)]" />
          <div className="pointer-events-none absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-[radial-gradient(circle,var(--hero-b),transparent_66%)]" />

          <p className="island-kicker mb-4 text-sm">Powered by Wan2.2 T2V · ComfyUI</p>
          <h1 className="display-title mx-auto mb-4 max-w-2xl text-4xl font-bold leading-tight tracking-tight text-[var(--sea-ink)] sm:text-6xl">
            Turn your words into{' '}
            <em className="not-italic text-[var(--lagoon-deep)]">videos</em>
          </h1>
          <p className="mx-auto mb-10 max-w-lg text-base text-[var(--sea-ink-soft)] sm:text-lg">
            Describe a scene or animate one of your images. Runs locally on Wan2.2 14B.
          </p>

          <div className="mx-auto max-w-2xl">
            <SearchBar size="hero" navigateTo="/video" />
            <div className="mt-5 flex items-center justify-center gap-4">
              <p className="text-xs text-[var(--sea-ink-soft)] opacity-60">~3–8 min per clip</p>
              <span className="text-[var(--line)]">·</span>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-[var(--sea-ink-soft)] transition hover:text-[var(--sea-ink)]">
                <Upload size={13} />
                {uploading ? 'Uploading…' : 'Animate an image'}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
              </label>
            </div>
          </div>
        </section>

        <section className="mt-8 px-4 pb-8">
          <p className="mb-4 text-sm font-semibold text-[var(--sea-ink-soft)]">Try a prompt</p>
          <div className="flex flex-wrap gap-3">
            {VIDEO_PROMPTS.map(({ label, emoji, prompt }) => (
              <Link
                key={label}
                to="/video"
                search={{ q: prompt, imageFilename: '', imageSubfolder: '', imageType: 'output' }}
                className="flex items-center gap-2 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2 text-sm font-medium text-[var(--sea-ink)] no-underline transition hover:border-[var(--lagoon)] hover:bg-[var(--link-bg-hover)]"
              >
                <span>{emoji}</span>
                {label}
              </Link>
            ))}
          </div>
        </section>
      </main>
    )
  }

  // ── I2V setup (image selected, not yet generating) ────────────────────────
  if (isI2V && !promptId && !loading) {
    return (
      <main className="page-wrap px-4 pb-16">
        <div className="mb-8 max-w-2xl">
          <SearchBar defaultValue="" size="compact" navigateTo="/video" />
        </div>

        <div className="mx-auto max-w-3xl">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-[var(--sea-ink)]">Animate image</h2>
            <p className="mt-1 text-sm text-[var(--sea-ink-soft)]">
              Wan2.2 will animate this image into a ~5 second video clip.
            </p>
          </div>

          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            {/* Source image preview */}
            <div className="w-full overflow-hidden rounded-2xl sm:w-64 sm:shrink-0">
              <img
                src={imageSrc!}
                alt="Source image"
                className="aspect-square w-full object-cover"
              />
            </div>

            {/* Controls */}
            <div className="flex flex-1 flex-col gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--sea-ink)]">
                  Motion prompt <span className="font-normal text-[var(--sea-ink-soft)]">(optional)</span>
                </label>
                <textarea
                  value={motionPrompt}
                  onChange={(e) => setMotionPrompt(e.target.value)}
                  placeholder="Describe the motion: camera slowly panning left, leaves rustling in the wind, waves gently moving…"
                  rows={4}
                  className="w-full resize-none rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-[var(--sea-ink)] placeholder:text-[var(--sea-ink-soft)] outline-none focus:border-[var(--lagoon)] focus:ring-2 focus:ring-[var(--lagoon)]/20"
                />
                <p className="mt-1.5 text-xs text-[var(--sea-ink-soft)] opacity-70">
                  Leave empty to let Wan2.2 decide the motion automatically.
                </p>
              </div>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-400">
                  {error}
                </div>
              )}

              <button
                onClick={handleAnimate}
                className="flex items-center justify-center gap-2 rounded-xl bg-[var(--lagoon-deep)] px-6 py-3 font-semibold text-white transition hover:opacity-90 active:scale-95"
              >
                <Clapperboard size={16} />
                Animate · ~3–8 min
              </button>
            </div>
          </div>
        </div>
      </main>
    )
  }

  // ── Generating / result (T2V or I2V) ─────────────────────────────────────
  return (
    <main className="page-wrap px-4 pb-16">
      <div className="mb-8 max-w-2xl">
        <SearchBar defaultValue={q} size="compact" navigateTo="/video" />
      </div>

      {error && (
        <div className="island-shell mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="mx-auto max-w-4xl">
        {/* I2V: show source image alongside result */}
        {isI2V && imageSrc && (
          <div className="mb-4 flex items-center gap-3">
            <img src={imageSrc} alt="Source" className="h-14 w-14 rounded-xl object-cover" />
            <div>
              <p className="text-sm font-medium text-[var(--sea-ink)]">Animating image</p>
              {motionPrompt && (
                <p className="text-xs text-[var(--sea-ink-soft)]">{motionPrompt}</p>
              )}
            </div>
          </div>
        )}

        {loading && (
          <div className="aspect-video w-full animate-pulse rounded-2xl bg-[var(--sand)]" />
        )}

        {promptId && <VideoCard promptId={promptId} />}

        <div className="mt-5 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <p className="text-sm text-[var(--sea-ink-soft)]">
            {isI2V ? (
              <><span className="font-semibold text-[var(--sea-ink)]">Mode: </span>Image to Video</>
            ) : (
              <><span className="font-semibold text-[var(--sea-ink)]">Prompt: </span>{q}</>
            )}
          </p>
          <div className="flex shrink-0 items-center gap-2 sm:ml-6">
            <span className="rounded-full border border-[var(--line)] px-2.5 py-0.5 text-xs text-[var(--sea-ink-soft)]">1280 × 720</span>
            <span className="rounded-full border border-[var(--line)] px-2.5 py-0.5 text-xs text-[var(--sea-ink-soft)]">~5 s · 16 fps</span>
            <span className="rounded-full border border-[var(--line)] px-2.5 py-0.5 text-xs text-[var(--sea-ink-soft)]">
              {isI2V ? 'Wan2.2 I2V' : 'Wan2.2 T2V'}
            </span>
          </div>
        </div>

        <div className="mt-8 border-t border-[var(--line)] pt-8">
          <p className="mb-4 text-sm font-semibold text-[var(--sea-ink-soft)]">Try another</p>
          <div className="flex flex-wrap gap-2">
            {VIDEO_PROMPTS.map(({ label, emoji, prompt }) => (
              <Link
                key={label}
                to="/video"
                search={{ q: prompt, imageFilename: '', imageSubfolder: '', imageType: 'output' }}
                className="flex items-center gap-2 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1.5 text-xs font-medium text-[var(--sea-ink)] no-underline transition hover:border-[var(--lagoon)] hover:bg-[var(--link-bg-hover)]"
              >
                <span>{emoji}</span>
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
