#!/usr/bin/env python3
"""Alkyon 1.9.20 · Ραντάρ του Τμήματος Μετεωρολογίας Κύπρου → εικόνες για τον χάρτη.

Πηγή: https://www.dom.org.cy/RADAR_DATA/ (HDF5, ODIM_H5, «experimental», δύο ραντάρ: Νάτα Πάφου και Ριζοελιά Λάρνακας).
Άδεια: ελεύθερη χρήση χωρίς όρους, με αναφορά της πηγής (WIS2 urn:wmo:md:cy-dom:weather.radar).

Τι κάνει σε κάθε εκτέλεση (GitHub Action κάθε 10′):
  1. διαβάζει τη λίστα αρχείων (και υποφακέλους, έως 3 επίπεδα), κρατά τα HDF5 των τελευταίων ~2 ωρών
  2. για κάθε χρονική στιγμή που δεν έχει ήδη εικόνα: παίρνει από κάθε ραντάρ τη χαμηλότερη σάρωση ανακλαστικότητας (DBZH/TH),
     τη μετατρέπει από πολικές συντεταγμένες σε πλέγμα πάνω από την Κύπρο (Web Mercator, ώστε να κάθεται σωστά στον χάρτη),
     ενώνει τα δύο ραντάρ με το μέγιστο και τη ζωγραφίζει με τα συνηθισμένα χρώματα βροχής (διάφανο κάτω από 10 dBZ)
  3. γράφει out/radar.json (λίστα εικόνων, όρια, ώρες) και out/radar-debug.json (δομή του τελευταίου αρχείου, για έλεγχο)
  4. κρατά τις 12 πιο πρόσφατες εικόνες (2 ώρες)

Χρήση: python3 radar_build.py out [--prev DIR] [--local FILE.h5 ...]
"""
import sys, os, re, io, json, math, time, glob, shutil, datetime as dt, urllib.request, urllib.parse
import numpy as np

BASE = os.environ.get('DOM_RADAR_URL', 'https://www.dom.org.cy/RADAR_DATA/')
BASE2 = 'https://agromet.dom.org.cy/uploads/radars/'   # εκεί δείχνουν οι ειδοποιήσεις WIS2 (origin)
BOX = (29.60, 32.70, 36.00, 36.90)          # W, S, E, N: ~250 km γύρω από την Κύπρο, ώστε να φαίνεται η βροχή πριν φτάσει
W_PX = 720                                   # πλάτος εικόνας· το ύψος βγαίνει από την προβολή
KEEP = 12                                    # εικόνες (≈2 ώρες ανά 10′)
MAX_NEW = 4                                  # το πολύ τόσες νέες χρονικές στιγμές ανά εκτέλεση
MAX_AGE_MIN = 150
UA = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 Alkyon-radar/1.1',
      'Accept': 'text/html,application/xhtml+xml,application/octet-stream,*/*;q=0.8'}
# WIS2: όταν η λίστα του φακέλου δεν επιτρέπεται (403), οι διευθύνσεις των αρχείων έρχονται από τις ειδοποιήσεις MQTT των παγκόσμιων brokers
BROKERS = ['globalbroker.meteo.fr', 'wis2globalbroker.nws.noaa.gov', 'gb.wis.cma.cn', 'globalbroker.inmet.gov.br']
TOPICS = ['cache/a/wis2/cy-dom/data/core/weather/experimental/surface-based-observations/radar/#',
          'cache/a/wis2/cy-dom/data/core/weather/experimental/surface-based-observations/radar',
          'origin/a/wis2/cy-dom/data/core/weather/experimental/surface-based-observations/radar/#',
          'origin/a/wis2/cy-dom/data/core/weather/experimental/surface-based-observations/radar']
LISTEN_S = int(os.environ.get('RADAR_LISTEN_S', '540'))   # 9′: το ραντάρ Πάφου στέλνει περίπου κάθε 20–40′

def log(*a): print(*a, flush=True)

# ---------------------------------------------------------------- λίστα αρχείων
def fetch(url, timeout=60):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()

