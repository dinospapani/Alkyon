"""
Alkyon – animated fishing knots for Blender (4.2 LTS … 5.x)
=============================================================

Knots
  Hook / ring : clinch, clinch_hook, uni, uni_hook, palomar, snell, rapala
  Line-to-line: fg, double_uni, albright, blood

Each knot "ties itself" step by step (the line is drawn along its path),
changes shape (shape-key morphs: tighten, pass loop over hook, …) and the
camera orbits the finished knot.  Output per knot: MP4 + poster PNG + JSON
(step times, EN/EL captions) for the app player.

Inside Blender : Scripting → Open → set KNOT → Run Script → Space to play.
Command line   :
  blender --gpu-backend opengl -b -P alkyon_knots.py -- --knot all --out knots_out
  options: --knot <id>|all  --engine eevee|cycles  --samples 64  --res 720
           --png  --transparent  --poster-only

Adding a knot: write  build(S)  returning a list of lines; every coordinate
that changes between states is written  q(state0, state1, …).  Points carry a
step tag: -1 = visible from the start, n = drawn during timeline step "draw n".
"""

import bpy, math, json, os, sys
from mathutils import Vector, Matrix

# ----------------------------------------------------------------- settings
KNOT        = "palomar"
OUT_DIR     = "//knots_out"
FPS         = 30
RES         = 720
ENGINE      = "eevee"
SAMPLES     = 64
BG_COLOR    = (0.043, 0.086, 0.125)          # app dark navy #0B1620

ROPE_R      = 0.05
BRAID_R     = 0.045
LEADER_R    = 0.075
COL_MAIN    = (0.80, 0.86, 0.92)             # main / standing line
COL_TAG     = (1.00, 0.42, 0.08)             # tag end (Alkyon orange)
COL_BRAID   = (0.08, 0.62, 0.22)             # braid (green)
COL_LEADER  = (0.22, 0.52, 0.95)             # leader (fluoro blue)
COL_METAL   = (0.75, 0.76, 0.78)
COL_HOOK    = (0.22, 0.22, 0.25)

F_INTRO, F_PER_UNIT, F_PAUSE = 20, 9, 12
F_MORPH, F_TRIM, F_ORBIT = 45, 20, 150
F_FINAL, F_HOLD = 75, 45          # last tightening (slower) and still hold
F_SIM = 32                         # frames per step of the simulated tightening
F_STEP_MIN, F_STEP_MAX = 18, 190

TAU = 2 * math.pi
RING_R, WIRE_R = 0.45, 0.06
RA = WIRE_R + ROPE_R + 0.01        # line hugging a wire
ZC = -RING_R                       # ring bottom / hook-eye wire height
ZS = ZC + RA                       # standing line height (ring/flat-hook knots)
HOOK_RE, HOOK_W = 0.30, 0.06       # hook eye radius, wire radius


# ===================================================================== utils
def L(a, b, s):
    return a + (b - a) * s


def V(*a):
    return Vector(a)


def helix(x0, x1, cy, cz, r, a0, turns, step, per_turn=8):
    n = max(2, int(round(turns * per_turn)))
    out = []
    for i in range(n + 1):
        t = i / n
        a = a0 + TAU * turns * t
        out.append((L(x0, x1, t), cy + r * math.sin(a), cz + r * math.cos(a), step))
    return out


