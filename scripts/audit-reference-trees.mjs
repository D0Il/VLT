import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const workerSource = await readFile('worker.js', 'utf8');
const context = { console, Response, Headers, URL, FormData, File, Blob };
vm.createContext(context);
vm.runInContext(workerSource.replace('export default', 'globalThis.worker ='), context);

const references = [
  ['reference/superstar-tree.txt', 'SUPERSTAR'],
  ['reference/songs-tree.txt', 'Songs']
];

const files = [];
for (const [file, rootName] of references) {
  files.push(...parseTree(await readTree(file), rootName));
}

const classified = files
  .map((path, index) => {
    const meta = { size: 1000 + index, lastModified: 1000000 + index };
    return { path, key: context.canonicalKeyForPath(path, meta), c: context.classifyPath(path, meta) };
  })
  .filter(x => x.c && !x.c.skip && x.key);

const objects = classified.map((x, index) => ({
  key: x.key,
  size: 1000 + index,
  uploaded: new Date(1000000 + index).toISOString(),
  customMetadata: { lastModified: String(1000000 + index) }
}));

const entities = rebuildEntitiesFromObjects(objects);
const names = new Set(entities.map(x => x.title.toLowerCase()));
const badEntityNames = ['superstar', 'songs', 'song', 'official', 'demos', 'demo', 'visuals', 'stems', 'stemms', 'beat', 'beats']
  .filter(name => names.has(name));
const stemSongs = entities.filter(entity =>
  /\b(stems?|stemms|trackout|visuals?|cluttr|clutter|beat|instrumental)\b/i.test(entity.title)
);
const nestedAsSongs = classified.filter(x =>
  /\b(stems?|stemms|visuals?|cluttr|clutter|beat|instrumental)\b/i.test(x.c.entityName)
);

const sectionCounts = countBy(entities, x => x.section);
const roleCounts = countBy(classified, x => x.c.role);
const noMain = entities.filter(x => x.section !== 'beats' && !x.mainKey);
const noInstrumental = entities.filter(x => x.section !== 'beats' && !x.instrumentalKey);

let failures = 0;
function assert(condition, label, detail = '') {
  if (!condition) {
    failures += 1;
    console.error(`FAIL ${label}${detail ? `\n  ${detail}` : ''}`);
  }
}

assert(!badEntityNames.length, 'container folders did not become songs', badEntityNames.join(', '));
assert(!stemSongs.length, 'attachment folders did not become songs', stemSongs.map(x => x.title).slice(0, 10).join(', '));
assert(!nestedAsSongs.length, 'nested resource folders did not become entities', nestedAsSongs.map(x => x.path).slice(0, 10).join('\n  '));
assert(!entities.some(x => x.title === 'SUPERSTAR'), 'SUPERSTAR is not a song');

console.log(JSON.stringify({
  sourceFiles: files.length,
  canonicalFiles: classified.length,
  entities: entities.length,
  sections: sectionCounts,
  roles: roleCounts,
  missingMainAudio: noMain.length,
  missingMainAudioTitles: noMain.map(x => x.title),
  missingInstrumental: noInstrumental.length,
  sampleEntities: entities.slice(0, 12).map(x => ({
    title: x.title,
    section: x.section,
    main: x.mainName,
    instrumental: x.instrumentalName || ''
  }))
}, null, 2));

if (failures) process.exit(1);

function parseTree(text, rootName) {
  const out = [];
  const stack = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+$/g, '');
    if (!line || /^Folder PATH listing|^Volume serial number|^[A-Z]:\\/i.test(line)) continue;

    const branch = line.match(/^([| ]*)([+\\]---)(.+)$/);
    if (branch) {
      const depth = Math.floor(branch[1].length / 4);
      stack.length = depth;
      stack.push(branch[3].trim());
      continue;
    }

    const file = line.match(/^[| ]{4,}(.+)$/);
    if (!file) continue;
    const name = file[1].trim();
    if (!name) continue;
    out.push([rootName, ...stack, name].join('/'));
  }
  return out;
}

async function readTree(file) {
  const buffer = await readFile(file);
  return buffer.toString('utf8').replace(/\0/g, '').replace(/\r/g, '');
}

function countBy(items, fn) {
  return items.reduce((acc, item) => {
    const key = fn(item) || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function rebuildEntitiesFromObjects(items) {
  const map = new Map();
  for (const obj of items) {
    const c = context.classifyPath(obj.key, {
      size: obj.size,
      lastModified: Number(obj.customMetadata?.lastModified || 0)
    });
    if (!c || c.skip) continue;
    const id = `${c.section}:${slug(c.entityName)}`;
    if (!map.has(id)) {
      map.set(id, {
        id,
        title: c.entityName,
        section: c.section,
        files: [],
        mainKey: '',
        mainName: '',
        instrumentalKey: '',
        instrumentalName: '',
        size: 0
      });
    }
    const rec = map.get(id);
    rec.size += obj.size || 0;
    rec.files.push({
      key: obj.key,
      name: c.filename,
      role: c.role,
      size: obj.size,
      lastModified: c.lastModified,
      section: c.section
    });
    if (c.role === 'instrumental' && (!rec.instrumentalKey || c.lastModified > (rec.instrumentalModified || 0))) {
      rec.instrumentalKey = obj.key;
      rec.instrumentalName = c.filename;
      rec.instrumentalModified = c.lastModified;
    }
    if (c.directNormalRecording) {
      const current = rec.files.find(f => f.key === rec.mainKey);
      const score = mainAudioScore(c.entityName, c.filename);
      const currentScore = current ? mainAudioScore(c.entityName, current.name) : -1;
      if (!rec.mainKey || score > currentScore || (score === currentScore && c.lastModified >= (current?.lastModified || 0))) {
        rec.mainKey = obj.key;
        rec.mainName = c.filename;
      }
    }
  }
  for (const rec of map.values()) {
    if (!rec.mainKey) {
      const fallback = rec.files
        .filter(f => /\.(wav|mp3|m4a|aac|flac|ogg|aif|aiff)$/i.test(f.name) && f.role === 'recording')
        .sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0))[0]
        || rec.files
          .filter(f => /\.(wav|mp3|m4a|aac|flac|ogg|aif|aiff)$/i.test(f.name))
          .sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0))[0];
      if (fallback) {
        rec.mainKey = fallback.key;
        rec.mainName = fallback.name;
      }
    }
  }
  return [...map.values()].sort((a, b) => a.title.localeCompare(b.title));
}

function slug(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
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

function cleanName(value) {
  return String(value || '')
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
