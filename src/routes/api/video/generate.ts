import { createFileRoute } from '@tanstack/react-router'
import { buildWanT2VWorkflow } from '#/lib/wan_workflow'
import { submitPrompt } from '#/lib/comfyui'
import { log, err } from '#/lib/logger'
import { saveJob } from '#/lib/store'

export const Route = createFileRoute('/api/video/generate')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const body = (await request.json()) as { prompt: string }
        const { prompt } = body

        if (!prompt?.trim()) {
          err('video/generate', 'empty prompt rejected')
          return Response.json({ error: 'prompt required' }, { status: 400 })
        }

        const seed = Math.floor(Math.random() * 2 ** 32)
        log('video/generate', `prompt="${prompt}" seed=${seed}`)

        try {
          const promptId = await submitPrompt(
            buildWanT2VWorkflow(prompt.trim(), seed),
          )
          log('video/generate', `submitted promptId=${promptId}`)
          saveJob(promptId, prompt.trim(), 'video')
          return Response.json({ promptId })
        } catch (e) {
          err('video/generate', 'failed to submit to ComfyUI', e)
          return Response.json({ error: (e as Error).message }, { status: 502 })
        }
      },
    },
  },
})
