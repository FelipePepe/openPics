import { COMFYUI_URL } from './workflow'
import { log, err } from './logger'

export interface GenerationImage {
  filename: string
  subfolder: string
  type: string
}

export interface GenerationStatus {
  status: 'pending' | 'complete' | 'error'
  image?: GenerationImage
  progress?: number
}

export async function submitPrompt(workflow: object): Promise<string> {
  const clientId = crypto.randomUUID()
  const url = `${COMFYUI_URL}/prompt`
  log('comfyui', `POST ${url}`)

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflow, client_id: clientId }),
    })
  } catch (e) {
    err('comfyui', `Cannot reach ComfyUI at ${url}`, e)
    throw new Error(`ComfyUI unreachable: ${(e as Error).message}`)
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    err('comfyui', `POST /prompt failed`, { status: res.status, body })
    throw new Error(`ComfyUI /prompt failed: ${res.status}`)
  }

  const data = await res.json()
  log('comfyui', `queued prompt_id=${data.prompt_id}`)
  return data.prompt_id as string
}

export async function getGenerationStatus(
  promptId: string,
): Promise<GenerationStatus> {
  const url = `${COMFYUI_URL}/history/${promptId}`

  let res: Response
  try {
    res = await fetch(url)
  } catch (e) {
    err('comfyui', `Cannot reach ComfyUI at ${url}`, e)
    return { status: 'error' }
  }

  if (!res.ok) {
    err('comfyui', `GET /history/${promptId} failed`, { status: res.status })
    return { status: 'pending' }
  }

  const history = await res.json()
  const entry = history[promptId]

  if (!entry) return { status: 'pending' }

  const outputs = entry.outputs
  const nodeOutputs = outputs ? Object.values(outputs) : []

  for (const node of nodeOutputs as Array<{ images?: GenerationImage[] }>) {
    if (node.images?.length) {
      log('comfyui', `prompt_id=${promptId} complete → ${node.images[0].filename}`)
      return { status: 'complete', image: node.images[0] }
    }
  }

  return { status: 'pending' }
}

export function getImageProxyUrl(image: GenerationImage): string {
  const params = new URLSearchParams({
    filename: image.filename,
    subfolder: image.subfolder,
    type: image.type,
  })
  return `/api/image?${params}`
}
