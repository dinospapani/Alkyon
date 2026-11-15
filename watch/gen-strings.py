#!/usr/bin/env python3
"""Alkyon: κείμενα των ρολογιών Apple Watch και Wear OS από τα κείμενα της εφαρμογής Garmin (strings-garmin.json),
με τις αλλαγές που χρειάζονται για ρολόγια με οθόνη αφής (OVR) και τα νέα κείμενα (EXTRA).
Βγάζει: android/wear/.../S.kt και watch/AlkyonWatch/Strings.swift. Τρέξε: python3 watch/gen-strings.py
Στα κείμενα: $1$, $2$ = τιμές, | = αλλαγή γραμμής."""
import json, os
R = os.path.dirname(os.path.abspath(__file__))
G = json.load(open(os.path.join(R, 'strings-garmin.json'), encoding='utf-8'))
OVR = {
 'NoCode': ('No link code|Alkyon on the phone|› Profile › Watch', 'Λείπει ο κωδικός|Alkyon στο κινητό|› Προφίλ › Ρολόι'),
 'SetCodeHelp': ('From the Alkyon app: Profile › Watch', 'Από την εφαρμογή Alkyon: Προφίλ › Ρολόι'),
 'WelL3': ('Alkyon (phone) > Profile > Watch', 'Alkyon (κινητό) > Προφίλ > Ρολόι'),
 'WelL4': ('the code comes to the watch by itself', 'ο κωδικός έρχεται μόνος του στο ρολόι'),
 'Hint': ('Tap = log a catch', 'Πάτημα = καταγραφή ψαριού'),
 'TouchedSub': ('or long-press −1', 'ή κράτα πατημένο το −1'),
 'DropHint': ('Menu › Letting out', 'Μενού › Ρίχνω'),
 'KeysL': ('Crown = leads', 'Κορώνα = μολύβια'),
 'KeysSub': ('up pull in · down let out', 'πάνω μάζεψα · κάτω άφησα'),
 'KeysLn': ('Crown = line out', 'Κορώνα = πετονιά'),
 'DropKeys': ('leads · ✓ = on the bottom', 'μολύβια · ✓ = στον βυθό'),
 'AutoDown': ('On the bottom?|✓ = yes · $1$ leads', 'Στον βυθό;|✓ = ναι · $1$ μολύβια'),
 'SquidOld': ('Update the|forecast (Menu › Refresh)', 'Ανανέωσε την|πρόγνωση (Μενού › Ανανέωση)'),
 'TripDown': ('swipe › Trip', 'σύρε › Έξοδος'),
 'TripGo': ('tap to start', 'πάτα για έναρξη'),
 'NavHint': ('Tap: target', 'Πάτημα: στόχος'),
 'StopHint': ('Tap: stop', 'Πάτημα: σταμάτα'),
 'HBack': ('undo', 'αναίρεση'), 'HUp': ('got away', 'χάθηκε'), 'HDown': ('species', 'είδος'),
}
EXTRA = {
 'Settings': ('Settings', 'Ρυθμίσεις'),
 'Refresh': ('Refresh forecast', 'Ανανέωση πρόγνωσης'),
 'Menu': ('Menu', 'Μενού'),
 'LinkT': ('Phone link', 'Σύνδεση με κινητό'),
 'Linked': ('Linked · $1$', 'Συνδεδεμένο · $1$'),
 'NotLinked': ('Not linked', 'Χωρίς σύνδεση'),
 'EnterCode': ('Type the code', 'Γράψε τον κωδικό'),
 'LinkAuto': ('Open Alkyon on the phone › Profile › Watch: the code is sent here automatically.', 'Άνοιξε το Alkyon στο κινητό › Προφίλ › Ρολόι: ο κωδικός έρχεται εδώ μόνος του.'),
 'Unlink': ('Remove code', 'Αφαίρεση κωδικού'),
 'LinkedMsg': ('Linked|logbook and spots on', 'Συνδέθηκε|ημερολόγιο και σημεία'),
 'PermLoc': ('Allow location|for GPS and the forecast', 'Επίτρεψε τη θέση|για GPS και πρόγνωση'),
 'PermNotif': ('Allow notifications|for pressure alerts', 'Επίτρεψε ειδοποιήσεις|για την πίεση'),
 'Allow': ('Allow', 'Επιτρέπω'),
 'Alerts': ('Alerts', 'Ειδοποιήσεις'),
 'Trolling': ('Trolling', 'Συρτή'),
 'Display': ('Display', 'Οθόνη'),
 'SpotSet': ('Forecast spot (no GPS)', 'Σημείο πρόγνωσης (χωρίς GPS)'),
 'UseHere': ('Use current position', 'Χρήση της θέσης τώρα'),
 'Version': ('Version $1$', 'Έκδοση $1$'),
 'Ok': ('OK', 'OK'),
 'Back': ('Back', 'Πίσω'),
 'Health': ('Save trips to Health', 'Αποθήκευση εξόδων στο Υγεία'),
 'RecTxt': ('Recorded on the watch', 'Καταγράφηκε στο ρολόι'),
 'ChMain': ('Alkyon alerts', 'Ειδοποιήσεις Alkyon'),
 'ChTrip': ('Trip in progress', 'Έξοδος σε εξέλιξη'),
 'TripOngoing': ('Trip · $1$ · $2$ fish', 'Έξοδος · $1$ · $2$ ψάρια'),
 'AnchorOn': ('Anchor alarm on', 'Συναγερμός άγκυρας'),
 'GearLive': ('Gear setting', 'Ρίψη εργαλείου'),
 'StopAlarm': ('Stop alarm', 'Σταμάτα τον συναγερμό'),
 'Pages': ('Pages', 'Σελίδες'),
 'NoBaro': ('no barometer on this watch', 'το ρολόι δεν έχει βαρόμετρο'),
 'Offline': ('offline · last $1$', 'χωρίς σύνδεση · από $1$'),
}
def conv(t):
    return t.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>').replace('&quot;', '"').replace("\\'", "'")
