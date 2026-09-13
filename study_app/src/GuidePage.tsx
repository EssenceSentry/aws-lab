import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { ArrowLeft, ArrowRight, BookOpen, ChevronRight, Search } from "lucide-react";
import type { Question, SessionConfig } from "./core.ts";
import { Dialog, EmptyState } from "./components.tsx";
import { practiceConfig } from "./pages.tsx";
import { matchesSearch, searchExcerpt, sectionFor } from "./guide.ts";
import type { StudyGuide } from "./guide.ts";

function followGuideLink(event: MouseEvent, onAnchor: (anchor: string) => void) {
  const target = event.target instanceof Element ? event.target.closest("a") : null;
  const href = target?.getAttribute("href");
  if (href?.startsWith("#guide") && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
    event.preventDefault(); onAnchor(href.slice("#guide".length).replace(/^\//, ""));
  }
}

export function GuideReader({ guide, anchor, onAnchor, embedded = false }: {
  guide: StudyGuide; anchor: string; onAnchor: (anchor: string) => void; embedded?: boolean;
}) {
  const section = sectionFor(guide, anchor);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    const target = anchor === section?.id ? root?.querySelector<HTMLElement>(".reader-title") : root?.querySelector<HTMLElement>("#guide-" + CSS.escape(anchor));
    if (target) {
      target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
      if (anchor === section?.id && !embedded) window.scrollTo({ top: 0, behavior: "instant" });
      else target.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }, [anchor, section?.id, embedded]);
  if (!section) return <p>This guide section could not be found.</p>;
  return <div ref={ref} className="guide-reader">
    <p className="eyebrow">SERVICE DECISION GUIDE</p>
    {embedded ? <h3 className="reader-title" tabIndex={-1}>{section.title}</h3> : <h1 className="reader-title" tabIndex={-1}>{section.title}</h1>}
    <p className="reader-caption">The details that change the answer.</p>
    <div className="guide-prose" onClick={(event) => followGuideLink(event, onAnchor)} dangerouslySetInnerHTML={{ __html: section.html }} />
  </div>;
}

export function GuidePage({ guide, bank, route, onNavigate, onConfigure }: {
  guide: StudyGuide; bank: Question[]; route: string; onNavigate: (anchor: string) => void; onConfigure: (config: SessionConfig) => void;
}) {
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(30);
  const section = sectionFor(guide, route);
  const isIndex = route === "questions";
  const lastList = useRef("");
  if (!section) lastList.current = isIndex ? "questions" : "";
  const backToList = () => onNavigate(lastList.current);
  const topics = guide.sections.filter((s) => matchesSearch(s.title + " " + s.text, query));
  const entries = bank.filter((q) => {
    const entry = guide.questions[q.id];
    return matchesSearch("Q" + q.id + " " + entry.rule + " " + q.question + " " + entry.sectionIds.map((id) => sectionFor(guide, id)!.title).join(" "), query);
  });
  const practice = (ids: string[], title: string) => onConfigure({ ...practiceConfig(title, "all", "all", Math.min(10, ids.length)), ids });
  if (section) return <>
    <button className="text-button back-link" onClick={backToList}><ArrowLeft size={17} /> Back to guide</button>
    <GuideReader guide={guide} anchor={route} onAnchor={onNavigate} />
    {section.questionIds.length > 0 && <div className="guide-practice"><BookOpen size={24} /><div><h2>Put this into practice</h2><p>{section.questionIds.length} questions connect to this topic.</p></div>
      <button className="button primary" onClick={() => practice(section.questionIds, section.title.slice(0, 100))}>Practice this topic <ArrowRight size={18} /></button></div>}
    <button className="text-button" onClick={backToList}><ArrowLeft size={17} /> Back to guide</button>
  </>;
  return <>
    <div className="page-heading"><div><p className="eyebrow">UNDERSTAND THE WHY</p><h1>Your field guide</h1><p className="page-subtitle">Compare services. Spot the detail that matters.</p></div></div>
    <label className="search-field"><Search size={21} /><input type="search" aria-label="Search the guide" placeholder={isIndex ? "Question ID, service, or scenario…" : "Search services or concepts…"} value={query} onChange={(e) => { setQuery(e.target.value); setLimit(30); }} /></label>
    <div className="guide-controls"><div className="filter-tabs" aria-label="Guide view">
      <button aria-pressed={!isIndex} className={!isIndex ? "selected" : ""} onClick={() => { onNavigate(""); setLimit(30); }}>By topic</button>
      <button aria-pressed={isIndex} className={isIndex ? "selected" : ""} onClick={() => { onNavigate("questions"); setLimit(30); }}>By question</button>
    </div><span className="muted small-text" role="status">{isIndex ? entries.length + " questions" : topics.length + " topics"}</span></div>
    {isIndex ? <div className="guide-index">{entries.slice(0, limit).map((q) => {
      const entry = guide.questions[q.id];
      return <article className="guide-question" key={q.id}><div className="guide-question-heading"><h2>Q{q.id}</h2><button className="text-button" onClick={() => practice([q.id], "Practice Q" + q.id)}>Practice <ArrowRight size={16} /></button></div>
        <p>{entry.rule}</p><div className="guide-topic-links">{entry.sectionIds.map((id) => <button key={id} onClick={() => onNavigate(id)}>{sectionFor(guide, id)!.title}<ChevronRight size={15} /></button>)}</div></article>;
    })}</div> : <div className="guide-topics">{topics.map((s, i) => <button key={s.id} className="guide-topic" onClick={() => onNavigate(s.id)}>
      <span className="guide-topic-top"><span className="eyebrow">{s.id === "sources" ? "REFERENCE" : s.id === "corrections" ? "BANK NOTES" : "FIELD NOTES"}</span><ChevronRight size={19} /></span>
      <h2>{s.title}</h2><p>{searchExcerpt(s.text, query)}</p><span className="guide-topic-count">{s.questionIds.length ? s.questionIds.length + " connected questions" : i === topics.length - 1 ? "Read the references" : "Read the notes"}</span>
    </button>)}</div>}
    {(isIndex ? entries.length === 0 : topics.length === 0) && <EmptyState icon={<Search size={26} />} title="No matches yet">Try a service name, a shorter phrase, or a question ID in the question view.</EmptyState>}
    {isIndex && entries.length > limit && <button className="button secondary full guide-load" onClick={() => setLimit((n) => n + 30)}>Show more questions</button>}
    <details className="guide-about"><summary>About this guide</summary><div className="guide-prose" onClick={(e) => followGuideLink(e, onNavigate)} dangerouslySetInnerHTML={{ __html: guide.introductionHtml }} /></details>
  </>;
}

/** Keep reference reading in a dialog so the question and its selections stay mounted. */
export function QuestionGuide({ guide, questionId, compact = false }: { guide: StudyGuide; questionId: string; compact?: boolean }) {
  const [anchor, setAnchor] = useState<string | null>(null);
  const entry = guide.questions[questionId];
  if (!entry) return null;
  return <aside className={compact ? "question-guide-short" : "question-guide"}>{compact ? <button className="text-button" onClick={() => setAnchor("")}><BookOpen size={17} /> Related guide <ChevronRight size={15} /></button> : <><div className="question-guide-heading"><BookOpen size={18} /><h3>The deciding detail</h3></div><p>{entry.rule}</p>
    <div className="guide-topic-links">{entry.sectionIds.map((id) => <button key={id} onClick={() => setAnchor(id)}>{sectionFor(guide, id)!.title}<ChevronRight size={15} /></button>)}</div></>}
    {anchor !== null && <Dialog wide title="Explore the reasoning" onClose={() => setAnchor(null)}>
      {sectionFor(guide, anchor) ? <><button className="text-button" onClick={() => setAnchor("")}><ArrowLeft size={16} /> Related topics</button><GuideReader guide={guide} anchor={anchor} embedded onAnchor={setAnchor} /></> : <><p className="muted">Review the service decisions connected to this question.</p><div className="guide-topic-links">{entry.sectionIds.map((id) => <button key={id} onClick={() => setAnchor(id)}>{sectionFor(guide, id)!.title}<ChevronRight size={15} /></button>)}</div></>}
    </Dialog>}
  </aside>;
}
