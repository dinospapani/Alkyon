"""Alkyon 1.11.0: παραθαλάσσια μέρη της Ελλάδας (για «Κοντά: …», «Πού είναι ήρεμα τώρα» και την περιοχή του χρήστη).
Πηγή: OpenStreetMap (Overpass API), (c) OpenStreetMap contributors, ODbL 1.0.
Κρατά πόλεις, χωριά, οικισμούς και λιμάνια με όνομα, που έχουν θάλασσα σε απόσταση ~1,5 km
(με το raster ξηράς/θάλασσας του coastgrid.js). Γράφει gr-places.js:
  window.ALKYON_GR_PLACES=[[όνομα, όνομα αγγλικά ή '', lat, lon, βαθμός (3 πόλη, 2 χωριό/λιμάνι, 1 οικισμός)], ...]
Τρέχει από το places-sync.yml (GitHub Actions). Αν κάτι πάει στραβά δεν αλλάζει το αρχείο."""
import base64, json, math, os, re, sys, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'gr-places.js')
UA = 'Alkyon-places/1.0 (fishing app; https://github.com/dinospapani/Alkyon)'
# μικρά πλαίσια (1,5° × 1,5°) ώστε κάθε ερώτημα να τελειώνει γρήγορα· η χώρα ελέγχεται μετά (region) 
Q = """[out:json][timeout:180][bbox:{s},{w},{n},{e}];
(
  node["place"~"^(city|town|village|hamlet|suburb|neighbourhood|locality|isolated_dwelling|island|islet)$"]["name"];
  nwr["leisure"="marina"]["name"];
  nwr["harbour"="yes"]["name"];
  nwr["seamark:type"="harbour"]["seamark:name"];
);
out center tags;"""
SERVERS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter']


def grid():
    s = open(os.path.join(ROOT, 'coastgrid.js'), encoding='utf-8').read()
    m = re.search(r"lon0:([\d.]+),lat1:([\d.]+),step:([\d.]+),w:(\d+),h:(\d+),rle:'([^']+)'", s)
    lon0, lat1, step, w, h, rle = float(m[1]), float(m[2]), float(m[3]), int(m[4]), int(m[5]), m[6]
    b = base64.b64decode(rle); n = w * h; mask = bytearray(n); i = pos = 0; land = 0
    while i < len(b) and pos < n:
        v = sh = 0
        while True:
            c = b[i]; i += 1; v |= (c & 127) << sh; sh += 7
            if not (c & 128) or i >= len(b): break
        if land: mask[pos:min(n, pos + v)] = b'\x01' * (min(n, pos + v) - pos)
        pos += v; land ^= 1
    assert pos == n, 'coastgrid decode'
    return lon0, lat1, step, w, h, mask


def near_sea(G, lat, lon, cells=6):
    lon0, lat1, step, w, h, mask = G
    c = int((lon - lon0) / step); r = int((lat1 - lat) / step)
    if c < 0 or r < 0 or c >= w or r >= h: return False
    for dr in range(-cells, cells + 1):
        for dc in range(-cells, cells + 1):
            rr, cc = r + dr, c + dc
            if 0 <= rr < h and 0 <= cc < w and dr * dr + dc * dc <= cells * cells and not mask[rr * w + cc]: return True
    return False


def region(lat, lon):
    """ίδιο με το AK.region της εφαρμογής: Ελλάδα χωρίς τα τουρκικά παράλια"""
    if lat < 34.75 or lat > 41.8 or lon < 19.2 or lon > 29.8: return False
    if lat > 40.6 and lon > 26.65: return False
    if 38.45 < lat <= 40.6 and lon > 26.64: return False
    if 38.15 < lat <= 38.45 and lon > 26.24: return False
    if 37.3 < lat <= 38.15 and lon > 27.15: return False
    if 36.93 < lat <= 37.3 and lon > 27.38: return False
    if 36.68 < lat <= 36.93 and lon > 27.45: return False
    if 36.0 < lat <= 36.68 and lon > 28.3 and not (lat < 36.17 and 29.5 < lon < 29.62): return False
    if lon < 20.95 and lat > 39.65 and not (lat < 39.9 and lon < 19.98): return False   # Αλβανία (εκτός βόρειας Κέρκυρας/Οθωνών)
    if lat > 41.1 and lon < 22.9: return False                                          # Β. Μακεδονία / Αλβανία
    return True


