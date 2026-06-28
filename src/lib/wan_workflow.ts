import { COMFYUI_URL } from './workflow'

export { COMFYUI_URL }

// wan_2.1_vae = 16-channel (correct for 14B); wan2.2_vae = 68-channel (only for 5B)
const WAN_VAE = 'wan_2.1_vae.safetensors'

const WAN_T2V_HIGH = 'wan2.2_t2v_high_noise_14B_fp8_scaled.safetensors'
const WAN_T2V_LOW  = 'wan2.2_t2v_low_noise_14B_fp8_scaled.safetensors'
const WAN_I2V_HIGH = 'wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors'
const WAN_I2V_LOW  = 'wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors'
const WAN_TEXT_ENCODER = 'umt5-xxl-enc-fp8_e4m3fn-fixed.safetensors'

// Official Wan2.2 negative prompt — suppresses static frames, artifacts, bad anatomy
const WAN_NEGATIVE = '色调艳丽，过曝，静态，细节模糊不清，字幕，风格，作品，画作，画面，静止，整体发灰，最差质量，低质量，JPEG压缩残留，丑陋的，残缺的，多余的手指，画得不好的手部，画得不好的脸部，畸形的，毁容的，形态畸形的肢体，手指融合，静止不动的画面，杂乱的背景，三条腿，背景人很多，倒着走'

// Shared model loader config
function modelLoader(model: string, blockSwapNode: string) {
  return {
    class_type: 'WanVideoModelLoader',
    inputs: {
      model,
      base_precision: 'fp16_fast',
      quantization: 'fp8_e4m3fn_scaled',
      load_device: 'offload_device',
      block_swap_args: [blockSwapNode, 0],
    },
  }
}

// Shared scheduler config: two nodes split the 20-step budget
function schedulerHigh() {
  return {
    class_type: 'WanVideoSchedulerv2',
    inputs: { scheduler: 'euler', steps: 20, shift: 8.0, start_step: 0, end_step: 10 },
  }
}
function schedulerLow() {
  return {
    class_type: 'WanVideoSchedulerv2',
    inputs: { scheduler: 'euler', steps: 20, shift: 8.0, start_step: 10, end_step: -1 },
  }
}

function vhsCombine(framesNode: string) {
  return {
    class_type: 'VHS_VideoCombine',
    inputs: {
      images: [framesNode, 0],
      frame_rate: 16,
      loop_count: 0,
      filename_prefix: 'openPicsVideo',
      format: 'video/h264-mp4',
      pix_fmt: 'yuv420p',
      crf: 19,
      save_metadata: false,
      trim_to_audio: false,
      pingpong: true,
      save_output: true,
    },
  }
}

export function buildWanT2VWorkflow(prompt: string, seed: number) {
  return {
    // ── Text encoder ─────────────────────────────────────────────────────────
    '1': {
      class_type: 'LoadWanVideoT5TextEncoder',
      inputs: { model_name: WAN_TEXT_ENCODER, precision: 'fp32', load_device: 'offload_device' },
    },
    '2': {
      class_type: 'WanVideoTextEncode',
      inputs: { positive_prompt: prompt, negative_prompt: WAN_NEGATIVE, t5: ['1', 0], force_offload: true },
    },
    // ── VAE & block swap config ───────────────────────────────────────────────
    '3': {
      class_type: 'WanVideoVAELoader',
      inputs: { model_name: WAN_VAE, precision: 'bf16' },
    },
    '4': {
      class_type: 'WanVideoBlockSwap',
      inputs: { blocks_to_swap: 20, offload_img_emb: false, offload_txt_emb: false },
    },
    // ── Two expert models ─────────────────────────────────────────────────────
    '5': modelLoader(WAN_T2V_HIGH, '4'),
    '6': modelLoader(WAN_T2V_LOW,  '4'),
    // ── Empty latent for T2V ──────────────────────────────────────────────────
    '7': {
      class_type: 'WanVideoEmptyEmbeds',
      inputs: { width: 1280, height: 720, num_frames: 81 },
    },
    // ── Pass 1: high-noise expert (steps 0–10) ────────────────────────────────
    '8': schedulerHigh(),
    '9': {
      class_type: 'WanVideoSamplerv2',
      inputs: {
        model: ['5', 0],
        image_embeds: ['7', 0],
        text_embeds: ['2', 0],
        scheduler: ['8', 0],
        cfg: 3.5,
        seed,
        force_offload: true,
      },
    },
    // ── Pass 2: low-noise expert (steps 10–20) ────────────────────────────────
    '10': schedulerLow(),
    '11': {
      class_type: 'WanVideoSamplerv2',
      inputs: {
        model: ['6', 0],
        image_embeds: ['7', 0],
        text_embeds: ['2', 0],
        scheduler: ['10', 0],
        cfg: 3.5,
        seed,
        force_offload: true,
        samples: ['9', 0],           // continue from pass 1
        add_noise_to_samples: false, // latent is already partially denoised
      },
    },
    // ── Decode & save ─────────────────────────────────────────────────────────
    '12': {
      class_type: 'WanVideoDecode',
      inputs: {
        vae: ['3', 0],
        samples: ['11', 0],
        enable_vae_tiling: false,
        tile_x: 272, tile_y: 272,
        tile_stride_x: 144, tile_stride_y: 144,
      },
    },
    '13': vhsCombine('12'),
  }
}