def catmull(ctrl, samples=6):
    if samples <= 1:
        return [Vector(c[:3]) for c in ctrl], [c[3] for c in ctrl]
    P = [Vector(c[:3]) for c in ctrl]
    st = [c[3] for c in ctrl]
    P = [P[0]] + P + [P[-1]]
    out, ost = [], []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for k in range(samples):
            t = k / samples
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t +
                              (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
                              (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
            ost.append(st[i] if k else st[i - 1])
    out.append(P[-2]); ost.append(st[-1])
    return out, ost


def resample(pts, n):
    """Even arc-length resampling of a polyline to n points."""
    d = [0.0]
    for a, b in zip(pts, pts[1:]):
        d.append(d[-1] + (b - a).length)
    out, j = [], 0
    for i in range(n):
        s = d[-1] * i / (n - 1)
        while j < len(d) - 2 and d[j + 1] < s:
            j += 1
        seg = d[j + 1] - d[j] or 1e-9
        out.append(pts[j].lerp(pts[j + 1], (s - d[j]) / seg))
    return out


def transport(pts, n_end):
    """Parallel-transport normals along pts, fixed to n_end at the LAST point."""
    T = [(pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
         for i in range(len(pts))]
    N = [None] * len(pts)
    n = n_end - T[-1] * n_end.dot(T[-1])
    N[-1] = n.normalized()
    for i in range(len(pts) - 2, -1, -1):
        n = N[i + 1] - T[i] * N[i + 1].dot(T[i])
        N[i] = n.normalized() if n.length > 1e-6 else N[i + 1]
    return N


def overhand(C, ax, ro, h, face, step, n=28, turn=1):
    """Loose overhand: comes in along +ax side, one turn round, exits on -ax.
    face = unit vector the loop plane is turned toward (for visibility)."""
    C, ax = Vector(C), Vector(ax).normalized()
    nrm = (ax + Vector(face)).normalized()
    u = Vector((0, 0, 1)) if abs(nrm.z) < 0.9 else Vector((1, 0, 0))
    u = (u - nrm * u.dot(nrm)).normalized()
    v = nrm.cross(u) * turn
    pts = [(*(C + ax * 1.5 * h), step)]
    for i in range(n + 1):
        a = TAU * i / n
        p = C + nrm * h * (0.6 - 1.2 * i / n) + ro * (math.cos(a) * u + math.sin(a) * v)
        pts.append((*p, step))
    pts.append((*(C - ax * 1.0 * h), step))
    return pts


def ring_pts(Cr, J, nrm, n, sign, step):
    """Half of a loop through J (centre Cr, plane normal nrm), for one strand."""
    Cr, J, nrm = Vector(Cr), Vector(J), Vector(nrm).normalized()
    R = (J - Cr).length
    u = (J - Cr) / R
    v = nrm.cross(u)
    out = []
    for i in range(1, n + 1):
        a = sign * math.pi * i / n
        out.append((*(Cr + R * (math.cos(a) * u + math.sin(a) * v)), step))
    return out, v


def rot_x(pts, cy, cz, ang, steps=None):
    c, s = math.cos(ang), math.sin(ang)
    out = []
    for (x, y, z, st) in pts:
        if steps is None or st in steps:
            dz = z - cz
            y, z = cy + (y - cy) * c - dz * s, cz + (y - cy) * s + dz * c
        out.append((x, y, z, st))
    return out


def line(name, pts, col, r=ROPE_R, samples=6):
    return dict(name=name, pts=pts, col=col, r=r, samples=samples)


# =================================================================== knots
# ---------- improved clinch (ring / flat hook) – same geometry as v1
def clinch_tag(s):
    P = [(-RA * math.sin(math.pi * k / 4), 0, ZC + RA * math.cos(math.pi * k / 4), 0)
         for k in range(5)]
    P += [(L(0.45, 0.08, s), 0, L(-0.62, -0.60, s), 0)]
    # 1 – five wraps round the standing line (tight: seated right at the eye)
    P += helix(L(1.2, 0.22, s), L(3.2, 0.745, s), 0, ZS, L(0.2, 0.105, s), math.pi, 5, 1)
    # 2 – back along the wraps and through the small loop at the eye
    P += [(L(3.55, 0.84, s), L(0.30, 0.16, s), L(-0.60, -0.45, s), 2),
          (L(3.00, 0.70, s), L(0.60, 0.31, s), L(-0.45, -0.36, s), 2),
          (L(1.80, 0.45, s), L(0.60, 0.31, s), L(-0.45, -0.36, s), 2),
          (L(0.75, 0.20, s), L(0.55, 0.28, s), L(-0.45, -0.40, s), 2),
          (L(0.55, 0.11, s), L(0.25, 0.09, s), L(-0.45, -0.44, s), 2),
          (L(0.55, 0.10, s), 0.0, L(-0.45, -0.45, s), 2),
          (L(0.55, 0.10, s), L(-0.45, -0.17, s), L(-0.48, -0.47, s), 2)]
    # 3 – under and back up through the big loop; the tag ends lying on the wraps
    P += [(L(0.85, 0.18, s), L(-0.55, -0.14, s), L(-0.95, -0.62, s), 3),
          (L(1.40, 0.30, s), L(-0.05, 0.10, s), L(-1.10, -0.62, s), 3),
          (L(1.85, 0.36, s), L(0.38, 0.21, s), L(-0.75, -0.45, s), 3),
          (L(1.95, 0.38, s), L(0.40, 0.21, s), L(-0.25, -0.25, s), 3),
          (L(2.10, 0.52, s), L(0.35, 0.10, s), L(0.20, -0.13, s), 3),
          (L(2.35, 0.68, s), L(0.20, 0.05, s), L(0.55, -0.13, s), 3)]
    return P


def b_clinch(S):
    s = (0.0, 1.0)[S]
    return [line("standing", [(9, 0, ZS, -1), (0, 0, ZS, -1)], COL_MAIN, samples=1),
            line("tag", clinch_tag(s), COL_TAG)]


# ---------- uni knot (ring / flat hook)
def uni_tag(s, tilt=0.0):
    zt = L(-0.55, -0.43, s)                  # tag lying under the standing line
    zc2 = (ZS + zt) / 2                      # axis of the doubled line
    P = [(-RA * math.sin(math.pi * k / 4), 0, ZC + RA * math.cos(math.pi * k / 4), 0)
         for k in range(5)]
    P += [(L(0.40, 0.20, s), 0, zt, 0), (L(2.00, 0.50, s), 0, zt, 0),
          (L(3.60, 0.85, s), 0, zt, 0)]
    # 1 – loop: rises IN FRONT of the standing line, arcs back over both lines
    loop = [(L(3.95, 0.92, s), L(-0.25, -0.06, s), L(-0.47, -0.42, s), 1),
            (L(4.05, 0.90, s), L(-0.30, -0.09, s), L(-0.05, -0.37, s), 1),
            (L(3.90, 0.80, s), L(-0.15, -0.09, s), L(0.45, -0.38, s), 1),
            (L(3.10, 0.60, s), L(-0.05, -0.09, s), L(0.85, -0.38, s), 1),
            (L(1.90, 0.40, s), L(-0.05, -0.09, s), L(0.85, -0.38, s), 1),
            (L(1.05, 0.22, s), L(-0.15, -0.09, s), L(0.30, -0.38, s), 1),
            (L(0.95, 0.14, s), L(-0.30, -0.15, s), L(-0.20, -0.40, s), 1)]
    if tilt:
        loop = rot_x(loop, 0.0, zc2, tilt * (1 - s))
    P += loop
    # 2 – 5 wraps round both lines, each one through the loop; the last one
    #     ends inside the loop and the tag comes out through it
    P += helix(L(1.2, 0.2, s), L(3.25, 0.74, s), L(0.0, -0.03, s), zc2, L(0.3, 0.17, s),
               -math.pi / 2, 5.25, 2)
    P += [(L(3.40, 0.80, s), L(0.32, 0.10, s), L(0.00, -0.17, s), 2),
          (L(3.55, 0.86, s), L(0.60, 0.18, s), L(0.30, -0.08, s), 2)]
    return P


def b_uni(S):
    s = (0.0, 1.0)[S]
    return [line("standing", [(9, 0, ZS, -1), (0, 0, ZS, -1)], COL_MAIN, samples=1),
            line("tag", uni_tag(s), COL_TAG)]


def b_uni_hook(S):
    s = (0.0, 1.0)[S]
    return [line("standing", [(9, 0, ZS, -1), (0, 0, ZS, -1)], COL_MAIN, samples=1),
            line("tag", uni_tag(s, tilt=math.radians(50)), COL_TAG)]


# ---------- palomar: overhand above the eye, doubled line through the eye,
#            loop passed over the whole hook, then pulled tight (simulated)
PAL_AX = Vector((0.35, 0, 1)).normalized()     # toward the hand
PAL_FACE = Vector((0, -0.5, 0))
PAL_C = Vector((0, 0, 1.25))


def palomar_hook():
    # eye in the XZ plane (faces the camera), wire top at z=0.3, shank down,
    # bend toward -x
    return Vector((0, 0, 0.3)), Vector((0, 0, 1)), Vector((1, 0, 0))


def b_palomar(S):
    d = -PAL_AX                                   # travel: from the hand down to the eye
    u = Vector((-0.94, 0, 0.33)).normalized()     # lobes to the left
    s_, D = ((0.33, 0.55) if S < 5 else (0.27, 0.6) if S == 5 else (0.135, 1.25))
    P0 = V(0, 0, 0.11) - d * (2.2 * s_ + (0.2 if S < 5 else 0.12 if S == 5 else 0.12))
    if S == 6:
        P0 = P0 + V(0, 0, 0.12)
    hand_far = P0 - d * (2.2 * s_ + 3.0) + V(0, 0.3, 0)
    hand_mid = P0 - d * (2.2 * s_ + (1.0 if S < 6 else 0.6))
    core = [(*hand_far, -1), (*hand_mid, -1)]
    core += trefoil_g(P0, d, u, s_, D, 0)
    if S < 6:
        core += [(0.0, -0.3, 0.11, 0), (0.0, 0.0, 0.11, 0), (0.0, 0.42, 0.11, 0)]
    else:
        core += [(0.0, -0.2, 0.13, 0), (0.0, 0.0, 0.12, 0), (0.0, 0.22, 0.12, 0)]
    eb = V(0.0, 0.42, 0.11) if S < 6 else V(0.0, 0.22, 0.12)
    ring = [  # (L mids, J, ring centre, ring normal)
        ([eb + V(0.3, 0.2, -0.2), V(0.6, 0.5, -0.5)], V(0.75, 0.4, -0.8), V(1.5, 0.3, -1.6), V(0, -1, 0)),
        ([eb + V(0.4, 0.2, -0.6), V(0.8, 0.5, -2.8)], V(0.75, 0.4, -4.6), V(1.6, 0.0, -5.0), V(0, 0, 1)),
        ([eb + V(0.4, 0.2, -0.6), V(0.7, 0.5, -2.8)], V(0.45, 0.4, -4.6), V(-0.85, 0.0, -5.05), V(0, 0, 1)),
        ([eb + V(0.25, 0.2, -0.3), V(0.45, 0.45, -0.5)], V(0.45, 0.4, -0.8), V(-0.85, 0.0, -0.85), V(0, 0, 1)),
        ([eb + V(0.2, 0.2, -0.25), V(0.35, 0.5, -0.5)], V(0.3, 0.85, -0.75), V(0.0, 0.0, -0.75), V(0, 0, 1)),
        ([eb + V(0.1, 0.12, -0.2), V(0.1, 0.32, -0.4)], V(0.05, 0.34, -0.62), V(0.0, 0.0, -0.62), V(0, 0, 1)),
        ([eb + V(0.0, -0.1, -0.12), V(0.02, 0.22, -0.3)], V(0.02, 0.23, -0.42), V(0.0, 0.0, -0.42), V(0, 0, 1)),
    ][S]
    mids, J, Cr, nr = ring
    core += [(*m, 1) for m in mids] + [(*J, 1)]
    dense, st = catmull(core, 5)
    w = 0.065 if S < 6 else 0.053
    # strand offsets stay in the knot's plane (crossings are separated in depth)
    yv = Vector((0, 1, 0))
    N, prev = [], None
    for i in range(len(dense)):
        T = (dense[min(i + 1, len(dense) - 1)] - dense[max(i - 1, 0)]).normalized()
        n = T.cross(yv)
        if n.length < 0.35 and prev is not None:
            n = prev - T * prev.dot(T)
        n = n.normalized()
        if prev is not None and n.dot(prev) < 0:
            n = -n
        N.append(n); prev = n
    _, vA = ring_pts(Cr, J, nr, 2, +1, 1)
    flip = 1 if vA.dot(N[-1]) >= 0 else -1
    out = []
    for sign, name, col in ((+1, "standing", COL_MAIN), (-1, "tag", COL_TAG)):
        pts = [(*(p + sign * w * n), s_x) for p, n, s_x in zip(dense, N, st)]
        half, _ = ring_pts(Cr, J, nr, 14, sign * flip, 1)
        out.append(line(name, pts + half, col, samples=1))
    return out


# ---------- snell (uni-snell, F&S / wired2fish method)
def b_snell(S):
    s = (0.0, 1.0)[S]
    P = [(6, 0, 0.6, -1), (2.0, -0.45, 0.25, -1), (0.5, -0.45, 0.02, -1),
         (-0.3, -0.32, -0.04, 0), (-0.3, 0.0, -0.06, 0), (-0.36, 0.3, -0.09, 0),
         (-0.82, 0.12, -0.11, 0), (L(-1.2, -1.0, s), 0, -0.11, 0),
         (L(-2.0, -1.35, s), 0, -0.11, 0), (L(-2.9, -1.72, s), 0, -0.11, 0)]
    # loop toward the eye (in front of the hook)
    P += [(L(-3.25, -1.86, s), L(-0.15, -0.11, s), L(-0.20, -0.07, s), 1),
          (L(-3.10, -1.78, s), L(-0.70, -0.11, s), L(-0.35, -0.07, s), 1),
          (L(-2.30, -1.55, s), L(-1.05, -0.11, s), L(-0.40, -0.07, s), 1),
          (L(-1.30, -1.25, s), L(-1.00, -0.11, s), L(-0.35, -0.07, s), 1),
          (L(-0.85, -0.98, s), L(-0.60, -0.11, s), L(-0.25, -0.07, s), 1),
          (L(-0.80, -0.82, s), L(-0.36, -0.13, s), L(-0.12, -0.08, s), 1)]
    P += helix(L(-0.95, -0.92, s), L(-2.45, -1.58, s), 0, -0.055, L(0.33, 0.22, s),
               -math.pi / 2, 6, 2)
    P += [(L(-2.65, -1.70, s), L(-0.50, -0.30, s), L(-0.30, -0.24, s), 2),
          (L(-2.85, -1.80, s), L(-0.85, -0.40, s), L(-0.55, -0.34, s), 2)]
    return [line("line", P, COL_TAG)]


# ---------- rapala loop knot
RAP_FACE = Vector((0, -1.1, 0))


def trefoil_oh(cx, zl, s, D, dirn, step, n=40, dl=0.35):
    """Open overhand (trefoil cut at its bottom lobe) lying in the XZ plane,
    facing the camera.  The line runs along z=zl and travels toward dirn*x.
    Returns (ctrl points, centre of the knot)."""
    Oz = zl + 2.6 * s
    def P(t):
        X = math.sin(t) + 2 * math.sin(2 * t)
        Y = math.cos(t) - 2 * math.cos(2 * t)
        Z = -math.sin(3 * t)
        return (cx + dirn * s * X, D * s * Z, Oz + s * Y)
    out = [(cx - dirn * 2.2 * s, D * s * 0.86, zl, step)]
    for i in range(n + 1):
        t = math.pi + dl + (2 * math.pi - 2 * dl) * i / n
        out.append((*P(t), step))
    out.append((cx + dirn * 2.2 * s, -D * s * 0.86, zl, step))
    return out, Vector((cx, 0, Oz))


def trefoil_g(P0, d, u, s, D, step, n=40, dl=0.35):
    """Open overhand (true trefoil) along the travel direction d through P0,
    lobes toward u, crossings separated along y."""
    P0, d, u = Vector(P0), Vector(d).normalized(), Vector(u).normalized()
    yv = Vector((0, 1, 0))
    out = [(*(P0 - d * 2.2 * s + yv * D * s * 0.86), step)]
    for i in range(n + 1):
        t = math.pi + dl + (2 * math.pi - 2 * dl) * i / n
        X = math.sin(t) + 2 * math.sin(2 * t)
        Y = math.cos(t) - 2 * math.cos(2 * t)
        Z = -math.sin(3 * t)
        out.append((*(P0 + d * s * X + u * s * (2.6 + Y) + yv * D * s * Z), step))
    out.append((*(P0 + d * 2.2 * s - yv * D * s * 0.86), step))
    return out


def b_rapala(S):
    s_ = 0.28
    cx = 2.3
    oh, O = trefoil_oh(cx, 0.0, s_, 0.7, -1, 0)
    P = [(7, 0, 0, -1), (4.6, 0, 0, -1), (3.4, 0.08, 0, 0)] + oh
    # to the eye, round the wire, back
    P += [(1.15, -0.12, 0.0, 1), (0.3, -0.12, 0.0, 1)]
    P += [(-RA * math.sin(math.pi * k / 4), -RA * math.cos(math.pi * k / 4), 0.0, 1)
          for k in range(5)]
    P += [(0.3, 0.12, 0.0, 1), (1.2, 0.14, 0.05, 1), (cx - 0.45, 0.32, O.z - 0.25, 1),
          (cx - 0.1, 0.3, O.z - 0.03, 1), (cx - 0.1, -0.3, O.z - 0.03, 1),           # through the knot
          (cx + 0.45, -0.38, O.z - 0.2, 1), (cx + 0.8, -0.3, 0.05, 1)]
    # 3 wraps round the standing line
    x0 = cx + 1.0
    P += helix(x0, x0 + 1.0, 0, 0, 0.22, math.pi, 3, 2)
    # back through the overhand
    P += [(x0 + 1.2, -0.38, -0.2, 3), (x0 + 0.6, -0.55, 0.3, 3), (cx + 0.4, -0.42, O.z + 0.1, 3),
          (cx + 0.1, -0.3, O.z + 0.1, 3), (cx + 0.1, 0.3, O.z + 0.1, 3), (cx + 0.05, 0.5, O.z + 0.3, 3)]
    # tuck: over the top and down through the small loop just formed
    P += [(cx + 0.1, 0.6, O.z + 0.75, 4), (cx + 0.6, 0.35, O.z + 0.95, 4),
          (cx + 0.95, -0.12, O.z + 0.3, 4), (cx + 0.7, -0.1, 0.55, 4),
          (cx + 0.6, -0.14, 0.22, 4), (cx + 0.63, -0.33, -0.04, 4), (cx + 0.68, -0.6, -0.25, 4),
          (cx + 0.72, -0.85, -0.4, 4)]
    if S == 0:
        return [line("line", P, COL_TAG)]
    # pulled tight: the knot closes and slides toward the eye
    def T(p):
        x, y, z, st = p
        if x <= 0.3 or (st == -1 and x > 4):
            return p
        return (0.3 + (x - 0.3) * 0.6, y * 0.75, z * 0.75, st)
    return [line("line", [T(p) for p in P], COL_TAG)]


# ---------- FG knot (braid straight while weaving, then leader straight)
FG_N, FG_PT, FG_P = 10, 12, 0.45      # wraps, points per wrap, pitch (loose)
FG_K = 0.45                             # length compression when set


def fg_weave():
    """Leader round the straight braid, right→left, alternating direction:
    each wrap is a full turn (over + under), the next one turns the other way."""
    out = []
    x0 = FG_N * FG_P
    for k in range(FG_N):
        sg = 1 if k % 2 == 0 else -1
        xk = x0 - (k + 0.5) * FG_P
        for j in range(FG_PT + 1):
            if k and j == 0:
                continue
            a = sg * TAU * j / FG_PT
            out.append((xk + FG_P / 4 - FG_P / 2 * j / FG_PT, a))
    return x0, out


def b_fg(S):
    x0, W = fg_weave()
    r0, r1 = 0.26, BRAID_R + LEADER_R + 0.004
    k = FG_K
    if S == 0:
        leader = [(x0 + 0.3, -0.25, -4.0, -1), (x0 + 0.0, -0.5, -1.6, 0),
                  (x0 - 0.06, -0.5, -0.35, 0), (x0 - 0.08, -0.38, 0.12, 0)]
        leader += [(x, r0 * math.sin(a), r0 * math.cos(a), 1) for x, a in W]
        leader += [(-0.25, 0.2, 0.3, 1), (-0.9, 0.3, 0.55, 1), (-1.5, 0.35, 0.7, 1)]
        braid = [(-8, 0, 0, -1), (-1.0, 0, 0, -1), (-0.15, 0, 0, -1)]
        braid += [(x, 0, 0, -1) for x, a in reversed(W)]
    else:
        leader = [(6.5, 0, 0, -1), (4.6, 0, 0, 0), (3.2, 0, 0, 0), (x0 * k + 0.25, 0, 0, 0)]
        leader += [(x * k, 0, 0, 1) for x, a in W]
        leader += [(-0.2, 0.09, 0, 1), (-0.47, 0.09, 0, 1), (-0.75, 0.09, 0, 1)]
        braid = [(-8, -0.09, 0, -1), (-1.0, -0.09, 0, -1), (-0.15, -0.09, -0.04, -1)]
        braid += [(x * k, -r1 * math.sin(a), -r1 * math.cos(a), -1) for x, a in reversed(W)]
    xe = x0 * (k if S else 1.0)
    end = Vector(braid[-1][:3])
    # braid tag held taut toward the mouth (up and to the right, clear of the leader)
    braid += [(end.x + 0.08, 0.1, end.z - 0.14, -1), (end.x + 0.2, 0.2, end.z - 0.05, -1)]
    braid += [(end.x + 0.32 + 0.14 * i, 0.17, 0.22 + 0.07 * i, -1) for i in range(28)]
    # the tag after the weave is drawn as it is tied: back over the weave,
    # half hitches round both lines (step 2), then round the braid only (step 3)
    xe1 = x0 * k
    e1 = Vector((W[0][0] * k, 0, -r1))
    top = r1 + 2 * BRAID_R + 0.01
    T = [(e1.x, e1.y, e1.z, 2), (xe1 + 0.12, -0.17, -0.02, 2), (xe1 + 0.05, -0.12, top, 2),
         (xe1 * 0.5, 0, top, 2), (0.08, 0, top, 2)]
    ra = 0.09 + LEADER_R + 2 * BRAID_R + 0.02
    for j, xc in enumerate((-0.12, -0.32)):
        sg = 1 if j % 2 == 0 else -1
        T += [(xc - 0.12 * i / 8, ra * math.sin(sg * TAU * i / 8),
               ra * math.cos(sg * TAU * i / 8), 2) for i in range(1, 9)]
    rb = 2 * BRAID_R + 0.012
    for j, xc in enumerate((-0.9, -1.08)):
        sg = 1 if j % 2 == 0 else -1
        T += [(xc - 0.1 * i / 8, -0.09 + rb * math.sin(sg * TAU * i / 8),
               rb * math.cos(sg * TAU * i / 8), 3) for i in range(1, 9)]
    T += [(-1.3, -0.09, 0.16, 3)]
    if S == 0:                               # hidden until drawn after the set
        T = [(x, y, z + 30, st) for (x, y, z, st) in T]
    return [line("leader", leader, COL_LEADER, r=LEADER_R, samples=3),
            line("braid", braid, COL_BRAID, r=BRAID_R, samples=3),
            line("braid_tag", T, COL_BRAID, r=BRAID_R, samples=4)]


# ---------- double uni
DU_LY, DU_YL, DU_TOP = 1.0, 0.0, 1.0


def uni_side(s, sgn, col_r, z0, step):
    """Uni knot tied with a tag lying along the pair; mirrored by sgn (x and z)."""
    yl = -(0.065 + col_r + 0.075 + 0.01) - DU_YL  # loop strand beside the pair (tight)
    cy = yl / 2
    we = 0.28 + 5.25 * 2 * col_r * 1.05
    rr = L(0.36, abs(cy) + max(0.065 + LEADER_R, abs(yl - cy) + col_r) + col_r + 0.01, s)
    P = [(L(3.95, we + 0.3, s), L(-0.25 * DU_LY, -0.06, s), z0, step),
         (L(4.10, we + 0.36, s), L(-0.32 * DU_LY, -0.10, s), L(0.10, 0.0, s) * sgn, step),
         (L(3.95, we + 0.3, s), L(-0.16 * DU_LY, yl * 0.8, s), L(0.60 * DU_TOP, 0.0, s) * sgn, step),
         (L(3.10, we * 0.8, s), L(-0.05 * DU_LY, yl, s), L(1.05 * DU_TOP, 0.0, s) * sgn, step),
         (L(1.90, we * 0.5, s), L(-0.05 * DU_LY, yl, s), L(1.05 * DU_TOP, 0.0, s) * sgn, step),
         (L(1.05, 0.30, s), L(-0.15 * DU_LY, yl, s), L(0.45 * DU_TOP, 0.0, s) * sgn, step),
         (L(0.95, 0.24, s), L(-0.36 * DU_LY, yl - 0.05, s), L(-0.05, 0.0, s) * sgn, step)]
    hx = helix(L(1.2, 0.28, s), L(3.25, we, s), L(0.0, cy, s), 0.0,
               rr, -math.pi / 2, 5.25, step)
    P += [(x, y, z * sgn, st) for (x, y, z, st) in hx]
    ex = hx[-1][0]
    P += [(ex + L(0.15, 0.06, s), L(0.35, 0.10, s), L(0.25, 0.16, s) * sgn, step),
          (ex + L(0.3, 0.12, s), L(0.6, 0.18, s), L(0.55, 0.26, s) * sgn, step)]
    return [(sgn * x, y, z, st) for (x, y, z, st) in P]


def b_double_uni(S):
    sm, sl, sh = (0, 1, 1, 1)[S], (0, 0, 1, 1)[S], (0, 0, 0, 0.14)[S]
    dz = 0.065
    braid = [(-8, 0, dz, -1), (-4.0, 0, dz, -1), (0.0, 0, dz, 0), (L(2.0, 0.5, sm), 0, dz, 0),
             (L(3.6, 0.28 + 5.25 * 2 * BRAID_R * 1.05 + 0.22, sm), 0, dz, 0)]
    braid += uni_side(sm, +1, BRAID_R, dz, 1)
    leader = [(8, 0, -dz, -1), (4.0, 0, -dz, -1), (0.0, 0, -dz, 0), (-L(2.0, 0.5, sl), 0, -dz, 0),
              (-L(3.6, 0.28 + 5.25 * 2 * LEADER_R * 1.05 + 0.22, sl), 0, -dz, 0)]
    leader += uni_side(sl, -1, LEADER_R, -dz, 3)
    if sh:
        braid = braid[:3] + [(x - sh, y, z, st) for (x, y, z, st) in braid[3:]]
        leader = leader[:3] + [(x + sh, y, z, st) for (x, y, z, st) in leader[3:]]
    return [line("braid", braid, COL_BRAID, r=BRAID_R),
            line("leader", leader, COL_LEADER, r=LEADER_R)]


# ---------- albright
def b_albright(S):
    s = (0.0, 1.0)[S]
    sep = L(0.2, 0.137, s)
    xc = L(-1.0, -0.15, s)                       # closed end of the leader loop
    leader = [(7, sep, 0, -1), (4.0, sep, 0, -1), (L(2.6, 1.4, s), sep, 0, 0),
              (xc + L(1.2, 0.5, s), sep, 0, 0), (xc + 0.3, sep, 0, 0)]
    for i in range(1, 8):
        a = math.pi * i / 8
        leader.append((xc - sep * math.sin(a), sep * math.cos(a), 0, 0))
    leader += [(xc + 0.3, -sep, 0, 0), (xc + L(1.2, 0.5, s), -sep, 0, 0),
               (L(2.6, 1.4, s), -sep, 0, 0), (L(3.4, 1.55, s), -sep, 0, 0)]
    zt = LEADER_R + BRAID_R + 0.015
    braid = [(-8, -0.05, zt, -1), (-4.0, -0.05, zt, -1), (L(-1.5, -0.5, s), -0.05, zt, 1),
             (L(2.2, 1.12, s), -0.05, zt, 1), (L(2.5, 1.22, s), -0.02, L(0.05, 0.02, s), 1),
             (L(2.55, 1.24, s), 0.0, L(-0.3, -0.2, s), 1)]
    wr = L(0.5, sep + LEADER_R + BRAID_R + 0.015, s)
    braid += helix(L(2.25, 1.12, s), L(0.15, 0.18, s), 0, L(0.03, 0.03, s), wr,
                   math.pi, 10, 2, per_turn=8)
    braid += [(L(-0.1, 0.12, s), 0.03, L(-0.55, -0.22, s), 3),
              (L(-0.45, 0.04, s), L(0.05, 0.035, s), L(-0.25, -0.1, s), 3),
              (L(-0.45, 0.04, s), L(0.05, 0.035, s), L(0.15, 0.05, s), 3),
              (L(-0.6, -0.05, s), L(0.07, 0.05, s), L(0.45, 0.2, s), 3),
              (L(-1.1, -0.25, s), 0.08, L(0.6, 0.2, s), 3)]
    return [line("leader", leader, COL_LEADER, r=LEADER_R),
            line("braid", braid, COL_BRAID, r=BRAID_R)]


# ---------- blood knot
def b_blood(S):
    s = (0.0, 1.0)[S]
    def side(sgn, st_w, st_r, dx):
        c = L(0.21, 0.13, s)                       # crossing height at the centre
        p = [(-sgn * 8, 0, 0, -1), (-sgn * 4, 0, 0, -1), (-sgn * L(1.6, 0.9, s), 0, 0, 0),
             (-sgn * L(0.6, 0.27, s), 0, 0, 0),
             (-sgn * L(0.2, 0.13, s), 0, sgn * c, 0), (sgn * L(0.15, 0.1, s), 0, sgn * (c + 0.02), 0)]
        hx = helix(L(0.4, 0.25, s), L(2.0, 0.77, s), 0, 0, L(0.3, 0.105, s), 0, 5, st_w)
        p += [(sgn * x, y, sgn * z, st) for (x, y, z, st) in hx]
        p += [(sgn * L(2.3, 0.9, s), -sgn * L(0.35, 0.22, s), 0, st_r),
              (sgn * L(1.6, 0.6, s), -sgn * L(0.55, 0.22, s), 0, st_r),
              (sgn * L(0.6, 0.25, s), -sgn * L(0.55, 0.22, s), 0, st_r),
              (sgn * (dx + 0.08), -sgn * L(0.45, 0.2, s), 0, st_r),
              (sgn * dx, -sgn * L(0.25, 0.12, s), 0, st_r),
              (sgn * dx, 0, 0, st_r),
              (sgn * dx, sgn * L(0.3, 0.13, s), 0, st_r),
              (sgn * (dx + 0.06), sgn * L(0.5, 0.18, s), 0, st_r),
              (sgn * L(0.3, 0.1, s), sgn * L(0.8, 0.22, s), sgn * L(0.3, 0.12, s), st_r)]
        return p
    return [line("main", side(+1, 1, 2, 0.075), COL_MAIN),
            line("second", side(-1, 3, 3, 0.075), COL_TAG)]



# ============================================================ tightening sim
import numpy as np
def pbd_resample(P, h):
    P = np.asarray(P, float)
    c = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(P, axis=0), axis=1))])
    n = max(2, int(round(c[-1] / h)) + 1)
    t = np.linspace(0, c[-1], n)
    return np.stack([np.interp(t, c, P[:, k]) for k in range(3)], 1), t / c[-1]


