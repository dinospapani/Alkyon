"""Alkyon · αρχεία κόμπων → knots/ της εφαρμογής.
python3 tools/knots_assets.py <φάκελος με τα αρχεία του animator ή του Blender>
Για κάθε knot_<id>.json (λίστα βημάτων) παίρνει όποιο από τα παρακάτω υπάρχει:
  knot_<id>.riv          → "fmt":"riv"     (Rive, βήματα με "anim": step1, step2…)
  knot_<id>.lottie.json  → "fmt":"lottie"  (Lottie, ένας marker ανά βήμα με το όνομα του "anim")
  knot_<id>.mp4          → "fmt":"mp4"     (βίντεο, βήματα με start/end σε δευτερόλεπτα)
Κάνει το poster .png → .webp και ενώνει τα βήματα σε knots/index.json.
Βήμα χωρίς ελληνικό κείμενο ("el") παίρνει προσωρινά το αγγλικό, και το script το λέει."""
import sys, os, json, shutil
from PIL import Image
src = sys.argv[1]; dst = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'knots')
os.makedirs(dst, exist_ok=True)
FMTS = (('riv', '.riv'), ('lottie', '.lottie.json'), ('mp4', '.mp4'))
idx = {}
for f in sorted(os.listdir(src)):
    if not (f.startswith('knot_') and f.endswith('.json')) or f.endswith('.lottie.json'):
        continue
    kid = f[5:-5]; d = json.load(open(os.path.join(src, f), encoding='utf-8'))
    fmt = next((k for k, ext in FMTS if os.path.exists(os.path.join(src, 'knot_' + kid + ext))), None)
    if not fmt:
        print('!', kid, ': λείπει το .riv / .lottie.json / .mp4'); continue
    ext = dict(FMTS)[fmt]
    steps = d['steps']
    for j, s in enumerate(steps):
        if not s.get('el'):
            s['el'] = s.get('en', ''); print('!', kid, 'βήμα', j + 1, ': χωρίς ελληνικό κείμενο')
        if fmt != 'mp4':
            s.setdefault('anim', 'step%d' % (j + 1))
    idx[kid] = {'fmt': fmt, 'title_en': d.get('title_en', ''), 'title_el': d.get('title_el', ''), 'steps': steps}
    if 'duration' in d: idx[kid]['duration'] = d['duration']
    shutil.copy(os.path.join(src, 'knot_' + kid + ext), os.path.join(dst, 'knot_' + kid + ext))
    poster = os.path.join(src, 'knot_%s_poster.png' % kid)
    if os.path.exists(poster):
        Image.open(poster).convert('RGB').save(os.path.join(dst, 'knot_%s_poster.webp' % kid), 'WEBP', quality=80)
    else:
        print('!', kid, ': λείπει το poster')
json.dump(idx, open(os.path.join(dst, 'index.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(len(idx), 'knots →', os.path.normpath(dst))
