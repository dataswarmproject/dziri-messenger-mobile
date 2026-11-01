import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url));
const source='packages/convex-provider/src/use-client-retirement.ts';
const target=path.join(root,'src/dziri/client-retirement.generated.ts');
const receipt=path.join(root,'docs/client-retirement-contract.json');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const at=process.argv.indexOf('--source');
if(at>=0){
 const bytes=fs.readFileSync(path.resolve(process.argv[at+1],source));
 fs.writeFileSync(target,bytes);
 execFileSync(process.execPath,[path.join(root,'node_modules/prettier/bin/prettier.cjs'),'--write',target],{stdio:'pipe'});
 fs.writeFileSync(receipt,JSON.stringify({version:1,source,sourceSha256:hash(bytes),sha256:hash(fs.readFileSync(target))},null,2)+'\n');
}
const proof=JSON.parse(fs.readFileSync(receipt));
if(hash(fs.readFileSync(target))!==proof.sha256)throw Error('Client retirement drift; synchronize the canonical hook');
console.log('Canonical client retirement verified.');
