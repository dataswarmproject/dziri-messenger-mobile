import { readFileSync, writeFileSync, existsSync, watch } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const index = process.argv.indexOf('--inbox-root');
const inbox = resolve(index === -1 ? resolve(root, '../dziri-inbox') : process.argv[index + 1]);
const source = resolve(inbox, 'config/dziri-theme.json');
const target = resolve(root, 'config/dziri-theme.json');
function sync() {
  if (!existsSync(source)) {
    if (index !== -1 || process.argv.includes('--watch'))
      throw new Error(`Inbox theme source is missing: ${source}`);
    console.log('Using checked-in Inbox theme snapshot; sibling source is unavailable.');
    return;
  }
  const contents = readFileSync(source, 'utf8');
  const theme = JSON.parse(contents);
  if (!theme.primary || !theme.light || !theme.dark)
    throw new Error('Invalid Inbox theme contract');
  if (readFileSync(target, 'utf8') !== contents) writeFileSync(target, contents);
  console.log('Dziri Inbox theme synchronized.');
}
sync();
if (process.argv.includes('--watch')) {
  let pending;
  watch(dirname(source), (_event, filename) => {
    if (filename !== 'dziri-theme.json') return;
    clearTimeout(pending);
    pending = setTimeout(() => {
      try {
        sync();
      } catch (error) {
        console.error(error.message);
      }
    }, 120);
  });
}
