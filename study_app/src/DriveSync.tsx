import { useEffect, useRef, useState } from "react";
import { Cloud, CloudCheck, Download, RefreshCw } from "lucide-react";
import { Dialog } from "./components.tsx";
import type { Progress, Question } from "./core.ts";
import { connectDrive, disconnectDrive, driveStore, prepareGoogle } from "./google-drive.ts";
import type { DriveAccount } from "./google-drive.ts";
import { bankFingerprint, commitSync, fingerprint, planSync, progressKey, summary } from "./sync-core.ts";
import type { CloudStore, Snapshot, SyncMark, SyncPlan } from "./sync-core.ts";
import { downloadJSON, STORAGE_KEY } from "./storage.ts";

const ACCOUNT_KEY = "waypoint.drive.account.v1";
const MARK_KEY = "waypoint.drive.sync.v1.";
export const DRIVE_RECOVERY_KEY = STORAGE_KEY + ".before-drive-sync";
type Identity = Pick<DriveAccount, "sub" | "email">;
type Pending = { account: DriveAccount; store: CloudStore; plan: SyncPlan; bankKey: string; disk: string | null };
function savedAccount(): Identity | null {
  try {
    const v = JSON.parse(localStorage.getItem(ACCOUNT_KEY) ?? "null");
    return v && typeof v.sub === "string" && typeof v.email === "string" ? { sub: v.sub, email: v.email } : null;
  } catch { return null; }
}
function savedMark(account: Identity | null): SyncMark | null {
  try {
    const v = JSON.parse(localStorage.getItem(MARK_KEY + account?.sub) ?? "null");
    return v && v.account === account?.sub && /^[a-f0-9]{64}$/.test(v.fingerprint) && Number.isFinite(Date.parse(v.syncedAt)) ? v : null;
  } catch { return null; }
}
const when = (date: string) => new Date(date).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
function currentDisk(local: Progress): string | null {
  const disk = localStorage.getItem(STORAGE_KEY);
  if (disk && progressKey(JSON.parse(disk)) !== progressKey(local))
    throw new Error("Another tab has different saved progress. Refresh this page before syncing so its latest work is included.");
  return disk;
}

