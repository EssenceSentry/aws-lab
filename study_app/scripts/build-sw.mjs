import { readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const app = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(app, "dist");
async function walk(dir, prefix = "") {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = prefix + entry.name;
    if (path === "data/images") continue;
    if (entry.isDirectory()) result.push(...await walk(resolve(dir, entry.name), path + "/"));
    else if (path !== "sw.js") result.push(path);
  }
  return result.sort();
}
const files = await walk(dist);
const digest = createHash("sha256");
for (const path of files) digest.update(path).update(await readFile(resolve(dist, path)));
const build = digest.digest("hex").slice(0, 16);
const template = await readFile(resolve(app, "scripts/sw-template.js"), "utf8");
await writeFile(resolve(dist, "sw.js"), template.replace("__BUILD__", build).replace("__CORE_FILES__", JSON.stringify(files)));
await writeFile(resolve(dist, ".nojekyll"), "");
console.log("Built offline app shell " + build + " with " + files.length + " assets.");
