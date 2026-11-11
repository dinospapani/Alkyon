"""Alkyon · βίντεο κόμπων → knots/ της εφαρμογής.
python3 tools/knots_assets.py <φάκελος knots_out του Blender>
Αντιγράφει τα knot_<id>.mp4, κάνει τα poster .png → .webp και ενώνει τα .json σε knots/index.json."""
import sys, os, json, shutil
from PIL import Image
src = sys.argv[1]; dst = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'knots')
os.makedirs(dst, exist_ok=True)
idx = {}
for f in sorted(os.listdir(src)):
    if f.startswith('knot_') and f.endswith('.json'):
        kid = f[5:-5]; d = json.load(open(os.path.join(src, f), encoding='utf-8'))
        idx[kid] = {k: d[k] for k in ('title_en', 'title_el', 'duration', 'steps')}
        shutil.copy(os.path.join(src, 'knot_%s.mp4' % kid), os.path.join(dst, 'knot_%s.mp4' % kid))
        Image.open(os.path.join(src, 'knot_%s_poster.png' % kid)).convert('RGB').save(os.path.join(dst, 'knot_%s_poster.webp' % kid), 'WEBP', quality=80)
json.dump(idx, open(os.path.join(dst, 'index.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(len(idx), 'knots →', os.path.normpath(dst))