try:
    from scipy.spatial import cKDTree as _KD
except Exception:
    _KD = None


def _contacts(X, R, lid, idx, skip, w):
    if _KD is not None:
        pairs = _KD(X).query_pairs(2 * R.max(), output_type="ndarray")
        if not len(pairs):
            return 0.0
        i, j = pairs[:, 0], pairs[:, 1]
        D = X[i] - X[j]
        dist = np.sqrt((D ** 2).sum(-1)) + 1e-12
        lim = R[i] + R[j]
        near = (lid[i] == lid[j]) & (np.abs(idx[i] - idx[j]) <= np.maximum(skip[i], skip[j]))
        m = (dist < lim) & ~near
        if not m.any():
            return 0.0
        i, j, D, dist, lim = i[m], j[m], D[m], dist[m], lim[m]
        ov = lim - dist
        n = D / dist[:, None]
        wi, wj = w[i], w[j]
        ws = wi + wj + 1e-12
        dx = np.zeros_like(X); cnt = np.zeros(len(X))
        np.add.at(dx, i, n * (ov * wi / ws)[:, None]); np.add.at(dx, j, -n * (ov * wj / ws)[:, None])
        np.add.at(cnt, i, 1); np.add.at(cnt, j, 1)
        X += dx / np.maximum(cnt, 1)[:, None]
        return ov.max()
    D = X[:, None, :] - X[None, :, :]
    dist = np.sqrt((D ** 2).sum(-1)) + 1e-12
    lim = R[:, None] + R[None, :]
    near = (lid[:, None] == lid[None, :]) & (np.abs(idx[:, None] - idx[None, :]) <=
                                              np.maximum(skip[:, None], skip[None, :]))
    m = (dist < lim) & ~near
    np.fill_diagonal(m, False)
    if not m.any():
        return 0.0
    i, j = np.nonzero(m)
    k = i < j
    i, j = i[k], j[k]
    ov = lim[i, j] - dist[i, j]
    n = D[i, j] / dist[i, j][:, None]
    wi, wj = w[i], w[j]
    ws = wi + wj + 1e-12
    dx = np.zeros_like(X); cnt = np.zeros(len(X))
    np.add.at(dx, i, n * (ov * wi / ws)[:, None]); np.add.at(dx, j, -n * (ov * wj / ws)[:, None])
    np.add.at(cnt, i, 1); np.add.at(cnt, j, 1)
    X += dx / np.maximum(cnt, 1)[:, None]
    return ov.max()


