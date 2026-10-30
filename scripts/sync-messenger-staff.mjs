import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const root = fileURLToPath(new URL('../', import.meta.url)),
  receipt = resolve(root, 'docs/messenger-staff-contract.json');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceIndex = process.argv.indexOf('--source');
if (sourceIndex >= 0) {
  const files = [
    ['packages/shared/src/messenger-staff.ts', 'src/dziri/messenger-staff.generated.ts'],
    ['packages/ui/src/messaging/use-staff-setup.ts', 'src/dziri/use-staff-setup.generated.ts'],
    ['packages/shared/src/inbox/staff-session-policy.ts', 'src/inbox/workspace-policy.ts'],
    ['packages/shared/src/inbox/handoff.ts', 'src/inbox/handoff.ts'],
    ['packages/shared/src/inbox/pending-handoff.ts', 'src/inbox/pending-handoff.ts'],
  ].map(([source, target]) => {
    const bytes = readFileSync(resolve(process.argv[sourceIndex + 1], source));
    writeFileSync(
      resolve(root, target),
      bytes
        .toString()
        .replaceAll('@dziri/shared/messenger-staff', './messenger-staff.generated')
        .replaceAll('../messenger-staff', '../dziri/messenger-staff.generated')
        .replaceAll('./staff-session-policy', './workspace-policy'),
    );
    execFileSync(
      process.execPath,
      [resolve(root, 'node_modules/prettier/bin/prettier.cjs'), '--write', resolve(root, target)],
      { stdio: 'pipe' },
    );
    return {
      source,
      target,
      sourceSha256: hash(bytes),
      sha256: hash(readFileSync(resolve(root, target))),
    };
  });
  writeFileSync(receipt, JSON.stringify({ version: 1, files }, null, 2) + '\n');
}
for (const file of JSON.parse(readFileSync(receipt, 'utf8')).files)
  if (hash(readFileSync(resolve(root, file.target))) !== file.sha256)
    throw new Error('Staff setup contract drifted: ' + file.target);
console.log('Canonical staff setup policy and controller verified.');
