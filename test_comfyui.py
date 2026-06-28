#!/usr/bin/env python3
"""
ComfyUI API test — Wan2.2 T2V cascade (high_noise + low_noise 14B)
Usage:
  python3 test_comfyui.py                         # T2V with default prompt
  python3 test_comfyui.py --prompt "a sunset"     # custom prompt
  python3 test_comfyui.py --steps 10              # fewer steps (faster test)
  python3 test_comfyui.py --seed 42               # fixed seed
  python3 test_comfyui.py --host 192.168.1.60     # custom host
"""

import argparse
import json
import random
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime

# ── Constants ────────────────────────────────────────────────────────────────

DEFAULTS = {
    "host": "192.168.1.60",
    "port": 8188,
    "prompt": "cherry blossom petals falling in spring wind, slow motion, soft bokeh",
    "steps": 20,
    "cfg": 3.5,
    "shift": 8.0,
    "width": 1280,
    "height": 720,
    "frames": 81,
    "blocks_to_swap": 0,
}

WAN_VAE           = "wan_2.1_vae.safetensors"
WAN_T2V_HIGH      = "wan2.2_t2v_high_noise_14B_fp8_scaled.safetensors"
WAN_T2V_LOW       = "wan2.2_t2v_low_noise_14B_fp8_scaled.safetensors"
WAN_TEXT_ENCODER  = "umt5-xxl-enc-fp8_e4m3fn-fixed.safetensors"
WAN_NEGATIVE      = (
    "oversaturated colors, overexposed, static, blurry details, subtitles, "
    "artwork, painting, still image, motionless, overall grayish, worst quality, "
    "low quality, JPEG compression artifacts, ugly, incomplete, extra fingers, "
    "poorly drawn hands, poorly drawn face, deformed, disfigured, malformed limbs, "
    "fused fingers, static motionless scene, cluttered background, three legs, "
    "many people in background, walking backwards"
)

# ── Workflow builder ──────────────────────────────────────────────────────────

def build_t2v_workflow(prompt: str, seed: int, cfg: float, steps: int,
                        shift: float, width: int, height: int, frames: int,
                        blocks_to_swap: int) -> dict:
    mid = steps // 2  # split budget: first half = high_noise, second half = low_noise

    block_swap = {
        "class_type": "WanVideoBlockSwap",
        "inputs": {
            "blocks_to_swap": blocks_to_swap,
            "offload_img_emb": False,
            "offload_txt_emb": False,
        },
    }

    def model_loader(model_name: str) -> dict:
        return {
            "class_type": "WanVideoModelLoader",
            "inputs": {
                "model": model_name,
                "base_precision": "fp16_fast",
                "quantization": "fp8_e4m3fn_scaled",
                "load_device": "offload_device",
                "block_swap_args": ["4", 0],
            },
        }

    return {
        "1": {
            "class_type": "LoadWanVideoT5TextEncoder",
            "inputs": {
                "model_name": WAN_TEXT_ENCODER,
                "precision": "fp32",
                "load_device": "offload_device",
            },
        },
        "2": {
            "class_type": "WanVideoTextEncode",
            "inputs": {
                "positive_prompt": prompt,
                "negative_prompt": WAN_NEGATIVE,
                "t5": ["1", 0],
                "force_offload": True,
            },
        },
        "3": {
            "class_type": "WanVideoVAELoader",
            "inputs": {"model_name": WAN_VAE, "precision": "bf16"},
        },
        "4": block_swap,
        "5": model_loader(WAN_T2V_HIGH),
        "6": model_loader(WAN_T2V_LOW),
        "7": {
            "class_type": "WanVideoEmptyEmbeds",
            "inputs": {"width": width, "height": height, "num_frames": frames},
        },
        # Pass 1 — high-noise expert
        "8": {
            "class_type": "WanVideoSchedulerv2",
            "inputs": {
                "scheduler": "euler",
                "steps": steps,
                "shift": shift,
                "start_step": 0,
                "end_step": mid,
            },
        },
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
        # Pass 2 — low-noise expert (continues from pass 1 latent)
        "10": {
            "class_type": "WanVideoSchedulerv2",
            "inputs": {
                "scheduler": "euler",
                "steps": steps,
                "shift": shift,
                "start_step": mid,
                "end_step": -1,
            },
        },
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
        "12": {
            "class_type": "WanVideoDecode",
            "inputs": {
                "vae": ["3", 0],
                "samples": ["11", 0],
                "enable_vae_tiling": False,
                "tile_x": 272,
                "tile_y": 272,
                "tile_stride_x": 144,
                "tile_stride_y": 144,
            },
        },
        "13": {
            "class_type": "VHS_VideoCombine",
            "inputs": {
                "images": ["12", 0],
                "frame_rate": 24,
                "loop_count": 0,
                "filename_prefix": "test_wan22",
                "format": "video/h264-mp4",
                "pix_fmt": "yuv420p",
                "crf": 19,
                "save_metadata": False,
                "trim_to_audio": False,
                "pingpong": False,
                "save_output": True,
            },
        },
    }


# ── API helpers ───────────────────────────────────────────────────────────────

def api(host: str, port: int, path: str, body: dict | None = None) -> dict:
    url = f"http://{host}:{port}{path}"
    data = json.dumps(body).encode() if body else None
    headers = {"Content-Type": "application/json"} if data else {}
    req = urllib.request.Request(url, data=data, headers=headers)
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())


def system_stats(host: str, port: int) -> None:
    try:
        s = api(host, port, "/system_stats")
        dev = s["devices"][0]
        vram_total = dev["vram_total"] / (1024**3)
        vram_free  = dev["vram_free"]  / (1024**3)
        vram_used  = vram_total - vram_free
        print(f"  GPU  : {dev['name']}")
        print(f"  VRAM : {vram_used:.1f} GB used / {vram_total:.1f} GB total ({vram_free:.1f} GB free)")
    except Exception as e:
        print(f"  [stats unavailable: {e}]")


