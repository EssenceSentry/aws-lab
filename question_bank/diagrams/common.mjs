import { createHash } from 'node:crypto';
import { readFile, readdir, mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateOptionReferences } from '../../study_app/src/option-references.ts';

export const ROOT = path.dirname(fileURLToPath(import.meta.url));
export const BANK = path.resolve(ROOT, '../questions.jsonl');
export const hash = (value, algorithm = 'sha256') => createHash(algorithm).update(value).digest('hex');
export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}
export const recordHash = value => hash(canonical(value));
export async function readJSON(filename, fallback) {
  try { return JSON.parse(await readFile(filename, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT' && fallback !== undefined) return fallback; throw error; }
}
export async function atomicWrite(filename, content) {
  await mkdir(path.dirname(filename), { recursive: true });
  const temporary = filename + '.tmp-' + process.pid;
  await writeFile(temporary, content);
  await rename(temporary, filename);
}
export const writeJSON = (filename, value) => atomicWrite(filename, JSON.stringify(value, null, 2) + '\n');
export async function readBank() {
  return (await readFile(BANK, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
}
export async function selectedRevisions(args = process.argv.slice(2)) {
  const files = (await readdir(path.join(ROOT, 'revisions'))).filter(name => /^\d{3}\.json$/.test(name)).sort();
  const wanted = new Set(args.filter(arg => !arg.startsWith('--')).flatMap(arg => {
    if (/^\d{1,3}-\d{1,3}$/.test(arg)) {
      const [first, last] = arg.split('-').map(Number);
      if (first > last) throw new Error('Question range must be ascending: ' + arg);
      return Array.from({ length: last - first + 1 }, (_, i) => String(first + i).padStart(3, '0'));
    }
    if (!/^\d{1,3}$/.test(arg)) throw new Error('Expected question ID or inclusive range: ' + arg);
    return [arg.padStart(3, '0')];
  }));
  const selected = files.filter(file => !wanted.size || wanted.has(file.slice(0, 3)));
  if (wanted.size && selected.length !== wanted.size) throw new Error('One or more requested revision files are missing');
  if (!selected.length) throw new Error('No authored question revisions found');
  return Promise.all(selected.map(async file => {
    const revision = await readJSON(path.join(ROOT, 'revisions', file));
    if (revision.question_id !== file.slice(0, 3)) throw new Error('Revision filename/ID mismatch: ' + file);
    return revision;
  }));
}
export function sourcePath(revision) {
  if (!/^sources\/\d{3}\.(mmd|diagram\.json|svg)$/.test(revision.diagram_source)
      || !revision.diagram_source.startsWith('sources/' + revision.question_id + '.')) {
    throw new Error('Invalid diagram source path for Q' + revision.question_id);
  }
  return path.join(ROOT, revision.diagram_source);
}
export async function validateRevision(revision, original) {
  const { record, question_id: id } = revision;
  const fail = reason => { throw new Error('Q' + id + ': ' + reason); };
  if (!original || record?.id !== id) fail('unknown or mismatched question ID');
  if (!/^[a-f0-9]{64}$/.test(revision.base_record_sha256)) fail('missing original record hash');
  if (record.exam_domain !== original.exam_domain) fail('exam domain changed');
  if (canonical(record.options.map(option => option.id)) !== canonical(original.options.map(option => option.id))) fail('option IDs or order changed');
  if (canonical(record.question_images ?? []) !== canonical(original.question_images ?? [])) fail('essential stem images changed');
  if (!record.question?.trim() || !record.explanation?.text?.trim() || record.options.some(option => !option.text?.trim())) fail('empty question, option, or explanation');
  const options = record.options.map(option => option.id);
  if (!record.correct_option_ids.length || new Set(record.correct_option_ids).size !== record.correct_option_ids.length || record.correct_option_ids.some(option => !options.includes(option))) fail('invalid answer set');
  const count = record.correct_option_ids.length;
  if (count > 1 && !new RegExp('Select\\s+' + ({2: 'TWO', 3: 'THREE', 4: 'FOUR'}[count] ?? count), 'i').test(record.question)) fail('missing explicit selection count');
  for (const text of [record.question, record.explanation.text, ...record.options.map(option => option.text)]) validateOptionReferences(text, options);
  for (const option of options) if (!record.explanation.text.includes('<<' + option + '>>')) fail('explanation does not address option ' + option);
  if (!revision.diagram_alt?.trim()) fail('missing diagram description');
  if (!revision.sources?.length) fail('no source evidence');
  for (const source of revision.sources) {
    const url = new URL(source.url);
    if (url.protocol !== 'https:' || !/(^|\.)amazon(aws)?\.com$/.test(url.hostname)) fail('expected official AWS source: ' + source.url);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(source.checked_on) || !source.supports?.trim()) fail('missing source date or claim');
  }
  await readFile(sourcePath(revision));
}
export const manifestPath = path.join(ROOT, 'manifest.json');
export const reviewsPath = path.join(ROOT, 'reviews.json');
export async function rendererFingerprint() {
  const files = ['render.mjs', 'render-page.html', 'style.json', 'package-lock.json'];
  return hash(Buffer.concat(await Promise.all(files.map(file => readFile(path.join(ROOT, file))))));
}
export async function currentEvidence(revision) {
  return {
    revision_sha256: recordHash(revision),
    source_sha256: hash(await readFile(sourcePath(revision))),
    renderer_sha256: await rendererFingerprint(),
  };
}
export function evidenceMatches(left, right) {
  return ['revision_sha256', 'source_sha256', 'renderer_sha256'].every(key => left?.[key] === right?.[key]);
}