H5RE = re.compile(r'\.(h5|hdf5|hdf|odim)(\.gz)?$', re.I)
LISTLOG = []   # για το radar-debug.json: τι απάντησε κάθε σελίδα λίστας
def listing(url, depth=0, out=None):
    out = out if out is not None else []
    ent = {'url': url}
    if len(LISTLOG) < 12: LISTLOG.append(ent)
    try:
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=60) as r:
            ent['status'] = r.status; ent['type'] = r.headers.get('Content-Type'); raw = r.read()
        html = raw.decode('utf-8', 'replace')
    except Exception as e:
        ent['error'] = repr(e)[:300]; log('list fail', url, e); return out
    hrefs = re.findall(r'href=["\']([^"\'#]+)["\']', html, re.I)
    ent['bytes'] = len(raw); ent['hrefs'] = hrefs[:40]; ent['snippet'] = re.sub(r'\s+', ' ', html)[:1500]
    for href in hrefs:
        full = urllib.parse.urljoin(url, href.split('?')[0] if not H5RE.search(href.split('?')[0]) else href)
        if not full.startswith(BASE) or len(full) <= len(url): continue   # όχι γονικοί φάκελοι ή σύνδεσμοι ταξινόμησης
        if H5RE.search(full.split('?')[0]): out.append(full)
        elif full.endswith('/') and depth < 3: listing(full, depth + 1, out)
    return out

def mqtt_links(seconds, debug):
    """ακούει τις ειδοποιήσεις WIS2 για το ραντάρ της Κύπρου και επιστρέφει τις διευθύνσεις των αρχείων (canonical + cache)"""
    try:
        import paho.mqtt.client as mqtt, ssl
    except Exception as e:
        debug['mqtt'] = 'no paho: ' + repr(e); return []
    got, seen, info = [], set(), {'msgs': 0, 'broker': None, 'errors': [], 'examples': []}
    def on_msg(c, u, m):
        info['msgs'] += 1
        try: j = json.loads(m.payload.decode('utf-8', 'replace'))
        except Exception: return
        if len(info['examples']) < 3: info['examples'].append({'topic': m.topic, 'links': (j.get('links') or [])[:4], 'props': {k: j.get('properties', {}).get(k) for k in ('data_id', 'pubtime', 'datetime')}})
        for l in j.get('links') or []:
            h = l.get('href') or ''
            if h.startswith('http') and l.get('rel') in ('canonical', 'via', 'item', None) and h not in seen:
                seen.add(h); got.append((l.get('rel'), h, (j.get('properties') or {}).get('pubtime')))
    for host in BROKERS:
        try:
            c = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id='alkyon-radar-' + os.urandom(4).hex(), protocol=mqtt.MQTTv311)
            c.username_pw_set('everyone', 'everyone'); c.tls_set(cert_reqs=ssl.CERT_REQUIRED)
            c.on_message = on_msg
            c.on_connect = lambda cl, u, f, rc, p=None: [cl.subscribe(t, qos=0) for t in TOPICS]
            c.connect(host, 8883, keepalive=60); info['broker'] = host
            c.loop_start(); t0 = time.time()
            while time.time() - t0 < seconds:
                time.sleep(2)
                # αρκεί μία στιγμή και από τα δύο ραντάρ
                if len({h.rsplit('/', 1)[-1] for r, h, _ in got if r == 'canonical' and 'dom.org.cy' not in h}) >= 2 and time.time() - t0 > 30: break
            c.loop_stop(); c.disconnect()
            break
        except Exception as e:
            info['errors'].append(host + ': ' + repr(e)[:160])
    debug['mqtt'] = info; debug['mqtt_links'] = [h for _, h, _ in got][:20]
    # προτίμηση στις διευθύνσεις των global cache (όχι dom.org.cy, που δίνει 403 στο GitHub)
    canon, names = [], set()
    for r, h, _ in sorted(got, key=lambda x: 'dom.org.cy' in x[1]):   # ένα αντίγραφο ανά αρχείο, όχι από dom.org.cy αν υπάρχει άλλο
        n = h.rsplit('/', 1)[-1]
        if r == 'canonical' and n not in names: names.add(n); canon.append(h)
    return canon

