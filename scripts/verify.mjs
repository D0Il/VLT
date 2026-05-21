import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const workerSource = await readFile('worker.js', 'utf8');
const context = { console, Response, Headers, URL, FormData, File, Blob };
vm.createContext(context);
vm.runInContext(workerSource.replace('export default', 'globalThis.worker ='), context);

const pathCases = [
  ['SUPERSTAR/Birthday Suit/Birthday Suit.mp3', 'Official/Birthday Suit/Birthday Suit.mp3'],
  ['SUPERSTAR/Birthday Suit/wetho audio [bass].wav', 'Official/Birthday Suit/Stems/wetho audio [bass].wav'],
  ['SUPERSTAR/Birthday Suit/Birthday Suit MUSIC VIDEO.mp4', 'Official/Birthday Suit/Visuals/Birthday Suit MUSIC VIDEO.mp4'],
  ['Songs/[DEMO]/You/You.wav', 'Demos/You/You.wav'],
  ['Songs/[DEMO]/You/You BEAT/You BEAT.wav', 'Demos/You/Instrumental/You BEAT.wav'],
  ['Songs/Baby/Baby STEMS/Honey.wav', 'Official/Baby/Stems/Honey.wav'],
  ['Songs/Baby/Visuals/Baby.png', 'Official/Baby/Visuals/Baby.png'],
  ['Beats/Euphoric Mirage.mp3', 'Beats/Euphoric Mirage/Instrumental/Euphoric Mirage.mp3'],
  ['SUPERSTAR/Night Beach/Ride Just Like a Rodeo ext v1.2.1.1 (Stems)/Ride Just Like a Rodeo ext v1.2.1.1 (bass).wav', 'Official/Night Beach/Stems/Ride Just Like a Rodeo ext v1.2.1.1 (bass).wav'],
  ['SUPERSTAR/Hot Boy/Deep House Beat - Neon Lights Trackout/Bass hot boy.wav', 'Official/Hot Boy/Stems/Bass hot boy.wav'],
  ['SUPERSTAR/Dream/harp.wav', 'Official/Dream/Stems/harp.wav'],
  ['SUPERSTAR/Dream/synth.wav', 'Official/Dream/Stems/synth.wav'],
  ['Official/Addict/Instrumental/Addict BEAT.wav', 'Official/Addict/Instrumental/Addict BEAT.wav'],
  ['Official/Birthday Suit/Instrumental/REFRENCE BDAY SUIT Morning beat.wav', 'Official/Birthday Suit/Instrumental/REFRENCE BDAY SUIT Morning beat.wav'],
  ['VAULT/SONGS/Video Vixen/Video Vixen BEAT/Video Vixen BEAT.wav', 'Official/Video Vixen/Instrumental/Video Vixen BEAT.wav'],
  ['VAULT/SONGS/[DEMO]/Nightcrawler/Nightcrawler STEMS/mainvocalsnightcrawler.wav', 'Demos/Nightcrawler/Stems/mainvocalsnightcrawler.wav'],
  ['VAULT/SONGS/Worldwide/Worldwide Instrumental [spinnin 152 (okayypablo)].wav', 'Official/Worldwide/Instrumental/Worldwide Instrumental [spinnin 152 (okayypablo)].wav'],
  ['VAULT/SONGS/Kleopetra/Pharaoh%27s%20Dance%20ext%20v1.1.1.2.2.mp3', "Official/Kleopetra/Pharaoh%27s%20Dance%20ext%20v1.1.1.2.2.mp3"]
];

let failures = 0;
for (const [input, expected] of pathCases) {
  const actual = context.canonicalKeyForPath(input, { size: 1, lastModified: 1 });
  if (actual !== expected) {
    failures += 1;
    console.error(`FAIL ${input}\n  expected: ${expected}\n  actual:   ${actual}`);
  }
}

const classifyCases = [
  ['SUPERSTAR/Birthday Suit/wetho audio [bass].wav', { entityName: 'Birthday Suit', section: 'official', role: 'stem' }],
  ['Songs/[DEMO]/Nightcrawler/Nightcrawler BEAT/NIGHTCRWALER beat.wav', { entityName: 'Nightcrawler', section: 'demos', role: 'instrumental' }],
  ['Songs/Baby/Baby STEMS/X2Download [drums].wav', { entityName: 'Baby', section: 'official', role: 'stem' }],
  ['SUPERSTAR/Superstar MEDIA/SUPASTARR.jpg', { entityName: 'Superstar', section: 'official', role: 'visual', skip: true }]
];

for (const [input, expected] of classifyCases) {
  const actual = context.classifyPath(input, { size: 1, lastModified: 1 });
  for (const [key, value] of Object.entries(expected)) {
    if (actual[key] !== value) {
      failures += 1;
      console.error(`FAIL ${input} ${key}\n  expected: ${value}\n  actual:   ${actual[key]}`);
    }
  }
}

const timestamp = context.parseTimestamp('1716151234567');
if (timestamp !== 1716151234567) {
  failures += 1;
  console.error(`FAIL numeric timestamp parsing\n  expected: 1716151234567\n  actual:   ${timestamp}`);
}

const skippedKey = context.canonicalKeyForPath('SUPERSTAR/Superstar MEDIA/SUPASTARR.jpg', { size: 1, lastModified: 1 });
if (skippedKey !== '') {
  failures += 1;
  console.error(`FAIL album resource skip\n  expected empty canonical key\n  actual:   ${skippedKey}`);
}

const malformedPercentKey = context.canonicalKeyForPath('Songs/Test/100% Fame.wav', { size: 1, lastModified: 1 });
if (malformedPercentKey !== 'Official/Test/100% Fame.wav') {
  failures += 1;
  console.error(`FAIL malformed percent filename\n  expected: Official/Test/100% Fame.wav\n  actual:   ${malformedPercentKey}`);
}

if (failures) process.exit(1);
console.log(`Verified ${pathCases.length + classifyCases.length + 3} folder rules.`);
