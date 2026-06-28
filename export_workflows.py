#!/usr/bin/env python3
"""
Export Wan2.2 workflows as JSON files for the ComfyUI web interface.

Usage:
  python3 export_workflows.py                  # exports both T2V and I2V
  python3 export_workflows.py --seed 42        # fixed seed
  python3 export_workflows.py --steps 10       # faster (fewer denoising steps)
  python3 export_workflows.py --out workflows/ # custom output directory

Load in ComfyUI web: drag & drop the JSON onto the canvas, or use the Load button.
"""

import argparse
import json
import os
import random

# ── Model names ───────────────────────────────────────────────────────────────

WAN_VAE          = "wan_2.1_vae.safetensors"
WAN_T2V_HIGH     = "wan2.2_t2v_high_noise_14B_fp8_scaled.safetensors"
WAN_T2V_LOW      = "wan2.2_t2v_low_noise_14B_fp8_scaled.safetensors"
WAN_I2V_HIGH     = "wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors"
WAN_I2V_LOW      = "wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors"
WAN_TEXT_ENCODER = "umt5-xxl-enc-fp8_e4m3fn-fixed.safetensors"
WAN_NEGATIVE     = (
    "oversaturated colors, overexposed, static, blurry details, subtitles, "
    "artwork, painting, still image, motionless, overall grayish, worst quality, "
    "low quality, JPEG compression artifacts, ugly, incomplete, extra fingers, "
    "poorly drawn hands, poorly drawn face, deformed, disfigured, malformed limbs, "
    "fused fingers, static motionless scene, cluttered background, three legs, "
    "many people in background, walking backwards"
)

# ── Shared helpers ────────────────────────────────────────────────────────────

def block_swap_node(blocks: int) -> dict:
    return {
        "class_type": "WanVideoBlockSwap",
        "inputs": {
            "blocks_to_swap": blocks,
            "offload_img_emb": False,
            "offload_txt_emb": False,
        },
    }

def model_loader(model_name: str, block_swap_id: str) -> dict:
    return {
        "class_type": "WanVideoModelLoader",
        "inputs": {
            "model": model_name,
            "base_precision": "fp16_fast",
            "quantization": "fp8_e4m3fn_scaled",
            "load_device": "offload_device",
            "block_swap_args": [block_swap_id, 0],
        },
    }

def scheduler_node(steps: int, shift: float, start: int, end: int) -> dict:
    return {
        "class_type": "WanVideoSchedulerv2",
        "inputs": {
            "scheduler": "euler",
            "steps": steps,
            "shift": shift,
            "start_step": start,
            "end_step": end,
        },
    }

def vhs_combine(frames_node: str, prefix: str) -> dict:
    return {
        "class_type": "VHS_VideoCombine",
        "inputs": {
            "images": [frames_node, 0],
            "frame_rate": 24,
            "loop_count": 0,
            "filename_prefix": prefix,
            "format": "video/h264-mp4",
            "pix_fmt": "yuv420p",
            "crf": 19,
            "save_metadata": False,
            "trim_to_audio": False,
            "pingpong": False,
            "save_output": True,
        },
    }

def decode_node(vae_node: str, samples_node: str) -> dict:
    return {
        "class_type": "WanVideoDecode",
        "inputs": {
            "vae": [vae_node, 0],
            "samples": [samples_node, 0],
            "enable_vae_tiling": False,
            "tile_x": 272,
            "tile_y": 272,
            "tile_stride_x": 144,
            "tile_stride_y": 144,
        },
    }

# ── T2V workflow ──────────────────────────────────────────────────────────────

