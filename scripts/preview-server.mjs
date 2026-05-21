import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const port = Number(process.env.PORT || 4173);
const root = normalize(join(process.cwd(), 'dist'));

const state = {
  version: 42,
  updatedAt: null,
  uploadIndex: {},
  tracklist: [],
  recordings: []
};

const types = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8']
]);

createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
  if (url.pathname === '/api/state') return sendJson(res, state);
  if (url.pathname === '/api/storage-report') return sendJson(res, { total: 0, badCount: 0, bad: [], looseRootCount: 0, looseRoot: [], duplicateFolderCount: 0, duplicateFolders: [] });
  if (url.pathname === '/api/objects') return sendJson(res, { objects: [] });
  if (url.pathname === '/api/object') {
    res.writeHead(204);
    return res.end();
  }
  const requested = url.pathname === '/' ? '/index.html' : url.pathname;
  const file = normalize(join(root, requested));
  if (!file.startsWith(root)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types.get(extname(file)) || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Preview server http://127.0.0.1:${port}`);
});

function sendJson(res, data) {
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}
