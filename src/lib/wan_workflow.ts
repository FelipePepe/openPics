import { COMFYUI_URL } from './workflow'

export { COMFYUI_URL }

// VAE must NEVER change — wan_2.1_vae is 16-channel; wan2.2_vae is 68-channel and breaks decode
const WAN_VAE = 'wan_2.1_vae.safetensors'
const WAN_T2V_MODEL = 'wan2.2_t2v_high_noise_14B_fp8_scaled.safetensors'
const WAN_TEXT_ENCODER = 'umt5-xxl-enc-fp8_e4m3fn-fixed.safetensors'

export function buildWanT2VWorkflow(prompt: string, seed: number) {
  return {
    '1': {
      class_type: 'LoadWanVideoT5TextEncoder',
      inputs: {
        model_name: WAN_TEXT_ENCODER,
        precision: 'fp32',
        load_device: 'offload_device',
      },
    },
    '2': {
      class_type: 'WanVideoTextEncode',
      inputs: {
        positive_prompt: prompt,
        negative_prompt: '',
        t5: ['1', 0],
        force_offload: true,
      },
    },
    '3': {
      class_type: 'WanVideoModelLoader',
      inputs: {
        model: WAN_T2V_MODEL,
        base_precision: 'fp16_fast',
        quantization: 'fp8_e4m3fn_scaled',
        load_device: 'offload_device',
      },
    },
    '4': {
      class_type: 'WanVideoVAELoader',
      inputs: { model_name: WAN_VAE, precision: 'bf16' },
    },
    '5': {
      class_type: 'WanVideoBlockSwap',
      inputs: { blocks_to_swap: 20, offload_img_emb: false, offload_txt_emb: false },
    },
    '6': {
      class_type: 'WanVideoSetBlockSwap',
      inputs: { model: ['3', 0], block_swap_args: ['5', 0] },
    },
    '7': {
      class_type: 'WanVideoSetLoRAs',
      inputs: { model: ['6', 0] },
    },
    '8': {
      class_type: 'WanVideoEmptyEmbeds',
      inputs: { width: 1280, height: 720, num_frames: 81 },
    },
    '9': {
      class_type: 'WanVideoSampler',
      inputs: {
        model: ['7', 0],
        image_embeds: ['8', 0],
        text_embeds: ['2', 0],
        steps: 50,
        cfg: 6.0,
        shift: 5.0,
        seed,
        force_offload: true,
        scheduler: 'unipc',
        riflex_freq_index: 0,
      },
    },
    '10': {
      class_type: 'WanVideoDecode',
      inputs: {
        vae: ['4', 0],
        samples: ['9', 0],
        enable_vae_tiling: false,
        tile_x: 272,
        tile_y: 272,
        tile_stride_x: 144,
        tile_stride_y: 144,
      },
    },
    '11': {
      class_type: 'VHS_VideoCombine',
      inputs: {
        images: ['10', 0],
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
    },
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
    const n = node as {
      gifs?: VideoOutput[]
      videos?: VideoOutput[]
    }
    const file = n.gifs?.[0] ?? n.videos?.[0]
    if (file?.filename) return file
  }
  return null
}