def pbd_contract(lines, radii, pins=None, metal=None, steps=400, snaps=4, cmin=0.55,
             iters=4, citers=2, free=(), push=None):
    """Tighten like a pulled rope: every segment's rest length shrinks slowly
    while the line ends (and pins) stay put, so tension draws the slack out of
    the knot; ropes and metal cannot pass through each other."""
    L = len(lines)
    off = np.cumsum([0] + [len(p) for p in lines])
    X = np.concatenate([np.asarray(p, float) for p in lines])
    N = len(X)
    lid = np.concatenate([np.full(len(p), i) for i, p in enumerate(lines)])
    idx = np.concatenate([np.arange(len(p)) for p in lines])
    R = np.array([radii[i] for i in lid])
    seg_a = np.concatenate([np.arange(off[i], off[i + 1] - 1) for i in range(L)])
    seg_b = seg_a + 1
    rest0 = np.linalg.norm(X[seg_b] - X[seg_a], axis=1)
    h0 = np.median(rest0)
    skip = np.ceil(2.6 * R / h0).astype(int)
    w = np.ones(N)
    for i in range(L):
        if (i, "start") not in free:
            w[off[i]] = 0
        if (i, "end") not in free:
            w[off[i + 1] - 1] = 0
    if pins:
        for li, ids in pins:
            w[off[li] + np.asarray(ids)] = 0
    if metal is not None:
        MP, MR = np.asarray(metal[0], float), np.asarray(metal[1], float)
    out, snap_at = [], set(int(steps * (k + 1) / snaps) - 1 for k in range(snaps))
    cm = np.asarray(cmin, float) if np.ndim(cmin) else np.full(len(rest0), float(cmin))
    for it in range(steps):
        fac = 1 - (1 - cm) * (it + 1) / steps
        rest = rest0 * fac
        skip = np.ceil(2.6 * R / (h0 * max(fac.min(), 0.05))).astype(int)
        if push is not None:
            X[push[0]] += np.asarray(push[1]) * (w[push[0]][:, None] > 0)
        every = max(1, iters // citers)
        for k in range(iters):
            d = X[seg_b] - X[seg_a]
            ln = np.linalg.norm(d, axis=1) + 1e-12
            corr = ((ln - rest) / ln)[:, None] * d
            wa, wb = w[seg_a], w[seg_b]
            ws = wa + wb + 1e-12
            dx = np.zeros_like(X); cnt = np.zeros(N)
            np.add.at(dx, seg_a, corr * (wa / ws)[:, None])
            np.add.at(dx, seg_b, -corr * (wb / ws)[:, None])
            np.add.at(cnt, seg_a, 1); np.add.at(cnt, seg_b, 1)
            step = dx / np.maximum(cnt, 1)[:, None]
            n = np.linalg.norm(step, axis=1, keepdims=True) + 1e-12
            X += step * np.minimum(1, 0.004 / n)
            if k % every:
                continue
            for _ in range(1):
                _contacts(X, R, lid, idx, skip, w)
                if metal is not None:
                    Dm = X[:, None, :] - MP[None, :, :]
                    dm = np.sqrt((Dm ** 2).sum(-1)) + 1e-12
                    lm = R[:, None] + MR[None, :]
                    mm = (dm < lm) & (w[:, None] > 0)
                    if mm.any():
                        i, j = np.nonzero(mm)
                        dx = np.zeros_like(X); cnt = np.zeros(N)
                        np.add.at(dx, i, (Dm[i, j] / dm[i, j][:, None]) * (lm[i, j] - dm[i, j])[:, None])
                        np.add.at(cnt, i, 1)
                        X += dx / np.maximum(cnt, 1)[:, None]
        if it in snap_at:
            out.append([X[off[i]:off[i + 1]].copy() for i in range(L)])
    return out


SIM_H = 0.6                         # sample spacing as a fraction of the rope radius
SIM_CACHE = "alkyon_knots_sim.npz"  # pre-computed results (next to this script)


def metal_points(K):
    pts, rad = [], []
    if K.get("anchor") == "ring":
        for i in range(72):
            t = TAU * i / 72
            pts.append((0, RING_R * math.cos(t), RING_R * math.sin(t))); rad.append(WIRE_R)
    elif K.get("anchor") == "hook":
        h = K["hook"]
        o, ex, ey = palomar_hook() if h == "palomar" else (Vector(h["o"]), Vector(h["ex"]), Vector(h["ey"]))
        ex, ey = Vector(ex).normalized(), Vector(ey).normalized(); ez = ex.cross(ey)
        W = lambda p: tuple(Vector(o) + ex * p[0] + ey * p[1] + ez * p[2])
        for i in range(60):
            t = TAU * i / 60
            pts.append(W((-HOOK_RE + HOOK_RE * math.cos(t), HOOK_RE * math.sin(t), 0))); rad.append(HOOK_W)
        for i in range(40):
            pts.append(W((-0.6 - 3.2 * i / 39, 0, 0))); rad.append(HOOK_W)
        for i in range(1, 25):
            a = math.pi / 2 + math.pi * i / 24
            pts.append(W((-3.8 + 0.85 * math.cos(a), -0.85 + 0.85 * math.sin(a), 0))); rad.append(HOOK_W)
        for i in range(12):
            pts.append(W((-3.8 + 1.1 * i / 11, -1.7, 0))); rad.append(HOOK_W * (1 - 0.8 * i / 11))
    return (np.array(pts), np.array(rad)) if pts else None


def _cache_path():
    try:
        d = os.path.dirname(os.path.abspath(__file__))
    except Exception:
        d = bpy.path.abspath("//")
    return os.path.join(d, SIM_CACHE)


def run_sim(kid, K, lines_pts, radii, steps_tags):
    """lines_pts: per line (N,3) arrays of the state the sim starts from.
    Returns snapshots: list of [per line (N,3)]."""
    sim = K["sim"]
    path = _cache_path()
    key = f"{kid}|"
    if os.path.exists(path):
        z = np.load(path)
        ks = sorted(k for k in z.files if k.startswith(key))
        if ks:
            n = max(int(k.split("|")[2]) for k in ks) + 1
            return [[z[f"{kid}|{li}|{s}"] for li in range(len(lines_pts))] for s in range(n)]
    print(f"[{kid}] simulating the tightening (no cache found – this can take minutes)…")
    groups = sim.get("join") or [[(i, 1)] for i in range(len(lines_pts))]
    glines, grad, gmap, pins = [], [], [], []
    for g in groups:
        parts, mp = [], []
        for li, d in g:
            P = lines_pts[li] if d > 0 else lines_pts[li][::-1]
            if parts:
                P = P[1:]
            mp.append((li, d, sum(len(p) for p in parts), len(P)))
            parts.append(P)
        glines.append(np.concatenate(parts)); grad.append(max(radii[li] for li, _ in g)); gmap.append(mp)
    if sim.get("pin"):
        for gi, g in enumerate(glines):
            ids = sim["pin"](g)
            if len(ids):
                pins.append((gi, ids))
    free = [(gi, e) for gi, e in sim.get("free", [])]
    cmin = sim.get("cmin", 0.2)
    if sim.get("cmin_at"):
        cmin = np.concatenate([sim["cmin_at"](0.5 * (g[1:] + g[:-1])) for g in glines])
    push = None
    if sim.get("push"):
        g0 = glines[0]
        push = (np.nonzero(sim["push"][0](g0))[0], sim["push"][1])
    snaps = pbd_contract(glines, grad, pins=pins, metal=metal_points(K), steps=sim.get("steps", 2400),
                         snaps=sim.get("snaps", 4), cmin=cmin, iters=20, citers=5, free=free, push=push)
    out = []
    for sn in snaps:
        per = [None] * len(lines_pts)
        for gi, mp in enumerate(gmap):
            for li, d, start, n in mp:
                seg = sn[gi][start:start + n]
                if d < 0:
                    seg = seg[::-1]
                if start and d > 0:
                    seg = np.concatenate([sn[gi][start - 1:start], seg])
                if start and d < 0:
                    seg = np.concatenate([seg, sn[gi][start - 1:start]])
                per[li] = seg
        out.append(per)
    return out


# ===================================================================== table
HOOK_FLAT = dict(o=(0, 0, ZC), ex=(1, 0, 0), ey=(0, -1, 0))
HOOK_SIDE = dict(o=(0, 0, 0), ex=(1, 0, 0), ey=(0, 0, 1))

KNOTS = {
    "clinch": dict(build=b_clinch, states=2, anchor="ring", cam=(18, -18),
        title_en="Improved Clinch Knot", title_el="Βελτιωμένος κόμπος Clinch",
        timeline=[("draw", 0, "Pass the line through the eye", "Πέρασε την πετονιά από το μάτι"),
                  ("draw", 1, "Wrap the tag 5 times around the main line",
                   "Τύλιξε την άκρη 5 φορές γύρω από την κύρια πετονιά"),
                  ("draw", 2, "Bring it back through the small loop at the eye",
                   "Φέρ' την πίσω και πέρασέ τη από τη μικρή θηλιά στο μάτι"),
                  ("draw", 3, "Then back through the big loop", "Μετά πίσω από τη μεγάλη θηλιά"),
                  ("morph", [1], "Wet the line, pull tight, trim the tag",
                   "Βρέξε την πετονιά, σφίξε και κόψε την άκρη")]),
    "uni": dict(build=b_uni, states=2, anchor="ring", cam=(18, -18),
        title_en="Uni Knot", title_el="Κόμπος Uni",
        timeline=[("draw", 0, "Pass the line through the eye and lay it alongside",
                   "Πέρασε την πετονιά από το μάτι και φέρ' τη δίπλα στην κύρια"),
                  ("draw", 1, "Form a loop over both lines", "Κάνε μια θηλιά πάνω από τις δύο πετονιές"),
                  ("draw", 2, "Wrap 5 times around both lines, through the loop",
                   "Τύλιξε 5 φορές γύρω από τις δύο, μέσα από τη θηλιά"),
                  ("morph", [1], "Wet, pull tight and slide the knot down to the eye",
                   "Βρέξε, σφίξε και κατέβασε τον κόμπο ως το μάτι")]),
}
KNOTS["clinch_hook"] = dict(KNOTS["clinch"], anchor="hook", hook=HOOK_FLAT, cam=(52, -22), frame_hook=True,
                            title_en="Improved Clinch Knot (hook)",
                            title_el="Βελτιωμένος κόμπος Clinch (αγκίστρι)")
KNOTS["uni_hook"] = dict(KNOTS["uni"], build=b_uni, anchor="hook", hook=HOOK_FLAT,
                         cam=(52, -22), frame_hook=True, title_en="Uni Knot (hook)",
                         title_el="Κόμπος Uni (αγκίστρι)")
KNOTS.update({
    "palomar": dict(build=b_palomar, states=7, anchor="hook", hook="palomar", guide=False,
        cam=(12, -14), frame_hook=True, zoom_from=3, frame_all=True,
        title_en="Palomar Knot", title_el="Κόμπος Palomar",
        timeline=[("draw", 0, "Double 15 cm of line, tie a loose overhand and pass the loop through the eye",
                   "Δίπλωσε 15 εκ., κάνε χαλαρό απλό κόμπο και πέρασε τη θηλιά από το μάτι"),
                  ("draw", 1, "Leave the loop big enough for the hook",
                   "Άφησε τη θηλιά αρκετά μεγάλη για το αγκίστρι"),
                  ("morph", [1, 2, 3, 4, 5], "Pass the loop over the whole hook",
                   "Πέρασε τη θηλιά πάνω από όλο το αγκίστρι"),
                  ("morph", [6], "Wet and pull both ends tight onto the eye",
                   "Βρέξε και τράβηξε και τις δύο άκρες να σφίξει στο μάτι")]),
    "snell": dict(build=b_snell, states=2, anchor="hook", hook=HOOK_SIDE,
        cam=(16, -16), frame_hook=True, title_en="Snell Knot", title_el="Κόμπος Snell",
        timeline=[("draw", 0, "Thread the line through the eye from the front, lay it along the shank",
                   "Πέρασε την πετονιά από μπροστά στο μάτι και άπλωσέ τη στο σώμα"),
                  ("draw", 1, "Form a loop back toward the eye", "Κάνε μια θηλιά πίσω προς το μάτι"),
                  ("draw", 2, "Wrap the tag 6 times round shank and line, toward the bend, through the loop",
                   "Τύλιξε την άκρη 6 φορές γύρω από σώμα και πετονιά, προς την καμπύλη, μέσα από τη θηλιά"),
                  ("morph", [1], "Pull the main line: the wraps tighten and slide to the eye. Trim",
                   "Τράβηξε την κύρια: οι βόλτες σφίγγουν και πάνε στο μάτι. Κόψε")]),
    "rapala": dict(build=b_rapala, states=2, anchor="hook", hook=HOOK_SIDE, cam=(20, -30),
        sim=dict(frm=0, free=[(0, "end")], pin=lambda g: np.nonzero(g[:, 0] < 1.0)[0],
                 steps=4500, cmin=0.12, snaps=24), focus_step=1,
        title_en="Rapala Loop Knot", title_el="Κόμπος θηλιάς Rapala",
        timeline=[("draw", 0, "Tie a loose overhand knot about 10 cm from the end",
                   "Κάνε χαλαρό απλό κόμπο περίπου 10 εκ. από την άκρη"),
                  ("draw", 1, "Through the eye and back through the overhand",
                   "Πέρασε από το μάτι και πίσω από τον απλό κόμπο"),
                  ("draw", 2, "Wrap the tag 3 times around the main line",
                   "Τύλιξε την άκρη 3 φορές γύρω από την κύρια"),
                  ("draw", 3, "Back through the overhand, from the same side",
                   "Ξανά μέσα από τον απλό κόμπο, από την ίδια πλευρά"),
                  ("draw", 4, "Tuck it through the small loop just formed",
                   "Πέρασέ την από τη μικρή θηλιά που σχηματίστηκε"),
                  ("morph", [1], "Wet and pull: the loop stays open for lure action",
                   "Βρέξε και σφίξε: η θηλιά μένει ανοιχτή για να δουλεύει το τεχνητό")]),
    "fg": dict(build=b_fg, states=2, anchor=None, cam=(24, -20),
        title_en="FG Knot (braid to leader)", title_el="Κόμπος FG (νήμα με παράμαλλο)",
        timeline=[("draw", 0, "Keep the braid tight; cross the leader under it",
                   "Κράτα το νήμα τεντωμένο· πέρασε το παράμαλλο από κάτω"),
                  ("draw", 1, "Weave the leader round the braid: over, under – 16–20 times",
                   "Πλέξε το παράμαλλο γύρω από το νήμα: πάνω, κάτω – 16–20 φορές"),
                  ("morph", [1], "Pull leader and braid hard to set the weave",
                   "Τράβηξε δυνατά παράμαλλο και νήμα να «κάτσει» η πλέξη"),
                  ("trim", "braid", -31, None, None),
                  ("draw", 2, "Half hitches with the braid tag around both lines",
                   "Μισοί κόμποι με την άκρη του νήματος γύρω και από τις δύο"),
                  ("trim", "leader", -2, "Trim the leader tag close",
                   "Κόψε κοντά την άκρη του παράμαλλου"),
                  ("draw", 3, "Finish with half hitches on the braid only",
                   "Τελείωσε με μισούς κόμπους μόνο στο νήμα"),
                  ("trim", "braid_tag", -2, "Trim the braid tag", "Κόψε την άκρη του νήματος")]),
    "double_uni": dict(build=b_double_uni, states=4, anchor=None, cam=(24, -18),
        title_en="Double Uni Knot", title_el="Διπλός κόμπος Uni",
        timeline=[("draw", 0, "Overlap the two lines by about 20 cm",
                   "Βάλε τις δύο πετονιές τη μία πάνω στην άλλη, περίπου 20 εκ."),
                  ("draw", 1, "Braid tag: loop, then 5 wraps around both lines",
                   "Άκρη νήματος: θηλιά και 5 βόλτες γύρω από τις δύο"),
                  ("morph", [1], "Snug it", "Σφίξ' τον"),
                  ("draw", 3, "Same with the leader tag, the other way",
                   "Το ίδιο με την άκρη του παράμαλλου, ανάποδα"),
                  ("morph", [2], "Snug it", "Σφίξ' τον"),
                  ("morph", [3], "Pull the main lines: the knots slide together. Trim",
                   "Τράβηξε τις κύριες: οι κόμποι ενώνονται. Κόψε τις άκρες")]),
    "albright": dict(build=b_albright, states=2, anchor=None, cam=(26, -20), focus_step=2,
        title_en="Albright Knot", title_el="Κόμπος Albright",
        timeline=[("draw", 0, "Make a loop in the heavier line (leader)",
                   "Κάνε θηλιά στη χοντρότερη πετονιά (παράμαλλο)"),
                  ("draw", 1, "Pass the braid through the loop",
                   "Πέρασε το νήμα μέσα από τη θηλιά"),
                  ("draw", 2, "Wrap it 10 times back over itself and the loop, toward the end",
                   "Τύλιξέ το 10 φορές πάνω στον εαυτό του και τη θηλιά, προς την άκρη της"),
                  ("draw", 3, "Back through the loop, out the same side it entered",
                   "Πίσω μέσα από τη θηλιά, να βγει από την ίδια πλευρά"),
                  ("morph", [1], "Wet, pull slowly, slide wraps to the loop end; trim",
                   "Βρέξε, τράβηξε αργά, κατέβασε τις βόλτες στην άκρη· κόψε")]),
    "blood": dict(build=b_blood, states=2, anchor=None, cam=(24, -18),
        title_en="Blood Knot", title_el="Κόμπος Blood",
        timeline=[("draw", 0, "Overlap the ends of the two lines",
                   "Βάλε τις άκρες των δύο πετονιών τη μία πάνω στην άλλη"),
                  ("draw", 1, "Wrap one tag 5 times around the other line",
                   "Τύλιξε τη μία άκρη 5 φορές γύρω από την άλλη πετονιά"),
                  ("draw", 2, "Bring it back through the gap between the lines",
                   "Φέρ' την πίσω και πέρασέ τη στο κενό ανάμεσα στις πετονιές"),
                  ("draw", 3, "Repeat with the other tag, through the same gap from the other side",
                   "Το ίδιο με την άλλη άκρη, από το ίδιο κενό, από την άλλη μεριά"),
                  ("morph", [1], "Wet and pull the lines apart; trim the tags",
                   "Βρέξε και τράβηξε τις πετονιές· κόψε τις άκρες")]),
})


# ================================================================ scene bits
def clear_scene():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for coll in (bpy.data.curves, bpy.data.meshes, bpy.data.materials,
                 bpy.data.cameras, bpy.data.lights, bpy.data.actions):
        for b in list(coll):
            coll.remove(b)


def material(name, col, metal=0.0, rough=0.4):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*col, 1)
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rough
    return m


