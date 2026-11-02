#!/usr/bin/env python3
"""Alkyon - coastline from OpenStreetMap.

Source: OSM land polygons, split, WGS84 (osmdata.openstreetmap.de, land-polygons-split-4326).
Data (c) OpenStreetMap contributors, ODbL 1.0 - attribution is shown in the app (exposure card).

Usage: python3 coastline_build.py <path to land_polygons.shp> <output dir>
Writes (flat files, repo root):
  coastgrid.js      land/sea raster used by exposure.js (same format as before: lon0, lat1, step, w, h, rle)
  cx_index.json, cx_N..E...json  1x1 deg tiles (Cyprus, Greece) for the sea-state map layer (seastate.js):
                    fetch per wind direction, distance to land, EMODnet depth, precise OSM land polygons
  coast_cy.geojson  land polygons, Cyprus
  coast_gr.geojson  land polygons, Greece
"""
import base64
import datetime
import json
import sys

import numpy as np
import shapefile  # pyshp
from PIL import Image, ImageDraw
from shapely.geometry import box, mapping, shape
from shapely.ops import unary_union

# ---------- raster for exposure.js (fetch rays) ----------
# Same area as the previous Natural Earth grid: Cyprus, Greece, Aegean, Ionian,
# plus the coasts that bound fetch (Turkey, Levant, Albania, Libya/Egypt edge is outside).
GRID = dict(lon0=19.0, lat1=42.0, lon1=36.0, lat0=33.0, step=0.0025)  # ~250 m cells

# ---------- polygons ----------
REGIONS = [
    ("cy", "Cyprus", (32.00, 34.40, 34.80, 35.80), 0.00005),   # ~5 m
    ("gr", "Greece", (19.20, 34.70, 29.80, 41.90), 0.00020),   # ~20 m
]
DECIMALS = 5  # ~1 m


def encode_rle(mask):
    """mask: flat uint8 array, 1 = land. Runs alternate sea, land, sea... starting with sea.
    Each run length is a little-endian base-128 varint (high bit = more bytes). Base64."""
    flat = np.asarray(mask, dtype=np.uint8).ravel()
    n = flat.size
    change = np.flatnonzero(np.diff(flat)) + 1
    edges = np.concatenate(([0], change, [n]))
    runs = np.diff(edges).tolist()
    if flat[0] == 1:  # first run must be sea
        runs.insert(0, 0)
    out = bytearray()
    for v in runs:
        while True:
            b = v & 127
            v >>= 7
            if v:
                out.append(b | 128)
            else:
                out.append(b)
                break
    return base64.b64encode(bytes(out)).decode("ascii")


def rings_of(geom):
    polys = [geom] if geom.geom_type == "Polygon" else [g for g in getattr(geom, "geoms", []) if g.geom_type == "Polygon"]
    for p in polys:
        yield p


def build_grid(shp_path, out_dir):
    g = GRID
    step = g["step"]
    w = int(round((g["lon1"] - g["lon0"]) / step))
    h = int(round((g["lat1"] - g["lat0"]) / step))
    mask = np.zeros((h, w), dtype=np.uint8)

    def px(lon, lat):
        return ((lon - g["lon0"]) / step - 0.5, (g["lat1"] - lat) / step - 0.5)

    sf = shapefile.Reader(shp_path)
    n = 0
    for shp in sf.iterShapes(bbox=[g["lon0"], g["lat0"], g["lon1"], g["lat1"]]):
        geom = shape(shp.__geo_interface__)
        for p in rings_of(geom):
            minx, miny, maxx, maxy = p.bounds
            c0 = max(0, int(np.floor((minx - g["lon0"]) / step)) - 1)
            c1 = min(w, int(np.ceil((maxx - g["lon0"]) / step)) + 1)
            r0 = max(0, int(np.floor((g["lat1"] - maxy) / step)) - 1)
            r1 = min(h, int(np.ceil((g["lat1"] - miny) / step)) + 1)
            if c1 <= c0 or r1 <= r0:
                continue
            # rasterize this polygon (exterior minus its own holes) in its own window, then OR it in
            img = Image.new("L", (c1 - c0, r1 - r0), 0)
            d = ImageDraw.Draw(img)
            ext = [(x - c0, y - r0) for x, y in (px(lo, la) for lo, la in p.exterior.coords)]
            d.polygon(ext, fill=1, outline=1)
            for ring in p.interiors:
                hole = [(x - c0, y - r0) for x, y in (px(lo, la) for lo, la in ring.coords)]
                d.polygon(hole, fill=0, outline=0)
            mask[r0:r1, c0:c1] |= np.asarray(img, dtype=np.uint8)
            n += 1

    rle = encode_rle(mask)
    stamp = datetime.date.today().isoformat()
    js = (
        "/* Raster ξηράς/θάλασσας (Κύπρος, Ελλάδα, Αιγαίο, Ιόνιο, Τουρκία, Λεβάντε) για το exposure.js.\n"
        "   Πηγή: OpenStreetMap land polygons (osmdata.openstreetmap.de), (c) OpenStreetMap contributors, ODbL 1.0.\n"
        f"   Κελί {step}° (~250 m), run-length. Φτιάχνεται αυτόματα από το coastline-sync.yml ({stamp}). */\n"
        f"window.ALKYON_COASTGRID={{src:'osm',built:'{stamp}',lon0:{g['lon0']:g},lat1:{g['lat1']:g},step:{step:g},w:{w},h:{h},rle:'{rle}'}};\n"
    )
    with open(f"{out_dir}/coastgrid.js", "w") as f:
        f.write(js)
    print(f"coastgrid.js: {w}x{h} cells, {n} polygons, land {mask.mean():.3f}, {len(js)/1024:.0f} KB")
    return mask


