import { createFileRoute } from '@tanstack/react-router'
import { getGenerationStatus } from '#/lib/comfyui'
import { err } from '#/lib/logger'
import { completeJob } from '#/lib/store'

export const Route = createFileRoute('/api/status/$promptId')({
  server: {
    handlers: {
      GET: async ({ params }: { params: { promptId: string } }) => {
        try {
          const result = await getGenerationStatus(params.promptId)
          if (result.status === 'complete' && result.image) {
            completeJob(params.promptId, [result.image], [])
          }
          return Response.json(result)
        } catch (e) {
          err('status', `failed for prompt_id=${params.promptId}`, e)
          return Response.json({ status: 'error' }, { status: 502 })
        }
      },
    },
  },
})
