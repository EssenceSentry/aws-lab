import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { chromium, devices } from "playwright";
import { createSession, freshProgress, DOMAINS } from "../src/core.ts";
import { mockDrive, driveBrowserChecks } from "./drive-browser-checks.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifacts = resolve(root, "../output/playwright");
const key = "waypoint.sap-c02.progress.v3";
const bank = (await readFile(join(root, "dist/data/questions.jsonl"), "utf8")).trim().split("\n").map(JSON.parse);
const imageCount = JSON.parse(await readFile(join(root, "dist/data/image-manifest.json"), "utf8")).images.length;
const guide = JSON.parse(await readFile(join(root, "dist/data/study-guide.json"), "utf8"));
const types = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".jsonl": "text/plain", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2" };
// Deliberately serve under a project subpath, as GitHub Pages will.
const server = createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  if (!pathname.startsWith("/aws-lab/")) { response.writeHead(404).end(); return; }
  const relative = pathname.slice("/aws-lab/".length) || "index.html";
  const path = resolve(root, "dist", relative);
  if (!path.startsWith(join(root, "dist") + "/")) { response.writeHead(403).end(); return; }
  try { response.writeHead(200, { "Content-Type": types[extname(path)] ?? "application/octet-stream", "Cache-Control": "no-cache" }).end(await readFile(path)); }
  catch { response.writeHead(404).end(); }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = "http://127.0.0.1:" + server.address().port + "/aws-lab/";
