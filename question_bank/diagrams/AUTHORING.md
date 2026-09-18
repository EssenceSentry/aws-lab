# Question-bank diagram and editorial sources

This directory contains editable sources for the completed, question-by-question revision of all 391 questions. `../questions.jsonl` remains the application-facing bank. Generated PNGs live in `../images/` under their SHA-1 content hashes and are linked through each question's `explanation.images`. Follow this contract when revising a question or diagram; rerender and renew both reviews before integration.

## Editorial source contract

Write one `revisions/NNN.json` file per reviewed question:

```json
{
  "question_id": "001",
  "base_record_sha256": "SHA256 of compact, sorted-key, UTF-8 original record JSON",
  "record": {"id": "001", "exam_domain": "unchanged", "question": "...", "options": [{"id": "1", "text": "..."}], "correct_option_ids": ["1"], "explanation": {"text": "...", "images": []}},
  "diagram_source": "sources/001.mmd",
  "diagram_alt": "A concise description of the diagram's teaching point.",
  "sources": [{"url": "https://docs.aws.amazon.com/...", "checked_on": "2026-09-18", "supports": "Specific behavior verified by this source"}],
  "editorial_notes": ["Substantive changes and remaining assumptions"],
  "review_status": "authored"
}
```

The hash is `sha256(json.dumps(record, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()).hexdigest()` before editing. Preserve question IDs, domain labels, option IDs, option order and normally the answer set. Correct a flawed key only with explicit evidence and an editorial note. Preserve essential question-stem diagrams (notably Q064); answer-teaching diagrams belong after submission in the explanation.

Every question needs an actual editorial review of all choices, not a stock wording transformation. Use a concise business scenario with explicit constraints and a clear decision. Use original wording modeled on the official exam's structure; do not copy official questions. Remove irrelevant story details, accidental clues, invented absolutes and obsolete technical claims. Distractors must be plausible, grammatically parallel and wrong for a specific stated requirement. Multiple-response stems must state the exact number to select.

Explanations must identify the correct stable option IDs using `<<id>>`, explain the decisive mechanism, explain why each distractor fails, and teach a transferable rule with any material qualification. Do not use fixed displayed letters or bare option-number references. Cite current official AWS documentation in the explanation and in `sources`; only mark a source checked after reading it. Do not present an inherited answer key as verified evidence.

## Diagram source contract

Prefer `sources/NNN.mmd` for topology, sequence, state, workflow, lineage, dependency and policy diagrams. Use `accTitle` and `accDescr` for diagram types that support them. Keep labels concise, relationships explicit and the diagram specific to the scenario. Use correct AWS boundaries. A sequence or policy diagram is preferable to a generic architecture where temporal order or authorization is the decisive concept. Use a small counterexample or failure state when it explains the distractor.

The renderer provides typography and shared styling. Avoid remote image URLs, per-file CSS, JavaScript and init directives. Standard flowchart, sequenceDiagram and stateDiagram-v2 are supported. For AWS topology, icon nodes can use registered `logos:aws-*` names after verifying that the name exists in the installed icon set; named ordinary nodes remain a valid fallback. Avoid using icons in place of readable labels.

For genuine comparison/constraint concepts, `sources/NNN.diagram.json` can use this native graphic-table format:

```json
{
  "type": "table",
  "title": "Specific comparison being taught",
  "columns": ["Mechanism", "What it changes", "What it does not establish"],
  "rows": [["Example", "Concrete effect", "Concrete limit"]],
  "footnote": "The decisive constraint or assumption.",
  "emphasis_rows": [0]
}
```

Do not substitute a correct-answer paragraph inside a box for a diagram. Every visual must encode relationships, sequence, states, a meaningful comparison or quantities. Keep it readable at normal study-card size. Rendering, visual inspection and bank integration are separate completion stages recorded by the build tools.
