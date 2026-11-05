#!/usr/bin/env python3
"""Alkyon: κοινό πλέγμα ανέμου για τα νερά της Κύπρου (τρέχει στο GitHub Actions κάθε 3 ώρες).
Ένα αίτημα στο Open-Meteo για όλους τους χρήστες, αντί για ένα αίτημα ανά κινητό. Το αρχείο
γράφεται στο κλαδί wind-data και το app το διαβάζει από raw.githubusercontent.com.
Χρήση: python3 wind_build.py out/cy-wind.json"""
import json, sys, time, urllib.request, datetime

S, NN, W, E = 33.0, 36.4, 31.0, 35.8   # νότια, βόρεια, δυτικά, ανατολικά (μοίρες)
N = 17                                  # 17 x 17 = 289 σημεία (~25 km)
MODELS = ['ecmwf_ifs', 'icon_eu']
HOURS = 120

lat = [round(S + (NN - S) * k / (N - 1), 4) for k in range(N)]
lon = [round(W + (E - W) * k / (N - 1), 4) for k in range(N)]
la, lo = [], []
for j in range(N):
    for i in range(N):
        la.append('%.3f' % lat[j]); lo.append('%.3f' % lon[i])
url = ('https://api.open-meteo.com/v1/forecast?latitude=' + ','.join(la) + '&longitude=' + ','.join(lo) +
       '&hourly=wind_speed_10m,wind_direction_10m&wind_speed_unit=kn&past_hours=1&forecast_hours=%d&timezone=UTC&models=%s' % (HOURS, ','.join(MODELS)))

data = None
for attempt in range(4):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'alkyon-wind-sync'})
        with urllib.request.urlopen(req, timeout=90) as r:
            data = json.load(r)
        break
    except Exception as e:
        print('attempt', attempt + 1, 'failed:', e, file=sys.stderr)
        time.sleep(30 * (attempt + 1))
if data is None:
    sys.exit('no data')
arr = data if isinstance(data, list) else [data]
if len(arr) != N * N or 'hourly' not in arr[0]:
    sys.exit('bad answer: %d points' % len(arr))

def r1(x):
    return None if x is None else round(x, 1)
def r0(x):
    return None if x is None else int(round(x))

out_pts = []
for k, p in enumerate(arr):
    h = p['hourly']; o = {}
    if k == 0:
        o['time'] = h['time']
    for m in MODELS:
        sp, dr = h.get('wind_speed_10m_' + m), h.get('wind_direction_10m_' + m)
        if sp and dr:
            o['wind_speed_10m_' + m] = [r1(x) for x in sp]
            o['wind_direction_10m_' + m] = [r0(x) for x in dr]
    out_pts.append({'hourly': o})

doc = {'v': 1, 'box': [S, NN, W, E], 'N': N, 'lat': lat, 'lon': lon, 'models': MODELS,
       'fetched_at': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'data': out_pts}
with open(sys.argv[1] if len(sys.argv) > 1 else 'cy-wind.json', 'w') as f:
    json.dump(doc, f, separators=(',', ':'))
print('ok', len(out_pts), 'points', len(arr[0]['hourly']['time']), 'hours')
