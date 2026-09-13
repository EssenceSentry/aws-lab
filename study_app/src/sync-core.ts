import { freshProgress, parseProgress } from "./core.ts";
import type { Progress, Question } from "./core.ts";

export type Revision = { revision: string; parents: string[] };
export type Snapshot = Revision & {
  format: "waypoint-progress"; version: 1; bankKey: string;
  savedAt: string; device: string; progress: Progress;
};
export type CloudFile = Revision & { id: string };
export type SyncMark = { account: string; email: string; fingerprint: string; syncedAt: string };

function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => JSON.stringify(key) + ":" + canonical(item)).join(",") + "}";
  return JSON.stringify(value);
}
// Appearance belongs to the device. Session order and answers travel unchanged.
export function progressKey(progress: Progress): string {
  return canonical({ ...progress, theme: "system", bookmarks: [...progress.bookmarks].sort() });
}
export async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}
export const fingerprint = (progress: Progress) => digest(progressKey(progress));
export const bankFingerprint = (bank: Question[]) => digest(canonical(bank.map((q) => ({
  id: q.id, question: q.question, options: q.options, correct: q.correct_option_ids,
})).sort((a, b) => a.id.localeCompare(b.id))));

export function parseRevision(value: unknown): Revision {
  const v = value as Revision;
  if (!v || typeof v.revision !== "string" || !/^[\w-]{1,100}$/.test(v.revision) ||
    !Array.isArray(v.parents) || v.parents.length > 100 ||
    v.parents.some((p) => typeof p !== "string" || !/^[\w-]{1,100}$/.test(p) || p === v.revision) ||
    new Set(v.parents).size !== v.parents.length) throw new Error("A Drive backup has invalid version information. Your progress has not been replaced.");
  return { revision: v.revision, parents: [...v.parents] };
}
export function cloudHeads(files: CloudFile[]): CloudFile[] {
  const versions = new Map<string, CloudFile>();
  for (const file of files) {
    parseRevision(file);
    if (versions.has(file.revision)) throw new Error("Drive contains duplicate backup versions. Export your progress before resolving this.");
    versions.set(file.revision, file);
  }
  const visiting = new Set<string>(), visited = new Set<string>();
  function visit(id: string) {
    if (visiting.has(id)) throw new Error("Drive backup history is invalid.");
    if (visited.has(id)) return;
    visiting.add(id);
    for (const parent of versions.get(id)?.parents ?? []) visit(parent);
    visiting.delete(id); visited.add(id);
  }
  for (const id of versions.keys()) visit(id);
  const parents = new Set(files.flatMap((file) => file.parents));
  return files.filter((file) => !parents.has(file.revision)).sort((a, b) => a.revision.localeCompare(b.revision));
}
export function parseSnapshot(value: unknown, bank: Question[], bankKey: string, file: CloudFile): Snapshot {
  const v = value as Snapshot;
  const revision = parseRevision(v);
  if (v.format !== "waypoint-progress" || v.version !== 1 || v.bankKey !== bankKey)
    throw new Error("This Drive backup belongs to a different question bank or app version. Update Waypoint on both devices first.");
  if (revision.revision !== file.revision || canonical(revision.parents) !== canonical(file.parents) ||
    typeof v.savedAt !== "string" || !Number.isFinite(Date.parse(v.savedAt)) ||
    typeof v.device !== "string" || v.device.length > 80) throw new Error("This Drive backup is incomplete or damaged.");
  return { ...v, ...revision, progress: parseProgress(v.progress, bank) };
}
export function syncAction(local: string, remote: string | null, base: string | null, empty: string): "upload" | "download" | "same" | "conflict" {
  if (remote === null) return "upload";
  if (local === remote) return "same";
  if (base === local || (!base && local === empty)) return "download";
  if (base === remote) return "upload";
  return "conflict";
}
export const emptyFingerprint = () => fingerprint(freshProgress());
export function summary(progress: Progress): string {
  return `${Object.keys(progress.attempts).length} studied · ${progress.history.length} sessions · ${progress.bookmarks.length} saved`;
}

export interface CloudStore {
  list(): Promise<CloudFile[]>;
  read(file: CloudFile): Promise<Snapshot>;
  create(snapshot: Snapshot): Promise<void>;
}
export type SyncPlan = { local: Progress; key: string; heads: CloudFile[]; snapshots: Snapshot[]; action: ReturnType<typeof syncAction> };
export async function planSync(store: CloudStore, local: Progress, base: string | null): Promise<SyncPlan> {
  const heads = cloudHeads(await store.list());
  const snapshots = await Promise.all(heads.map((file) => store.read(file)));
  const action = heads.length > 1 ? "conflict" : syncAction(await fingerprint(local),
    snapshots[0] ? await fingerprint(snapshots[0].progress) : null, base, await emptyFingerprint());
  return { local: structuredClone(local), key: progressKey(local), heads, snapshots, action };
}
const headKey = (files: CloudFile[]) => files.map((f) => f.revision).sort().join(",");
// Append-only revisions preserve both sides of concurrent writes. Never PATCH a shared file.
export async function commitSync(store: CloudStore, plan: SyncPlan, chosen: Progress, bankKey: string,
  assertLocalUnchanged: () => void, device: string): Promise<Progress> {
  assertLocalUnchanged();
  if (headKey(cloudHeads(await store.list())) !== headKey(plan.heads))
    throw new Error("Another device just synced. Tap Sync now again to compare the latest progress.");
  assertLocalUnchanged();
  if (plan.action === "upload" || plan.action === "conflict") {
    const snapshot: Snapshot = { format: "waypoint-progress", version: 1, bankKey,
      revision: crypto.randomUUID(), parents: plan.heads.map((f) => f.revision),
      savedAt: new Date().toISOString(), device, progress: { ...structuredClone(chosen), theme: "system" } };
    await store.create(snapshot);
    const heads = cloudHeads(await store.list());
    if (heads.length !== 1 || heads[0].revision !== snapshot.revision)
      throw new Error("Both devices saved at the same time. Both copies are safe in Drive. Tap Sync now to choose one.");
  }
  assertLocalUnchanged();
  return { ...structuredClone(chosen), theme: plan.local.theme };
}
