import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';
import { MAIN_DZIRI_CONVEX_URL, deploymentUrl } from '../src/dziri/config.ts';

// Anonymous, read-only contract check; never creates users or messages.
const url = deploymentUrl(process.env.EXPO_PUBLIC_CONVEX_URL ?? MAIN_DZIRI_CONVEX_URL, false);
if (!url) throw new Error('Invalid Dziri backend origin');
const client = new ConvexHttpClient(url, {
  logger: false,
  fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) }),
});
const queries = [
  ['users:getMe', {}, null],
  ['messaging/messenger:capabilities', {}, null],
  ['messaging/messenger:listThreads', { lane: 'friends' }, []],
  ['messaging/messenger:listThreads', { lane: 'staff' }, []],
  ['messaging/messenger:listCommerce', { lane: 'friends' }, []],
  ['messaging/messenger:listCommerce', { lane: 'customers' }, []],
];
let failed = false;
for (const [name, args, expected] of queries) {
  try {
    const result = await client.query(makeFunctionReference(name), args);
    if (JSON.stringify(result) !== JSON.stringify(expected)) throw new Error('Unexpected anonymous response');
    console.log(`PASS ${name} ${JSON.stringify(args)}`);
  } catch {
    failed = true;
    console.error(`FAIL ${name} ${JSON.stringify(args)}`);
  }
}
console.log(`Backend: ${url}`);
if (failed) process.exitCode = 1;