def torus_mesh(name, R, r, mat, U=64, Vn=16):
    import bmesh
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    rows = []
    for i in range(U):
        a = TAU * i / U
        row = []
        for j in range(Vn):
            b = TAU * j / Vn
            rr = R + r * math.cos(b)
            row.append(bm.verts.new((rr * math.cos(a), rr * math.sin(a), r * math.sin(b))))
        rows.append(row)
    for i in range(U):
        for j in range(Vn):
            bm.faces.new((rows[i][j], rows[(i + 1) % U][j],
                          rows[(i + 1) % U][(j + 1) % Vn], rows[i][(j + 1) % Vn]))
    bm.to_mesh(me); bm.free()
    for p in me.polygons:
        p.use_smooth = True
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def tube(name, pts, radii, depth, mat, parent=None):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"; cu.bevel_depth = depth; cu.bevel_resolution = 6
    cu.use_fill_caps = True
    sp = cu.splines.new("POLY"); sp.points.add(len(pts) - 1)
    for p, v, r in zip(sp.points, pts, radii):
        p.co = (*v, 1); p.radius = r
    ob = bpy.data.objects.new(name, cu); cu.materials.append(mat)
    bpy.context.scene.collection.objects.link(ob)
    if parent:
        ob.parent = parent
    return ob


