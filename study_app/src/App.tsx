import { useEffect, useRef, useState } from "react";
import {
  AlertCircle, ArrowLeft, ArrowRight, BarChart3, BookOpen, BookMarked, Bookmark, Check, CheckCircle2,
  ChevronLeft, ChevronRight, Clock, Compass, Flag, Grid2X2, Library, RotateCcw,
  Settings, WifiOff, X,
} from "lucide-react";
import {
  createSession, domainFor, finishSession, gradeAnswer, isCorrect, remainingSeconds, sessionResults,
} from "./core.ts";
import type { Progress, Question, Session, SessionConfig } from "./core.ts";
import { ConfigDialog, Dialog, DomainMark, QuestionImages, RichText, Ring, SavedLabel } from "./components.tsx";
import { LibraryPage, practiceConfig, ProgressPage, SettingsPage, StudyPage } from "./pages.tsx";
import { registerPWA } from "./pwa.ts";
import type { InstallPrompt } from "./pwa.ts";
import { ShareQuestion } from "./ShareQuestion.tsx";
import { GuidePage, QuestionGuide } from "./GuidePage.tsx";
import type { StudyGuide } from "./guide.ts";
import { optionLabel } from "./option-references.ts";
import { saveProgress, STORAGE_KEY } from "./storage.ts";
import { DriveSync } from "./DriveSync.tsx";
import { progressKey } from "./sync-core.ts";

type Screen = "study" | "guide" | "progress" | "library" | "settings" | "session" | "results";
const tabs = [
  { id: "study", label: "Study", Icon: BookOpen },
  { id: "guide", label: "Guide", Icon: BookMarked },
  { id: "progress", label: "Progress", Icon: BarChart3 },
  { id: "library", label: "Library", Icon: Library },
  { id: "settings", label: "Settings", Icon: Settings },
] as const;
function initialScreen(progress: Progress): Screen {
  const value = location.hash.slice(1);
  if (value === "guide" || value.startsWith("guide/")) return "guide";
  if (value === "session" && progress.active) return "session";
  if (value === "results" && progress.history.length) return "results";
  return tabs.some((t) => t.id === value) ? value as Screen : "study";
}

