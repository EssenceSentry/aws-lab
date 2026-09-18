import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Check, ChevronRight, X, ZoomIn } from "lucide-react";
import { resolveOptionReferences } from "./option-references.ts";
import { tokenizeRichText } from "./rich-text.ts";
import { DOMAINS, eligibleQuestions } from "./core.ts";
import type { Progress, Question, SessionConfig } from "./core.ts";

export function Dialog({ open = true, title, onClose, children, wide = false }: {
  open?: boolean; title: string; onClose: () => void; children: ReactNode; wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const el = ref.current!;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
    return () => { if (el.open) el.close(); };
  }, [open]);
  return <dialog ref={ref} className={wide ? "dialog wide" : "dialog"} aria-labelledby={id}
    onCancel={(e) => { e.preventDefault(); onClose(); }}
    onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="dialog-panel">
      <div className="dialog-heading"><h2 id={id}>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={22} /></button></div>
      {children}
    </div>
  </dialog>;
}

export function Ring({ value, label, caption, small = false }: { value: number; label: string; caption?: string; small?: boolean }) {
  return <div className={small ? "ring small" : "ring"} style={{ "--progress": Math.max(0, Math.min(100, value)) + "%" } as CSSProperties}>
    <div><strong>{label}</strong>{caption && <span>{caption}</span>}</div>
  </div>;
}

export function DomainMark({ name }: { name: string }) {
  const d = DOMAINS.find((item) => item.name === name)!;
  return <span className={"domain-mark " + d.color} aria-label={"Domain " + d.id}>0{d.id}</span>;
}

function LinkedText({ text }: { text: string }) {
  return <>{tokenizeRichText(text).map((token, i) => {
    if (token.type === "link") return <a key={i} href={token.href} target="_blank" rel="noopener noreferrer">{token.text}</a>;
    if (token.type === "code") return <code key={i}>{token.text}</code>;
    return <span key={i}>{token.text}</span>;
  })}</>;
}

export function RichText({ value, className = "", optionOrder }: { value: string; className?: string; optionOrder?: string[] }) {
  const display = optionOrder ? resolveOptionReferences(value, optionOrder) : value;
  return <div className={"rich-text " + className}>{display.split(/\n\s*\n/).map((part, i) =>
    /^\s*\{[\s\S]*\}\s*$/.test(part) ? <pre key={i}>{part}</pre> : <p key={i}><LinkedText text={part} /></p>,
  )}</div>;
}

export function QuestionImages({ paths, onZoom }: { paths?: string[]; onZoom: (src: string) => void }) {
  return paths?.length ? <div className="question-images">{paths.map((path, i) =>
    <Diagram key={path + i} path={path} index={i} onZoom={onZoom} />,
  )}</div> : null;
}
function Diagram({ path, index, onZoom }: { path: string; index: number; onZoom: (src: string) => void }) {
  const [failed, setFailed] = useState(false);
  const src = new URL("data/" + path, document.baseURI).href;
  if (failed) return <div className="empty-image">This diagram is not available offline yet. Save the image pack in Settings when you’re connected.</div>;
  return <button className="diagram" onClick={() => onZoom(src)} aria-label={"Enlarge diagram " + (index + 1)}>
    <img src={src} alt={"Question diagram " + (index + 1)} loading="lazy" onError={() => setFailed(true)} />
    <span><ZoomIn size={16} /> Tap to enlarge</span>
  </button>;
}

export function ConfigDialog({ initial, bank, progress, onClose, onStart }: {
  initial: SessionConfig; bank: Question[]; progress: Progress; onClose: () => void; onStart: (config: SessionConfig) => void;
}) {
  const [config, setConfig] = useState(initial);
  const available = eligibleQuestions(bank, progress, config).length;
  const count = Math.min(config.count, available);
  const patch = (values: Partial<SessionConfig>) => setConfig((old) => ({ ...old, ...values }));
  const counts = [...new Set([5, 10, 20, 40, 75, Math.min(initial.count, available)].filter((n) => n > 0 && n <= available))].sort((a, b) => a - b);
  return <Dialog title={initial.title} onClose={onClose}>
    <p className="muted dialog-intro">Make this session fit your day.</p>
    <div className="form-stack">
      <label className="field"><span>Focus</span><select value={config.domain} onChange={(e) => patch({ domain: e.target.value })}>
        <option value="all">All domains · exam-weighted mix</option>
        {DOMAINS.map((d) => <option value={d.name} key={d.id}>Domain {d.id} · {d.short}</option>)}
      </select></label>
      {!initial.ids && <label className="field"><span>Question pool</span><select value={config.pool} onChange={(e) => patch({ pool: e.target.value as SessionConfig["pool"] })}>
        <option value="all">All questions</option><option value="unseen">Not answered yet</option>
        <option value="mistakes">Last answered incorrectly</option><option value="saved">Saved questions</option>
      </select></label>}
      <fieldset className="field"><legend>Session length <span className="muted normal-weight">{available} available</span></legend>
        <div className="choice-row">{counts.map((n) => <button key={n} className={count === n ? "choice selected" : "choice"} aria-pressed={count === n}
          onClick={() => patch({ count: n, minutes: Math.ceil(n * 2.4) })}>{n}<span>questions</span></button>)}</div>
      </fieldset>
      <fieldset className="field"><legend>When to see explanations</legend>
        <div className="segmented"><button aria-pressed={config.feedback === "immediate"} className={config.feedback === "immediate" ? "selected" : ""}
          onClick={() => patch({ feedback: "immediate" })}>After each answer</button>
          <button aria-pressed={config.feedback === "end"} className={config.feedback === "end" ? "selected" : ""}
            onClick={() => patch({ feedback: "end" })}>At the end</button></div>
      </fieldset>
      <label className="toggle-row"><span><strong>Use a timer</strong><small>{config.timed ? "The clock keeps running when you leave." : "Take your time. Learn at your own pace."}</small></span>
        <input type="checkbox" role="switch" checked={config.timed} onChange={(e) => patch({ timed: e.target.checked })} />
      </label>
      {config.timed && <label className="field inline-field"><span>Time limit</span><span className="number-field"><input type="number" min="1" max="1440" value={config.minutes}
        onChange={(e) => patch({ minutes: Number(e.target.value) })} /> minutes</span></label>}
      {config.domain === "all" && <p className="fine-print">Mixed sessions follow the SAP-C02 domain weights: 26%, 29%, 25%, and 20%. Smaller pools use the questions available.</p>}
      {!available && <p className="notice">No questions here yet. Try another pool or domain.</p>}
    </div>
    <div className="dialog-actions"><button className="button primary full" disabled={!count || (config.timed && (!Number.isFinite(config.minutes) || config.minutes < 1 || config.minutes > 1440))}
      onClick={() => onStart({ ...config, count })}>Start {count || ""} questions <ChevronRight size={19} /></button></div>
  </Dialog>;
}

export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children: ReactNode; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-symbol">{icon}</div><h3>{title}</h3><p>{children}</p>{action}</div>;
}

export function SavedLabel() { return <span className="saved-label"><Check size={13} /> Saved on this device</span>; }
