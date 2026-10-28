import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = fileURLToPath(new URL('../', import.meta.url));
const target = resolve(root, 'src/dziri/push-registration.generated.ts');
const receipt = resolve(root, 'docs/push-registration-contract.json');
const hash = value => createHash('sha256').update(value).digest('hex');
const sourceIndex = process.argv.indexOf('--source');
if (sourceIndex >= 0) {
  const source = 'apps/dziri/lib/native-push-registration.ts';
  const bytes = readFileSync(resolve(process.argv[sourceIndex + 1], source));
  writeFileSync(target, bytes);
  execFileSync(
    process.execPath,
    [resolve(root, 'node_modules/prettier/bin/prettier.cjs'), '--write', target],
    { stdio: 'pipe' },
  );
  writeFileSync(
    receipt,
    JSON.stringify(
      { version: 1, source, sourceSha256: hash(bytes), sha256: hash(readFileSync(target)) },
      null,
      2,
    ) + '\n',
  );
}
if (hash(readFileSync(target)) !== JSON.parse(readFileSync(receipt, 'utf8')).sha256)
  throw new Error('Messenger push registration drifted; sync the canonical source.');
console.log('Canonical Messenger push registration verified.');
