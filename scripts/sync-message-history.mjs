import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = fileURLToPath(new URL('../', import.meta.url));
const manifestPath = resolve(root, 'docs/message-history-contract.json');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const files = [
  ['packages/shared/src/messenger-history.ts', 'src/dziri/history-policy.generated.ts'],
  [
    'apps/dziri/components/messaging/use-history-search.ts',
    'src/dziri/use-history-search.generated.ts',
  ],
];
const sourceIndex = process.argv.indexOf('--source');
if (sourceIndex >= 0) {
  const records = files.map(([source, target]) => {
    const bytes = readFileSync(resolve(process.argv[sourceIndex + 1], source));
    const path = resolve(root, target);
    writeFileSync(path, bytes);
    execFileSync(
      process.execPath,
      [resolve(root, 'node_modules/prettier/bin/prettier.cjs'), '--write', path],
      { stdio: 'pipe' },
    );
    return { source, target, sourceSha256: hash(bytes), sha256: hash(readFileSync(path)) };
  });
  writeFileSync(manifestPath, JSON.stringify({ version: 1, files: records }, null, 2) + '\n');
}
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
for (const file of manifest.files)
  if (hash(readFileSync(resolve(root, file.target))) !== file.sha256)
    throw new Error('Messenger history contract drifted; sync the canonical source.');
console.log('Canonical Messenger history contract verified.');