S3 = 'https://wis2globalcache.s3.amazonaws.com/'
S3P = 'data/cy-dom/data/core/weather/experimental/surface-based-observations/radar/'
def s3_links(debug):
    """η παγκόσμια cache του WIS2 σε S3: αν επιτρέπει λίστα, παίρνουμε όλα τα αρχεία των τελευταίων ωρών (γεμίζουν και τα κενά)"""
    out, tok, info = [], None, {'ok': False}
    try:
        for _ in range(10):
            q = {'list-type': '2', 'prefix': S3P, 'max-keys': '1000'}
            if tok: q['continuation-token'] = tok
            x = fetch(S3 + '?' + urllib.parse.urlencode(q), 60).decode('utf-8', 'replace')
            out += [S3 + k for k in re.findall(r'<Key>([^<]+\.h5)</Key>', x)]
            m = re.search(r'<NextContinuationToken>([^<]+)</NextContinuationToken>', x)
            if not m: break
            tok = m.group(1)
        info['ok'] = True; info['n'] = len(out)
        kinds = {}
        for u in out:
            k = re.sub(r'_?\d{12,14}.*$', '', u.rsplit('/', 1)[-1]); kinds[k] = kinds.get(k, 0) + 1
        info['kinds'] = kinds   # ποια ραντάρ/προϊόντα υπάρχουν (π.χ. LONGRANGE_PFO)
        # κρατάμε το LONGRANGE κάθε ραντάρ (και ό,τι άλλο ραντάρ εκτός Πάφου υπάρχει)
        out = [u for u in out if 'LONGRANGE_' in u or 'PFO' not in u.rsplit('/', 1)[-1]]
    except Exception as e:
        info['error'] = repr(e)[:200]
    debug['s3'] = info
    return out

TS_RES = [re.compile(r'(20\d{2})(\d{2})(\d{2})[T_\-]?(\d{2})(\d{2})(\d{2})?'),
          re.compile(r'(20\d{2})[\-_](\d{2})[\-_](\d{2})[T_\- ](\d{2})[:\-_]?(\d{2})')]
def ts_of_name(name):
    b = os.path.basename(name)
    for rx in TS_RES:
        m = rx.search(b) or rx.search(name)
        if m:
            g = m.groups()
            try: return dt.datetime(int(g[0]), int(g[1]), int(g[2]), int(g[3]), int(g[4]), tzinfo=dt.timezone.utc)
            except ValueError: pass
    return None

# ---------------------------------------------------------------- ODIM
def attrs(obj):
    d = {}
    for k, v in obj.attrs.items():
        if isinstance(v, bytes): v = v.decode('utf-8', 'replace')
        elif isinstance(v, np.ndarray): v = v.tolist()
        elif isinstance(v, np.generic): v = v.item()
        d[k] = v
    return d

def grp_attrs(f, path):
    return attrs(f[path]) if path in f else {}

def dump(f, maxn=120):
    """δομή του αρχείου για διάγνωση"""
    out = []
    def visit(name, obj):
        if len(out) >= maxn: return
        e = {'path': name, 'kind': 'dataset' if hasattr(obj, 'shape') else 'group'}
        if hasattr(obj, 'shape'): e['shape'] = list(obj.shape); e['dtype'] = str(obj.dtype)
        a = attrs(obj)
        if a: e['attrs'] = {k: (v if not isinstance(v, (list, str)) or len(str(v)) < 200 else str(v)[:200]) for k, v in a.items()}
        out.append(e)
    e0 = {'path': '/', 'kind': 'group', 'attrs': attrs(f)}
    out.append(e0)
    for k in f.keys():   # πρώτα what/where/how, μετά μόνο η πρώτη σάρωση
        if not re.match(r'(scan|dataset)\d+$', k): visit(k, f[k]); (f[k].visititems(lambda n, o: visit(k + '/' + n, o)) if hasattr(f[k], 'visititems') else None)
    first = next((k for k in f.keys() if re.match(r'(scan|dataset)\d+$', k)), None)
    if first: visit(first, f[first]); f[first].visititems(lambda n, o: visit(first + '/' + n, o))
    out.append({'path': '(keys)', 'kind': 'info', 'attrs': {'top': list(f.keys())[:40]}})
    return out