def swivel(mat):
    t = torus_mesh("Ring", RING_R, WIRE_R, mat); t.rotation_euler = (0, math.pi / 2, 0)
    t = torus_mesh("Link", 0.16, 0.035, mat); t.location = (-0.02, 0, RING_R)
    t.rotation_euler = (math.pi / 2, 0, 0)
    tube("Barrel", [(-0.2, 0, RING_R), (-0.85, 0, RING_R)], [1, 1], 0.12, mat)
    t = torus_mesh("Link2", 0.16, 0.035, mat); t.location = (-1.0, 0, RING_R)
    t.rotation_euler = (math.pi / 2, 0, 0)


def hook(mat, o, ex, ey):
    """J-hook in local XY: eye wire at origin, shank along -X, bend toward -Y."""
    ex, ey = Vector(ex).normalized(), Vector(ey).normalized()
    ez = ex.cross(ey)
    M = Matrix((ex, ey, ez)).transposed().to_4x4()
    M.translation = Vector(o)
    root = bpy.data.objects.new("Hook", None)
    bpy.context.scene.collection.objects.link(root)
    root.matrix_world = M
    eye = torus_mesh("HookEye", HOOK_RE, HOOK_W, mat, 64, 12)
    eye.location = (-HOOK_RE, 0, 0); eye.parent = root
    body = [(-2 * HOOK_RE, 0, 0), (-1.6, 0, 0), (-2.7, 0, 0), (-3.8, 0, 0)]
    for i in range(1, 17):
        a = math.pi / 2 + math.pi * i / 16
        body.append((-3.8 + 0.85 * math.cos(a), -0.85 + 0.85 * math.sin(a), 0))
    body += [(-3.4, -1.7, 0), (-3.05, -1.7, 0), (-2.85, -1.68, 0), (-2.68, -1.62, 0)]
    radii = [1] * (len(body) - 3) + [0.8, 0.45, 0.06]
    tube("HookBody", body, radii, HOOK_W, mat, root)
    tube("HookBarb", [(-2.92, -1.63, 0), (-3.08, -1.5, 0), (-3.2, -1.42, 0)],
         [0.7, 0.4, 0.05], HOOK_W, mat, root)
    return root


def line_material(name, col, kind):
    m = material(name, col, rough=0.35)
    nt = m.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    def setin(k, v):
        for key in (k if isinstance(k, tuple) else (k,)):
            if key in bsdf.inputs:
                bsdf.inputs[key].default_value = v
                return
    if kind == "braid":                         # woven, matte, fibres
        setin("Roughness", 0.62)
        tc = nt.nodes.new("ShaderNodeTexCoord")
        wave = nt.nodes.new("ShaderNodeTexWave")
        wave.wave_type = "BANDS"; wave.bands_direction = "DIAGONAL"
        wave.inputs["Scale"].default_value = 60.0
        wave.inputs["Distortion"].default_value = 2.0
        noise = nt.nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = 300.0
        mix = nt.nodes.new("ShaderNodeMath"); mix.operation = "ADD"
        bump = nt.nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.35
        nt.links.new(tc.outputs["Object"], wave.inputs["Vector"])
        nt.links.new(tc.outputs["Object"], noise.inputs["Vector"])
        nt.links.new(wave.outputs["Fac"], mix.inputs[0])
        nt.links.new(noise.outputs["Fac"], mix.inputs[1])
        nt.links.new(mix.outputs[0], bump.inputs["Height"])
        nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    elif kind == "leader":                      # fluorocarbon: clear, glossy
        setin("Roughness", 0.08)
        setin(("Transmission Weight", "Transmission"), 0.6)
        setin("IOR", 1.42)
        setin(("Coat Weight", "Clearcoat"), 0.5)
    else:                                       # nylon mono: glossy
        setin("Roughness", 0.22)
        setin(("Coat Weight", "Clearcoat"), 0.4)
        setin(("Coat Roughness", "Clearcoat Roughness"), 0.08)
    return m


def rope(name, dense_states, col, r):
    kind = "braid" if "braid" in name else "leader" if "leader" in name else "mono"
    m = line_material(name, col, kind)
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"; cu.bevel_depth = r; cu.bevel_resolution = 4
    cu.use_fill_caps = True
    try:
        cu.bevel_factor_mapping_end = "SPLINE"
    except Exception:
        pass
    base = dense_states[0]
    sp = cu.splines.new("POLY"); sp.points.add(len(base) - 1)
    for p, v in zip(sp.points, base):
        p.co = (v.x, v.y, v.z, 1)
    ob = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(ob)
    cu.materials.append(m)
    ob.shape_key_add(name="Basis", from_mix=False)
    for k, pts in enumerate(dense_states[1:], 1):
        key = ob.shape_key_add(name=f"S{k}", from_mix=False)
        for d, v in zip(key.data, pts):
            d.co = v
    return ob


def set_interp(kind):
    try:
        bpy.context.preferences.edit.keyframe_new_interpolation_type = kind
    except Exception:
        pass


def cumlen(pts):
    c = [0.0]
    for a, b in zip(pts, pts[1:]):
        c.append(c[-1] + (b - a).length)
    return c



# ======================================================== guided tightening
GUIDE_H = 0.55          # sample spacing / rope radius
GUIDE_T = 160           # sim steps per morph
GUIDE_SNAPS = 16        # states kept per morph
GUIDE_STIFF = 0.08      # tension / bending smoothing


