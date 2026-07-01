"""MiniAI Visualizer — PyTorch math engine.

A deliberately tiny word-level language model whose every step is inspectable:

    h      : hidden context vector (recurrent state)
    z      : raw logits            z = W @ h + b
    z / T  : temperature-scaled logits
    p      : softmax probabilities p = softmax(z / T)

All parameters are explicit `nn.Parameter` tensors (no nn.Linear black boxes)
so the GUI can display W, b and their updates directly. Tensors live on CUDA
when available, with a CPU fallback.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

import torch
import torch.nn.functional as F
from torch import nn

# ---------------------------------------------------------------------------
# Vocabulary + tiny pre-training corpus
# ---------------------------------------------------------------------------

VOCAB = [
    "<start>", ".", "the", "ai", "model", "gpu", "network", "matrix",
    "math", "token", "data", "dream", "sheep", "electric", "we", "you",
    "it", "and", "then", "of", "next", "learns", "thinks", "computes",
    "predicts", "generates", "dreams", "runs", "fast", "slowly", "deep",
    "big", "small", "new", "is", "on",
]
TOK2ID = {w: i for i, w in enumerate(VOCAB)}
VOCAB_SIZE = len(VOCAB)
D_MODEL = 32

CORPUS = [
    "the ai model learns fast .",
    "the gpu computes deep matrix math .",
    "the network predicts the next token .",
    "we dream of electric sheep .",
    "the ai thinks and then generates the next token .",
    "the model runs fast on the gpu .",
    "the deep network learns the data slowly .",
    "you and the ai dream of new data .",
    "it is small and it learns fast .",
    "the big model generates the next token .",
    "the ai dreams of the new gpu .",
    "the matrix math runs on the deep network .",
]


def get_device() -> torch.device:
    """Pick CUDA when present and switch on the fast-math knobs.

    On an RTX 5060 (Blackwell) these enable TF32 tensor-core paths for the
    matmuls and let cuDNN autotune kernels; both are no-ops on CPU.
    """
    if torch.cuda.is_available():
        torch.backends.cuda.matmul.allow_tf32 = True
        torch.backends.cudnn.allow_tf32 = True
        torch.backends.cudnn.benchmark = True
        torch.set_float32_matmul_precision("high")
        return torch.device("cuda")
    return torch.device("cpu")


def device_description(device: torch.device) -> str:
    if device.type == "cuda":
        name = torch.cuda.get_device_name(device)
        cap = torch.cuda.get_device_capability(device)
        return f"{name} (CUDA, sm_{cap[0]}{cap[1]}, TF32 on)"
    return "CPU (CUDA not available)"


# ---------------------------------------------------------------------------
# Model
# ---------------------------------------------------------------------------


class TinyLM(nn.Module):
    """Minimal recurrent LM with an explicit output head z = W h + b."""

    def __init__(self, vocab_size: int = VOCAB_SIZE, d_model: int = D_MODEL):
        super().__init__()
        g = torch.Generator().manual_seed(42)
        s = 1.0 / math.sqrt(d_model)

        def init(*shape, scale):
            return nn.Parameter(torch.randn(*shape, generator=g) * scale)

        self.E = init(vocab_size, d_model, scale=0.3)   # token embeddings
        self.U = init(d_model, d_model, scale=s)        # recurrent weights
        self.Vin = init(d_model, d_model, scale=s)      # input weights
        self.bh = nn.Parameter(torch.zeros(d_model))    # hidden bias
        self.W = init(vocab_size, d_model, scale=s)     # output weights
        self.b = nn.Parameter(torch.zeros(vocab_size))  # output bias
        self.d_model = d_model
        self.vocab_size = vocab_size

    def init_hidden(self) -> torch.Tensor:
        p = self.W  # any parameter, just for device/dtype
        return torch.zeros(self.d_model, device=p.device, dtype=p.dtype)

    def step_hidden(self, h: torch.Tensor, token_id: int) -> torch.Tensor:
        """h' = tanh(U h + V e_token + bh) — the context update."""
        e = self.E[token_id]
        return torch.tanh(self.U @ h + self.Vin @ e + self.bh)

    def logits(self, h: torch.Tensor) -> torch.Tensor:
        """z = W h + b — the explicit matrix multiply on the GPU."""
        return self.W @ h + self.b


# ---------------------------------------------------------------------------
# Step info returned to the GUI
# ---------------------------------------------------------------------------


@dataclass
class StepInfo:
    h: torch.Tensor            # hidden vector used for this step (CPU copy)
    logits: torch.Tensor       # raw z (CPU copy)
    scaled: torch.Tensor       # z / T (CPU copy)
    probs: torch.Tensor        # softmax(z / T) (CPU copy)
    temperature: float
    token_id: int | None = None      # sampled token (None for previews)
    token: str | None = None
    token_prob: float | None = None


@dataclass
class FeedbackInfo:
    token: str
    token_id: int
    reward: float
    lr: float
    bias_before: float
    bias_after: float
    grad_b: float
    w_row_delta: float          # L2 norm of the change to W[token]
    prob_before: float          # p(token | h) before the update, at T=1
    prob_after: float           # p(token | h) after the update, at T=1
    loss: float


# ---------------------------------------------------------------------------
# Engine: generation state + RL updates + pre-training
# ---------------------------------------------------------------------------


