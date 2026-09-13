import { useEffect, useRef, useState } from "react";
import {
  ArrowRight, ArrowUpRight, Bookmark, BookOpen, Check, CheckCircle2, ChevronRight,
  Clock, Download, Library, Monitor, Moon, Play, RotateCcw, Search, SlidersHorizontal,
  Sun, Target, Upload, WifiOff,
} from "lucide-react";
import { DOMAINS, domainFor, parseProgress, sessionResults } from "./core.ts";
import type { Progress, Question, Session, SessionConfig, Theme } from "./core.ts";
import { DomainMark, EmptyState, Ring } from "./components.tsx";
import { downloadJSON, STORAGE_KEY } from "./storage.ts";
import { offlineImages } from "./pwa.ts";
import type { InstallPrompt, OfflineStatus } from "./pwa.ts";

export const practiceConfig = (title = "Quick practice", domain = "all", pool: SessionConfig["pool"] = "all", count = 10): SessionConfig =>
  ({ title, domain, pool, count, timed: false, minutes: Math.ceil(count * 2.4), feedback: "immediate" });

type PageProps = {
  bank: Question[]; progress: Progress; onConfigure: (config: SessionConfig) => void;
};
export function StudyPage({ bank, progress, onConfigure, onResume, onProgress, onQuick }: PageProps & { onResume: () => void; onProgress: () => void; onQuick: () => void }) {
  const studied = Object.keys(progress.attempts).length;
  const missed = Object.values(progress.attempts).filter((a) => !a.lastCorrect).length;
  const totalAttempts = Object.values(progress.attempts).reduce((sum, a) => sum + a.count, 0);
  const correctAttempts = Object.values(progress.attempts).reduce((sum, a) => sum + a.correct, 0);
  return <>
    <div className="page-heading"><div><p className="eyebrow">YOUR STUDY SPACE</p><h1>A little practice.<br /><span>A clearer path.</span></h1></div>
      <button className="coverage-peek" onClick={onProgress} aria-label={"View progress: " + studied + " of " + bank.length + " questions explored"}>
        <Ring small value={studied / bank.length * 100} label={String(studied)} /><span>of {bank.length}<br />explored</span>
      </button>
    </div>
    {progress.active && <button className="resume-card" onClick={onResume}><span className="resume-icon"><Play size={21} fill="currentColor" /></span>
      <span><strong>Pick up where you left off</strong><small>{progress.active.title} · Question {progress.active.index + 1} of {progress.active.questionIds.length}{progress.active.deadline && " · timer running"}</small></span><ArrowRight size={21} />
    </button>}
    <section className="practice-hero">
      <div className="hero-content"><span className="soft-label"><span className="status-dot" /> ONE GOOD STEP AT A TIME</span><h2>Find your rhythm.</h2>
        <p>One question. One new insight.<br />Take a moment to learn something.</p>
        <button className="button lime" onClick={onQuick}>One quick question <ArrowRight size={19} /></button>
        <span className="hero-caption">Random question · Untimed · No setup</span>
      </div>
      <div className="hero-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit orbit-three" />
        <div className="art-path" /><div className="art-tile tile-one"><BookOpen size={26} /><span>LEARN</span></div>
        <div className="art-tile tile-two"><Check size={34} /><span>ONE STEP CLOSER</span></div><span className="art-dot dot-one" /><span className="art-dot dot-two" />
      </div>
    </section>
    <div className="mode-grid">
      <button className="mode-card" onClick={() => onConfigure({ ...practiceConfig("Exam rehearsal", "all", "all", 75), timed: true, minutes: 180, feedback: "end" })}>
        <span className="mode-icon lavender"><Clock size={23} /></span><ArrowUpRight className="card-arrow" size={20} /><h3>Rehearse the exam</h3><p>Make the real thing feel familiar.</p><span className="card-meta">75 questions <span>·</span> 180 minutes</span>
      </button>
      <button className="mode-card" onClick={() => onConfigure(practiceConfig("Review mistakes", "all", "mistakes", 10))}>
        <span className="mode-icon peach"><RotateCcw size={23} /></span><ArrowUpRight className="card-arrow" size={20} /><h3>Turn mistakes into progress</h3><p>A fresh look at what needs practice.</p><span className="card-meta">{missed ? missed + " questions to revisit" : "Your review queue starts here"}</span>
      </button>
    </div>
    <section className="domain-section"><div className="section-heading"><div><p className="eyebrow">BUILD YOUR FOUNDATIONS</p><h2>Choose your focus</h2></div>
      <button className="text-button" onClick={() => onConfigure(practiceConfig("Custom session", "all", "all", 20))}><SlidersHorizontal size={16} /> Custom session</button></div>
      <div className="domain-grid">{DOMAINS.map((d) => {
        const qs = bank.filter((q) => q.exam_domain === d.name);
        const done = qs.filter((q) => progress.attempts[q.id]).length;
        return <button className="domain-card" key={d.id} onClick={() => onConfigure(practiceConfig(d.short, d.name, "all", 20))}>
          <DomainMark name={d.name} /><div className="domain-card-content"><div className="domain-card-title"><h3>{d.short}</h3><ChevronRight size={18} /></div>
            <p>{d.detail}</p><div className="domain-card-foot"><span>{qs.length} questions</span><span>{d.weight}% of the exam</span></div>
            <div className="mini-track"><span style={{ width: done / qs.length * 100 + "%" }} /></div></div>
        </button>;
      })}</div>
    </section>
    <div className="quiet-footer"><BookOpen size={16} /><span>{totalAttempts ? totalAttempts + " answers so far · " + Math.round(correctAttempts / totalAttempts * 100) + "% practice accuracy" : "Small sessions add up. Your progress is saved as you go."}</span></div>
  </>;
}