def table(lang):
    i = 0 if lang == 'en' else 1
    out = {k: conv(v) for k, v in G[lang].items()}
    for k, v in OVR.items(): out[k] = v[i]
    for k, v in EXTRA.items(): out[k] = v[i]
    return out
EN, EL = table('en'), table('el')
def kq(s): return '"' + s.replace('\\', '\\\\').replace('"', '\\"').replace('$', '\\$').replace('\n', '\\n') + '"'
def sq(s): return '"' + s.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n') + '"'
kt = ['// ΜΗΝ ΤΟ ΑΛΛΑΞΕΙΣ ΜΕ ΤΟ ΧΕΡΙ: το φτιάχνει το watch/gen-strings.py από τα κείμενα της εφαρμογής Garmin.',
      'package com.alkyonfishing.app.wear', '', 'object S {']
for nm, tb in (('EN', EN), ('EL', EL)):
    kt.append('    val %s: Map<String, String> = hashMapOf(' % nm)
    kt += ['        %s to %s,' % (kq(k), kq(v)) for k, v in sorted(tb.items())]
    kt.append('    )')
kt.append('}')
p = os.path.join(R, '..', 'android', 'wear', 'src', 'main', 'java', 'com', 'alkyonfishing', 'app', 'wear', 'S.kt')
open(p, 'w', encoding='utf-8').write('\n'.join(kt) + '\n')
sw = ['// ΜΗΝ ΤΟ ΑΛΛΑΞΕΙΣ ΜΕ ΤΟ ΧΕΡΙ: το φτιάχνει το watch/gen-strings.py από τα κείμενα της εφαρμογής Garmin.',
      'import Foundation', '', 'enum S {']
for nm, tb in (('en', EN), ('el', EL)):
    sw.append('    static let %s: [String: String] = [' % nm)
    sw += ['        %s: %s,' % (sq(k), sq(v)) for k, v in sorted(tb.items())]
    sw.append('    ]')
sw.append('}')
p = os.path.join(R, 'AlkyonWatch', 'Strings.swift')
os.makedirs(os.path.dirname(p), exist_ok=True)
open(p, 'w', encoding='utf-8').write('\n'.join(sw) + '\n')
print('strings:', len(EN), len(EL))
