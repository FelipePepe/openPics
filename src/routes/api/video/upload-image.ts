import { createFileRoute } from '@tanstack/react-router'
import { COMFYUI_URL } from '#/lib/wan_workflow'
import { log, err } from '#/lib/logger'

export const Route = createFileRoute('/api/video/upload-image')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        let formData: FormData
        try {
          formData = await request.formData()
        } catch (e) {
          err('video/upload-image', 'invalid form data', e)
          return Response.json({ error: 'expected multipart/form-data' }, { status: 400 })
        }

        const image = formData.get('image') as File | null
        if (!image || typeof image === 'string') {
          err('video/upload-image', 'missing image field')
          return Response.json({ error: 'image field required' }, { status: 400 })
        }

        log('video/upload-image', `uploading ${image.name} (${image.size} bytes)`)

        const comfyForm = new FormData()
        comfyForm.append('image', image, image.name)
        comfyForm.append('overwrite', 'true')

        let res: Response
        try {
          res = await fetch(`${COMFYUI_URL}/upload/image`, {
            method: 'POST',
            body: comfyForm,
          })
        } catch (e) {
          err('video/upload-image', 'Cannot reach ComfyUI', e)
          return Response.json({ error: 'ComfyUI unreachable' }, { status: 502 })
        }

        if (!res.ok) {
          err('video/upload-image', 'ComfyUI upload failed', { status: res.status })
          return Response.json({ error: 'upload failed' }, { status: 502 })
        }

        const { name } = (await res.json()) as { name: string }
        log('video/upload-image', `uploaded as ${name}`)
        return Response.json({ filename: name })
      },
    },
  },
})
