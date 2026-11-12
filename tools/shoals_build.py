"""Alkyon 1.13.6: ξέρες, βράχοι κάτω από το νερό, ναυάγια και εμπόδια (Ελλάδα και Κύπρος) για το στρώμα «Ρηχά & ξέρες».
Πηγή: OpenStreetMap (Geofabrik), (c) OpenStreetMap contributors, ODbL 1.0.
Κρατά seamark:type=rock|wreck|obstruction (όχι «dry») και natural=reef|shoal. Γράφει shoals.js:
  window.ALKYON_SHOALS=[[lat, lon, βάθος m ή null, κωδικός, όνομα ή ''], ...]
  κωδικός: r βράχος κάτω από το νερό, a βράχος στην επιφάνεια, c βράχος που σκεπάζεται, R βράχος, w ναυάγιο, o εμπόδιο, f ύφαλος, s ξέρα
Χρήση: python3 tools/shoals_build.py greece.osm.pbf cyprus.osm.pbf  (το καλεί το shoals-sync.yml). Αν βγει λίγα, δεν αλλάζει το αρχείο."""
import json, os, re, sys
import osmium

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'shoals.js')
WL = ('seamark:rock:water_level', 'seamark:wreck:water_level', 'seamark:obstruction:water_level')
DEP = ('depth', 'seamark:sounding', 'seamark:rock:value_of_sounding', 'seamark:wreck:value_of_sounding', 'seamark:obstruction:value_of_sounding', 'wreck:depth')


def code(t):
    ty = t.get('seamark:type') or t.get('natural')
    wl = next((t.get(k) for k in WL if t.get(k)), '')
    if ty not in ('rock', 'wreck', 'obstruction', 'reef', 'shoal') or wl == 'dry':
        return None
    if ty == 'rock':
        return {'submerged': 'r', 'awash': 'a', 'covers': 'c'}.get(wl, 'R')
    return {'wreck': 'w', 'obstruction': 'o', 'reef': 'f', 'shoal': 's'}[ty]


def depth(t):
    for k in DEP:
        v = t.get(k)
        if v:
            m = re.search(r'-?\d+(?:[.,]\d+)?', v)
            if m:
                d = abs(float(m.group(0).replace(',', '.')))
                if d < 500:
                    return round(d, 1)
    return None


class H(osmium.SimpleHandler):
    def __init__(self):
        super().__init__(); self.out = []

    def add(self, tags, lat, lon):
        t = {k: v for k, v in tags}
        c = code(t)
        if not c or lat is None:
            return
        nm = (t.get('name:el') or t.get('name') or t.get('seamark:name') or '').replace('"', "'")[:40]
        self.out.append([round(lat, 5), round(lon, 5), depth(t), c, nm])

    def node(self, n):
        if 'seamark:type' in n.tags or 'natural' in n.tags:
            self.add(n.tags, n.location.lat, n.location.lon)

    def way(self, w):
        if 'seamark:type' not in w.tags and w.tags.get('natural') not in ('reef', 'shoal'):
            return
        if not code({k: v for k, v in w.tags}):
            return
        try:
            pts = [(nd.location.lat, nd.location.lon) for nd in w.nodes if nd.location.valid()]
        except Exception:
            pts = []
        if pts:
            self.add(w.tags, sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))


def main(files):
    h = H()
    for f in files:
        h.apply_file(f, locations=True)
    seen, rows = set(), []
    for r in h.out:
        k = (round(r[0], 4), round(r[1], 4), r[3])
        if k in seen:
            continue
        seen.add(k); rows.append(r)
    rows.sort(key=lambda r: (r[0], r[1]))
    print('shoals:', len(rows))
    if len(rows) < 1000:
        print('λίγα αποτελέσματα, δεν αλλάζει το shoals.js'); return
    body = json.dumps(rows, ensure_ascii=False, separators=(',', ':'))
    open(OUT, 'w', encoding='utf-8').write('/* Ξέρες, βράχοι, ναυάγια, εμπόδια (Ελλάδα, Κύπρος). (c) OpenStreetMap contributors, ODbL 1.0. Από tools/shoals_build.py */\nwindow.ALKYON_SHOALS=' + body + ';\n')


if __name__ == '__main__':
    main(sys.argv[1:])
