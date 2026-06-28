import { createFileRoute } from '@tanstack/react-router'
import { COMFYUI_URL } from '#/lib/wan_workflow'
import { log, err } from '#/lib/logger'

export const Route = createFileRoute('/api/video/file')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const url = new URL(request.url)
        const filename = url.searchParams.get('filename')
        const subfolder = url.searchParams.get('subfolder') ?? ''
        const type = url.searchParams.get('type') ?? 'output'

        if (!filename) {
          err('video/file', 'request missing filename param')
          return new Response('filename required', { status: 400 })
        }

        const comfyUrl = new URL(`${COMFYUI_URL}/view`)
        comfyUrl.searchParams.set('filename', filename)
        comfyUrl.searchParams.set('subfolder', subfolder)
        comfyUrl.searchParams.set('type', type)

        log('video/file', `proxying ${comfyUrl.toString()}`)

        // Forward Range header so the browser <video> element can seek
        const rangeHeader = request.headers.get('Range')
        const fetchHeaders: Record<string, string> = {}
        if (rangeHeader) fetchHeaders['Range'] = rangeHeader

        let upstream: Response
        try {
          upstream = await fetch(comfyUrl.toString(), { headers: fetchHeaders })
        } catch (e) {
          err('video/file', `Cannot reach ComfyUI for ${filename}`, e)
          return new Response('ComfyUI unreachable', { status: 502 })
        }

        if (!upstream.ok && upstream.status !== 206) {
          err('video/file', `ComfyUI /view failed`, { filename, status: upstream.status })
          return new Response('video not found', { status: 404 })
        }

        const responseHeaders: Record<string, string> = {
          'Content-Type': upstream.headers.get('Content-Type') ?? 'video/mp4',
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=31536000, immutable',
        }

        const contentRange = upstream.headers.get('Content-Range')
        if (contentRange) responseHeaders['Content-Range'] = contentRange

        const contentLength = upstream.headers.get('Content-Length')
        if (contentLength) responseHeaders['Content-Length'] = contentLength

        return new Response(upstream.body, {
          status: upstream.status,
          headers: responseHeaders,
        })
      },
    },
  },
})
