import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import type { Question } from "./core.ts";
import { Dialog } from "./components.tsx";
import { questionShareText } from "./share.ts";
import type { SharePart } from "./share.ts";

export function ShareQuestion({ question, optionOrder }: { question: Question; optionOrder: string[] }) {
  const [open, setOpen] = useState(false);
  const [part, setPart] = useState<SharePart>("question");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const text = questionShareText(question, optionOrder, part);
  const native = typeof navigator.share === "function" && (typeof navigator.canShare !== "function" || navigator.canShare({ text }));
  async function share() {
    setBusy(true); setError("");
    try {
      // Call directly from the tap so native sharing retains user activation.
      await navigator.share({ text });
      setOpen(false);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setError("Sharing couldn’t open. You can copy the text below instead.");
    } finally { setBusy(false); }
  }
  async function copy() {
    setError("");
    try { await navigator.clipboard.writeText(text); setCopied(true); }
    catch { setError("Copying isn’t available here. Open the preview to select and copy the text."); }
  }
  return <>
    <button className="text-button" aria-label="Share question or answer" onClick={() => { setOpen(true); setError(""); setCopied(false); }}><Share2 size={17} /> Share</button>
    {open && <Dialog title="Share as text" onClose={() => setOpen(false)}>
      <p className="muted">Take this question into a conversation. Choose what to include.</p>
      <fieldset className="share-choices"><legend className="sr-only">What to share</legend>{([ ["question", "Question", "Prompt and answer choices"], ["answer", "Answer", "Correct choices and explanation"], ["both", "Both", "The complete question and answer"] ] as const).map(([id, title, detail]) =>
        <label key={id} className={part === id ? "share-choice selected" : "share-choice"}><input type="radio" name="share-part" checked={part === id} onChange={() => { setPart(id); setCopied(false); setError(""); }} /><span><strong>{title}</strong><small>{detail}</small></span></label>,
      )}</fieldset>
      <details className="share-preview"><summary>Preview text</summary><pre tabIndex={0}>{text}</pre></details>
      {!native && <p className="fine-print">Copy the text, then paste it into the app you want to use.</p>}
      {error && <p className="notice" role="alert">{error}</p>}
      <div className="dialog-actions stacked">
        {native && <button className="button primary full" disabled={busy} onClick={() => { void share(); }}><Share2 size={18} /> {busy ? "Opening share sheet…" : "Share text"}</button>}
        <button className={"button full " + (native ? "secondary" : "primary")} onClick={() => { void copy(); }}>{copied ? <Check size={18} /> : <Copy size={18} />}{copied ? "Copied" : "Copy text"}</button>
        <span className="sr-only" role="status">{copied ? "Text copied to clipboard" : ""}</span>
      </div>
    </Dialog>}
  </>;
}