# ---------- pre-computed tiles for the sea-state map layer (seastate.js) ----------
# 1x1 degree tiles (Cyprus + Greece / Aegean / Ionian). Per sea cell of 0.01 deg (~1 km) within BAND_KM of land:
#   f: effective fetch for 16 wind directions (same method as exposure.js: SPM/CERC, radials every 6 deg within
#      +-42 deg, cos weighting, 200 km cap, 0.25 km ray step, on the OSM raster above)
#   d: distance to the nearest land (0.05 km units, 255 = 12.75+ km)
#   z: depth from EMODnet Bathymetry (m, 255 = unknown or deeper than 254 m) - only if the WCS download works
#   land: OSM land polygons clipped to the tile, simplified, as delta-encoded 1e-5 deg integers
TILE_AREAS = [(34, 36, 32, 35), (34, 42, 19, 30)]  # (lat0, lat1, lon0, lon1): Cyprus, Greece
TSTEP, BAND_KM = 0.01, 10.0
MAXKM, RAD_STEP, HALF, STEP_KM = 200.0, 6, 42, 0.25
RE = 6371.0088
EMOD_WCS = "https://ows.emodnet-bathymetry.eu/wcs"


def quant(km):
    """byte: 0..200 -> 0..50 km in 0.25 km; 201..250 -> 53..200 km in 3 km."""
    km = np.clip(km, 0, MAXKM)
    return np.where(km <= 50, np.round(km / 0.25), 200 + np.round((km - 50) / 3)).astype(np.uint8)


def b64(a):
    return base64.b64encode(np.asarray(a, dtype=np.uint8).tobytes()).decode("ascii")


def emodnet_depth(lat0, lon0, size=1.0, res=0.0025):
    """Depth grid (m, positive down, NaN on land/unknown) for one tile, or None."""
    import io
    import urllib.request
    import tifffile
    pad = res * 2
    w, s, e, n = lon0 - pad, lat0 - pad, lon0 + size + pad, lat0 + size + pad
    url = (f"{EMOD_WCS}?service=wcs&version=1.0.0&request=getcoverage&coverage=emodnet:mean&crs=EPSG:4326"
           f"&bbox={w:.4f},{s:.4f},{e:.4f},{n:.4f}&format=image/tiff&interpolation=nearest&resx={res}&resy={res}")
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=90) as r:
                data = r.read()
            arr = tifffile.imread(io.BytesIO(data)).astype(np.float64)
            if arr.ndim > 2:
                arr = arr[..., 0]
            return dict(arr=arr, w=w, s=s, e=e, n=n)
        except Exception as ex:  # noqa: BLE001
            print(f"  EMODnet {lat0},{lon0} attempt {attempt + 1}: {ex}")
    return None


