#!/usr/bin/env python3
"""Alkyon 1.12.8 · κόβει τις περιοχές του ProtectedSeas Navigator στη θάλασσα.

Γιατί: στον χάρτη «Περιορισμοί» έβγαιναν και περιοχές ή κομμάτια πάνω στη στεριά (δασικά πάρκα, καταφύγια θηραμάτων,
αλυκές, ζώνες για πουλιά), ενώ ο χάρτης του Navigator δείχνει μόνο τη θάλασσα. Εδώ αφαιρείται η στεριά από κάθε περιοχή:
- Κύπρος και Ελλάδα: με την ακριβή ακτογραμμή του OpenStreetMap (coast_cy.geojson, coast_gr.geojson).
- αλλού: με το Natural Earth 1:10m (δημόσιο κτήμα), «μαζεμένο» ~200 m προς τη στεριά για να μη χάνονται παράκτια νερά
  εξαιτίας της πιο χοντρής ακτογραμμής του.
Περιοχές που μένουν σχεδόν ολόκληρες στη στεριά (κάτω από 3% στη θάλασσα) βγαίνουν από το αρχείο.

Χρήση: python3 tools/nav_clip.py <ne_10m_land.geojson> [navigator-mpa.json] [nav/]
pip install shapely"""
import glob
import re
import json
import os
import sys

from shapely.geometry import Polygon, MultiPolygon, shape, box
from shapely.ops import unary_union
from shapely.strtree import STRtree
from shapely.validation import make_valid

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ne_path = sys.argv[1]
med_path = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, 'navigator-mpa.json')
world_dir = sys.argv[3] if len(sys.argv) > 3 else os.path.join(ROOT, 'nav')


def load_polys(path, erode=0.0):
    out = []
    for f in json.load(open(path))['features']:
        g = make_valid(shape(f['geometry']))
        parts = list(g.geoms) if hasattr(g, 'geoms') else [g]
        for p in parts:
            if p.geom_type != 'Polygon' or p.is_empty:
                continue
            if erode:
                p = p.buffer(-erode)
                if p.is_empty:
                    continue
                if p.geom_type == 'MultiPolygon':
                    out.extend(list(p.geoms))
                    continue
            out.append(p)
    return out


# γεωμετρία σε (lon, lat), όπως στα GeoJSON
OSM = []
for name in ('coast_cy.geojson', 'coast_gr.geojson'):
    meta = json.load(open(os.path.join(ROOT, name))).get('metadata', {})
    bb = meta.get('bbox')
    OSM.append((box(*bb), load_polys(os.path.join(ROOT, name))))
OSM_TREES = [(bb, polys, STRtree(polys)) for bb, polys in OSM]
NE = load_polys(ne_path, erode=0.002)
NE_TREE = STRtree(NE)
print('land: OSM', [len(p) for _, p in OSM], 'NE', len(NE))


def land_for(geom):
    """η στεριά που ακουμπά τη γεωμετρία· OSM όπου υπάρχει, αλλιώς Natural Earth"""
    parts = []
    rest = geom
    for bb, polys, tree in OSM_TREES:
        if not geom.intersects(bb):
            continue
        sub = geom.intersection(bb)
        idx = tree.query(sub)
        parts.extend(polys[i] for i in idx)
        rest = rest.difference(bb)
    if not rest.is_empty:
        idx = NE_TREE.query(rest)
        parts.extend(NE[i] for i in idx)
    return unary_union(parts) if parts else None


def to_shape(g):
    polys = []
    for poly in g:
        rings = [[(p[1], p[0]) for p in r] for r in poly if len(r) >= 3]
        if not rings:
            continue
        p = make_valid(Polygon(rings[0], rings[1:]))
        polys.append(p)
    return unary_union(polys) if polys else None


def from_shape(s):
    parts = list(s.geoms) if hasattr(s, 'geoms') else [s]
    out = []
    for p in parts:
        if p.geom_type != 'Polygon' or p.is_empty or p.area < 1e-9:
            continue
        rings = [p.exterior] + list(p.interiors)
        out.append([[[round(y, 5), round(x, 5)] for x, y in r.coords] for r in rings])
    return out


MARINE = re.compile(r'marine|sea|coast|reef|bay|fish|θαλάσσ|θαλασσ|ακτ', re.I)


def clip(features, tag):
    keep, dropped, cut = [], [], 0
    for f in features:
        try:
            s = to_shape(f.get('g') or [])
        except Exception:
            s = None
        if s is None or s.is_empty:
            keep.append(f)
            continue
        land = land_for(s)
        if land is None or not s.intersects(land):
            keep.append(f)
            continue
        try:
            sea = make_valid(s.difference(land))
        except Exception:
            keep.append(f)
            continue
        frac = sea.area / s.area if s.area else 1
        osm = any(bb.contains(s) for bb, _, _ in OSM_TREES)
        if frac < 0.03 and not osm and MARINE.search((f.get('d') or '') + ' ' + (f.get('n') or '')):
            keep.append(f)   # χοντρή ακτογραμμή (Natural Earth): δεν σβήνουμε θαλάσσια περιοχή, μένει όπως ήταν
            continue
        if frac < 0.03:
            dropped.append((f.get('c'), f.get('l'), f.get('d'), f.get('n')))
            continue
        if frac < 0.999:
            sea = sea.simplify(0.00005, preserve_topology=True)
            g = from_shape(sea)
            if not g:
                dropped.append(f.get('n'))
                continue
            f['g'] = g
            minx, miny, maxx, maxy = sea.bounds
            f['b'] = [round(miny, 5), round(minx, 5), round(maxy, 5), round(maxx, 5)]
            cut += 1
        keep.append(f)
    print(tag, 'features', len(features), 'cut', cut, 'dropped', len(dropped))
    return keep, dropped


j = json.load(open(med_path))
j['f'], d = clip(j['f'], 'med')
for n in d:
    print('  -', n)
json.dump(j, open(med_path, 'w'), ensure_ascii=False, separators=(',', ':'))

idx_path = os.path.join(world_dir, 'index.json')
ix = json.load(open(idx_path))
for p in sorted(glob.glob(os.path.join(world_dir, 'w_*.json'))):
    t = json.load(open(p))
    t['f'], _ = clip(t['f'], os.path.basename(p))
    k = os.path.basename(p)[2:-5]
    if t['f']:
        json.dump(t, open(p, 'w'), ensure_ascii=False, separators=(',', ':'))
        ix['t'][k] = len(t['f'])
    else:
        os.remove(p)
        ix['t'].pop(k, None)
json.dump(ix, open(idx_path, 'w'), ensure_ascii=False, separators=(',', ':'))
