import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// Run the existing backend's isolated regression tests without installing into,
// editing, deploying, or seeding that checkout. No live users or network calls.
const mobile = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (!process.argv[2])
  throw new Error('Usage: node scripts/verify-dziri-backend.mjs <Dziri source root>');
const backend = resolve(process.argv[2]);
const runner = resolve(backend, 'node_modules/vitest/vitest.mjs');
const authServer = resolve(mobile, 'node_modules/@convex-dev/auth/dist/server/index.js');
for (const path of [
  runner,
  authServer,
  resolve(backend, 'tests/activation/thread-header.test.ts'),
]) {
  if (!existsSync(path)) throw new Error(`Required local dependency or test not found: ${path}`);
}
mkdirSync(resolve(mobile, '.codex'), { recursive: true });
const configPath = resolve(mobile, '.codex/backend.vitest.config.mjs');
writeFileSync(
  configPath,
  `export default ${JSON.stringify(
    {
      root: backend,
      resolve: { alias: [{ find: '@convex-dev/auth/server', replacement: authServer }] },
      test: {
        environment: 'edge-runtime',
        include: ['tests/activation/thread-header.test.ts'],
        setupFiles: ['tests/setup.ts'],
        server: { deps: { inline: ['convex-test'] } },
        pool: 'forks',
        poolOptions: {
          forks: {
            execArgv:
              Number(process.versions.node.split('.')[0]) >= 25
                ? ['--no-experimental-webstorage']
                : [],
          },
        },
      },
    },
    null,
    2,
  )};\n`,
);
const result = spawnSync(process.execPath, [runner, 'run', '--config', configPath], {
  cwd: backend,
  stdio: 'inherit',
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
