# Waypoint

A mobile-first, installable study app for the local SAP-C02 question bank.
React, TypeScript, and Vite produce a static site for GitHub Pages. No backend,
account, analytics service, or runtime CDN is required.

## Study modes

- One quick question: start immediately, check an answer, then finish or draw another random question.
- Custom practice with explanations after each answer.
- Exam rehearsal: 75 questions, 180 minutes, explanations at the end.
- Domain practice, custom lengths, and optional timers.
- Unseen questions, previous mistakes, saved questions, and session-specific review.
- Searchable library, bookmarks, review flags, and question navigation.
- A searchable service decision guide and an index connecting all 391 questions.
- Related guide sections open over a question before or after answering; closing them restores your place.
- Share a question, its answer, or both as text through the native share sheet, with clipboard fallback.
- Persistent sessions, domain progress, history, and JSON backup/restore.
- Light, dark, and device appearance; keyboard and touch controls.

One-question practice samples uniformly across the bank and avoids immediately
repeating the last question. Mixed sessions approximate the SAP-C02 scored-content domain weights:
26%, 29%, 25%, and 20%. Sampling respects available questions and never repeats
a question within a session. Multi-answer questions require the exact answer
set; unanswered questions count as incorrect. Every practice question is scored.
We do not invent unscored questions or convert percentages to AWS scaled scores.
See the [official SAP-C02 guide](https://docs.aws.amazon.com/aws-certification/latest/solutions-architect-professional-02/solutions-architect-professional-02.html).

## Run

Use Node.js 24:

    cd study_app
    npm ci
    npm run dev

Test the production build, installation, and offline mode:

    npm test
    npm run build
    npm run preview

Run the mobile and desktop browser checks with local Chrome installed:

    npm run test:browser

Alternatively, install Chromium with 'npx playwright install chromium' and run
'BROWSER_CHANNEL=chromium npm run test:browser'. The checks use an isolated
profile and test scoring, saved sessions, backup/restore, timer expiry,
installation eligibility, all referenced offline diagrams, accessibility, and a
GitHub Pages project subpath. Screenshots go to ../output/playwright/.

The build validates ../question_bank/questions.jsonl, checks image SHA-1
digests, and copies the bank and referenced images into the static output.
Generated copies under public/data/ and dist/ are ignored by Git. The
corrected question bank remains the single source of truth.

## Content and option references

`question_bank/` contains the corrected `questions.jsonl`, its 166 referenced
SHA-1-named images, `aws_service_decision_guide.md`, and `aws_question_index.md`.
The corrected v2 content is the active baseline; intermediate revision files
and unused images have been removed. Some corrected questions are adapted
scenarios, as identified in their explanations. Existing pre-revision progress
is not imported into this baseline.

Questions retain stable `id` and option `id` values. The app derives single or
multiple choice from `correct_option_ids.length`. Explanations remain plain
text and use `<<4>>` to refer to option ID `4`. If the saved session order is
`["2", "4", "1", "3"]`, `Option <<4>>` displays and shares as `Option B`.
Use a separate marker for every referenced option, such as
`Options <<1>> and <<4>>`. Citation numbers, procedural steps, and service
limits stay ordinary text. The build rejects malformed or unknown references.
The same saved order drives answer cards, explanations, review, and sharing.

The guide and index remain Markdown authoring sources. The build sanitizes
their rendered content into `data/study-guide.json`, validates question IDs
and section anchors, and includes it in the offline app cache. Mobile
comparisons display as readable cards; desktop comparisons retain tables.
Index connections use question IDs, independent of file or session order.

Native sharing sends a `{ text }` payload without an app URL or file. It opens
only when the user taps Share text. Available destination apps depend on the
device; Copy text and a selectable preview are also available. Question-only
sharing omits the answer key and explanation. Text notes identify omitted
diagrams when applicable.

## Installation and offline behavior

Open the deployed HTTPS site. Android/Chrome can offer an installation prompt.
On iPhone/iPad, open Safari and choose Share → Add to Home Screen. Desktop
Chrome and Edge can also install the app.

A versioned service worker caches the application, fonts, questions, and guide after
the first visit. Diagrams cache as they are viewed; Settings offers a resumable
download of the complete image pack. External references and videos need the internet.
Browser storage can be evicted, so export progress regularly.

Progress stays in this browser under waypoint.sap-c02.progress.v2. Backups
include bookmarks, answer statistics, history, and an unfinished session.
Restoration validates question IDs, options, and timer state before replacement.
There is no automatic cross-device sync.

Timed sessions store an absolute deadline. Leaving the app does not pause the
timer. On resume after expiry, the session finishes using saved answers.
Untimed sessions can be continued whenever convenient.

## GitHub Pages

The workflow at ../.github/workflows/study-pages.yml tests and builds pull
requests and pushes to main. Once the PAGES_ENABLED repository variable is
set to true, pushes to main and manual runs also deploy study_app/dist.
Relative URLs and the service-worker scope support paths such as /aws-lab/.

1. In the repository's **Settings → Pages**, select **GitHub Actions**.
2. Set the repository Actions variable PAGES_ENABLED to true to enable publishing.
3. Push to main or run the Study app workflow manually.
4. The deployment URL appears in the workflow's github-pages environment.

The deployed artifact includes the supplied question bank and images.
GitHub Pages generally exposes websites publicly, including from private
repositories. Account eligibility and access controls are separate from the app;
this project does not add authentication.

## Structure

- src/core.ts: sampling, exact-answer scoring, sessions, backup validation.
- src/App.tsx: navigation and the study/review session.
- src/pages.tsx: study home, progress, library, and settings.
- src/components.tsx: dialogs, text rendering, and diagrams.
- src/GuidePage.tsx: topic browsing, question index, and related-guide dialogs.
- src/option-references.ts: stable option references resolved to session labels.
- src/ShareQuestion.tsx and src/share.ts: native sharing and plain-text payloads.
- src/pwa.ts: installation and offline-download messaging.
- scripts/: bank validation and service-worker generation.
- tests/core.test.ts: regression checks using the real question bank.

Only user progress is stored in localStorage. The question bank and images
use the service worker's cache.