def build_t2v(prompt: str, seed: int, steps: int = 20, cfg: float = 3.5,
               shift: float = 8.0, width: int = 1280, height: int = 720,
               frames: int = 81, blocks_to_swap: int = 0) -> dict:
    mid = steps // 2
    return {
        # 1 — T5 text encoder
        "1": {
            "class_type": "LoadWanVideoT5TextEncoder",
            "inputs": {
                "model_name": WAN_TEXT_ENCODER,
                "precision": "fp32",
                "load_device": "offload_device",
            },
        },
        # 2 — Text conditioning
        "2": {
            "class_type": "WanVideoTextEncode",
            "inputs": {
                "positive_prompt": prompt,
                "negative_prompt": WAN_NEGATIVE,
                "t5": ["1", 0],
                "force_offload": True,
            },
        },
        # 3 — VAE
        "3": {
            "class_type": "WanVideoVAELoader",
            "inputs": {"model_name": WAN_VAE, "precision": "bf16"},
        },
        # 4 — Block swap config (shared by both models)
        "4": block_swap_node(blocks_to_swap),
        # 5 — High-noise expert model
        "5": model_loader(WAN_T2V_HIGH, "4"),
        # 6 — Low-noise expert model
        "6": model_loader(WAN_T2V_LOW, "4"),
        # 7 — Empty video latent
        "7": {
            "class_type": "WanVideoEmptyEmbeds",
            "inputs": {"width": width, "height": height, "num_frames": frames},
        },
        # 8 — Scheduler pass 1 (steps 0 → mid)
        "8": scheduler_node(steps, shift, 0, mid),
        # 9 — Sampler pass 1: high-noise expert
        "9": {
            "class_type": "WanVideoSamplerv2",
            "inputs": {
                "model": ["5", 0],
                "image_embeds": ["7", 0],
                "text_embeds": ["2", 0],
                "scheduler": ["8", 0],
                "cfg": cfg,
                "seed": seed,
                "force_offload": True,
            },
        },
        # 10 — Scheduler pass 2 (steps mid → end)
        "10": scheduler_node(steps, shift, mid, -1),
        # 11 — Sampler pass 2: low-noise expert (continues from pass 1)
        "11": {
            "class_type": "WanVideoSamplerv2",
            "inputs": {
                "model": ["6", 0],
                "image_embeds": ["7", 0],
                "text_embeds": ["2", 0],
                "scheduler": ["10", 0],
                "cfg": cfg,
                "seed": seed,
                "force_offload": True,
                "samples": ["9", 0],
                "add_noise_to_samples": False,
            },
        },
        # 12 — VAE decode
        "12": decode_node("3", "11"),
        # 13 — Save video
        "13": vhs_combine("12", "wan22_t2v"),
    }


# ── I2V workflow ──────────────────────────────────────────────────────────────

def build_i2v(prompt: str, seed: int, image_filename: str,
               steps: int = 20, cfg: float = 3.5, shift: float = 8.0,
               width: int = 768, height: int = 768, frames: int = 81,
               blocks_to_swap: int = 0) -> dict:
    mid = steps // 2
    return {
        # 1 — T5 text encoder
        "1": {
            "class_type": "LoadWanVideoT5TextEncoder",
            "inputs": {
                "model_name": WAN_TEXT_ENCODER,
                "precision": "fp32",
                "load_device": "offload_device",
            },
        },
        # 2 — Text conditioning
        "2": {
            "class_type": "WanVideoTextEncode",
            "inputs": {
                "positive_prompt": prompt,
                "negative_prompt": WAN_NEGATIVE,
                "t5": ["1", 0],
                "force_offload": True,
            },
        },
        # 3 — VAE
        "3": {
            "class_type": "WanVideoVAELoader",
            "inputs": {"model_name": WAN_VAE, "precision": "bf16"},
        },
        # 4 — Block swap config
        "4": block_swap_node(blocks_to_swap),
        # 5 — High-noise I2V expert
        "5": model_loader(WAN_I2V_HIGH, "4"),
        # 6 — Low-noise I2V expert
        "6": model_loader(WAN_I2V_LOW, "4"),
        # 7 — Load source image (must be in ComfyUI /input folder)
        "7": {
            "class_type": "LoadImage",
            "inputs": {"image": image_filename},
        },
        # 8 — Resize to generation resolution
        "8": {
            "class_type": "WanVideoImageResizeToClosest",
            "inputs": {
                "image": ["7", 0],
                "generation_width": width,
                "generation_height": height,
                "aspect_ratio_preservation": "keep_input",
            },
        },
        # 9 — Image-to-video conditioning (encode start frame)
        "9": {
            "class_type": "WanVideoImageToVideoEncode",
            "inputs": {
                "width": width,
                "height": height,
                "num_frames": frames,
                "noise_aug_strength": 0.0,
                "start_latent_strength": 1.0,
                "end_latent_strength": 1.0,
                "force_offload": True,
                "vae": ["3", 0],
                "start_image": ["8", 0],
            },
        },
        # 10 — Scheduler pass 1
        "10": scheduler_node(steps, shift, 0, mid),
        # 11 — Sampler pass 1: high-noise I2V expert
        "11": {
            "class_type": "WanVideoSamplerv2",
            "inputs": {
                "model": ["5", 0],
                "image_embeds": ["9", 0],
                "text_embeds": ["2", 0],
                "scheduler": ["10", 0],
                "cfg": cfg,
                "seed": seed,
                "force_offload": True,
            },
        },
        # 12 — Scheduler pass 2
        "12": scheduler_node(steps, shift, mid, -1),
        # 13 — Sampler pass 2: low-noise I2V expert
        "13": {
            "class_type": "WanVideoSamplerv2",
            "inputs": {
                "model": ["6", 0],
                "image_embeds": ["9", 0],
                "text_embeds": ["2", 0],
                "scheduler": ["12", 0],
                "cfg": cfg,
                "seed": seed,
                "force_offload": True,
                "samples": ["11", 0],
                "add_noise_to_samples": False,
            },
        },
        # 14 — VAE decode
        "14": decode_node("3", "13"),
        # 15 — Save video
        "15": vhs_combine("14", "wan22_i2v"),
    }


