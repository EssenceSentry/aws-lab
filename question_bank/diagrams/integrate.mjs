import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT, BANK, hash, recordHash, canonical, readJSON, writeJSON, atomicWrite, readBank, selectedRevisions, validateRevision, currentEvidence, evidenceMatches, manifestPath, reviewsPath } from './common.mjs';

const revisions=await selectedRevisions();
const bank=await readBank();const byID=new Map(bank.map(record=>[record.id,record]));
const manifest=await readJSON(manifestPath), reviews=await readJSON(reviewsPath,{questions:{}});
const integrated=await readJSON(path.join(ROOT,'integrated.json'),{schema_version:1,questions:{}});
for(const revision of revisions) {
  const id=revision.question_id,current=byID.get(id);
  await validateRevision(revision,current);
  const evidence=await currentEvidence(revision), render=manifest.questions[id], review=reviews.questions[id];
  if(!evidenceMatches(render,evidence))throw new Error('Q'+id+': missing or outdated render');
  if(!evidenceMatches(review,evidence)||review.png_sha1!==render.png_sha1||review.editorial!=='approved'||review.visual!=='approved'||!review.notes?.trim())throw new Error('Q'+id+': editorial and visual review are required for the current source and PNG');
  const png=await readFile(path.resolve(ROOT,'..',render.image));
  if(hash(png,'sha1')!==render.png_sha1)throw new Error('Q'+id+': image hash mismatch');
  const record=structuredClone(revision.record);record.explanation.images=[render.image];
  const currentHash=recordHash(current), finalHash=recordHash(record);
  if(currentHash!==revision.base_record_sha256 && currentHash!==finalHash && currentHash!==integrated.questions[id]?.record_sha256)throw new Error('Q'+id+': bank changed since editorial review; reconcile before integrating');
  if(currentHash===integrated.questions[id]?.record_sha256 && integrated.questions[id].base_record_sha256!==revision.base_record_sha256)throw new Error('Q'+id+': revision provenance changed unexpectedly');
  byID.set(id,record);
  integrated.questions[id]={...evidence,base_record_sha256:revision.base_record_sha256,record_sha256:finalHash,image:render.image,png_sha1:render.png_sha1};
}
const output=bank.map(record=>byID.get(record.id));
if(output.length!==391||new Set(output.map(record=>record.id)).size!==391)throw new Error('Expected all 391 unique questions');
if(canonical(bank)!==canonical(output))await atomicWrite(BANK,output.map(record=>JSON.stringify(record)).join('\n')+'\n');
await writeJSON(path.join(ROOT,'integrated.json'),integrated);
console.log('Integrated '+revisions.length+' reviewed questions; '+Object.keys(integrated.questions).length+'/391 total.');
