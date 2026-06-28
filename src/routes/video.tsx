import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { Upload, Clapperboard, Sparkles, Shuffle } from 'lucide-react'
import { SearchBar } from '#/components/SearchBar'
import { VideoCard } from '#/components/VideoCard'

export const Route = createFileRoute('/video')({
  validateSearch: (search: Record<string, unknown>) => ({
    q: String(search.q ?? ''),
    promptId: String(search.promptId ?? ''),
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
  const { q, promptId: urlPromptId, imageFilename, imageSubfolder, imageType } = Route.useSearch()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [motionPrompt, setMotionPrompt] = useState('')
  const [enhancingMotion, setEnhancingMotion] = useState(false)
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 2 ** 32))
  const [resolution, setResolution] = useState<'480p' | '720p'>('720p')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const promptId = urlPromptId || null
  const isI2V = Boolean(imageFilename)
  const imageSrc = isI2V
    ? `/api/image?filename=${encodeURIComponent(imageFilename)}&subfolder=${encodeURIComponent(imageSubfolder)}&type=${encodeURIComponent(imageType)}`
    : null

  function setPromptId(id: string) {
    navigate({ to: '/video', search: (prev) => ({ ...prev, promptId: id }), replace: true })
  }

  // T2V: auto-submit when q is set and no promptId yet
  useEffect(() => {
    if (!q || isI2V || urlPromptId) return

    const controller = new AbortController()
    setLoading(true)
    setError(null)

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
  }, [q, isI2V, urlPromptId])

  // I2V: manual submit (user optionally adds motion prompt first)
  function handleAnimate() {
    if (!imageFilename) return
    setLoading(true)
    setError(null)

    fetch('/api/video/generate-from-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: motionPrompt.trim(),
        comfyFilename: imageFilename,
        comfySubfolder: imageSubfolder,
        comfyType: imageType,
        seed,
        resolution,
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

  async function handleEnhanceMotion() {
    const q = motionPrompt.trim()
    if (!q || enhancingMotion) return
    setEnhancingMotion(true)
    try {
      const res = await fetch('/api/enhance-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: q, type: 'video' }),
      })
      const data = await res.json()
      if (data.enhanced) setMotionPrompt(data.enhanced)
    } catch {
      // silently fail
    } finally {
      setEnhancingMotion(false)
    }
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
    const MAX_CHARS = 2000
    const charCount = motionPrompt.length

    return (
      <main className="page-wrap px-4 pb-16">
        <div className="mb-8 max-w-2xl">
          <SearchBar defaultValue="" size="compact" navigateTo="/video" />
        </div>

        <div className="mx-auto max-w-4xl">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-[var(--sea-ink)]">Animate image</h2>
            <p className="mt-1 text-sm text-[var(--sea-ink-soft)]">
              Wan2.2 14B will animate this image into a short video clip.
            </p>
          </div>

          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            {/* ── Left: source image ────────────────────────────────────── */}
            <div className="w-full lg:w-72 lg:shrink-0">
              <div className="overflow-hidden rounded-2xl border border-[var(--line)]">
                <img
                  src={imageSrc!}
                  alt="Source image"
                  className="aspect-square w-full object-cover"
                />
              </div>
              <p className="mt-2 text-center text-xs text-[var(--sea-ink-soft)] opacity-60">
                Source image
              </p>
            </div>

            {/* ── Right: controls ───────────────────────────────────────── */}
            <div className="flex flex-1 flex-col gap-5">

              {/* Motion prompt */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium text-[var(--sea-ink)]">
                    Motion prompt
                    <span className="ml-1.5 font-normal text-[var(--sea-ink-soft)]">(optional)</span>
                  </label>
                  {motionPrompt.trim() && (
                    <button
                      type="button"
                      onClick={handleEnhanceMotion}
                      disabled={enhancingMotion}
                      className="flex items-center gap-1.5 rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-2.5 py-1 text-xs font-medium text-[var(--sea-ink-soft)] transition hover:border-[var(--lagoon)] hover:text-[var(--sea-ink)] disabled:opacity-50"
                    >
                      <Sparkles size={11} className={enhancingMotion ? 'animate-spin' : ''} />
                      {enhancingMotion ? 'Enhancing…' : 'Enhance'}
                    </button>
                  )}
                </div>
                <textarea
                  value={motionPrompt}
                  onChange={(e) => setMotionPrompt(e.target.value.slice(0, MAX_CHARS))}
                  placeholder="Describe the motion: camera slowly panning left, leaves rustling in the wind, waves gently moving…"
                  rows={4}
                  className="w-full resize-none rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-[var(--sea-ink)] placeholder:text-[var(--sea-ink-soft)] outline-none focus:border-[var(--lagoon)] focus:ring-2 focus:ring-[var(--lagoon)]/20"
                />
                <div className="mt-1.5 flex items-center justify-between">
                  <p className="text-xs text-[var(--sea-ink-soft)] opacity-60">
                    Leave empty to let Wan2.2 decide automatically.
                  </p>
                  <span className={`text-xs tabular-nums ${charCount > MAX_CHARS * 0.9 ? 'text-amber-500' : 'text-[var(--sea-ink-soft)] opacity-50'}`}>
                    {charCount}/{MAX_CHARS}
                  </span>
                </div>
              </div>

              {/* Settings row */}
              <div className="flex flex-wrap gap-4">

                {/* Resolution */}
                <div className="flex-1 min-w-[140px]">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--sea-ink-soft)]">Resolution</p>
                  <div className="flex rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] p-1">
                    {(['480p', '720p'] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setResolution(r)}
                        className={`flex-1 rounded-lg py-1.5 text-sm font-medium transition ${
                          resolution === r
                            ? 'bg-[var(--lagoon-deep)] text-white shadow-sm'
                            : 'text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]'
                        }`}
                      >
                        {r === '480p' ? '480P · Fast' : '720P · Best'}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs text-[var(--sea-ink-soft)] opacity-60">
                    {resolution === '480p' ? '480×480 · ~half VRAM · faster' : '768×768 · full quality'}
                  </p>
                </div>

                {/* Seed */}
                <div className="flex-1 min-w-[140px]">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--sea-ink-soft)]">Seed</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={seed}
                      onChange={(e) => setSeed(Number(e.target.value))}
                      min={0}
                      max={2 ** 32 - 1}
                      className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-sm tabular-nums text-[var(--sea-ink)] outline-none focus:border-[var(--lagoon)] focus:ring-2 focus:ring-[var(--lagoon)]/20"
                    />
                    <button
                      type="button"
                      onClick={() => setSeed(Math.floor(Math.random() * 2 ** 32))}
                      title="Randomize seed"
                      className="shrink-0 flex items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] p-2 text-[var(--sea-ink-soft)] transition hover:border-[var(--lagoon)] hover:text-[var(--sea-ink)]"
                    >
                      <Shuffle size={16} />
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs text-[var(--sea-ink-soft)] opacity-60">
                    Same seed + prompt = reproducible result
                  </p>
                </div>
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
            <span className="rounded-full border border-[var(--line)] px-2.5 py-0.5 text-xs text-[var(--sea-ink-soft)]">~3.4 s · 24 fps</span>
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
