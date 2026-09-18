# Question diagrams and editorial revisions

Editable source lives in `sources/`, and the corresponding question rewrite and official-source evidence live in `revisions/`. The application reads `../questions.jsonl`. Explanation PNGs are stored in `../images/` with their actual SHA-1 content hash as the filename.

All 391 questions have an integrated editorial revision and a manually reviewed explanation diagram. Sources comprise 300 Mermaid diagrams, 89 graphic tables and two SVG diagrams. `manifest.json` records rendering, `reviews.json` records explicit editorial and visual review, and `integrated.json` records the exact revision applied to the bank. Each stage is tied to source and revision hashes so subsequent edits invalidate prior review. Run validation to confirm the current state; the last full verification is recorded in `validation.json`.

## Render and inspect

Use Node 22.18 or later, install this directory's locked dependencies with `npm ci`, and install the study application's locked dependencies with `npm ci --prefix ../../study_app`. The renderer reuses that application's Playwright installation and launches local Google Chrome. It serves assets on an ephemeral loopback port and blocks browser requests outside that server.

Run these commands from `question_bank/diagrams/`. Locked JavaScript dependencies support repeatable rendering, but system Chrome and fonts can change pixel output across machines. The renderer fingerprint covers its scripts, style and diagram dependency lock; it does not pin the browser, operating system or font installation. A new PNG content hash requires a fresh visual review before integration.

```sh
node render.mjs 001-020
node validate.mjs 001-020
```

Omit IDs to process all authored revisions; individual IDs and inclusive ranges are accepted. Unchanged renders are reused. `--force` produces fresh exports. Editable Mermaid, native table JSON, and self-contained SVG are supported; the build needs no remote icon service. Exported PNGs use a two-times pixel ratio. Preview PNG/SVG files in `renders/` are ignored by Git.

The shared palette is a local snapshot of `auto_classifier.shared.plotting_style`'s light Mermaid theme and semantic classes, with larger typography for study diagrams. The snapshot avoids a runtime dependency on a sibling checkout. Diagram class roles include `inputData`, `process`, `decision`, `output`, `warning`, `error`, `storage`, `external`, and `reference`.

Inspect every exported diagram for clipped or overlapping labels, unexpected nodes, misleading boundaries or arrow meanings, and readability. Use a contact sheet to find broad issues and open individual diagrams when text or relationships cannot be verified at that scale. Review the full revised stem, every option and the explanation against the cited documentation. Successful rendering does not establish either kind of review.

After performing both reviews, add an entry to `reviews.json` under `questions[ID]` containing the manifest's `revision_sha256`, `source_sha256`, `renderer_sha256`, and `png_sha1`, plus `editorial: "approved"`, `visual: "approved"`, `reviewed_on`, and specific `notes`. Never populate these approvals simply from a successful render.

```sh
node integrate.mjs 001-020
node validate.mjs 001-020
node validate.mjs --complete
node --test common.test.mjs
```

Integration checks stable IDs, domains, stem images, answer references, source evidence, review freshness and PNG hashes. It rejects unexpected bank changes and then atomically writes the bank. `--complete` fails unless all 391 records have completed every stage. The Pages CI workflow runs this check and the range-selection regression tests. Finally run the study application's tests, build and browser checks to verify its independent schema, image integrity, mobile layouts and offline behavior.

Source conventions and the editorial contract are in [AUTHORING.md](AUTHORING.md). The visual forms and Mermaid coverage limits are in the [visual-language audit](../visual_language_audit.md#mermaid-coverage-and-the-remaining-rendering-needs).
