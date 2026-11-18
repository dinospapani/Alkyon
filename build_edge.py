#!/usr/bin/env python3
"""Alkyon: φτιάχνει το index.ts της Supabase Edge Function «quick-processor»
από τα forecast.js + safety-job.mjs του repo, ώστε η συνάρτηση να τρέχει ακριβώς τον ίδιο κώδικα με την εφαρμογή.
Χρήση: python3 build_edge.py  -> γράφει quick-processor-index.ts και watch-edge-index.ts
       python3 build_edge.py --check  -> δεν γράφει· βγαίνει με 1 αν κάποιο από τα δύο δεν ταιριάζει με τις πηγές (CI, P0.9)
Μετά: Supabase → Edge Functions → quick-processor / watch → Code → αντικατάσταση όλου του index.ts → Deploy.
1.14.83 (P0.5): και το watch-edge-index.ts = forecast.js + ελληνικά ονόματα ειδών (v4/data-el.js) + watch-index.ts σε ένα αρχείο,
ώστε η function «watch» να μην κατεβάζει κώδικα από το GitHub την ώρα που τρέχει."""
import re, sys, json

fc = open("forecast.js", encoding="utf-8").read()
sj = open("safety-job.mjs", encoding="utf-8").read()

# safety-job: χωρίς τα κομμάτια του Node (import και εκτέλεση από τη γραμμή εντολών)
sj = re.sub(r"^import \{ pathToFileURL \} from 'node:url';\n", "", sj, flags=re.M)
cut = sj.find("if (import.meta.url === pathToFileURL(")
if cut < 0:
    raise SystemExit("safety-job.mjs: δεν βρέθηκε το τμήμα CLI")
sj = sj[:cut].rstrip() + "\n"

HANDLER = open("edge-handler.ts", encoding="utf-8").read().split("\n", 1)[1]

out = (
    "// @ts-nocheck\n"
    "// Alkyon cron: forecast push, ασφάλεια εξόδων (Telegram), πτώση πίεσης. Παράγεται από build_edge.py. Μην το επεξεργάζεσαι στο χέρι.\n"
    "import webpush from 'npm:web-push@3.6.7';\n\n"
    "globalThis.self = globalThis.self || globalThis;\n"
    "// ---- forecast.js ----\n" + fc.rstrip() + "\n\nconst PF = self.PF;\n\n"
    "// ---- safety-job.mjs ----\n" + sj + "\n// ---- handler ----\n" + HANDLER
)

# ---- watch ----
wi = open("watch-index.ts", encoding="utf-8").read()
el = open("v4/data-el.js", encoding="utf-8").read()
m = re.search(r"var M=(\{[\s\S]*?\}), G=", el)
if not m:
    raise SystemExit("v4/data-el.js: δεν βρέθηκε ο πίνακας M")
M = json.loads(m.group(1))
wout = (
    "// @ts-nocheck\n"
    "// Alkyon «watch» Edge Function. Παράγεται από build_edge.py (forecast.js + v4/data-el.js + watch-index.ts). Μην το επεξεργάζεσαι στο χέρι.\n"
    "globalThis.self = globalThis.self || globalThis;\n"
    "// ---- forecast.js ----\n" + fc.rstrip() + "\n\nglobalThis.__ALKYON_PF = self.PF;\n"
    "globalThis.__ALKYON_EL = " + json.dumps(M, ensure_ascii=False, sort_keys=True) + ";\n"
    "// ---- watch-index.ts ----\n" + re.sub(r"^// @ts-nocheck\n", "", wi)
)

outs = {"quick-processor-index.ts": out, "watch-edge-index.ts": wout}
if "--check" in sys.argv:
    import os
    bad = [f for f, t in outs.items() if not os.path.exists(f) or open(f, encoding="utf-8").read() != t]
    if bad:
        print("ΔΕΝ ταιριάζουν με τις πηγές (τρέξε python3 build_edge.py):", ", ".join(bad)); sys.exit(1)
    print("OK: τα αρχεία των Edge Functions ταιριάζουν με forecast.js / safety-job.mjs / watch-index.ts"); sys.exit(0)
for f, t in outs.items():
    open(f, "w", encoding="utf-8").write(t)
    print(f + ":", len(t), "bytes")