def build_tiles(mask, shp_path, out_dir):
    from scipy.ndimage import distance_transform_edt
    import os

    g = GRID
    gs = g["step"]
    H, W = mask.shape
    lat_mid = (g["lat0"] + g["lat1"]) / 2
    dist = distance_transform_edt(mask == 0, sampling=(gs * 111.2, gs * 111.2 * np.cos(np.radians(lat_mid))))

    def raster_idx(lat, lon):
        c = np.floor((lon - g["lon0"]) / gs).astype(np.int64)
        r = np.floor((g["lat1"] - lat) / gs).astype(np.int64)
        return r, c

    def is_land(lat, lon):
        r, c = raster_idx(lat, lon)
        out = (c < 0) | (r < 0) | (c >= W) | (r >= H)
        v = np.full(lat.shape, -1, dtype=np.int8)
        ok = ~out
        v[ok] = mask[r[ok], c[ok]]
        return v

    # all candidate cells, grouped by tile
    tiles = {}
    for la0, la1, lo0, lo1 in TILE_AREAS:
        for tl in range(la0, la1):
            for tn in range(lo0, lo1):
                tiles[(tl, tn)] = None
    cells_lat, cells_lon, cells_tile = [], [], []
    tile_keep = {}
    n_side = int(round(1 / TSTEP))
    for (tl, tn) in sorted(tiles):
        rr, cc = np.mgrid[0:n_side, 0:n_side]
        clat = (tl + 1) - (rr + 0.5) * TSTEP
        clon = tn + (cc + 0.5) * TSTEP
        land = is_land(clat, clon)
        r, c = raster_idx(clat, clon)
        inside = (r >= 0) & (c >= 0) & (r < H) & (c < W)
        d = np.full(clat.shape, 1e9)
        d[inside] = dist[r[inside], c[inside]]
        keep = (land == 0) & (d <= BAND_KM)
        if keep.sum() == 0:
            continue
        tile_keep[(tl, tn)] = (keep, d[keep])
        cells_lat.append(clat[keep]); cells_lon.append(clon[keep]); cells_tile.append(np.full(keep.sum(), len(tile_keep) - 1))
    order = list(tile_keep.keys())
    plat = np.concatenate(cells_lat).astype(np.float64)
    plon = np.concatenate(cells_lon).astype(np.float64)
    ptile = np.concatenate(cells_tile)
    n = plat.size
    print(f"tiles: {len(order)}, cells: {n}")

    la1 = np.radians(plat); lo1 = np.radians(plon)
    sin_la, cos_la = np.sin(la1), np.cos(la1)

    def ray(brg):
        b = np.radians(brg)
        res = np.full(n, MAXKM, dtype=np.float32)
        act = np.arange(n)
        cb, sb = np.cos(b), np.sin(b)
        for k in range(1, int(round(MAXKM / STEP_KM)) + 1):
            if act.size == 0:
                break
            dd = k * STEP_KM / RE
            cd, sd = np.cos(dd), np.sin(dd)
            sla, cla = sin_la[act], cos_la[act]
            la2 = np.arcsin(sla * cd + cla * sd * cb)
            lo2 = lo1[act] + np.arctan2(sb * sd * cla, cd - sla * np.sin(la2))
            v = is_land(np.degrees(la2), np.degrees(lo2))
            hit = v == 1
            res[act[hit]] = (k - 1) * STEP_KM
            act = act[~(hit | (v == -1))]  # -1: left the raster -> keep MAXKM (as exposure.js)
        return res

    radials = list(range(-HALF // RAD_STEP, HALF // RAD_STEP + 1))
    wts = np.array([np.cos(np.radians(k * RAD_STEP)) for k in radials])
    # each needed bearing once (16 directions x 15 radials, many shared)
    need = sorted({round((i * 22.5 + k * RAD_STEP) % 360, 3) for i in range(16) for k in radials})
    rays = {}
    for j, brg in enumerate(need):
        rays[brg] = ray(brg)
        if j % 20 == 0:
            print(f"  rays {j + 1}/{len(need)}", flush=True)
    F = np.zeros((n, 16))
    for i in range(16):
        acc = np.zeros(n)
        for wk, k in zip(wts, radials):
            acc += wk * rays[round((i * 22.5 + k * RAD_STEP) % 360, 3)]
        F[:, i] = acc / wts.sum()

    sf = shapefile.Reader(shp_path)
    stamp = datetime.date.today().isoformat()
    names = []
    for ti, (tl, tn) in enumerate(order):
        keep, dk = tile_keep[(tl, tn)]
        sel = ptile == ti
        name = f"cx_N{tl:02d}E{tn:03d}"
        tile = {"v": 1, "lat1": tl + 1, "lon0": tn, "step": TSTEP, "w": n_side, "h": n_side, "n": int(keep.sum()),
                "cells": encode_rle(keep.astype(np.uint8)), "f": b64(quant(F[sel]).ravel()),
                "d": b64(np.clip(np.round(dk / 0.05), 0, 255)), "built": stamp,
                "src": "OpenStreetMap land polygons (c) OpenStreetMap contributors, ODbL 1.0"}
        # depth (EMODnet), median of the sea sub-pixels in each cell
        dg = emodnet_depth(tl, tn)
        if dg is not None:
            arr = dg["arr"]; ah, aw = arr.shape
            rr2, cc2 = np.nonzero(keep)
            zs = np.full(rr2.size, 255, dtype=np.uint8)
            vals = []
            for q in range(rr2.size):
                la_n = (tl + 1) - rr2[q] * TSTEP; lo_w = tn + cc2[q] * TSTEP
                y0 = int((dg["n"] - la_n) / (dg["n"] - dg["s"]) * ah); y1 = int((dg["n"] - (la_n - TSTEP)) / (dg["n"] - dg["s"]) * ah)
                x0 = int((lo_w - dg["w"]) / (dg["e"] - dg["w"]) * aw); x1 = int((lo_w + TSTEP - dg["w"]) / (dg["e"] - dg["w"]) * aw)
                blk = arr[max(0, y0):max(y0 + 1, y1), max(0, x0):max(x0 + 1, x1)]
                blk = blk[np.isfinite(blk) & (np.abs(blk) < 12000) & (blk != 0)]
                vals.append(np.median(blk) if blk.size else np.nan)
            vals = np.array(vals)
            fin = vals[np.isfinite(vals)]
            if fin.size:
                sign = -1.0 if np.median(fin) < 0 else 1.0  # WCS may give elevation (sea negative) or depth
                dep = sign * vals
                ok = np.isfinite(dep) & (dep > 0)
                zs[ok] = np.clip(np.round(dep[ok]), 1, 254).astype(np.uint8)
                tile["z"] = b64(zs)
        # land polygons for a precise coastline clip
        pad = 0.02
        clip = box(tn - pad, tl - pad, tn + 1 + pad, tl + 1 + pad)
        parts = []
        for shp in sf.iterShapes(bbox=[tn - pad, tl - pad, tn + 1 + pad, tl + 1 + pad]):
            gg = shape(shp.__geo_interface__)
            if not gg.is_valid:
                gg = gg.buffer(0)
            gg = gg.intersection(clip)
            if not gg.is_empty:
                parts.append(gg)
        rings = []
        if parts:
            tol = 0.00005 if tl in (34, 35) and tn in (32, 33, 34) else 0.0001
            landg = unary_union(parts).simplify(tol, preserve_topology=True)
            from shapely.geometry.polygon import orient
            for poly in rings_of(landg):
                if poly.area < 2e-8:
                    continue
                poly = orient(poly, 1.0)  # exterior CCW, holes CW -> 'nonzero' fill is right even where tiles overlap
                for ring in [poly.exterior] + list(poly.interiors):
                    xy = np.round(np.asarray(ring.coords) * 1e5).astype(np.int64)
                    flat = np.concatenate([xy[:1], np.diff(xy, axis=0)]).ravel().tolist()
                    rings.append(flat)
        tile["land"] = rings
        with open(os.path.join(out_dir, name + ".json"), "w") as fh:
            json.dump(tile, fh, separators=(",", ":"))
        names.append(name)
        print(f"  {name}: {tile['n']} cells, depth {'yes' if 'z' in tile else 'no'}, {len(rings)} rings")
    idx = {"v": 1, "built": stamp, "step": TSTEP, "band_km": BAND_KM, "tiles": names,
           "src": "OpenStreetMap (c) OpenStreetMap contributors, ODbL 1.0; depth EMODnet Bathymetry"}
    with open(os.path.join(out_dir, "cx_index.json"), "w") as fh:
        json.dump(idx, fh, separators=(",", ":"))
    print(f"cx_index.json: {len(names)} tiles")


def rnd(coords):
    if isinstance(coords, (list, tuple)) and coords and isinstance(coords[0], (int, float)):
        return [round(coords[0], DECIMALS), round(coords[1], DECIMALS)]
    return [rnd(c) for c in coords]


def build_polygons(shp_path, out_dir):
    sf = shapefile.Reader(shp_path)
    stamp = datetime.date.today().isoformat()
    for code, name, bb, tol in REGIONS:
        clip = box(*bb)
        parts = []
        for shp in sf.iterShapes(bbox=list(bb)):
            g = shape(shp.__geo_interface__)
            if not g.is_valid:
                g = g.buffer(0)
            g = g.intersection(clip)
            if not g.is_empty:
                parts.append(g)
        land = unary_union(parts).simplify(tol, preserve_topology=True)
        feats = []
        for p in rings_of(land):
            if p.area < 1e-9:  # drop rocks under ~10 m2 after simplify
                continue
            feats.append({"type": "Feature", "properties": {}, "geometry": {"type": "Polygon", "coordinates": rnd(mapping(p)["coordinates"])}})
        fc = {
            "type": "FeatureCollection",
            "name": f"coast_{code}",
            "metadata": {
                "region": name,
                "bbox": list(bb),
                "kind": "land polygons (sea = outside)",
                "source": "OpenStreetMap land polygons (osmdata.openstreetmap.de)",
                "attribution": "© OpenStreetMap contributors, ODbL 1.0",
                "simplify_deg": tol,
                "built": stamp,
            },
            "features": feats,
        }
        out = f"{out_dir}/coast_{code}.geojson"
        with open(out, "w") as f:
            json.dump(fc, f, separators=(",", ":"))
        print(f"{out}: {len(feats)} polygons")


if __name__ == "__main__":
    m = build_grid(sys.argv[1], sys.argv[2])
    build_tiles(m, sys.argv[1], sys.argv[2])
    build_polygons(sys.argv[1], sys.argv[2])