QPREF = ['DBZH', 'TH', 'DBZ', 'DBZV', 'TV']
# γνωστές θέσεις των ραντάρ του ΤΜ (εφεδρικά, αν το αρχείο δεν έχει /where)
SITES = {'PFO': (34.77085, 32.54716, 392.0), 'NAT': (34.77085, 32.54716, 392.0)}   # από το /where των αρχείων του ΤΜ (Πάφος)
def gamic_sweeps(f):
    """GAMIC (Enigma/FROG) HDF5: scanN/moment_K με dyn_range_min/max, scanN/how (elevation, range_step, range_samples), scanN/ray_header (αζιμούθια)"""
    wh = grp_attrs(f, 'where'); wt = grp_attrs(f, 'what'); hw = grp_attrs(f, 'how')
    site = str(hw.get('site_name', '')).upper()
    lat, lon, hgt = wh.get('lat'), wh.get('lon'), wh.get('height', 0)
    guessed = False
    if lat is None or lon is None:
        if site in SITES: lat, lon, hgt = SITES[site]; guessed = True
    out = []
    for sk in sorted([k for k in f.keys() if re.match(r'scan\d+$', k)], key=lambda k: int(k[4:])):
        g = f[sk]; sh = grp_attrs(f, sk + '/how')
        if 'elevation' not in sh: continue
        mom = None
        for mk in g.keys():
            if not mk.startswith('moment_'): continue
            a = attrs(g[mk]); m = str(a.get('moment', ''))
            if m in ('Zh', 'UZh', 'Z', 'UZ'):
                if mom is None or (m == 'Zh'): mom = (mk, a)
        if not mom: continue
        mk, a = mom
        raw = np.array(g[mk], dtype=np.float64)
        lo_, hi_ = float(a.get('dyn_range_min', -32)), float(a.get('dyn_range_max', 95.5))
        nmax = 65534.0 if str(a.get('format', '')).upper() == 'UV16' or g[mk].dtype == np.uint16 else 254.0
        val = lo_ + (raw - 1.0) * (hi_ - lo_) / nmax
        val[raw == 0] = np.nan
        az = None
        if 'ray_header' in g:
            rh = np.array(g['ray_header'])
            try:
                a0 = rh['azimuth_start'].astype(float); a1 = rh['azimuth_stop'].astype(float)
                az = (a0 + ((a1 - a0) % 360.0) / 2.0) % 360.0
            except Exception: az = None
        ts = None
        try: ts = dt.datetime.strptime(str(sh.get('timestamp', wt.get('date', '')))[:19], '%Y-%m-%dT%H:%M:%S').replace(tzinfo=dt.timezone.utc)
        except Exception: pass
        rstep = float(sh.get('range_step', 100.0)) * float(sh.get('range_samples', 1) or 1)
        out.append(dict(elangle=float(sh['elevation']), data=val, rscale=rstep, rstart=float(sh.get('range_start', 0.0)),
                        lat=float(lat) if lat is not None else None, lon=float(lon) if lon is not None else None, height=float(hgt or 0),
                        ts=ts, q=str(a.get('moment')), obj='PVOL', source=site + (' (θέση από πίνακα)' if guessed else ''), az=az))
    return out

def sweeps(f):
    if 'scan0' in f and not any(k.startswith('dataset') for k in f.keys()): return gamic_sweeps(f)
    """→ λίστα σαρώσεων με ανακλαστικότητα: (elangle, data(dBZ, nrays×nbins), rscale, rstart_m, lat, lon, height, ts)"""
    root_where = grp_attrs(f, 'where'); root_what = grp_attrs(f, 'what')
    lat0, lon0, hgt = root_where.get('lat'), root_where.get('lon'), root_where.get('height', 0)
    out = []
    for ds in sorted([k for k in f.keys() if k.startswith('dataset')], key=lambda k: int(re.sub(r'\D', '', k) or 0)):
        g = f[ds]; dw = grp_attrs(f, ds + '/where'); dwhat = grp_attrs(f, ds + '/what')
        if 'elangle' not in dw or 'nbins' not in dw: continue
        best = None
        for dk in [k for k in g.keys() if k.startswith('data')]:
            wq = grp_attrs(f, f'{ds}/{dk}/what'); q = str(wq.get('quantity', dwhat.get('quantity', '')))
            if q in QPREF and (best is None or QPREF.index(q) < QPREF.index(best[0])): best = (q, dk, wq)
        if not best: continue
        q, dk, wq = best
        raw = np.array(f[f'{ds}/{dk}/data'], dtype=np.float64)
        gain = float(wq.get('gain', dwhat.get('gain', 1.0))); off = float(wq.get('offset', dwhat.get('offset', 0.0)))
        nod = wq.get('nodata', dwhat.get('nodata')); und = wq.get('undetect', dwhat.get('undetect'))
        val = raw * gain + off
        mask = np.zeros(raw.shape, bool)
        if nod is not None: mask |= raw == float(nod)
        if und is not None: mask |= raw == float(und)
        val[mask] = np.nan
        sd = dwhat.get('startdate', root_what.get('date')); stt = dwhat.get('starttime', root_what.get('time'))
        ts = None
        try: ts = dt.datetime.strptime(str(sd) + str(stt)[:6], '%Y%m%d%H%M%S').replace(tzinfo=dt.timezone.utc)
        except Exception: pass
        out.append(dict(elangle=float(dw['elangle']), data=val, rscale=float(dw.get('rscale', 1000.0)), rstart=float(dw.get('rstart', 0.0)) * 1000.0,
                        lat=float(dw.get('lat', lat0)) if dw.get('lat', lat0) is not None else None,
                        lon=float(dw.get('lon', lon0)) if dw.get('lon', lon0) is not None else None,
                        height=float(dw.get('height', hgt) or 0), ts=ts, q=q, obj=str(root_what.get('object', '')),
                        source=str(root_what.get('source', ''))))
    return out

