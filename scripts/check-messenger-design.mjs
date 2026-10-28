import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const snapshot = readFileSync(new URL('../config/messenger-design.json', import.meta.url));
const receipt = JSON.parse(
  readFileSync(new URL('../docs/messenger-design-contract.json', import.meta.url), 'utf8'),
);
if (createHash('sha256').update(snapshot).digest('hex') !== receipt.sha256) {
  throw new Error('Messenger design drift: sync from the canonical Dziri shared design source.');
}
console.log('Standalone Messenger design snapshot verified.');
