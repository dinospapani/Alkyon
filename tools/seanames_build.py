"""Alkyon 1.14.8: ονόματα της θάλασσας για τον χάρτη (νησάκια, βράχοι, ξέρες, κάβοι, κόλποι), όπως στους ναυτικούς χάρτες.
Πηγή: OpenStreetMap (αποσπάσματα Geofabrik Ελλάδας και Κύπρου), (c) OpenStreetMap contributors, ODbL 1.0.
Γράφει sea-names.js:
  window.ALKYON_SEA_NAMES=[[όνομα, αγγλικά ή '', lat, lon, είδος, μέγεθος], ...]
  είδος: i νησί, l νησάκι, r βράχος, s ξέρα/ύφαλος, c κάβος, b κόλπος, p χερσόνησος, t στενό
  μέγεθος: περίπου η διάσταση σε μοίρες (0 για σημείο), για να ξέρει ο χάρτης από ποιο ζουμ να το δείχνει
Τρέχει από το seanames-sync.yml. Αν κάτι πάει στραβά δεν αλλάζει το αρχείο.
Χρήση: python3 tools/seanames_build.py greece.osm.pbf cyprus.osm.pbf"""
import json, os, re, sys, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from places_build import grid, near_sea  # noqa: E402  (ίδιο raster ξηράς/θάλασσας)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'sea-names.js')
GREEK = re.compile('[Α-Ωα-ωάέήίόύώϊϋΐΰ]')


def kind_of(t):
    pl, nat, sm = t.get('place'), t.get('natural'), t.get('seamark:type')
    if pl == 'islet': return 'l'
    if pl == 'island': return 'i'
    if nat in ('reef', 'shoal') or sm in ('rock',) and t.get('seamark:rock:water_level') in ('submerged', 'awash', 'covers'): return 's'
    if nat in ('rock', 'bare_rock', 'stone') or sm == 'rock': return 'r'
    if nat == 'cape': return 'c'
    if nat == 'bay': return 'b'
    if nat == 'peninsula': return 'p'
    if nat == 'strait': return 't'
    return None


def collect(paths):
    import osmium
    els = []; cnt = {'n': 0, 'w': 0, 'wk': 0, 'r': 0}

    def keep(t):
        return (t.get('name') or t.get('seamark:name')) and kind_of(t)

    def tg(t):
        return {k: t.get(k) for k in ('name', 'name:el', 'name:en', 'int_name', 'seamark:name', 'place', 'natural', 'seamark:type', 'seamark:rock:water_level') if t.get(k)}

    class H(osmium.SimpleHandler):
        def node(self, n):
            if not keep(n.tags) or not n.location.valid(): return
            cnt['n'] += 1
            els.append((n.location.lat, n.location.lon, 0.0, tg(n.tags)))

        def relation(self, r):
            if keep(r.tags): cnt['r'] += 1

        def way(self, w):
            cnt['w'] += 1
            if not keep(w.tags): return
            cnt['wk'] += 1
            pts = [(nd.location.lat, nd.location.lon) for nd in w.nodes if nd.location.valid()]
            if len(pts) < 2: return
            la = [p[0] for p in pts]; lo = [p[1] for p in pts]
            ext = max(max(la) - min(la), max(lo) - min(lo))
            # σημείο για την ετικέτα: το κέντρο των κορυφών (για κλειστά σχήματα αρκεί)
            els.append((sum(la) / len(la), sum(lo) / len(lo), ext, tg(w.tags)))

    for p in paths:
        H().apply_file(p, locations=True)
        print('elements so far', len(els), cnt)
    return els


def in_area(lat, lon):
    return 33.0 <= lat <= 42.0 and 19.0 <= lon <= 36.0


def main():
    G = grid(); out = {}
    for lat, lon, ext, t in collect(sys.argv[1:]):
        if not in_area(lat, lon): continue
        k = kind_of(t)
        name = (t.get('name:el') or t.get('name') or t.get('seamark:name') or '').strip()
        en = (t.get('name:en') or t.get('int_name') or '').strip()
        if not GREEK.search(name):
            if en and not GREEK.search(en): name, en = en, ''
            elif not name: continue
        name = re.sub(r'\s+', ' ', name)
        if len(name) > 40: continue
        # οι βράχοι και οι κόλποι μόνο κοντά στη θάλασσα (υπάρχουν πολλοί στη στεριά/σε λίμνες)
        if k in ('r', 'b', 'p') and not near_sea(G, lat, lon, 3): continue
        if k == 'c' and not near_sea(G, lat, lon, 4): continue
        key = (name, round(lat, 2), round(lon, 2))
        if key in out and out[key][5] >= ext: continue
        out[key] = [name, en if en != name else '', round(lat, 5), round(lon, 5), k, round(ext, 3)]
    rows = sorted(out.values(), key=lambda r: (-r[5], r[0]))
    if len(rows) < 2000: raise SystemExit('too few names: %d' % len(rows))
    head = ('/* Ονόματα της θάλασσας (Ελλάδα, Κύπρος): [όνομα, αγγλικά, lat, lon, είδος i/l/r/s/c/b/p/t, μέγεθος σε μοίρες].\n'
            '   Πηγή: OpenStreetMap (Geofabrik), (c) OpenStreetMap contributors, ODbL 1.0. Φτιάχνεται από το seanames-sync.yml (%s). */\n' % time.strftime('%Y-%m-%d'))
    open(OUT, 'w', encoding='utf-8').write(head + 'window.ALKYON_SEA_NAMES=' + json.dumps(rows, ensure_ascii=False, separators=(',', ':')) + ';\n')
    from collections import Counter
    print('names', len(rows), dict(Counter(r[4] for r in rows)))


if __name__ == '__main__': main()
