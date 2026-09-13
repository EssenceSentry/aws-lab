export type GuideSection = {
  id: string; title: string; html: string; text: string; anchors: string[]; questionIds: string[];
};
export type QuestionGuideEntry = { id: string; sectionIds: string[]; rule: string };
export type StudyGuide = {
  introductionHtml: string; sections: GuideSection[]; questions: Record<string, QuestionGuideEntry>;
};
export const sectionFor = (guide: StudyGuide, anchor: string) => guide.sections.find((section) => section.anchors.includes(anchor));
export function matchesSearch(text: string, query: string) {
  const normalized = text.toLocaleLowerCase();
  return query.trim().toLocaleLowerCase().split(/\s+/).every((word) => normalized.includes(word));
}
export function searchExcerpt(text: string, query: string) {
  const word = query.trim().toLocaleLowerCase().split(/\s+/)[0];
  const index = word ? text.toLocaleLowerCase().indexOf(word) : 0;
  const start = Math.max(0, index - 50);
  return (start ? "…" : "") + text.slice(start, start + 160) + (text.length > start + 160 ? "…" : "");
}
