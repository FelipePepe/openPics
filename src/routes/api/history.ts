import { createFileRoute } from '@tanstack/react-router'
import { COMFYUI_URL } from '#/lib/workflow'
import type { GenerationImage } from '#/lib/comfyui'

export interface HistoryEntry {
  promptId: string
  prompt: string
  images: GenerationImage[]
  timestamp: number
}

import { log, err } from '#/lib/logger'

export const Route = createFileRoute('/api/history')({
  server: {
    handlers: {
      GET: async () => {
        const url = `${COMFYUI_URL}/history`
        log('history', `GET ${url}`)

        let res: Response
        try {
          res = await fetch(url)
        } catch (e) {
          err('history', `Cannot reach ComfyUI at ${url}`, e)
          return Response.json({ entries: [] })
        }

        if (!res.ok) {
          err('history', `GET /history failed`, { status: res.status })
          return Response.json({ entries: [] })
        }

        const history = await res.json()

        const entries: HistoryEntry[] = []

        for (const [promptId, entry] of Object.entries(history) as Array<
          [string, Record<string, unknown>]
        >) {
          const outputs = (entry.outputs ?? {}) as Record<
            string,
            { images?: GenerationImage[] }
          >
          const images: GenerationImage[] = []

          for (const node of Object.values(outputs)) {
            if (node.images?.length) images.push(...node.images)
          }

          if (!images.length) continue

          const promptInputs = (
            entry.prompt as [number, unknown, Record<string, unknown>]
          )?.[2]
          const textPrompt = extractPromptText(promptInputs)
          const timestamp = (
            entry.status as { timestamp?: number }
          )?.timestamp ?? Date.now()

          entries.push({ promptId, prompt: textPrompt, images, timestamp })
        }

        entries.sort((a, b) => b.timestamp - a.timestamp)
        log('history', `returning ${entries.length} entries`)

        return Response.json({ entries })
      },
    },
  },
})

function extractPromptText(
  inputs: Record<string, unknown> | undefined,
): string {
  if (!inputs) return ''
  for (const node of Object.values(inputs) as Array<{
    class_type?: string
    inputs?: { text?: string }
  }>) {
    if (node.class_type === 'CLIPTextEncode' && node.inputs?.text) {
      return node.inputs.text
    }
  }
  return ''
}
