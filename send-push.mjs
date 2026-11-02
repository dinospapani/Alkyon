// Τρέχει στο GitHub Actions. Ελέγχει την πρόγνωση για κάθε συσκευή και στέλνει push όταν έρχεται ιδανική ώρα.
import fs from 'node:fs';
import crypto from 'node:crypto';
import webpush from 'web-push';

const g = {};
new Function('self', fs.readFileSync('forecast.js', 'utf8'))(g);
const PF = g.PF;

const pub = process.env.VAPID_PUBLIC, priv = process.env.VAPID_PRIVATE;
const test = process.env.TEST === 'true';
let subs = [];
try { subs = JSON.parse(process.env.PUSH_SUBS || '[]'); } catch (e) { console.log('Το PUSH_SUBS δεν είναι έγκυρο JSON.'); process.exit(1); }
if (!Array.isArray(subs)) subs = [subs];
if (!subs.length) { console.log('Δεν υπάρχουν συσκευές στο PUSH_SUBS.'); process.exit(0); }
if (!pub || !priv) { console.log('Λείπει το VAPID_PRIVATE.'); process.exit(1); }
webpush.setVapidDetails('https://dinospapani.github.io/Alkyon/', pub, priv);

let state = {};
try { state = JSON.parse(fs.readFileSync('push-state.json', 'utf8')); } catch (e) {}
const before = JSON.stringify(state);
const id = s => crypto.createHash('sha1').update(s.sub.endpoint).digest('hex').slice(0, 12);

for (const s of subs) {
  if (!s || !s.sub || !s.sub.endpoint) { console.log('Άκυρη εγγραφή, παρακάμπτεται.'); continue; }
  const k = id(s);
  try {
    let payload = null;
    if (test) payload = { title: 'Δοκιμή push', body: 'Οι ειδοποιήσεις του Alkyon δουλεύουν από τον server.' };
    else {
      const fc = await PF.getForecast(s.lat, s.lon);
      const f = PF.findIdeal(fc, s.threshold || 75);
      if (!f) { console.log(k, 'καμία ιδανική ώρα'); continue; }
      if (state[k] === f.key) { console.log(k, 'έχει ήδη σταλεί', f.key); continue; }
      const m = PF.message(f); payload = { title: m.title, body: m.body };
      state[k] = f.key;
    }
    await webpush.sendNotification(s.sub, JSON.stringify(payload), { TTL: 6 * 3600 });
    console.log(k, 'στάλθηκε:', payload.body);
  } catch (e) {
    console.log(k, 'αποτυχία:', e.statusCode || '', e.body || e.message);
    if (!test) delete state[k];
  }
}
if (JSON.stringify(state) !== before) fs.writeFileSync('push-state.json', JSON.stringify(state, null, 1));