class LMEngine:
    RL_LR = 0.4  # large on purpose so the bias shift is visible in the UI

    def __init__(self):
        self.device = get_device()
        self.model = TinyLM().to(self.device)
        self.h = self.model.init_hidden()
        self.tokens: list[int] = [TOK2ID["<start>"]]
        self.last_step: StepInfo | None = None
        self._last_h_used: torch.Tensor | None = None
        self.update_count = 0
        self.reset()

    # -- sequence state ----------------------------------------------------

    def reset(self):
        with torch.no_grad():
            self.h = self.model.step_hidden(
                self.model.init_hidden(), TOK2ID["<start>"]
            ).detach()
        self.tokens = [TOK2ID["<start>"]]
        self.last_step = None
        self._last_h_used = None

    def text(self) -> str:
        return " ".join(VOCAB[t] for t in self.tokens[1:])

    # -- forward math ------------------------------------------------------

    @torch.no_grad()
    def preview(self, temperature: float) -> StepInfo:
        """Full math for the *next* token without sampling it."""
        z = self.model.logits(self.h)
        scaled = z / temperature
        probs = F.softmax(scaled, dim=-1)
        return StepInfo(
            h=self.h.detach().cpu(),
            logits=z.detach().cpu(),
            scaled=scaled.detach().cpu(),
            probs=probs.detach().cpu(),
            temperature=temperature,
        )

    def generate(self, temperature: float) -> StepInfo:
        """Sample one token, advance the hidden state, remember (h, token)
        so a reward can later be applied to exactly this decision."""
        with torch.no_grad():
            h_used = self.h.detach().clone()
            z = self.model.logits(h_used)
            scaled = z / temperature
            probs = F.softmax(scaled, dim=-1)
            token_id = int(torch.multinomial(probs, 1).item())
            self.h = self.model.step_hidden(h_used, token_id).detach()
        self.tokens.append(token_id)
        self._last_h_used = h_used
        info = StepInfo(
            h=h_used.cpu(),
            logits=z.cpu(),
            scaled=scaled.cpu(),
            probs=probs.cpu(),
            temperature=temperature,
            token_id=token_id,
            token=VOCAB[token_id],
            token_prob=float(probs[token_id]),
        )
        self.last_step = info
        return info

    # -- RL loop -----------------------------------------------------------

    def apply_feedback(self, reward: float) -> FeedbackInfo:
        """One REINFORCE-style step on the output head for the last token.

            J = reward * log p(token | h)        (maximize)
            W <- W + lr * dJ/dW,   b <- b + lr * dJ/db

        implemented as gradient descent on loss = -J. Only W and b receive
        gradients because h is detached, which keeps the update — and the
        bias shift shown in the UI — easy to interpret.
        """
        if self.last_step is None or self._last_h_used is None:
            raise RuntimeError("Generate a token before giving feedback.")
        tok = self.last_step.token_id
        h = self._last_h_used.detach()
        m = self.model

        with torch.no_grad():
            prob_before = float(F.softmax(m.logits(h), dim=-1)[tok])
            bias_before = float(m.b[tok])
            w_row_before = m.W[tok].detach().clone()

        m.zero_grad(set_to_none=True)
        z = m.logits(h)
        loss = -reward * F.log_softmax(z, dim=-1)[tok]
        loss.backward()

        with torch.no_grad():
            grad_b = float(m.b.grad[tok])
            m.W -= self.RL_LR * m.W.grad
            m.b -= self.RL_LR * m.b.grad
            prob_after = float(F.softmax(m.logits(h), dim=-1)[tok])
            bias_after = float(m.b[tok])
            w_row_delta = float(torch.norm(m.W[tok] - w_row_before))
        m.zero_grad(set_to_none=True)

        self.update_count += 1
        return FeedbackInfo(
            token=VOCAB[tok], token_id=tok, reward=reward, lr=self.RL_LR,
            bias_before=bias_before, bias_after=bias_after, grad_b=grad_b,
            w_row_delta=w_row_delta, prob_before=prob_before,
            prob_after=prob_after, loss=float(loss.detach()),
        )

    # -- pre-training ------------------------------------------------------

    def pretrain(self, epochs: int = 40, progress=None):
        """Quick teacher-forced fit on the toy corpus so first-launch output
        is coherent instead of uniform noise. Runs on the GPU when present."""
        m = self.model
        opt = torch.optim.Adam(m.parameters(), lr=0.01)
        seqs = [
            [TOK2ID["<start>"]] + [TOK2ID[w] for w in line.split()]
            for line in CORPUS
        ]
        for epoch in range(epochs):
            total = 0.0
            for seq in seqs:
                h = m.init_hidden()
                loss = torch.zeros((), device=self.device)
                for cur, nxt in zip(seq[:-1], seq[1:]):
                    h = m.step_hidden(h, cur)
                    loss = loss + F.cross_entropy(
                        m.logits(h).unsqueeze(0),
                        torch.tensor([nxt], device=self.device),
                    )
                opt.zero_grad(set_to_none=True)
                loss.backward()
                opt.step()
                total += float(loss.detach()) / (len(seq) - 1)
            if progress:
                progress(epoch + 1, epochs, total / len(seqs))
        self.reset()
