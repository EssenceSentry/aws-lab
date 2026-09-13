import { freshProgress, parseProgress } from "./core.ts";
import type { Progress, Question } from "./core.ts";

export const STORAGE_KEY = "waypoint.sap-c02.progress.v3";
export function loadProgress(bank: Question[]): { progress: Progress; error: string } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return { progress: saved ? parseProgress(JSON.parse(saved), bank) : freshProgress(), error: "" };
  } catch {
    try {
      const original = localStorage.getItem(STORAGE_KEY);
      if (original) localStorage.setItem(STORAGE_KEY + ".recovery", original);
    } catch { /* Keep the original key intact if browser storage is unavailable. */ }
    return { progress: freshProgress(), error: "Saved progress could not be read. Your original backup is still in this browser. Export a recovery copy in Settings before starting again." };
  }
}
export function saveProgress(progress: Progress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}
export function downloadJSON(data: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
