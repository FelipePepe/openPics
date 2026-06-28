import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { SearchBar } from '#/components/SearchBar'
import { AssetGrid } from '#/components/AssetGrid'
import type { AspectRatio } from '#/lib/workflow'

export const Route = createFileRoute('/search')({
  validateSearch: (search: Record<string, unknown>) => ({
    q: String(search.q ?? ''),
    ratio: (search.ratio as AspectRatio) ?? 'square',
    count: Math.min(Math.max(Number(search.count ?? 4), 1), 4),
  }),
  component: SearchPage,
})

function SearchPage() {
  const { q, ratio, count } = Route.useSearch()
  const [promptIds, setPromptIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!q) return

    const controller = new AbortController()
    setLoading(true)
    setError(null)
    setPromptIds([])

    fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: q, ratio, count }),
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.promptIds) setPromptIds(data.promptIds)
        else setError(data.error ?? 'Unknown error')
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setError('Failed to connect to ComfyUI')
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [q, ratio, count])

  return (
    <main className="page-wrap px-4 pb-12">
      <div className="mb-6 max-w-2xl">
        <SearchBar defaultValue={q} size="compact" ratio={ratio} count={count} />
      </div>

      <div className="mb-6">
        <span className="text-sm text-[var(--sea-ink-soft)]">
          {q ? (
            <>
              Generating <strong className="text-[var(--sea-ink)]">{count}</strong> image{count !== 1 ? 's' : ''} ·{' '}
              <strong className="text-[var(--sea-ink)]">"{q}"</strong>
            </>
          ) : (
            'Enter a prompt to generate images'
          )}
        </span>
      </div>

      {error && (
        <div className="island-shell mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-400">
          {error}
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: count }).map((_, i) => (
            <div
              key={i}
              className="aspect-square animate-pulse rounded-2xl bg-[var(--sand)]"
              style={{ animationDelay: `${i * 80}ms` }}
            />
          ))}
        </div>
      )}

      {promptIds.length > 0 && <AssetGrid promptIds={promptIds} prompt={q} />}

      {!q && !loading && (
        <p className="py-16 text-center text-[var(--sea-ink-soft)]">
          Enter a prompt above to generate images.
        </p>
      )}
    </main>
  )
}
