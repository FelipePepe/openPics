import { createFileRoute } from '@tanstack/react-router'
import { log, err } from '#/lib/logger'

const OLLAMA_URL = 'http://192.168.1.60:11434'
const OLLAMA_MODEL = 'qwen3.6:35b'

const SYSTEM_T2V = `You are a professional cinematographer and video director specializing in AI video generation.
Your task: take a short user prompt and rewrite it into a rich, cinematic video generation prompt.

Include: camera movement (wide shot, tracking shot, close-up), lighting (golden hour, soft diffused, dramatic), motion (slow motion, gentle breeze, flowing), atmosphere (depth of field, bokeh, mist), and quality tags (cinematic, photorealistic, 4K).

Rules:
- Reply with ONLY the enhanced prompt. No explanations, no prefixes, no quotes.
- Keep it under 100 words.
- Preserve the original subject and intent.`

const SYSTEM_I2V = `You are a professional cinematographer specializing in AI image-to-video animation.
Your task: take a short motion description and rewrite it into a specific, cinematic motion prompt for animating a still image.

Focus on: camera movement (slow pan left, gentle zoom in, orbital shot), physical motion (hair flowing, leaves rustling, water rippling), timing (smooth, gradual, rhythmic), and atmosphere (soft wind, warm light shifting).

Rules:
- Reply with ONLY the enhanced prompt. No explanations, no prefixes, no quotes.
- Keep it under 80 words.
- Be specific about what moves and how.`

export const Route = createFileRoute('/api/enhance-prompt')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const body = (await request.json()) as { prompt: string; type?: 'image' | 'video' }
        const { prompt, type = 'image' } = body

        if (!prompt?.trim()) {
          return Response.json({ error: 'prompt required' }, { status: 400 })
        }

        log('enhance-prompt', `type=${type} prompt="${prompt.slice(0, 60)}..."`)

        const systemPrompt = type === 'video' ? SYSTEM_I2V : SYSTEM_T2V
        const userMessage = type === 'video'
          ? `Enhance this motion prompt for image-to-video animation:\n\n${prompt.trim()}`
          : `Enhance this video generation prompt:\n\n${prompt.trim()}`

        let res: Response
        try {
          res = await fetch(`${OLLAMA_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: OLLAMA_MODEL,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage },
              ],
              stream: false,
              think: false,
              options: { num_predict: 200, temperature: 0.7 },
            }),
          })
        } catch (e) {
          err('enhance-prompt', 'Cannot reach Ollama', e)
          return Response.json({ error: 'Ollama unreachable' }, { status: 502 })
        }

        if (!res.ok) {
          err('enhance-prompt', 'Ollama request failed', { status: res.status })
          return Response.json({ error: 'Enhancement failed' }, { status: 502 })
        }

        const data = await res.json()
        const enhanced = data?.message?.content?.trim() ?? ''

        if (!enhanced) {
          return Response.json({ error: 'Empty response from model' }, { status: 502 })
        }

        log('enhance-prompt', `enhanced: "${enhanced.slice(0, 80)}..."`)
        return Response.json({ enhanced })
      },
    },
  },
})
