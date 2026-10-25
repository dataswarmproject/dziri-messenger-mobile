import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const upstream = 'e3c8fc5f3d0ece96ea6843e38759bc9b44e13112';
const sha = path =>
  createHash('sha256')
    .update(readFileSync(resolve(root, path)))
    .digest('hex');
assert.equal(
  sha('assets/dziri-ring.svg'),
  '4a6eaf8ff2530af1dcc959c6e04fed74b744d21939e6a7d3bc2361cd50ca71dd',
);
assert.equal(
  sha('assets/dziri-ring.png'),
  'd90e53f48c4e3a3c8b82dd63214757eebbf8794093662ef35153188786eb997d',
);

const layoutChanges = execFileSync(
  'git',
  [
    'diff',
    '--name-only',
    upstream,
    '--',
    'src/components-next',
    'src/screens',
    'src/navigation',
    'src/assets/fonts',
  ],
  { cwd: root, encoding: 'utf8' },
).trim();
assert.equal(layoutChanges, '', `Upstream native layouts/fonts changed: ${layoutChanges}`);
const entry = readFileSync(resolve(root, 'App.tsx'), 'utf8');
assert.doesNotMatch(entry, /from ['"].*(sentry|store|src\/app)/i);
assert.match(entry, /src\/messenger/, 'Default entry must use the consolidated messenger');
const launcher = readFileSync(resolve(root, 'src/messenger.tsx'), 'utf8');
assert.match(launcher, /from ['"]\.\/dziri\/app['"]/);
assert.match(launcher, /from ['"]\.\/inbox\/app['"]/);
assert.doesNotMatch(launcher, /EntryScreen|setView/, 'Separate entry modes must not return');
const personal = readFileSync(resolve(root, 'src/dziri/app.tsx'), 'utf8');
assert.match(personal, /dziriApi\.capabilities/, 'Business tabs require authenticated server eligibility');
assert.match(personal, /activeMessengerTab/, 'Revocation must fall back to Friends');
for (const file of readdirSync(resolve(root, 'src/dziri'), { recursive: true }).filter(name =>
  /\.tsx?$/.test(String(name)),
)) {
  const consumer = readFileSync(resolve(root, 'src/dziri', String(file)), 'utf8');
  for (const imported of consumer.matchAll(/\bfrom ['"]([^'"]+)['"]/g)) {
    const target = imported[1].startsWith('.')
      ? resolve(dirname(resolve(root, 'src/dziri', String(file))), imported[1])
      : imported[1].startsWith('@/')
        ? resolve(root, 'src', imported[1].slice(2))
        : null;
    if (!target) continue;
    for (const staffPath of ['src/inbox', 'src/store', 'src/services/APIService']) {
      const forbidden = resolve(root, staffPath);
      assert.ok(
        target !== forbidden && !target.startsWith(forbidden + sep),
        `Consumer must not import staff runtime: ${file} -> ${imported[1]}`,
      );
    }
  }
}
const appConfig = readFileSync(resolve(root, 'app.config.ts'), 'utf8');
assert.doesNotMatch(
  appConfig,
  /com\.chatwoot\.app|chatwootapp|app\.chatwoot\.com|owner:\s*['"]chatwoot/,
);

const index = process.argv.indexOf('--inbox-root');
if (index !== -1) {
  assert.ok(process.argv[index + 1], '--inbox-root requires a path');
  const inbox = JSON.parse(
    readFileSync(resolve(process.argv[index + 1], 'config/dziri-theme.json'), 'utf8'),
  );
  const mobile = JSON.parse(readFileSync(resolve(root, 'config/dziri-theme.json'), 'utf8'));
  assert.deepEqual(mobile, inbox, 'Dziri Inbox and mobile theme snapshots have diverged');
}
console.log(
  'Dziri consistency passed: ring assets, upstream layouts/fonts, isolated customer/team runtimes' +
    (index === -1 ? '' : ', shared Inbox theme'),
);