def catmull_var(ctrl, ns):
    P = [Vector(c[:3]) for c in ctrl]
    st = [c[3] for c in ctrl]
    P = [P[0]] + P + [P[-1]]
    out, ost = [], []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        n = ns[i - 1]
        for k in range(n):
            t = k / n
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
                              (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
            ost.append(st[i] if k else st[i - 1])
    out.append(P[-2]); ost.append(st[-1])
    return np.array([tuple(v) for v in out]), ost


def guided(lines_X0, lines_B, radii, metal, steps=GUIDE_T, snaps=GUIDE_SNAPS, settle=120):
    """Move each line from X0 to B while ropes and metal block each other."""
    L_ = len(lines_X0)
    off = np.cumsum([0] + [len(p) for p in lines_X0])
    X0 = np.concatenate(lines_X0); B = np.concatenate(lines_B)
    X = X0.copy(); N = len(X)
    lid = np.concatenate([np.full(len(p), i) for i, p in enumerate(lines_X0)])
    idx = np.concatenate([np.arange(len(p)) for p in lines_X0])
    R = np.array([radii[i] for i in lid])
    seg_a = np.concatenate([np.arange(off[i], off[i + 1] - 1) for i in range(L_)])
    seg_b = seg_a + 1
    w = np.ones(N)
    for i in range(L_):
        w[off[i]] = 0; w[off[i + 1] - 1] = 0
    h = np.median(np.linalg.norm(B[seg_b] - B[seg_a], axis=1))
    skip = np.ceil(2.4 * R / max(h, 1e-3)).astype(int)
    # bending limits: points k apart along a line keep a minimum distance
    bend = []
    for k, f in ((2, 1.7), (4, 3.0), (6, 3.9)):
        a_ = np.concatenate([np.arange(off[i], off[i + 1] - k) for i in range(L_) if off[i + 1] - off[i] > k])
        bend.append((a_, a_ + k, f))
    if metal is not None:
        MP, MR = metal
    prv = np.arange(N) - 1; nxt_ = np.arange(N) + 1
    for i in range(L_):
        prv[off[i]] = off[i]; nxt_[off[i + 1] - 1] = off[i + 1] - 1
    def project(M, rest, pull, its):
        nonlocal X
        for _ in range(its):
            d = X[seg_b] - X[seg_a]
            ln = np.linalg.norm(d, axis=1) + 1e-12
            ex = np.maximum(ln - rest, 0) + np.minimum(ln - 0.6 * rest, 0)   # taut, may slacken
            corr = (ex / ln)[:, None] * d
            wa, wb = w[seg_a], w[seg_b]; ws = wa + wb + 1e-12
            dx = np.zeros_like(X); cnt = np.zeros(N)
            np.add.at(dx, seg_a, corr * (wa / ws)[:, None]); np.add.at(dx, seg_b, -corr * (wb / ws)[:, None])
            np.add.at(cnt, seg_a, 1); np.add.at(cnt, seg_b, 1)
            X += 0.8 * dx / np.maximum(cnt, 1)[:, None]
            for a_, b_, f in bend:
                d = X[b_] - X[a_]
                ln = np.linalg.norm(d, axis=1) + 1e-12
                mn = f * 0.6 * rest.mean()
                m_ = ln < mn
                if m_.any():
                    c = (((ln - mn) / ln)[:, None] * d)[m_]
                    wa, wb = w[a_[m_]], w[b_[m_]]; ws = wa + wb + 1e-12
                    dx = np.zeros_like(X); cnt = np.zeros(N)
                    np.add.at(dx, a_[m_], c * (wa / ws)[:, None]); np.add.at(dx, b_[m_], -c * (wb / ws)[:, None])
                    np.add.at(cnt, a_[m_], 1); np.add.at(cnt, b_[m_], 1)
                    X += 0.5 * dx / np.maximum(cnt, 1)[:, None]
            X += pull * (M - X) * w[:, None]
            # tension / bending stiffness: straighten kinks, take up slack
            mid = 0.5 * (X[prv] + X[nxt_])
            X += GUIDE_STIFF * (mid - X) * w[:, None]
            for _ in range(2):
                _contacts(X, R, lid, idx, skip, w)
                if metal is not None:
                    Dm = X[:, None, :] - MP[None, :, :]
                    dm = np.sqrt((Dm ** 2).sum(-1)) + 1e-12
                    lm = R[:, None] + MR[None, :]
                    mm = (dm < lm) & (w[:, None] > 0)
                    if mm.any():
                        i, j = np.nonzero(mm)
                        dx = np.zeros_like(X); cnt = np.zeros(N)
                        np.add.at(dx, i, (Dm[i, j] / dm[i, j][:, None]) * (lm[i, j] - dm[i, j])[:, None])
                        np.add.at(cnt, i, 1)
                        X += dx / np.maximum(cnt, 1)[:, None]
    out = []
    snap_at = set(int(steps * (k + 1) / snaps) for k in range(snaps - 1))
    Mp = X0
    for k in range(1, steps + 1):
        t = k / steps
        t = t * t * (3 - 2 * t)
        M = X0 + (B - X0) * t
        X += (M - Mp) * w[:, None]
        X[w == 0] = M[w == 0]
        Mp = M
        rest = np.linalg.norm(M[seg_b] - M[seg_a], axis=1)
        project(M, rest, 0.03, 5)
        if k in snap_at:
            out.append([X[off[i]:off[i + 1]].copy() for i in range(L_)])
    out.append([X[off[i]:off[i + 1]].copy() for i in range(L_)])
    rest = np.linalg.norm(B[seg_b] - B[seg_a], axis=1)
    for k in range(4):
        for _ in range(settle // 40):
            project(B, rest, 0.03, 10)
        out.append([X[off[i]:off[i + 1]].copy() for i in range(L_)])
    return out


def with_guide(kid, K, states, timeline):
    """Dense, evenly sampled states; every morph becomes a collision-free sim."""
    nl = len(states[0])
    skipn = set(K.get("guide_skip", ()))
    dense = [[None] * nl for _ in states]
    tags = []
    for li in range(nl):
        r = states[0][li]["r"]
        h = GUIDE_H * r
        nc = len(states[0][li]["pts"])
        ns = []
        for i in range(nc - 1):
            m = 0.0
            for S in range(len(states)):
                a, b = states[S][li]["pts"][i], states[S][li]["pts"][i + 1]
                if abs(a[2]) > 15 or abs(b[2]) > 15:
                    continue
                m = max(m, math.dist(a[:3], b[:3]))
            ns.append(max(1, int(math.ceil(1.25 * m / h))))
        for S in range(len(states)):
            d, st = catmull_var(states[S][li]["pts"], ns)
            dense[S][li] = d
            if S == 0:
                tags.append(st)
    metal = metal_points(K)
    radii = [states[0][li]["r"] for li in range(nl)]
    cache = _cache_path()
    z = dict(np.load(cache)) if os.path.exists(cache) else None
    seq = [[d.copy() for d in dense[0]]]
    cur_X = seq[0]
    cur = 0
    new_tl = []
    tcount = 0
    for e in timeline:
        if e[0] != "morph":
            new_tl.append(e); continue
        last = e is [x for x in timeline if x[0] == "morph"][-1]
        idxs, frames = [], []
        for nxt in e[1]:
            key = f"g:{kid}|{tcount}"
            simli = [li for li in range(nl) if states[0][li]["name"] not in skipn]
            if z is not None and f"{key}|0|{simli[0]}" in z:
                nsn = max(int(k.split("|")[2]) for k in z if k.startswith(key + "|")) + 1
                snaps = [[z[f"{key}|{s_}|{li}"] for li in simli] for s_ in range(nsn)]
            else:
                print(f"[{kid}] guided tightening {tcount} (no cache – slow)…")
                # chain lines that continue one another (end of a == start of b)
                chains, used = [], set()
                for li in simli:
                    if li in used:
                        continue
                    ch = [li]; used.add(li)
                    while True:
                        e_ = cur_X[ch[-1]][-1]
                        nx = [lj for lj in simli if lj not in used and np.linalg.norm(cur_X[lj][0] - e_) < 1e-4]
                        if not nx:
                            break
                        ch.append(nx[0]); used.add(nx[0])
                    chains.append(ch)
                cx = [np.concatenate([cur_X[l][1:] if k else cur_X[l] for k, l in enumerate(ch)]) for ch in chains]
                cb = [np.concatenate([dense[nxt][l][1:] if k else dense[nxt][l] for k, l in enumerate(ch)]) for ch in chains]
                cr = [max(radii[l] for l in ch) for ch in chains]
                gs = guided(cx, cb, cr, metal)
                snaps = []
                for g in gs:
                    per = {}
                    for ci, ch in enumerate(chains):
                        pos = 0
                        for k, l in enumerate(ch):
                            n = len(cur_X[l])
                            if k:
                                per[l] = g[ci][pos - 1:pos - 1 + n]; pos += n - 1
                            else:
                                per[l] = g[ci][:n]; pos = n
                    snaps.append([per[li] for li in simli])
                GUIDE_NEW[key] = snaps
            for j, sn in enumerate(snaps):
                full = []
                t = (j + 1) / len(snaps)
                for li in range(nl):
                    if li in simli:
                        full.append(sn[simli.index(li)])
                    else:
                        full.append(cur_X[li] + (dense[nxt][li] - cur_X[li]) * t)
                seq.append(full)
                idxs.append(len(seq) - 1)
            fm = F_FINAL if (last and nxt == e[1][-1]) else F_MORPH
            frames += [max(4, round(fm * (0.85 if j < len(snaps) - 1 else 0.6) / (len(snaps) - 0.4)))
                       for j in range(len(snaps))]
            cur_X = seq[-1]
            cur = nxt
            tcount += 1
        new_tl.append(("morph", idxs, ("guide", frames), e[-2], e[-1]))
    def mk(arrs):
        return [dict(states[0][li], pts=[(*map(float, p), tg) for p, tg in zip(arrs[li], tags[li])],
                     samples=1) for li in range(nl)]
    return [mk(a) for a in seq], new_tl


GUIDE_NEW = {}


# ===================================================================== build
def with_sim(kid, K, states, timeline):
    """Replace the hand-made final state by a physically simulated tightening."""
    sim = K["sim"]
    frm = sim["frm"]
    nl = len(states[0])
    res = []                                    # per state, per line: (N,3)
    tags = []
    for li in range(nl):
        ln0 = states[frm][li]
        d, _ = catmull(ln0["pts"], ln0["samples"])
        P = np.array([tuple(v) for v in d])
        L_ = np.linalg.norm(np.diff(P, axis=0), axis=1).sum()
        n = max(8, int(L_ / (SIM_H * ln0["r"])) + 1)
        d0, st0 = catmull(states[0][li]["pts"], states[0][li]["samples"])
        P0 = np.array([tuple(v) for v in d0])
        c0 = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(P0, axis=0), axis=1))]); c0 /= c0[-1]
        u = np.linspace(0, 1, n)
        tg = [st0[min(len(st0) - 1, int(np.searchsorted(c0, x)))] for x in u]
        for k in range(1, len(tg)):              # keep step tags monotonic
            if tg[k] != -1 and tg[k] < tg[k - 1]:
                tg[k] = tg[k - 1]
        tags.append(tg)
        per = []
        for S in range(frm + 1):
            d, _ = catmull(states[S][li]["pts"], states[S][li]["samples"])
            Q, _ = pbd_resample([tuple(v) for v in d], 1.0)
            Q = np.array([tuple(v) for v in d])
            c = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(Q, axis=0), axis=1))])
            t = np.linspace(0, c[-1], n)
            per.append(np.stack([np.interp(t, c, Q[:, k]) for k in range(3)], 1))
        res.append(per)
    start = [res[li][frm] for li in range(nl)]
    snaps = run_sim(kid, K, start, [states[frm][li]["r"] for li in range(nl)], tags)
    def mk(arrs):
        return [dict(states[0][li], pts=[(*map(float, p), tg) for p, tg in zip(arrs[li], tags[li])],
                     samples=1) for li in range(nl)]
    new = [mk([res[li][S] for li in range(nl)]) for S in range(frm + 1)]
    new += [mk(sn) for sn in snaps]
    sim_states = list(range(frm + 1, frm + 1 + len(snaps)))
    tl, done = [], False
    for e in reversed(timeline):
        if e[0] == "morph" and not done:
            e = ("morph", sim_states, "sim", e[-2], e[-1]); done = True
        tl.append(e)
    return new, list(reversed(tl))


