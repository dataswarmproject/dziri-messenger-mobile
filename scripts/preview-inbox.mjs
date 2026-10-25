import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import httpProxy from 'http-proxy';

// Same-origin local preview only. Native builds connect directly over HTTPS.
const root = fileURLToPath(new URL('../dist-inbox/', import.meta.url));
const target = new URL(process.env.DZIRI_INBOX_PREVIEW_ORIGIN ?? 'http://localhost:3901');
if (
  !['https:', 'http:'].includes(target.protocol) ||
  target.username ||
  target.password ||
  target.pathname !== '/' ||
  target.search ||
  target.hash
)
  throw new Error('Expected Inbox origin');
if (target.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname))
  throw new Error('HTTP preview is restricted to loopback Inbox');
const proxy = httpProxy.createProxyServer({ target: target.origin, changeOrigin: true, ws: true });
proxy.on('proxyReq', request => request.removeHeader('cookie'));
proxy.on('proxyRes', response => {
  delete response.headers['set-cookie'];
});
proxy.on('error', (_error, _request, response) => {
  if (response.writeHead) {
    response.writeHead(502);
    response.end('Local Inbox is unavailable');
  } else response.destroy();
});
const types = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
};
const server = http.createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname;
  if (path === '/runtime-config.json') {
    response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify({ inboxUrl: target.origin }));
    return;
  }
  if (/^\/inbox-api\/(auth\/|api\/v1\/)/.test(path)) {
    request.url = request.url.replace(/^\/inbox-api/, '');
    proxy.web(request, response);
    return;
  }
  try {
    const filename = resolve(root, `.${decodeURIComponent(path === '/' ? '/index.html' : path)}`);
    if (
      !filename.startsWith(root.endsWith(sep) ? root : root + sep) ||
      !(await stat(filename)).isFile()
    )
      throw new Error('Missing');
    response.writeHead(200, {
      'Content-Type': types[extname(filename)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    response.end(await readFile(filename));
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
});
server.on('upgrade', (request, socket, head) => {
  if (new URL(request.url, 'http://localhost').pathname !== '/cable') return socket.destroy();
  proxy.ws(request, socket, head);
});
server.listen(3904, '127.0.0.1', () =>
  console.log(`Dziri mobile preview http://localhost:3904 → ${target.origin}`),
);