def fetch_box(s_, w, n, e):
    data = urllib.parse.urlencode({'data': Q.format(s=s_, w=w, n=n, e=e)}).encode()
    for k in range(8):
        url = SERVERS[k % len(SERVERS)]
        try:
            req = urllib.request.Request(url, data=data, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=240) as r: j = json.load(r)
            if j.get('remark') and not j.get('elements'): raise RuntimeError(j['remark'][:200])
            return j.get('elements', [])
        except Exception as ex:
            print('overpass', url, (s_, w), ex, file=sys.stderr); time.sleep(20)
    raise SystemExit('overpass failed for box %s' % ((s_, w, n, e),))


def fetch():
    els = []; lat = 34.5
    while lat < 42:
        lon = 19.0
        while lon < 30:
            els += fetch_box(lat, lon, min(42, lat + 1.5), min(30, lon + 1.5)); time.sleep(3); lon += 1.5
        lat += 1.5
    print('elements', len(els))
    return {'elements': els}


RANK = {'city': 3, 'town': 3, 'village': 2, 'suburb': 1, 'hamlet': 1, 'neighbourhood': 1, 'locality': 1, 'isolated_dwelling': 1, 'island': 2, 'islet': 1}


def main():
    G = grid(); j = fetch(); out = {}
    for e in j.get('elements', []):
        t = e.get('tags', {}); lat = e.get('lat') or (e.get('center') or {}).get('lat'); lon = e.get('lon') or (e.get('center') or {}).get('lon')
        if lat is None or lon is None or not region(lat, lon): continue
        name = t.get('name:el') or t.get('name') or t.get('seamark:name') or ''
        if not re.search('[Α-Ωα-ωάέήίόύώϊϋΐΰ]', name): continue          # μόνο με ελληνικό όνομα
        name = re.sub(r'\s+', ' ', name).strip()
        if len(name) > 40: continue
        en = (t.get('name:en') or t.get('int_name') or '').strip()
        pl = t.get('place'); rk = RANK.get(pl, 2)
        if t.get('leisure') == 'marina' or t.get('harbour') == 'yes' or t.get('seamark:type') == 'harbour': rk = 2
        if pl in ('island', 'islet'):
            pass                                                         # νησάκια: από μόνα τους είναι «θάλασσα»
        elif not near_sea(G, lat, lon): continue
        key = (name, round(lat, 2), round(lon, 2))
        if key in out and out[key][4] >= rk: continue
        out[key] = [name, en if en != name else '', round(lat, 4), round(lon, 4), rk]
    rows = sorted(out.values(), key=lambda r: (-r[4], r[0]))
    if len(rows) < 1500: raise SystemExit('too few places: %d' % len(rows))
    head = ('/* Παραθαλάσσια μέρη της Ελλάδας: [όνομα, αγγλικά, lat, lon, βαθμός 3 πόλη / 2 χωριό, λιμάνι, νησί / 1 οικισμός].\n'
            '   Πηγή: OpenStreetMap (Overpass), (c) OpenStreetMap contributors, ODbL 1.0. Φτιάχνεται από το places-sync.yml (%s). */\n' % time.strftime('%Y-%m-%d'))
    open(OUT, 'w', encoding='utf-8').write(head + 'window.ALKYON_GR_PLACES=' + json.dumps(rows, ensure_ascii=False, separators=(',', ':')) + ';\n')
    print('places', len(rows), 'by rank', {k: sum(1 for r in rows if r[4] == k) for k in (1, 2, 3)})


if __name__ == '__main__': main()
