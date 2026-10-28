import { readFileSync,writeFileSync,mkdirSync } from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const sourceIndex=process.argv.indexOf('--source');
const target=resolve(root,'src/dziri/expression-contract.generated.ts');
const receipt=resolve(root,'docs/expressions-contract.json');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
if(sourceIndex>=0){
  const source=resolve(process.argv[sourceIndex+1],'packages/shared/src/expressions.ts');
  const bytes=readFileSync(source);
  writeFileSync(target,bytes);mkdirSync(dirname(receipt),{recursive:true});
  execFileSync(process.execPath,[resolve(root,'node_modules/prettier/bin/prettier.cjs'),'--write',target],{cwd:root,stdio:'pipe'});
  writeFileSync(receipt,JSON.stringify({version:1,source:'packages/shared/src/expressions.ts',sourceSha256:hash(bytes),sha256:hash(readFileSync(target))},null,2)+'\n');
}else{
  const manifest=JSON.parse(readFileSync(receipt,'utf8'));
  if(hash(readFileSync(target))!==manifest.sha256)throw new Error('Expression contract changed; sync from canonical source.');
}
console.log('Canonical expression contract verified.');
