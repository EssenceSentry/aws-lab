import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT, hash, readBank, readJSON, writeJSON, sourcePath, selectedRevisions, validateRevision, currentEvidence, evidenceMatches, manifestPath } from './common.mjs';

const require=createRequire(path.resolve(ROOT,'../../study_app/package.json'));
const {chromium}=require('playwright');
const revisions=await selectedRevisions();
const bank=new Map((await readBank()).map(record=>[record.id,record]));
const manifest=await readJSON(manifestPath,{schema_version:1,questions:{}});
await mkdir(path.join(ROOT,'renders'),{recursive:true});
const server=createServer(async(req,res)=>{
  try {
    const relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/, '') || 'render-page.html';
    const target=path.resolve(ROOT,relative);
    if(!target.startsWith(ROOT+path.sep)) {res.writeHead(403).end();return;}
    const body=await readFile(target);
    const mime={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml'};
    res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream'});res.end(body);
  }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;let failures=0;
try {
  browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1200,height:900},deviceScaleFactor:2});
  const url='http://127.0.0.1:'+server.address().port;
  await page.route('**/*',route=>route.request().url().startsWith(url+'/')?route.continue():route.abort());
  await page.goto(url);await page.waitForFunction(()=>window.ready===true);
  for(const revision of revisions) {
    const id=revision.question_id;
    try {
      await validateRevision(revision,bank.get(id));
      const evidence=await currentEvidence(revision), previous=manifest.questions[id];
      if(!process.argv.includes('--force')&&evidenceMatches(previous,evidence)) {
        const bytes=await readFile(path.resolve(ROOT,'..',previous.image));
        if(hash(bytes,'sha1')===previous.png_sha1) {console.log('Q'+id+' unchanged');continue;}
      }
      const source=await readFile(sourcePath(revision),'utf8');
      const kind=revision.diagram_source.endsWith('.mmd')?'mermaid':revision.diagram_source.endsWith('.svg')?'svg':'table';
      const output=await page.evaluate(async payload=>window.renderDiagram(payload),{id,source,kind,alt:revision.diagram_alt});
      if(output.height>6000)throw new Error('Diagram too tall to export usefully');
      const png=await page.locator('#card').screenshot({animations:'disabled'});
      const sha1=hash(png,'sha1'), image='images/'+sha1+'.png';
      await writeFile(path.resolve(ROOT,'..',image),png);
      await writeFile(path.join(ROOT,'renders',id+'.png'),png);
      if(output.svg)await writeFile(path.join(ROOT,'renders',id+'.svg'),output.svg+'\n');
      manifest.questions[id]={...evidence,image,png_sha1:sha1,width:png.readUInt32BE(16),height:png.readUInt32BE(20),diagram_source:revision.diagram_source,diagram_alt:revision.diagram_alt,warnings:output.warnings};
      await writeJSON(manifestPath,manifest);
      console.log('Q'+id+' rendered '+manifest.questions[id].width+'×'+manifest.questions[id].height+(output.warnings.length?' · '+output.warnings.join('; '):''));
    } catch(error) {failures++;console.error('Q'+id+': '+error.message);}
  }
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
if(failures)process.exitCode=1;
