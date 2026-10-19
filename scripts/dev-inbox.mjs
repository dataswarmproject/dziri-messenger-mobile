import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const watcher = existsSync(new URL('../../dziri-inbox/config/dziri-theme.json', import.meta.url))
  ? spawn(
      process.execPath,
      [fileURLToPath(new URL('./sync-inbox.mjs', import.meta.url)), '--watch'],
      { stdio: 'inherit' },
    )
  : null;
const expo = spawn(
  process.execPath,
  [require.resolve('expo/bin/cli'), 'start', ...process.argv.slice(2)],
  { stdio: 'inherit' },
);
function stop() {
  watcher?.kill();
  expo.kill();
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
watcher?.on('exit', code => {
  if (code) expo.kill();
});
expo.on('exit', code => {
  watcher?.kill();
  process.exitCode = code ?? 0;
});
