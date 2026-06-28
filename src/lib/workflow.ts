const COMFYUI_URL = import.meta.env.COMFYUI_URL ?? 'http://192.168.1.60:8188'
const MODEL = import.meta.env.COMFYUI_MODEL ?? 'flux_dev.safetensors'
const CLIP1 = import.meta.env.COMFYUI_CLIP1 ?? 'clip_l.safetensors'
const CLIP2 = import.meta.env.COMFYUI_CLIP2 ?? 't5xxl_fp16.safetensors'
const VAE = import.meta.env.COMFYUI_VAE ?? 'ae.safetensors'

export { COMFYUI_URL }

export type AspectRatio = 'square' | 'landscape' | 'portrait'

const DIMENSIONS: Record<AspectRatio, { width: number; height: number }> = {
  square: { width: 1024, height: 1024 },
  landscape: { width: 1216, height: 832 },
  portrait: { width: 832, height: 1216 },
}

export function buildFluxWorkflow(
  prompt: string,
  seed: number,
  ratio: AspectRatio = 'square',
) {
  const { width, height } = DIMENSIONS[ratio]

  return {
    '1': {
      class_type: 'UNETLoader',
      inputs: { unet_name: MODEL, weight_dtype: 'default' },
    },
    '2': {
      class_type: 'DualCLIPLoader',
      inputs: { clip_name1: CLIP1, clip_name2: CLIP2, type: 'flux' },
    },
    '3': {
      class_type: 'CLIPTextEncode',
      inputs: { text: prompt, clip: ['2', 0] },
    },
    // FluxGuidance is required for flux1-dev (distilled guidance, not CFG)
    '4': {
      class_type: 'FluxGuidance',
      inputs: { conditioning: ['3', 0], guidance: 3.5 },
    },
    '5': {
      class_type: 'EmptySD3LatentImage',
      inputs: { width, height, batch_size: 1 },
    },
    '6': {
      class_type: 'RandomNoise',
      inputs: { noise_seed: seed },
    },
    '7': {
      class_type: 'BasicGuider',
      inputs: { model: ['1', 0], conditioning: ['4', 0] },
    },
    '8': {
      class_type: 'KSamplerSelect',
      inputs: { sampler_name: 'euler' },
    },
    '9': {
      class_type: 'BasicScheduler',
      inputs: {
        scheduler: 'simple',
        steps: 20,
        denoise: 1,
        model: ['1', 0],
      },
    },
    '10': {
      class_type: 'SamplerCustomAdvanced',
      inputs: {
        noise: ['6', 0],
        guider: ['7', 0],
        sampler: ['8', 0],
        sigmas: ['9', 0],
        latent_image: ['5', 0],
      },
    },
    '11': {
      class_type: 'VAELoader',
      inputs: { vae_name: VAE },
    },
    '12': {
      class_type: 'VAEDecode',
      inputs: { samples: ['10', 0], vae: ['11', 0] },
    },
    '13': {
      class_type: 'SaveImage',
      inputs: { filename_prefix: 'openPics', images: ['12', 0] },
    },
  }
}
