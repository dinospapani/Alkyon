"""Improved Clinch σε Lottie, από 3D μοντέλο.
Κάθε πετονιά = καμπύλη (x, y, z) με παράμετρο s (0 χαλαρό, 1 σφιγμένο). z > 0 = προς τον θεατή.
Η καμπύλη κόβεται σε μικρά κομμάτια, κάθε κομμάτι μια ομάδα Lottie, ταξινομημένα κατά βάθος:
έτσι σε κάθε διασταύρωση φαίνεται σωστά ποια πετονιά περνά από πάνω."""
import json, math, sys

FR = 30; STEP = 60; N_STEPS = 5; OP = STEP * N_STEPS
R = 38.0            # ακτίνα κρίκου (κέντρο του σύρματος)
LW = 9.0            # πάχος πετονιάς
OUT = 6.0           # σκούρο περίγραμμα
GREY = '#D3DCE0'; ORANGE = '#E8743B'; METAL = '#8C9BA3'; DARK = '#05090D'

def lerp(a, b, t): return a + (b - a) * t
def bez(p0, p1, p2, p3, u):
    a = (1 - u) ** 3; b = 3 * (1 - u) ** 2 * u; c = 3 * (1 - u) * u * u; d = u ** 3
    return tuple(a * p0[k] + b * p1[k] + c * p2[k] + d * p3[k] for k in range(len(p0)))
def smooth(t): t = max(0.0, min(1.0, t)); return t * t * (3 - 2 * t)

def P(s):
    """παράμετροι γεωμετρίας για σφίξιμο s"""
    r = lerp(15.0, 8.6, s)          # απόσταση στροφών από τον άξονα της κύριας
    p = lerp(30.0, 10.0, s)         # βήμα στροφής
    x1 = lerp(R + 62, R + 17, s)    # αρχή στροφών
    return dict(r=r, p=p, x1=x1, x2=x1 + 5 * p)

# ---------- καμπύλες: λίστα από (όνομα, χρώμα, βήμα, συνάρτηση u->(x,y,z), δείγματα) ----------
def main_line(u, s):                       # από δεξιά ως λίγο πριν τον κρίκο
    x = lerp(560, R + 10, u); return (x, -5.0 * smooth((u - 0.9) / 0.1), 0.0)
def hairpin(u, s):                         # μέσα από τον κρίκο: πάνω από το σύρμα, μέσα στην τρύπα, κάτω από το σύρμα
    q = P(s); r = q['r']
    a = math.pi * u
    cx = lerp(R + 10, R + 7, s); half = r / 2 + 5; ym = r / 2
    depth = 31.0
    x = cx - depth * math.sin(a); y = ym - half * math.cos(a)
    z = 8.0 * math.cos(a)
    return (x, y, z)
def tag_run(u, s):                         # η άκρη πίσω προς τις στροφές
    q = P(s); r = q['r']; return (lerp(R + 10, q['x1'], u), r + 5 * (1 - smooth(u * 3)), lerp(-8.0, 0.0, smooth(u * 2)))
def helix(u, s):
    q = P(s); th = 10 * math.pi * u
    return (q['x1'] + q['p'] * th / (2 * math.pi), q['r'] * math.cos(th), q['r'] * math.sin(th) * 1.15)
def arc(u, s):                             # η μεγάλη θηλιά, και μέσα από τη μικρή
    q = P(s); r = q['r']; k = lerp(1, 0.06, s); e = lerp(6, 3, s)
    p0 = (q['x2'], r); p1 = (q['x2'] + 26 * k + 4, r + 52 * k + e); p2 = (R + 2, r + 52 * k + e); p3 = (R + 15, r)
    if u < 0.88:
        v = u / 0.88; x, y = bez(p0, p1, p2, p3, v)
        z = 11.0 * smooth(v * 6)           # μπροστά από ό,τι περνά
        return (x, y, z)
    v = (u - 0.88) / 0.12                  # μπαίνει στη μικρή θηλιά (ανάμεσα σε κύρια και άκρη) και πάει πίσω
    return (R + 15 + 1.5 * v, lerp(r, r * 0.42, v), lerp(11.0, -11.0, smooth(v)))
