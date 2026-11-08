#!/usr/bin/env python3
"""Alkyon: φτιάχνει το index.ts της Supabase Edge Function «quick-processor»
από τα forecast.js + safety-job.mjs του repo, ώστε η συνάρτηση να τρέχει ακριβώς τον ίδιο κώδικα με την εφαρμογή.
Χρήση: python3 build_edge.py  -> γράφει quick-processor-index.ts
Μετά: Supabase → Edge Functions → quick-processor → Code → αντικατάσταση όλου του index.ts → Deploy."""
import re

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
open("quick-processor-index.ts", "w", encoding="utf-8").write(out)
print("quick-processor-index.ts:", len(out), "bytes")