# ---------------------------------------------------------------- πλέγμα (Web Mercator)
def merc_y(lat): return math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))
def grid():
    w, s, e, n = BOX
    ys, yn = merc_y(s), merc_y(n)
    h_px = int(round(W_PX * (yn - ys) / math.radians(e - w)))
    lons = np.linspace(w, e, W_PX, endpoint=False) + (e - w) / W_PX / 2
    my = np.linspace(yn, ys, h_px, endpoint=False) - (yn - ys) / h_px / 2
    lats = np.degrees(2 * np.arctan(np.exp(my)) - math.pi / 2)
    return np.meshgrid(lons, lats)  # LON, LAT (h×w)

RE_EFF = 6371000.0 * 4 / 3
def polar_to_grid(sw, LON, LAT):
    """ανακλαστικότητα μιας σάρωσης πάνω στο πλέγμα (NaN έξω από την εμβέλεια)"""
    lat0, lon0 = math.radians(sw['lat']), math.radians(sw['lon'])
    la, lo = np.radians(LAT), np.radians(LON)
    dlo = lo - lon0
    # απόσταση και αζιμούθιο πάνω στη σφαίρα
    a = np.sin((la - lat0) / 2) ** 2 + math.cos(lat0) * np.cos(la) * np.sin(dlo / 2) ** 2
    ground = 2 * 6371000.0 * np.arcsin(np.sqrt(np.clip(a, 0, 1)))
    az = (np.degrees(np.arctan2(np.sin(dlo) * np.cos(la), math.cos(lat0) * np.sin(la) - math.sin(lat0) * np.cos(la) * np.cos(dlo))) + 360) % 360
    el = math.radians(sw['elangle'])
    # πλάγια απόσταση με το μοντέλο 4/3 της Γης
    slant = ground / math.cos(el) if el < 0.2 else RE_EFF * np.sin(ground / RE_EFF) / np.cos(el + ground / RE_EFF)
    data = sw['data']; nrays, nbins = data.shape
    b = np.floor((slant - sw['rstart']) / sw['rscale']).astype(np.int64)
    if sw.get('az') is not None and len(sw['az']) == nrays:
        # οι ακτίνες δεν ξεκινούν από τον βορρά: πίνακας 0,1° → πλησιέστερη ακτίνα
        grid_az = np.arange(3600) / 10.0
        d = np.abs(((grid_az[:, None] - np.asarray(sw['az'])[None, :]) + 180.0) % 360.0 - 180.0)
        lut = np.argmin(d, axis=1); ok_az = d[np.arange(3600), lut] <= 1.5
        ai = np.floor(az * 10).astype(np.int64) % 3600
        r = lut[ai]; az_ok = ok_az[ai]
    else:
        r = np.floor(az / (360.0 / nrays)).astype(np.int64) % nrays; az_ok = True
    ok = (b >= 0) & (b < nbins) & az_ok
    out = np.full(LON.shape, np.nan)
    out[ok] = data[r[ok], b[ok]]
    return out

# χρώματα βροχής (dBZ → RGBA), σαν τα συνηθισμένα ραντάρ
PAL = [(10, (120, 200, 255, 110)), (15, (60, 150, 245, 150)), (20, (30, 110, 230, 175)), (25, (20, 180, 70, 190)), (30, (10, 140, 40, 200)),
       (35, (250, 225, 30, 210)), (40, (250, 160, 20, 220)), (45, (240, 70, 20, 230)), (50, (205, 0, 20, 235)), (55, (180, 0, 140, 240)), (60, (255, 255, 255, 245))]
