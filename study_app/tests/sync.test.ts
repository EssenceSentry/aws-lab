import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createSession, freshProgress, gradeAnswer } from "../src/core.ts";
import type { Progress, Question } from "../src/core.ts";
import { bankFingerprint, cloudHeads, commitSync, fingerprint, parseSnapshot, planSync, progressKey } from "../src/sync-core.ts";
import type { CloudFile, CloudStore, Snapshot, SyncPlan } from "../src/sync-core.ts";
import { driveStore } from "../src/google-drive.ts";

const bank: Question[] = readFileSync(new URL("../../question_bank/questions.jsonl", import.meta.url), "utf8").trim().split("\n").map((line) => JSON.parse(line));
const bankKey = await bankFingerprint(bank);
class MemoryDrive implements CloudStore {
  snapshots: Snapshot[] = [];
  async list(): Promise<CloudFile[]> { return this.snapshots.map((s) => ({ id: s.revision, revision: s.revision, parents: s.parents })); }
  async read(file: CloudFile) { return structuredClone(this.snapshots.find((s) => s.revision === file.revision)!); }
  async create(snapshot: Snapshot) { this.snapshots.push(structuredClone(snapshot)); }
}
function studied(): Progress {
  const p = freshProgress();
  const session = createSession(bank, p, { title: "A timed session", domain: "all", pool: "all", count: 5, timed: true, minutes: 20, feedback: "immediate" });
  const q = bank.find((q) => q.id === session.questionIds[0])!;
  session.answers[q.id] = q.correct_option_ids;
  p.active = session; p.bookmarks = [q.id];
  return gradeAnswer(p, session, q);
}
async function commit(store: CloudStore, plan: SyncPlan, choice = plan.action === "download" ? plan.snapshots[0].progress : plan.local) {
  return commitSync(store, plan, choice, bankKey, () => {}, "Test device");
}

test("manual desktop-mobile-desktop sync preserves answers, option orders and absolute timer without double-counting", async () => {
  const store = new MemoryDrive();
  let desktop = studied();
  const first = await planSync(store, desktop, null);
  assert.equal(first.action, "upload");
  desktop = await commit(store, first);
  const desktopBase = await fingerprint(desktop);
  const freshPhone = { ...freshProgress(), theme: "dark" as const };
  const download = await planSync(store, freshPhone, null);
  assert.equal(download.action, "download");
  let phone = await commit(store, download);
  assert.equal(phone.theme, "dark");
  assert.deepEqual(phone.active, desktop.active);
  assert.deepEqual(phone.attempts, desktop.attempts);
  const phoneBase = await fingerprint(phone);
  phone.bookmarks = [...new Set([...phone.bookmarks, "391"])];
  const upload = await planSync(store, phone, phoneBase);
  assert.equal(upload.action, "upload");
  phone = await commit(store, upload);
  const returnToDesktop = await planSync(store, desktop, desktopBase);
  assert.equal(returnToDesktop.action, "download");
  desktop = await commit(store, returnToDesktop);
  assert.equal(progressKey(desktop), progressKey(phone));
  assert.equal(desktop.theme, "system");
  assert.equal(store.snapshots.length, 2);
  assert.equal((await planSync(store, desktop, await fingerprint(desktop))).action, "same");
});

test("divergent device changes require a choice and retain the losing cloud copy", async () => {
  const store = new MemoryDrive(), original = studied();
  await commit(store, await planSync(store, original, null));
  const base = await fingerprint(original);
  const desktop = { ...original, bookmarks: ["001"] }, phone = { ...original, bookmarks: ["002"] };
  await commit(store, await planSync(store, phone, base));
  const conflict = await planSync(store, desktop, base);
  assert.equal(conflict.action, "conflict");
  const kept = await commit(store, conflict, desktop);
  assert.deepEqual(kept.bookmarks, ["001"]);
  assert.deepEqual(store.snapshots[1].progress.bookmarks, ["002"]);
  assert.equal(cloudHeads(await store.list()).length, 1);
  assert.equal((await planSync(store, phone, await fingerprint(phone))).action, "download");
});

test("simultaneous first saves keep both branches and a later choice resolves both", async () => {
  const store = new MemoryDrive();
  const a = { ...freshProgress(), bookmarks: ["001"] }, b = { ...freshProgress(), bookmarks: ["002"] };
  const plans = await Promise.all([planSync(store, a, null), planSync(store, b, null)]);
  const results = await Promise.allSettled(plans.map((plan) => commit(store, plan)));
  assert.equal(store.snapshots.length, 2);
  assert.ok(results.every((r) => r.status === "rejected"));
  assert.equal(cloudHeads(await store.list()).length, 2);
  const conflict = await planSync(store, a, null);
  assert.equal(conflict.action, "conflict");
  await commit(store, conflict, b);
  assert.equal(cloudHeads(await store.list()).length, 1);
  assert.equal(store.snapshots[2].parents.length, 2);
});