def back(u, s):                            # πίσω από την άκρη, μέσα στη μεγάλη θηλιά, βγαίνει μπροστά
    q = P(s); r = q['r']; k = lerp(1, 0.25, s)
    p0 = (R + 16.5, r * 0.42, -11); p1 = (R + 20, r + 16 * k, -11); p2 = (R + 26 + 8 * k, r + 26 * k + 3, -10); p3 = (R + 40 + 14 * k, r + 20 * k + 4, 0)
    if u < 0.6:
        return bez(p0, p1, p2, p3, u / 0.6)
    v = (u - 0.6) / 0.4                    # η κομμένη άκρη, μπροστά
    x0, y0, _ = p3
    return (x0 + lerp(0, 34 * k + 8, v), y0 - lerp(0, 5 * k, v), lerp(0, 10, smooth(v * 3)))

CURVES = [  # name, color, step (0-based), fn, samples
    ('main', GREY, 0, main_line, 70),
    ('hairpin', ORANGE, 0, hairpin, 18),
    ('run', ORANGE, 0, tag_run, 16),
    ('helix', ORANGE, 1, helix, 200),
    ('arc', ORANGE, 2, arc, 70),
    ('back', ORANGE, 3, back, 34),
]

def ring_pt(u, s):
    a = 2 * math.pi * u; return (R * math.cos(a), R * math.sin(a), 0.0)

# ---------- κομμάτια ----------
SEG = 3  # γραμμές ανά κομμάτι
S_KEYS = [0.0, 0.35, 0.7, 1.0]       # ενδιάμεσα σχήματα για ομαλό σφίξιμο
def pieces(fn, n):
    us = [i / n for i in range(n + 1)]
    out = []
    for i in range(0, n, SEG):
        sub = us[i:min(i + SEG, n) + 1]
        out.append(sub)
    return out

def shape(pts):
    return {'i': [[0, 0]] * len(pts), 'o': [[0, 0]] * len(pts), 'v': [[round(x, 2), round(y, 2)] for x, y in pts], 'c': False}

def hexc(h): h = h.lstrip('#'); return [int(h[j:j + 2], 16) / 255 for j in (0, 2, 4)] + [1]
def shade(h, z):
    f = 1.0 if z >= -1 else lerp(1.0, 0.62, min(1.0, (-z - 1) / 9))
    h = h.lstrip('#'); c = [int(h[j:j + 2], 16) for j in (0, 2, 4)]
    return '#%02x%02x%02x' % tuple(int(v * f) for v in c)
def stroke(col, w, lc): return {'ty': 'st', 'c': {'a': 0, 'k': hexc(col)}, 'o': {'a': 0, 'k': 100}, 'w': {'a': 0, 'k': w}, 'lc': lc, 'lj': 2, 'ml': 4, 'nm': 's'}
TR = {'ty': 'tr', 'p': {'a': 0, 'k': [0, 0]}, 'a': {'a': 0, 'k': [0, 0]}, 's': {'a': 0, 'k': [100, 100]}, 'r': {'a': 0, 'k': 0}, 'o': {'a': 0, 'k': 100}, 'sk': {'a': 0, 'k': 0}, 'sa': {'a': 0, 'k': 0}, 'nm': 't'}
EI = {'x': 0.42, 'y': 1}; EO = {'x': 0.58, 'y': 0}
T_TIGHT0, T_TIGHT1 = 4 * STEP + 6, 4 * STEP + 48

