import { createFileRoute } from '@tanstack/react-router'
import { buildFluxWorkflow, type AspectRatio } from '#/lib/workflow'
import { submitPrompt } from '#/lib/comfyui'
import { log, err } from '#/lib/logger'
import { saveJob } from '#/lib/store'

export const Route = createFileRoute('/api/generate')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const body = (await request.json()) as {
          prompt: string
          ratio?: AspectRatio
          count?: number
        }
        const { prompt, ratio = 'square', count = 4 } = body
        const clampedCount = Math.min(Math.max(Math.floor(count), 1), 4)

        log('generate', `prompt="${prompt}" ratio=${ratio} count=${clampedCount}`)

        if (!prompt?.trim()) {
          err('generate', 'empty prompt rejected')
          return Response.json({ error: 'prompt required' }, { status: 400 })
        }

        const seeds = Array.from({ length: clampedCount }, () =>
          Math.floor(Math.random() * 2 ** 32),
        )

        try {
          const promptIds = await Promise.all(
            seeds.map((seed) =>
              submitPrompt(buildFluxWorkflow(prompt.trim(), seed, ratio)),
            ),
          )
          log('generate', `submitted ${clampedCount} prompts`, promptIds)
          promptIds.forEach((id) => saveJob(id, prompt.trim(), 'image'))
          return Response.json({ promptIds })
        } catch (e) {
          err('generate', 'failed to submit prompts to ComfyUI', e)
          return Response.json(
            { error: (e as Error).message },
            { status: 502 },
          )
        }
      },
    },
  },
})
