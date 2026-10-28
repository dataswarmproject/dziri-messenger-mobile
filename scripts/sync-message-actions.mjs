import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = fileURLToPath(new URL('../', import.meta.url));
const target = resolve(root, 'src/dziri/message-action-policy.generated.ts');
const receipt = resolve(root, 'docs/message-action-contract.json');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceIndex = process.argv.indexOf('--source');
if (sourceIndex >= 0) {
  const bytes = readFileSync(
    resolve(process.argv[sourceIndex + 1], 'packages/shared/src/messenger-actions.ts'),
  );
  writeFileSync(target, bytes);
  execFileSync(
    process.execPath,
    [resolve(root, 'node_modules/prettier/bin/prettier.cjs'), '--write', target],
    { cwd: root, stdio: 'pipe' },
  );
  writeFileSync(
    receipt,
    JSON.stringify(
      {
        version: 1,
        source: 'packages/shared/src/messenger-actions.ts',
        sourceSha256: hash(bytes),
        sha256: hash(readFileSync(target)),
      },
      null,
      2,
    ) + '\n',
  );
}
const manifest = JSON.parse(readFileSync(receipt, 'utf8'));
if (hash(readFileSync(target)) !== manifest.sha256)
  throw new Error('Message action rules drifted; sync the canonical source.');
console.log('Canonical Messenger action rules verified.');
