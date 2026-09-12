export type OfflineStatus = { cached: number; total: number; bytes: number };
export type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
export async function registerPWA(onUpdate: (registration: ServiceWorkerRegistration) => void) {
  if (!("serviceWorker" in navigator) || !import.meta.env.PROD) return;
  const registration = await navigator.serviceWorker.register(new URL("sw.js", document.baseURI), { scope: "./" });
  if (registration.waiting) onUpdate(registration);
  registration.addEventListener("updatefound", () => {
    const worker = registration.installing;
    worker?.addEventListener("statechange", () => {
      if (worker.state === "installed" && navigator.serviceWorker.controller) onUpdate(registration);
    });
  });
}
export async function offlineImages(download: boolean, onProgress?: (value: OfflineStatus) => void): Promise<OfflineStatus> {
  if (!("serviceWorker" in navigator)) throw new Error("Offline downloads are not supported in this browser.");
  const registration = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Offline mode is not ready. Reload the app once and try again.")), 12000)),
  ]);
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    let timer: ReturnType<typeof setTimeout>;
    const resetTimeout = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { channel.port1.close(); reject(new Error("The download stopped responding. Reconnect and try again; saved images will be kept.")); }, 45_000);
    };
    channel.port1.onmessage = (event) => {
      resetTimeout();
      if (event.data.error) { clearTimeout(timer); channel.port1.close(); reject(new Error(event.data.error)); return; }
      onProgress?.(event.data);
      if (event.data.done) { clearTimeout(timer); channel.port1.close(); resolve(event.data); }
    };
    resetTimeout();
    registration.active!.postMessage({ type: download ? "DOWNLOAD_IMAGES" : "OFFLINE_STATUS" }, [channel.port2]);
  });
}
