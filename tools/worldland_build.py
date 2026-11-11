#!/usr/bin/env python3
"""Alkyon 1.12.7 · world land mask for the map layers (waves, currents, chlorophyll, water temperature) outside the
detailed coast (exposure.js) and the Mediterranean mask (medland.js).

Source: global-land-mask (MIT), from NOAA GLOBE 1 km (public domain). pip install global-land-mask
Output: v4/worldland.bin, 1/30 deg (~3.7 km), majority land per cell (globe._mask is True on water).
Format: 'AKWL' + uint16 R (cells per degree) + per row (north to south, lon -180..180): varint first value (0 sea/1 land),
then varint run lengths that alternate, summing to 360*R."""
import sys
import numpy as np
from global_land_mask import globe

R = 30
m = globe._mask
f = m.shape[1] // (360 * R)
H, W = 180 * R, 360 * R
mm = m[:H * f, :W * f].reshape(H, f, W, f).mean(axis=(1, 3)) < 0.5  # _mask is True on water
out = bytearray(b'AKWL') + R.to_bytes(2, 'little')
def vi(x):
    x = int(x)
    while x >= 128:
        out.append((x & 127) | 128); x >>= 7
    out.append(x)
for row in mm:
    v = row.astype(np.int8)
    idx = np.flatnonzero(np.diff(v)) + 1
    runs = np.diff(np.concatenate([[0], idx, [W]]))
    vi(int(v[0]))
    for r in runs: vi(r)
open(sys.argv[1] if len(sys.argv) > 1 else 'v4/worldland.bin', 'wb').write(bytes(out))
print(len(out), 'bytes')
