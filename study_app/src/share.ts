import type { Question } from "./core.ts";
import { optionLabel, resolveOptionReferences } from "./option-references.ts";

export type SharePart = "question" | "answer" | "both";
/** The payload is text only, with the exact labels used in the current session. */
export function questionShareText(question: Question, optionOrder: readonly string[], part: SharePart): string {
  const pieces = ["AWS SAP-C02 · Q" + question.id, question.exam_domain];
  const optionText = (id: string) => optionLabel(id, optionOrder) + ". " + question.options.find((option) => option.id === id)!.text;
  if (part !== "answer") {
    pieces.push("Question\n" + question.question);
    if (question.question_images?.length) pieces.push("[This question includes a diagram, which is not included in this text.]");
    pieces.push("Choose " + question.correct_option_ids.length + (question.correct_option_ids.length === 1 ? " answer." : " answers.") + "\n\n" + optionOrder.map(optionText).join("\n\n"));
  }
  if (part !== "question") {
    const correct = optionOrder.filter((id) => question.correct_option_ids.includes(id));
    pieces.push((correct.length === 1 ? "Correct answer" : "Correct answers") + "\n" + correct.map(optionText).join("\n\n"));
    pieces.push("Explanation\n" + resolveOptionReferences(question.explanation.text, optionOrder));
    if (question.explanation.images?.length) pieces.push("[The explanation includes diagrams, which are not included in this text.]");
  }
  return pieces.join("\n\n");
}
