"""MiniAI Visualizer — local persistence.

Weights go to a `.safetensors` file, run metadata (vocab, update counter,
timestamps) to a JSON file next to it. Everything lives under the user's
local app-data directory:

    Windows:  %LOCALAPPDATA%\\MiniAIVisualizer\\
    other:    ~/.miniai_visualizer/
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path

from safetensors.torch import load_file, save_file

from model import D_MODEL, VOCAB

WEIGHTS_FILE = "weights.safetensors"
META_FILE = "meta.json"


def default_save_dir() -> Path:
    if os.name == "nt":
        base = Path(os.environ.get("LOCALAPPDATA", Path.home()))
        return base / "MiniAIVisualizer"
    return Path.home() / ".miniai_visualizer"


def save(engine, save_dir: Path | None = None) -> Path:
    """Persist current weights + metadata. Returns the weights path."""
    save_dir = save_dir or default_save_dir()
    save_dir.mkdir(parents=True, exist_ok=True)

    # safetensors requires contiguous CPU tensors
    state = {
        k: v.detach().cpu().contiguous()
        for k, v in engine.model.state_dict().items()
    }
    weights_path = save_dir / WEIGHTS_FILE
    save_file(state, str(weights_path))

    meta = {
        "vocab": VOCAB,
        "d_model": D_MODEL,
        "update_count": engine.update_count,
        "saved_at": datetime.now(timezone.utc).isoformat(),
    }
    (save_dir / META_FILE).write_text(json.dumps(meta, indent=2),
                                      encoding="utf-8")
    return weights_path


def load(engine, save_dir: Path | None = None) -> bool:
    """Load saved weights into the engine if a compatible save exists.
    Returns True on success, False when there is nothing (usable) to load."""
    save_dir = save_dir or default_save_dir()
    weights_path = save_dir / WEIGHTS_FILE
    meta_path = save_dir / META_FILE
    if not weights_path.exists():
        return False

    try:
        if meta_path.exists():
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
            if meta.get("vocab") != VOCAB or meta.get("d_model") != D_MODEL:
                print(f"[storage] ignoring {weights_path}: saved vocab/dims "
                      "don't match the current model definition")
                return False
            engine.update_count = int(meta.get("update_count", 0))
        state = load_file(str(weights_path), device=str(engine.device))
        engine.model.load_state_dict(state)
        engine.reset()
        return True
    except Exception as exc:
        print(f"[storage] failed to load {weights_path}: {exc}")
        return False