# ── Export ────────────────────────────────────────────────────────────────────

def save(path: str, workflow: dict) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(workflow, f, indent=2)
    size = os.path.getsize(path)
    print(f"  ✓ {path}  ({size:,} bytes, {len(workflow)} nodes)")


def main() -> None:
    p = argparse.ArgumentParser(description="Export Wan2.2 workflows as ComfyUI JSON")
    p.add_argument("--out",           default="workflows")
    p.add_argument("--seed",          type=int,   default=None)
    p.add_argument("--steps",         type=int,   default=20)
    p.add_argument("--cfg",           type=float, default=3.5)
    p.add_argument("--shift",         type=float, default=8.0)
    p.add_argument("--blocks-to-swap",type=int,   default=0, dest="blocks_to_swap")
    p.add_argument("--t2v-prompt",    default="cherry blossom petals falling in spring wind, slow motion, soft bokeh, 4K cinematic", dest="t2v_prompt")
    p.add_argument("--i2v-prompt",    default="camera slowly panning right, gentle breeze, soft light shifting", dest="i2v_prompt")
    p.add_argument("--i2v-image",     default="example.png", dest="i2v_image",
                   help="Filename of the source image already in ComfyUI /input folder")
    args = p.parse_args()

    seed = args.seed if args.seed is not None else random.randint(0, 2**32 - 1)

    print(f"Exporting Wan2.2 workflows — seed={seed} steps={args.steps} cfg={args.cfg} shift={args.shift} swap={args.blocks_to_swap}")
    print()

    save(
        os.path.join(args.out, "wan22_t2v.json"),
        build_t2v(
            prompt=args.t2v_prompt,
            seed=seed,
            steps=args.steps,
            cfg=args.cfg,
            shift=args.shift,
            blocks_to_swap=args.blocks_to_swap,
        ),
    )

    save(
        os.path.join(args.out, "wan22_i2v.json"),
        build_i2v(
            prompt=args.i2v_prompt,
            seed=seed,
            image_filename=args.i2v_image,
            steps=args.steps,
            cfg=args.cfg,
            shift=args.shift,
            blocks_to_swap=args.blocks_to_swap,
        ),
    )

    print()
    print("Load in ComfyUI web: drag & drop the JSON file onto the canvas")
    print("  Make sure 'Enable Dev Mode Options' is ON in ComfyUI Settings")
    print("  (Settings → Enable Dev Mode Options → Load default workflow / drag JSON)")


if __name__ == "__main__":
    main()
