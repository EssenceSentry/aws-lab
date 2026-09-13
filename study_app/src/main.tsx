import { createRoot } from "react-dom/client";
import "@fontsource-variable/dm-sans";
import "./styles.css";
import { App } from "./App.tsx";
import { loadProgress } from "./storage.ts";
import type { StudyGuide } from "./guide.ts";
import type { Question } from "./core.ts";

const root = createRoot(document.getElementById("root")!);
function Loading({ error }: { error?: string }) {
  return <div className="boot"><img src="./icon.svg" width="64" height="64" alt="" /><h1>waypoint<span>.</span></h1>
    <p>{error || "Getting your study space ready…"}</p>{error && <button className="button primary" onClick={() => location.reload()}>Try again</button>}</div>;
}
root.render(<Loading />);
async function start() {
  const [response, guideResponse] = await Promise.all([
    fetch(new URL("data/questions.jsonl", document.baseURI)),
    fetch(new URL("data/study-guide.json", document.baseURI)),
  ]);
  if (!response.ok || !guideResponse.ok) throw new Error("Question bank could not be loaded.");
  const bank: Question[] = (await response.text()).trim().split("\n").map((line) => JSON.parse(line));
  const guide: StudyGuide = await guideResponse.json();
  const loaded = loadProgress(bank);
  root.render(<App bank={bank} guide={guide} initialProgress={loaded.progress} initialError={loaded.error} />);
}
start().catch(() => root.render(<Loading error="We couldn’t load your questions. Connect to the internet for the first visit, then try again." />));
