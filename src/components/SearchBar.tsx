import { useNavigate } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { useState } from 'react'
import type { AspectRatio } from '#/lib/workflow'

interface SearchBarProps {
  defaultValue?: string
  size?: 'hero' | 'compact'
  ratio?: AspectRatio
  count?: number
}

export function SearchBar({ defaultValue = '', size = 'hero', ratio = 'square', count = 4 }: SearchBarProps) {
  const [query, setQuery] = useState(defaultValue)
  const navigate = useNavigate()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    navigate({ to: '/search', search: { q, ratio, count } })
  }

  const isHero = size === 'hero'

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div
        className={`flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] shadow-lg backdrop-blur-sm transition-shadow focus-within:shadow-xl ${isHero ? 'px-6 py-4' : 'px-4 py-2.5'}`}
      >
        <Search
          className="shrink-0 text-[var(--sea-ink-soft)]"
          size={isHero ? 22 : 18}
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Describe the image you want to create…"
          className={`flex-1 bg-transparent text-[var(--sea-ink)] placeholder:text-[var(--sea-ink-soft)] outline-none ${isHero ? 'text-lg' : 'text-sm'}`}
        />
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
