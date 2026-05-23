const STATE_KEY = 'vault/state.json';

const ROOT_CONTAINERS = new Set(['songs', 'song', 'superstar', 'vault', 'music', 'exports', 'official', 'recordings', 'library']);
const OFFICIAL_MARKERS = new Set(['official', 'songs', 'song', 'recordings']);
const DEMO_MARKERS = new Set(['demo', 'demos', '[demo]', '_demo']);
const BEATS_MARKERS = new Set(['beat', 'beats', 'instrumental', 'instrumentals']);
const ATTACHMENT_FOLDERS = /(stem|stemms|beat|beats|instrumental|instrumentals|visual|visuals|media|clutter|trackout|photoshot|photo|art|cover|covers|projects|resources|__macosx)/i;
const AUDIO_RE = /\.(wav|mp3|m4a|aac|flac|ogg|aif|aiff)$/i;
const VISUAL_RE = /\.(jpg|jpeg|jfif|png|webp|gif|psd|mp4|mov)$/i;
const PROJECT_RE = /\.(flp|aup3|zip|pdf)$/i;
const STEM_RE = /(\[bass\]|\[drums\]|\[music\]|\[vocals\]|\(bass\)|\(drums\)|\(other\)|\(vocals\)|\bbass\b|\bdrums\b|\bvocals\b|\bother\b|\bharp\b|\bsynth\b|\bpads?\b|\bkick\b|\bclaps?\b|\bcrash\b|\bfx\b|\bhats?\b|\bpluck\b|\bshaker\b|\bsnap\b|\bsnare\b|\bsub bass\b|audio track-?\d+)/i;
const BEAT_RE = /(beat|instrumental|type beat|prod\.?|\[music\])/i;
const BAD_MAIN_RE = /(old bad mix|non used|reference|refrence|stems?|\[bass\]|\[drums\]|\[vocals\]|\(bass\)|\(drums\)|\(vocals\)|audio track)/i;
const ENTITY_SUFFIX_RE = /\s+(cluttr|clutter|stems?|stemms|beat|beats|instrumental|instrumentals|trackout|visuals?|media|photos?hoot files?|covers?|art|resources?)$/i;
const COLLECTION_RESOURCE_FOLDER_RE = /^(superstar\s*)?(media|visuals?|cluttr|clutter|photos?hoot files?|covers?|art|resources?)$/i;
function decodeName(name) {
  try { return decodeURIComponent(name || ''); }
  catch { return String(name || ''); }
}
function cleanName(name) { return decodeName(name).replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function cleanEntityName(name) { let out = cleanName(name); for (let i = 0; i < 3; i++) out = out.replace(ENTITY_SUFFIX_RE, '').trim(); return out || cleanName(name); }
function splitPath(path) { return String(path || '').replace(/\\/g, '/').split('/').filter(Boolean); }
function sectionMarker(part) {
  const l = String(part || '').toLowerCase();
  if (DEMO_MARKERS.has(l)) return 'demos';
  if (BEATS_MARKERS.has(l)) return 'beats';
  if (OFFICIAL_MARKERS.has(l)) return 'official';
  return null;
}
function isContainer(part) {
  const l = String(part || '').toLowerCase();
  return ROOT_CONTAINERS.has(l) || DEMO_MARKERS.has(l) || OFFICIAL_MARKERS.has(l) || BEATS_MARKERS.has(l);
}
function classifyPath(path, fileMeta = {}) {
  const parts = splitPath(path);
  const filename = parts[parts.length - 1] || path;
  const isAudio = AUDIO_RE.test(filename);
  const isVisual = VISUAL_RE.test(filename);
  const isProject = PROJECT_RE.test(filename);
  let section = 'official';
  let start = 0;
  while (start < parts.length - 1 && isContainer(parts[start])) {
    const marker = sectionMarker(parts[start]);
    if (marker) section = marker;
    start++;
  }
  for (let i = 0; i < start; i++) {
    const marker = sectionMarker(parts[i]);
    if (marker) section = marker;
  }
  const entityFolder = parts[start] && parts.length - start > 1 ? parts[start] : cleanName(filename);
  const albumLevelResource = start > 0 && COLLECTION_RESOURCE_FOLDER_RE.test(cleanName(entityFolder));
  const entityName = cleanEntityName(entityFolder);
  const afterEntity = parts.slice(start + 1, -1);
  if (afterEntity.some(p => DEMO_MARKERS.has(p.toLowerCase()))) section = 'demos';
  if (afterEntity.some(p => BEATS_MARKERS.has(p.toLowerCase())) && !isAudio) section = 'beats';
  if (['official', 'demos', 'beats'].includes(fileMeta.forceSection)) section = fileMeta.forceSection;
  const nested = afterEntity.length > 0;
  const attachmentFolder = afterEntity.some(p => ATTACHMENT_FOLDERS.test(p));
  const beat = BEAT_RE.test(filename) || afterEntity.some(p => /beat|beats|instrumental|instrumentals|trackout/i.test(p));
  const stem = STEM_RE.test(filename) || afterEntity.some(p => /stem|stemms|trackout/i.test(p));
  const visual = isVisual || afterEntity.some(p => /visual|visuals|media|clutter|photo|cover|art/i.test(p));
  const project = isProject || afterEntity.some(p => /project|projects/i.test(p));
  let role = 'resource';
  if (isAudio && stem) role = 'stem';
  else if (isAudio && beat) role = 'instrumental';
  else if (isAudio) role = section === 'beats' ? 'instrumental' : 'recording';
  else if (visual) role = 'visual';
  else if (project) role = 'project';
  const directNormalRecording = isAudio && role === 'recording' && !nested && !attachmentFolder && !BAD_MAIN_RE.test(filename);
  return { entityName, section, filename, role, directNormalRecording, nested, skip: albumLevelResource, path, size: fileMeta.size || 0, lastModified: fileMeta.lastModified || 0 };
}
function canonicalKeyForPath(path, fileMeta = {}) {
  const c = classifyPath(path, fileMeta);
  if (c.skip) return '';
  const filename = c.filename.replace(/[\\/]+/g, ' ').trim();
  const entity = c.entityName.replace(/[\\/]+/g, ' ').trim() || 'Untitled';
  const sectionDir = c.section === 'demos' ? 'Demos' : c.section === 'beats' ? 'Beats' : 'Official';
  let sub = '';
  if (c.role === 'instrumental') sub = 'Instrumental/';
  else if (c.role === 'stem') sub = 'Stems/';
  else if (c.role === 'visual') sub = 'Visuals/';
  else if (c.role === 'project') sub = 'Projects/';
  else if (c.role === 'resource') sub = 'Resources/';
  return `${sectionDir}/${entity}/${sub}${filename}`;
}


function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
}
function text(data, status = 200) { return new Response(data, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } }); }
function authorized(req, env) {
  const required = env.ADMIN_TOKEN;
  if (!required) return true;
  const url = new URL(req.url);
  const got = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const queryToken = url.searchParams.get('token') || '';
  return got === required || queryToken === required;
}
function safeKey(key) { return String(key || '').replace(/^\/+/, '').replace(/\.\.(\/|\\)/g, ''); }
function parseTimestamp(value) {
  if (!value) return 0;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
async function repairExistingMetadata(bucket, key, existing, metadata) {
  if (!Number(metadata.lastModified) || String(existing.customMetadata?.lastModified || '') === String(metadata.lastModified)) return false;
  const source = await bucket.get(key);
  if (!source) return false;
  await bucket.put(key, source.body, {
    httpMetadata: source.httpMetadata,
    customMetadata: { ...(source.customMetadata || {}), ...metadata }
  });
  return true;
}
async function listAll(bucket) {
  const objects = [];
  let cursor;
  do {
    const res = await bucket.list({ cursor, limit: 1000, include: ['customMetadata', 'httpMetadata'] });
    for (const obj of res.objects) if (obj.key !== STATE_KEY) objects.push(obj);
    cursor = res.truncated ? res.cursor : undefined;
  } while (cursor);
  return objects;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    if (!authorized(req, env)) return text('Unauthorized', 401);
    try {
      if (url.pathname === '/api/state') {
        if (req.method === 'GET') {
          const obj = await env.VAULT_BUCKET.get(STATE_KEY);
          if (!obj) return json({ version: 35, recordings: [], tracklist: [], uploadIndex: {} });
          return new Response(obj.body, { headers: { 'content-type': 'application/json; charset=utf-8' } });
        }
        if (req.method === 'POST') {
          const body = await req.text();
          await env.VAULT_BUCKET.put(STATE_KEY, body, { httpMetadata: { contentType: 'application/json; charset=utf-8' } });
          return json({ ok: true });
        }
      }
      if (url.pathname === '/api/objects') {
        const objects = await listAll(env.VAULT_BUCKET);
        return json({ objects: objects.map(o => ({ key: o.key, size: o.size, uploaded: o.uploaded, etag: o.etag, customMetadata: o.customMetadata || {} })) });
      }
      if (url.pathname === '/api/upload' && req.method === 'POST') {
        const form = await req.formData();
        const file = form.get('file');
        if (!file || typeof file === 'string') return text('Missing file', 400);
        const rawKey = safeKey(form.get('key') || file.name);
        const rel = String(form.get('relativePath') || rawKey);
        const lastModified = Number(form.get('lastModified') || 0);
        const forceSection = String(form.get('destination') || '');
        const targetKey = safeKey(canonicalKeyForPath(rawKey, { size: file.size, lastModified, forceSection }));
        if (!targetKey) return json({ ok: true, skipped: true, rawKey, reason: 'collection-resource' });

        // Do not store folder uploads under their raw local container path. The bucket only stores
        // canonical music-vault paths: Official/<Song>/..., Demos/<Song>/..., Beats/<Name>/...
        const existing = await env.VAULT_BUCKET.head(targetKey);
        if (existing && existing.size === file.size) {
          const repaired = await repairExistingMetadata(env.VAULT_BUCKET, targetKey, existing, { lastModified: String(lastModified), relativePath: rel, originalKey: rawKey });
          return json({ ok: true, skipped: true, repaired, key: targetKey, rawKey, reason: repaired ? 'metadata-repaired' : 'same-size' });
        }
        await env.VAULT_BUCKET.put(targetKey, file.stream(), {
          httpMetadata: { contentType: file.type || 'application/octet-stream' },
          customMetadata: { lastModified: String(lastModified), relativePath: rel, originalKey: rawKey }
        });
        return json({ ok: true, key: targetKey, rawKey });
      }
      if (url.pathname === '/api/multipart/create' && req.method === 'POST') {
        const body = await req.json();
        const rawKey = safeKey(body.key || body.name || '');
        const rel = String(body.relativePath || rawKey);
        const size = Number(body.size || 0);
        const lastModified = Number(body.lastModified || 0);
        const forceSection = String(body.destination || '');
        const targetKey = safeKey(canonicalKeyForPath(rawKey, { size, lastModified, forceSection }));
        if (!targetKey) return json({ ok: true, skipped: true, rawKey, reason: 'collection-resource' });
        const existing = await env.VAULT_BUCKET.head(targetKey);
        if (existing && existing.size === size) {
          const repaired = await repairExistingMetadata(env.VAULT_BUCKET, targetKey, existing, { lastModified: String(lastModified), relativePath: rel, originalKey: rawKey });
          return json({ ok: true, skipped: true, repaired, key: targetKey, rawKey, reason: repaired ? 'metadata-repaired' : 'same-size' });
        }
        const upload = await env.VAULT_BUCKET.createMultipartUpload(targetKey, {
          httpMetadata: { contentType: body.type || 'application/octet-stream' },
          customMetadata: { lastModified: String(lastModified), relativePath: rel, originalKey: rawKey }
        });
        return json({ ok: true, key: targetKey, rawKey, uploadId: upload.uploadId });
      }
      if (url.pathname === '/api/multipart/part' && req.method === 'PUT') {
        const key = safeKey(url.searchParams.get('key'));
        const uploadId = String(url.searchParams.get('uploadId') || '');
        const partNumber = Number(url.searchParams.get('partNumber') || 0);
        if (!key || !uploadId || !partNumber) return text('Missing multipart fields', 400);
        const upload = env.VAULT_BUCKET.resumeMultipartUpload(key, uploadId);
        const part = await upload.uploadPart(partNumber, req.body);
        return json(part);
      }
      if (url.pathname === '/api/multipart/complete' && req.method === 'POST') {
        const body = await req.json();
        const key = safeKey(body.key);
        const uploadId = String(body.uploadId || '');
        if (!key || !uploadId || !Array.isArray(body.parts)) return text('Missing multipart completion fields', 400);
        const upload = env.VAULT_BUCKET.resumeMultipartUpload(key, uploadId);
        const object = await upload.complete(body.parts);
        return json({ ok: true, key: object.key, etag: object.httpEtag });
      }
      if (url.pathname === '/api/multipart/abort' && req.method === 'POST') {
        const body = await req.json();
        const key = safeKey(body.key);
        const uploadId = String(body.uploadId || '');
        if (key && uploadId) await env.VAULT_BUCKET.resumeMultipartUpload(key, uploadId).abort();
        return json({ ok: true });
      }
      if (url.pathname === '/api/object') {
        const key = safeKey(url.searchParams.get('key'));
        const obj = await env.VAULT_BUCKET.get(key, { range: req.headers });
        if (!obj) return text('Not found', 404);
        const headers = new Headers();
        obj.writeHttpMetadata(headers);
        headers.set('etag', obj.httpEtag);
        headers.set('accept-ranges', 'bytes');
        if (obj.range) headers.set('content-range', `bytes ${obj.range.offset}-${obj.range.offset + obj.range.length - 1}/${obj.size}`);
        return new Response(obj.body, { status: obj.range ? 206 : 200, headers });
      }
      if (url.pathname === '/api/storage-report') {
        const objects = await listAll(env.VAULT_BUCKET);
        const bad = [];
        const looseRoot = [];
        const topPrefixes = new Map();
        for (const obj of objects) {
          const target = safeKey(canonicalKeyForPath(obj.key, { size: obj.size, lastModified: parseTimestamp(obj.customMetadata?.lastModified) || parseTimestamp(obj.uploaded) }));
          const parts = obj.key.split('/').filter(Boolean);
          if (parts.length === 1 && AUDIO_RE.test(obj.key)) looseRoot.push({ key: obj.key, target, size: obj.size });
          if (parts[0] && parts[0] !== 'vault') {
            const lower = parts[0].toLowerCase();
            if (!topPrefixes.has(lower)) topPrefixes.set(lower, new Set());
            topPrefixes.get(lower).add(parts[0]);
          }
          if (target && target !== obj.key) bad.push({ key: obj.key, target, size: obj.size });
        }
        const duplicateFolders = [];
        for (const set of topPrefixes.values()) if (set.size > 1) duplicateFolders.push([...set].join(' / '));
        return json({ total: objects.length, badCount: bad.length, bad: bad.slice(0, 500), looseRootCount: looseRoot.length, looseRoot: looseRoot.slice(0, 200), duplicateFolderCount: duplicateFolders.length, duplicateFolders });
      }
      if (url.pathname === '/api/repair-storage' && req.method === 'POST') {
        const objects = await listAll(env.VAULT_BUCKET);
        let moved = 0, deleted = 0, skipped = 0, conflicts = 0;
        const operations = [];
        for (const obj of objects) {
          if (/ongoing multipart upload/i.test(obj.key)) { await env.VAULT_BUCKET.delete(obj.key); deleted++; operations.push({ type: 'deleted-failed-upload', from: obj.key }); continue; }
          const target = safeKey(canonicalKeyForPath(obj.key, { size: obj.size, lastModified: parseTimestamp(obj.customMetadata?.lastModified) || parseTimestamp(obj.uploaded) }));
          if (!target || target === obj.key || target === STATE_KEY) { skipped++; continue; }
          const existing = await env.VAULT_BUCKET.head(target);
          if (existing && existing.size === obj.size) {
            await env.VAULT_BUCKET.delete(obj.key);
            deleted++;
            operations.push({ type: 'deleted-duplicate', from: obj.key, to: target });
            continue;
          }
          if (existing && existing.size !== obj.size) {
            const parts = target.split('/');
            const name = parts.pop();
            const alt = safeKey(`${parts.join('/')}/Duplicates/${Date.now()}-${name}`);
            const source = await env.VAULT_BUCKET.get(obj.key);
            if (!source) continue;
            await env.VAULT_BUCKET.put(alt, source.body, { httpMetadata: source.httpMetadata, customMetadata: obj.customMetadata || {} });
            const check = await env.VAULT_BUCKET.head(alt);
            if (check && check.size === obj.size) { await env.VAULT_BUCKET.delete(obj.key); moved++; conflicts++; operations.push({ type: 'moved-conflict', from: obj.key, to: alt }); }
            continue;
          }
          const source = await env.VAULT_BUCKET.get(obj.key);
          if (!source) continue;
          await env.VAULT_BUCKET.put(target, source.body, { httpMetadata: source.httpMetadata, customMetadata: obj.customMetadata || {} });
          const check = await env.VAULT_BUCKET.head(target);
          if (check && check.size === obj.size) {
            await env.VAULT_BUCKET.delete(obj.key);
            moved++;
            operations.push({ type: 'moved', from: obj.key, to: target });
          }
        }
        return json({ ok: true, moved, deleted, skipped, conflicts, operations: operations.slice(0, 200) });
      }
      if (url.pathname === '/api/delete' && req.method === 'POST') {
        const { key } = await req.json();
        await env.VAULT_BUCKET.delete(safeKey(key));
        return json({ ok: true });
      }
      return text('Not found', 404);
    } catch (err) {
      return text(err?.stack || err?.message || String(err), 500);
    }
  }
};
