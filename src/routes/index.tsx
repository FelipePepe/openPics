import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { SearchBar } from '#/components/SearchBar'
import type { AspectRatio } from '#/lib/workflow'

export const Route = createFileRoute('/')({ component: HomePage })

const PROMPTS = [
  {
    label: 'Golden hour forest',
    emoji: '🌿',
    prompt:
      'a misty old-growth forest at golden hour, shafts of warm sunlight piercing through ancient oak canopies, soft bokeh undergrowth, photorealistic, 8k',
  },
  {
    label: 'Brutalist city at night',
    emoji: '🏛️',
    prompt:
      'brutalist concrete megastructure at night, dramatic uplighting casting deep shadows, rain-slicked plaza reflecting neon signs, cinematic wide shot, moody atmosphere',
  },
  {
    label: 'Portrait in studio',
    emoji: '🧑',
    prompt:
      'close-up portrait of a weathered old sailor, silver stubble, piercing blue eyes, soft studio rim lighting, shallow depth of field, film grain, Leica lens look',
  },
  {
    label: 'Cyberpunk lab',
    emoji: '💡',
    prompt:
      'futuristic research laboratory inside a skyscraper, holographic data panels, scientists in white suits, blue and purple ambient lighting, ultra-detailed interior design render',
  },
  {
    label: 'Ramen close-up',
    emoji: '🍜',
    prompt:
      'steaming bowl of tonkotsu ramen, perfectly arranged chashu pork slices, soft-boiled egg cut in half, rich cloudy broth, macro food photography, professional studio lighting, shallow depth of field',
  },
  {
    label: 'Santorini at sunset',
    emoji: '✈️',
    prompt:
      'iconic white-washed Santorini cliffside village at sunset, deep orange and pink sky, blue-domed church in foreground, Aegean sea below, travel photography, golden hour',
  },
  {
    label: 'Ink watercolor dream',
    emoji: '🎨',
    prompt:
      'abstract dreamscape painted in flowing ink and watercolor washes, swirling deep teal and burnt sienna, delicate paper texture visible, Japanese sumi-e influence, editorial art print',
  },
  {
    label: 'Fox in snow',
    emoji: '🐾',
    prompt:
      'red fox standing still in a silent snow-covered pine forest, breath visible in cold air, soft overcast winter light, telephoto wildlife photography, shallow focus on face',
  },
]

const RATIOS: { value: AspectRatio; label: string; icon: string }[] = [
  { value: 'square', label: 'Square', icon: '⬛' },
  { value: 'landscape', label: 'Landscape', icon: '▬' },
  { value: 'portrait', label: 'Portrait', icon: '▮' },
]

function HomePage() {
  const [ratio, setRatio] = useState<AspectRatio>('square')
  const [count, setCount] = useState(4)

  return (
    <main className="page-wrap">
      <section className="island-shell rise-in relative overflow-hidden rounded-[2rem] px-6 py-20 text-center sm:px-10 sm:py-28">
        <div className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-[radial-gradient(circle,var(--hero-a),transparent_66%)]" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-[radial-gradient(circle,var(--hero-b),transparent_66%)]" />

        <p className="island-kicker mb-4 text-sm">Powered by Flux + ComfyUI</p>
        <h1 className="display-title mx-auto mb-4 max-w-2xl text-4xl font-bold leading-tight tracking-tight text-[var(--sea-ink)] sm:text-6xl">
          Turn your words into{' '}
          <em className="not-italic text-[var(--lagoon-deep)]">images</em>
        </h1>
        <p className="mx-auto mb-10 max-w-lg text-base text-[var(--sea-ink-soft)] sm:text-lg">
          Type a prompt and get AI-generated images in seconds.
        </p>

        <div className="mx-auto max-w-2xl">
          <SearchBar size="hero" ratio={ratio} count={count} />

          {/* Controls */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-6">
            {/* Ratio picker */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[var(--sea-ink-soft)]">Ratio</span>
              <div className="flex gap-1.5">
                {RATIOS.map(({ value, label, icon }) => (
                  <button
                    key={value}
                    onClick={() => setRatio(value)}
                    title={label}
                    className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition ${
                      ratio === value
                        ? 'bg-[var(--lagoon-deep)] text-white'
                        : 'border border-[var(--line)] text-[var(--sea-ink-soft)] hover:border-[var(--lagoon)] hover:text-[var(--sea-ink)]'
                    }`}
                  >
                    <span className="text-[10px] leading-none">{icon}</span>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="h-5 w-px bg-[var(--line)]" />

            {/* Count slider */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-[var(--sea-ink-soft)]">Images</span>
              <input
                type="range"
                min={1}
                max={4}
                step={1}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="w-24 accent-[var(--lagoon-deep)]"
              />
              <span className="w-4 text-center text-sm font-semibold text-[var(--sea-ink)]">
                {count}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 px-4 pb-8">
        <p className="mb-4 text-sm font-semibold text-[var(--sea-ink-soft)]">
          Try a prompt
        </p>
        <div className="flex flex-wrap gap-3">
          {PROMPTS.map(({ label, emoji, prompt }) => (
            <a
              key={label}
              href={`/search?q=${encodeURIComponent(prompt)}&ratio=${ratio}&count=${count}`}
              className="flex items-center gap-2 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2 text-sm font-medium text-[var(--sea-ink)] no-underline transition hover:border-[var(--lagoon)] hover:bg-[var(--link-bg-hover)]"
            >
              <span>{emoji}</span>
              {label}
            </a>
          ))}
        </div>
      </section>
    </main>
  )
}
