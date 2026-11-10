#!/usr/bin/env node
/* Alkyon · αντιγράφει τα αρχεία της εφαρμογής σε έναν φάκελο για ανέβασμα.
   node tools/build-web.mjs dist/web            → για το Cloudflare (alkyonfishing.com)
   node tools/build-web.mjs www --native        → για την εφαρμογή Android (Capacitor)
   Η εφαρμογή δεν έχει βήμα «χτισίματος»: τα αρχεία πάνε όπως είναι. Εδώ απλώς αφήνουμε έξω ό,τι δεν είναι για τον browser
   (κώδικας server, SQL, εργαλεία, tests, workflows, το έργο Android). */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const OUT = path.resolve(ROOT, args.find(a => !a.startsWith('--')) || 'dist/web');
const NATIVE = args.includes('--native');

/* φάκελοι και αρχεία που δεν ανεβαίνουν */
const SKIP_DIRS = new Set(['.git', '.github', 'github', 'node_modules', 'android', 'ios', 'dist', 'www', 'tests', 'tools',
  'garmin', 'dams_xlsx', 'cloudflare', 'native', '.wrangler', '.claude', '__pycache__']);
const SKIP_FILES = new Set(['package.json', 'package-lock.json', 'capacitor.config.json', 'wrangler.jsonc', '.gitignore',
  '.assetsignore', 'CLAUDE.md', 'README.md', 'push.yml']);
const SKIP_EXT = new Set(['.ts', '.sql', '.py', '.mjs', '.md', '.yml', '.yaml', '.xlsx', '.geojson']);

async function copyDir(src, dst) {
  let n = 0;
  await fs.mkdir(dst, { recursive: true });
  for (const e of await fs.readdir(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) n += await copyDir(s, d); continue; }
    if (SKIP_FILES.has(e.name) || SKIP_EXT.has(path.extname(e.name))) continue;
    await fs.copyFile(s, d); n++;
  }
  return n;
}

if (OUT === ROOT || !OUT.startsWith(ROOT + path.sep)) { console.error('Λάθος φάκελος εξόδου: ' + OUT); process.exit(1); }
await fs.rm(OUT, { recursive: true, force: true });
let n = await copyDir(ROOT, OUT);

/* .well-known: για το Cloudflare μόνο (η εφαρμογή δεν το χρειάζεται μέσα της) */
if (!NATIVE) {
  const wk = path.join(ROOT, 'cloudflare', 'well-known');
  try { n += await copyDir(wk, path.join(OUT, '.well-known')); } catch (e) { /* δεν υπάρχει ακόμα */ }
  await fs.copyFile(path.join(ROOT, 'cloudflare', '_headers'), path.join(OUT, '_headers')); n++;
}

/* Android: το capacitor.js (γέφυρα προς τα πρόσθετα) και το native.js μπαίνουν αμέσως μετά το migrate.js,
   πριν από κάθε άλλο αρχείο, μόνο στο αντίγραφο της εφαρμογής. Η ιστοσελίδα δεν τα φορτώνει ποτέ. */
if (NATIVE) {
  await fs.copyFile(path.join(ROOT, 'node_modules/@capacitor/core/dist/capacitor.js'), path.join(OUT, 'capacitor.js')); n++;
  for (const [file, pre] of [['index.html', ''], ['v4/index.html', '../']]) {
    const f = path.join(OUT, file);
    let html = await fs.readFile(f, 'utf8');
    const tag = `<script src="${pre}migrate.js"></script>`;
    if (!html.includes(tag)) { console.error(`Δεν βρέθηκε το ${tag} στο ${file}`); process.exit(1); }
    html = html.replace(tag, `${tag}\n<script src="${pre}capacitor.js"></script>\n<script src="${pre}native.js"></script>`);
    await fs.writeFile(f, html);
  }
} else {
  await fs.rm(path.join(OUT, 'native.js'), { force: true }); n--;
}

/* σημάδι για τον κώδικα: σε ποια μορφή τρέχει (το native.js το ελέγχει ξανά από το Capacitor) */
await fs.writeFile(path.join(OUT, 'build-info.json'),
  JSON.stringify({ target: NATIVE ? 'android' : 'web', built: new Date().toISOString() }) + '\n');
console.log(`Alkyon: ${n} αρχεία → ${path.relative(ROOT, OUT)} (${NATIVE ? 'Android' : 'web'})`);
