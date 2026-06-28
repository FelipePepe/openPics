import { useNavigate } from '@tanstack/react-router'
import { Search, Sparkles } from 'lucide-react'
import { useState } from 'react'
import type { AspectRatio } from '#/lib/workflow'

interface SearchBarProps {
  defaultValue?: string
  size?: 'hero' | 'compact'
  ratio?: AspectRatio
  count?: number
  navigateTo?: '/search' | '/video'
}

export function SearchBar({ defaultValue = '', size = 'hero', ratio = 'square', count = 4, navigateTo = '/search' }: SearchBarProps) {
  const [query, setQuery] = useState(defaultValue)
  const [enhancing, setEnhancing] = useState(false)
  const navigate = useNavigate()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    if (navigateTo === '/video') {
      navigate({ to: '/video', search: { q } })
    } else {
      navigate({ to: '/search', search: { q, ratio, count } })
    }
  }

  async function handleEnhance() {
    const q = query.trim()
    if (!q || enhancing) return
    setEnhancing(true)
    try {
      const res = await fetch('/api/enhance-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: q, type: navigateTo === '/video' ? 'video' : 'image' }),
      })
      const data = await res.json()
      if (data.enhanced) setQuery(data.enhanced)
    } catch {
      // silently fail — original prompt stays
    } finally {
      setEnhancing(false)
    }
  }

  const isHero = size === 'hero'

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div
        className={`flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] shadow-lg backdrop-blur-sm transition-shadow focus-within:shadow-xl ${isHero ? 'px-6 py-4' : 'px-4 py-2.5'}`}
      >
        <Search className="shrink-0 text-[var(--sea-ink-soft)]" size={isHero ? 22 : 18} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Describe the image you want to create…"
          className={`flex-1 bg-transparent text-[var(--sea-ink)] placeholder:text-[var(--sea-ink-soft)] outline-none ${isHero ? 'text-lg' : 'text-sm'}`}
        />
        {query.trim() && (
          <button
            type="button"
            onClick={handleEnhance}
            disabled={enhancing}
            title="Enhance prompt with AI"
            className={`shrink-0 flex items-center gap-1.5 rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] font-medium text-[var(--sea-ink-soft)] transition hover:border-[var(--lagoon)] hover:text-[var(--sea-ink)] disabled:opacity-50 ${isHero ? 'px-3 py-2 text-sm' : 'px-2.5 py-1.5 text-xs'}`}
          >
            <Sparkles size={isHero ? 15 : 12} className={enhancing ? 'animate-spin' : ''} />
            {enhancing ? 'Enhancing…' : 'Enhance'}
          </button>
        )}
        <button
          type="submit"
          className={`shrink-0 rounded-xl bg-[var(--lagoon-deep)] font-semibold text-white transition hover:opacity-90 active:scale-95 ${isHero ? 'px-5 py-2.5 text-sm' : 'px-4 py-1.5 text-xs'}`}
        >
          Generate
        </button>
      </div>
    </form>
  )
}