export function ProgressPage({ bank, progress, onConfigure, onResult }: PageProps & { onResult: (session: Session) => void }) {
  const entries = Object.values(progress.attempts);
  const answered = entries.reduce((sum, a) => sum + a.count, 0);
  const correct = entries.reduce((sum, a) => sum + a.correct, 0);
  return <>
    <div className="page-heading"><div><p className="eyebrow">EVERY SESSION COUNTS</p><h1>Your progress</h1><p className="page-subtitle">See what’s growing. Find your next focus.</p></div></div>
    <div className="progress-overview"><Ring value={entries.length / bank.length * 100} label={Math.round(entries.length / bank.length * 100) + "%"} caption="explored" />
      <div><h2>{entries.length} <span className="muted">of {bank.length}</span></h2><p>unique questions answered</p>
        <div className="inline-stats"><span><strong>{answered ? Math.round(correct / answered * 100) + "%" : "—"}</strong>practice accuracy</span><span><strong>{progress.history.length}</strong>completed sessions</span></div></div>
    </div>
    <section><div className="section-heading"><h2>A view of each domain</h2><span className="muted small-text">Accuracy across your attempts</span></div>
      <div className="domain-progress-list">{DOMAINS.map((d) => {
        const qs = bank.filter((q) => q.exam_domain === d.name);
        const attempts = qs.map((q) => progress.attempts[q.id]).filter(Boolean);
        const count = attempts.reduce((sum, a) => sum + a.count, 0);
        const right = attempts.reduce((sum, a) => sum + a.correct, 0);
        const accuracy = count ? Math.round(right / count * 100) : null;
        return <button className="domain-progress-row" key={d.id} onClick={() => onConfigure(practiceConfig(d.short, d.name, "all", 20))}>
          <DomainMark name={d.name} /><div className="domain-progress-content"><h3>{d.short}</h3><p>{attempts.length} of {qs.length} explored · {count} answers</p>
            <div className="mini-track"><span style={{ width: (accuracy ?? 0) + "%" }} /></div></div>
          <strong className="domain-percent">{accuracy === null ? "—" : accuracy + "%"}</strong><ChevronRight size={17} />
        </button>;
      })}</div>
    </section>
    <section className="history-section"><div className="section-heading"><h2>Session history</h2><span className="muted small-text">Latest first</span></div>
      {!progress.history.length ? <EmptyState icon={<Target size={27} />} title="Your story starts with a session" action={<button className="button secondary" onClick={() => onConfigure(practiceConfig())}>Try 10 questions <ArrowRight size={17} /></button>}>Completed sessions will appear here. There’s no need to get everything right on the first try.</EmptyState> :
        <div className="history-list">{progress.history.map((session) => {
          const result = sessionResults(session, bank);
          return <button className="history-row" key={session.id} onClick={() => onResult(session)}><span className="history-symbol"><CheckCircle2 size={21} /></span>
            <span><strong>{session.title}</strong><small>{new Date(session.finishedAt!).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {result.correct}/{result.total} correct · {session.deadline ? "Timed" : "Untimed"}</small></span>
            <strong>{result.percent}%</strong><ChevronRight size={18} /></button>;
        })}</div>}
    </section>
    <p className="fine-print">These are practice results, not an AWS scaled score or a prediction of your exam result.</p>
  </>;
}

export function LibraryPage({ bank, progress, onConfigure, onBookmark }: PageProps & { onBookmark: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState("all");
  const [filter, setFilter] = useState("all");
  const [limit, setLimit] = useState(30);
  const found = bank.filter((q) => (domain === "all" || q.exam_domain === domain) &&
    (filter === "all" || filter === "saved" && progress.bookmarks.includes(q.id) || filter === "unseen" && !progress.attempts[q.id] ||
      filter === "mistakes" && progress.attempts[q.id]?.lastCorrect === false) &&
    (!query.trim() || (q.question + " " + q.options.map((o) => o.text).join(" ")).toLowerCase().includes(query.trim().toLowerCase())));
  return <>
    <div className="page-heading"><div><p className="eyebrow">A PLACE FOR CURIOSITY</p><h1>Your question library</h1><p className="page-subtitle">Find a topic. Save a question. Take another look.</p></div></div>
    <label className="search-field"><Search size={21} /><input type="search" aria-label="Search questions" placeholder="Search services, scenarios, or keywords…" value={query} onChange={(e) => { setQuery(e.target.value); setLimit(30); }} /></label>
    <div className="library-filters"><div className="filter-tabs" aria-label="Question filter">{[["all", "All"], ["unseen", "Unseen"], ["mistakes", "Missed"], ["saved", "Saved"]].map(([value, title]) =>
      <button key={value} aria-pressed={filter === value} className={filter === value ? "selected" : ""} onClick={() => { setFilter(value); setLimit(30); }}>{title}</button>)}</div>
      <select aria-label="Filter by domain" value={domain} onChange={(e) => { setDomain(e.target.value); setLimit(30); }}><option value="all">All domains</option>{DOMAINS.map((d) => <option key={d.id} value={d.name}>D{d.id} · {d.short}</option>)}</select>
    </div>
    <p className="list-count">{found.length} questions</p>
    {!found.length ? <EmptyState icon={<Library size={26} />} title="Nothing here just yet">Try a different search or filter. Saved questions and mistakes will appear as you study.</EmptyState> :
      <div className="library-list">{found.slice(0, limit).map((q) => {
        const d = domainFor(q.exam_domain);
        return <article className="library-row" key={q.id}><button className="library-question" onClick={() => onConfigure({ ...practiceConfig("One-question practice", q.exam_domain, "all", 1), ids: [q.id] })}>
          <span className={"domain-label " + d.color}>D{d.id} · {d.short}</span><p>{q.question.length > 220 ? q.question.slice(0, 220).trimEnd() + "…" : q.question}</p>
          <span className="library-meta">{q.correct_option_ids.length === 1 ? "Select one answer" : "Select " + q.correct_option_ids.length + " answers"}<span>Practice question <ArrowRight size={14} /></span></span>
        </button><button className={progress.bookmarks.includes(q.id) ? "icon-button bookmarked" : "icon-button"} aria-label={progress.bookmarks.includes(q.id) ? "Unsave question" : "Save question"} aria-pressed={progress.bookmarks.includes(q.id)} onClick={() => onBookmark(q.id)}><Bookmark size={20} fill={progress.bookmarks.includes(q.id) ? "currentColor" : "none"} /></button></article>;
      })}</div>}
    {found.length > limit && <button className="button secondary full load-more" onClick={() => setLimit((old) => old + 30)}>Show more questions</button>}
  </>;
}

export function SettingsPage({ bank, progress, onTheme, onImport, prompt, onInstall, updateReady, onUpdate, error, driveSync }: {
  bank: Question[]; progress: Progress; onTheme: (theme: Theme) => void; onImport: (p: Progress) => void;
  prompt: InstallPrompt | null; onInstall: () => void; updateReady: boolean; onUpdate: () => void; error: string;
  driveSync: import("react").ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<OfflineStatus | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState("");
  const installed = matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  useEffect(() => { offlineImages(false).then(setStatus).catch(() => {}); }, []);
  const download = async () => {
    setDownloading(true); setMessage("");
    try { await navigator.storage?.persist?.(); setStatus(await offlineImages(true, setStatus)); setMessage("All diagrams are saved. You’re ready to study offline."); }
    catch (e) { setMessage((e as Error).message); }
    finally { setDownloading(false); }
  };
  const restore = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 8_000_000) throw new Error("This backup is too large.");
      onImport(parseProgress(JSON.parse(await file.text()), bank));
    } catch (e) { setMessage((e as Error).message); }
    if (input.current) input.current.value = "";
  };
  return <>
    <div className="page-heading"><div><p className="eyebrow">MAKE YOURSELF AT HOME</p><h1>Your study setup</h1><p className="page-subtitle">A few small things to make this space yours.</p></div></div>
    <section className="settings-card install-card"><span className="setting-icon"><Download size={25} /></span><div><h2>{installed ? "You’re right at home" : "One tap away from practice"}</h2>
      <p>{installed ? "Waypoint is running as an installed app." : "Add Waypoint to your home screen for a focused, full-screen study space."}</p>
      {!installed && (prompt ? <button className="button primary" onClick={onInstall}>Install Waypoint <Download size={17} /></button> :
        <div className="install-instructions"><p><strong>iPhone / iPad:</strong> open in Safari, tap Share, then Add to Home Screen.</p><p><strong>Android:</strong> open the browser menu, then Install app or Add to Home screen.</p></div>)}
    </div></section>
    <section className="settings-card"><div className="settings-title"><WifiOff size={21} /><h2>Study without a connection</h2></div>
      <p>Your questions and the app are saved automatically after the first visit. Download the diagrams once to take the whole bank with you.</p>
      <div className="offline-status"><span>{status ? status.cached + " of " + status.total + " diagrams saved" : "Checking offline storage…"}</span><span>{status ? Math.ceil(status.bytes / 1024 / 1024) + " MB" : ""}</span></div>
      <div className="mini-track"><span style={{ width: (status?.total ? status.cached / status.total * 100 : 0) + "%" }} /></div>
      <button className="button secondary" disabled={downloading || Boolean(status?.total && status.cached === status.total)} onClick={download}>
        {status?.total && status.cached === status.total ? <><Check size={18} /> All diagrams saved</> : downloading ? "Saving diagrams…" : <><Download size={18} /> Save all diagrams</>}
      </button>
      <p className="fine-print">Reference websites and videos still need internet access. Your browser may free offline storage if the device runs low on space.</p>
    </section>
    <section className="settings-card"><div className="settings-title"><Sun size={21} /><h2>Set the mood</h2></div>
      <div className="theme-options">{([{ value: "system", label: "Device", Icon: Monitor }, { value: "light", label: "Light", Icon: Sun }, { value: "dark", label: "Dark", Icon: Moon }] as const).map(({ value, label, Icon }) =>
        <button key={value} aria-pressed={progress.theme === value} className={progress.theme === value ? "selected" : ""} onClick={() => onTheme(value)}><Icon size={21} />{label}</button>)}</div>
    </section>
    {driveSync}
    <section className="settings-card"><div className="settings-title"><Bookmark size={21} /><h2>Keep a backup file</h2></div>
      <p>Progress is saved in this browser as you study. You can also export or import a JSON file whenever you like.</p>
      <div className="button-row"><button className="button secondary" onClick={() => downloadJSON(progress, "waypoint-backup-" + new Date().toISOString().slice(0, 10) + ".json")}><Download size={17} /> Export progress</button>
        <button className="button secondary" onClick={() => input.current?.click()}><Upload size={17} /> Import backup</button></div>
      <input ref={input} className="sr-only" type="file" accept=".json,application/json" aria-label="Import progress backup" onChange={(e) => void restore(e.target.files?.[0])} />
      {error && <button className="text-button" onClick={() => { const value = localStorage.getItem(STORAGE_KEY + ".recovery") ?? localStorage.getItem(STORAGE_KEY); downloadJSON({ recoveredData: value }, "waypoint-recovery.json"); }}>Export recovery copy</button>}
    </section>
    {updateReady && <section className="settings-card"><h2>A fresh version is ready</h2><p>Your saved progress will stay with you.</p><button className="button primary" onClick={onUpdate}>Update app</button></section>}
    {message && <p className="notice" role="status">{message}</p>}
    <div className="about-app"><span className="wordmark">waypoint<span>.</span></span><p>A personal study space for AWS Solutions Architect Professional · SAP-C02.</p>
      <p>{bank.length} questions from your Tutorials Dojo bank. Practice percentages are not official AWS scaled scores.</p>
      <a href="https://docs.aws.amazon.com/aws-certification/latest/solutions-architect-professional-02/solutions-architect-professional-02.html" target="_blank" rel="noopener noreferrer">SAP-C02 exam guide <ArrowUpRight size={14} /></a></div>
  </>;
}
