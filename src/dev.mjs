// Development server: builds the site, serves dist/, and rebuilds when the
// content or the generator changes. The browser reloads after each build.
//
//   node src/dev.mjs [--fixtures] [--port 4173]

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from './build.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const args = process.argv.slice(2);
const fixtures = args.includes('--fixtures');
const portArg = args.indexOf('--port');
const firstPort = Number(portArg !== -1 ? args[portArg + 1] : process.env.PORT) || 4173;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

const clients = new Set();

async function rebuild(reason) {
  try {
    await build({ fixtures, dev: true });
    for (const res of clients) res.write('data: reload\n\n');
  } catch (error) {
    console.error(`Build failed${reason ? ` (${reason})` : ''}: ${error.stack || error.message}`);
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/__reload') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write('retry: 500\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith('/')) pathname += 'index.html';
  let file = path.join(DIST, pathname);
  if (!file.startsWith(DIST)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  if (!fs.existsSync(file) && fs.existsSync(`${file}.html`)) file = `${file}.html`;
  fs.readFile(file, (error, data) => {
    if (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
});

function listen(port, attemptsLeft) {
  server.once('error', (error) => {
    if (error.code === 'EADDRINUSE' && attemptsLeft > 0) listen(port + 1, attemptsLeft - 1);
    else throw error;
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`Serving dist/ at http://localhost:${port}${fixtures ? ' (with fixtures)' : ''}`);
    console.log('Watching content/ and src/ for changes. Press Ctrl+C to stop.');
  });
}

await rebuild('first build');
listen(firstPort, 20);

let timer = null;
let running = false;
let again = false;
function schedule(file) {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    if (running) {
      again = true;
      return;
    }
    running = true;
    console.log(`Changed: ${file}`);
    await rebuild(file);
    running = false;
    if (again) {
      again = false;
      schedule(file);
    }
  }, 150);
}

for (const dir of ['content', 'src']) {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) continue;
  fs.watch(full, { recursive: true }, (event, filename) => {
    if (!filename || filename.endsWith('.DS_Store')) return;
    if (dir === 'src' && filename.endsWith('.mjs')) {
      console.log(`Changed: src/${filename}. Restart "npm run dev" to use the new generator code.`);
      return;
    }
    schedule(`${dir}/${filename}`);
  });
}
