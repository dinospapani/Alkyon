import numpy as np, tifffile, matplotlib
matplotlib.use('Agg'); import matplotlib.pyplot as plt
from matplotlib.colors import LightSource
z = tifffile.imread('g.tif').astype(float)
z[(z < -30000) | (z > 1e30)] = np.nan
d = -z
land = ~(d > 0)
dd = np.where(land, np.nan, d)
ext = [32.30, 32.47, 34.70, 34.84]
X = np.linspace(ext[0], ext[1], d.shape[1]); Y = np.linspace(ext[3], ext[2], d.shape[0])

def base(ax, title):
    ax.set_facecolor('#d9cfb4'); ax.set_xticks([]); ax.set_yticks([])
    ax.set_title(title, fontsize=13, fontweight='bold', loc='left')
    ax.plot(32.4062, 34.7548, 'o', ms=5, color='#E4572E'); ax.text(32.409, 34.755, 'Paphos', fontsize=8)

# relief
fig, ax = plt.subplots(figsize=(5.4, 7), dpi=200)
base(ax, '2) Relief shading')
ls = LightSource(azdeg=315, altdeg=35)
hs = ls.hillshade(np.nan_to_num(-dd, nan=0), vert_exag=0.08, dx=95, dy=115)
rgb = plt.get_cmap('Blues')(np.clip(np.sqrt(np.nan_to_num(dd) / 600), 0, 1) * 0.8 + 0.2)[..., :3]
sh = rgb * (0.45 + 0.55 * hs[..., None])
ax.imshow(np.dstack([sh, np.where(land, 0, 1)]), extent=ext, origin='upper')
cs = ax.contour(X, Y, dd, levels=[10, 20, 50, 100, 200, 500], colors='white', linewidths=.5, alpha=.7)
ax.clabel(cs, fmt='%d m', fontsize=6)
fig.tight_layout(); fig.savefig('relief.png'); plt.close(fig)

# depth band
fig, ax = plt.subplots(figsize=(5.4, 7), dpi=200)
base(ax, '1) Depth band: dusky grouper 20-60 m')
sea = np.where(land, 0, 1)
ax.imshow(np.dstack([np.full(d.shape, .80), np.full(d.shape, .86), np.full(d.shape, .90), sea]), extent=ext, origin='upper')
band = (dd >= 20) & (dd <= 60)
ov = np.zeros(d.shape + (4,)); ov[band] = [0.89, 0.34, 0.18, 0.75]
ax.imshow(ov, extent=ext, origin='upper')
cs = ax.contour(X, Y, dd, levels=[20, 60], colors='#8a2a10', linewidths=.7)
ax.clabel(cs, fmt='%d m', fontsize=6)
fig.tight_layout(); fig.savefig('band.png'); plt.close(fig)
print(d.shape, np.nanmax(dd))