export function App({ bank, guide, initialProgress, initialError }: { bank: Question[]; guide: StudyGuide; initialProgress: Progress; initialError: string }) {
  const [progress, setProgress] = useState(initialProgress);
  const progressRef = useRef(initialProgress);
  const [screen, setScreen] = useState<Screen>(() => initialScreen(initialProgress));
  const [guideRoute, setGuideRoute] = useState(() => location.hash.replace(/^#guide\/?/, ""));
  const [config, setConfig] = useState<SessionConfig | null>(null);
  const [replaceConfig, setReplaceConfig] = useState<SessionConfig | null>(null);
  const [review, setReview] = useState<Session | null>(null);
  const reviewRef = useRef(review);
  reviewRef.current = review;
  const [resultId, setResultId] = useState<string | null>(initialProgress.history[0]?.id ?? null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  const [imported, setImported] = useState<Progress | null>(null);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState(initialError);
  const [toast, setToast] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const [updateRegistration, setUpdateRegistration] = useState<ServiceWorkerRegistration | null>(null);

  function update(fn: (value: Progress) => Progress) {
    const next = fn(progressRef.current);
    progressRef.current = next;
    setProgress(next);
    try { saveProgress(next); setError(""); }
    catch { setError("Your latest changes could not be saved on this device. Export your progress from Settings to keep a backup."); }
  }
  function go(next: Screen) {
    setScreen(next); location.hash = next;
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function openGuide(anchor: string) {
    setGuideRoute(anchor); setScreen("guide"); location.hash = "guide" + (anchor ? "/" + anchor : "");
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function quickQuestion(another = false) {
    const current = progressRef.current.active;
    if (current?.quick && !another) { setReview(null); go("session"); return; }
    const previousId = another ? current?.questionIds[0] : progressRef.current.history.find((s) => s.quick)?.questionIds[0];
    launch({ ...practiceConfig("One quick question", "all", "all", 1), quick: true,
      ids: bank.length > 1 ? bank.filter((q) => q.id !== previousId).map((q) => q.id) : undefined }, another);
  }
  function finishQuick() {
    update((p) => finishSession(p, bank)); setReview(null); go("study");
  }
  function complete() {
    const current = progressRef.current.active;
    if (!current) return;
    update((p) => finishSession(p, bank));
    setResultId(current.id); setReview(null); setFinishOpen(false); setExitOpen(false);
    go("results");
  }
  function launch(options: SessionConfig, finishExisting = false) {
    if (progressRef.current.active && !finishExisting) { setReplaceConfig(options); return; }
    try {
      const base = finishExisting ? finishSession(progressRef.current, bank) : progressRef.current;
      const active = createSession(bank, base, options);
      update(() => ({ ...base, active }));
      setConfig(null); setReplaceConfig(null); setReview(null); setNow(Date.now()); go("session");
    } catch (e) { setToast((e as Error).message); }
  }
  function editSession(fn: (session: Session) => Session) {
    if (review) { setReview(fn(review)); return; }
    if (progressRef.current.active && remainingSeconds(progressRef.current.active) === 0) { complete(); return; }
    update((p) => p.active ? { ...p, active: fn(p.active) } : p);
  }
  function checkAnswer() {
    const s = progressRef.current.active;
    if (!s) return;
    if (remainingSeconds(s) === 0) { complete(); return; }
    const q = bank.find((item) => item.id === s.questionIds[s.index])!;
    if (s.answers[q.id]?.length !== q.correct_option_ids.length) return;
    update((p) => gradeAnswer(p, s, q));
  }
  function bookmark(id: string) {
    update((p) => ({ ...p, bookmarks: p.bookmarks.includes(id) ? p.bookmarks.filter((item) => item !== id) : [...p.bookmarks, id] }));
  }

  useEffect(() => {
    const change = () => {
      setScreen(location.hash === "#session" && reviewRef.current ? "session" : initialScreen(progressRef.current));
      setGuideRoute(location.hash.replace(/^#guide\/?/, ""));
    };
    const connected = () => setOnline(navigator.onLine);
    const install = (e: Event) => { e.preventDefault(); setInstallPrompt(e as InstallPrompt); };
    window.addEventListener("hashchange", change);
    window.addEventListener("online", connected); window.addEventListener("offline", connected);
    window.addEventListener("beforeinstallprompt", install);
    void registerPWA(setUpdateRegistration).catch(() => setToast("Offline setup could not finish. Reconnect and reload to try again."));
    return () => {
      window.removeEventListener("hashchange", change);
      window.removeEventListener("online", connected); window.removeEventListener("offline", connected);
      window.removeEventListener("beforeinstallprompt", install);
    };
  }, []);
  useEffect(() => {
    if (!progress.active?.deadline) return;
    const tick = () => {
      const time = Date.now(); setNow(time);
      const active = progressRef.current.active;
      if (active && remainingSeconds(active, time) === 0) complete();
    };
    tick();
    const interval = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", tick); };
  }, [progress.active?.id, progress.active?.deadline]);
  useEffect(() => {
    document.documentElement.dataset.theme = progress.theme;
    const color = progress.theme === "dark" || progress.theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches ? "#171e2c" : "#f8f7f4";
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", color);
  }, [progress.theme]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  const result = progress.history.find((s) => s.id === resultId) ?? progress.history[0];
  const session = review ?? progress.active;
  const studying = screen === "session" && Boolean(session);
  const activeTab = screen === "results" ? "progress" : screen;
  const pageProps = { bank, progress, onConfigure: setConfig };

  return <div className={studying ? "app-shell in-session" : "app-shell"}>
    {!studying && <>
      <header className="mobile-header"><button className="brand" onClick={() => go("study")} aria-label="Waypoint home"><Compass size={26} /><span>waypoint<span className="brand-dot">.</span></span></button><span className="exam-badge">SAP-C02</span></header>
      <aside className="sidebar"><button className="brand" onClick={() => go("study")}><Compass size={28} /><span>waypoint<span className="brand-dot">.</span></span></button>
        <div className="sidebar-course"><span className="eyebrow">YOUR NEXT MILESTONE</span><strong>Solutions Architect<br />Professional</strong><span className="exam-badge">AWS · SAP-C02</span></div>
        <nav aria-label="Main navigation">{tabs.map(({ id, label, Icon }) => <button key={id} className={activeTab === id ? "nav-item active" : "nav-item"} aria-current={activeTab === id ? "page" : undefined} onClick={() => go(id)}><Icon size={21} />{label}<span className="nav-dot" /></button>)}</nav>
        <div className="sidebar-bottom"><span className="little-sprout"><Compass size={23} /></span><p>Your pace.<br /><strong>Your path forward.</strong></p><span className="small-text muted">{online ? "Progress saved on this device" : "You’re studying offline"}</span></div>
      </aside>
    </>}
    <main id="main-content" className={studying ? "session-main" : "main-content"}>
      {!online && <div className="connection-notice"><WifiOff size={15} /> You’re offline. Saved questions are ready.</div>}
      {error && <div className="notice error-notice" role="alert"><AlertCircle size={18} /><span>{error}</span></div>}
      {!studying && screen === "study" && <StudyPage {...pageProps} onQuick={() => quickQuestion()} onResume={() => { setReview(null); go("session"); }} onProgress={() => go("progress")} />}
      {screen === "guide" && <GuidePage guide={guide} bank={bank} route={guideRoute} onNavigate={openGuide} onConfigure={setConfig} />}
      {screen === "progress" && <ProgressPage {...pageProps} onResult={(s) => { setResultId(s.id); go("results"); }} />}
      {screen === "library" && <LibraryPage {...pageProps} onBookmark={bookmark} />}
      {screen === "settings" && <SettingsPage bank={bank} progress={progress} error={error}
        driveSync={<DriveSync bank={bank} progress={progress} getProgress={() => progressRef.current} onApply={(value, expected, disk) => {
          if (progressKey(progressRef.current) !== expected || localStorage.getItem(STORAGE_KEY) !== disk)
            throw new Error("Progress changed while syncing. Tap Sync now again.");
          const next = { ...value, theme: progressRef.current.theme };
          saveProgress(next);
          progressRef.current = next; setProgress(next); setReview(null); setResultId(next.history[0]?.id ?? null); setError("");
        }} />}
        onTheme={(theme) => update((p) => ({ ...p, theme }))} onImport={setImported}
        prompt={installPrompt} onInstall={() => { void installPrompt?.prompt().then(() => setInstallPrompt(null)); }}
        updateReady={Boolean(updateRegistration?.waiting)} onUpdate={() => {
          navigator.serviceWorker.addEventListener("controllerchange", () => location.reload(), { once: true });
          updateRegistration?.waiting?.postMessage({ type: "SKIP_WAITING" });
        }} />}
      {studying && session && <SessionView bank={bank} guide={guide} onAnother={() => quickQuestion(true)} onDone={finishQuick} session={session} progress={progress} reviewing={Boolean(review)} now={now} saveError={Boolean(error)}
        onChange={editSession} onCheck={checkAnswer} onFinish={() => review ? go("results") : setFinishOpen(true)}
        onExit={() => { if (review) { setReview(null); go("results"); } else if (session.deadline) setExitOpen(true); else go("study"); }}
        onBookmark={bookmark} onZoom={setZoom} />}
      {screen === "results" && result && <ResultsView bank={bank} session={result}
        onStudy={() => go("study")} onReview={() => { setReview({ ...result, index: 0 }); go("session"); }}
        onMistakes={(ids) => setConfig({ ...practiceConfig("Review this session", "all", "all", ids.length), ids })} />}
    </main>
    {!studying && <nav className="bottom-nav" aria-label="Mobile navigation">{tabs.map(({ id, label, Icon }) =>
      <button key={id} className={activeTab === id ? "active" : ""} aria-current={activeTab === id ? "page" : undefined} onClick={() => go(id)}><span><Icon size={22} /></span>{label}</button>)}</nav>}
    {config && <ConfigDialog initial={config} bank={bank} progress={progress} onClose={() => setConfig(null)} onStart={(c) => launch(c)} />}
    {replaceConfig && <Dialog title="Keep your current session?" onClose={() => setReplaceConfig(null)}><p>You have an unfinished session. Starting another will finish it and keep its results in your history.</p>
      <div className="dialog-actions stacked"><button className="button primary full" onClick={() => { setConfig(null); setReplaceConfig(null); setReview(null); go("session"); }}>Resume current session</button>
        <button className="button secondary full" onClick={() => launch(replaceConfig, true)}>Finish it and start another</button></div></Dialog>}
    {finishOpen && progress.active && <Dialog title="Ready to finish?" onClose={() => setFinishOpen(false)}>
      <p>You’ve answered {progress.active.questionIds.filter((id) => (progress.active!.answers[id]?.length ?? 0) === bank.find((q) => q.id === id)!.correct_option_ids.length).length} of {progress.active.questionIds.length} questions.
        {progress.active.flagged.length > 0 && " You flagged " + progress.active.flagged.length + " for review."}</p>
      <p className="muted">Unanswered questions count as incorrect. Your answers and explanations will be available in the results.</p>
      <div className="dialog-actions stacked"><button className="button primary full" onClick={complete}>Finish and see results <ArrowRight size={18} /></button><button className="button secondary full" onClick={() => setFinishOpen(false)}>Keep studying</button></div>
    </Dialog>}
    {exitOpen && <Dialog title="Your place is saved" onClose={() => setExitOpen(false)}><p>This is a timed session. The clock will keep running while you’re away, and the session will finish when time runs out.</p>
      <div className="dialog-actions stacked"><button className="button primary full" onClick={() => { setExitOpen(false); go("study"); }}>Save and leave</button><button className="button secondary full" onClick={() => setExitOpen(false)}>Keep studying</button></div></Dialog>}
    {imported && <Dialog title="Restore this backup?" onClose={() => setImported(null)}><p>This backup contains {Object.keys(imported.attempts).length} studied questions, {imported.history.length} completed sessions, and {imported.bookmarks.length} saved questions.</p><p className="muted">It will replace the progress currently on this device. Export your current progress first if you want to keep it.</p>
      <div className="dialog-actions stacked"><button className="button primary full" onClick={() => { update(() => imported); setImported(null); setToast("Your progress has been restored."); }}>Restore backup</button><button className="button secondary full" onClick={() => setImported(null)}>Cancel</button></div></Dialog>}
    {zoom && <Dialog title="Take a closer look" wide onClose={() => setZoom(null)}><div className="image-zoom"><img src={zoom} alt="Enlarged study diagram" /></div><p className="fine-print">Pinch to zoom on your phone.</p></Dialog>}
    {toast && <div className="toast" role="status">{toast}<button onClick={() => setToast("")} aria-label="Dismiss message"><X size={17} /></button></div>}
  </div>;
}

function formatTime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60).toString().padStart(2, "0");
  return (hours ? hours + ":" : "") + minutes + ":" + (seconds % 60).toString().padStart(2, "0");
}

function SessionView({ bank, guide, onAnother, onDone, session, progress, reviewing, now, saveError, onChange, onCheck, onFinish, onExit, onBookmark, onZoom }: {
  bank: Question[]; guide: StudyGuide; onAnother: () => void; onDone: () => void; session: Session; progress: Progress; reviewing: boolean; now: number; saveError: boolean;
  onChange: (fn: (s: Session) => Session) => void; onCheck: () => void; onFinish: () => void; onExit: () => void;
  onBookmark: (id: string) => void; onZoom: (src: string) => void;
}) {
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const q = bank.find((item) => item.id === session.questionIds[session.index])!;
  const selected = session.answers[q.id] ?? [];
  const revealed = reviewing || session.feedback === "immediate" && session.checked.includes(q.id);
  const multiple = q.correct_option_ids.length > 1;
  const correct = isCorrect(q, selected);
  const domain = domainFor(q.exam_domain);
  const remaining = remainingSeconds(session, now);
  const quick = session.quick && !reviewing;
  const last = session.index === session.questionIds.length - 1;
  const questionHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    questionHeading.current?.focus({ preventScroll: true });
  }, [q.id]);
  const next = () => { if (last) onFinish(); else onChange((s) => ({ ...s, index: s.index + 1 })); };
  return <>
    <header className="session-header"><button className="icon-button" onClick={onExit} aria-label={reviewing ? "Back to results" : "Save and exit session"}><ArrowLeft size={22} /></button>
      <div className="session-title"><strong>{reviewing ? "Answer review" : session.title}</strong><span>{reviewing ? "Take another look. That’s how it sticks." : session.feedback === "immediate" ? "Practice · learn as you go" : "Test · explanations at the end"}</span></div>
      {remaining !== null && !reviewing ? <span className={remaining < 300 ? "timer urgent" : "timer"} aria-label={"Time remaining " + formatTime(remaining)}><Clock size={16} />{formatTime(remaining)}</span> :
        <span className="untimed-label">{reviewing ? "REVIEW" : "UNTIMED"}</span>}
    </header>
    {quick ? <div className="quick-question-meta"><span>ONE QUESTION AT A TIME</span><span>Q{q.id}</span></div> : <div className="session-progress"><div className="session-track"><span style={{ width: (session.index + 1) / session.questionIds.length * 100 + "%" }} /></div>
      <button className="question-counter" onClick={() => setNavigatorOpen(true)} aria-label="Open question navigator"><Grid2X2 size={16} /><strong>{session.index + 1}</strong><span>/ {session.questionIds.length}</span></button></div>}
    <div className="question-toolbar"><span className={"domain-label " + domain.color}>D{domain.id} · {domain.short}</span>
      <div><button className={session.flagged.includes(q.id) ? "icon-button flagged" : "icon-button"} aria-pressed={session.flagged.includes(q.id)} aria-label={session.flagged.includes(q.id) ? "Remove review flag" : "Flag for review"} disabled={reviewing}
        onClick={() => onChange((s) => ({ ...s, flagged: s.flagged.includes(q.id) ? s.flagged.filter((id) => id !== q.id) : [...s.flagged, q.id] }))}><Flag size={20} fill={session.flagged.includes(q.id) ? "currentColor" : "none"} /></button>
        <button className={progress.bookmarks.includes(q.id) ? "icon-button bookmarked" : "icon-button"} aria-pressed={progress.bookmarks.includes(q.id)} aria-label={progress.bookmarks.includes(q.id) ? "Unsave question" : "Save question"} onClick={() => onBookmark(q.id)}><Bookmark size={20} fill={progress.bookmarks.includes(q.id) ? "currentColor" : "none"} /></button></div>
    </div>
    <article className="question-body"><h1 className="sr-only" ref={questionHeading} tabIndex={-1}>Question {session.index + 1}</h1><RichText value={q.question} className="question-prompt" />
      <QuestionImages paths={q.question_images} onZoom={onZoom} />
      <div className="question-tools"><QuestionGuide key={q.id + "-prompt"} guide={guide} questionId={q.id} compact /><ShareQuestion key={q.id + "-share"} question={q} optionOrder={session.optionOrders[q.id]} /></div>
      <fieldset className="answer-options"><legend>{multiple ? "Choose " + q.correct_option_ids.length + " answers" : "Choose one answer"}<span>{selected.length ? selected.length + " selected" : "Take a moment to consider each option"}</span></legend>
        {session.optionOrders[q.id].map((oid) => {
          const option = q.options.find((o) => o.id === oid)!;
          const checked = selected.includes(oid);
          const right = revealed && q.correct_option_ids.includes(oid);
          const wrong = revealed && checked && !right;
          return <label key={oid} className={"answer-option" + (checked ? " chosen" : "") + (right ? " correct" : "") + (wrong ? " incorrect" : "") + (revealed ? " locked" : "")}>
            <input type={multiple ? "checkbox" : "radio"} name={"answer-" + q.id} value={oid} checked={checked} disabled={revealed}
              onChange={() => onChange((s) => ({ ...s, answers: { ...s.answers, [q.id]: multiple ? checked ? selected.filter((id) => id !== oid) : [...selected, oid] : [oid] } }))} />
            <span className={multiple ? "option-letter square" : "option-letter"}>{optionLabel(oid, session.optionOrders[q.id])}</span>
            <span className="option-copy">{option.text}{revealed && (right || checked) && <span className="option-feedback">{right ? checked ? "Your answer · correct" : "Correct answer" : "Your answer"}</span>}</span>
          </label>;
        })}
      </fieldset>
      {revealed && <section className={correct ? "answer-explanation is-correct" : "answer-explanation is-incorrect"} aria-live="polite">
        <div className="feedback-heading">{correct ? <CheckCircle2 size={25} /> : <BookOpen size={25} />}<div><h2>{correct ? "You’ve got it." : selected.length ? "A chance to understand it better." : "One to come back to."}</h2><p>{correct ? "Here’s the reasoning behind the answer." : "The correct " + (multiple ? "answers are" : "answer is") + " highlighted above."}</p></div></div>
        <QuestionGuide key={q.id} guide={guide} questionId={q.id} />
        <h3 className="explanation-title">Let’s unpack it</h3><RichText value={q.explanation.text} optionOrder={session.optionOrders[q.id]} /><QuestionImages paths={q.explanation.images} onZoom={onZoom} />
      </section>}
      {!revealed && session.feedback === "end" && <p className="fine-print session-note">Your answers are saved as you go. Explanations unlock when you finish.</p>}
    </article>
    <footer className="session-footer"><div className="session-footer-inner"><div className="footer-save">{saveError ? <span className="small-text">Changes not saved</span> : <SavedLabel />}</div>
      <div className="session-footer-buttons">{quick ? <>
        {revealed ? <><button className="button secondary" onClick={onDone}>Done</button><button className="button primary next-button" onClick={onAnother}>Another question <ArrowRight size={19} /></button></> :
          <><button className="text-button skip-button" onClick={onAnother}>Skip</button><button className="button primary next-button" disabled={selected.length !== q.correct_option_ids.length} onClick={onCheck}>Check answer <Check size={19} /></button></>}
      </> : <><button className="button secondary previous-button" disabled={session.index === 0} aria-label="Previous question" onClick={() => onChange((s) => ({ ...s, index: s.index - 1 }))}><ChevronLeft size={21} /><span>Previous</span></button>
        {!revealed && session.feedback === "immediate" && <button className="text-button skip-button" onClick={next}>Skip</button>}
        {!revealed && session.feedback === "immediate" ? <button className="button primary next-button" disabled={selected.length !== q.correct_option_ids.length} onClick={onCheck}>Check answer <Check size={19} /></button> :
          <button className="button primary next-button" onClick={next}>{last ? reviewing ? "Back to results" : "Finish session" : "Next question"}<ChevronRight size={19} /></button>}
      </>}</div></div></footer>
    {navigatorOpen && <Dialog title="Your session at a glance" onClose={() => setNavigatorOpen(false)}>
      <p className="muted">Jump to any question. Flagged questions have a small dot.</p>
      <div className="question-grid">{session.questionIds.map((id, index) => {
        const item = bank.find((entry) => entry.id === id)!;
        const graded = reviewing || session.feedback === "immediate" && session.checked.includes(id);
        const answered = session.answers[id]?.length === item.correct_option_ids.length;
        return <button key={id} className={(graded ? isCorrect(item, session.answers[id] ?? []) ? "right" : "wrong" : answered ? "answered" : "") + (index === session.index ? " current" : "")}
          aria-label={"Question " + (index + 1) + (session.flagged.includes(id) ? ", flagged" : "") + (graded ? isCorrect(item, session.answers[id] ?? []) ? ", correct" : ", incorrect" : answered ? ", answered" : ", incomplete")}
          onClick={() => { onChange((s) => ({ ...s, index })); setNavigatorOpen(false); }}>{index + 1}{session.flagged.includes(id) && <span className="flag-dot" />}</button>;
      })}</div>
      <div className="navigator-legend"><span><i className="legend-answered" />Answered</span><span><i className="legend-current" />Current</span><span><i className="legend-flag" />Flagged</span></div>
      <button className="button secondary full" onClick={() => { setNavigatorOpen(false); onFinish(); }}>{reviewing ? "Back to results" : "Finish session"}</button>
    </Dialog>}
  </>;
}

function ResultsView({ bank, session, onStudy, onReview, onMistakes }: {
  bank: Question[]; session: Session; onStudy: () => void; onReview: () => void; onMistakes: (ids: string[]) => void;
}) {
  const result = sessionResults(session, bank);
  const timedOut = session.deadline !== null && session.finishedAt! >= session.deadline;
  return <>
    <button className="text-button back-link" onClick={onStudy}><ChevronLeft size={17} /> Back to study</button>
    <div className="results-heading"><span className="completion-mark"><Check size={29} /></span><p className="eyebrow">{timedOut ? "TIME’S UP · SESSION COMPLETE" : "ANOTHER STEP FORWARD"}</p><h1>{result.percent >= 80 ? "That’s good progress." : "Every answer teaches you something."}</h1><p>{session.title} · {result.total} questions</p></div>
    <div className="results-score"><Ring value={result.percent} label={result.percent + "%"} caption="correct" />
      <div className="score-breakdown"><span><i className="score-dot good" /><strong>{result.correct}</strong> correct</span><span><i className="score-dot bad" /><strong>{result.incorrect}</strong> incorrect</span><span><i className="score-dot neutral" /><strong>{result.skipped}</strong> unanswered</span></div></div>
    <div className="results-actions"><button className="button primary" onClick={onReview}><BookOpen size={19} /> Review your answers</button>
      {result.mistakes.length > 0 && <button className="button secondary" onClick={() => onMistakes(result.mistakes)}><RotateCcw size={18} /> Practice these {result.mistakes.length} again</button>}</div>
    <section><div className="section-heading"><h2>How each domain went</h2></div><div className="domain-progress-list">{result.domains.map((d) =>
      <div className="domain-progress-row" key={d.id}><DomainMark name={d.name} /><div className="domain-progress-content"><h3>{d.short}</h3><p>{d.correct} of {d.total} correct</p>
        <div className="mini-track"><span style={{ width: d.correct / d.total * 100 + "%" }} /></div></div><strong>{Math.round(d.correct / d.total * 100)}%</strong></div>)}</div></section>
    <p className="fine-print results-note">Every question counts equally in this practice score. AWS uses a separate scaled scoring system; this percentage is not an official exam score.</p>
  </>;
}