def despeckle(z, thr=10.0, need=3):
    """σβήνει μεμονωμένα σημεία (θόρυβος, ηχώ εδάφους): κρατά ένα pixel μόνο αν έχει τουλάχιστον `need` γείτονες με βροχή"""
    m = np.nan_to_num(z, nan=-99) >= thr
    p = np.pad(m, 1).astype(np.int8)
    nb = sum(p[1 + dy:p.shape[0] - 1 + dy, 1 + dx:p.shape[1] - 1 + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dy or dx)
    z = z.copy(); z[m & (nb < need)] = np.nan
    return z

def colorize(z):
    h_, w_ = z.shape; img = np.zeros((h_, w_, 4), np.uint8)
    for i, (t, c) in enumerate(PAL):
        hi = PAL[i + 1][0] if i + 1 < len(PAL) else 999
        m = (z >= t) & (z < hi)
        img[m] = c
    return img

# ---------------------------------------------------------------- κύρια ροή
def load_h5(path_or_bytes):
    import h5py
    if isinstance(path_or_bytes, (bytes, bytearray)):
        if path_or_bytes[:2] == b'\x1f\x8b':
            import gzip; path_or_bytes = gzip.decompress(path_or_bytes)
        return h5py.File(io.BytesIO(path_or_bytes), 'r')
    return h5py.File(path_or_bytes, 'r')

def build_frame(files, LON, LAT, debug):
    """files: λίστα (όνομα, bytes|path) για την ίδια χρονική στιγμή (ένα ή περισσότερα ραντάρ/σαρώσεις)"""
    acc = np.full(LON.shape, np.nan); used = []; ts = None
    by_site = {}
    for name, src in files:
        try:
            f = load_h5(src)
        except Exception as e:
            log('h5 open fail', name, e); continue
        with f:
            if not debug.get('files'): debug['files'] = []
            if len(debug['files']) < 2: debug['files'].append({'name': name, 'tree': dump(f)})
            for sw in sweeps(f):
                if sw['lat'] is None or sw['lon'] is None: continue
                key = (round(sw['lat'], 2), round(sw['lon'], 2))
                by_site.setdefault(key, []).append(sw)
                ts = ts or sw['ts']
    for key, sws in by_site.items():
        sws.sort(key=lambda s: s['elangle'])
        low = [s for s in sws if s['elangle'] >= 0.0][:2] or sws[:1]   # οι δύο χαμηλότερες σαρώσεις, με το μέγιστο
        for sw in low:
            g = polar_to_grid(sw, LON, LAT)
            acc = np.fmax(acc, g)
        used.append({'site': list(key), 'elev': [s['elangle'] for s in low], 'q': low[0]['q'], 'src': low[0]['source'][:80]})
    return acc, used, ts

def main():
    global BASE
    args = sys.argv[1:]
    if not args: print(__doc__); sys.exit(1)
    out = args[0]; prev = None; local = []
    if '--prev' in args: prev = args[args.index('--prev') + 1]
    if '--local' in args: local = args[args.index('--local') + 1:]
    os.makedirs(out, exist_ok=True)
    from PIL import Image
    LON, LAT = grid()
    meta = {'frames': []}
    if prev and os.path.exists(os.path.join(prev, 'radar.json')):
        try:
            meta = json.load(open(os.path.join(prev, 'radar.json')))
            w0, s0, e0, n0 = BOX
            if meta.get('bounds') != [[s0, w0], [n0, e0]]: meta = {'frames': []}   # άλλαξε το πλαίσιο: οι παλιές εικόνες δεν ταιριάζουν
            for fr in meta.get('frames', []):
                p = os.path.join(prev, fr['img'])
                if os.path.exists(p): shutil.copy(p, os.path.join(out, fr['img']))
        except Exception as e: log('prev fail', e); meta = {'frames': []}
    have = {fr['t'] for fr in meta.get('frames', [])}
    debug = {'run': dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds'), 'base': BASE}
    now = dt.datetime.now(dt.timezone.utc)

    # ομάδες ανά χρονική στιγμή (στρογγυλεμένη στα 5′)
    groups = {}
    if local:
        for p in local:
            try:
                with load_h5(p) as f: sw = sweeps(f); ts = next((s['ts'] for s in sw if s['ts']), None)
            except Exception as e: log('local fail', p, e); continue
            ts = ts or ts_of_name(p) or now
            k = ts.replace(minute=ts.minute - ts.minute % 5, second=0, microsecond=0)
            groups.setdefault(k, []).append((os.path.basename(p), p))
    else:
        urls = listing(BASE)
        if not urls:   # δεύτερη πηγή: ο φάκελος που δείχνουν οι ειδοποιήσεις
            b0 = BASE; BASE = BASE2
            try: urls = listing(BASE2)
            finally: BASE = b0
        debug['listed'] = len(urls); debug['sample'] = urls[-8:]; debug['pages'] = LISTLOG
        if not urls:
            s3 = s3_links(debug); now_ = dt.datetime.now(dt.timezone.utc)
            urls = [u for u in s3 if ts_of_name(u) and (now_ - ts_of_name(u)).total_seconds() / 60 <= MAX_AGE_MIN]
            if urls: log('from S3', len(urls))
        if not urls and LISTEN_S > 0:
            urls = mqtt_links(LISTEN_S, debug)
            if urls: log('from WIS2', urls)
        dated = []
        for u in urls:
            t = ts_of_name(u)
            if t and (now - t).total_seconds() / 60 <= MAX_AGE_MIN: dated.append((t, u))
        if not dated and urls:  # χωρίς ημερομηνία στο όνομα: τα τελευταία αρχεία της λίστας
            dated = [(None, u) for u in urls[-6:]]
        for t, u in dated:
            k = t.replace(minute=t.minute - t.minute % 5, second=0, microsecond=0) if t else None
            groups.setdefault(k, []).append((u, u))
    keys = sorted([k for k in groups if k is not None], reverse=True)
    if None in groups: keys = [None] + keys
    new = 0
    for k in keys:
        tkey = k.strftime('%Y%m%d%H%M') if k else None
        if tkey and tkey in have: continue
        if new >= MAX_NEW: break
        files = []
        for name, src in groups[k]:
            if isinstance(src, str) and src.startswith('http'):
                try: files.append((name, fetch(src, 120)))
                except Exception as e: log('get fail', src, e); debug.setdefault('get_errors', []).append(src[-90:] + ' → ' + repr(e)[:160])
            else: files.append((name, src))
        z, used, ts = build_frame(files, LON, LAT, debug)
        if not used: log('no reflectivity in', [n for n, _ in files]); continue
        ts = ts or k or now
        tkey = ts.strftime('%Y%m%d%H%M')
        if tkey in have: continue
        img = colorize(despeckle(z))
        name = f'radar_{tkey}.png'
        Image.fromarray(img, 'RGBA').save(os.path.join(out, name), optimize=True)
        meta['frames'].append({'t': tkey, 'img': name, 'sites': used, 'max': None if np.all(np.isnan(z)) else round(float(np.nanmax(z)), 1)})
        have.add(tkey); new += 1
        log('frame', tkey, used)
    # μόνο οι τελευταίες KEEP, και όχι παλιότερες από 3 ώρες
    fr = sorted(meta['frames'], key=lambda x: x['t'])
    cutoff = (now - dt.timedelta(hours=3)).strftime('%Y%m%d%H%M') if not local else '0'
    fr = [x for x in fr if x['t'] >= cutoff][-KEEP:]
    keep = {x['img'] for x in fr}
    for p in glob.glob(os.path.join(out, 'radar_*.png')):
        if os.path.basename(p) not in keep: os.remove(p)
    w, s, e, n = BOX
    meta = {'frames': fr, 'bounds': [[s, w], [n, e]], 'updated': now.isoformat(timespec='seconds'),
            'source': 'Τμήμα Μετεωρολογίας Κύπρου (dom.org.cy) · WIS2', 'legend': [[t, list(c)] for t, c in PAL], 'proj': 'webmercator', 'new': new}
    json.dump(meta, open(os.path.join(out, 'radar.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    json.dump(debug, open(os.path.join(out, 'radar-debug.json'), 'w'), ensure_ascii=False, indent=1, default=str)
    log('frames', len(fr), 'new', new)

if __name__ == '__main__':
    main()
