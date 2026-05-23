const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const STORAGE_KEY = 'vlt-token';
const MULTIPART_THRESHOLD = 10 * 1024 * 1024;
const MULTIPART_PART_SIZE = 8 * 1024 * 1024;
const UPLOAD_RETRIES = 3;
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

let token = localStorage.getItem(STORAGE_KEY) || '';
let state = defaultState();
let unlocked = false;
let view = 'home';
let selectedId = null;
let selectedAlbumId = null;
let drawerOpen = false;
let query = '';
let filterSection = 'all';
let filterStatus = 'all';
let sortMode = 'made-newest';
let importDestination = 'auto';
let uploadBusy = false;
let storageReport = null;
let playingId = null;
let pendingPlay = false;
let playerPosition = 0;
let playerMuted = false;
let playerVolume = 1;
let uploadStatus = { open: false, stage: 'idle', total: 0, done: 0, skipped: 0, failed: 0, current: '', errors: [] };

function defaultState() {
  return {
    version: 42,
    recordings: [],
    albums: [],
    tracklist: [],
    tracklistMeta: { title: 'New Tracklist', notes: '' },
    updatedAt: null,
    uploadIndex: {},
    durations: {}
  };
}

const api = async (path, options = {}) => {
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, { ...options, headers });
  if (!res.ok) {
    const body = await res.text();
    const clean = body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    throw new Error(`${res.status} ${res.statusText}${clean ? `: ${clean.slice(0, 220)}` : ''}`);
  }
  const type = res.headers.get('content-type') || '';
  return type.includes('application/json') ? res.json() : res.text();
};

function toast(text) {
  const el = $('.toast') || document.createElement('div');
  el.className = 'toast show';
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.classList.remove('show'), 2300);
}

