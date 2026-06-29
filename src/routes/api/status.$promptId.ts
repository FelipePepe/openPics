import { createFileRoute } from '@tanstack/react-router'
import { getGenerationStatus } from '#/lib/comfyui'
import { err } from '#/lib/logger'
import { completeJob } from '#/lib/store'

export const Route = createFileRoute('/api/status/$promptId')({
  server: {
    handlers: {
      GET: async ({ params }: { params: { promptId: string } }) => {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.promptId)) {
          return Response.json({ status: 'error' }, { status: 400 })
        }
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
