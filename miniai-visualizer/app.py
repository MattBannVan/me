"""MiniAI Visualizer — CustomTkinter GUI.

Run:  python app.py

Layout
    ┌──────────────┬──────────────────────────────────────────┐
    │ Controls     │ Generated sequence                        │
    │  temperature │──────────────────────────────────────────│
    │  generate    │ Live distribution table (top 10 tokens)  │
    │  feedback    │──────────────────────────────────────────│
    │  save status │ Scrolling math log (h, z, z/T, softmax)  │
    └──────────────┴──────────────────────────────────────────┘

The distribution table re-renders on every temperature-slider tick using the
cached logits, so you can watch softmax sharpen/flatten *before* committing
to "Generate Next Token".
"""

from __future__ import annotations

import queue
import threading

import customtkinter as ctk

import storage
from model import LMEngine, StepInfo, device_description

MONO = ("Consolas", 12)
MONO_SMALL = ("Consolas", 11)
TABLE_ROWS = 10
BAR_WIDTH = 22

ACCENT = "#3B8ED0"
GOOD = "#2FA572"
BAD = "#E5484D"


def fmt_vec(t, n=8, prec=3):
    vals = ", ".join(f"{v:+.{prec}f}" for v in t[:n].tolist())
    tail = ", …" if t.numel() > n else ""
    return f"[{vals}{tail}]  (dim={t.numel()})"


def prob_bar(p: float) -> str:
    full = int(round(p * BAR_WIDTH))
    return "█" * full + "░" * (BAR_WIDTH - full)


