import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
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
assert.match(entry, /src\/inbox\/app/, 'Default entry must connect to Dziri Inbox');
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
  'Dziri consistency passed: ring assets, upstream layouts/fonts, Inbox companion identity' +
    (index === -1 ? '' : ', shared Inbox theme'),
);
