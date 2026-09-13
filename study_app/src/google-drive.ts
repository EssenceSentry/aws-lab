import { parseRevision, parseSnapshot } from "./sync-core.ts";
import type { CloudFile, CloudStore, Snapshot } from "./sync-core.ts";
import type { Question } from "./core.ts";

const SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const NAME = "waypoint-progress-v1.json";
type TokenResponse = { access_token?: string; expires_in?: number; scope?: string; error?: string };
type GoogleIdentity = { accounts: { oauth2: {
  initTokenClient(options: { client_id: string; scope: string; include_granted_scopes: boolean;
    callback: (response: TokenResponse) => void; error_callback: (error: { type: string }) => void;
  }): { requestAccessToken(options: { prompt: string; hint?: string }): void };
} } };
declare global { interface Window { google?: GoogleIdentity } }
export type DriveAccount = { sub: string; email: string; token: string; expiresAt: number };
let current: DriveAccount | null = null;
let setup: Promise<string> | null = null;
export const disconnectDrive = () => { current = null; };

export function prepareGoogle(): Promise<string> {
  if (!setup) setup = (async () => {
    const response = await fetch(new URL("google-drive.json", document.baseURI));
    if (!response.ok) throw new Error("Google Drive is not configured for this app yet.");
    const { clientId } = await response.json();
    if (typeof clientId !== "string" || !/^[\w-]+\.apps\.googleusercontent\.com$/.test(clientId))
      throw new Error("Google Drive is not configured for this app yet.");
    if (!window.google?.accounts?.oauth2) await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      const fail = () => { script.remove(); reject(new Error("Google sign-in could not load. Check your connection and try again.")); };
      const timeout = setTimeout(fail, 15_000);
      script.src = "https://accounts.google.com/gsi/client"; script.async = true;
      script.onload = () => { clearTimeout(timeout); resolve(); };
      script.onerror = () => { clearTimeout(timeout); fail(); };
      document.head.append(script);
    });
    return clientId;
  })().catch((error) => { setup = null; throw error; });
  return setup;
}
// Invoke directly from a click handler: opening the Google popup needs user activation.
export function connectDrive(clientId: string, email?: string): Promise<DriveAccount> {
  if (current && current.expiresAt > Date.now() + 60_000) return Promise.resolve(current);
  return new Promise((resolve, reject) => {
    const oauth = window.google?.accounts.oauth2;
    if (!oauth) { reject(new Error("Google sign-in is still loading. Try again in a moment.")); return; }
    const client = oauth.initTokenClient({ client_id: clientId, scope: `openid email ${SCOPE}`, include_granted_scopes: false,
      error_callback: ({ type }) => reject(new Error(type === "popup_closed" ? "Sign-in was closed. Your progress is unchanged." : "Allow the Google sign-in popup, then try again.")),
      callback: (response) => {
        if (response.error || !response.access_token || !response.scope?.split(" ").includes(SCOPE)) {
          reject(new Error("Google Drive permission is needed to sync. Your local progress is unchanged.")); return;
        }
        const token = response.access_token;
        void requestJSON<{ sub: string; email: string }>(token, "https://openidconnect.googleapis.com/v1/userinfo").then((identity) => {
          if (typeof identity.sub !== "string" || typeof identity.email !== "string") throw new Error("Google could not identify the selected account.");
          current = { ...identity, token, expiresAt: Date.now() + Number(response.expires_in ?? 3600) * 1000 };
          resolve(current);
        }).catch(reject);
      },
    });
    client.requestAccessToken({ prompt: email ? "" : "select_account", ...(email ? { hint: email } : {}) });
  });
}

async function requestJSON<T>(token: string, url: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { ...options, signal: AbortSignal.timeout(30_000),
      headers: { ...options.headers, Authorization: "Bearer " + token }, cache: "no-store" });
  } catch { throw new Error("Drive could not be reached. Check your connection and tap Sync now again."); }
  if (!response.ok) {
    if (response.status === 401) { current = null; throw new Error("Google sign-in expired. Tap Sync now to sign in again."); }
    if (response.status === 403) throw new Error("Google Drive did not allow this request. Check the app’s Drive permission and try again.");
    throw new Error("Drive could not complete the sync. Your local progress is unchanged; try again shortly.");
  }
  const text = await response.text();
  if (text.length > 8_000_000) throw new Error("This Drive backup is too large to restore safely.");
  try { return JSON.parse(text) as T; }
  catch { throw new Error("Drive returned an unreadable backup."); }
}

export function driveStore(account: DriveAccount, bank: Question[], bankKey: string): CloudStore {
  return {
    async list() {
      const files: CloudFile[] = [];
      let pageToken = "";
      const seen = new Set<string>();
      do {
        const query = new URLSearchParams({ spaces: "appDataFolder", q: `name = '${NAME}' and trashed = false`,
          fields: "nextPageToken,files(id,description)", orderBy: "createdTime desc", pageSize: "1000", ...(pageToken ? { pageToken } : {}) });
        const page = await requestJSON<{ files?: { id: string; description?: string }[]; nextPageToken?: string }>(
          account.token, "https://www.googleapis.com/drive/v3/files?" + query);
        for (const file of page.files ?? []) {
          if (typeof file.id !== "string" || !/^[\w-]+$/.test(file.id)) throw new Error("Drive returned an invalid backup reference.");
          let metadata: unknown;
          try { metadata = JSON.parse(file.description ?? ""); } catch { throw new Error("A Drive backup is missing version information."); }
          files.push({ id: file.id, ...parseRevision(metadata) });
        }
        pageToken = page.nextPageToken ?? "";
        if (pageToken && seen.has(pageToken)) throw new Error("Drive could not finish listing backups. Try again.");
        seen.add(pageToken);
      } while (pageToken);
      return files;
    },
    async read(file) {
      const value = await requestJSON<unknown>(account.token, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`);
      return parseSnapshot(value, bank, bankKey, file);
    },
    async create(snapshot: Snapshot) {
      const boundary = "waypoint_" + crypto.randomUUID();
      const metadata = { name: NAME, parents: ["appDataFolder"], mimeType: "application/json",
        description: JSON.stringify({ revision: snapshot.revision, parents: snapshot.parents }) };
      const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
        `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(snapshot)}\r\n--${boundary}--`;
      await requestJSON(account.token, "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", {
        method: "POST", headers: { "Content-Type": "multipart/related; boundary=" + boundary }, body,
      });
    },
  };
}