def submit(host: str, port: int, workflow: dict) -> str:
    result = api(host, port, "/prompt", {"prompt": workflow})
    prompt_id = result.get("prompt_id")
    if not prompt_id:
        raise RuntimeError(f"No prompt_id in response: {result}")
    return prompt_id


def poll(host: str, port: int, prompt_id: str, interval: int = 10) -> dict:
    print(f"\n  Polling every {interval}s …")
    start = time.time()
    dots = 0
    while True:
        history = api(host, port, f"/history/{prompt_id}")
        if prompt_id in history:
            elapsed = time.time() - start
            print(f"\n  Done in {elapsed:.0f}s ({elapsed/60:.1f} min)")
            return history[prompt_id]

        elapsed = time.time() - start
        dots += 1
        print(f"  [{elapsed:>5.0f}s] still running {'.' * (dots % 4 + 1)}", end="\r")
        time.sleep(interval)


def extract_video(history_entry: dict) -> dict | None:
    for node in history_entry.get("outputs", {}).values():
        file = (node.get("gifs") or node.get("videos") or [None])[0]
        if file and file.get("filename"):
            return file
    return None


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser(description="Wan2.2 ComfyUI API test")
    p.add_argument("--host",          default=DEFAULTS["host"])
    p.add_argument("--port",          default=DEFAULTS["port"],    type=int)
    p.add_argument("--prompt",        default=DEFAULTS["prompt"])
    p.add_argument("--seed",          default=None,                type=int)
    p.add_argument("--steps",         default=DEFAULTS["steps"],   type=int)
    p.add_argument("--cfg",           default=DEFAULTS["cfg"],     type=float)
    p.add_argument("--shift",         default=DEFAULTS["shift"],   type=float)
    p.add_argument("--width",         default=DEFAULTS["width"],   type=int)
    p.add_argument("--height",        default=DEFAULTS["height"],  type=int)
    p.add_argument("--frames",        default=DEFAULTS["frames"],  type=int)
    p.add_argument("--blocks-to-swap",default=DEFAULTS["blocks_to_swap"], type=int, dest="blocks_to_swap")
    p.add_argument("--poll-interval", default=10,                  type=int, dest="poll_interval")
    args = p.parse_args()

    seed = args.seed if args.seed is not None else random.randint(0, 2**32 - 1)

    print("=" * 60)
    print("  Wan2.2 T2V — ComfyUI API test")
    print("=" * 60)
    print(f"  Host    : {args.host}:{args.port}")
    print(f"  Prompt  : {args.prompt[:80]}")
    print(f"  Seed    : {seed}")
    print(f"  Steps   : {args.steps}  (high_noise: 0→{args.steps//2}, low_noise: {args.steps//2}→{args.steps})")
    print(f"  CFG     : {args.cfg}   Shift: {args.shift}")
    print(f"  Size    : {args.width}×{args.height} × {args.frames} frames")
    print(f"  Swap    : {args.blocks_to_swap} blocks")
    print()

    # System stats before
    print("System stats (before):")
    system_stats(args.host, args.port)
    print()

    # Check queue
    try:
        queue = api(args.host, args.port, "/queue")
        running = len(queue.get("queue_running", []))
        pending = len(queue.get("queue_pending", []))
        if running or pending:
            print(f"  ⚠  Queue not empty: {running} running, {pending} pending")
            ans = input("  Continue anyway? [y/N] ").strip().lower()
            if ans != "y":
                sys.exit(0)
    except urllib.error.URLError as e:
        print(f"  ✗ Cannot reach ComfyUI at {args.host}:{args.port}: {e}")
        sys.exit(1)

    # Build & submit
    workflow = build_t2v_workflow(
        prompt=args.prompt,
        seed=seed,
        cfg=args.cfg,
        steps=args.steps,
        shift=args.shift,
        width=args.width,
        height=args.height,
        frames=args.frames,
        blocks_to_swap=args.blocks_to_swap,
    )

    print(f"Submitting workflow ({len(workflow)} nodes) …")
    t0 = time.time()
    try:
        prompt_id = submit(args.host, args.port, workflow)
    except Exception as e:
        print(f"  ✗ Submit failed: {e}")
        sys.exit(1)

    print(f"  prompt_id: {prompt_id}")
    print(f"  ComfyUI queue: http://{args.host}:{args.port}")

    # Poll until done
    try:
        entry = poll(args.host, args.port, prompt_id, interval=args.poll_interval)
    except KeyboardInterrupt:
        print(f"\n  Interrupted. prompt_id to resume: {prompt_id}")
        sys.exit(0)

    # Results
    total_time = time.time() - t0
    video = extract_video(entry)

    print()
    print("=" * 60)
    if video:
        print(f"  ✓ Video generated in {total_time:.0f}s ({total_time/60:.1f} min)")
        print(f"  File     : {video['filename']}")
        print(f"  Subfolder: {video.get('subfolder', '')}")
        print(f"  Type     : {video.get('type', '')}")
        url = f"http://{args.host}:{args.port}/view?filename={video['filename']}&subfolder={video.get('subfolder','')}&type={video.get('type','output')}"
        print(f"  URL      : {url}")
    else:
        status = entry.get("status", {})
        print(f"  ✗ No video in output. Status: {status}")
        print(f"  Outputs: {json.dumps(entry.get('outputs', {}), indent=2)[:500]}")

    print()
    print("System stats (after):")
    system_stats(args.host, args.port)
    print("=" * 60)


if __name__ == "__main__":
    main()
