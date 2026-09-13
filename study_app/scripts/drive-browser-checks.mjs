import assert from "node:assert/strict";
import { freshProgress } from "../src/core.ts";

// The browser suite never connects a real Google account or writes personal Drive data.
export async function mockDrive(context, shared = { files: [], calls: 0 }) {
  await context.route("**/google-drive.json", (route) => route.fulfill({ json: { clientId: "browser-test.apps.googleusercontent.com" } }));
  await context.route("https://accounts.google.com/gsi/client", (route) => route.fulfill({ contentType: "application/javascript", body: `
    window.google = { accounts: { oauth2: { initTokenClient(options) { return { requestAccessToken() {
      queueMicrotask(() => options.callback({ access_token: "browser-test-only", expires_in: 3600,
        scope: "openid email https://www.googleapis.com/auth/drive.appdata" }));
    } }; } } } };
  ` }));
  await context.route("https://openidconnect.googleapis.com/v1/userinfo", (route) => route.fulfill({ json: { sub: "browser-test", email: "waypoint-test@example.com" } }));
  await context.route(/^https:\/\/www\.googleapis\.com\/(upload\/)?drive\/v3\/files/, async (route) => {
    shared.calls++;
    const req = route.request(), url = new URL(req.url());
    assert.equal(req.headers().authorization, "Bearer browser-test-only");
    if (req.method() === "POST") {
      const boundary = req.headers()["content-type"].split("boundary=")[1];
      const parts = req.postData().split("--" + boundary).filter((p) => p.includes("Content-Type:"));
      const values = parts.map((p) => JSON.parse(p.slice(p.indexOf("\r\n\r\n") + 4).trim()));
      assert.deepEqual(values[0].parents, ["appDataFolder"]);
      const id = "test-file-" + shared.files.length;
      shared.files.unshift({ id, description: values[0].description, snapshot: values[1] });
      return route.fulfill({ json: { id } });
    }
    if (url.searchParams.get("alt") === "media") {
      const file = shared.files.find((f) => f.id === url.pathname.split("/").at(-1));
      return route.fulfill({ json: file.snapshot });
    }
    assert.equal(url.searchParams.get("spaces"), "appDataFolder");
    return route.fulfill({ json: { files: shared.files.map(({ id, description }) => ({ id, description })) } });
  });
  return shared;
}

export async function driveBrowserChecks({ page, context, url, shared, seed, accessible, shot, key }) {
  assert.equal(shared.calls, 0, "Opening Settings never reads or writes Drive");
  const local = { ...freshProgress(), bookmarks: ["001"] };
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(local, "settings");
  await page.getByRole("button", { name: "Connect Google Drive", exact: true }).click();
  await page.getByText("Progress synced. You’re ready to pick up on your other device.").waitFor();
  assert.equal(shared.files.length, 1);
  await accessible("mobile-drive-sync");
  await page.locator(".drive-card").scrollIntoViewIfNeeded();
  await shot("mobile-drive-sync");

  const phoneContext = await context.browser().newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  try {
    await mockDrive(phoneContext, shared);
    const phone = await phoneContext.newPage();
    await phone.goto(url + "#settings");
    await phone.getByRole("button", { name: "Connect Google Drive", exact: true }).click();
    await phone.getByText("Progress synced. You’re ready to pick up on your other device.").waitFor();
    assert.deepEqual(await phone.evaluate((key) => JSON.parse(localStorage.getItem(key)).bookmarks, key), ["001"]);
    assert.equal(shared.files.length, 1, "Loading on an empty device does not upload a duplicate");
    await phone.evaluate((key) => { const p = JSON.parse(localStorage.getItem(key)); p.bookmarks.push("002"); localStorage.setItem(key, JSON.stringify(p)); }, key);
    await phone.reload();
    await phone.getByRole("button", { name: "Sync now", exact: true }).click();
    await phone.getByText("Progress synced. You’re ready to pick up on your other device.").waitFor();
    assert.equal(shared.files.length, 2);

    await seed({ ...local, bookmarks: ["003"] }, "settings");
    await page.getByRole("button", { name: "Sync now", exact: true }).click();
    await page.getByRole("dialog", { name: "Choose the progress to keep" }).waitFor();
    assert.equal(shared.files.length, 2, "Conflicts wait for a choice");
    await accessible("mobile-drive-conflict");
    await shot("mobile-drive-conflict");
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Use this Drive copy", exact: true }).click();
    await page.getByText("Progress synced. You’re ready to pick up on your other device.").waitFor();
    assert.deepEqual(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).bookmarks, key), ["001", "002"]);
    assert.deepEqual(await page.evaluate((key) => JSON.parse(localStorage.getItem(key + ".before-drive-sync")).bookmarks, key), ["003"]);
    await page.getByRole("button", { name: "Sync now", exact: true }).click();
    await page.getByText("You’re up to date. Both copies match.").waitFor();
    assert.deepEqual(await page.evaluate((key) => JSON.parse(localStorage.getItem(key + ".before-drive-sync")).bookmarks, key), ["003"], "A no-op sync preserves the recovery copy");
    await page.getByRole("button", { name: "Previous backups", exact: true }).click();
    await page.getByRole("heading", { name: "Recent Drive backups" }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Review this backup", exact: true }).count(), 3);
    await page.getByRole("button", { name: "Review this backup", exact: true }).last().click();
    await page.getByRole("button", { name: "Use this Drive copy", exact: true }).click();
    await page.getByText("Progress synced. You’re ready to pick up on your other device.").waitFor();
    assert.deepEqual(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).bookmarks, key), ["001"]);
    await phoneContext.close();
    const before = shared.calls;
    await context.setOffline(true);
    await page.reload();
    await page.getByRole("button", { name: "Sync now", exact: true }).waitFor();
    await page.waitForFunction(() => !navigator.onLine && document.querySelector(".drive-card .button.primary")?.disabled);
    assert.equal(shared.calls, before);
    await context.setOffline(false);
    console.log("PASS manual Drive sync across isolated devices, conflict choices, recovery, history, responsive layout and offline behavior");
  } finally { await phoneContext.close(); }
}