function fmtBytes(n = 0) {
  if (!n) return '-';
  const units = ['B','KB','MB','GB'];
  let i = 0, v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function decodeName(name) {
  try { return decodeURIComponent(name || ''); }
  catch { return String(name || ''); }
}

function cleanName(name) {
  return decodeName(name)
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanEntityName(name) {
  let out = cleanName(name);
  for (let i = 0; i < 3; i++) out = out.replace(ENTITY_SUFFIX_RE, '').trim();
  return out || cleanName(name);
}

function normalizeId(text) {
  return cleanName(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'untitled';
}

function splitPath(path) {
  return String(path || '').replace(/\\/g, '/').split('/').filter(Boolean);
}

function parseTimestamp(value) {
  if (!value) return 0;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

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

  // Skip root containers such as SUPERSTAR, Songs, official, exports, etc.
  // If one of those containers declares a section, keep the section but never use it as the song title.
  while (start < parts.length - 1 && isContainer(parts[start])) {
    const marker = sectionMarker(parts[start]);
    if (marker) section = marker;
    start++;
  }

  // Only root containers can decide the section. Nested Instrumental/Beat folders attach to the song.
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

  // Direct file in the song folder can become the main display audio.
  // Nested folders and stems/beat/reference files never become the main display.
  const directNormalRecording = isAudio && role === 'recording' && !nested && !attachmentFolder && !BAD_MAIN_RE.test(filename);
  const id = `${section}:${normalizeId(entityName)}`;
  return { id, entityName, section, filename, role, directNormalRecording, nested, skip: albumLevelResource, path, size: fileMeta.size || 0, lastModified: fileMeta.lastModified || 0 };
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

function rebuildEntitiesFromObjects(objects) {
  const map = new Map();
  for (const obj of objects) {
    const c = classifyPath(obj.key, { size: obj.size, lastModified: parseTimestamp(obj.customMetadata?.lastModified) });
    if (!c.entityName || c.skip) continue;
    if (!map.has(c.id)) {
      map.set(c.id, {
        id: c.id,
        title: c.entityName,
        section: c.section,
        status: 'unsorted',
        project: '',
        mood: '',
        notes: '',
        mainKey: '',
        mainName: '',
        instrumentalKey: '',
        instrumentalName: '',
        size: 0,
        files: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    const rec = map.get(c.id);
    rec.files.push({ key: obj.key, name: c.filename, role: c.role, size: obj.size, lastModified: c.lastModified, section: c.section });
    rec.size += obj.size || 0;
    if (c.role === 'instrumental' && (!rec.instrumentalKey || c.lastModified > (rec.instrumentalModified || 0))) {
      rec.instrumentalKey = obj.key; rec.instrumentalName = c.filename; rec.instrumentalModified = c.lastModified;
    }
    if (c.directNormalRecording) {
      const current = rec.files.find(f => f.key === rec.mainKey);
      const score = mainAudioScore(c.entityName, c.filename);
      const currentScore = current ? mainAudioScore(c.entityName, current.name) : -1;
      if (!rec.mainKey || score > currentScore || (score === currentScore && c.lastModified >= (current?.lastModified || 0))) {
        rec.mainKey = obj.key; rec.mainName = c.filename;
      }
    }
  }
  for (const rec of map.values()) {
    if (!rec.mainKey) {
      const fallback = rec.files
        .filter(f => AUDIO_RE.test(f.name) && f.role === 'recording')
        .sort((a,b) => (b.lastModified || 0) - (a.lastModified || 0))[0]
        || rec.files.filter(f => AUDIO_RE.test(f.name)).sort((a,b) => (b.lastModified || 0) - (a.lastModified || 0))[0];
      if (fallback) { rec.mainKey = fallback.key; rec.mainName = fallback.name; }
    }
  }
  return Array.from(map.values()).sort((a,b) => a.title.localeCompare(b.title));
}

function mainAudioScore(entityName, filename) {
  const entity = cleanName(entityName).toLowerCase();
  const file = cleanName(filename).toLowerCase();
  let score = 0;
  if (file === entity) score += 100;
  else if (file.includes(entity) || entity.includes(file)) score += 60;
  if (/\b(master|final|official|extended|ext)\b/i.test(filename)) score += 12;
  if (/\b(part[_ -]?\d+|take|demo|rough|reference|refrence)\b/i.test(filename)) score -= 18;
  return score;
}

function mergeFreshIndex(newRecordings) {
  const oldById = new Map(state.recordings.map(r => [r.id, r]));
  return newRecordings.map(r => {
    const old = oldById.get(r.id);
    return old ? { ...r, customTitle: old.customTitle || '', status: old.status || r.status, project: old.project || r.project, mood: old.mood || r.mood, notes: old.notes || r.notes } : r;
  });
}


async function scanStorage() {
  try {
    storageReport = await api('/api/storage-report');
    render();
    return storageReport;
  } catch (err) {
    toast('Scan failed');
    console.error(err);
    return null;
  }
}

function storageNeedsCleanup() {
  return !!(storageReport && ((storageReport.badCount || 0) > 0 || (storageReport.duplicateFolderCount || 0) > 0 || (storageReport.looseRootCount || 0) > 0));
}

async function loadState() {
  try {
    const loaded = await api('/api/state');
    state = { ...defaultState(), ...loaded };
    state.albums = state.albums || [];
    state.durations = state.durations || {};
    state.uploadIndex = state.uploadIndex || {};
    try { storageReport = await api('/api/storage-report'); } catch {}
    return true;
  } catch (err) {
    state = defaultState();
    const message = String(err?.message || err || 'Could not open vault').slice(0, 220);
    if (/unauthorized/i.test(message)) {
      token = '';
      localStorage.removeItem(STORAGE_KEY);
    }
    uploadStatus = { open: true, stage: 'error', total: 0, done: 0, skipped: 0, failed: 0, current: '', errors: [`Could not open vault: ${message}`] };
    return false;
  }
}

async function saveState() {
  state.updatedAt = new Date().toISOString();
  await api('/api/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state) });
}

async function rebuildIndex() {
  toast('Syncing');
  try {
    const objects = await api('/api/objects');
    const rebuilt = rebuildEntitiesFromObjects(objects.objects || []);
    state.recordings = mergeFreshIndex(rebuilt);
    state.tracklist = state.tracklist.filter(t => state.recordings.some(r => r.id === t.id));
    cleanAlbumTracks();
    await saveState();
    render();
    toast('Synced');
  } catch (err) {
    uploadStatus = { open: true, stage: 'error', total: 0, done: 0, skipped: 0, failed: 0, current: '', errors: [`Sync failed: ${String(err?.message || err).slice(0, 220)}`] };
    render();
  }
}

function uploadPathForFile(file, rel, destination) {
  if (!destination || destination === 'auto') return rel;
  const filename = file.name || rel.split('/').pop() || 'Untitled';
  const section = destination === 'demos' ? 'Demos' : destination === 'beats' ? 'Beats' : 'Official';
  if (rel.includes('/')) return `${section}/${rel}`;
  return `${section}/${filename}`;
}

async function uploadFiles(files, destination = 'auto') {
  const incoming = Array.from(files || []).filter(file => {
    const rel = file.webkitRelativePath || file.name || '';
    if (!rel || /(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db)$/i.test(rel)) return false;
    return AUDIO_RE.test(file.name) || VISUAL_RE.test(file.name) || PROJECT_RE.test(file.name);
  });

  if (!incoming.length) {
    uploadStatus = { open: true, stage: 'error', total: 0, done: 0, skipped: 0, failed: 0, current: '', errors: ['No supported audio/project/visual files were found in that folder.'] };
    render();
    return;
  }
  if (uploadBusy) {
    uploadStatus.open = true;
    uploadStatus.errors.push('Upload already in progress.');
    render();
    return;
  }

  uploadBusy = true;
  uploadStatus = { open: true, stage: 'uploading', total: incoming.length, done: 0, skipped: 0, failed: 0, current: '', errors: [] };
  render();

  const uploaded = [];
  for (const file of incoming) {
    const rel = file.webkitRelativePath || file.name;
    const rawKey = uploadPathForFile(file, rel.replace(/^\/+/, ''), destination);
    const forceSection = destination === 'auto' ? '' : destination;
    const key = canonicalKeyForPath(rawKey, { size: file.size, lastModified: file.lastModified || 0, forceSection });
    if (!key) {
      uploadStatus.skipped += 1;
      uploadStatus.done += 1;
      render();
      continue;
    }
    const sig = `${key}|${file.size}|${file.lastModified || 0}`;
    uploadStatus.current = rawKey;

    try {
      const result = file.size >= MULTIPART_THRESHOLD
        ? await uploadLargeFile(file, rawKey, rel, forceSection)
        : await uploadSmallFile(file, rawKey, rel, forceSection);
      state.uploadIndex[sig] = true;
      if (result.skipped) uploadStatus.skipped += 1;
      uploaded.push({ key: result.key || key, size: file.size, customMetadata: { lastModified: new Date(file.lastModified || Date.now()).toISOString() } });
    } catch (err) {
      uploadStatus.failed += 1;
      const msg = String(err?.message || err || 'Upload failed');
      uploadStatus.errors.push(`${rawKey}: ${msg.slice(0, 220)}`);
      console.error('upload failed', rawKey, err);
    }

    uploadStatus.done += 1;
    render();
  }

  uploadStatus.stage = uploadStatus.failed ? 'partial' : 'done';
  uploadStatus.current = '';
  uploadBusy = false;

  try {
    const objects = await api('/api/objects');
    const rebuilt = rebuildEntitiesFromObjects(objects.objects || uploaded);
    state.recordings = mergeFreshIndex(rebuilt);
    cleanAlbumTracks();
    await saveState();
    uploadStatus.stage = uploadStatus.failed ? 'partial' : 'indexed';
    render();
    toast(uploadStatus.failed ? 'Upload finished with errors' : 'Folder uploaded');
  } catch (err) {
    uploadStatus.stage = 'error';
    uploadStatus.errors.push(`Index rebuild failed: ${String(err?.message || err).slice(0, 220)}`);
    render();
    console.error(err);
  }
}

function cleanAlbumTracks() {
  const valid = new Set(state.recordings.map(r => r.id));
  state.albums = (state.albums || []).map(album => ({
    ...album,
    trackIds: (album.trackIds || []).filter(id => valid.has(id))
  }));
}

async function uploadSmallFile(file, rawKey, rel, forceSection = '') {
  const fd = new FormData();
  fd.set('file', file);
  fd.set('key', rawKey);
  fd.set('lastModified', String(file.lastModified || 0));
  fd.set('relativePath', rel);
  fd.set('destination', forceSection);
  return api('/api/upload', { method: 'POST', body: fd });
}

async function uploadLargeFile(file, rawKey, rel, forceSection = '') {
  const created = await api('/api/multipart/create', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      key: rawKey,
      relativePath: rel,
      size: file.size,
      type: file.type || 'application/octet-stream',
      lastModified: file.lastModified || 0,
      destination: forceSection
    })
  });
  if (created.skipped) return created;

  const parts = [];
  const partCount = Math.ceil(file.size / MULTIPART_PART_SIZE);
  try {
    for (let i = 0; i < partCount; i++) {
      const partNumber = i + 1;
      const start = i * MULTIPART_PART_SIZE;
      const end = Math.min(file.size, start + MULTIPART_PART_SIZE);
      uploadStatus.current = `${rawKey} / part ${partNumber} of ${partCount}`;
      render();
      const part = await withUploadRetry(() => api(`/api/multipart/part?key=${encodeURIComponent(created.key)}&uploadId=${encodeURIComponent(created.uploadId)}&partNumber=${partNumber}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/octet-stream' },
        body: file.slice(start, end)
      }));
      parts.push(part);
    }
    return withUploadRetry(() => api('/api/multipart/complete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: created.key, uploadId: created.uploadId, parts })
    }));
  } catch (err) {
    try {
      await api('/api/multipart/abort', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: created.key, uploadId: created.uploadId })
      });
    } catch {}
    throw err;
  }
}

async function withUploadRetry(fn) {
  let last;
  for (let attempt = 1; attempt <= UPLOAD_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (attempt === UPLOAD_RETRIES) break;
      await new Promise(resolve => setTimeout(resolve, 600 * attempt));
    }
  }
  throw last;
}

function filteredRecordings() {
  return state.recordings.filter(r => {
    const q = query.trim().toLowerCase();
    const matchesQ = !q || [displayTitle(r), r.title, r.project, r.mood, r.status, r.mainName].join(' ').toLowerCase().includes(q);
    const matchesS = filterSection === 'all'
      || (filterSection === 'official' ? r.section === 'official' && !isReleaseTrack(r)
        : filterSection === 'releases' ? isReleaseTrack(r)
        : r.section === filterSection);
    const matchesStatus = filterStatus === 'all' || (r.status || 'unsorted') === filterStatus;
    return matchesQ && matchesS && matchesStatus;
  });
}

function searchAndStatusRecordings() {
  return state.recordings.filter(r => {
    const q = query.trim().toLowerCase();
    const matchesQ = !q || [displayTitle(r), r.title, r.project, r.mood, r.status, r.mainName].join(' ').toLowerCase().includes(q);
    const matchesStatus = filterStatus === 'all' || (r.status || 'unsorted') === filterStatus;
    return matchesQ && matchesStatus;
  });
}

function counts() {
  const audioBytes = state.recordings.reduce((sum, r) => sum + (r.size || 0), 0);
  const releaseRecs = state.recordings.filter(isReleaseTrack);
  const officialRecs = state.recordings.filter(r => r.section === 'official' && !isReleaseTrack(r));
  const official = officialRecs.length;
  const releases = releaseRecs.length;
  const demos = state.recordings.filter(r => r.section === 'demos').length;
  const beats = state.recordings.filter(r => r.section === 'beats').length;
  const libraryRecs = state.recordings.filter(r => r.section !== 'beats' && r.section !== 'demos');
  const pairable = libraryRecs;
  const demoRecs = state.recordings.filter(r => r.section === 'demos');
  const paired = pairable.filter(r => r.instrumentalKey).length;
  return {
    all: libraryRecs.length,
    official,
    releases,
    demos,
    beats,
    albums: state.albums?.length || 0,
    paired,
    pairable: pairable.length,
    unpaired: pairable.filter(r => !r.instrumentalKey).length,
    audioNeeded: pairable.filter(r => !r.mainKey).length,
    officialAudioNeeded: officialRecs.filter(r => !r.mainKey).length,
    demoAudioNeeded: demoRecs.filter(r => !r.mainKey).length,
    officialUnpaired: officialRecs.filter(r => !r.instrumentalKey).length,
    demoUnpaired: demoRecs.filter(r => !r.instrumentalKey).length,
    tracklist: state.tracklist.length,
    bytes: audioBytes
  };
}

function setView(v) {
  view = v;
  drawerOpen = false;
  if (v !== 'albums') selectedAlbumId = null;
  render();
  if (v === 'storage' && !storageReport) scanStorage();
}
function workspaceScroll() {
  const ws = $('.workspace');
  return ws ? { top: ws.scrollTop, left: ws.scrollLeft } : null;
}
function restoreWorkspaceScroll(pos) {
  if (!pos) return;
  requestAnimationFrame(() => {
    const ws = $('.workspace');
    if (ws) { ws.scrollTop = pos.top; ws.scrollLeft = pos.left; }
  });
}
function renderKeepScroll() {
  const pos = workspaceScroll();
  render();
  restoreWorkspaceScroll(pos);
}
function renderKeepInput(selector, start = null, end = null) {
  renderKeepScroll();
  requestAnimationFrame(() => {
    const input = $(selector);
    if (!input) return;
    input.focus();
    if (Number.isInteger(start) && input.setSelectionRange) input.setSelectionRange(start, Number.isInteger(end) ? end : start);
  });
}
function selectRecording(id, open = false) { selectedId = id; drawerOpen = open; renderKeepScroll(); }
function selected() { return state.recordings.find(r => r.id === selectedId) || null; }
function objectUrl(key) {
  if (!key) return '';
  const qs = new URLSearchParams({ key });
  if (token) qs.set('token', token);
  return `/api/object?${qs.toString()}`;
}
function displayTitle(r) { return String(r?.customTitle || r?.title || 'Untitled').trim() || 'Untitled'; }
function albumTitle(album) { return String(album?.title || 'Untitled Album').trim() || 'Untitled Album'; }
function sectionLabel(section) {
  return section === 'releases' ? 'Releases' : section === 'official' ? 'Demos' : section === 'demos' ? 'Scraps' : section === 'beats' ? 'Instrumental' : 'Music';
}
function countLabel(section, n) {
  if (section === 'releases') return `${n} releases`;
  if (section === 'official') return `${n} demos`;
  if (section === 'demos') return `${n} scraps`;
  if (section === 'beats') return `${n} standalone`;
  return `${n} in vault`;
}
function roleLabel(role) {
  return role === 'instrumental' ? 'Instrumental' : role === 'stem' ? 'Stems' : role === 'visual' ? 'Visuals' : role === 'recording' ? 'Main' : role === 'project' ? 'Project' : 'Other';
}

function dateLabel(value) {
  const time = typeof value === 'number' ? value : Date.parse(value || '');
  if (!time) return '-';
  return new Date(time).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function monthLabel(value) {
  const time = typeof value === 'number' ? value : Date.parse(value || '');
  if (!time) return 'No date';
  return new Date(time).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function durationLabel(seconds) {
  const n = Number(seconds || 0);
  if (!Number.isFinite(n) || n <= 0) return '--:--';
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const s = Math.floor(n % 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

function durationSeconds(label) {
  const parts = String(label || '').split(':').map(Number);
  if (parts.some(n => !Number.isFinite(n))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

function mainFile(r) {
  return (r.files || []).find(f => f.key === r.mainKey) || null;
}

function mainProjectFile(r) {
  const title = cleanName(r.title).toLowerCase();
  const projects = (r.files || []).filter(f => f.role === 'project' && /\.(flp|aup3)$/i.test(f.name));
  if (!projects.length) return null;
  const score = f => {
    const name = cleanName(f.name).toLowerCase();
    let n = 0;
    if (name === title) n += 100;
    else if (name.includes(title) || title.includes(name)) n += 60;
    if (/(\bold\b|bad mix|backup|copy|autosave)/i.test(f.name)) n -= 30;
    return n;
  };
  return projects
    .map(f => ({ file: f, score: score(f) }))
    .sort((a, b) => b.score - a.score || Number(b.file.lastModified || 0) - Number(a.file.lastModified || 0))[0]?.file || null;
}

function coverFile(r) {
  const visuals = (r.files || []).filter(f => f.role === 'visual' && /\.(jpg|jpeg|jfif|png|webp|gif)$/i.test(f.name));
  if (!visuals.length) return null;
  const title = cleanName(r.title).toLowerCase();
  const titleTokens = title.split(/\s+/).filter(Boolean);
  const score = f => {
    const name = cleanName(f.name).toLowerCase();
    const raw = f.name.toLowerCase();
    let n = 0;
    const titleMatch = name === title || name.includes(title) || titleTokens.every(t => name.includes(t));
    if (titleMatch) n += 70;
    if (new RegExp(`${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+(official\\s+)?cover`).test(name)) n += 90;
    if (new RegExp(`${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+(single\\s+)?art`).test(name)) n += 85;
    if (/\bofficial\s+cover\b|\bcover\b|\bsingle\s+art\b|\bartwork\b|\bart\b/i.test(f.name)) n += 45;
    if (/\b(screenshot|screen shot|frame|still|visual|video|mov|mp4|psd|clutter|photo)\b/i.test(raw)) n -= 45;
    return n;
  };
  const ranked = visuals
    .map(f => ({ file: f, score: score(f) }))
    .filter(x => x.score >= 85)
    .sort((a, b) => b.score - a.score || (b.file.lastModified || 0) - (a.file.lastModified || 0));
  return ranked[0]?.file || null;
}

function albumById(id) {
  return (state.albums || []).find(a => a.id === id) || null;
}

function albumTracks(album) {
  const ids = new Set(album?.trackIds || []);
  return state.recordings.filter(r => ids.has(r.id));
}

function isReleaseTrack(r) {
  return r?.section === 'official' && albumMembershipCount(r.id) > 0;
}

function albumCoverKey(album) {
  if (album?.coverKey) return album.coverKey;
  const firstWithCover = albumTracks(album).map(coverFile).find(Boolean);
  return firstWithCover?.key || '';
}

function imageVisualOptions() {
  return state.recordings
    .flatMap(r => (r.files || [])
      .filter(f => f.role === 'visual' && /\.(jpg|jpeg|jfif|png|webp|gif)$/i.test(f.name))
      .map(f => ({ key: f.key, label: `${displayTitle(r)} - ${f.name}` })))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }));
}

function albumMembershipCount(id) {
  return (state.albums || []).filter(a => (a.trackIds || []).includes(id)).length;
}

function albumMembershipTitles(id) {
  return (state.albums || [])
    .filter(a => (a.trackIds || []).includes(id))
    .map(albumTitle);
}

function tracklistRecordings() {
  return state.tracklist.map(t => state.recordings.find(r => r.id === t.id)).filter(Boolean);
}

function tracklistTotalDuration(recs = tracklistRecordings()) {
  return recs.reduce((sum, r) => sum + durationSeconds(r.mainKey ? durationLabel(state.durations?.[r.mainKey]) : ''), 0);
}

function madeTime(r) {
  const mainModified = Number(mainFile(r)?.lastModified || 0);
  if (mainModified) return mainModified;

  const projectModified = Number(mainProjectFile(r)?.lastModified || 0);
  if (projectModified) return projectModified;

  const files = r.files || [];
  const audioFallbacks = files
    .filter(f => AUDIO_RE.test(f.name) && ['recording', 'instrumental', 'stem'].includes(f.role))
    .map(f => Number(f.lastModified || 0))
    .filter(Boolean);
  if (audioFallbacks.length) return Math.max(...audioFallbacks);

  const projectFallbacks = files
    .filter(f => f.role === 'project')
    .map(f => Number(f.lastModified || 0))
    .filter(Boolean);
  return projectFallbacks.length ? Math.max(...projectFallbacks) : 0;
}

function updatedTime(r) {
  const fileTimes = (r.files || []).map(f => Number(f.lastModified || 0)).filter(Boolean);
  const stateTime = Date.parse(r.updatedAt || r.createdAt || '') || 0;
  return Math.max(stateTime, ...fileTimes, 0);
}

function fileCounts(r) {
  const files = r.files || [];
  return {
    versions: files.filter(f => f.role === 'recording').length,
    stems: files.filter(f => f.role === 'stem').length,
    visuals: files.filter(f => f.role === 'visual').length,
    projects: files.filter(f => f.role === 'project').length,
    instrumental: files.filter(f => f.role === 'instrumental').length
  };
}

function row(r) {
  const counts = fileCounts(r);
  const main = mainFile(r);
  const duration = r.mainKey ? durationLabel(state.durations?.[r.mainKey]) : '--:--';
  const date = dateLabel(madeTime(r));
  const albumNames = albumMembershipTitles(r.id);
  const stars = albumNames.length;
  return `<div class="record-row ${selectedId === r.id ? 'selected' : ''} ${r.mainKey ? '' : 'audio-needed'}" data-select="${r.id}">
    <button class="play-row ${playingId === r.id ? 'active' : ''}" data-play="${r.id}" aria-label="${playingId === r.id ? 'Pause' : 'Play'}" ${r.mainKey ? '' : 'disabled'}><span>${playingId === r.id ? 'Pause' : 'Play'}</span></button>
    <div class="title"><b>${esc(displayTitle(r))}</b>${stars ? `<span class="album-stars" aria-label="${stars} album${stars === 1 ? '' : 's'}">${albumNames.map(name => `<span title="${esc(name)}" aria-label="${esc(name)}">★</span>`).join('')}</span>` : ''}</div>
    <div class="row-meta"><span>${esc(duration)}</span><span>${esc(date)}</span></div>
    <div class="row-flags">
      ${r.mainKey ? '' : '<span class="need">Audio needed</span>'}
      ${r.instrumentalKey ? '<span>Instrumental</span>' : ''}
      ${counts.stems ? `<span>${counts.stems} stems</span>` : ''}
      ${counts.visuals ? `<span>${counts.visuals} visuals</span>` : ''}
      ${counts.projects ? `<span>${counts.projects} projects</span>` : ''}
    </div>
    <button class="icon-btn info-btn" data-info="${r.id}" aria-label="Info"></button>
  </div>`;
}

function sortedRecordings(recs) {
  const list = [...recs];
  const byTitle = (a, b) => displayTitle(a).localeCompare(displayTitle(b), undefined, { numeric: true, sensitivity: 'base' });
  if (sortMode === 'title') return list.sort(byTitle);
  if (sortMode === 'oldest') return list.sort((a, b) => (madeTime(a) - madeTime(b)) || byTitle(a, b));
  if (sortMode === 'updated') return list.sort((a, b) => (updatedTime(b) - updatedTime(a)) || byTitle(a, b));
  if (sortMode === 'audio-needed') return list.sort((a, b) => Number(!!a.mainKey) - Number(!!b.mainKey) || (madeTime(b) - madeTime(a)) || byTitle(a, b));
  if (sortMode === 'instrumental') return list.sort((a, b) => Number(!!a.instrumentalKey) - Number(!!b.instrumentalKey) || (madeTime(b) - madeTime(a)) || byTitle(a, b));
  return list.sort((a, b) => (madeTime(b) - madeTime(a)) || byTitle(a, b));
}

function sortOptions() {
  const options = [
    ['made-newest', 'Newest made'],
    ['oldest', 'Oldest made'],
    ['updated', 'Recently updated'],
    ['title', 'Title A-Z'],
    ['audio-needed', 'Audio needed first'],
    ['instrumental', 'Needs instrumental first']
  ];
  return options.map(([value, label]) => `<option value="${value}" ${sortMode === value ? 'selected' : ''}>${label}</option>`).join('');
}

function groupedRows(recs) {
  if (!recs.length) return empty('None');
  const groups = new Map();
  const ordered = sortedRecordings(recs);
  const dateGrouping = sortMode !== 'title' && sortMode !== 'audio-needed' && sortMode !== 'instrumental';
  for (const rec of ordered) {
    const key = dateGrouping ? monthLabel(madeTime(rec)) : sortMode === 'audio-needed'
      ? (rec.mainKey ? 'Has audio' : 'Audio needed')
      : sortMode === 'instrumental'
        ? (rec.instrumentalKey ? 'Has instrumental' : 'Needs instrumental')
        : 'Titles';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(rec);
  }
  return [...groups.entries()]
    .map(([label, items]) => {
      const sizeClass = items.length === 1 ? 'one' : items.length === 2 ? 'two' : items.length <= 4 ? 'few' : 'many';
      return `<section class="shelf-group shelf-${sizeClass}"><div class="shelf-label"><b>${esc(label)}</b><span>${items.length}</span></div><div class="list">${items.map(row).join('')}</div></section>`;
    })
    .join('');
}

function groupedReleaseRows(recs) {
  if (!recs.length) return empty('No releases');
  const groups = new Map();
  for (const album of state.albums || []) {
    const tracks = sortedRecordings(recs.filter(r => (album.trackIds || []).includes(r.id)));
    if (tracks.length) groups.set(albumTitle(album), tracks);
  }
  return [...groups.entries()]
    .map(([label, items]) => {
      const sizeClass = items.length === 1 ? 'one' : items.length === 2 ? 'two' : items.length <= 4 ? 'few' : 'many';
      return `<section class="shelf-group shelf-${sizeClass}"><div class="shelf-label"><b>${esc(label)}</b><span>${items.length}</span></div><div class="list">${items.map(row).join('')}</div></section>`;
    })
    .join('');
}

function homeView() {
  const c = counts();
  const tiles = [
    `<button class="vault-tile primary" data-go="releases"><span>Releases</span><b>${c.releases}</b><em></em></button>`,
    `<button class="vault-tile primary" data-go="official"><span>Demos</span><b>${c.official}</b><em></em></button>`,
    c.tracklist ? `<button class="vault-tile quiet" data-go="tracklist"><span>Tracklist</span><b>${c.tracklist}</b><em></em></button>` : '',
    c.beats ? `<button class="vault-tile quiet" data-go="beats"><span>Instrumental</span><b>${c.beats}</b><em></em></button>` : ''
  ].filter(Boolean);
  return `<main class="home home-lux">
    <section class="surface home-cover">
      <div class="cover-top">
        <div>
          <div class="kicker">Home</div>
          <h1>Music Vault</h1>
        </div>
        <div class="collection-number"><b>${c.all}</b><span>demos</span></div>
      </div>
      <div class="home-landing-grid tiles-${tiles.length}">${tiles.join('')}</div>
    </section>
  </main>`;
}

function libraryView(section = null) {
  const source = section ? searchAndStatusRecordings() : filteredRecordings();
  const base = section === 'releases'
    ? source.filter(isReleaseTrack)
    : section === 'official'
      ? source.filter(r => r.section === 'official' && !isReleaseTrack(r))
      : source.filter(r => !section || r.section === section);
  const recs = base;
  const title = section ? sectionLabel(section) : 'Music';
  const headerAction = section === 'official'
    ? `<button class="btn scraps-toggle" data-go="demos">Scraps</button>`
    : '';
  return `<main class="library">
    <div class="library-head ${section === 'beats' ? 'support-head' : ''}"><div><h1>${esc(title)}</h1></div><div class="header-actions">${headerAction}<span class="badge">${countLabel(section, recs.length)}</span></div></div>
    <div class="filters">
      <input class="search" value="${esc(query)}" placeholder="Search" />
      ${section ? '' : '<select class="section-filter"><option value="all">All</option><option value="releases">Releases</option><option value="official">Demos</option><option value="demos">Scraps</option><option value="beats">Instrumental</option></select>'}
      <select class="status-filter"><option value="all">Any status</option><option value="unsorted">Unsorted</option><option value="keep">Keep</option><option value="mix">Mix</option><option value="done">Done</option></select>
      <select class="sort-filter" aria-label="Sort">${sortOptions()}</select>
    </div>
    <section class="shelf-panel">${section === 'releases' ? groupedReleaseRows(recs) : groupedRows(recs)}</section>
  </main>`;
}

function instrumentalView() {
  const standalone = sortedRecordings(searchAndStatusRecordings().filter(r => r.section === 'beats'));
  const pairable = searchAndStatusRecordings().filter(r => r.section !== 'beats');
  const missing = sortedRecordings(pairable.filter(r => !r.instrumentalKey));
  return `<main class="library">
    <div class="library-head support-head"><div><h1>Instrumental</h1></div><span class="badge">${standalone.length}</span></div>
    <div class="filters">
      <input class="search" value="${esc(query)}" placeholder="Search" />
      <select class="status-filter"><option value="all">Any status</option><option value="unsorted">Unsorted</option><option value="keep">Keep</option><option value="mix">Mix</option><option value="done">Done</option></select>
      <select class="sort-filter" aria-label="Sort">${sortOptions()}</select>
    </div>
    <section class="shelf-panel support-shelf">${standalone.length ? groupedRows(standalone) : empty('No standalone instrumentals')}</section>
    ${missing.length ? `<details class="support-details"><summary><span>Missing instrumental</span><b>${missing.length}</b></summary><div class="list compact-list">${missing.map(row).join('')}</div></details>` : ''}
  </main>`;
}

function albumCard(album) {
  const cover = albumCoverKey(album);
  const art = cover ? ` style="background-image:url('${esc(objectUrl(cover))}')"` : '';
  const meta = [album.genre, album.year].filter(Boolean).join(' / ');
  return `<button class="album-card" data-album-open="${esc(album.id)}">
    <div class="album-art ${cover ? 'has-cover' : ''}"${art}></div>
    <b>${esc(albumTitle(album))}</b>
    <span>${esc(meta || `${(album.trackIds || []).length} songs`)}</span>
  </button>`;
}

function albumsView() {
  const albums = state.albums || [];
  const active = albumById(selectedAlbumId);
  if (active) return albumDetailView(active);
  return `<main class="library albums-page">
    <div class="library-head"><div><h1>Albums</h1></div><button class="btn primary" data-action="new-album">New Album</button></div>
    <section class="album-grid">${albums.map(albumCard).join('') || empty('No albums yet')}</section>
  </main>`;
}

function albumDetailView(album) {
  const tracks = albumTracks(album);
  const coverOptions = imageVisualOptions();
  const selectedTracks = new Set(album.trackIds || []);
  const choices = sortedRecordings(state.recordings.filter(r => r.section === 'official' || r.section === 'demos'));
  return `<main class="library albums-page">
    <div class="library-head album-detail-head">
      <div><h1>${esc(albumTitle(album))}</h1></div>
      <div class="header-actions"><button class="btn" data-action="albums-back">Albums</button><button class="btn danger" data-action="delete-album">Delete</button></div>
    </div>
    <section class="album-editor panel">
      <div class="album-cover-preview ${albumCoverKey(album) ? 'has-cover' : ''}"${albumCoverKey(album) ? ` style="background-image:url('${esc(objectUrl(albumCoverKey(album)))}')"` : ''}></div>
      <div class="album-fields">
        <div class="field"><label>Album title</label><input id="album-title" value="${esc(albumTitle(album))}"></div>
        <div class="field-grid">
          <div class="field"><label>Genre</label><input id="album-genre" value="${esc(album.genre || '')}"></div>
          <div class="field"><label>Year</label><input id="album-year" value="${esc(album.year || '')}" inputmode="numeric"></div>
        </div>
        <div class="field"><label>Cover</label><select id="album-cover"><option value="">Auto cover</option>${coverOptions.map(o => `<option value="${esc(o.key)}" ${album.coverKey === o.key ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></div>
        <button class="btn primary" data-action="save-album">Save Album</button>
      </div>
    </section>
    <section class="panel album-track-panel">
      <div class="section-title"><h2>Songs</h2><span>${tracks.length}</span></div>
      <div class="album-song-picker">${choices.map(r => `<label class="song-check"><input type="checkbox" value="${esc(r.id)}" ${selectedTracks.has(r.id) ? 'checked' : ''}><span><b>${esc(displayTitle(r))}</b><em>${esc(sectionLabel(r.section))}</em></span></label>`).join('') || empty('No songs or demos')}</div>
    </section>
  </main>`;
}


function storageView() {
  const r = storageReport;
  const bad = r?.bad || [];
  const dupes = r?.duplicateFolders || [];
  const loose = r?.looseRoot || [];
  const needsCheck = storageNeedsCleanup();
  const issueCount = (r?.badCount || 0) + (r?.looseRootCount || 0) + (r?.duplicateFolderCount || 0);
  return `<main class="library storage-page">
    <div class="library-head"><div><div class="kicker">Storage</div><h1>Status</h1></div><span class="badge">${r ? `${r.total || 0} files` : 'Not scanned'}</span></div>
    <section class="import-panel panel">
      <div class="section-title"><h2>Import</h2><span>${uploadBusy ? 'Uploading' : 'Ready'}</span></div>
      <div class="import-controls">
        <select class="destination-filter" aria-label="Import destination">
          <option value="auto">Auto from folders</option>
          <option value="official">Songs</option>
          <option value="demos">Demos</option>
          <option value="beats">Standalone Instrumental</option>
        </select>
        <label class="btn primary">Add Folder<input type="file" webkitdirectory directory multiple hidden id="folder-input"></label>
        <label class="btn">Add Files<input type="file" multiple hidden id="file-input" accept=".wav,.mp3,.m4a,.aac,.flac,.ogg,.aif,.aiff,.flp,.aup3,.zip,.pdf,.jpg,.jpeg,.jfif,.png,.webp,.gif,.psd,.mp4,.mov"></label>
        <button class="btn" data-action="rebuild">Sync</button>
      </div>
    </section>
    <section class="storage-command panel">
      <div class="storage-meter ${needsCheck ? 'warn' : 'ok'}">
        <b>${needsCheck ? 'Check needed' : 'OK'}</b>
        <span>${r ? `${r.total || 0} files checked` : 'Run a scan when you want to check storage.'}</span>
      </div>
      <div class="storage-stats">
        <div><span>Files</span><b>${r?.total || 0}</b></div>
        <div><span>Issues</span><b>${issueCount}</b></div>
        <div><span>Loose</span><b>${r?.looseRootCount || 0}</b></div>
        <div><span>Duplicates</span><b>${r?.duplicateFolderCount || 0}</b></div>
      </div>
      <div class="storage-actions">
        <button class="btn" data-action="scan-storage">Scan</button>
        <button class="btn" data-action="export">Export</button>
      </div>
    </section>
    <section class="storage-details panel">
      <details ${needsCheck ? 'open' : ''}>
        <summary><span>Path issues</span><b>${r?.badCount || 0}</b></summary>
        <div class="path-list">${bad.slice(0, 12).map(x => `<div class="path-row"><b>${esc(x.key)}</b><span>${esc(x.target)}</span></div>`).join('') || empty('None')}</div>
      </details>
      <details>
        <summary><span>Loose files</span><b>${r?.looseRootCount || 0}</b></summary>
        <div class="path-list">${loose.slice(0, 12).map(x => `<div class="path-row"><b>${esc(x.key)}</b><span>${esc(x.target)}</span></div>`).join('') || empty('None')}</div>
      </details>
      <details>
        <summary><span>Duplicate names</span><b>${r?.duplicateFolderCount || 0}</b></summary>
        <div class="path-list">${dupes.slice(0, 12).map(x => `<div class="path-row"><b>${esc(x)}</b><span>same folder with different case or prefix</span></div>`).join('') || empty('None')}</div>
      </details>
    </section>
  </main>`;
}

function tracklistView() {
  return `<main class="tracklist-page embedded-tracklist">
    <iframe class="tracklist-frame" src="./tracklist/index.html" title="Tracklist"></iframe>
  </main>`;
}

function drawer() {
  const r = selected();
  if (!r) return `<aside class="drawer ${drawerOpen ? 'open' : ''}"></aside>`;
  const groups = groupedFiles(r);
  const audioOptions = (r.files || [])
    .filter(f => AUDIO_RE.test(f.name))
    .map(f => `<option value="${esc(f.key)}" ${f.key === r.mainKey ? 'selected' : ''}>${esc(f.name)}</option>`)
    .join('');
  return `<aside class="drawer ${drawerOpen ? 'open' : ''}">
    <div class="section-title"><h2>${esc(displayTitle(r))}</h2><button class="btn" data-action="close-drawer">Close</button></div>
    <div class="detail-hero">
      <div><span>Main</span><b>${esc(r.mainName || 'Audio needed')}</b></div>
      <div><span>Instrumental</span><b>${esc(r.instrumentalName || 'None')}</b></div>
    </div>
    <div class="field"><label>Title</label><input id="edit-title" value="${esc(displayTitle(r))}"></div>
    <div class="field"><label>Type</label><select id="edit-section"><option value="official">Demos</option><option value="demos">Scraps</option></select></div>
    <div class="field"><label>Main audio</label><select id="edit-main-audio">${audioOptions || '<option value="">No audio files</option>'}</select></div>
    <div class="field"><label>Status</label><select id="edit-status"><option>unsorted</option><option>keep</option><option>mix</option><option>done</option></select></div>
    <div class="field"><label>Project</label><input id="edit-project" value="${esc(r.project || '')}"></div>
    <div class="field"><label>Mood</label><input id="edit-mood" value="${esc(r.mood || '')}"></div>
    <div class="field"><label>Notes</label><textarea id="edit-notes">${esc(r.notes || '')}</textarea></div>
    <div class="file-groups">${groups}</div>
    <button class="btn primary" data-action="save-details">Save</button>
    <button class="btn" data-addtrack="${r.id}">Add to tracklist</button>
    <button class="btn danger" data-delete-song="${r.id}">Delete song</button>
  </aside>`;
}

function groupedFiles(r) {
  const order = [
    ['recording', 'Versions'],
    ['instrumental', 'Instrumental'],
    ['stem', 'Stems'],
    ['visual', 'Visuals'],
    ['project', 'Projects'],
    ['resource', 'Other']
  ];
  return order.map(([role, label]) => {
    const files = (r.files || []).filter(f => f.role === role);
    if (!files.length) return '';
    return `<section class="file-group"><div class="section-title"><h2>${label}</h2><span>${files.length}</span></div>${files.map(filePill).join('')}</section>`;
  }).join('') || empty('No files');
}

function filePill(f) {
  const duration = AUDIO_RE.test(f.name) ? durationLabel(state.durations?.[f.key]) : '';
  return `<div class="file-pill"><b>${esc(f.name)}</b><span>${[duration, fmtBytes(f.size), dateLabel(f.lastModified)].filter(Boolean).join(' / ')}</span><button class="file-delete" data-delete-file="${esc(f.key)}">Delete</button></div>`;
}

function uploadDock() {
  if (!uploadStatus.open) return '';
  const total = uploadStatus.total || 0;
  const done = uploadStatus.done || 0;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const label = uploadStatus.stage === 'uploading' ? 'Uploading' : uploadStatus.stage === 'indexed' ? 'Indexed' : uploadStatus.stage === 'partial' ? 'Finished with errors' : uploadStatus.stage === 'error' ? 'Upload issue' : 'Upload';
  return `<aside class="upload-dock ${uploadStatus.stage}">
    <div class="upload-head"><div><b>${esc(label)}</b><span>${done}/${total} files / ${uploadStatus.skipped} skipped / ${uploadStatus.failed} failed</span></div><button class="btn" data-action="hide-upload">Close</button></div>
    <div class="upload-bar"><i style="width:${pct}%"></i></div>
    ${uploadStatus.current ? `<div class="upload-current">${esc(uploadStatus.current)}</div>` : ''}
    ${uploadStatus.errors.length ? `<div class="upload-errors">${uploadStatus.errors.map(e => `<div>${esc(e)}</div>`).join('')}</div>` : ''}
  </aside>`;
}

function player() {
  const r = state.recordings.find(x => x.id === playingId) || selected();
  if (!r) return '';
  const duration = r?.mainKey ? durationLabel(state.durations?.[r.mainKey]) : '--:--';
  const main = r ? mainFile(r) : null;
  const date = r ? dateLabel(madeTime(r)) : '';
  const cover = coverFile(r);
  const artStyle = cover ? ` style="background-image:linear-gradient(145deg, rgba(255,255,255,.16), rgba(255,255,255,.02)), url('${esc(objectUrl(cover.key))}')"` : '';
  return `<footer class="player ${cover ? 'with-art' : 'no-art'}">
    ${cover ? `<div class="player-art has-cover"${artStyle}></div>` : ''}
    <div class="now"><b>${esc(displayTitle(r))}</b>${main ? `<span>${esc(date)}</span>` : ''}</div>
    <div class="transport">
      <button class="transport-step prev" data-action="prev-track" aria-label="Previous" ${r?.mainKey ? '' : 'disabled'}></button>
      <button class="transport-play" data-action="toggle-play" aria-label="${playingId ? 'Pause' : 'Play'}" ${r?.mainKey ? '' : 'disabled'}><span>${playingId ? 'Pause' : 'Play'}</span></button>
      <button class="transport-step next" data-action="next-track" aria-label="Next" ${r?.mainKey ? '' : 'disabled'}></button>
      <span class="transport-time current-time">0:00</span>
      <div class="transport-line"><i></i></div>
      <span class="transport-time total-time">${esc(duration)}</span>
      <button class="mute-btn ${playerMuted ? 'muted' : ''}" data-action="toggle-mute" aria-label="${playerMuted ? 'Unmute' : 'Mute'}"></button>
      <input class="volume-slider" type="range" min="0" max="1" step="0.01" value="${playerMuted ? 0 : playerVolume}" aria-label="Volume">
      ${r?.mainKey ? `<audio id="player-audio" src="${objectUrl(r.mainKey)}" preload="metadata"></audio>` : ''}
    </div>
    <button class="icon-btn info-btn" data-action="open-drawer" aria-label="Info"></button>
    <button class="icon-btn close-player" data-action="clear-selection" aria-label="Dismiss player"></button>
  </footer>`;
}

function unlockView() {
  return `<div class="unlock"><div class="keypad"><div class="section-title"><h2>Music Vault</h2><span>Code</span></div><div class="code-dots">${Array.from({length:6}).map((_,i)=>`<i class="dot ${i < token.length ? 'on' : ''}"></i>`).join('')}</div><div class="keys">${[1,2,3,4,5,6,7,8,9,'Back',0,'Go'].map(k => `<button class="key" data-key="${k}">${k}</button>`).join('')}</div></div>${uploadDock()}</div>`;
}

function navIcon(name) {
  const icons = {
    home: '<path d="M3.5 10.5 12 3l8.5 7.5"/><path d="M5.75 9.5V20h12.5V9.5"/><path d="M10 20v-6h4v6"/>',
    releases: '<path d="M12 3.2 14.7 8.67 20.75 9.55 16.37 13.82 17.4 19.85 12 17.01 6.6 19.85 7.63 13.82 3.25 9.55 9.3 8.67Z" fill="currentColor" stroke="none"/>',
    songs: '<path d="M14 4v10.5"/><path d="M14 4h5v3h-5"/><circle cx="9" cy="16.5" r="3"/><path d="M12 16.5V8"/>',
    demos: '<path d="M6 4h9l3 3v13H6z"/><path d="M15 4v4h4"/><path d="M9 14h6"/><path d="M9 17h4"/>',
    albums: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.25"/><path d="M12 3.5v2"/><path d="M20.5 12h-2"/>',
    instrumental: '<path d="M5 7h14"/><path d="M5 12h14"/><path d="M5 17h14"/><circle cx="9" cy="7" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="11" cy="17" r="2"/>',
    tracklist: '<path d="M7 6h11"/><path d="M7 12h11"/><path d="M7 18h11"/><path d="M4 6h.01"/><path d="M4 12h.01"/><path d="M4 18h.01"/>',
    storage: '<path d="M5 6c0-1.38 3.13-2.5 7-2.5s7 1.12 7 2.5-3.13 2.5-7 2.5S5 7.38 5 6Z"/><path d="M5 6v6c0 1.38 3.13 2.5 7 2.5s7-1.12 7-2.5V6"/><path d="M5 12v6c0 1.38 3.13 2.5 7 2.5s7-1.12 7-2.5v-6"/>'
  };
  return `<svg class="nav-symbol" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">${icons[name] || ''}</svg>`;
}

function render() {
  if (!unlocked) { $('#app').innerHTML = unlockView(); bind(); return; }
  const content = view === 'home' ? homeView() : view === 'releases' ? libraryView('releases') : view === 'official' ? libraryView('official') : view === 'demos' ? libraryView('demos') : view === 'albums' ? albumsView() : view === 'beats' ? instrumentalView() : view === 'tracklist' ? tracklistView() : view === 'storage' ? storageView() : homeView();
  const c = counts();
  const navItems = [
    { view: 'home', label: 'Home', count: '', tier: 'icon', icon: 'home', group: 'main' },
    { view: 'releases', label: 'Releases', count: c.releases, tier: 'primary', icon: 'releases' },
    { view: 'official', label: 'Demos', count: c.official, tier: 'primary', icon: 'songs' },
    { view: 'albums', label: 'Albums', count: c.albums, tier: 'primary', icon: 'albums' },
    { view: 'beats', label: 'Beats', count: c.beats, tier: 'quiet', icon: 'instrumental' },
    { view: 'tracklist', label: 'Tracklist', count: c.tracklist, tier: 'quiet', icon: 'tracklist' },
    { view: 'storage', label: 'Storage', count: storageNeedsCleanup() ? '!' : '', tier: 'icon', icon: 'storage' }
  ];
  const navButton = item => {
    if (item.tier === 'icon') {
      return `<button class="nav nav-icon ${view===item.view?'active':''}" data-view="${item.view}" aria-label="${item.label}" title="${item.label}">${navIcon(item.icon)}${item.count !== '' ? `<span class="count alert">${item.count}</span>` : ''}</button>`;
    }
    const icon = item.icon ? navIcon(item.icon) : '';
    return `<button class="nav ${item.tier} ${view===item.view?'active':''}" data-view="${item.view}"><span class="nav-label">${icon}<span>${item.label}</span></span>${item.count !== '' ? `<span class="count">${item.count}</span>` : '<span></span>'}</button>`;
  };
  const mainNav = navItems.filter(item => item.tier === 'primary' || item.group === 'main').map(navButton).join('');
  const utilityNav = navItems.filter(item => item.tier !== 'primary' && item.group !== 'main').map(navButton).join('');
  const playerHtml = player();
  $('#app').innerHTML = `<div class="app ${playerHtml ? 'has-player' : ''}"><div class="layout"><nav class="rail"><div class="nav-main">${mainNav}</div><div class="nav-utility">${utilityNav}</div></nav><section class="workspace">${content}</section></div>${playerHtml}${drawer()}${uploadDock()}</div><div class="toast"></div>`;
  bind();
}

function bind() {
  $$('[data-key]').forEach(b => b.onclick = async () => {
    const k = b.dataset.key;
    if (k === 'Back') token = token.slice(0,-1);
    else if (k === 'Go') { localStorage.setItem(STORAGE_KEY, token); unlocked = await loadState(); render(); return; }
    else if (token.length < 64) token += String(k);
    render();
  });
  $$('[data-view]').forEach(b => b.onclick = () => setView(b.dataset.view));
  $$('[data-go]').forEach(b => b.onclick = () => setView(b.dataset.go));
  $$('[data-album-open]').forEach(b => b.onclick = () => { selectedAlbumId = b.dataset.albumOpen; view = 'albums'; render(); });
  $$('.song-check input').forEach(input => input.onchange = () => updateAlbumTracks());
  $$('[data-select]').forEach(el => el.onclick = e => { if (e.target.closest('button')) return; selectRecording(el.dataset.select, false); });
  $$('[data-info]').forEach(b => b.onclick = e => { e.stopPropagation(); selectRecording(b.dataset.info, true); });
  $$('[data-play]').forEach(b => b.onclick = e => { e.stopPropagation(); playRecording(b.dataset.play); });
  $$('[data-delete-file]').forEach(b => b.onclick = e => { e.stopPropagation(); deleteFile(b.dataset.deleteFile); });
  $$('[data-delete-song]').forEach(b => b.onclick = e => { e.stopPropagation(); deleteSong(b.dataset.deleteSong); });
  $$('[data-addtrack]').forEach(b => b.onclick = () => addTrack(b.dataset.addtrack));
  $$('[data-removetrack]').forEach(b => b.onclick = e => { e.stopPropagation(); removeTrack(b.dataset.removetrack); });
  $$('[data-movetrack]').forEach(b => b.onclick = e => { e.stopPropagation(); const [id, dir] = b.dataset.movetrack.split(':'); moveTrack(id, dir); });
  $('.search')?.addEventListener('input', e => {
    query = e.target.value;
    renderKeepInput('.search', e.target.selectionStart, e.target.selectionEnd);
  });
  const sectionFilter = $('.section-filter');
  if (sectionFilter) {
    sectionFilter.value = filterSection;
    sectionFilter.addEventListener('change', e => { filterSection = e.target.value; render(); });
  }
  const statusFilter = $('.status-filter');
  if (statusFilter) {
    statusFilter.value = filterStatus;
    statusFilter.addEventListener('change', e => { filterStatus = e.target.value; render(); });
  }
  const sortFilter = $('.sort-filter');
  if (sortFilter) {
    sortFilter.value = sortMode;
    sortFilter.addEventListener('change', e => { sortMode = e.target.value; render(); });
  }
  const destinationFilter = $('.destination-filter');
  if (destinationFilter) {
    destinationFilter.value = importDestination;
    destinationFilter.addEventListener('change', e => { importDestination = e.target.value; });
  }
  $('.volume-slider')?.addEventListener('input', e => {
    playerVolume = Number(e.target.value);
    playerMuted = playerVolume <= 0;
    bindPlayerVolume();
  });
  $('#folder-input')?.addEventListener('change', e => {
    const files = Array.from(e.target.files || []);
    if (!files.length) {
      uploadStatus = { open: true, stage: 'error', total: 0, done: 0, skipped: 0, failed: 0, current: '', errors: ['No files were selected. Check that folder upload is allowed in this browser.'] };
      render();
      return;
    }
    uploadFiles(files, importDestination);
    e.target.value = '';
  });
  $('#file-input')?.addEventListener('change', e => {
    const files = Array.from(e.target.files || []);
    if (!files.length) {
      uploadStatus = { open: true, stage: 'error', total: 0, done: 0, skipped: 0, failed: 0, current: '', errors: ['No files were selected.'] };
      render();
      return;
    }
    uploadFiles(files, importDestination === 'auto' ? 'official' : importDestination);
    e.target.value = '';
  });
  $$('[data-action]').forEach(b => b.onclick = () => action(b.dataset.action));
  const r = selected();
  if (r && $('#edit-status')) $('#edit-status').value = r.status || 'unsorted';
  if (r && $('#edit-section')) $('#edit-section').value = r.section === 'demos' ? 'demos' : 'official';
  bindPlayer();
  hydrateDurations();
}

async function action(name) {
  if (name === 'hide-upload') { uploadStatus.open = false; render(); return; }
  if (name === 'open-folder') { $('#folder-input')?.click(); return; }
  if (name === 'rebuild') return rebuildIndex();
  if (name === 'scan-storage') return scanStorage();
  if (name === 'open-drawer') { drawerOpen = true; renderKeepScroll(); }
  if (name === 'close-drawer') { drawerOpen = false; renderKeepScroll(); }
  if (name === 'clear-selection') { selectedId = null; playingId = null; pendingPlay = false; drawerOpen = false; renderKeepScroll(); }
  if (name === 'clear-tracklist') return clearTracklist();
  if (name === 'save-tracklist-meta') return saveTracklistMeta();
  if (name === 'new-album') return createAlbum();
  if (name === 'albums-back') { selectedAlbumId = null; render(); return; }
  if (name === 'save-album') return saveAlbum();
  if (name === 'delete-album') return deleteAlbum();
  if (name === 'prev-track') return stepTrack(-1);
  if (name === 'next-track') return stepTrack(1);
  if (name === 'toggle-mute') { playerMuted = !playerMuted; bindPlayerVolume(); renderKeepScroll(); return; }
  if (name === 'toggle-play') return playRecording((state.recordings.find(x => x.id === playingId) || selected())?.id);
  if (name === 'save-details') return saveDetails();
  if (name === 'export') {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type:'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'music-vault-index.json'; a.click(); URL.revokeObjectURL(a.href);
  }
}

async function saveDetails() {
  const r = selected(); if (!r) return;
  const nextTitle = ($('#edit-title')?.value || '').trim();
  r.customTitle = nextTitle && nextTitle !== r.title ? nextTitle : '';
  r.section = $('#edit-section')?.value || r.section || 'official';
  const mainKey = $('#edit-main-audio')?.value || '';
  const mainFile = (r.files || []).find(f => f.key === mainKey);
  if (mainFile) {
    r.mainKey = mainFile.key;
    r.mainName = mainFile.name;
  }
  r.status = $('#edit-status').value;
  r.project = $('#edit-project').value;
  r.mood = $('#edit-mood').value;
  r.notes = $('#edit-notes').value;
  r.updatedAt = new Date().toISOString();
  await saveState(); renderKeepScroll(); toast('Saved');
}

async function createAlbum() {
  const album = {
    id: `album-${Date.now().toString(36)}`,
    title: 'New Album',
    genre: '',
    year: '',
    coverKey: '',
    trackIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  state.albums = [...(state.albums || []), album];
  selectedAlbumId = album.id;
  await saveState();
  render();
  toast('Album created');
}

async function saveAlbum() {
  const album = albumById(selectedAlbumId);
  if (!album) return;
  album.title = ($('#album-title')?.value || '').trim() || 'Untitled Album';
  album.genre = ($('#album-genre')?.value || '').trim();
  album.year = ($('#album-year')?.value || '').trim();
  album.coverKey = $('#album-cover')?.value || '';
  album.updatedAt = new Date().toISOString();
  await updateAlbumTracks(false);
  await saveState();
  render();
  toast('Album saved');
}

async function updateAlbumTracks(save = true) {
  const album = albumById(selectedAlbumId);
  if (!album) return;
  album.trackIds = $$('.song-check input:checked').map(input => input.value);
  album.updatedAt = new Date().toISOString();
  if (save) {
    await saveState();
    renderKeepScroll();
    toast('Album updated');
  }
}

async function deleteAlbum() {
  const album = albumById(selectedAlbumId);
  if (!album || !confirm(`Delete ${albumTitle(album)}?`)) return;
  state.albums = (state.albums || []).filter(a => a.id !== album.id);
  selectedAlbumId = null;
  await saveState();
  render();
  toast('Album deleted');
}

async function addTrack(id) {
  if (!state.tracklist.some(t => t.id === id)) state.tracklist.push({ id });
  await saveState(); render();
}

async function removeTrack(id) {
  state.tracklist = state.tracklist.filter(t => t.id !== id);
  await saveState(); render();
}

async function moveTrack(id, direction) {
  const index = state.tracklist.findIndex(t => t.id === id);
  if (index < 0) return;
  const next = direction === 'up' ? index - 1 : index + 1;
  if (next < 0 || next >= state.tracklist.length) return;
  const [item] = state.tracklist.splice(index, 1);
  state.tracklist.splice(next, 0, item);
  await saveState(); render();
}

async function clearTracklist() {
  if (!state.tracklist.length || !confirm('Clear tracklist?')) return;
  state.tracklist = [];
  await saveState(); render();
}

async function saveTracklistMeta() {
  state.tracklistMeta = state.tracklistMeta || {};
  state.tracklistMeta.title = $('#tracklist-title')?.value || 'New Tracklist';
  state.tracklistMeta.notes = $('#tracklist-notes')?.value || '';
  await saveState();
  toast('Saved');
}

function playRecording(id) {
  const r = state.recordings.find(x => x.id === id);
  if (!r?.mainKey) return;
  if (playingId === id) {
    playerPosition = $('#player-audio')?.currentTime || playerPosition || 0;
    playingId = null;
    pendingPlay = false;
    renderKeepScroll();
    return;
  }
  if (selectedId !== id) playerPosition = 0;
  selectedId = id;
  playingId = id;
  pendingPlay = true;
  renderKeepScroll();
}

function playableRecordings() {
  return sortedRecordings(state.recordings.filter(r => r.mainKey));
}

function stepTrack(direction) {
  const current = state.recordings.find(x => x.id === playingId) || selected();
  const list = playableRecordings();
  if (!current || !list.length) return;
  const index = Math.max(0, list.findIndex(r => r.id === current.id));
  const next = list[(index + direction + list.length) % list.length];
  if (next) {
    playerPosition = 0;
    selectedId = next.id;
    playingId = next.id;
    pendingPlay = true;
    renderKeepScroll();
  }
}

function endTrack() {
  const current = state.recordings.find(x => x.id === playingId) || selected();
  const list = playableRecordings();
  if (!current || list.length <= 1) {
    playerPosition = 0;
    playingId = null;
    pendingPlay = false;
    renderKeepScroll();
    return;
  }
  stepTrack(1);
}

function bindPlayer() {
  const audio = $('#player-audio');
  if (!audio) return;
  bindPlayerVolume();
  const line = $('.transport-line');
  const currentTime = $('.current-time');
  const totalTime = $('.total-time');
  const seek = e => {
    if (!audio.duration || !line) return;
    const rect = line.getBoundingClientRect();
    const clientX = e.touches?.[0]?.clientX ?? e.clientX;
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    audio.currentTime = pct * audio.duration;
    playerPosition = audio.currentTime;
    const fill = $('.transport-line i');
    if (fill) fill.style.width = `${pct * 100}%`;
    if (currentTime) currentTime.textContent = durationLabel(audio.currentTime);
  };
  audio.onloadedmetadata = () => {
    rememberDuration(audio.src, audio.duration);
    if (totalTime) totalTime.textContent = durationLabel(audio.duration);
    if (playerPosition && playerPosition < audio.duration) audio.currentTime = playerPosition;
  };
  audio.ontimeupdate = () => {
    playerPosition = audio.currentTime || 0;
    if (currentTime) currentTime.textContent = durationLabel(audio.currentTime);
    const line = $('.transport-line i');
    if (line && audio.duration) line.style.width = `${Math.min(100, (audio.currentTime / audio.duration) * 100)}%`;
  };
  audio.onwaiting = () => toast('Loading audio');
  audio.onerror = () => toast('Audio could not play');
  audio.onended = () => { playerPosition = 0; endTrack(); };
  if (line) {
    line.onclick = seek;
    line.onpointerdown = e => {
      seek(e);
      line.setPointerCapture?.(e.pointerId);
      line.onpointermove = move => { if (move.buttons) seek(move); };
      line.onpointerup = () => { line.onpointermove = null; };
    };
    line.ontouchstart = seek;
    line.ontouchmove = seek;
  }
  if (pendingPlay) {
    pendingPlay = false;
    audio.play().catch(err => toast(String(err?.message || err).slice(0, 120)));
  }
}

function bindPlayerVolume() {
  const audio = $('#player-audio');
  if (!audio) return;
  audio.volume = Math.max(0, Math.min(1, playerVolume));
  audio.muted = playerMuted || playerVolume <= 0;
}

function rememberDuration(src, duration) {
  const key = decodeURIComponent(String(src || '').split('key=')[1] || '');
  if (!key || !duration || state.durations?.[key]) return;
  state.durations[key] = Math.round(duration);
  saveState().catch(console.error);
}

function hydrateDurations() {
  const keys = state.recordings.filter(r => r.mainKey && !state.durations?.[r.mainKey]).slice(0, 8).map(r => r.mainKey);
  for (const key of keys) {
    const audio = new Audio(objectUrl(key));
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => rememberDuration(audio.src, audio.duration);
  }
}

async function deleteFile(key) {
  if (!key || !confirm('Delete this file?')) return;
  try {
    await api('/api/delete', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key }) });
    delete state.durations?.[key];
    const objects = await api('/api/objects');
    state.recordings = mergeFreshIndex(rebuildEntitiesFromObjects(objects.objects || []));
    state.tracklist = state.tracklist.filter(t => state.recordings.some(r => r.id === t.id));
    cleanAlbumTracks();
    if (playingId && !state.recordings.some(r => r.id === playingId)) playingId = null;
    await saveState();
    render();
    toast('Deleted');
  } catch (err) {
    toast(`Delete failed: ${String(err?.message || err).slice(0, 140)}`);
  }
}

async function deleteSong(id) {
  const r = state.recordings.find(x => x.id === id);
  if (!r || !confirm(`Delete ${displayTitle(r)} and its files?`)) return;
  try {
    for (const file of r.files || []) {
      await api('/api/delete', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: file.key }) });
      delete state.durations?.[file.key];
    }
    const objects = await api('/api/objects');
    state.recordings = mergeFreshIndex(rebuildEntitiesFromObjects(objects.objects || []));
    state.tracklist = state.tracklist.filter(t => t.id !== id && state.recordings.some(r => r.id === t.id));
    cleanAlbumTracks();
    if (selectedId === id) selectedId = null;
    if (playingId === id) playingId = null;
    drawerOpen = false;
    await saveState();
    render();
    toast('Deleted');
  } catch (err) {
    toast(`Delete failed: ${String(err?.message || err).slice(0, 140)}`);
  }
}

function empty(text) { return `<div class="empty">${esc(text)}</div>`; }
function esc(s='') { return String(s).replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch])); }

(async function init() { unlocked = await loadState(); render(); })();
