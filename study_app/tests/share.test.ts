import assert from "node:assert/strict";
import test from "node:test";
import { questionShareText } from "../src/share.ts";
import type { Question } from "../src/core.ts";
const q: Question = { id: "123", exam_domain: "Design for New Solutions", question: "Which appliance?", options: [
  { id: "1", text: "Appliance one" }, { id: "2", text: "Appliance two" }, { id: "3", text: "Appliance three" }, { id: "4", text: "Appliance four" },
], correct_option_ids: ["4"], explanation: { text: "Option <<4>> is the correct appliance. Option <<1>> is not. [1]" } };
const order = ["2", "4", "1", "3"];
test("question sharing includes displayed options in order without revealing the answer", () => {
  const text = questionShareText(q, order, "question");
  assert.match(text, /AWS SAP-C02 · Q123/);
  assert.match(text, /A\. Appliance two\n\nB\. Appliance four\n\nC\. Appliance one\n\nD\. Appliance three/);
  assert.doesNotMatch(text, /Correct answer|Explanation|<<|https?:/);
});
test("answer and combined sharing resolve references using the same displayed labels", () => {
  const answer = questionShareText(q, order, "answer");
  assert.match(answer, /Correct answer\nB\. Appliance four/);
  assert.match(answer, /Option B is the correct appliance\. Option C is not\. \[1\]/);
  assert.doesNotMatch(answer, /Which appliance\?|<<|https?:/);
  const both = questionShareText(q, order, "both");
  assert.match(both, /Which appliance\?/);
  assert.match(both, /Correct answer\nB\. Appliance four/);
});
test("sharing multiple correct choices follows display order and flags omitted diagrams", () => {
  const text = questionShareText({ ...q, correct_option_ids: ["1", "4"], question_images: ["images/test.png"], explanation: { ...q.explanation, images: ["images/test2.png"] } }, order, "both");
  assert.match(text, /Choose 2 answers/);
  assert.match(text, /Correct answers\nB\. Appliance four\n\nC\. Appliance one/);
  assert.match(text, /question includes a diagram/);
  assert.match(text, /explanation includes diagrams/);
  assert.doesNotMatch(text, /images\/test/);
});
