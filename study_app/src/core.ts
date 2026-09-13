export const DOMAINS = [
  { id: "1", name: "Design Solutions for Organizational Complexity", short: "Organizational complexity", detail: "Accounts, access & connected networks", weight: 26, color: "sage" },
  { id: "2", name: "Design for New Solutions", short: "New solutions", detail: "Design resilient, efficient architectures", weight: 29, color: "blue" },
  { id: "3", name: "Continuous Improvement for Existing Solutions", short: "Continuous improvement", detail: "Make existing architectures work better", weight: 25, color: "lavender" },
  { id: "4", name: "Accelerate Workload Migration and Modernization", short: "Migration & modernization", detail: "Move forward with the right strategy", weight: 20, color: "peach" },
] as const;

export type Question = {
  id: string;
  exam_domain: string;
  question: string;
  options: { id: string; text: string }[];
  correct_option_ids: string[];
  explanation: { text: string; images?: string[] };
  question_images?: string[];
};
export type Pool = "all" | "unseen" | "mistakes" | "saved";
export type Feedback = "immediate" | "end";
export type Theme = "system" | "light" | "dark";
export type SessionConfig = {
  title: string;
  domain: string;
  pool: Pool;
  count: number;
  timed: boolean;
  minutes: number;
  feedback: Feedback;
  ids?: string[];
  quick?: boolean;
};
export type Session = {
  id: string;
  title: string;
  domain: string;
  feedback: Feedback;
  quick?: boolean;
  questionIds: string[];
  optionOrders: Record<string, string[]>;
  answers: Record<string, string[]>;
  checked: string[];
  flagged: string[];
  index: number;
  startedAt: number;
  deadline: number | null;
  finishedAt: number | null;
};
export type Progress = {
  version: 1;
  bookmarks: string[];
  attempts: Record<string, { count: number; correct: number; lastCorrect: boolean }>;
  history: Session[];
  active: Session | null;
  theme: Theme;
};

export const freshProgress = (): Progress => ({
  version: 1, bookmarks: [], attempts: {}, history: [], active: null, theme: "system",
});
export const domainFor = (name: string) => DOMAINS.find((d) => d.name === name)!;
export const isCorrect = (question: Question, selected: string[]) =>
  selected.length === new Set(selected).size &&
  selected.length === question.correct_option_ids.length &&
  question.correct_option_ids.every((id) => selected.includes(id));

