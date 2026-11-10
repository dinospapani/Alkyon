#!/usr/bin/env python3
"""1.10.6: πίνακας μετάφρασης ειδοποιήσεων (ελληνικά ↔ αγγλικά) από τα ίδια τα κείμενα του server.
Διαβάζει κάθε t('ελληνικά','English') (και en?'..':'..', en?[..]:[..]) στα forecast.js, quick-processor-index.ts, safety-job.mjs
και γράφει τα σταθερά κομμάτια τους σε v4/notif-i18n.js. Έτσι μια ειδοποίηση που ήρθε στην άλλη γλώσσα (π.χ. πριν αλλάξεις γλώσσα)
δείχνεται ολόκληρη στη γλώσσα της εφαρμογής, όχι μισή. Τρέξε ξανά όταν αλλάζουν τα κείμενα: python3 tools/notif_i18n.py"""
import re, json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GR = re.compile('[α-ωάέήίόύώϊϋΐΰΑ-ΩΆΈΉΊΌΎΏ]')

def lit_parts(src, i):
    """διαβάζει ένα όρισμα (μέχρι , ή ) στο ίδιο επίπεδο) και επιστρέφει (κομμάτια κειμένου, θέση)"""
    parts, depth, cur = [], 0, None
    while i < len(src):
        c = src[i]
        if c in "'\"`":
            q = c; j = i + 1; buf = ''
            while j < len(src) and src[j] != q:
                if src[j] == '\\' and j + 1 < len(src): buf += src[j + 1]; j += 2; continue
                buf += src[j]; j += 1
            if depth == 0: parts.append(buf)
            i = j + 1; continue
        if c in '([{': depth += 1
        elif c in ')]}':
            if depth == 0: return parts, i
            depth -= 1
        elif c == ',' and depth == 0: return parts, i
        elif depth == 0 and c not in ' +\n\t': parts.append(None)   # μεταβλητή ανάμεσα
        i += 1
    return parts, i

def segs(parts):
    out, buf = [], ''
    for p in parts:
        if p is None:
            if buf: out.append(buf); buf = ''
            out.append(None)
        else: buf += p
    if buf: out.append(buf)
    # συμπίεση διαδοχικών None
    r = []
    for x in out:
        if x is None and r and r[-1] is None: continue
        r.append(x)
    return r

pairs = {}
def add(a, b):
    a2, b2 = a.strip(), b.strip()
    if not a2 or not b2 or a2 == b2 or not GR.search(a2) or GR.search(b2): return
    if len(re.sub(r'[\W\d_]', '', a2)) < 2: return
    pairs.setdefault(a, b)

for f in ['forecast.js', 'quick-processor-index.ts', 'safety-job.mjs']:
    s = open(os.path.join(ROOT, f), encoding='utf8').read()
    for m in re.finditer(r'(?<![\w.])(?:t|tx)\(', s):
        i = m.end()
        a, i = lit_parts(s, i)
        if i >= len(s) or s[i] != ',': continue
        b, j = lit_parts(s, i + 1)
        if j >= len(s) or s[j] != ')': continue
        A, B = segs(a), segs(b)
        if len(A) != len(B) or [x is None for x in A] != [x is None for x in B]: continue
        for x, y in zip(A, B):
            if x is not None: add(x, y)
    for m in re.finditer(r"\ben\s*\?\s*'((?:[^'\\]|\\.)*)'\s*:\s*'((?:[^'\\]|\\.)*)'", s): add(m.group(2), m.group(1))
    for m in re.finditer(r"\ben\s*\?\s*\[([^\]]*)\]\s*:\s*\[([^\]]*)\]", s):
        E = re.findall(r"'((?:[^'\\]|\\.)*)'", m.group(1)); G = re.findall(r"'((?:[^'\\]|\\.)*)'", m.group(2))
        if len(E) == len(G): [add(g, e) for g, e in zip(G, E)]
# τοποθεσίες χωρίς όνομα και λίγα σταθερά (ημέρες, μήνες)
# και με κεφαλαίο πρώτο γράμμα (ο server ξεκινά τις προτάσεις με κεφαλαίο)
for a, b in list(pairs.items()):
    if a[:1].islower() and b[:1].islower(): pairs.setdefault(a[0].upper() + a[1:], b[0].upper() + b[1:])
extra = {'Η θέση μου': 'My location', 'Σημείο χάρτη': 'Map point', 'Έξοδος τώρα': 'Trip now'}
for k, v in extra.items(): pairs.setdefault(k, v)
days = [['Κυρ', 'Sun'], ['Δευ', 'Mon'], ['Τρί', 'Tue'], ['Τετ', 'Wed'], ['Πέμ', 'Thu'], ['Παρ', 'Fri'], ['Σάβ', 'Sat']]
items = sorted(pairs.items(), key=lambda kv: -len(kv[0]))
js = ('/* 1.10.6: φτιάχνεται από tools/notif_i18n.py — μην το αλλάζεις με το χέρι.\n'
      '   Μεταφράζει ειδοποιήσεις που ήρθαν στην άλλη γλώσσα (π.χ. πριν αλλάξεις γλώσσα στο Προφίλ). */\n'
      '(function(g){ var P=' + json.dumps(items, ensure_ascii=False) + ', D=' + json.dumps(days, ensure_ascii=False) + ';\n'
      ' var GR=/[\\u0370-\\u03ff\\u1f00-\\u1fff]/, L="[A-Za-z\\u0370-\\u03ff\\u1f00-\\u1fff]";\n'
      ' function esc(s){ return s.replace(/[.*+?^${}()|[\\]\\\\]/g,"\\\\$&"); }\n'
      ' function rep(t,a,b){ var x=a.trim(); if(!x) return t; var re=new RegExp((/^\\S/.test(x)&&GR.test(x[0])||/^[A-Za-z]/.test(x)?"(^|[^A-Za-z\\u0370-\\u03ff\\u1f00-\\u1fff])":"()")+esc(x)+(/[A-Za-z\\u0370-\\u03ff\\u1f00-\\u1fff]$/.test(x)?"(?![A-Za-z\\u0370-\\u03ff\\u1f00-\\u1fff])":""),"g");\n'
      '   var y=b.trim(); return t.replace(re,function(m,p){ return p+y; }); }\n'
      ' function tr(t,to){ t=String(t||""); if(!t) return t;\n'
      '   if(to==="en"){ if(!GR.test(t)) return t; P.forEach(function(p){ t=rep(t,p[0],p[1]); }); D.forEach(function(d){ t=rep(t,d[0],d[1]); }); return t.replace(/(\\d),(\\d)/g,"$1.$2"); }\n'
      '   if(GR.test(t)||!/[A-Za-z]{3}/.test(t)) return t; P.forEach(function(p){ if(p[1].trim().length>3) t=rep(t,p[1],p[0]); }); D.forEach(function(d){ t=rep(t,d[1],d[0]); }); return t.replace(/(\\d)\\.(\\d)/g,"$1,$2"); }\n'
      ' g.AlkNotifTr=tr; })(typeof self!=="undefined"?self:globalThis);\n')
open(os.path.join(ROOT, 'v4', 'notif-i18n.js'), 'w', encoding='utf8').write(js)
print(len(items), 'phrases')
