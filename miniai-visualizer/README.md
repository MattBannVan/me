# MiniAI Visualizer

A standalone Windows desktop app that simulates and visually breaks down the
token-by-token generation process of a language model — the hidden context
vector `h`, the raw logits `z = W·h + b`, temperature scaling `z / T`, and the
final softmax distribution — with a REINFORCE-style human-feedback loop that
updates the weights on your GPU and auto-saves them to your local drive.

![architecture](#) <!-- screenshot placeholder -->

## Folder structure

```
miniai-visualizer/
├── app.py            # CustomTkinter GUI (dark mode) — controls, live table, math log
├── model.py          # PyTorch math engine: TinyLM (explicit W, b), sampling, RL updates
├── storage.py        # local save/load: weights.safetensors + meta.json
├── requirements.txt
└── README.md
```

- **`model.py`** owns every tensor. All parameters (`E`, `U`, `Vin`, `bh`,
  `W`, `b`) are explicit `nn.Parameter`s — no `nn.Linear` black boxes — and the
  output head is literally `z = W @ h + b`, executed on CUDA when available.
- **`app.py`** never does math; it renders what the engine returns and calls
  back into it. The temperature slider re-softmaxes **cached** logits, so the
  distribution table updates in real time before you commit to a token.
- **`storage.py`** writes weights to `%LOCALAPPDATA%\MiniAIVisualizer\`
  (safetensors) plus a JSON metadata file, and reloads them on next launch.

## Setup (Windows, RTX 5060)

The RTX 5060 is a **Blackwell** GPU (compute capability `sm_120`). It requires
**PyTorch ≥ 2.7 built against CUDA 12.8** — older wheels do not contain
Blackwell kernels. Install in this exact order:

```bat
:: 1) create and activate a virtual environment (Python 3.10–3.12)
python -m venv .venv
.venv\Scripts\activate

:: 2) CUDA-enabled PyTorch (cu128 wheels bundle the CUDA runtime — no
::    separate CUDA Toolkit install needed; just a current NVIDIA driver)
pip install "torch>=2.7" --index-url https://download.pytorch.org/whl/cu128

:: 3) GUI + storage libraries
pip install customtkinter safetensors numpy
```

Verify the GPU is picked up:

```bat
python -c "import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name(0))"
:: expected: True NVIDIA GeForce RTX 5060
```

Run the app:

```bat
python app.py
```

If CUDA is unavailable the app transparently falls back to CPU (the device in
use is shown in the top-left of the window).

### GPU notes (what's tuned for the 5060)

`model.get_device()` enables the fast paths Blackwell benefits from:

- `torch.backends.cuda.matmul.allow_tf32 = True` and
  `torch.set_float32_matmul_precision("high")` — routes the `W @ h` matmuls
  through TF32 tensor cores;
- `torch.backends.cudnn.benchmark = True` — lets cuDNN autotune kernels for
  the fixed tensor shapes used here.

## Using the app

1. **First launch** — the model quick-pretrains on a tiny built-in corpus
   (a few seconds), then saves weights locally. Later launches load the saved
   weights, including every feedback update you've ever applied.
2. **Temperature slider (0.1–2.0)** — drag it and watch the top-10 table
   re-render live: low T sharpens the softmax toward the argmax, high T
   flattens it toward uniform. No token is generated until you press the button.
3. **Generate Next Token** — samples one token from `softmax(z/T)` and appends
   a full breakdown to the math log: the `h` vector, top-5 raw logits, their
   scaled values, the probabilities, and which token was drawn.
4. **Feedback (RL loop)** — after a token is generated, press
   **👍 +1.0** or **👎 −0.5**. The engine performs one REINFORCE step on the
   output head:

   ```
   J = r · log p(token | h)          maximize via gradient ascent
   W ← W + lr · ∂J/∂W                b ← b + lr · ∂J/∂b
   ```

   The UI shows `b[token]` before → after (with a colored meter), the gradient,
   `‖ΔW[token]‖`, and the probability change — then **auto-saves** the new
   weights to disk and refreshes the pending distribution table.

## The math, precisely

Per step, with hidden state `h ∈ ℝ³²` and vocab size `V = 36`:

| Stage        | Formula                                  | Where shown            |
|--------------|------------------------------------------|------------------------|
| Context      | `h' = tanh(U·h + Vin·E[token] + bh)`     | math log (`h`, ‖h‖)    |
| Logits       | `z = W·h + b`, `W ∈ ℝ^{V×32}, b ∈ ℝ^V`   | table col "logit z"    |
| Temperature  | `z̃ = z / T`, `T ∈ [0.1, 2.0]`            | table col "z/T", live  |
| Softmax      | `p_i = e^{z̃_i} / Σ_j e^{z̃_j}`            | table col "p" + bars   |
| Sampling     | `token ~ Categorical(p)`                 | math log "sampled →"   |
| RL update    | `∂(−J)/∂b_j = −r·(𝟙[j=t] − p_j)`         | math log RL section    |

## Saved files

| File | Contents |
|------|----------|
| `%LOCALAPPDATA%\MiniAIVisualizer\weights.safetensors` | all model tensors (`E, U, Vin, bh, W, b`) |
| `%LOCALAPPDATA%\MiniAIVisualizer\meta.json`           | vocab, model dims, update counter, timestamp |

Delete the folder to reset the model to a fresh pre-train.
