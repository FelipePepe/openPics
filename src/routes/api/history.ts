import { createFileRoute } from '@tanstack/react-router'
import { COMFYUI_URL } from '#/lib/workflow'
import type { GenerationImage } from '#/lib/comfyui'
import { log, err } from '#/lib/logger'
import { getEntries } from '#/lib/store'

export interface VideoFile {
  filename: string
  subfolder: string
  type: string
  format?: string
}

export interface HistoryEntry {
  promptId: string
  prompt: string
  images: GenerationImage[]
  videos: VideoFile[]
  timestamp: number
}

export const Route = createFileRoute('/api/history')({
  server: {
    handlers: {
      GET: async () => {
        // Local store is the primary source — survives ComfyUI reboots
        const storeEntries = getEntries().filter(
          (e) => e.images.length > 0 || e.videos.length > 0,
        )
        const storeIds = new Set(storeEntries.map((e) => e.promptId))

        // ComfyUI history for jobs completed before the store existed (backward compat)
        const comfyEntries: HistoryEntry[] = []
        try {
          const res = await fetch(`${COMFYUI_URL}/history`)
          if (res.ok) {
            const history = await res.json()
            for (const [promptId, entry] of Object.entries(history) as Array<[string, Record<string, unknown>]>) {
              if (storeIds.has(promptId)) continue // already in store

              const outputs = (entry.outputs ?? {}) as Record<
                string,
                { images?: GenerationImage[]; gifs?: VideoFile[]; videos?: VideoFile[] }
              >
              const images: GenerationImage[] = []
              const videos: VideoFile[] = []

              for (const node of Object.values(outputs)) {
                if (node.images?.length) images.push(...node.images)
                if (node.gifs?.length) videos.push(...node.gifs)
                if (node.videos?.length) videos.push(...node.videos)
              }

              if (!images.length && !videos.length) continue

              const promptInputs = (entry.prompt as [number, unknown, Record<string, unknown>])?.[2]
              const prompt = extractPromptText(promptInputs)
              const timestamp = (entry.status as { timestamp?: number })?.timestamp ?? Date.now()

              comfyEntries.push({ promptId, prompt, images, videos, timestamp })
            }
          }
        } catch (e) {
          err('history', 'ComfyUI unreachable — using local store only', e)
        }

        const entries: HistoryEntry[] = [
          ...storeEntries.map((e) => ({
            promptId: e.promptId,
            prompt: e.prompt,
            images: e.images,
            videos: e.videos,
            timestamp: e.timestamp,
          })),
          ...comfyEntries,
        ].sort((a, b) => b.timestamp - a.timestamp)

        log('history', `returning ${entries.length} entries (${entries.reduce((n, e) => n + e.images.length, 0)} images, ${entries.reduce((n, e) => n + e.videos.length, 0)} videos) [store:${storeEntries.length} comfy:${comfyEntries.length}]`)

        return Response.json({ entries })
      },
    },
  },
})

function extractPromptText(inputs: Record<string, unknown> | undefined): string {
  if (!inputs) return ''
  for (const node of Object.values(inputs) as Array<{
    class_type?: string
    inputs?: { text?: string; positive_prompt?: string }
  }>) {
    if (node.class_type === 'CLIPTextEncode' && node.inputs?.text) return node.inputs.text
    if (node.class_type === 'WanVideoTextEncode' && node.inputs?.positive_prompt) return node.inputs.positive_prompt
  }
  return ''
}
