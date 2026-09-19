import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// An override permits a negative-control run against a saved historical template
// without modifying the working service worker. Normal runs use the real source.
const template = await readFile(process.env.SW_TEMPLATE_PATH || join(root, "scripts/sw-template.js"), "utf8");
const scope = "/aws-lab/";
const dataPaths = ["data/questions.jsonl", "build-info.json", "data/image-manifest.json"];
const bodies = (version) => [
  JSON.stringify({ id: "001", question: "Question bank " + version }) + "\n",
  JSON.stringify({ build: version }),
  JSON.stringify({ images: version === "v1" ? ["images/old.png"] : ["images/new-a.png", "images/new-b.png"], bytes: version === "v1" ? 100 : 200 }),
];
const coreFiles = (version) => ["index.html", ...dataPaths, "assets/app-" + version + ".js"];
const requests = [];
let release = "v1";
const server = createServer((request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  if (pathname === "/warm.html") {
    response.writeHead(200, { "Content-Type": "text/html", "Cache-Control": "no-store" }).end("<!doctype html><title>HTTP cache warmer</title>");
    return;
  }
  if (pathname === "/favicon.ico") { response.writeHead(204).end(); return; }
  if (!pathname.startsWith(scope)) { response.writeHead(404).end(); return; }
  const relative = pathname.slice(scope.length) || "index.html";
  requests.push({ path: relative, release });
  if (relative === "sw.js") {
    const worker = template.replace("__BUILD__", release).replace("__CORE_FILES__", JSON.stringify(coreFiles(release)));
    response.writeHead(200, { "Content-Type": "application/javascript", "Cache-Control": "no-store" }).end(worker);
  } else if (relative === "index.html") {
    // A fresh HTML shell loads the new hashed bundle even if stable data URLs
    // remain stale, matching the release failure this test protects against.
    response.writeHead(200, { "Content-Type": "text/html", "Cache-Control": "no-store" }).end(`<!doctype html>
      <title>Service worker upgrade</title>
      <button id="update">Update app</button>
      <script src="assets/app-${release}.js"></script>
      <script>
        document.querySelector("#update").onclick = async () => {
          const registration = await navigator.serviceWorker.getRegistration();
          navigator.serviceWorker.addEventListener("controllerchange", () => location.reload(), { once: true });
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        };
      </script>`);
  } else if (dataPaths.includes(relative)) {
    response.writeHead(200, { "Content-Type": relative.endsWith(".jsonl") ? "text/plain" : "application/json", "Cache-Control": "public, max-age=86400" })
      .end(bodies(release)[dataPaths.indexOf(relative)]);
  } else if (/^assets\/app-v[12]\.js$/.test(relative)) {
    response.writeHead(200, { "Content-Type": "application/javascript", "Cache-Control": "public, max-age=86400, immutable" })
      .end("window.appBuild = " + JSON.stringify(relative.includes("v1") ? "v1" : "v2") + ";");
  } else {
    response.writeHead(404).end();
  }
});

const profile = await mkdtemp(join(tmpdir(), "waypoint-sw-update-"));
let context;
try {
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const origin = "http://127.0.0.1:" + server.address().port;
  context = await chromium.launchPersistentContext(profile, { channel: process.env.BROWSER_CHANNEL || "chrome", headless: true });
  context.setDefaultTimeout(15000);
  const errors = [];
  context.on("page", (page) => page.on("pageerror", (error) => errors.push(error.message)));
  const warm = await context.newPage();
  const app = await context.newPage();
  const fetchData = (page) => page.evaluate(async (paths) => Promise.all(paths.map(async (path) => {
    const response = await fetch(path);
    if (!response.ok) throw new Error("Data request failed: " + response.status + " " + path);
    return response.text();
  })), dataPaths.map((path) => scope + path));
  const dataRequests = () => requests.filter(({ path }) => dataPaths.includes(path));

  // The out-of-scope page shares the origin's HTTP cache but cannot be served
  // from the app's CacheStorage. No routing/interception disables HTTP caching.
  await warm.goto(origin + "/warm.html");
  assert.equal(await warm.evaluate(() => navigator.serviceWorker.controller), null);
  assert.deepEqual(await fetchData(warm), bodies("v1"));
  assert.equal(dataRequests().length, dataPaths.length, "Initial warming must reach the HTTP server");

  await app.goto(origin + scope);
  await app.evaluate(() => navigator.serviceWorker.register("sw.js", { scope: "./" }));
  await app.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  assert.deepEqual(await fetchData(app), bodies("v1"), "The initial worker serves the v1 bank and metadata");

  // Deploy v2 without changing the data URLs or expiring v1's HTTP responses.
  release = "v2";
  const warmedRequestCount = dataRequests().length;
  assert.deepEqual(await fetchData(warm), bodies("v1"), "The uncontrolled page must still see fresh-in-HTTP-cache v1 responses");
  assert.equal(dataRequests().length, warmedRequestCount, "The warmed responses must come from HTTP cache, not the v2 server");
  assert.equal(await warm.evaluate(() => navigator.serviceWorker.controller), null, "HTTP-cache proof must remain outside SW control");
  console.log("PASS v1 data remains in real HTTP cache after the server deploys v2");

  await app.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
  await app.waitForFunction(async () => Boolean((await navigator.serviceWorker.getRegistration()).waiting));
  assert.deepEqual(await fetchData(app), bodies("v1"), "The waiting worker must not replace the active v1 worker early");
  await Promise.all([
    app.waitForNavigation({ waitUntil: "load" }),
    app.getByRole("button", { name: "Update app", exact: true }).click(),
  ]);
  await app.waitForFunction(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    return window.appBuild === "v2" && registration.active?.state === "activated" && !registration.waiting;
  });

  const cacheName = "waypoint-" + scope + "-core-v2";
  const cached = await app.evaluate(async ({ cacheName, paths }) => {
    const cache = await caches.open(cacheName);
    return Promise.all(paths.map(async (path) => (await cache.match(path))?.text() ?? null));
  }, { cacheName, paths: dataPaths.map((path) => origin + scope + path) });
  for (const [index, path] of dataPaths.entries()) {
    assert.equal(cached[index], bodies("v2")[index], path + " must be v2 in the new core cache despite warmed v1 HTTP responses");
    assert(dataRequests().some((request) => request.path === path && request.release === "v2"), path + " must be refreshed from the v2 server during install");
  }
  assert.deepEqual(await fetchData(app), bodies("v2"), "The upgraded app must serve all v2 data");
  assert.deepEqual(await app.evaluate(() => caches.keys()), [cacheName], "Activation removes the old core cache");
  await context.setOffline(true);
  assert.deepEqual(await fetchData(app), bodies("v2"), "The upgraded worker must retain all v2 data offline");
  assert.deepEqual(errors, [], "No browser errors during the upgrade");
  console.log("PASS waiting-worker activation and reload refresh the bundle, bank, build info and image manifest, including offline reads");
} finally {
  await context?.close();
  if (server.listening) await new Promise((resolve) => server.close(resolve));
  await rm(profile, { recursive: true, force: true });
}
