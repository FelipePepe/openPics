import { createFileRoute } from '@tanstack/react-router'
import { COMFYUI_URL, buildWanI2VWorkflow } from '#/lib/wan_workflow'
import { submitPrompt } from '#/lib/comfyui'
import { log, err } from '#/lib/logger'
import { saveJob } from '#/lib/store'

export const Route = createFileRoute('/api/video/generate-from-image')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const body = (await request.json()) as {
          prompt?: string
          comfyFilename: string
          comfySubfolder?: string
          comfyType?: string
        }

        const {
          prompt = '',
          comfyFilename,
          comfySubfolder = '',
          comfyType = 'output',
        } = body

        if (!comfyFilename) {
          return Response.json({ error: 'comfyFilename required' }, { status: 400 })
        }

        log('video/generate-from-image', `filename=${comfyFilename} type=${comfyType} prompt="${prompt}"`)

        // Images from PC upload are already in the input folder — use directly.
        // Images from ComfyUI output must be downloaded and re-uploaded to input
        // because LoadImage can only read from the input folder.
        let inputFilename: string

        if (comfyType === 'input') {
          inputFilename = comfyFilename
        } else {
          const viewUrl = new URL(`${COMFYUI_URL}/view`)
          viewUrl.searchParams.set('filename', comfyFilename)
          viewUrl.searchParams.set('subfolder', comfySubfolder)
          viewUrl.searchParams.set('type', comfyType)

          let imageRes: Response
          try {
            imageRes = await fetch(viewUrl.toString())
          } catch (e) {
            err('video/generate-from-image', 'Cannot reach ComfyUI to download image', e)
            return Response.json({ error: 'ComfyUI unreachable' }, { status: 502 })
          }

          if (!imageRes.ok) {
            err('video/generate-from-image', 'image download failed', { status: imageRes.status })
            return Response.json({ error: 'image not found' }, { status: 404 })
          }

          const blob = await imageRes.blob()
          const comfyForm = new FormData()
          comfyForm.append('image', blob, comfyFilename)
          comfyForm.append('overwrite', 'true')

          let uploadRes: Response
          try {
            uploadRes = await fetch(`${COMFYUI_URL}/upload/image`, {
              method: 'POST',
              body: comfyForm,
            })
          } catch (e) {
            err('video/generate-from-image', 'Cannot upload image to ComfyUI input', e)
            return Response.json({ error: 'ComfyUI unreachable' }, { status: 502 })
          }

          const { name } = (await uploadRes.json()) as { name: string }
          inputFilename = name
          log('video/generate-from-image', `re-uploaded as ${inputFilename}`)
        }

        const seed = Math.floor(Math.random() * 2 ** 32)

        try {
          const promptId = await submitPrompt(
            buildWanI2VWorkflow(prompt.trim(), seed, inputFilename),
          )
          log('video/generate-from-image', `submitted I2V promptId=${promptId}`)
          saveJob(promptId, prompt.trim() || 'Image to Video', 'video')
          return Response.json({ promptId })
        } catch (e) {
          err('video/generate-from-image', 'failed to submit to ComfyUI', e)
          return Response.json({ error: (e as Error).message }, { status: 502 })
        }
      },
    },
  },
})
