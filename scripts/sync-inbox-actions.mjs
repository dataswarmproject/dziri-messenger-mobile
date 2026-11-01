import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = fileURLToPath(new URL('../', import.meta.url));
const source = 'packages/shared/src/messenger-inbox-actions.ts';
const target = path.join(root, 'src/dziri/inbox-actions.generated.ts');
const receipt = path.join(root, 'docs/inbox-actions-contract.json');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const index = process.argv.indexOf('--source');
if (index >= 0) {
  const bytes = fs.readFileSync(path.resolve(process.argv[index + 1], source));
  fs.writeFileSync(target, bytes);
  execFileSync(
    process.execPath,
    [path.join(root, 'node_modules/prettier/bin/prettier.cjs'), '--write', target],
    { stdio: 'pipe' },
  );
  fs.writeFileSync(
    receipt,
    JSON.stringify(
      { version: 1, source, sourceSHA256: hash(bytes), sha256: hash(fs.readFileSync(target)) },
      null,
      2,
    ) + '\n',
  );
}
if (hash(fs.readFileSync(target)) !== JSON.parse(fs.readFileSync(receipt)).sha256)
  throw Error('Inbox action contract drift');
console.log('Canonical inbox actions verified.');
