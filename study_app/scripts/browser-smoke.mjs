import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { chromium, devices } from "playwright";
import { createSession, freshProgress, DOMAINS } from "../src/core.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifacts = resolve(root, "../output/playwright");
const key = "waypoint.sap-c02.progress.v1";
const bank = (await readFile(join(root, "dist/data/questions.jsonl"), "utf8")).trim().split("\n").map(JSON.parse);
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
  await page.getByRole("button", { name: "Start a quick practice" }).waitFor();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  for (const width of [320, 360, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "Home overflow at " + width);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await accessible("mobile-home");
  await shot("mobile-home");
  await page.getByRole("button", { name: "Start a quick practice" }).click();
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
  assert.match(await page.locator(".offline-status").innerText(), /351 of 351/);
  const cdp = await context.newCDPSession(page);
  const installability = await cdp.send("Page.getInstallabilityErrors");
  assert.deepEqual(installability.installabilityErrors, [], "Chrome installation requirements");
  const manifest = await page.evaluate(async () => {
    const href = document.querySelector('link[rel="manifest"]').href;
    return { href, data: await (await fetch(href)).json() };
  });
  assert(manifest.href.includes("/aws-lab/manifest.webmanifest"));
  assert.equal(manifest.data.start_url, "./");
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("heading", { name: "Your study setup" }).waitFor();
  await page.getByText("351 of 351 diagrams saved").waitFor();
  const diagramQuestion = bank.find((q) => q.question_images?.length);
  const offline = freshProgress();
  offline.active = createSession(bank, offline, { ...config, domain: diagramQuestion.exam_domain, ids: [diagramQuestion.id] });
  await seed(offline);
  await page.locator(".diagram img").first().waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll(".diagram img")].every((img) => img.complete && img.naturalWidth > 0));
  assert(await page.locator(".question-prompt").innerText());
  await context.setOffline(false);
  await seed(backup, "study");
  console.log("PASS GitHub Pages subpath, manifest/installability, full 351-image offline pack and offline reload");

  await page.setViewportSize({ width: 1440, height: 1000 });
  await accessible("desktop-home");
  await shot("desktop-home");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.deepEqual(errors, [], "Browser errors");
  await writeFile(join(artifacts, "accessibility.json"), JSON.stringify(issues, null, 2));
  assert.equal(issues.length, 0, "Accessibility violations; see output/playwright/accessibility.json");
  console.log("PASS desktop layout, 320–430px overflow checks, WCAG AA scan and browser console");
} finally {
  await context.close();
  await rm(profile, { recursive: true, force: true });
  await new Promise((resolve) => server.close(resolve));
}
