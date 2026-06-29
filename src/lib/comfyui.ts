import { COMFYUI_URL } from './workflow'
import { log, err } from './logger'

export interface GenerationImage {
  filename: string
  subfolder: string
  type: string
}

export interface GenerationStatus {
  status: 'queued' | 'running' | 'complete' | 'error'
  image?: GenerationImage
  queuePosition?: number
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

async function getQueueStatus(promptId: string): Promise<GenerationStatus> {
  const url = `${COMFYUI_URL}/queue`
  try {
    const res = await fetch(url)
    if (!res.ok) return { status: 'error' }
    const queue = await res.json() as {
      queue_running: [number, string, ...unknown[]][]
      queue_pending: [number, string, ...unknown[]][]
    }
    if (queue.queue_running.some(([, id]) => id === promptId)) {
      return { status: 'running' }
    }
    const pendingIdx = queue.queue_pending.findIndex(([, id]) => id === promptId)
    if (pendingIdx !== -1) {
      return { status: 'queued', queuePosition: pendingIdx + 1 }
    }
    return { status: 'error' }
  } catch (e) {
    err('comfyui', `Cannot reach ComfyUI /queue`, e)
    return { status: 'error' }
  }
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
    return getQueueStatus(promptId)
  }

  const history = await res.json()
  const entry = history[promptId]

  if (!entry) return getQueueStatus(promptId)

  const outputs = entry.outputs
  const nodeOutputs = outputs ? Object.values(outputs) : []

  for (const node of nodeOutputs as Array<{ images?: GenerationImage[] }>) {
    if (node.images?.length) {
      log('comfyui', `prompt_id=${promptId} complete → ${node.images[0].filename}`)
      return { status: 'complete', image: node.images[0] }
    }
  }

  return getQueueStatus(promptId)
}

export function getImageProxyUrl(image: GenerationImage): string {
  const params = new URLSearchParams({
    filename: image.filename,
    subfolder: image.subfolder,
    type: image.type,
  })
  return `/api/image?${params}`
}
