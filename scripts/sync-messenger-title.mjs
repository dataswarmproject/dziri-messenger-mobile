import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = fileURLToPath(new URL('../', import.meta.url));
const source = 'packages/ui/src/messaging/use-messenger-title.ts';
const target = resolve(root, 'src/dziri/messenger-title.generated.ts');
const receipt = resolve(root, 'docs/messenger-title-contract.json');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const index = process.argv.indexOf('--source');
if (index >= 0) {
  const canonical = resolve(process.argv[index + 1]);
  const bytes = readFileSync(resolve(canonical, source));
  writeFileSync(target, bytes);
  execFileSync(
    process.execPath,
    [resolve(root, 'node_modules/prettier/bin/prettier.cjs'), '--write', target],
    { stdio: 'pipe' },
  );
  mkdirSync(resolve(root, 'licenses'), { recursive: true });
  const license = readFileSync(resolve(canonical, 'packages/ui/licenses/magic-ui.txt'));
  writeFileSync(resolve(root, 'licenses/magic-ui.txt'), license);
  writeFileSync(
    receipt,
    JSON.stringify(
      {
        version: 1,
        source,
        sourceSha256: hash(bytes),
        sha256: hash(readFileSync(target)),
        licenseSha256: hash(license),
      },
      null,
      2,
    ) + '\n',
  );
}
const proof = JSON.parse(readFileSync(receipt, 'utf8'));
if (
  hash(readFileSync(target)) !== proof.sha256 ||
  hash(readFileSync(resolve(root, 'licenses/magic-ui.txt'))) !== proof.licenseSha256
)
  throw Error('Messenger title contract changed; synchronize canonical source.');
console.log('Canonical Messenger title animation verified.');
