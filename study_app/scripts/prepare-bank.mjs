import { prepareGuide } from "./guide-data.mjs";
import { validateOptionReferences } from "../src/option-references.ts";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, copyFile, rm } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const app = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(app, "../question_bank");
const target = resolve(app, "public/data");
const content = await readFile(resolve(source, "questions.jsonl"));
const questions = content.toString("utf8").trim().split("\n").map((line) => JSON.parse(line));
const domains = new Set([
  "Design Solutions for Organizational Complexity", "Design for New Solutions",
  "Continuous Improvement for Existing Solutions", "Accelerate Workload Migration and Modernization",
]);
const ids = new Set();
const images = new Set();
for (const q of questions) {
  if (!q.id || ids.has(q.id) || !domains.has(q.exam_domain) || !q.question?.trim() || !q.explanation?.text?.trim()) throw new Error("Invalid question " + q.id);
  ids.add(q.id);
  const options = new Set(q.options.map((o) => o.id));
  if (options.size !== q.options.length || q.options.some((o) => !o.text?.trim()) || !q.correct_option_ids.length ||
    new Set(q.correct_option_ids).size !== q.correct_option_ids.length || q.correct_option_ids.some((id) => !options.has(id))) throw new Error("Invalid answer key " + q.id);
  try { validateOptionReferences(q.explanation.text, [...options]); }
  catch (error) { throw new Error("Q" + q.id + ": " + error.message); }
  for (const path of [...(q.question_images ?? []), ...(q.explanation.images ?? [])]) {
    if (!/^images\/[a-f0-9]{40}\.(png|jpg|jpeg|webp|gif)$/.test(path)) throw new Error("Invalid image path " + path);
    images.add(path);
  }
}
if (!questions.length) throw new Error("Question bank is empty.");
if ([...ids].sort().some((id, index) => id !== String(index + 1).padStart(3, "0"))) throw new Error("Question IDs must run consecutively from 001.");
const [guideSource, indexSource] = await Promise.all([
  readFile(resolve(source, "aws_service_decision_guide.md"), "utf8"),
  readFile(resolve(source, "aws_question_index.md"), "utf8"),
]);
const guide = prepareGuide(guideSource, indexSource, questions);
await rm(target, { recursive: true, force: true });
await mkdir(resolve(target, "images"), { recursive: true });
await writeFile(resolve(target, "questions.jsonl"), content);
await writeFile(resolve(target, "study-guide.json"), JSON.stringify(guide));
let bytes = 0;
for (const path of images) {
  const data = await readFile(resolve(source, path));
  if (createHash("sha1").update(data).digest("hex") !== path.split("/")[1].split(".")[0]) throw new Error("Image digest mismatch: " + path);
  bytes += data.length;
  await copyFile(resolve(source, path), resolve(target, path));
}
await writeFile(resolve(target, "image-manifest.json"), JSON.stringify({ images: [...images].sort(), bytes }));
await writeFile(resolve(app, "public/build-info.json"), JSON.stringify({
  bankHash: createHash("sha256").update(content).digest("hex"),
  questions: questions.length, images: images.size, imageBytes: bytes,
}));
console.log("Prepared " + questions.length + " questions and " + images.size + " verified images.");
