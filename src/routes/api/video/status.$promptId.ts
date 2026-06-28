import { createFileRoute } from '@tanstack/react-router'
import { COMFYUI_URL, extractVideoOutput } from '#/lib/wan_workflow'
import { err } from '#/lib/logger'

export const Route = createFileRoute('/api/video/status/$promptId')({
  server: {
    handlers: {
      GET: async ({ params }: { params: { promptId: string } }) => {
        const { promptId } = params

        let res: Response
        try {
          res = await fetch(`${COMFYUI_URL}/history/${promptId}`)
        } catch (e) {
          err('video/status', `Cannot reach ComfyUI for ${promptId}`, e)
          return Response.json({ status: 'error' }, { status: 502 })
        }

        if (!res.ok) {
          return Response.json({ status: 'error' }, { status: 502 })
        }

        const history = await res.json()
        const entry = history[promptId]

        if (!entry) return Response.json({ status: 'pending' })

        const statusStr = (entry.status as { status_str?: string })?.status_str
        if (statusStr === 'error') {
          const messages = (entry.status as { messages?: Array<[string, unknown]> })?.messages ?? []
          const errorMsg = messages.find(([t]) => t === 'execution_error')
          err('video/status', `generation failed for ${promptId}`, errorMsg)
          return Response.json({ status: 'error' })
        }

        const outputs = (entry.outputs ?? {}) as Record<string, unknown>
        const video = extractVideoOutput(outputs)

        if (!video) return Response.json({ status: 'pending' })

        return Response.json({ status: 'complete', video })
      },
    },
  },
})