test("a stale confirmation cannot overwrite a newer remote save", async () => {
  const store = new MemoryDrive(), a = studied();
  const stale = await planSync(store, a, null);
  await commit(store, await planSync(store, { ...a, bookmarks: ["391"] }, null));
  await assert.rejects(() => commit(store, stale), /Another device just synced/);
  assert.equal(store.snapshots.length, 1);
});

test("local changes during a request prevent applying the result", async () => {
  const store = new MemoryDrive(), p = studied();
  const plan = await planSync(store, p, null);
  let changed = false;
  const create = store.create.bind(store);
  store.create = async (s) => { await create(s); changed = true; };
  await assert.rejects(() => commitSync(store, plan, p, bankKey, () => {
    if (changed) throw new Error("Local progress changed");
  }, "Test"), /Local progress changed/);
  assert.equal(store.snapshots.length, 1); // A retry can safely recognize this copy.
  assert.equal((await planSync(store, p, null)).action, "same");
});

test("unknown common history asks before replacing nonempty progress; theme and object order do not conflict", async () => {
  const store = new MemoryDrive(), p = studied();
  await commit(store, await planSync(store, p, null));
  assert.equal((await planSync(store, { ...freshProgress(), bookmarks: ["391"] }, null)).action, "conflict");
  assert.equal((await planSync(store, { ...p, theme: "dark" }, null)).action, "same");
  assert.equal(await fingerprint({ ...p, bookmarks: ["001", "002"] }), await fingerprint({ ...p, bookmarks: ["002", "001"] }));
});

test("incompatible, corrupt or cyclic Drive backups are rejected before restoration", async () => {
  const store = new MemoryDrive();
  await commit(store, await planSync(store, studied(), null));
  const s = store.snapshots[0], file = (await store.list())[0];
  assert.throws(() => parseSnapshot({ ...s, bankKey: "other" }, bank, bankKey, file), /different question bank/);
  assert.throws(() => parseSnapshot({ ...s, progress: { ...s.progress, bookmarks: ["999"] } }, bank, bankKey, file));
  assert.throws(() => parseSnapshot({ ...s, parents: ["unknown"] }, bank, bankKey, file), /incomplete or damaged/);
  assert.throws(() => cloudHeads([{ id: "a", revision: "a", parents: ["b"] }, { id: "b", revision: "b", parents: ["a"] }]), /history is invalid/);
  assert.throws(() => cloudHeads([file, file]), /duplicate/);
});

test("Drive transport uses only app data, paginates, uploads immutable multipart snapshots and handles expired access", async () => {
  const originalFetch = globalThis.fetch;
  const requests: { url: string; options?: RequestInit }[] = [];
  const memory = new MemoryDrive();
  await commit(memory, await planSync(memory, studied(), null));
  const s = memory.snapshots[0];
  const store = driveStore({ sub: "test", email: "test@example.com", token: "test-only", expiresAt: Infinity }, bank, bankKey);
  try {
    globalThis.fetch = async (input, options) => {
      const url = String(input); requests.push({ url, options });
      assert.equal((options?.headers as Record<string, string>).Authorization, "Bearer test-only");
      if (url.includes("upload/drive")) {
        assert.equal(options?.method, "POST");
        assert.ok(String(options?.body).includes('"parents":["appDataFolder"]'));
        assert.ok(String(options?.body).includes('"format":"waypoint-progress"'));
        return new Response('{"id":"new"}');
      }
      if (url.includes("alt=media")) return new Response(JSON.stringify(s));
      const params = new URL(url).searchParams;
      assert.equal(params.get("spaces"), "appDataFolder");
      return new Response(JSON.stringify(params.has("pageToken") ? { files: [] } : {
        files: [{ id: "file", description: JSON.stringify({ revision: s.revision, parents: [] }) }], nextPageToken: "next",
      }));
    };
    const files = await store.list();
    assert.equal(requests.length, 2);
    assert.equal((await store.read(files[0])).revision, s.revision);
    await store.create(s);
    globalThis.fetch = async () => new Response("expired", { status: 401 });
    await assert.rejects(() => store.list(), /sign-in expired/);
    globalThis.fetch = async () => { throw new TypeError("offline"); };
    await assert.rejects(() => store.list(), /could not be reached/);
  } finally { globalThis.fetch = originalFetch; }
});
