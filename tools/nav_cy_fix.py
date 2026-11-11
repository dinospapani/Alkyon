#!/usr/bin/env python3
"""Alkyon 1.12.8 · διορθώσεις για την Κύπρο στο navigator-mpa.json, με βάση τον χάρτη Cy-FIS του Τμήματος Αλιείας (zones.js).
- Ναυάγιο Ζηνοβία (AICYP35): στο Navigator είχε τα όρια της Αφαλάτωσης Λάρνακας· παίρνει τον κύκλο του Cy-FIS.
- Κάβο Γκρέκο πυρήνας/ουδέτερη ζώνη: τα ελληνικά ονόματα ήταν χαλασμένα (κωδικοποίηση).
- Μονάδες υδατοκαλλιέργειας: το Cy-FIS λέει «Απαγορεύεται η αλιεία με οποιονδήποτε τρόπο - ΚΔΠ 533/2002» (το Navigator: περιορισμοί).
Τρέχει και μετά από κάθε ενημέρωση του Navigator (navigator-sync.yml). Χρήση: python3 tools/nav_cy_fix.py"""
import json, os, subprocess
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = os.path.join(ROOT, 'navigator-mpa.json')
Z = json.loads(subprocess.run(['node', '-e', "global.window={};require(process.argv[1]);console.log(JSON.stringify(window.ZONES))", os.path.join(ROOT, 'zones.js')], capture_output=True, text=True, check=True).stdout)
zen = next(z for z in Z if 'ZENOBIA' in z['n'])
j = json.load(open(P))
n = 0
for f in j['f']:
    if f.get('i') == 'AICYP35':
        f['g'] = [zen['p']]
        la = [p[0] for r in zen['p'] for p in r]; lo = [p[1] for r in zen['p'] for p in r]
        f['b'] = [min(la), min(lo), max(la), max(lo)]; n += 1
    elif f.get('i') == 'AICYP15a':
        f['n'] = 'Κάβο Γκρέκο - Πυρήνας (Kavo Gkreko - Core Zone)'; n += 1
    elif f.get('i') == 'AICYP15b':
        f['n'] = 'Κάβο Γκρέκο - Ουδέτερη Ζώνη (Kavo Gkreko - Neutral Zone)'; n += 1
    elif f.get('c') == 'Cyprus' and str(f.get('d', '')).startswith('Aquaculture'):
        for k in ('rf', 'hl', 'tr', 'sp'):
            f[k] = 1
        f['re'] = 'Απαγορεύεται η αλιεία με οποιονδήποτε τρόπο - ΚΔΠ 533/2002 (Cy-FIS, Τμήμα Αλιείας). Fishing of any kind is prohibited.'
        n += 1
json.dump(j, open(P, 'w'), ensure_ascii=False, separators=(',', ':'))
print('fixed', n)
