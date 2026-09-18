import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT, hash, recordHash, readJSON, readBank, selectedRevisions, validateRevision, currentEvidence, evidenceMatches, manifestPath, reviewsPath } from './common.mjs';

const bank=await readBank(), byID=new Map(bank.map(record=>[record.id,record]));
const revisions=await selectedRevisions(), manifest=await readJSON(manifestPath,{questions:{}}), reviews=await readJSON(reviewsPath,{questions:{}}), integrated=await readJSON(path.join(ROOT,'integrated.json'),{questions:{}});
const counts={bank:bank.length,authored:0,rendered:0,reviewed:0,integrated:0};
if(bank.length!==391||byID.size!==391)throw new Error('Expected 391 unique bank records');
for(const revision of revisions) {
  const id=revision.question_id;
  await validateRevision(revision,byID.get(id));counts.authored++;
  const evidence=await currentEvidence(revision),render=manifest.questions[id],review=reviews.questions[id],applied=integrated.questions[id];
  if(render) {
    if(!evidenceMatches(render,evidence))throw new Error('Q'+id+': stale render');
    const png=await readFile(path.resolve(ROOT,'..',render.image));
    if(render.image!=='images/'+hash(png,'sha1')+'.png')throw new Error('Q'+id+': bad image content hash');
    if(png.readUInt32BE(16)!==render.width||png.readUInt32BE(20)!==render.height)throw new Error('Q'+id+': bad dimensions');
    counts.rendered++;
  }
  if(review&&evidenceMatches(review,evidence)&&review.png_sha1===render?.png_sha1&&review.editorial==='approved'&&review.visual==='approved')counts.reviewed++;
  if(applied) {
    if(!evidenceMatches(applied,evidence)||recordHash(byID.get(id))!==applied.record_sha256||byID.get(id).explanation.images?.[0]!==render.image)throw new Error('Q'+id+': bank/integration mismatch');
    counts.integrated++;
  }
}
console.log(JSON.stringify(counts,null,2));
if(process.argv.includes('--complete')&&Object.values(counts).some(count=>count!==391))throw new Error('All 391 questions must be authored, rendered, reviewed, and integrated');