// uploadedFilename must already be in ComfyUI's /input folder
export function buildWanI2VWorkflow(prompt: string, seed: number, uploadedFilename: string) {
  return {
    // ── Text encoder ─────────────────────────────────────────────────────────
    '1': {
      class_type: 'LoadWanVideoT5TextEncoder',
      inputs: { model_name: WAN_TEXT_ENCODER, precision: 'fp32', load_device: 'offload_device' },
    },
    '2': {
      class_type: 'WanVideoTextEncode',
      inputs: { positive_prompt: prompt, negative_prompt: WAN_NEGATIVE, t5: ['1', 0], force_offload: true },
    },
    // ── VAE & block swap config ───────────────────────────────────────────────
    '3': {
      class_type: 'WanVideoVAELoader',
      inputs: { model_name: WAN_VAE, precision: 'bf16' },
    },
    '4': {
      class_type: 'WanVideoBlockSwap',
      inputs: { blocks_to_swap: 20, offload_img_emb: false, offload_txt_emb: false },
    },
    // ── Two expert models ─────────────────────────────────────────────────────
    '5': modelLoader(WAN_I2V_HIGH, '4'),
    '6': modelLoader(WAN_I2V_LOW,  '4'),
    // ── Image conditioning ────────────────────────────────────────────────────
    '7': {
      class_type: 'LoadImage',
      inputs: { image: uploadedFilename },
    },
    '8': {
      class_type: 'WanVideoImageResizeToClosest',
      inputs: {
        image: ['7', 0],
        generation_width: 768,
        generation_height: 768,
        aspect_ratio_preservation: 'keep_input',
      },
    },
    // end_image key must be completely omitted — ComfyUI errors if present
    '9': {
      class_type: 'WanVideoImageToVideoEncode',
      inputs: {
        width: 768,
        height: 768,
        num_frames: 81,
        noise_aug_strength: 0.0,
        start_latent_strength: 1.0,
        end_latent_strength: 1.0,
        force_offload: true,
        vae: ['3', 0],
        start_image: ['8', 0],
      },
    },
    // ── Pass 1: high-noise expert (steps 0–10) ────────────────────────────────
    '10': schedulerHigh(),
    '11': {
      class_type: 'WanVideoSamplerv2',
      inputs: {
        model: ['5', 0],
        image_embeds: ['9', 0],
        text_embeds: ['2', 0],
        scheduler: ['10', 0],
        cfg: 3.5,
        seed,
        force_offload: true,
      },
    },
    // ── Pass 2: low-noise expert (steps 10–20) ────────────────────────────────
    '12': schedulerLow(),
    '13': {
      class_type: 'WanVideoSamplerv2',
      inputs: {
        model: ['6', 0],
        image_embeds: ['9', 0],
        text_embeds: ['2', 0],
        scheduler: ['12', 0],
        cfg: 3.5,
        seed,
        force_offload: true,
        samples: ['11', 0],
        add_noise_to_samples: false,
      },
    },
    // ── Decode & save ─────────────────────────────────────────────────────────
    '14': {
      class_type: 'WanVideoDecode',
      inputs: {
        vae: ['3', 0],
        samples: ['13', 0],
        enable_vae_tiling: false,
        tile_x: 272, tile_y: 272,
        tile_stride_x: 144, tile_stride_y: 144,
      },
    },
    '15': vhsCombine('14'),
  }
}

export interface VideoOutput {
  filename: string
  subfolder: string
  type: string
  format?: string
}

export function extractVideoOutput(
  outputs: Record<string, unknown>,
): VideoOutput | null {
  for (const node of Object.values(outputs)) {
    const n = node as { gifs?: VideoOutput[]; videos?: VideoOutput[] }
    const file = n.gifs?.[0] ?? n.videos?.[0]
    if (file?.filename) return file
  }
  return null
}