groups = []   # (zavg, order, group)
order = 0
def add_group(pts_by_s, col, w, z, reveal):
    global order
    ow = OUT if z >= -1 else 3.0
    if len(set(tuple(map(tuple, p)) for p in pts_by_s)) == 1:
        ks = {'a': 0, 'k': shape(pts_by_s[0])}
    else:
        kf = [{'t': 0, 's': [shape(pts_by_s[0])], 'h': 1}]
        for j, sv in enumerate(S_KEYS):
            t = round(T_TIGHT0 + (T_TIGHT1 - T_TIGHT0) * sv, 2)
            k = {'t': t, 's': [shape(pts_by_s[j])]}
            if j < len(S_KEYS) - 1: k.update({'i': EI if j == len(S_KEYS) - 2 else {'x': 1, 'y': 1}, 'o': EO if j == 0 else {'x': 0, 'y': 0}})
            kf.append(k)
        ks = {'a': 1, 'k': kf}
    inner = {'ty': 'gr', 'nm': 'g', 'it': [{'ty': 'sh', 'ks': ks, 'nm': 'p'}, stroke(col, w, 2), stroke(DARK, w + ow, 1), TR]}
    it = [inner]
    if reveal:
        t0, t1 = reveal
        it.append({'ty': 'tm', 's': {'a': 0, 'k': 0}, 'e': {'a': 1, 'k': [{'t': 0, 's': [0], 'h': 1}, {'t': t0, 's': [0], 'i': {'x': [1], 'y': [1]}, 'o': {'x': [0], 'y': [0]}}, {'t': t1, 's': [100]}]}, 'o': {'a': 0, 'k': 0}, 'm': 1, 'nm': 'tm'})
    it.append(TR)
    groups.append((z, order, {'ty': 'gr', 'nm': 'seg%d' % order, 'it': it})); order += 1

# τα βήματα 1-4 ζωγραφίζονται σε 40 καρέ το καθένα· οι καμπύλες του ίδιου βήματος μοιράζονται τον χρόνο ανά μήκος
def length(fn, n, s=0.0):
    pts = [fn(i / n, s) for i in range(n + 1)]
    return sum(math.dist(pts[i][:2], pts[i + 1][:2]) for i in range(n))
by_step = {}
for name, col, st, fn, n in CURVES: by_step.setdefault(st, []).append((name, fn, n))
start = {}
for st, lst in by_step.items():
    tot = sum(length(fn, n) for _, fn, n in lst); acc = 0
    for name, fn, n in lst:
        L = length(fn, n); start[name] = (st * STEP + 3 + 40 * acc / tot, 40 * L / tot); acc += L

for name, col, st, fn, n in CURVES:
    t_begin, dur = start[name]
    pcs = pieces(fn, n)
    for k, sub in enumerate(pcs):
        pts_by_s = [[fn(u, s)[:2] for u in sub] for s in S_KEYS]
        z = sum(fn(u, 0.0)[2] for u in sub) / len(sub)
        a = t_begin + dur * k / len(pcs); b = t_begin + dur * (k + 1) / len(pcs)
        add_group(pts_by_s, shade(col, z), LW, z, (round(a, 2), round(max(b, a + 0.5), 2)))
# κρίκος: ένα κλειστό σχήμα σε βάθος 0 (η πετονιά μπαίνει από πάνω και βγαίνει από κάτω)
ring_g = {'ty': 'gr', 'nm': 'ring', 'it': [{'ty': 'gr', 'nm': 'g', 'it': [{'ty': 'el', 'p': {'a': 0, 'k': [0, 0]}, 's': {'a': 0, 'k': [2 * R, 2 * R]}, 'nm': 'e'}, stroke(METAL, 11.0, 2), stroke(DARK, 11.0 + OUT, 2), TR]}, TR]}
groups.append((0.0, -1, ring_g))
# ταξινόμηση: το πιο μπροστινό πρώτο (στο Lottie η πρώτη ομάδα ζωγραφίζεται πάνω). Ισοβαθμία: ο κρίκος πίσω από την πετονιά.
groups.sort(key=lambda g: (-g[0], g[1]))
layer = {'ddd': 0, 'ind': 1, 'ty': 4, 'nm': 'knot', 'sr': 1, 'parent': 200, 'ao': 0, 'ip': 0, 'op': OP, 'st': 0, 'bm': 0,
         'ks': {'o': {'a': 0, 'k': 100}, 'r': {'a': 0, 'k': 0}, 'p': {'a': 0, 'k': [0, 0, 0]}, 'a': {'a': 0, 'k': [0, 0, 0]}, 's': {'a': 0, 'k': [100, 100, 100]}},
         'shapes': [g[2] for g in groups]}
