import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createSession, freshProgress, parseProgress } from "../src/core.ts";
import type { Question } from "../src/core.ts";
import { optionLabel, resolveOptionReferences, validateOptionReferences } from "../src/option-references.ts";

const bank: Question[] = readFileSync(new URL("../../question_bank/questions.jsonl", import.meta.url), "utf8").trim().split("\n").map((line) => JSON.parse(line));
test("option references follow the saved permutation, including after backup restoration", () => {
  const q = bank.find((q) => q.id === "037")!;
  const progress = freshProgress();
  progress.active = createSession([q], progress, { title: "Test", count: 1, domain: "all", pool: "all", timed: false, minutes: 1, feedback: "immediate" }, 1000, () => 0);
  const restored = parseProgress(JSON.parse(JSON.stringify(progress)), bank);
  const order = restored.active!.optionOrders[q.id];
  assert.deepEqual(order, ["2", "3", "4", "1"]);
  assert.equal(optionLabel("4", order), "C");
  assert.equal(resolveOptionReferences("Option <<4>> is correct. Options <<1>> and <<2>> are not. [4] 350 seconds.\n1. Step one.", order), "Option C is correct. Options D and A are not. [4] 350 seconds.\n1. Step one.");
  assert.match(resolveOptionReferences(q.explanation.text, order), /Correct option: A\./);
  assert.match(resolveOptionReferences(q.explanation.text, order), /D\. Incorrect:/);
});
test("unknown IDs and malformed markers fail rather than become incorrect labels", () => {
  for (const text of ["Option <<9>>", "Option <<A>>", "Option <<4>", "Option <4>>"]) assert.throws(() => validateOptionReferences(text, ["1", "2", "3", "4"]));
  assert.throws(() => resolveOptionReferences("<<9>>", ["1"]), /Unknown/);
  validateOptionReferences("350 seconds. [4] 1. Configure the gateway.", ["1"]);
});
test("the complete active bank has valid explicit option references and no bare choice numbers", () => {
  let references = 0;
  for (const q of bank) {
    validateOptionReferences(q.explanation.text, q.options.map((o) => o.id));
    assert.doesNotMatch(q.explanation.text, /\b(?:options?|answers?)\s*:?\s*\d/i, "Q" + q.id);
    references += [...q.explanation.text.matchAll(/<<\d+>>/g)].length;
  }
  assert.ok(references > 300);
  const nat = bank.find((q) => q.id === "093")!.explanation.text;
  assert.match(nat, /30 minutes/);
  assert.match(nat, /\[1\]/);
});
test("quick practice samples the entire bank rather than always the largest-weight domain", () => {
  const config = { title: "One quick question", count: 1, domain: "all", pool: "all" as const, timed: false, minutes: 1, feedback: "immediate" as const, quick: true };
  const domains = new Set<string>();
  for (let i = 0; i < 200; i++) {
    let seed = i + 1;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const session = createSession(bank, freshProgress(), config, 1000, random);
    assert.equal(session.questionIds.length, 1);
    assert.equal(session.deadline, null);
    assert.equal(session.feedback, "immediate");
    domains.add(bank.find((q) => q.id === session.questionIds[0])!.exam_domain);
  }
  assert.equal(domains.size, 4);
});
