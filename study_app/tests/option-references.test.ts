import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createSession, freshProgress, parseProgress } from "../src/core.ts";
import type { Question } from "../src/core.ts";
import { optionLabel, resolveOptionReferences, validateOptionReferences } from "../src/option-references.ts";
import { questionShareText } from "../src/share.ts";

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
  assert.ok(q.explanation.text.includes("<<2>>"));
  assert.doesNotMatch(resolveOptionReferences(q.explanation.text, order), /<<|>>/);
});
test("unknown IDs and malformed markers fail rather than become incorrect labels", () => {
  for (const text of ["Option <<9>>", "Option <<A>>", "Option <<4>", "Option <4>>"]) assert.throws(() => validateOptionReferences(text, ["1", "2", "3", "4"]));
  assert.throws(() => resolveOptionReferences("<<9>>", ["1"]), /Unknown/);
  validateOptionReferences("350 seconds. [4] 1. Configure the gateway.", ["1"]);
});
test("bank validation rejects bare choice phrases and partially marked choice lists", () => {
  const ids = ["1", "2", "3", "4", "5", "6"];
  for (const text of [
    "Option 1 is correct.", "Answers: 2 and 5.", "Choice 4 is incorrect.",
    "Select 1, 3 and the corrected 4.", "Select the revised 2 and 3.",
    "Select <<1>> and 3.", "Select 1 and <<3>>.",
    "Options <<1>>, 2, and the corrected <<3>> are correct.",
    "Multipart upload (option 1)", "For option 4, use SAML.",
  ]) assert.throws(() => validateOptionReferences(text, ids), /Unmarked option reference/, text);
  for (const text of [
    "Select <<1>>, <<3>> and the corrected <<4>>.", "Select the revised <<2>> and <<3>>.",
    "Options <<1>>, <<2>>, and <<3>> are correct.",
    "Select 2 answers. Select 3 instances. Repeat steps 1 and 2.",
    "The following option:\n\n1. Set up federation.\n2. Create an IAM role.",
    "DeletionPolicy Options:\n\n1. Delete\n2. Retain\n3. Snapshot",
    "SAML 2.0. Version ID of 1 is incorrect. [1] 3 GiB. 2–4 hours. us-east-1.",
  ]) assert.doesNotThrow(() => validateOptionReferences(text, ids), text);
});
test("historical explanation reference patterns and shared answers use displayed letters", () => {
  // Fixed regression excerpts preserve the original edge cases while the bank's prose evolves.
  const cases: [string, string, string[]][] = [
    ["010", "Select <<1>>, <<3>> and the corrected <<4>>.", ["Select F, D and the corrected C."]],
    ["013", "Select <<1>> and <<3>>.", ["Select E and C."]],
    ["029", "Select <<4>> and <<5>>.", ["Select B and A."]],
    ["036", "<<1>>. Set up a public hosted zone\n<<3>>. Set up a public hosted zone", ["D. Set up a public hosted zone", "B. Set up a public hosted zone"]],
    ["046", "Select <<1>> and the corrected <<3>>.", ["Select E and the corrected C."]],
    ["047", "Select <<1>> and the corrected <<4>>.", ["Select E and the corrected B."]],
    ["069", "Select <<3>> and the corrected <<5>>.", ["Select C and the corrected A."]],
    ["070", "Select the revised <<2>> and <<3>>.", ["Select the revised D and C."]],
    ["217", "Multipart upload (option <<1>>) is offered by option <<3>>.", ["Multipart upload (option D)", "offered by option B."]],
    ["221", "full S3 permissions (option <<2>>), source marketing account (option <<4>>), whole management account (option <<5>>)", ["full S3 permissions (option E)", "source marketing account (option C)", "whole management account (option B)"]],
    ["224", "For option <<4>>, inspect trust. For option <<5>>, inspect permissions.", ["For option B,", "For option A,"]],
    ["232", "Review the backup prescription in option <<2>>.", ["backup prescription in option D."]],
  ];
  for (const [id, source, expected] of cases) {
    const original = bank.find((q) => q.id === id)!;
    const q = { ...original, explanation: { ...original.explanation, text: source } };
    const order = q.options.map((o) => o.id).reverse();
    for (const text of [resolveOptionReferences(q.explanation.text, order), questionShareText(q, order, "answer"), questionShareText(q, order, "both")]) {
      for (const snippet of expected) assert.ok(text.includes(snippet), "Q" + id + ": " + snippet);
      assert.doesNotMatch(text, /<<|>>/);
    }
  }
});
test("procedure and policy list numbers stay numeric after shuffling", () => {
  for (const [id, snippet] of [
    ["084", "1. Set up a web identity federation"],
    ["136", "1. Delete\n2. Retain\n3. Snapshot"],
  ]) {
    const original = bank.find((q) => q.id === id)!;
    const q = { ...original, explanation: { text: "Procedure:\n\n" + snippet + "\n\nCompare option <<1>>. Retention: 30 minutes [1]." } };
    const order = q.options.map((o) => o.id).reverse();
    assert.ok(resolveOptionReferences(q.explanation.text, order).includes(snippet));
    assert.ok(questionShareText(q, order, "answer").includes(snippet));
    assert.ok(resolveOptionReferences(q.explanation.text, order).includes("30 minutes [1]"));
  }
});
test("the complete active bank has valid explicit option references and no bare choice numbers", () => {
  let references = 0;
  for (const q of bank) {
    assert.doesNotThrow(() => validateOptionReferences(q.explanation.text, q.options.map((o) => o.id)), "Q" + q.id);
    references += [...q.explanation.text.matchAll(/<<\d+>>/g)].length;
  }
  assert.ok(references > 300);
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
