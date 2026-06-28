import { useCallback, useState } from 'react'
import { AssetCard } from './AssetCard'
import { Lightbox, type LightboxItem } from './Lightbox'

interface AssetGridProps {
  promptIds: string[]
  prompt?: string
}

export function AssetGrid({ promptIds, prompt }: AssetGridProps) {
  const [lightbox, setLightbox] = useState<LightboxItem | null>(null)
  // Ordered by card index so prev/next follows grid order
  const [completed, setCompleted] = useState<Record<number, LightboxItem>>({})

  const handleComplete = useCallback(
    (src: string, filename: string, cardIndex: number) => {
      setCompleted((prev) => ({
        ...prev,
        [cardIndex]: { src, filename, prompt, index: cardIndex },
      }))
    },
    [prompt],
  )

  const handleOpen = useCallback(
    (src: string, filename: string, cardIndex: number) => {
      setLightbox({ src, filename, prompt, index: cardIndex })
    },
    [prompt],
  )

  const sortedCompleted = Object.values(completed).sort((a, b) => a.index - b.index)

  const navigate = useCallback(
    (dir: -1 | 1) => {
      if (!lightbox) return
      const pos = sortedCompleted.findIndex((img) => img.index === lightbox.index)
      const next = sortedCompleted[pos + dir]
      if (next) setLightbox(next)
    },
    [lightbox, sortedCompleted],
  )

  const currentPos = lightbox
    ? sortedCompleted.findIndex((img) => img.index === lightbox.index)
    : -1

  return (
    <>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {promptIds.map((id, i) => (
          <AssetCard
            key={id}
            promptId={id}
            index={i}
            onComplete={handleComplete}
            onOpen={handleOpen}
          />
        ))}
      </div>

      {lightbox && (
        <Lightbox
          item={lightbox}
          hasPrev={currentPos > 0}
          hasNext={currentPos < sortedCompleted.length - 1}
          onClose={() => setLightbox(null)}
          onPrev={() => navigate(-1)}
          onNext={() => navigate(1)}
        />
      )}
    </>
  )
}