export function shuffle<T>(items: readonly T[], random = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function eligibleQuestions(bank: Question[], progress: Progress, config: Pick<SessionConfig, "domain" | "pool" | "ids">) {
  const ids = config.ids ? new Set(config.ids) : null;
  return bank.filter((q) =>
    (!ids || ids.has(q.id)) &&
    (config.domain === "all" || config.domain === q.exam_domain) &&
    (config.pool === "all" ||
      config.pool === "unseen" && !progress.attempts[q.id] ||
      config.pool === "mistakes" && progress.attempts[q.id]?.lastCorrect === false ||
      config.pool === "saved" && progress.bookmarks.includes(q.id)),
  );
}

/** Largest-remainder allocation, with redistribution when a domain is exhausted. */
export function selectQuestions(pool: Question[], requested: number, mixed: boolean, random = Math.random) {
  const count = Math.min(Math.max(0, Math.floor(requested)), pool.length);
  if (!mixed) return shuffle(pool, random).slice(0, count);
  const groups = DOMAINS.map((d) => shuffle(pool.filter((q) => q.exam_domain === d.name), random));
  const allocated = DOMAINS.map((d, i) => Math.min(groups[i].length, Math.floor(count * d.weight / 100)));
  while (allocated.reduce((a, b) => a + b, 0) < count) {
    const candidates = DOMAINS.map((d, i) => ({ i, deficit: count * d.weight / 100 - allocated[i] }))
      .filter(({ i }) => allocated[i] < groups[i].length)
      .sort((a, b) => b.deficit - a.deficit || a.i - b.i);
    if (!candidates.length) break;
    allocated[candidates[0].i]++;
  }
  return shuffle(groups.flatMap((group, i) => group.slice(0, allocated[i])), random);
}

export function createSession(bank: Question[], progress: Progress, config: SessionConfig, now = Date.now(), random = Math.random): Session {
  if (!Number.isInteger(config.count) || config.count < 1) throw new Error("Choose at least one question.");
  if (config.timed && (!Number.isFinite(config.minutes) || config.minutes < 1 || config.minutes > 1440)) throw new Error("Choose a timer between 1 and 1,440 minutes.");
  const pool = eligibleQuestions(bank, progress, config);
  const questions = selectQuestions(pool, config.quick ? 1 : config.count, !config.quick && config.domain === "all", random);
  if (!questions.length) throw new Error("There are no questions in this selection yet.");
  return {
    id: globalThis.crypto.randomUUID(), title: config.title, domain: config.domain,
    feedback: config.quick ? "immediate" : config.feedback, quick: config.quick ?? false, questionIds: questions.map((q) => q.id),
    optionOrders: Object.fromEntries(questions.map((q) => [q.id, shuffle(q.options.map((o) => o.id), random)])),
    answers: {}, checked: [], flagged: [], index: 0, startedAt: now,
    deadline: config.timed && !config.quick ? now + config.minutes * 60_000 : null, finishedAt: null,
  };
}

export function remainingSeconds(session: Session, now = Date.now()) {
  return session.deadline === null ? null : Math.max(0, Math.ceil((session.deadline - now) / 1000));
}

export function gradeAnswer(progress: Progress, session: Session, question: Question): Progress {
  if (session.checked.includes(question.id)) return { ...progress, active: session };
  const selected = session.answers[question.id] ?? [];
  const attempts = { ...progress.attempts };
  if (selected.length) {
    const old = attempts[question.id] ?? { count: 0, correct: 0, lastCorrect: false };
    const correct = isCorrect(question, selected);
    attempts[question.id] = { count: old.count + 1, correct: old.correct + Number(correct), lastCorrect: correct };
  }
  return { ...progress, attempts, active: { ...session, checked: [...session.checked, question.id] } };
}

export function finishSession(progress: Progress, bank: Question[], now = Date.now()): Progress {
  if (!progress.active || progress.active.finishedAt) return progress;
  let next = progress;
  const lookup = new Map(bank.map((q) => [q.id, q]));
  for (const qid of progress.active.questionIds) {
    const q = lookup.get(qid);
    if (q) next = gradeAnswer(next, next.active!, q);
  }
  const finished = { ...next.active!, finishedAt: now };
  return { ...next, active: null, history: [finished, ...next.history.filter((s) => s.id !== finished.id)].slice(0, 100) };
}

export function sessionResults(session: Session, bank: Question[]) {
  const lookup = new Map(bank.map((q) => [q.id, q]));
  const questions = session.questionIds.map((id) => lookup.get(id)).filter((q): q is Question => Boolean(q));
  const correct = questions.filter((q) => isCorrect(q, session.answers[q.id] ?? [])).length;
  const skipped = questions.filter((q) => !(session.answers[q.id]?.length)).length;
  return {
    total: questions.length, correct, skipped, incorrect: questions.length - correct - skipped,
    percent: questions.length ? Math.round(correct / questions.length * 100) : 0,
    mistakes: questions.filter((q) => !isCorrect(q, session.answers[q.id] ?? [])).map((q) => q.id),
    domains: DOMAINS.map((d) => {
      const items = questions.filter((q) => q.exam_domain === d.name);
      return { ...d, total: items.length, correct: items.filter((q) => isCorrect(q, session.answers[q.id] ?? [])).length };
    }).filter((d) => d.total),
  };
}

/** Validate backups before they can replace device-local work. */
export function parseProgress(value: unknown, bank: Question[]): Progress {
  const fail = (): never => { throw new Error("This file is not a valid Waypoint backup for this question bank."); };
  if (!value || typeof value !== "object") return fail();
  const p = value as Progress;
  const lookup = new Map(bank.map((q) => [q.id, q]));
  const ids = (v: unknown): v is string[] =>
    Array.isArray(v) && v.every((id) => typeof id === "string" && lookup.has(id)) && new Set(v).size === v.length;
  const object = (v: unknown) => Boolean(v && typeof v === "object" && !Array.isArray(v));
  if (p.version !== 1 || !ids(p.bookmarks) || !object(p.attempts) ||
    !["system", "light", "dark"].includes(p.theme) || !Array.isArray(p.history) || p.history.length > 100) return fail();
  for (const [id, attempt] of Object.entries(p.attempts)) {
    if (!lookup.has(id) || !object(attempt) || !Number.isInteger(attempt.count) || attempt.count < 1 ||
      !Number.isInteger(attempt.correct) || attempt.correct < 0 || attempt.correct > attempt.count ||
      typeof attempt.lastCorrect !== "boolean") return fail();
  }
  const sessions = p.active === null ? p.history : [p.active, ...p.history];
  const sessionIds = new Set<string>();
  for (const s of sessions) {
    if (!object(s) || typeof s.id !== "string" || !s.id || sessionIds.has(s.id) ||
      typeof s.title !== "string" || s.title.length > 200 ||
      !["immediate", "end"].includes(s.feedback) ||
      (s.quick !== undefined && typeof s.quick !== "boolean") ||
      (s.quick && (s.questionIds?.length !== 1 || s.feedback !== "immediate" || s.deadline !== null)) ||
      !(s.domain === "all" || DOMAINS.some((d) => d.name === s.domain)) ||
      !ids(s.questionIds) || s.questionIds.length < 1 ||
      !ids(s.checked) || !ids(s.flagged) || !Number.isInteger(s.index) || s.index < 0 || s.index >= s.questionIds.length ||
      !Number.isFinite(s.startedAt) || s.startedAt < 0 ||
      !(s.deadline === null || Number.isFinite(s.deadline) && s.deadline > s.startedAt) ||
      !(s.finishedAt === null || Number.isFinite(s.finishedAt) && s.finishedAt >= s.startedAt) ||
      !object(s.answers) || !object(s.optionOrders)) return fail();
    sessionIds.add(s.id);
    if ([...s.checked, ...s.flagged].some((id) => !s.questionIds.includes(id))) return fail();
    if (Object.keys(s.answers).some((id) => !s.questionIds.includes(id))) return fail();
    for (const id of s.questionIds) {
      const q = lookup.get(id)!;
      const order = s.optionOrders[id];
      if (!Array.isArray(order) || new Set(order).size !== q.options.length ||
        order.length !== q.options.length || order.some((o) => !q.options.some((option) => option.id === o))) return fail();
      const answer = s.answers[id] ?? [];
      if (!Array.isArray(answer) || new Set(answer).size !== answer.length || answer.some((o) => !order.includes(o))) return fail();
    }
  }
  if (p.active?.finishedAt !== null && p.active !== null || p.history.some((s) => s.finishedAt === null)) return fail();
  return structuredClone(p);
}