await mkdir(artifacts, { recursive: true });
const profile = await mkdtemp(join(tmpdir(), "waypoint-browser-"));
const context = await chromium.launchPersistentContext(profile, { ...devices["iPhone 13"], channel: process.env.BROWSER_CHANNEL || "chrome", headless: true, colorScheme: "light", reducedMotion: "reduce" });
const sharedDrive = await mockDrive(context);
const page = await context.newPage();
page.setDefaultTimeout(12000);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("response", (response) => { if (response.status() >= 400) errors.push(response.status() + " " + response.url()); });
const require = createRequire(import.meta.url);
const issues = [];
async function accessible(name) {
  await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
  const result = await page.evaluate(() => window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } }));
  for (const violation of result.violations) issues.push({ screen: name, id: violation.id, nodes: violation.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })) });
}
async function state() { return page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key); }
async function seed(value, screen = "session") {
  await page.evaluate(({ key, value, screen }) => { localStorage.setItem(key, JSON.stringify(value)); location.hash = screen; }, { key, value, screen });
  await page.reload();
  await page.locator(screen === "session" ? ".question-body" : "h1").waitFor();
}
async function shot(name) { await page.screenshot({ path: join(artifacts, name + ".png") }); }
async function navigate(name) { await page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("button", { name, exact: true }).click(); }
try {
  await page.goto(url);
  await page.getByRole("button", { name: "One quick question", exact: true }).waitFor();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  for (const width of [320, 360, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "Home overflow at " + width);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await accessible("mobile-home");
  await shot("mobile-home");
  await page.getByRole("button", { name: "Custom session", exact: true }).click();
  await page.getByRole("button", { name: "5 questions", exact: true }).click();
  await accessible("mobile-setup");
  await shot("mobile-config");
  await page.getByRole("button", { name: "Start 5 questions" }).click();
  let saved = await state();
  const first = bank.find((q) => q.id === saved.active.questionIds[0]);
  for (const id of first.correct_option_ids) await page.locator('input[value="' + id + '"]').check();
  await page.getByRole("button", { name: "Save question", exact: true }).click();
  await page.getByRole("button", { name: "Flag for review", exact: true }).click();
  await page.getByRole("button", { name: "Check answer" }).click();
  await page.getByRole("heading", { name: "You’ve got it." }).waitFor();
  await page.reload();
  await page.getByRole("heading", { name: "You’ve got it." }).waitFor();
  saved = await state();
  assert.equal(saved.attempts[first.id].count, 1);
  assert.equal(saved.attempts[first.id].correct, 1);
  assert(saved.bookmarks.includes(first.id) && saved.active.flagged.includes(first.id));
  assert.equal(await page.locator(".answer-option input:not(:disabled)").count(), 0);
  await accessible("mobile-answer");
  await shot("mobile-answer");
  await page.getByRole("button", { name: "Open question navigator" }).click();
  await page.getByRole("button", { name: "Finish session", exact: true }).click();
  await page.getByRole("button", { name: "Finish and see results" }).click();
  await page.getByRole("button", { name: "Review your answers" }).waitFor();
  saved = await state();
  assert.equal(saved.history.length, 1);
  assert.equal(saved.active, null);
  assert.equal(saved.attempts[first.id].count, 1);
  assert.equal(await page.locator(".results-score").innerText().then((text) => text.includes("20%")), true);
  await accessible("mobile-results");
  await shot("mobile-results");
  await page.getByRole("button", { name: "Review your answers" }).click();
  await page.getByRole("heading", { name: "You’ve got it." }).waitFor();
  await page.getByRole("button", { name: "Next question" }).click();
  await page.getByRole("heading", { name: "One to come back to." }).waitFor();
  await page.getByRole("button", { name: "Back to results", exact: true }).click();
  await navigate("Progress");
  await accessible("mobile-progress");
  await shot("mobile-progress");
  await navigate("Library");
  await page.getByRole("button", { name: "Saved", exact: true }).click();
  assert.equal(await page.locator(".library-row").count(), 1);
  await page.getByRole("searchbox", { name: "Search questions" }).fill("no-such-service-12345");
  assert.equal(await page.locator(".library-row").count(), 0);
  await page.getByRole("searchbox").fill("");
  await accessible("mobile-library");
  await navigate("Settings");
  await accessible("mobile-settings");
  const backup = await state();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export progress" }).click();
  const download = await downloadEvent;
  assert.deepEqual(JSON.parse(await readFile(await download.path(), "utf8")), backup);
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await accessible("mobile-dark-settings");
  await shot("mobile-dark");
  await page.getByLabel("Import progress backup").setInputFiles({ name: "backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup)) });
  await page.getByRole("button", { name: "Restore backup", exact: true }).click();
  assert.deepEqual(await state(), backup);
  console.log("PASS mobile navigation, scoring, resume, review, bookmarks, backup and theme");


  await seed(freshProgress(), "study");
  await page.getByRole("button", { name: "One quick question", exact: true }).click();
  assert.equal(await page.locator("dialog[open]").count(), 0, "Quick practice needs no setup");
  let quick = (await state()).active;
  assert.equal(quick.quick, true);
  assert.equal(quick.questionIds.length, 1);
  assert.equal(quick.deadline, null);
  const quickQuestion = bank.find((q) => q.id === quick.questionIds[0]);
  for (const id of quickQuestion.correct_option_ids) await page.locator('input[value="' + id + '"]').check();
  await page.getByRole("button", { name: "Check answer", exact: true }).click();
  await page.getByRole("button", { name: "Another question", exact: true }).click();
  assert.notEqual((await state()).active.questionIds[0], quickQuestion.id);
  assert.equal((await state()).attempts[quickQuestion.id].count, 1);
  quick = (await state()).active;
  const nextQuick = bank.find((q) => q.id === quick.questionIds[0]);
  for (const id of nextQuick.correct_option_ids) await page.locator('input[value="' + id + '"]').check();
  await page.getByRole("button", { name: "Check answer", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "One quick question", exact: true }).waitFor();
  assert.equal((await state()).active, null);
  assert.equal((await state()).history.length, 2);
  assert.equal((await state()).attempts[nextQuick.id].count, 1);

  const markedQuestion = bank.find((q) => q.id === "037");
  const markedProgress = freshProgress();
  markedProgress.active = createSession([markedQuestion], markedProgress, { title: "One quick question", domain: "all", pool: "all", count: 1, timed: false, minutes: 1, feedback: "immediate", quick: true }, Date.now(), () => 0);
  await seed(markedProgress);
  await page.locator('input[value="2"]').check();
  await page.getByRole("button", { name: "Related guide", exact: true }).click();
  const beforeGuide = await state();
  const modal = page.getByRole("dialog", { name: "Explore the reasoning" });
  assert.equal(await modal.locator(".guide-topic-links button").count(), guide.questions["037"].sectionIds.length);
  await modal.locator(".guide-topic-links button").first().click();
  await modal.locator(".guide-reader").waitFor();
  await accessible("mobile-question-guide");
  await shot("mobile-question-guide");
  for (const width of [320, 360, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(await modal.evaluate((el) => el.scrollWidth > el.clientWidth + 1), false, "Guide dialog overflow at " + width);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await modal.getByRole("button", { name: "Close dialog" }).click();
  assert.deepEqual(await state(), beforeGuide, "Reading a guide leaves question state untouched");
  assert.equal(new URL(page.url()).hash, "#session");
  assert(await page.locator('input[value="2"]').isChecked());
  await page.getByRole("button", { name: "Check answer" }).click();
  await page.reload();
  await page.getByRole("heading", { name: "You’ve got it." }).waitFor();
  assert.match(await page.locator(".answer-explanation > .rich-text").innerText(), /Correct: A\./);
  assert.equal(await page.locator('.answer-option:has(input[value="2"]) .option-letter').innerText(), "A");
  assert.doesNotMatch(await page.locator(".answer-explanation").innerText(), /<<\d+>>/);
  const beforeShare = await state();
  await page.evaluate(() => {
    window.sharedTexts = [];
    Object.defineProperty(navigator, "share", { configurable: true, value: async (payload) => { window.sharedTexts.push(payload); } });
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
  });
  for (const part of ["Question", "Answer", "Both"]) {
    await page.getByRole("button", { name: "Share question or answer", exact: true }).click();
    const shareDialog = page.getByRole("dialog", { name: "Share as text" });
    await shareDialog.getByRole("radio", { name: new RegExp("^" + part + " ") }).check();
    await shareDialog.getByText("Preview text", { exact: true }).click();
    const preview = await shareDialog.locator("pre").innerText();
    if (part === "Both") { await accessible("mobile-share"); await shot("mobile-share"); }
    await shareDialog.getByRole("button", { name: "Share text", exact: true }).click();
    await shareDialog.waitFor({ state: "hidden" });
    const payload = await page.evaluate(() => window.sharedTexts.at(-1));
    assert.deepEqual(Object.keys(payload), ["text"], "Native sharing sends text, never an app URL or file");
    assert.equal(payload.text, preview);
    assert.doesNotMatch(payload.text, /<<\d+>>/);
    if (part === "Question") assert.doesNotMatch(payload.text, /Correct answer|Explanation/);
    else assert.match(payload.text, /Correct: A\./);
    if (part !== "Answer") assert(payload.text.includes(markedQuestion.question));
    else assert(!payload.text.includes(markedQuestion.question));
  }
  await page.evaluate(() => Object.defineProperty(navigator, "share", { configurable: true, value: async () => { throw new DOMException("Canceled", "AbortError"); } }));
  await page.getByRole("button", { name: "Share question or answer", exact: true }).click();
  await page.getByRole("button", { name: "Share text", exact: true }).click();
  assert.equal(await page.getByRole("dialog").getByRole("alert").count(), 0, "Canceling native sharing is not an error");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.evaluate(() => Object.defineProperty(navigator, "share", { configurable: true, value: undefined }));
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Share question or answer", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: "Share text", exact: true }).count(), 0);
  await page.getByRole("button", { name: "Copy text", exact: true }).click();
  await page.getByRole("button", { name: "Copied", exact: true }).waitFor();
  assert.match(await page.evaluate(() => navigator.clipboard.readText()), /Correct: A\./);
  await page.getByRole("button", { name: "Close dialog" }).click();
  assert.deepEqual(await state(), beforeShare, "Sharing does not change answers or grading");
  console.log("PASS text-only native share payloads for question/answer/both, cancel handling and clipboard fallback");
  await page.locator(".question-guide .guide-topic-links button").first().click();
  await modal.locator(".guide-reader").waitFor();
  await modal.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  console.log("PASS one-tap random practice, no immediate repeats, saved grading, guide overlay before/after answering and shuffled references after reload");

  for (const id of ["010", "221", "084", "136"]) {
    const question = bank.find((q) => q.id === id);
    const progress = freshProgress();
    progress.active = createSession([question], progress, { title: "Reference regression", domain: "all", pool: "all", count: 1, timed: false, minutes: 1, feedback: "immediate", quick: true });
    const order = question.options.map((o) => o.id).reverse();
    // Check current prose; fixed historical reference patterns have unit coverage.
    const expected = question.explanation.text.split("\n\n")[0].replace(/<<(\d+)>>/g, (_, choice) => String.fromCharCode(65 + order.indexOf(choice)));
    progress.active.optionOrders[id] = order;
    await seed(progress);
    for (const choice of question.correct_option_ids) await page.locator('input[value="' + choice + '"]').check();
    await page.getByRole("button", { name: "Check answer" }).click();
    await page.reload();
    await page.getByRole("heading", { name: "You’ve got it." }).waitFor();
    assert((await page.locator(".answer-explanation > .rich-text").innerText()).includes(expected), "Q" + id + " explanation after shuffle and reload");
    for (const [index, choice] of order.entries()) {
      assert.equal(await page.locator('.answer-option:has(input[value="' + choice + '"]) .option-letter').innerText(), String.fromCharCode(65 + index));
    }
    if (id === "010") await shot("mobile-repaired-option-references");
    await page.getByRole("button", { name: "Done", exact: true }).click();
  }
  console.log("PASS repaired choice references and preserved procedure numbers with shuffled options after reload");

  for (const id of ["134", "141"]) {
    const question = bank.find((q) => q.id === id);
    const progress = freshProgress();
    progress.active = createSession([question], progress, { title: "Explanation formatting", domain: "all", pool: "all", count: 1, timed: false, minutes: 1, feedback: "immediate", quick: true });
    await seed(progress);
    if (id === "134") {
      const fragment = JSON.parse(await page.locator(".question-body pre").innerText());
      assert.deepEqual(fragment.EventTopic.Properties.Subscription[0].Endpoint["Fn::GetAtt"], ["WorkQueue", "Arn"]);
      await shot("mobile-question-code-fragment");
    }
    assert.equal(await page.locator(".answer-explanation").count(), 0, "Teaching image and explanation stay hidden before grading");
    for (const choice of question.correct_option_ids) await page.locator('input[value="' + choice + '"]').check();
    await page.getByRole("button", { name: "Check answer" }).click();
    const explanation = page.locator(".answer-explanation > .rich-text");
    if (id === "141") {
      const citation = explanation.getByRole("link", { name: "ECS task networking", exact: true });
      assert.equal(await citation.getAttribute("href"), "https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-networking-awsvpc.html");
      assert.equal(await citation.getAttribute("rel"), "noopener noreferrer");
      assert.equal(await explanation.locator("code").first().innerText(), "awsvpc");
      assert.doesNotMatch(await explanation.innerText(), /\[ECS task networking\]\(|`awsvpc`/);
      await citation.scrollIntoViewIfNeeded();
      await shot("mobile-explanation-citations");
    }
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "Formatted Q" + id + " overflow at " + width);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Done", exact: true }).click();
  }
  console.log("PASS question JSON fragments, titled documentation links, inline code and mobile explanation layout");

  await navigate("Guide");
  await page.getByRole("heading", { name: "Your field guide" }).waitFor();
  assert.equal(await page.locator(".guide-topic").count(), 17);
  await accessible("mobile-guide-topics");
  await shot("mobile-guide-topics");
  await page.getByRole("searchbox", { name: "Search the guide" }).fill("no-such-service-12345");
  assert.equal(await page.locator(".guide-topic").count(), 0);
  await page.getByRole("searchbox").fill("");
  await page.getByRole("button", { name: "By question", exact: true }).click();
  await page.getByRole("searchbox").fill("Q064");
  assert.equal(await page.locator(".guide-question").count(), 1);
  await accessible("mobile-guide-index");
  await shot("mobile-guide-index");
  await page.locator(".guide-question .guide-topic-links button").first().click();
  await page.getByRole("heading", { name: "Networking, private connectivity, and DNS", exact: true }).waitFor();
  await page.reload();
  await page.getByRole("heading", { name: "Networking, private connectivity, and DNS", exact: true }).waitFor();
  for (const width of [320, 360, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "Guide reader overflow at " + width);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await accessible("mobile-guide-reader");
  await shot("mobile-guide-reader");
  await page.evaluate(() => { location.hash = "guide/identity"; });
  await page.getByRole("link", { name: "Current policy", exact: true }).click();
  await page.locator("#guide-src-poweruser").waitFor({ state: "attached" });
  assert.equal(new URL(page.url()).hash, "#guide/src-poweruser");
  assert((await page.locator("#guide-src-poweruser").boundingBox()).y < 844, "Source anchor scrolled into view");
  await page.goBack();
  await page.getByRole("heading", { name: "Identity, federation, and authorization", exact: true }).waitFor();
  console.log("PASS searchable guide, all 391 question mappings, deep links, source anchors, mobile tables and browser back");

  const multi = bank.find((q) => q.correct_option_ids.length === 3);
  const config = { title: "Multiple-answer check", domain: multi.exam_domain, pool: "all", count: 1, timed: false, minutes: 1, feedback: "immediate", ids: [multi.id] };
  const p = freshProgress();
  p.active = createSession(bank, p, config);
  await seed(p);
  await shot("mobile-question");
  const check = page.getByRole("button", { name: "Check answer" });
  for (const id of multi.correct_option_ids.slice(0, 2)) await page.locator('input[value="' + id + '"]').check();
  assert(await check.isDisabled());
  await page.locator('input[value="' + multi.correct_option_ids[2] + '"]').check();
  assert(await check.isEnabled());
  const wrong = multi.options.find((o) => !multi.correct_option_ids.includes(o.id));
  await page.locator('input[value="' + wrong.id + '"]').check();
  assert(await check.isDisabled());
  await page.locator('input[value="' + wrong.id + '"]').uncheck();
  await check.click();
  await page.getByRole("heading", { name: "You’ve got it." }).waitFor();

  const timed = freshProgress();
  timed.active = createSession(bank, timed, { ...config, title: "Exam rehearsal", domain: "all", ids: undefined, count: 75, feedback: "end", timed: true, minutes: 180 });
  await seed(timed);
  const examFirst = bank.find((q) => q.id === timed.active.questionIds[0]);
  for (const id of examFirst.correct_option_ids) await page.locator('input[value="' + id + '"]').check();
  assert.equal(await page.locator(".answer-explanation, .option-feedback").count(), 0);
  assert.equal(Object.keys((await state()).attempts).length, 0);
  assert.deepEqual(DOMAINS.map((d) => timed.active.questionIds.filter((id) => bank.find((q) => q.id === id).exam_domain === d.name).length), [19, 22, 19, 15]);
  await page.reload();
  await page.locator(".question-body").waitFor();
  assert.equal((await state()).active.deadline, timed.active.deadline);
  const expired = await state();
  expired.active.startedAt = Date.now() - 120000;
  expired.active.deadline = Date.now() - 1000;
  await seed(expired, "study");
  await page.getByText("TIME’S UP · SESSION COMPLETE").waitFor();
  const completed = await state();
  assert.equal(completed.active, null);
  assert.equal(completed.history.length, 1);
  assert.equal(completed.attempts[examFirst.id].correct, 1);
  console.log("PASS multi-select cardinality, weighted 75-question exam, deferred grading and timer expiry after reload");

  await navigate("Settings");
  await page.getByRole("button", { name: "Save all diagrams" }).click();
  await page.getByRole("button", { name: "All diagrams saved" }).waitFor({ timeout: 60000 });
  assert((await page.locator(".offline-status").innerText()).includes(imageCount + " of " + imageCount));
  const cdp = await context.newCDPSession(page);
  const installability = await cdp.send("Page.getInstallabilityErrors");
  await cdp.detach();
  assert.deepEqual(installability.installabilityErrors, [], "Chrome installation requirements");
  const manifest = await page.evaluate(async () => {
    const href = document.querySelector('link[rel="manifest"]').href;
    return { href, data: await (await fetch(href)).json() };
  });
  assert(manifest.href.includes("/aws-lab/manifest.webmanifest"));
  assert.equal(manifest.data.start_url, "./");
  await context.setOffline(true);
  await page.reload();
  assert.equal(await page.evaluate(() => navigator.onLine), false, "Browser reports offline after emulation");
  await page.getByRole("heading", { name: "Your study setup" }).waitFor();
  await page.getByText(imageCount + " of " + imageCount + " diagrams saved").waitFor();
  await navigate("Guide");
  await page.locator(".guide-topic").first().click();
  await page.reload();
  await page.locator(".guide-reader").waitFor();
  assert((await page.locator(".guide-prose").innerText()).length > 500, "Guide available offline");
  const diagramQuestion = bank.find((q) => q.question_images?.length);
  const offline = freshProgress();
  offline.active = createSession(bank, offline, { ...config, domain: diagramQuestion.exam_domain, ids: [diagramQuestion.id] });
  await seed(offline);
  await page.locator(".diagram img").first().waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll(".diagram img")].every((img) => img.complete && img.naturalWidth > 0));
  assert(await page.locator(".question-prompt").innerText());
  await context.setOffline(false);
  await seed(backup, "study");
  console.log("PASS GitHub Pages subpath, manifest/installability, full offline image pack and offline reload");

  await page.setViewportSize({ width: 1440, height: 1000 });
  await accessible("desktop-home");
  await shot("desktop-home");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  // Exercise every real guide table at phone, tablet, and desktop widths.
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const section of guide.sections) {
      await page.evaluate((id) => { location.hash = "guide/" + id; }, section.id);
      await page.getByRole("heading", { name: section.title, exact: true }).waitFor();
      const overflowing = await page.locator(".guide-table").evaluateAll((tables) => tables.filter((table) => table.scrollWidth > table.clientWidth + 1).length);
      assert.equal(overflowing, 0, section.id + " has clipped table columns at " + width);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, section.id + " page overflow at " + width);
    }
  }
  await page.evaluate(() => { location.hash = "guide/network"; });
  await page.getByRole("heading", { name: "Networking, private connectivity, and DNS", exact: true }).waitFor();
  const cells = page.locator(".guide-table tbody tr").first().locator("td");
  assert((await cells.nth(0).boundingBox()).width < (await cells.nth(1).boundingBox()).width / 2, "Short labels leave most table space for explanations");
  await accessible("desktop-guide");
  await shot("desktop-guide");
  await driveBrowserChecks({ page, context, url, shared: sharedDrive, seed, accessible, shot, key });
  assert.deepEqual(errors, [], "Browser errors");
  await writeFile(join(artifacts, "accessibility.json"), JSON.stringify(issues, null, 2));
  assert.equal(issues.length, 0, "Accessibility violations; see output/playwright/accessibility.json");
  console.log("PASS desktop layout, 320–430px overflow checks, WCAG AA scan and browser console");
} finally {
  await context.close();
  await rm(profile, { recursive: true, force: true });
  await new Promise((resolve) => server.close(resolve));
}
