import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { SearchBar } from '#/components/SearchBar'
import { VideoCard } from '#/components/VideoCard'

export const Route = createFileRoute('/video')({
  validateSearch: (search: Record<string, unknown>) => ({
    q: String(search.q ?? ''),
  }),
  component: VideoPage,
})

const VIDEO_PROMPTS = [
  {
    label: 'Ocean waves',
    emoji: '🌊',
    prompt:
      'slow motion ocean waves crashing on a rocky shore, sea spray catching golden sunlight, cinematic wide shot, 4k',
  },
  {
    label: 'Storm timelapse',
    emoji: '⛈️',
    prompt:
      'timelapse of dramatic storm clouds forming and rolling over mountain peaks, dark sky, lightning in the distance, epic atmosphere',
  },
  {
    label: 'Candle flame',
    emoji: '🕯️',
    prompt:
      'macro close-up of a single candle flame flickering gently in a breeze, soft dark background, warm orange glow, shallow depth of field',
  },
  {
    label: 'Cherry blossoms',
    emoji: '🌸',
    prompt:
      'cherry blossom petals falling slowly in spring wind, sunlight filtering through branches, soft bokeh, slow motion, Japanese garden',
  },
  {
    label: 'City at night',
    emoji: '🌆',
    prompt:
      'rain-soaked city street at night, neon signs reflecting on wet pavement, slow pan, cinematic film look, people with umbrellas',
  },
  {
    label: 'Aurora borealis',
    emoji: '🌌',
    prompt:
      'aurora borealis dancing in vivid green and purple across a clear night sky above a snow-covered pine forest, stars visible, timelapse',
  },
  {
    label: 'Waterfall mist',
    emoji: '💧',
    prompt:
      'tropical waterfall cascading into a turquoise pool, mist rising in golden afternoon light, lush jungle surrounding, slow motion',
  },
  {
    label: 'Butterfly macro',
    emoji: '🦋',
    prompt:
      'macro shot of a monarch butterfly slowly opening and closing its wings on a flower, morning dew on petals, soft green bokeh background',
  },
]

function VideoPage() {
  const { q } = Route.useSearch()
  const [promptId, setPromptId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!q) return

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
      .catch((e) => {
        if (e.name !== 'AbortError') setError('Failed to connect to ComfyUI')
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [q])

  // Empty state — full hero
  if (!q) {
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
            Describe a scene and get a ~5 second 720p video clip. Runs locally on Wan2.2 14B.
          </p>

          <div className="mx-auto max-w-2xl">
            <SearchBar size="hero" navigateTo="/video" />
            <p className="mt-4 text-xs text-[var(--sea-ink-soft)] opacity-60">
              Each clip takes ~3–8 min to generate
            </p>
          </div>
        </section>

        <section className="mt-8 px-4 pb-8">
          <p className="mb-4 text-sm font-semibold text-[var(--sea-ink-soft)]">
            Try a prompt
          </p>
          <div className="flex flex-wrap gap-3">
            {VIDEO_PROMPTS.map(({ label, emoji, prompt }) => (
              <Link
                key={label}
                to="/video"
                search={{ q: prompt }}
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

  // Active state — result layout
  return (
    <main className="page-wrap px-4 pb-16">
      {/* Compact search bar */}
      <div className="mb-8 max-w-2xl">
        <SearchBar defaultValue={q} size="compact" navigateTo="/video" />
      </div>

      {error && (
        <div className="island-shell mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Video result area */}
      <div className="mx-auto max-w-4xl">
        {loading && (
          <div className="aspect-video w-full animate-pulse rounded-2xl bg-[var(--sand)]" />
        )}

        {promptId && <VideoCard promptId={promptId} />}

        {/* Prompt + metadata */}
        <div className="mt-5 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <p className="text-sm text-[var(--sea-ink-soft)]">
            <span className="font-semibold text-[var(--sea-ink)]">Prompt: </span>
            {q}
          </p>
          <div className="flex shrink-0 items-center gap-2 sm:ml-6">
            <span className="rounded-full border border-[var(--line)] px-2.5 py-0.5 text-xs text-[var(--sea-ink-soft)]">
              1280 × 720
            </span>
            <span className="rounded-full border border-[var(--line)] px-2.5 py-0.5 text-xs text-[var(--sea-ink-soft)]">
              ~5 s · 16 fps
            </span>
            <span className="rounded-full border border-[var(--line)] px-2.5 py-0.5 text-xs text-[var(--sea-ink-soft)]">
              Wan2.2 T2V
            </span>
          </div>
        </div>

        {/* New prompt suggestions */}
        <div className="mt-8 border-t border-[var(--line)] pt-8">
          <p className="mb-4 text-sm font-semibold text-[var(--sea-ink-soft)]">Try another</p>
          <div className="flex flex-wrap gap-2">
            {VIDEO_PROMPTS.map(({ label, emoji, prompt }) => (
              <Link
                key={label}
                to="/video"
                search={{ q: prompt }}
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
