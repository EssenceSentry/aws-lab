import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createSession, DOMAINS, eligibleQuestions, finishSession, freshProgress, gradeAnswer, isCorrect, parseProgress, remainingSeconds, selectQuestions, sessionResults } from "../src/core.ts";
import type { Question, SessionConfig } from "../src/core.ts";

const bank: Question[] = readFileSync(new URL("../../question_bank/questions.jsonl", import.meta.url), "utf8").trim().split("\n").map((line) => JSON.parse(line));
const config: SessionConfig = { title: "Test", domain: "all", pool: "all", count: 75, timed: true, minutes: 180, feedback: "end" };
function random() {
  let seed = 98274;
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
}
test("75-question exams use all four official domain weights without duplicates", () => {
  const selected = selectQuestions(bank, 75, true, random());
  assert.equal(new Set(selected.map((q) => q.id)).size, 75);
  assert.deepEqual(DOMAINS.map((d) => selected.filter((q) => q.exam_domain === d.name).length), [19, 22, 19, 15]);
});
test("weighted sampling redistributes exhausted domains and respects the available pool", () => {
  const restricted = bank.filter((q) => q.exam_domain === DOMAINS[3].name).slice(0, 3)
    .concat(bank.filter((q) => q.exam_domain === DOMAINS[0].name).slice(0, 12));
  const selected = selectQuestions(restricted, 75, true, random());
  assert.equal(selected.length, 15);
  assert.equal(new Set(selected.map((q) => q.id)).size, 15);
});
test("single-domain sampling and progress filters stay within scope", () => {
  const progress = freshProgress();
  const q = bank[0];
  progress.attempts[q.id] = { count: 1, correct: 0, lastCorrect: false };
  progress.bookmarks = [q.id];
  assert.deepEqual(eligibleQuestions(bank, progress, { domain: "all", pool: "mistakes" }).map((q) => q.id), [q.id]);
  assert.deepEqual(eligibleQuestions(bank, progress, { domain: "all", pool: "saved" }).map((q) => q.id), [q.id]);
  assert.equal(eligibleQuestions(bank, progress, { domain: "all", pool: "unseen" }).length, bank.length - 1);
  const session = createSession(bank, progress, { ...config, domain: DOMAINS[2].name, count: 20 });
  assert.ok(session.questionIds.every((id) => bank.find((q) => q.id === id)!.exam_domain === DOMAINS[2].name));
});
test("grading requires the exact answer set, regardless of option display order", () => {
  const q = bank.find((q) => q.correct_option_ids.length === 3)!;
  assert.equal(isCorrect(q, [...q.correct_option_ids].reverse()), true);
  assert.equal(isCorrect(q, q.correct_option_ids.slice(0, 2)), false);
  assert.equal(isCorrect(q, [...q.correct_option_ids, q.correct_option_ids[0]]), false);
  assert.equal(isCorrect(q, q.options.map((o) => o.id)), false);
});
test("sessions persist shuffled choices and a deadline that survives sleep or reload", () => {
  const session = createSession(bank, freshProgress(), config, 1000, random());
  assert.equal(remainingSeconds(session, 1000), 10800);
  assert.equal(remainingSeconds(JSON.parse(JSON.stringify(session)), 1000 + 60_000), 10740);
  assert.equal(remainingSeconds(session, 1000 + 180 * 60_000 + 50), 0);
  const untimed = createSession(bank, freshProgress(), { ...config, timed: false }, 1000, random());
  assert.equal(remainingSeconds(untimed, 99_999_999), null);
  for (const id of session.questionIds) {
    assert.deepEqual([...session.optionOrders[id]].sort(), bank.find((q) => q.id === id)!.options.map((o) => o.id).sort());
  }
});
test("immediate answers are recorded once and not counted again on completion", () => {
  let progress = freshProgress();
  const session = createSession(bank, progress, { ...config, count: 2, feedback: "immediate" }, 1000, random());
  const q = bank.find((q) => q.id === session.questionIds[0])!;
  session.answers[q.id] = q.correct_option_ids;
  progress.active = session;
  progress = gradeAnswer(progress, session, q);
  progress = gradeAnswer(progress, progress.active!, q);
  assert.equal(progress.attempts[q.id].count, 1);
  progress = finishSession(progress, bank, 2000);
  assert.equal(progress.attempts[q.id].count, 1);
  assert.equal(progress.active, null);
  const result = sessionResults(progress.history[0], bank);
  assert.deepEqual({ correct: result.correct, skipped: result.skipped, percent: result.percent }, { correct: 1, skipped: 1, percent: 50 });
  assert.equal(finishSession(progress, bank, 3000).history.length, 1);
});
test("deferred feedback records results only at the end and successful review clears mistakes", () => {
  let progress = freshProgress();
  const session = createSession(bank, progress, { ...config, count: 1 }, 1000);
  const q = bank.find((q) => q.id === session.questionIds[0])!;
  session.answers[q.id] = q.correct_option_ids;
  progress.attempts[q.id] = { count: 1, correct: 0, lastCorrect: false };
  progress.active = session;
  assert.equal(progress.attempts[q.id].lastCorrect, false);
  progress = finishSession(progress, bank, 2000);
  assert.equal(progress.attempts[q.id].count, 2);
  assert.equal(progress.attempts[q.id].lastCorrect, true);
  assert.equal(eligibleQuestions(bank, progress, { domain: "all", pool: "mistakes" }).length, 0);
});
test("valid backups round-trip and corrupt session data cannot replace progress", () => {
  const progress = freshProgress();
  progress.active = createSession(bank, progress, config, 1000);
  assert.deepEqual(parseProgress(JSON.parse(JSON.stringify(progress)), bank), progress);
  const invalidOption = structuredClone(progress);
  invalidOption.active!.answers[invalidOption.active!.questionIds[0]] = ["not-an-option"];
  assert.throws(() => parseProgress(invalidOption, bank));
  const invalidTimer = structuredClone(progress);
  invalidTimer.active!.deadline = Infinity;
  assert.throws(() => parseProgress(invalidTimer, bank));
  assert.throws(() => parseProgress({ version: 1 }, bank));
  const invalidHistory = structuredClone(progress);
  invalidHistory.history = [invalidHistory.active!];
  assert.throws(() => parseProgress(invalidHistory, bank));
});
test("empty pools and invalid timer settings fail with actionable errors", () => {
  assert.throws(() => createSession(bank, freshProgress(), { ...config, pool: "mistakes" }), /no questions/);
  assert.throws(() => createSession(bank, freshProgress(), { ...config, minutes: 0 }), /timer/);
  assert.throws(() => createSession(bank, freshProgress(), { ...config, count: 0 }), /at least/);
});
