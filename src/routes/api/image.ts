import { createFileRoute } from '@tanstack/react-router'
import { COMFYUI_URL } from '#/lib/workflow'
import { log, err } from '#/lib/logger'

export const Route = createFileRoute('/api/image')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const url = new URL(request.url)
        const filename = url.searchParams.get('filename')
        const subfolder = url.searchParams.get('subfolder') ?? ''
        const type = url.searchParams.get('type') ?? 'output'

        if (!filename) {
          err('image', 'request missing filename param')
          return new Response('filename required', { status: 400 })
        }

        const comfyUrl = new URL(`${COMFYUI_URL}/view`)
        comfyUrl.searchParams.set('filename', filename)
        comfyUrl.searchParams.set('subfolder', subfolder)
        comfyUrl.searchParams.set('type', type)

        log('image', `proxying ${comfyUrl.toString()}`)

        let res: Response
        try {
          res = await fetch(comfyUrl.toString())
        } catch (e) {
          err('image', `Cannot reach ComfyUI for ${filename}`, e)
          return new Response('ComfyUI unreachable', { status: 502 })
        }

        if (!res.ok) {
          err('image', `ComfyUI /view failed`, { filename, status: res.status })
          return new Response('image not found', { status: 404 })
        }

        log('image', `serving ${filename} (${res.headers.get('Content-Type')})`)
        return new Response(res.body, {
          headers: {
            'Content-Type': res.headers.get('Content-Type') ?? 'image/png',
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        })
      },
    },
  },
})