export function DriveSync({ bank, progress, getProgress, onApply }: {
  bank: Question[]; progress: Progress; getProgress: () => Progress;
  onApply: (progress: Progress, expected: string, disk: string | null) => void;
}) {
  const [account, setAccount] = useState(savedAccount);
  const [mark, setMark] = useState(() => savedMark(savedAccount()));
  const [clientId, setClientId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [previous, setPrevious] = useState<Snapshot[] | null>(null);
  const [hasRecovery, setHasRecovery] = useState(() => { try { return Boolean(localStorage.getItem(DRIVE_RECOVERY_KEY)); } catch { return false; } });
  const alive = useRef(true);
  const lock = useRef(false);
  const latest = useRef(getProgress); latest.current = getProgress;
  const load = () => {
    setLoadError("");
    void prepareGoogle().then((id) => { if (alive.current) setClientId(id); })
      .catch((e: Error) => { if (alive.current) setLoadError(e.message); });
  };
  useEffect(() => {
    alive.current = true;
    // Loading sign-in never reads or writes Drive. All sync requests start from a tap.
    if (navigator.onLine) load();
    const connection = () => { setOnline(navigator.onLine); if (navigator.onLine) load(); };
    window.addEventListener("online", connection); window.addEventListener("offline", connection);
    return () => { alive.current = false; window.removeEventListener("online", connection); window.removeEventListener("offline", connection); };
  }, []);
  useEffect(() => {
    let valid = true;
    void fingerprint(progress).then((key) => { if (valid) setDirty(Boolean(mark && mark.fingerprint !== key)); });
    return () => { valid = false; };
  }, [progress, mark]);

  function assertCurrent(item: Pending) {
    if (!alive.current) throw new Error("Sync was interrupted. Tap Sync now when you return to Settings.");
    if (progressKey(latest.current()) !== item.plan.key || localStorage.getItem(STORAGE_KEY) !== item.disk)
      throw new Error("Progress changed while syncing, possibly in another tab. Your new work is safe. Tap Sync now again.");
  }
  async function finish(item: Pending, chosen: Progress) {
    assertCurrent(item);
    // Abort before uploading if a recovery copy cannot be saved.
    if (progressKey(chosen) !== item.plan.key) {
      localStorage.setItem(DRIVE_RECOVERY_KEY, JSON.stringify(latest.current()));
      setHasRecovery(true);
    }
    const value = await commitSync(item.store, item.plan, chosen, item.bankKey, () => assertCurrent(item),
      matchMedia("(pointer: coarse)").matches ? "Mobile or tablet" : "Desktop");
    const key = await fingerprint(value);
    assertCurrent(item);
    onApply(value, item.plan.key, item.disk);
    const nextMark: SyncMark = { account: item.account.sub, email: item.account.email, fingerprint: key, syncedAt: new Date().toISOString() };
    localStorage.setItem(MARK_KEY + item.account.sub, JSON.stringify(nextMark));
    setMark(nextMark); setPending(null); setPrevious(null);
    setMessage(item.plan.action === "same" ? "You’re up to date. Both copies match." : "Progress synced. You’re ready to pick up on your other device.");
  }
  async function start(mode: "sync" | "history" = "sync") {
    if (lock.current || !clientId || !online) return;
    lock.current = true; setBusy(true); setMessage(""); setPending(null); setPrevious(null);
    // Keep this call before the first await so the popup opens from the user gesture.
    const authorization = connectDrive(clientId, account?.email);
    try {
      const identity = await authorization;
      if (!alive.current) return;
      setAccount({ sub: identity.sub, email: identity.email });
      localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ sub: identity.sub, email: identity.email }));
      const previousMark = savedMark(identity); setMark(previousMark);
      const local = structuredClone(latest.current());
      const disk = currentDisk(local);
      const bankKey = await bankFingerprint(bank);
      const store = driveStore(identity, bank, bankKey);
      if (mode === "history") {
        const files = await store.list();
        const snapshots = await Promise.all(files.slice(0, 10).map((file) => store.read(file)));
        if (alive.current) { setPrevious(snapshots); setMessage(snapshots.length ? "Choose a backup to review before restoring it." : "No Drive backups yet. Tap Sync now to save your first copy."); }
        return;
      }
      const plan = await planSync(store, local, previousMark?.fingerprint ?? null);
      const item = { account: identity, store, plan, bankKey, disk };
      assertCurrent(item);
      if (plan.action === "conflict") setPending(item);
      else await finish(item, plan.action === "download" ? plan.snapshots[0].progress : local);
    } catch (e) { if (alive.current) setMessage((e as Error).message); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  async function choose(item: Pending, chosen: Progress) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setMessage("");
    try { await finish(item, chosen); }
    catch (e) { setPending(null); setMessage((e as Error).message); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  async function reviewBackup(snapshot: Snapshot) {
    if (lock.current || !clientId) return;
    lock.current = true; setBusy(true); setMessage("");
    const authorization = connectDrive(clientId, account?.email);
    try {
      const identity = await authorization;
      if (identity.sub !== account?.sub) throw new Error("The Google account changed. Open Previous backups again.");
      const local = structuredClone(latest.current()), disk = currentDisk(local);
      const bankKey = await bankFingerprint(bank), store = driveStore(identity, bank, bankKey);
      const plan = await planSync(store, local, null);
      const item: Pending = { account: identity, store, bankKey, disk,
        plan: { ...plan, action: "conflict", snapshots: [snapshot] } };
      assertCurrent(item); setPending(item); setPrevious(null);
    } catch (e) { if (alive.current) setMessage((e as Error).message); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }

  return <section className="settings-card drive-card" aria-labelledby="drive-title" aria-busy={busy}>
    <div className="settings-title"><Cloud size={23} /><h2 id="drive-title">Pick up on any device</h2><span className="sync-badge">MANUAL SYNC</span></div>
    <p>Tap Sync now before switching devices, then tap it on the other device. Use the same Google account on both.</p>
    {account && <div className="drive-account"><CloudCheck size={21} /><div><strong>{account.email}</strong><span>{mark ? `Last synced ${when(mark.syncedAt)}` : "This device hasn’t synced yet"}</span>{dirty && <span className="sync-changes">You have changes ready to sync</span>}</div></div>}
    <button className="button primary full" disabled={busy || !online || !clientId} onClick={() => void start()}>
      <RefreshCw size={18} className={busy ? "sync-spinning" : ""} />{busy ? "Working with Drive…" : account ? "Sync now" : "Connect Google Drive"}
    </button>
    {!online && <p className="fine-print">You’re offline. Keep studying and sync when you’re connected.</p>}
    {loadError && <p className="fine-print">{loadError} <button className="text-button" onClick={load}>Retry sign-in setup</button></p>}
    {account && <div className="button-row drive-links"><button className="text-button" disabled={busy || !online || !clientId} onClick={() => void start("history")}>Previous backups</button>
      <button className="text-button" disabled={busy} onClick={() => { disconnectDrive(); localStorage.removeItem(ACCOUNT_KEY); setAccount(null); setMark(null); setMessage("Disconnected on this device. Your local progress and Drive backups are kept."); setPrevious(null); }}>Disconnect</button></div>}
    <p className="fine-print">Only Waypoint’s private app folder in Drive is used. Sync never runs in the background. <a href="privacy.html" target="_blank" rel="noopener noreferrer">Privacy</a></p>
    {message && <p className="notice sync-message" role="status">{message}</p>}
    {hasRecovery && <details className="drive-recovery"><summary>Before your last restore</summary><p className="fine-print">Your previous local progress is kept here after loading a different copy from Drive.</p><button className="text-button" onClick={() => { const data = localStorage.getItem(DRIVE_RECOVERY_KEY); if (data) downloadJSON(JSON.parse(data), "waypoint-before-sync.json"); }}><Download size={16} /> Export recovery copy</button></details>}
    {previous && previous.length > 0 && <div className="drive-history"><h3>Recent Drive backups</h3>{previous.map((s) => <div className="drive-version" key={s.revision}><strong>{when(s.savedAt)}</strong><span>{s.device} · {summary(s.progress)}</span><button className="button secondary" disabled={busy} onClick={() => void reviewBackup(s)}>Review this backup</button></div>)}</div>}
    {pending && <Dialog title="Choose the progress to keep" onClose={() => { if (!busy) setPending(null); }}>
      <p>These copies are different. Choose the one to use on this device and in Drive. This replaces the full study record, including your unfinished session.</p>
      <div className="drive-choices"><Version title="This device" progress={pending.plan.local} disabled={busy} onChoose={() => void choose(pending, pending.plan.local)} />
        {pending.plan.snapshots.map((s) => <Version key={s.revision} title={`Drive · ${s.device}`} detail={when(s.savedAt)} progress={s.progress} disabled={busy} onChoose={() => void choose(pending, s.progress)} />)}</div>
      <p className="fine-print">Your current device copy is saved for recovery. Earlier Drive backups are kept under Previous backups.</p>
      <button className="button secondary full" disabled={busy} onClick={() => setPending(null)}>Decide later</button>
    </Dialog>}
  </section>;
}
function Version({ title, detail, progress, onChoose, disabled }: { title: string; detail?: string; progress: Progress; onChoose: () => void; disabled: boolean }) {
  return <div className="drive-version"><h3>{title}</h3>{detail && <span>{detail}</span>}<p>{summary(progress)}</p>
    <p className="fine-print">{progress.active ? `In progress: ${progress.active.title} · question ${progress.active.index + 1} of ${progress.active.questionIds.length}` : "No unfinished session"}</p>
    <button className="button secondary full" disabled={disabled} onClick={onChoose}>Use {title.startsWith("Drive") ? "this Drive copy" : "this device’s copy"}</button></div>;
}