# σώμα του στριφταριού (αριστερά του κρίκου)
body = {'ddd': 0, 'ind': 2, 'ty': 4, 'nm': 'body', 'sr': 1, 'parent': 200, 'ao': 0, 'ip': 0, 'op': OP, 'st': 0, 'bm': 0,
        'ks': {'o': {'a': 0, 'k': 100}, 'r': {'a': 0, 'k': 0}, 'p': {'a': 0, 'k': [0, 0, 0]}, 'a': {'a': 0, 'k': [0, 0, 0]}, 's': {'a': 0, 'k': [100, 100, 100]}},
        'shapes': [{'ty': 'gr', 'nm': 'b', 'it': [{'ty': 'rc', 'p': {'a': 0, 'k': [-R - 34, 0]}, 's': {'a': 0, 'k': [62, 30]}, 'r': {'a': 0, 'k': 9}, 'nm': 'r'},
                    {'ty': 'fl', 'c': {'a': 0, 'k': hexc('#5E6B72')}, 'o': {'a': 0, 'k': 100}, 'nm': 'f'}, {'ty': 'st', 'c': {'a': 0, 'k': hexc(DARK)}, 'o': {'a': 0, 'k': 100}, 'w': {'a': 0, 'k': 4}, 'lc': 2, 'lj': 2, 'nm': 's'}, TR]}]}
# κάμερα: ζουμ στο σφίξιμο
def cam_kf(v0, v1):
    return {'a': 1, 'k': [{'t': 0, 's': v0, 'h': 1}, {'t': T_TIGHT0, 's': v0, 'i': {'x': [0.42] * len(v0), 'y': [1] * len(v0)}, 'o': {'x': [0.58] * len(v0), 'y': [0] * len(v0)}}, {'t': T_TIGHT1 + 6, 's': v1}]}
q0, q1 = P(0), P(1)
c0 = ((-R - 60) + (q0['x2'] + 40)) / 2; c1 = ((-R - 6) + (q1['x2'] + 22)) / 2
cam = {'ddd': 0, 'ind': 200, 'ty': 3, 'nm': 'cam', 'sr': 1, 'ao': 0, 'ip': 0, 'op': OP, 'st': 0, 'bm': 0,
       'ks': {'o': {'a': 0, 'k': 0}, 'r': {'a': 0, 'k': 0}, 'p': {'a': 0, 'k': [300, 290, 0]},
              'a': cam_kf([c0, 18, 0], [c1, 8, 0]), 's': cam_kf([150, 150, 100], [215, 215, 100])}}
anim = {'v': '5.7.0', 'fr': FR, 'ip': 0, 'op': OP, 'w': 600, 'h': 600, 'nm': 'clinch', 'ddd': 0, 'assets': [],
        'markers': [{'tm': k * STEP, 'dr': STEP, 'cm': 'step%d' % (k + 1)} for k in range(N_STEPS)],
        'layers': [layer, body, cam]}
json.dump(anim, open(sys.argv[1] if len(sys.argv) > 1 else 'knot_clinch.lottie.json', 'w'), separators=(',', ':'))
print('groups', len(groups), 'bytes', len(json.dumps(anim, separators=(',', ':'))))