class App(ctk.CTk):
    def __init__(self):
        super().__init__()
        ctk.set_appearance_mode("dark")
        ctk.set_default_color_theme("dark-blue")
        self.title("MiniAI Visualizer — token-by-token LM math")
        self.geometry("1240x800")
        self.minsize(1000, 680)

        self.engine: LMEngine | None = None
        self.cached: StepInfo | None = None   # preview for the *next* token
        self._msgs: queue.Queue = queue.Queue()

        self._build_layout()
        self._set_busy(True, "Initializing engine…")
        threading.Thread(target=self._startup, daemon=True).start()
        self.after(80, self._poll_messages)

    # ------------------------------------------------------------------ UI

    def _build_layout(self):
        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)

        # ---- left: control dashboard ----
        left = ctk.CTkFrame(self, width=320, corner_radius=0)
        left.grid(row=0, column=0, sticky="nsw")
        left.grid_propagate(False)

        ctk.CTkLabel(left, text="MiniAI Visualizer",
                     font=("Segoe UI", 22, "bold")).pack(padx=16, pady=(18, 2), anchor="w")
        self.device_label = ctk.CTkLabel(left, text="device: …",
                                         font=("Segoe UI", 11),
                                         text_color="#9A9FA6", wraplength=280,
                                         justify="left")
        self.device_label.pack(padx=16, anchor="w")

        # temperature
        tf = ctk.CTkFrame(left)
        tf.pack(fill="x", padx=12, pady=(18, 8))
        ctk.CTkLabel(tf, text="Temperature  (z / T)",
                     font=("Segoe UI", 13, "bold")).pack(padx=10, pady=(10, 0), anchor="w")
        self.temp_value = ctk.CTkLabel(tf, text="T = 1.00", font=MONO)
        self.temp_value.pack(padx=10, anchor="w")
        self.temp_slider = ctk.CTkSlider(tf, from_=0.1, to=2.0,
                                         number_of_steps=190,
                                         command=self._on_temperature)
        self.temp_slider.set(1.0)
        self.temp_slider.pack(fill="x", padx=10, pady=(2, 12))

        # generation
        self.gen_btn = ctk.CTkButton(left, text="▶  Generate Next Token",
                                     height=44, font=("Segoe UI", 14, "bold"),
                                     command=self._on_generate)
        self.gen_btn.pack(fill="x", padx=12, pady=(8, 4))
        self.reset_btn = ctk.CTkButton(left, text="⟲  Reset Sequence",
                                       height=32, fg_color="transparent",
                                       border_width=1,
                                       command=self._on_reset)
        self.reset_btn.pack(fill="x", padx=12, pady=(0, 8))

        # feedback / RL loop
        ff = ctk.CTkFrame(left)
        ff.pack(fill="x", padx=12, pady=8)
        ctk.CTkLabel(ff, text="Feedback  (REINFORCE on W, b)",
                     font=("Segoe UI", 13, "bold")).pack(padx=10, pady=(10, 0), anchor="w")
        self.last_token_label = ctk.CTkLabel(ff, text="last token: —", font=MONO)
        self.last_token_label.pack(padx=10, anchor="w")
        row = ctk.CTkFrame(ff, fg_color="transparent")
        row.pack(fill="x", padx=10, pady=6)
        row.grid_columnconfigure((0, 1), weight=1)
        self.pos_btn = ctk.CTkButton(row, text="👍  +1.0", fg_color=GOOD,
                                     hover_color="#26855B", state="disabled",
                                     command=lambda: self._on_feedback(+1.0))
        self.pos_btn.grid(row=0, column=0, sticky="ew", padx=(0, 4))
        self.neg_btn = ctk.CTkButton(row, text="👎  −0.5", fg_color=BAD,
                                     hover_color="#B93A3E", state="disabled",
                                     command=lambda: self._on_feedback(-0.5))
        self.neg_btn.grid(row=0, column=1, sticky="ew", padx=(4, 0))

        ctk.CTkLabel(ff, text="bias shift  b[token]",
                     font=("Segoe UI", 11), text_color="#9A9FA6").pack(padx=10, anchor="w")
        self.bias_label = ctk.CTkLabel(ff, text="—", font=MONO)
        self.bias_label.pack(padx=10, anchor="w")
        self.bias_bar = ctk.CTkProgressBar(ff, progress_color=ACCENT)
        self.bias_bar.set(0.5)
        self.bias_bar.pack(fill="x", padx=10, pady=(2, 12))

        # save status
        self.save_label = ctk.CTkLabel(left, text="", font=("Segoe UI", 11),
                                       text_color="#9A9FA6", wraplength=290,
                                       justify="left")
        self.save_label.pack(padx=16, pady=(6, 4), anchor="w")
        self.status_label = ctk.CTkLabel(left, text="", font=("Segoe UI", 11),
                                         text_color=ACCENT, wraplength=290,
                                         justify="left")
        self.status_label.pack(side="bottom", padx=16, pady=12, anchor="w")

        # ---- right: sequence + table + math log ----
        right = ctk.CTkFrame(self, fg_color="transparent")
        right.grid(row=0, column=1, sticky="nsew", padx=10, pady=10)
        right.grid_columnconfigure(0, weight=1)
        right.grid_rowconfigure(2, weight=1)

        ctk.CTkLabel(right, text="Generated sequence",
                     font=("Segoe UI", 13, "bold")).grid(row=0, column=0, sticky="w")
        self.seq_box = ctk.CTkTextbox(right, height=64, font=("Segoe UI", 16),
                                      wrap="word")
        self.seq_box.grid(row=0, column=0, sticky="ew", pady=(26, 8))
        self.seq_box.configure(state="disabled")

        table_frame = ctk.CTkFrame(right)
        table_frame.grid(row=1, column=0, sticky="ew", pady=(0, 8))
        header = ctk.CTkLabel(
            table_frame,
            text="Next-token distribution (top 10) — live with temperature",
            font=("Segoe UI", 13, "bold"))
        header.pack(padx=10, pady=(8, 2), anchor="w")
        self.table_head = ctk.CTkLabel(
            table_frame,
            text=f"{'token':<12}{'logit z':>10}{'z/T':>10}{'p':>9}  distribution",
            font=MONO, text_color="#9A9FA6")
        self.table_head.pack(padx=10, anchor="w")
        self.table_rows = []
        for _ in range(TABLE_ROWS):
            lbl = ctk.CTkLabel(table_frame, text="", font=MONO, anchor="w")
            lbl.pack(padx=10, anchor="w")
            self.table_rows.append(lbl)
        ctk.CTkLabel(table_frame, text="", height=4).pack()

        ctk.CTkLabel(right, text="Math log",
                     font=("Segoe UI", 13, "bold")).grid(row=2, column=0,
                                                         sticky="nw")
        self.log_box = ctk.CTkTextbox(right, font=MONO_SMALL, wrap="none")
        self.log_box.grid(row=2, column=0, sticky="nsew", pady=(26, 0))
        self.log_box.configure(state="disabled")

    # --------------------------------------------------------------- events

    def _startup(self):
        """Runs on a worker thread: build engine, load or pretrain weights."""
        engine = LMEngine()
        self._msgs.put(("device", device_description(engine.device)))
        if storage.load(engine):
            self._msgs.put(("status", "Loaded saved weights from disk."))
        else:
            def prog(e, total, loss):
                self._msgs.put(("busy", f"Pre-training… epoch {e}/{total}  "
                                        f"loss {loss:.3f}"))
            engine.pretrain(progress=prog)
            path = storage.save(engine)
            self._msgs.put(("status", f"Pre-trained and saved to {path.parent}"))
        self._msgs.put(("ready", engine))

    def _poll_messages(self):
        try:
            while True:
                kind, payload = self._msgs.get_nowait()
                if kind == "device":
                    self.device_label.configure(text=f"device: {payload}")
                elif kind == "busy":
                    self.status_label.configure(text=payload)
                elif kind == "status":
                    self.status_label.configure(text=payload)
                elif kind == "ready":
                    self.engine = payload
                    self._set_busy(False, "Ready.")
                    self._log_header()
                    self._refresh_sequence()
                    self._refresh_preview()
        except queue.Empty:
            pass
        self.after(80, self._poll_messages)

    def _set_busy(self, busy: bool, text: str = ""):
        state = "disabled" if busy else "normal"
        self.gen_btn.configure(state=state)
        self.reset_btn.configure(state=state)
        if busy:
            self.pos_btn.configure(state="disabled")
            self.neg_btn.configure(state="disabled")
        if text:
            self.status_label.configure(text=text)

    def _temperature(self) -> float:
        return round(float(self.temp_slider.get()), 2)

    def _on_temperature(self, _value):
        t = self._temperature()
        self.temp_value.configure(text=f"T = {t:.2f}")
        # re-render the softmax from cached logits without touching the model
        if self.cached is not None:
            scaled = self.cached.logits / t
            probs = scaled.softmax(dim=-1)
            self._render_table(self.cached.logits, scaled, probs)

    def _on_generate(self):
        if self.engine is None:
            return
        t = self._temperature()
        info = self.engine.generate(t)
        self._refresh_sequence()
        self._log_step(info)
        self.last_token_label.configure(
            text=f'last token: "{info.token}"  p={info.token_prob:.4f}')
        self.pos_btn.configure(state="normal")
        self.neg_btn.configure(state="normal")
        self._refresh_preview()

    def _on_reset(self):
        if self.engine is None:
            return
        self.engine.reset()
        self.cached = None
        self._refresh_sequence()
        self.last_token_label.configure(text="last token: —")
        self.bias_label.configure(text="—")
        self.pos_btn.configure(state="disabled")
        self.neg_btn.configure(state="disabled")
        self._log("\n═══ sequence reset ═══\n")
        self._refresh_preview()

    def _on_feedback(self, reward: float):
        if self.engine is None or self.engine.last_step is None:
            return
        fb = self.engine.apply_feedback(reward)
        path = storage.save(self.engine)
        self.save_label.configure(
            text=f"auto-saved → {path}\nupdates so far: {self.engine.update_count}")

        arrow = "▲" if fb.bias_after > fb.bias_before else "▼"
        self.bias_label.configure(
            text=f'b["{fb.token}"] {fb.bias_before:+.4f} → '
                 f'{fb.bias_after:+.4f} {arrow}')
        # map bias into a 0..1 meter centered at 0.5 (±2.0 range)
        self.bias_bar.set(min(1.0, max(0.0, 0.5 + fb.bias_after / 4.0)))
        self.bias_bar.configure(progress_color=GOOD if reward > 0 else BAD)

        self._log(
            f"\n─── RL update (REINFORCE) ────────────────────────────────\n"
            f'  token      : "{fb.token}" (id {fb.token_id})\n'
            f"  reward r   : {fb.reward:+.1f}    lr: {fb.lr}\n"
            f"  objective  : J = r · log p(token|h)   (gradient ascent)\n"
            f"  loss −J    : {fb.loss:+.4f}\n"
            f"  ∂(−J)/∂b[t]: {fb.grad_b:+.4f}\n"
            f"  b[token]   : {fb.bias_before:+.4f} → {fb.bias_after:+.4f} "
            f"(Δ {fb.bias_after - fb.bias_before:+.4f})\n"
            f"  ‖ΔW[token]‖: {fb.w_row_delta:.4f}\n"
            f"  p(token|h) : {fb.prob_before:.4f} → {fb.prob_after:.4f}\n"
            f"  weights auto-saved ✓\n")
        # weights changed → the pending next-token distribution changed too
        self._refresh_preview()

    # ------------------------------------------------------------ rendering

    def _refresh_sequence(self):
        self.seq_box.configure(state="normal")
        self.seq_box.delete("1.0", "end")
        text = self.engine.text() if self.engine else ""
        self.seq_box.insert("1.0", text or "⟨empty — press Generate⟩")
        self.seq_box.configure(state="disabled")

    def _refresh_preview(self):
        """Recompute next-token math with current weights, refresh table."""
        if self.engine is None:
            return
        self.cached = self.engine.preview(self._temperature())
        self._render_table(self.cached.logits, self.cached.scaled,
                           self.cached.probs)

    def _render_table(self, logits, scaled, probs):
        from model import VOCAB
        top = probs.argsort(descending=True)[:TABLE_ROWS]
        for lbl, idx in zip(self.table_rows, top.tolist()):
            p = float(probs[idx])
            lbl.configure(text=f"{VOCAB[idx]:<12}{float(logits[idx]):>10.4f}"
                               f"{float(scaled[idx]):>10.4f}{p:>9.4f}  "
                               f"{prob_bar(p)}")

    def _log(self, text: str):
        self.log_box.configure(state="normal")
        self.log_box.insert("end", text)
        self.log_box.see("end")
        self.log_box.configure(state="disabled")

    def _log_header(self):
        self._log(
            "MiniAI Visualizer — math log\n"
            "  h            hidden context vector\n"
            "  z = W·h + b  raw logits (matmul on "
            f"{self.engine.device.type.upper()})\n"
            "  z/T          temperature-scaled logits\n"
            "  softmax(z/T) probability distribution\n"
            "════════════════════════════════════════════════════════════\n")

    def _log_step(self, info: StepInfo):
        from model import VOCAB
        top = info.probs.argsort(descending=True)[:5]
        lines = [
            f"\n─── step {len(self.engine.tokens) - 1}  (T={info.temperature:.2f}) "
            "──────────────────────────────",
            f"  h        = {fmt_vec(info.h)}",
            f"  ‖h‖      = {float(info.h.norm()):.4f}",
            "  z = W·h + b   → top-5:",
        ]
        for i in top.tolist():
            lines.append(f'    {VOCAB[i]:<12} z={float(info.logits[i]):+8.4f}'
                         f'  z/T={float(info.scaled[i]):+8.4f}'
                         f'  p={float(info.probs[i]):.4f}')
        lines.append(f'  sampled  → "{info.token}"  '
                     f"(p={info.token_prob:.4f}, id={info.token_id})")
        self._log("\n".join(lines) + "\n")


if __name__ == "__main__":
    App().mainloop()
