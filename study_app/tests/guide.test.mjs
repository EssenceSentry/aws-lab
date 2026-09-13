import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { prepareGuide } from "../scripts/guide-data.mjs";
const read = (name) => readFileSync(new URL("../../question_bank/" + name, import.meta.url), "utf8");
const bank = read("questions.jsonl").trim().split("\n").map(JSON.parse);
const source = read("aws_service_decision_guide.md");
const index = read("aws_question_index.md");

test("all questions connect by stable ID to valid guide sections", () => {
  const guide = prepareGuide(source, index, [...bank].reverse());
  assert.equal(guide.sections.length, 17);
  assert.equal(Object.keys(guide.questions).length, 391);
  assert.deepEqual(guide.questions["6170"].sectionIds, ["network", "edge"]);
  assert.match(guide.questions["6170"].rule, /DNSSEC/);
  assert.equal(guide.sections.reduce((sum, section) => sum + section.questionIds.length, 0), 653);
  assert.match(guide.sections.find((s) => s.id === "identity").html, /href="#guide\/src-poweruser"/);
  assert.match(guide.sections.find((s) => s.id === "sources").html, /id="guide-src-poweruser"/);
  assert.doesNotMatch(guide.introductionHtml, /Contents/);
});
test("broken or incomplete indexes and guide links fail the build", () => {
  assert.throws(() => prepareGuide(source, index.replace('| 1 | 6170 |', '| 1 | 999999 |'), bank), /Unknown/);
  assert.throws(() => prepareGuide(source, index.replace(/\| 1 \| 6170 \|[^\n]+\n/, ""), bank), /Every bank/);
  assert.throws(() => prepareGuide(source, index.replace('#network)', '#missing)'), bank), /Invalid index sections/);
  assert.throws(() => prepareGuide(source + '\n[Broken](#missing)', index, bank), /Broken guide link/);
});
test("guide HTML is sanitized and only safe links survive", () => {
  const guide = prepareGuide(source + '\n<script>alert(1)</script>\n<img src="x" onerror="alert(1)">\n<a href="javascript:alert(1)" onclick="alert(2)">Bad link</a>\n\n[Safe](https://docs.aws.amazon.com/)', index, bank);
  const html = guide.sections.at(-1).html;
  assert.doesNotMatch(html, /<script|<img|onerror|onclick|javascript:/);
  assert.match(html, /href="https:\/\/docs.aws.amazon.com\/" target="_blank" rel="noopener noreferrer"/);
  assert.match(html, /class="guide-table" role="region" aria-label="Service comparison" tabindex="0"/);
});