def build(kid):
    K = KNOTS[kid]
    sc = bpy.context.scene
    clear_scene()
    sc.render.fps = FPS

    # --- geometry for every state
    states = [K["build"](S) for S in range(K["states"])]
    timeline_def = list(K["timeline"])
    if "sim" in K:
        states, timeline_def = with_sim(kid, K, states, timeline_def)
    elif K.get("guide", True):
        states, timeline_def = with_guide(kid, K, states, timeline_def)
    nstates = len(states)
    lines = []
    for li, ln in enumerate(states[0]):
        dense, steps = [], None
        for S in range(nstates):
            d, st = catmull(states[S][li]["pts"], ln["samples"])
            dense.append(d)
            if steps is None:
                steps = st
        n = len(dense[0])
        for S, d in enumerate(dense):
            if len(d) != n:
                raise ValueError(f"{kid}/{ln['name']}: state {S} has {len(d)} pts, expected {n}")
        for a, b in zip(steps, steps[1:]):
            if b < a and b != -1:
                raise ValueError(f"{kid}/{ln['name']}: steps not monotonic")
        lines.append(dict(ln, dense=dense, steps=steps,
                          ob=rope(f"{kid}_{ln['name']}", dense, ln["col"], ln["r"])))

    # --- anchor
    hook_root = None
    if K.get("anchor") == "ring":
        swivel(material("Metal", COL_METAL, metal=1.0, rough=0.25))
    elif K.get("anchor") == "hook":
        hm = material("Hook", COL_HOOK, metal=1.0, rough=0.3)
        if K["hook"] == "palomar":
            o, ex, ey = palomar_hook()
            hook_root = hook(hm, o, ex, ey)
        else:
            hook_root = hook(hm, **K["hook"])

    # --- timeline
    set_interp("LINEAR")
    cur_state, f = 0, 1
    vis = {}
    for ln in lines:
        c = cumlen(ln["dense"][0])
        last = max([i for i, s in enumerate(ln["steps"]) if s == -1], default=0)
        vis[ln["name"]] = c[last] / c[-1] if any(s == -1 for s in ln["steps"]) else 0.0
        if vis[ln["name"]] > 0.999:
            vis[ln["name"]] = 1.0
        ln["ob"].data.bevel_factor_end = vis[ln["name"]]
        ln["ob"].data.keyframe_insert("bevel_factor_end", frame=1)
    f += F_INTRO
    timeline = []
    pending = None
    for entry in timeline_def:
        kind = entry[0]
        start = f
        if kind == "draw":
            k = entry[1]
            targets, longest = [], 0.0
            for ln in lines:
                idx = [i for i, s in enumerate(ln["steps"]) if s == k]
                if not idx:
                    continue
                c = cumlen(ln["dense"][cur_state])
                frac = 1.0 if idx[-1] == len(c) - 1 else c[idx[-1]] / c[-1]
                longest = max(longest, (frac - vis[ln["name"]]) * c[-1])
                targets.append((ln, frac))
            dur = int(min(F_STEP_MAX, max(F_STEP_MIN, longest * F_PER_UNIT)))
            set_interp("LINEAR")
            for ln, frac in targets:
                cu = ln["ob"].data
                cu.bevel_factor_end = vis[ln["name"]]
                cu.keyframe_insert("bevel_factor_end", frame=f)
                cu.bevel_factor_end = frac
                cu.keyframe_insert("bevel_factor_end", frame=f + dur)
                vis[ln["name"]] = frac
            f += dur
        elif kind == "morph":
            set_interp("BEZIER")
            last_morph = entry is [e for e in timeline_def if e[0] == "morph"][-1]
            for jn, nxt in enumerate(entry[1]):
                FM = F_FINAL if last_morph and nxt == entry[1][-1] else F_MORPH
                if entry[-3:-2] == ("sim",):
                    FM = F_SIM
                if isinstance(entry[2], tuple) and entry[2][0] == "guide":
                    FM = entry[2][1][jn]
                    set_interp("LINEAR")
                for ln in lines:
                    kb = ln["ob"].data.shape_keys.key_blocks
                    if cur_state:
                        kb[f"S{cur_state}"].value = 1.0
                        kb[f"S{cur_state}"].keyframe_insert("value", frame=f)
                        kb[f"S{cur_state}"].value = 0.0
                        kb[f"S{cur_state}"].keyframe_insert("value", frame=f + FM)
                    kb[f"S{nxt}"].value = 0.0
                    kb[f"S{nxt}"].keyframe_insert("value", frame=f)
                    kb[f"S{nxt}"].value = 1.0
                    kb[f"S{nxt}"].keyframe_insert("value", frame=f + FM)
                cur_state = nxt
                f += FM
        elif kind == "trim":
            name, keep = entry[1], entry[2]
            ln = next(l for l in lines if l["name"] == name)
            set_interp("BEZIER")
            cu = ln["ob"].data
            cu.bevel_factor_end = vis[name]
            cu.keyframe_insert("bevel_factor_end", frame=f)
            c = cumlen(ln["dense"][cur_state])
            nctrl = len(ln["pts"])
            ci = keep % nctrl if keep < 0 else keep
            new = c[min(len(c) - 1, ci * max(1, ln["samples"]))] / c[-1]
            cu.bevel_factor_end = new
            cu.keyframe_insert("bevel_factor_end", frame=f + F_TRIM)
            vis[name] = new
            f += F_TRIM
        if entry[-2] is None:
            pending = start if pending is None else pending
            continue
        if pending is not None:
            start, pending = pending, None
        timeline.append((start, f, entry[-2], entry[-1]))
        f += F_PAUSE
    f_tight = f - F_PAUSE
    poster = f_tight + F_HOLD
    f_end = poster + F_ORBIT
    sc.frame_start, sc.frame_end = 1, f_end

    # --- camera (orthographic, framed on the knot)
    elev, az = [math.radians(a) for a in K.get("cam", (20, -18))]
    def focus(S, with_hook, min_step=0):
        pts = []
        for li in range(len(lines)):
            pts += [Vector(p[:3]) for p in states[S][li]["pts"]
                    if p[3] >= min_step and abs(p[2]) < 15]
        if with_hook and hook_root is not None:
            bpy.context.view_layer.update()
            for ob in hook_root.children:
                pts += [ob.matrix_world @ Vector(c) for c in ob.bound_box]
        return pts
    def frame(pts):
        fwd = -Vector((math.cos(elev) * math.sin(az), -math.cos(elev) * math.cos(az),
                       math.sin(elev)))
        right = fwd.cross(Vector((0, 0, 1))).normalized()
        up = right.cross(fwd)
        xs = [p.dot(right) for p in pts]; ys = [p.dot(up) for p in pts]
        zs = [p.dot(fwd) for p in pts]
        c = (right * (min(xs) + max(xs)) / 2 + up * (min(ys) + max(ys)) / 2 +
             fwd * (min(zs) + max(zs)) / 2)
        return c, max(max(xs) - min(xs), max(ys) - min(ys)) * 1.08 + 0.3
    p0 = focus(0, K.get("frame_hook", False))
    if K.get("frame_all"):
        for S in range(1, nstates - 1):
            p0 += focus(S, False)
    c0, s0 = frame(p0)
    c1, s1 = frame(focus(cur_state, kid == "snell",
                         K.get("focus_step", 1 if K.get("anchor") is None else 0)))
    pivot = bpy.data.objects.new("CamPivot", None)
    sc.collection.objects.link(pivot)
    cam_d = bpy.data.cameras.new("Cam"); cam_d.type = "ORTHO"
    cam_d.clip_end = 200
    cam = bpy.data.objects.new("Cam", cam_d); sc.collection.objects.link(cam)
    cam.parent = pivot
    cam.location = (0, -20 * math.cos(elev), 20 * math.sin(elev))
    tr = cam.constraints.new("TRACK_TO")
    tr.target = pivot; tr.track_axis = "TRACK_NEGATIVE_Z"; tr.up_axis = "UP_Y"
    sc.camera = cam
    kinds = [e[0] for e in timeline_def if e[-2] is not None]
    i = len(kinds)
    while i > 0 and kinds[i - 1] in ("morph", "trim"):
        i -= 1
    i = K.get("zoom_from", i)
    t_morph = timeline[i][0] if i < len(timeline) else timeline[-1][0]
    set_interp("BEZIER")
    for fr, c, s, rz in ((1, c0, s0, az), (t_morph, c0, s0, az + 0.12),
                         (f_tight, c1, s1, az + 0.2), (poster, c1, s1, az + 0.2),
                         (poster + F_ORBIT // 3, c1, s1, az + 0.75),
                         (poster + 2 * F_ORBIT // 3, c1, s1, az - 0.35),
                         (f_end, c1, s1, az + 0.2)):
        pivot.location = c; pivot.rotation_euler = (0, 0, rz)
        cam_d.ortho_scale = s
        pivot.keyframe_insert("location", frame=fr)
        pivot.keyframe_insert("rotation_euler", frame=fr)
        cam_d.keyframe_insert("ortho_scale", frame=fr)

    # --- lights + world
    sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
    sun.data.energy = 3.5; sun.rotation_euler = (0.9, 0.2, -0.6)
    sc.collection.objects.link(sun)
    fill = bpy.data.objects.new("Fill", bpy.data.lights.new("Fill", "AREA"))
    fill.data.energy = 400; fill.data.size = 6
    fill.location = (2, -6, -3); fill.rotation_euler = (2.0, 0, 0.3)
    sc.collection.objects.link(fill)
    rim = bpy.data.objects.new("Rim", bpy.data.lights.new("Rim", "SUN"))
    rim.data.energy = 1.5; rim.rotation_euler = (-0.8, 0, 2.6)
    sc.collection.objects.link(rim)
    w = sc.world or bpy.data.worlds.new("World")
    sc.world = w; w.use_nodes = True
    bg = w.node_tree.nodes.get("Background")
    bg.inputs[0].default_value = (*BG_COLOR, 1); bg.inputs[1].default_value = 1.0

    data = dict(id=kid, title_en=K["title_en"], title_el=K["title_el"], fps=FPS,
                frames=f_end, poster_frame=poster, duration=round(f_end / FPS, 2),
                steps=[dict(en=en, el=el, start=round((a - 1) / FPS, 2),
                            end=round((b - 1) / FPS, 2)) for a, b, en, el in timeline])
    return data


def keep_len_frac(ln, S, keep):
    """Fraction of the line length to cut so that `keep` units of tag remain
    beyond the last point that is not part of the free tag."""
    pts = ln["dense"][S]
    c = cumlen(pts)
    # free tag = trailing points; cut back to (end - tag_len + keep)
    tag_len = ln.get("tag_len", 0.5)
    return max(0.0, (tag_len - keep) / c[-1])


# ==================================================================== render
def setup_render(engine, samples, res, transparent):
    sc = bpy.context.scene
    r = sc.render
    names = r.bl_rna.properties["engine"].enum_items.keys()
    if engine == "eevee":
        r.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in names else "BLENDER_EEVEE"
        try:
            sc.eevee.taa_render_samples = samples
        except Exception:
            pass
    else:
        r.engine = "CYCLES"
        sc.cycles.samples = samples
        sc.cycles.use_denoising = True
    r.resolution_x = r.resolution_y = res
    r.resolution_percentage = 100
    r.film_transparent = transparent
    try:
        sc.view_settings.view_transform = "Standard"
    except Exception:
        pass


def set_video(path):
    r = bpy.context.scene.render
    try:
        r.image_settings.media_type = "VIDEO"
    except Exception:
        pass
    r.image_settings.file_format = "FFMPEG"
    r.ffmpeg.format = "MPEG4"; r.ffmpeg.codec = "H264"
    r.ffmpeg.constant_rate_factor = "HIGH"; r.ffmpeg.ffmpeg_preset = "GOOD"
    r.filepath = path


def set_png(path, alpha):
    r = bpy.context.scene.render
    try:
        r.image_settings.media_type = "IMAGE"
    except Exception:
        pass
    r.image_settings.file_format = "PNG"
    r.image_settings.color_mode = "RGBA" if alpha else "RGB"
    r.filepath = path


def run(args):
    out = os.path.abspath(bpy.path.abspath(args.get("out", OUT_DIR)))
    os.makedirs(out, exist_ok=True)
    print("Output folder:", out)
    ids = list(KNOTS) if args.get("knot") == "all" else args.get("knot", KNOT).split(",")
    for kid in ids:
        data = build(kid)
        setup_render(args.get("engine", ENGINE), int(args.get("samples", SAMPLES)),
                     int(args.get("res", RES)), "transparent" in args)
        with open(os.path.join(out, f"knot_{kid}.json"), "w", encoding="utf-8") as fh:
            json.dump(data, fh, ensure_ascii=False, indent=1)
        sc = bpy.context.scene
        set_png(os.path.join(out, f"knot_{kid}_poster.png"), "transparent" in args)
        sc.frame_set(data["poster_frame"])
        bpy.ops.render.render(write_still=True)
        if "poster-only" in args:
            continue
        if "png" in args or "transparent" in args:
            set_png(os.path.join(out, f"knot_{kid}_"), "transparent" in args)
        else:
            set_video(os.path.join(out, f"knot_{kid}.mp4"))
        bpy.ops.render.render(animation=True)
        print("done", kid, "->", out)


def parse_args():
    if "--" not in sys.argv:
        return None
    a, it = {}, iter(sys.argv[sys.argv.index("--") + 1:])
    for tok in it:
        if tok.startswith("--"):
            k = tok[2:]
            a[k] = True if k in ("png", "transparent", "poster-only") else next(it)
    return a


if __name__ == "__main__":
    args = parse_args()
    if args:
        FPS = int(args.get("fps", FPS))
        run(args)
    else:
        build(KNOT)
        bpy.context.scene.frame_set(1)
