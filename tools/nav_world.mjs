/* Alkyon 1.11.3: περιοχές του ProtectedSeas Navigator για όλο τον κόσμο (CC BY 4.0), σε κομμάτια 10°×10°.
   Είσοδος: τα GeoJSON της εξαγωγής του Navigator (LFP4 και LFP5: πολύ αυστηρή και πλήρης προστασία).
   Έξοδος: nav/w_<lat>_<lon>.json ({v, f:[ίδια μορφή με το navigator-mpa.json]}) και nav/index.json ({v, t:{"lat_lon":πλήθος}}).
   Κύπρος και Ελλάδα δεν μπαίνουν εδώ (έχουν τα δικά τους αρχεία). Οι υπόλοιπες χώρες της Αν. Μεσογείου υπάρχουν και στο navigator-mpa.json: η εφαρμογή κρατά μία φορά κάθε ps_id.
   Χρήση: node tools/nav_world.mjs <έξοδος> <αρχείο.json> [αρχείο.json ...] */
import fs from 'node:fs';
import path from 'node:path';
import { toRings, compact } from '../navigator-sync.mjs';
/* Κύπρος και Ελλάδα: έχουν δικές τους ελεγμένες ζώνες (zones.js, zones-gr.js) και όλα τα επίπεδα στο navigator-mpa.json */
export const OWN = new Set(['Cyprus', 'Greece']);

export const STEP = 10;
export const tileKey = (lat, lon) => (Math.floor(lat / STEP) * STEP) + '_' + (Math.floor(lon / STEP) * STEP);
/* ίδιο φίλτρο με το relevant() του navigator.js: κάτι γνωστό για ψάρεμα ή άγκυρα */
export function relevant(f) {
  const sv = (f.rf === 1 || f.hl === 1) ? 2 : (f.rf === 2 || f.hl === 2 || f.tr === 1 || f.tr === 2) ? 1 : 0;
  if (typeof f.pm === 'number' && f.pm < 5 && sv < 2) return false;   /* 1.11.4: σχεδόν όλη στη στεριά */
  return sv > 0 || f.sp === 1 || f.sp === 2 || f.an === 1 || f.an === 2;   /* 1.11.4: μόνο ό,τι αλλάζει κάτι για τον ψαρά */
}
export function worldWanted(p) { return p && !OWN.has(p.country) && p.category_id !== 9 && (p.lfp === 4 || p.lfp === 5); }
export function tilesOf(b) {
  const out = [];
  for (let la = Math.floor(b[0] / STEP) * STEP; la <= b[2]; la += STEP)
    for (let lo = Math.floor(b[1] / STEP) * STEP; lo <= b[3]; lo += STEP) out.push(la + '_' + lo);
  return out;
}
export function build(files, outDir, v) {
  const byId = new Map(); let skip = 0;
  for (const file of files) {
    const j = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const ft of j.features || []) {
      const p = ft.properties || {};
      if (!worldWanted(p)) { skip++; continue; }
      const G = toRings(ft.geometry, p.country); if (!G) { skip++; continue; }
      const f = compact(p, G); if (!relevant(f)) { skip++; continue; }
      const prev = byId.get(f.i);
      if (prev) { prev.g = prev.g.concat(f.g); prev.b = [Math.min(prev.b[0], f.b[0]), Math.min(prev.b[1], f.b[1]), Math.max(prev.b[2], f.b[2]), Math.max(prev.b[3], f.b[3])]; }
      else byId.set(f.i, f);
    }
  }
  const tiles = {};
  for (const f of byId.values()) {
    const ks = tilesOf(f.b);
    if (ks.length > 40) { skip++; continue; }             /* τεράστιες περιοχές ανοιχτού ωκεανού: όχι για ψάρεμα από σκάφος αναψυχής */
    for (const k of ks) (tiles[k] = tiles[k] || []).push(f);
  }
  fs.mkdirSync(outDir, { recursive: true });
  for (const n of fs.readdirSync(outDir)) if (/^w_.*\.json$/.test(n)) fs.unlinkSync(path.join(outDir, n));
  const idx = {};
  for (const [k, fs_] of Object.entries(tiles)) {
    fs_.sort((a, b) => a.n.localeCompare(b.n));
    fs.writeFileSync(path.join(outDir, 'w_' + k + '.json'), JSON.stringify({ v, f: fs_ }));
    idx[k] = fs_.length;
  }
  fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify({ v, step: STEP, t: idx }));
  return { sites: byId.size, tiles: Object.keys(idx).length, skip };
}
if (process.argv[1] && process.argv[1].endsWith('nav_world.mjs')) {
  const [out, ...files] = process.argv.slice(2);
  console.log(JSON.stringify(build(files, out, process.env.NAV_V || new Date().toISOString().slice(0, 10))));
}
