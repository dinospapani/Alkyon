// Τρέχει στο GitHub Actions κάθε ~5 λεπτά. Στέλνει αυτόματα ειδοποίηση ασφαλείας (Telegram και email)
// όταν μια έξοδος δεν έχει επιβεβαιωθεί μετά την ώρα επιστροφής, όταν χαθεί η επαφή με το κινητό (πρώτα ρωτάει τον ψαρά στο Telegram)
// ή όταν η μπαταρία είναι πολύ χαμηλή. Στέλνει επίσης "ξεκίνησε" και "γύρισε ασφαλής".
import { pathToFileURL } from 'node:url';

const TZ = 'Asia/Nicosia';
const hm = iso => new Intl.DateTimeFormat('el-GR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
const hash32 = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
const mapLink = (la, lo) => (la != null && lo != null) ? `https://maps.google.com/?q=${(+la).toFixed(5)},${(+lo).toFixed(5)}` : '';

/* 25/11/2026 (A1 · S1): όρια χρόνου. Η Edge Function έχει όριο 150″ ανά εκτέλεση· μία κολλημένη κλήση (25/11 04:00 UTC: HTTP 546 στα 150″,
   χωρίς καμία γραμμή log) έκοβε ολόκληρο τον κύκλο, και μαζί τον έλεγχο ασφαλείας. Τώρα:
   - κάθε αίτημα δικτύου του run() κόβεται στα NET_MS (και η ανάγνωση της απάντησης),
   - κάθε αποστολή push / email κόβεται στα SEND_MS (η αποτυχία πιάνεται από τα υπάρχοντα try/catch· δεν σβήνει συνδρομή),
   - τα βήματα που ΔΕΝ είναι ασφάλεια (πρόγνωση, κοινότητα, καλαμάρια, «πότε τσιμπάνε») δεν ξεκινούν αν έχουν περάσει BUDGET_MS·
     τρέχουν στην επόμενη εκτέλεση. Τα βήματα ασφαλείας (1–5), η πτώση πίεσης (7), ο καιρός εξόδου (8) και η υγεία (9) τρέχουν πάντα.
   - stats.ms: πόσο κράτησε κάθε ομάδα βημάτων, για να φαίνεται στα logs τι αργεί. */
export const NET_MS = 20000, SEND_MS = 15000, BUDGET_MS = 100000;
export function timedFetch(F0, ms = NET_MS) {
  return (u, o) => (o && o.signal) ? F0(u, o) : F0(u, { ...(o || {}), signal: AbortSignal.timeout(ms) });
}
export function timedSend(fn, ms = SEND_MS, what = 'send') {
  return (...a) => { let t; const to = new Promise((_, rej) => { t = setTimeout(() => rej(new Error(what + ' timeout ' + ms + 'ms')), ms); });
    return Promise.race([Promise.resolve().then(() => fn(...a)), to]).finally(() => clearTimeout(t)); };   /* το race «πιάνει» και ένα σφάλμα που έρχεται αργότερα */
}

/* 1.14.83 (P0.7): παλμός από το native GPS του κινητού (Android foreground service / iOS background location), με σβηστή οθόνη.
   Δεν έχει token χρήστη: αποδεικνύει ποια έξοδο ενημερώνει με το κλειδί hb_key που έγραψε η εφαρμογή στο safety_trips όταν ξεκίνησε η έξοδος.
   Ενημερώνει μόνο θέση/ώρα/μπαταρία ενεργής εξόδου· τίποτα άλλο. Αγνοεί παλμούς πιο πυκνούς από 20″. */
export async function heartbeat({ env, fetch: F = fetch, now = Date.now() }, b) {
  const id = String(b && b.id || ''), key = String(b && b.key || ''), lat = +(b && b.lat), lon = +(b && b.lon);
  if (!/^[\w.-]{3,80}$/.test(id) || !/^[a-f0-9]{32,128}$/.test(key)) return { status: 400, body: { ok: false, error: 'bad request' } };
  const hasPos = Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !(lat === 0 && lon === 0);
  const H = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_KEY };
  const r = await F(env.SUPABASE_URL + '/rest/v1/safety_trips?id=eq.' + encodeURIComponent(id) + '&hb_key=eq.' + key + '&status=in.(active,alerted)&select=id,hb_at,last_at', { headers: H });
  /* 21/11/2026: σφάλμα ανάγνωσης της βάσης → 503, όχι 404. Πριν απαντούσε 404 «no active trip» και για έξοδο που τρέχει κανονικά.
     Τα κινητά (AlkHbRule, 1.14.95) ούτε μετρούν ούτε σταματούν σε 5xx· τα παλιότερα σταματούσαν σε κάθε 404. 404 μένει ΜΟΝΟ όταν η βάση απάντησε ότι δεν υπάρχει. */
  if (!r.ok) return { status: 503, body: { ok: false, error: 'read ' + r.status } };
  let a;
  try { a = await r.json(); } catch (e) { return { status: 502, body: { ok: false, error: 'read json' } }; }
  if (!Array.isArray(a)) return { status: 502, body: { ok: false, error: 'read shape' } };
  if (!a.length) return { status: 404, body: { ok: false, error: 'no active trip' } };
  const last = a[0].hb_at ? Date.parse(a[0].hb_at) : 0;
  if (now - last < 20e3) return { status: 200, body: { ok: true, skipped: 'rate' } };
  const at = new Date(now).toISOString(), o = { hb_at: at, hb_src: 'native' };
  /* 25/11/2026: ώρα ΤΗΣ ΘΕΣΗΣ, όχι του παλμού. Χωρίς σήμα GPS (κτίριο, καμπίνα) το κινητό ξαναστέλνει την τελευταία θέση έως 15′·
     πριν γραφόταν με last_at = τώρα και φαινόταν φρέσκια στην επαφή και στο SOS (Galaxy 25/11: θέση 14:48 ως 15:01).
     Τα κινητά από 1.14.98 στέλνουν age = δευτερόλεπτα από τη λήψη της θέσης. Χωρίς age (παλιές εκδόσεις): όπως πριν.
     age > 15′: η θέση δεν γράφεται (μόνο ο παλμός). Ποτέ δεν αντικαθίσταται νεότερη θέση με παλιότερη. */
  const ageRaw = b && b.age, age = ageRaw == null || ageRaw === '' ? null : +ageRaw;
  const ageOk = age != null && Number.isFinite(age) && age >= 0;
  const fixMs = ageOk ? now - Math.round(Math.min(age, 86400) * 1000) : now;
  const prevMs = a[0].last_at ? Date.parse(a[0].last_at) : NaN;
  const posOk = hasPos && !(ageOk && age > 900) && !(Number.isFinite(prevMs) && prevMs <= now + 60e3 && fixMs < prevMs);   /* last_at στο μέλλον (ρολόι συσκευής μπροστά): αγνοείται */
  if (posOk) { o.last_lat = Math.round(lat * 1e5) / 1e5; o.last_lon = Math.round(lon * 1e5) / 1e5; o.last_at = new Date(fixMs).toISOString(); }
  const bat = Math.round(+(b && b.battery)); if (Number.isFinite(bat) && bat >= 0 && bat <= 100) o.battery = bat;
  const u = await F(env.SUPABASE_URL + '/rest/v1/safety_trips?id=eq.' + encodeURIComponent(id) + '&hb_key=eq.' + key, { method: 'PATCH', headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(o) });
  return u.ok ? { status: 200, body: { ok: true } } : { status: 502, body: { ok: false, error: 'update ' + u.status } };
}
/* 1.14.83 (P0.6): πρέπει να τρέξει ένα περιοδικό βήμα; Με ανοχή 60″ ώστε ένας cron κάθε 5′ να το τρέχει κάθε ~15′ χωρίς να γλιστρά. */
export function isDue(lastOk, nowMs, periodMs, slackMs = 60e3) {
  const t = lastOk ? Date.parse(lastOk) : NaN;
  if (!Number.isFinite(t)) return true;
  if (t > nowMs + 5 * 60e3) return true;   // ρολόι/τιμή στο μέλλον: δεν μπλοκάρει για πάντα
  return nowMs - t >= periodMs - slackMs;
}
/* 1.14.83 (P0.6): «κλείδωμα» βήματος χωρίς ακριβές λεπτό. Τρέχει μόνο αν (α) πέρασε η περίοδος από την τελευταία ΕΠΙΤΥΧΙΑ και
   (β) καμία άλλη εκτέλεση δεν το έχει ήδη πάρει τα τελευταία 5′. Το «πάρσιμο» είναι ατομικό: PATCH με όρο την προηγούμενη τιμή last_try
   (αν δύο εκτελέσεις τρέξουν μαζί, μόνο η μία βρίσκει τη γραμμή αμετάβλητη). Αν μια εκτέλεση πέσει στη μέση, μετά από 5′ το βήμα ξαναπαίρνεται. */
export async function claimStep(sb, name, periodMs, now = Date.now(), staleMs = 5 * 60e3) {
  const r = await sb(`job_state?name=eq.${encodeURIComponent(name)}&select=last_ok,last_try`);
  const row = r && r[0];
  if (!isDue(row ? row.last_ok : null, now, periodMs)) return false;
  const lt = row && row.last_try ? Date.parse(row.last_try) : NaN, lo = row && row.last_ok ? Date.parse(row.last_ok) : NaN;
  if (Number.isFinite(lt) && now - lt < staleMs && !(Number.isFinite(lo) && lo >= lt)) return false;   // τρέχει ήδη αλλού
  const at = new Date(now).toISOString();
  if (!row) {
    const ins = await sb('job_state', { method: 'POST', headers: { Prefer: 'return=representation,resolution=ignore-duplicates' }, body: JSON.stringify([{ name, last_try: at }]) });
    return Array.isArray(ins) && ins.length === 1;
  }
  const cond = row.last_try ? 'last_try=eq.' + encodeURIComponent(row.last_try) : 'last_try=is.null';
  const up = await sb(`job_state?name=eq.${encodeURIComponent(name)}&${cond}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ last_try: at }) });
  return Array.isArray(up) && up.length === 1;
}
/* 28/11/2026: λίστα «Ειδοποίησέ με» του website (public.waitlist). Για κάθε νέα εγγραφή: email καλωσορίσματος στον επισκέπτη (EN/EL)
   και email στον διαχειριστή (alkyonfishingapp@gmail.com), μέσω Resend από hello@alkyonfishing.com. Τρέχει μόνο αν υπάρχει RESEND_API_KEY.
   Κάθε γραμμή «κλειδώνεται» πρώτα (welcomed_at, μόνο αν ήταν κενό) ώστε να μη σταλεί δύο φορές· αν η αποστολή αποτύχει, ξεκλειδώνεται
   και μετριέται (mail_tries)· μετά από 3 αποτυχίες σταματά και ο διαχειριστής ενημερώνεται μία φορά. */
export const WL_FROM = 'Alkyon <hello@alkyonfishing.com>', WL_REPLY = 'info@alkyonfishing.com', WL_ADMIN = 'alkyonfishingapp@gmail.com', WL_MAX_TRIES = 3;   // αποστολέας hello@· απαντήσεις/διαγραφές → info@ (επίσημο· Cloudflare Email Routing → Gmail)· ειδοποίηση διαχειριστή κατευθείαν στο Gmail
const WL_T = {
  en: { subject: 'You’re on the Alkyon list',
        text: 'Hi,\n\nThanks for your interest in Alkyon — the fishing forecast with one 0–100 score from sun, moon, pressure, wind and waves, plus a live sea map, your own logbook and safety at sea.\n\nWe’ll email you when Alkyon launches on Google Play and the App Store, and send occasional news.\n\nDon’t want these emails? Just reply to this message or write to info@alkyonfishing.com and we’ll remove you.\n\n— Alkyon\nhttps://alkyonfishing.com' },
  el: { subject: 'Είσαι στη λίστα του Alkyon',
        text: 'Γεια σου,\n\nΕυχαριστούμε για το ενδιαφέρον σου για το Alkyon — την πρόγνωση ψαρέματος με έναν βαθμό 0–100 από ήλιο, φεγγάρι, πίεση, άνεμο και κύμα, μαζί με ζωντανό χάρτη θάλασσας, το δικό σου ημερολόγιο και ασφάλεια στη θάλασσα.\n\nΘα σου στείλουμε email όταν το Alkyon κυκλοφορήσει στο Google Play και στο App Store, και περιστασιακά νέα.\n\nΔεν θέλεις αυτά τα emails; Απάντησε σε αυτό το μήνυμα ή γράψε στο info@alkyonfishing.com και θα σε διαγράψουμε.\n\n— Alkyon\nhttps://alkyonfishing.com' } };
const wlEsc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const wlHtml = t => '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#0b2230">' + t.split('\n\n').map(p => '<p>' + wlEsc(p).replace(/\n/g, '<br>').replace(/https:\/\/alkyonfishing\.com/, '<a href="https://alkyonfishing.com">alkyonfishing.com</a>') + '</p>').join('') + '</div>';
export function waitlistMails(row, n = {}) {
  const L = row.lang === 'el' ? 'el' : 'en', t = WL_T[L];
  const welcome = { from: WL_FROM, to: [row.email], reply_to: WL_REPLY, subject: t.subject, text: t.text, html: wlHtml(t.text),
    headers: { 'List-Unsubscribe': '<mailto:' + WL_REPLY + '?subject=unsubscribe>' } };
  const when = new Intl.DateTimeFormat('el-GR', { timeZone: TZ, dateStyle: 'short', timeStyle: 'short' }).format(new Date(row.created_at || Date.now()));
  const fail = n.failed ? '\n\n⚠ Το email καλωσορίσματος ΔΕΝ στάλθηκε μετά από ' + WL_MAX_TRIES + ' προσπάθειες (' + String(n.err || '').slice(0, 200) + ').' : '';
  const admin = { from: WL_FROM, to: [WL_ADMIN], subject: 'Alkyon · νέα εγγραφή στη λίστα' + (n.failed ? ' (χωρίς καλωσόρισμα)' : ''),
    text: 'Νέα εγγραφή στη λίστα «Ειδοποίησέ με» του alkyonfishing.com:\n\nEmail: ' + row.email + '\nΓλώσσα: ' + (L === 'el' ? 'Ελληνικά' : 'English') + '\nΏρα: ' + when + fail + '\n\nΌλη η λίστα: Supabase › Table Editor › waitlist' };
  return { welcome, admin };
}
export async function waitlistStep({ sb, F, key, log = () => {}, now = () => new Date().toISOString(), limit = 10 }) {
  const send = async m => { const r = await F('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify(m) });
    if (!r.ok) throw new Error('Resend ' + r.status + ' ' + (await r.text()).slice(0, 160)); return r.json().catch(() => ({})); };
  const rows = (await sb(`waitlist?welcomed_at=is.null&mail_tries=lt.${WL_MAX_TRIES}&select=id,email,lang,created_at,mail_tries&order=id.asc&limit=${limit}`)) || [];
  const out = { sent: 0, failed: 0, admin: 0 };
  for (const r of rows) {
    const got = (await sb(`waitlist?id=eq.${r.id}&welcomed_at=is.null`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ welcomed_at: now() }) })) || [];
    if (!got.length) continue;   // την πήρε ήδη άλλη εκτέλεση
    const m = waitlistMails(r);
    try { await send(m.welcome); out.sent++; }
    catch (e) {
      out.failed++; const tries = (r.mail_tries || 0) + 1;
      log('waitlist: ' + e.message);
      await sb(`waitlist?id=eq.${r.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(tries >= WL_MAX_TRIES ? { mail_tries: tries } : { welcomed_at: null, mail_tries: tries }) }).catch(() => {});
      if (tries < WL_MAX_TRIES) continue;
      try { await send(waitlistMails(r, { failed: true, err: e.message }).admin); out.admin++; } catch (e2) { log('waitlist: admin ' + e2.message); }
      continue;
    }
    try { await send(m.admin); out.admin++; } catch (e) { log('waitlist: admin ' + e.message); }
  }
  return out;
}

export async function run({ env, fetch: F0 = fetch, sendMail, log = console.log, PF = null, webpush = null, budgetMs = BUDGET_MS, netMs = NET_MS, sendMs = SEND_MS, only = null, learnOpen = false }) {
  const T0 = Date.now(), F = timedFetch(F0, netMs);
  if (webpush && typeof webpush.sendNotification === 'function') { const wp0 = webpush; webpush = Object.assign(Object.create(wp0), { sendNotification: timedSend((s, p, o) => wp0.sendNotification(s, p, o), sendMs, 'push') }); }
  if (typeof sendMail === 'function') sendMail = timedSend(sendMail, sendMs, 'email');
  const URL_ = env.SUPABASE_URL, KEY = env.SUPABASE_SERVICE_KEY, TG = env.TELEGRAM_BOT_TOKEN;
  if (!URL_ || !KEY) { log('Λείπουν τα SUPABASE_URL / SUPABASE_SERVICE_KEY.'); return { ok: false }; }
  const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
  const sb = async (path, opt = {}) => {
    const r = await F(URL_ + '/rest/v1/' + path, { ...opt, headers: { ...H, ...(opt.headers || {}) } });
    if (!r.ok) throw new Error('Supabase ' + r.status + ' ' + (await r.text()).slice(0, 160));
    const t = await r.text(); return t ? JSON.parse(t) : null;
  };
  // 1.14.87 (P1.3a): οι ρυθμίσεις βαθμολόγησης του χρήστη (προφίλ ψαρέματος, είδος-στόχος, όρια), ώστε ο server να βγάζει τον ίδιο βαθμό με την εφαρμογή του.
  // Ο κανόνας είναι ο PF.userPrefs (forecast.js)· εδώ μόνο διαβάζονται οι πηγές του. Αν κάτι αποτύχει, ισχύει ό,τι ίσχυε (σκάφος, προεπιλεγμένα όρια).
  const PREFS = new Map();
  const prefsOf = async (uid, places) => { const none = { prof: null, sp: null, limits: null, src: null };
    if (!PF.userPrefs) return none; let c = uid ? PREFS.get(uid) : null;
    if (uid && !c) { c = { settings: null, lastProf: null };
      try { const a = await sb(`records?user_id=eq.${encodeURIComponent(uid)}&kind=eq.settings&id=eq.main&select=data&limit=1`); c.settings = a && a[0] && a[0].data || null; } catch (e) { }
      try { const a = await sb(`records?user_id=eq.${encodeURIComponent(uid)}&kind=in.(trips,bites)&deleted=eq.false&select=p:data->>prof,s:data->>src&order=updated_at.desc&limit=8`); c.lastProf = ((a || []).find(x => x && x.p && x.s !== 'watch') || {}).p || null; } catch (e) { }   // όχι οι καταγραφές του ρολογιού: γράφονται πάντα ως «σκάφος»
      PREFS.set(uid, c); }
    try { return PF.userPrefs({ places: places || [], settings: c && c.settings, lastProf: c && c.lastProf }); } catch (e) { return none; } };
  const tg = async (method, body) => {
    const r = await F(`https://api.telegram.org/bot${TG}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({})); if (!j.ok) throw new Error('Telegram ' + (j.description || r.status)); return j.result;
  };
  const stats = { linked: 0, start: 0, alert: 0, clear: 0, ping: 0, silence: 0, lowbat: 0, ok: 0, fc: 0, pa: 0, squid: 0 };
  /* 25/11/2026 (A1 · S1): χρόνοι ανά ομάδα βημάτων και προϋπολογισμός χρόνου (βλ. BUDGET_MS) */
  const TM = {}; let tPrev = T0;
  const mark = k => { const n = Date.now(); TM[k] = n - tPrev; tPrev = n; };
  const late = () => Date.now() - T0 > budgetMs;
  const skip = k => { (stats.skip = stats.skip || []).push(k); log0('budget: ' + k + ' παραλείφθηκε στα ' + (Date.now() - T0) + ' ms (τρέχει στην επόμενη εκτέλεση)'); };
  const PING_WAIT_MIN = 15, LOWBAT = 10;
  // 1.9.50: τα σφάλματα των βημάτων μαζεύονται (για ειδοποίηση στους διαχειριστές στο τέλος· βλ. βήμα 9)
  const ERRS = [], log0 = log;
  const STEP_ERR = /^(Telegram updates|Telegram send|Email send|Telegram ping|port note decide|port notes|weekly|morning|Forecast job|Πίεση|Πίεση Telegram|Πίεση \(Open-Meteo\)|community push|squid|squid fc|squid notif_log|Καιρός εξόδου|bite stats|waitlist)$/;
  log = m => { log0(m); const t = String(m), k = t.split(':')[0].trim(); if (STEP_ERR.test(k)) ERRS.push({ k, m: t.slice(0, 300) }); };
  /* 1.14.83 (P0.6): βήματα που τρέχουν «κάθε ~15′» δεν εξαρτώνται από το ακριβές λεπτό του cron: κρατιέται πότε έτρεξαν τελευταία φορά
     με επιτυχία (job_state). Αν ο cron αργήσει ή χάσει μια εκτέλεση, το βήμα τρέχει στην επόμενη. Χωρίς τον πίνακα (παλιό σχήμα): όπως πριν. */
  const jobs = {};
  const stepDue = async (name, periodMs) => {
    try { const ok = await claimStep(sb, name, periodMs, Date.now()); jobs[name] = { known: true }; return ok; }
    /* χωρίς τον πίνακα job_state (πριν το migration): τρέχει σε κάθε εκτέλεση· οι ειδοποιήσεις δεν διπλασιάζονται (notif_log) */
    catch (e) { jobs[name] = { known: false }; return true; } };
  const stepOk = async (name) => { if (!jobs[name] || !jobs[name].known) return;
    const at = new Date().toISOString();
    await sb(`job_state?name=eq.${encodeURIComponent(name)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ last_ok: at }) }).catch(e => log('job_state: ' + e.message)); };
  const patch = (id, o) => sb(`safety_trips?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(o) });
  // 1.9.19: τα Telegram των διαχειριστών (app_admins → το δικό τους Telegram από safety_contacts.self_chat_id)
  let ADM = null;
  const adminChats = async () => {
    if (ADM) return ADM;
    const a = (await sb('app_admins?select=user_id').catch(() => [])) || [];
    if (!a.length) return (ADM = []);
    const c = (await sb(`safety_contacts?user_id=in.(${a.map(x => x.user_id).join(',')})&select=self_chat_id`).catch(() => [])) || [];
    return (ADM = c.map(x => Number(x.self_chat_id)).filter(x => x && !isNaN(x)));
  };
  const contactOf = async uid => { const r = await sb(`safety_contacts?user_id=eq.${uid}&select=*`); return r && r[0]; };

  // 1) Σύνδεση επαφών Telegram: /start ΚΩΔΙΚΟΣ
  if (TG) {
    try {
      const ups = await tg('getUpdates', { timeout: 0, allowed_updates: ['message', 'callback_query'] });
      let last = null;
      for (const u of ups || []) {
        last = u.update_id;
        const cq = u.callback_query;
        // 1.9.19: έγκριση/απόρριψη σημειώσεων λιμανιών από διαχειριστή (κουμπιά ✅/❌)
        if (cq && typeof cq.data === 'string' && /^pn:(ok|no):[0-9a-f-]{36}$/.test(cq.data)) {
          const chat = cq.message && cq.message.chat && cq.message.chat.id;
          const [, act, id] = cq.data.split(':');
          try {
            const chats = await adminChats();
            if (chats.includes(Number(chat))) {
              await sb(`port_notes?id=eq.${id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: act === 'ok' ? 'ok' : 'rejected' }) });
              await tg('answerCallbackQuery', { callback_query_id: cq.id, text: act === 'ok' ? 'Εγκρίθηκε' : 'Απορρίφθηκε' });
              if (cq.message) await tg('editMessageText', { chat_id: chat, message_id: cq.message.message_id, text: (cq.message.text || '') + (act === 'ok' ? '\n\n✅ Εγκρίθηκε: φαίνεται σε όλους.' : '\n\n❌ Απορρίφθηκε.') }).catch(() => null);
              stats.pn = (stats.pn || 0) + 1;
            } else await tg('answerCallbackQuery', { callback_query_id: cq.id, text: 'Μόνο για διαχειριστές.' });
          } catch (e) { log('port note decide: ' + e.message); }
          continue;
        }
        if (cq && typeof cq.data === 'string' && cq.data.startsWith('ok:')) {
          const rows = await sb(`safety_trips?id=eq.${encodeURIComponent(cq.data.slice(3))}&select=user_id`);
          const c = rows && rows[0] ? await contactOf(rows[0].user_id) : null;
          const chat = cq.message && cq.message.chat && cq.message.chat.id;
          if (c && c.self_chat_id != null && Number(c.self_chat_id) === Number(chat)) {
            await patch(cq.data.slice(3), { hb_at: new Date().toISOString(), ping_at: null });
            await tg('answerCallbackQuery', { callback_query_id: cq.id, text: 'Ευχαριστώ!' });
            await tg('sendMessage', { chat_id: chat, text: '✅ Ευχαριστώ, καταγράφηκε ότι είσαι καλά. Σε ξαναρωτάω αν χαθεί πάλι το σήμα.' });
            stats.ok++;
          } else await tg('answerCallbackQuery', { callback_query_id: cq.id, text: 'Η έξοδος δεν βρέθηκε.' });
          continue;
        }
        const m = u.message; if (!m || !m.text) continue;
        const mm = m.text.match(/^\/start\s+([A-Za-z0-9]{6,32})/); if (!mm) continue;
        const name = [m.from && m.from.first_name, m.from && m.from.last_name].filter(Boolean).join(' ') || 'Επαφή';
        const byTg = await sb(`safety_contacts?tg_code=eq.${encodeURIComponent(mm[1])}&select=user_id`);
        if (byTg && byTg[0]) {
          await sb(`safety_contacts?user_id=eq.${byTg[0].user_id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ tg_chat_id: m.chat.id, tg_name: name }) });
          await tg('sendMessage', { chat_id: m.chat.id, text: 'Συνδέθηκες ως επαφή ασφαλείας στο Alkyon. Θα λαμβάνεις ειδοποίηση αν κάποιος που ψαρεύει δεν γυρίσει στην ώρα του ή χαθεί η επαφή μαζί του.' });
          stats.linked++; continue;
        }
        const bySelf = await sb(`safety_contacts?self_code=eq.${encodeURIComponent(mm[1])}&select=user_id`).catch(() => null);
        if (bySelf && bySelf[0]) {
          await sb(`safety_contacts?user_id=eq.${bySelf[0].user_id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ self_chat_id: m.chat.id }) });
          await tg('sendMessage', { chat_id: m.chat.id, text: 'Το Telegram σου συνδέθηκε με το Alkyon. Όταν είσαι σε έξοδο και χαθεί η επαφή με το κινητό σου, θα σε ρωτάω εδώ «είσαι καλά;» πριν ειδοποιήσω την επαφή ασφαλείας σου.' });
          stats.linked++; continue;
        }
        await tg('sendMessage', { chat_id: m.chat.id, text: 'Ο σύνδεσμος δεν είναι έγκυρος. Ζήτα νέο από τον φίλο σου.' });
      }
      if (last != null) await tg('getUpdates', { offset: last + 1, timeout: 0 });
    } catch (e) { log('Telegram updates: ' + e.message); }
  }

  const notify = async (c, text, trip, withLoc) => {
    let sent = 0;
    if (c && c.tg_chat_id && TG) {
      try { await tg('sendMessage', { chat_id: c.tg_chat_id, text }); if (withLoc && trip.last_lat != null) await tg('sendLocation', { chat_id: c.tg_chat_id, latitude: trip.last_lat, longitude: trip.last_lon }); sent++; }
      catch (e) { log('Telegram send: ' + e.message); }
    }
    if (c && c.email && sendMail) {
      try { await sendMail({ to: c.email, subject: text.split('\n')[0].slice(0, 90), text }); sent++; }
      catch (e) { log('Email send: ' + e.message); }
    }
    return sent;
  };
  const who = t => (t.user_name || 'Ο φίλος σου');
  const startText = t => `${who(t)} ξεκίνησε έξοδο με σκάφος${t.route ? ' (' + t.route + ')' : ''}. Επιστροφή στις ${hm(t.due_at)}. Θα ειδοποιηθείς αυτόματα αν δεν επιβεβαιώσει ότι γύρισε, αν χαθεί η επαφή μαζί του ή αν το κινητό του μείνει από μπαταρία.`;
  const doneText = t => (t.alerted_at || t.silence_sent || t.lowbat_sent)
    ? `ΟΛΑ ΚΑΛΑ: ${who(t)} επιβεβαίωσε ότι γύρισε ασφαλής. Ευχαριστούμε.`
    : `✅ ${who(t)} γύρισε από την έξοδο με σκάφος${t.route ? ' (' + t.route + ')' : ''}. Όλα καλά.`;
  const nowIso = new Date().toISOString();

  // Άμεση ενημέρωση από την εφαρμογή (phase: start | end) για μία έξοδο ενός χρήστη. Δεν τρέχει τα υπόλοιπα βήματα.
  // 1.9.61: το βήμα της Κοινότητας ως συνάρτηση, ώστε να τρέχει και αμέσως όταν κάποιος ανεβάζει ψάρι / κάνει like / σχόλιο
  const commStep = async () => {
  // 7β) 1.9.25: Κοινότητα, σαν τα κοινωνικά δίκτυα:
  //   (α) νέο ψάρι από άλλον χρήστη → push σε όσους έχουν «Νέα στην Κοινότητα» (places[].comm !== 'off'). Αν είναι πολλά, ένα μήνυμα «3 νέα ψάρια».
  //   (β) like ή σχόλιο σε δική σου ανάρτηση → push σε σένα (places[].commre !== 'off').
  //   Όχι στις ώρες ησυχίας (23:00–07:00 Κύπρου). Μία φορά ανά γεγονός (notif_log, ignore-duplicates). Όριο: το (α) το πολύ μία φορά ανά 30 λεπτά ανά χρήστη.
  if (webpush) {
    try {
      const since = new Date(Date.now() - 6 * 60000).toISOString();
      const enc = encodeURIComponent(since);
      // 1.9.56: τα νέα ψάρια των τελευταίων 2 ωρών (όχι μόνο 6′), ώστε όποιος κόπηκε από το όριο των 30′ να τα πάρει αργότερα σε ένα μήνυμα, αντί να χάνονται
      const encP = encodeURIComponent(new Date(Date.now() - 2 * 3600000).toISOString());
      const postsAll = (await sb(`community_posts?created_at=gt.${encP}&hidden=eq.false&select=id,user_id,author,species,latin,kg,cond,created_at&order=created_at.asc`).catch(() => [])) || [];
      const posts = postsAll.filter(p => p.created_at > since);
      const likes = (await sb(`community_likes?created_at=gt.${enc}&select=post_id,user_id,created_at`).catch(() => [])) || [];
      const coms = (await sb(`community_comments?created_at=gt.${enc}&hidden=eq.false&select=id,post_id,user_id,author,body,created_at`).catch(() => [])) || [];
      // 1.9.65: νέες αναφορές (→ διαχειριστές) και η περίληψη της εβδομάδας (Κυριακή 20:00–20:59 Κύπρου)
      const repsNew = (await sb(`community_reports?created_at=gt.${enc}&select=id,post_id,comment_id,reason,created_at`).catch(() => [])) || [];
      const cyNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Nicosia' }));
      const wkDue = cyNow.getDay() === 0 && cyNow.getHours() === 20;
      if (postsAll.length || likes.length || coms.length || repsNew.length || wkDue) {
        const cyH = +new Date().toLocaleString('en-GB', { timeZone: 'Asia/Nicosia', hour: '2-digit', hour12: false }).slice(0, 2);
        const quietNow = cyH >= 23 || cyH < 7;
        const subsAll = (await sb('push_subs?select=id,user_id,sub,places').catch(() => [])) || [];
        const byUser = {}; for (const r of subsAll) (byUser[r.user_id] = byUser[r.user_id] || []).push(r);
        const flag = (rows, k) => !(rows.find(r => (r.places || []).find(p => p && p[k] === 'off')));
        const isEn = rows => !!(rows.find(r => (r.places || []).find(p => p && p.lang === 'en')));
        const quietOn = rows => !(rows.find(r => (r.places || []).find(p => p && p.quiet === 'off')));
        // 1.9.63: «μόνο όσους ακολουθώ» (places[].comm === 'follow', places[].follow = [user_id])
        const followOf = rows => { for (const r of rows) for (const p of (r.places || [])) if (p && p.comm === 'follow') return new Set(Array.isArray(p.follow) ? p.follow : []); return null; };
        const send = async (uid, key, kind, title, body) => {
          const rows = byUser[uid] || []; // 1.9.56: γράφεται στο ιστορικό (Ειδοποιήσεις της εφαρμογής) ακόμα κι αν το κινητό δεν έχει ενεργή συνδρομή push
          const at = new Date().toISOString();
          let ins = null; try { ins = await sb('notif_log', { method: 'POST', headers: { Prefer: 'return=representation,resolution=ignore-duplicates' }, body: JSON.stringify({ id: (uid + '|' + key).slice(0, 250), user_id: uid, at, kind, title, body }) }); } catch (e) { return; }
          if (Array.isArray(ins) && !ins.length) return;   // ήδη στάλθηκε
          for (const r of rows) {
            try { await webpush.sendNotification(r.sub, JSON.stringify({ title, body, full: body, kind, id: key, tag: 'alk-' + key.slice(0, 40), at, url: '#community' }), { TTL: 3 * 3600 }); stats.comm = (stats.comm || 0) + 1; }
            catch (e) { if (e.statusCode === 404 || e.statusCode === 410) await sb(`push_subs?id=eq.${encodeURIComponent(r.id)}`, { method: 'DELETE' }).catch(() => {}); }
          }
          return true;
        };
        // (α) νέα ψάρια
        if (postsAll.length) {
          // 1.9.63: νέο ρεκόρ Κοινότητας (βαρύτερο από κάθε προηγούμενη ανάρτηση του ίδιου είδους)
          for (const p of postsAll) {
            const q = p.cond && (p.cond.k === 'q' || p.cond.k === 'id');
            if (q || !(+p.kg > 0) || !p.species) continue;
            const prev = (await sb(`community_posts?species=eq.${encodeURIComponent(p.species)}&hidden=eq.false&created_at=lt.${encodeURIComponent(p.created_at)}&kg=not.is.null&select=kg&order=kg.desc&limit=1`).catch(() => [])) || [];
            if (prev.length && +p.kg > +prev[0].kg) p._rec = true;
          }
          // τελευταία ειδοποίηση «νέα ψάρια» ανά χρήστη (2 ώρες): ό,τι ανέβηκε μετά από αυτήν και δεν το έχει πάρει
          const recent = (await sb(`notif_log?kind=eq.comm&at=gt.${encP}&select=user_id,at`).catch(() => [])) || [];
          // 1.9.64: «Ειδοποίησέ με όταν κάποιος πιάσει…» (places[].wsp = κλειδιά ειδών, πεζά). Αμέσως, χωρίς το όριο των 30′, μία φορά ανά ανάρτηση.
          const spSent = {};
          for (const uid of Object.keys(byUser)) {
            const rows = byUser[uid]; const keys = new Set(); for (const r of rows) for (const pl of (r.places || [])) if (pl && Array.isArray(pl.wsp)) pl.wsp.forEach(k => keys.add(String(k).toLowerCase()));
            if (!keys.size || (quietNow && quietOn(rows))) continue;
            const en = isEn(rows);
            for (const p of postsAll) {
              if (p.user_id === uid || (p.cond && (p.cond.k === 'q' || p.cond.k === 'id'))) continue;
              const items = [{ s: p.species, la: p.latin, kg: p.kg }].concat((p.cond && Array.isArray(p.cond.more) ? p.cond.more : []).map(x => ({ s: x && x.s, kg: x && x.kg })));
              const hit = items.find(x => x.s && (keys.has(String(x.s).trim().toLowerCase()) || (x.la && keys.has(String(x.la).toLowerCase()))));
              if (!hit) continue;
              (spSent[uid] = spSent[uid] || new Set()).add(p.id);
              const kgT = hit.kg ? ' ' + String(hit.kg).replace('.', en ? '.' : ',') + ' kg' : '';
              await send(uid, 'csp:' + p.id.slice(0, 8), 'commsp', en ? `🐟 ${hit.s} in the Community` : `🐟 ${hit.s} στην Κοινότητα`, (p.author || (en ? 'An angler' : 'Ένας ψαράς')) + (en ? ' caught ' : ' έπιασε ') + hit.s + kgT);
            }
          }
          const lastAt = {}; for (const x of recent) if (!lastAt[x.user_id] || x.at > lastAt[x.user_id]) lastAt[x.user_id] = x.at;
          for (const uid of Object.keys(byUser)) {
            const rows = byUser[uid]; if (!flag(rows, 'comm') || (quietNow && quietOn(rows))) continue;
            const la = lastAt[uid] ? Date.parse(lastAt[uid]) : 0;
            if (la && Date.now() - la < 30 * 60000) continue;                 // όριο: μία φορά ανά 30′ (τα ψάρια περιμένουν, δεν χάνονται)
            const from = la ? new Date(la).toISOString() : since;              // από την τελευταία ειδοποίηση, αλλιώς τα 6′ όπως πριν
            const fs = followOf(rows);
            const mine = (la ? postsAll : posts).filter(p => p.user_id !== uid && p.created_at > from && (!fs || fs.has(p.user_id)) && !(spSent[uid] && spSent[uid].has(p.id))); if (!mine.length) continue;
            const en = isEn(rows), p0 = mine[mine.length - 1];
            const isQ = p => p.cond && (p.cond.k === 'q' || p.cond.k === 'id');
            const what = p => { if (isQ(p)) return (en ? 'asks: ' : 'ρωτά: ') + (p.cond.k === 'id' ? (en ? 'What fish is this?' : 'Τι ψάρι είναι;') : String(p.cond.q || '').slice(0, 80)); const more = (p.cond && Array.isArray(p.cond.more)) ? p.cond.more.length : 0; return (p.species || '') + (p.kg ? ' ' + String(p.kg).replace('.', en ? '.' : ',') + ' kg' : '') + (more ? (en ? ` +${more} more` : ` +${more} ακόμα`) : ''); };
            const rec = mine.filter(p => p._rec).pop();
            const title = rec ? (en ? `🏆 New Community record: ${rec.species}` : `🏆 Νέο ρεκόρ Κοινότητας: ${rec.species}`) : mine.length === 1 && isQ(p0) ? (en ? '❓ New question in the Community' : '❓ Νέα ερώτηση στην Κοινότητα') : mine.length > 1 ? (en ? `🐟 ${mine.length} new catches in the Community` : `🐟 ${mine.length} νέα ψάρια στην Κοινότητα`) : (en ? '🐟 New catch in the Community' : '🐟 Νέο ψάρι στην Κοινότητα');
            const one = p => (p.author || (en ? 'An angler' : 'Ένας ψαράς')) + (isQ(p) ? ' ' : (en ? ' caught ' : ' έπιασε ')) + what(p);
            const body = rec && mine.length === 1 ? one(rec) : mine.length > 1 ? mine.slice(-3).map(p => (p.author || '') + ': ' + what(p)).join(' · ') : one(p0);
            await send(uid, 'comm:' + mine.map(p => p.id.slice(0, 8)).join(','), 'comm', title, body);
          }
        }
        // (β) like / σχόλια στις δικές μου αναρτήσεις
        const pids = [...new Set([...likes.map(l => l.post_id), ...coms.map(c => c.post_id)])];
        if (pids.length) {
          const own = (await sb(`community_posts?id=in.(${pids.join(',')})&select=id,user_id,species`).catch(() => [])) || [];
          const po = {}; for (const p of own) po[p.id] = p;
          for (const l of likes) { const p = po[l.post_id]; if (!p || p.user_id === l.user_id) continue; const rows = byUser[p.user_id] || []; if (rows.length && (!flag(rows, 'commre') || (quietNow && quietOn(rows)))) continue;
            const en = isEn(rows); await send(p.user_id, 'cl:' + l.post_id.slice(0, 8) + ':' + l.user_id.slice(0, 8), 'commre', en ? '❤️ Someone liked your catch' : '❤️ Άρεσε σε κάποιον το ψάρι σου', p.species || ''); }
          for (const c of coms) { const p = po[c.post_id]; if (!p || p.user_id === c.user_id) continue; const rows = byUser[p.user_id] || []; if (rows.length && (!flag(rows, 'commre') || (quietNow && quietOn(rows)))) continue;
            const en = isEn(rows); await send(p.user_id, 'cc:' + c.id, 'commre', (en ? '💬 New comment on your ' : '💬 Νέο σχόλιο στο ') + (p.species || (en ? 'catch' : 'ψάρι σου')), (c.author ? c.author + ': ' : '') + String(c.body || '').slice(0, 120)); }
          // 1.9.62: απάντηση σε σχόλιο («@Όνομα …») → ειδοποίηση σε αυτόν που απάντησαν (αν δεν είναι ο ίδιος ή ο κάτοχος, που ήδη ειδοποιείται)
          const reps = coms.filter(c => /^@\S/.test(String(c.body || '')));
          if (reps.length) {
            const rp = [...new Set(reps.map(c => c.post_id))];
            const prev = (await sb(`community_comments?post_id=in.(${rp.join(',')})&hidden=eq.false&select=post_id,user_id,author`).catch(() => [])) || [];
            for (const c of reps) {
              const p = po[c.post_id]; const body = String(c.body || '');
              let to = null, name = '';
              for (const o of prev) { if (o.post_id !== c.post_id || !o.author || o.user_id === c.user_id) continue; if (body.startsWith('@' + o.author) && o.author.length > name.length) { name = o.author; to = o.user_id; } }
              if (!to || (p && to === p.user_id)) continue;
              const rows = byUser[to] || []; if (rows.length && (!flag(rows, 'commre') || (quietNow && quietOn(rows)))) continue;
              const en = isEn(rows);
              await send(to, 'cr:' + c.id, 'commre', (c.author || (en ? 'Someone' : 'Κάποιος')) + (en ? ' replied to you' : ' σου απάντησε'), body.slice(name.length + 1).trim().slice(0, 120) || (p && p.species) || '');
            }
          }
        }
        // 1.9.65: αναφορά → ειδοποίηση (εφαρμογή + Telegram) σε κάθε διαχειριστή, μία φορά ανά αναφορά
        if (repsNew.length) {
          const adm = (await sb('app_admins?select=user_id').catch(() => [])) || [];
          for (const r of repsNew) {
            let what = '';
            if (r.post_id) { const p = ((await sb(`community_posts?id=eq.${r.post_id}&select=author,species,cond`).catch(() => [])) || [])[0]; if (p) what = (p.author || '') + ': ' + (p.cond && p.cond.q ? String(p.cond.q).slice(0, 80) : (p.species || '')); }
            else if (r.comment_id) { const c = ((await sb(`community_comments?id=eq.${r.comment_id}&select=author,body`).catch(() => [])) || [])[0]; if (c) what = (c.author || '') + ': «' + String(c.body || '').slice(0, 100) + '»'; }
            if (!what) continue;
            const kindTxt = r.post_id ? 'ανάρτηση' : 'σχόλιο';
            for (const a of adm) {
              const ok = await send(a.user_id, 'rep:' + r.id, 'commadm', '🚩 Αναφορά σε ' + kindTxt + ' της Κοινότητας', what + ' · Κοινότητα › Αναφορές');
              if (ok && TG) { const c = await contactOf(a.user_id).catch(() => null); if (c && c.self_chat_id) await tg('sendMessage', { chat_id: c.self_chat_id, text: '🚩 Alkyon: αναφορά σε ' + kindTxt + ' της Κοινότητας\n' + what + '\nΆνοιξε Κοινότητα › Αναφορές για απόκρυψη ή απόρριψη.' }).catch(e => log('Telegram send: ' + e.message)); }
            }
          }
        }
        // 1.9.65: περίληψη εβδομάδας (Κυριακή βράδυ), σε όσους έχουν ανοιχτά τα «νέα ψάρια»
        if (wkDue) {
          const wk = ((await sb(`community_posts?created_at=gt.${encodeURIComponent(new Date(Date.now() - 7 * 864e5).toISOString())}&hidden=eq.false&select=user_id,author,species,kg,cond,day`).catch(() => [])) || []).filter(p => !(p.cond && (p.cond.k === 'q' || p.cond.k === 'id')) && p.species && (!p.day || Date.parse(p.day + 'T12:00:00Z') >= Date.now() - 7.5 * 864e5)); // 1.9.66: μόνο ψάρια που πιάστηκαν αυτή την εβδομάδα
          if (wk.length) {
            const day = cyNow.getFullYear() + '-' + String(cyNow.getMonth() + 1).padStart(2, '0') + '-' + String(cyNow.getDate()).padStart(2, '0');
            const cnt = {}; let big = null; const who = new Set();
            for (const p of wk) { who.add(p.user_id); const items = [{ s: p.species, kg: p.kg }].concat((p.cond && Array.isArray(p.cond.more) ? p.cond.more : []).filter(x => x && x.s)); for (const x of items) { cnt[x.s] = (cnt[x.s] || 0) + 1; if (+x.kg > 0 && (!big || +x.kg > big.kg)) big = { s: x.s, kg: +x.kg, a: p.author }; } }
            const n = Object.values(cnt).reduce((a, b) => a + b, 0), top = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]).slice(0, 3);
            for (const uid of Object.keys(byUser)) {
              const rows = byUser[uid]; if (!flag(rows, 'comm')) continue;
              const en = isEn(rows), kg = v => String(v).replace('.', en ? '.' : ',') + ' kg';
              const body = en ? `${n} catches from ${who.size} anglers. Most: ${top.map(k => k + ' (' + cnt[k] + ')').join(', ')}.` + (big ? ` Biggest: ${big.s} ${kg(big.kg)} (${big.a || ''}).` : '')
                : `${n} ψάρια από ${who.size} ψαράδες. Περισσότερα: ${top.map(k => k + ' (' + cnt[k] + ')').join(', ')}.` + (big ? ` Μεγαλύτερο: ${big.s} ${kg(big.kg)} (${big.a || ''}).` : '');
              await send(uid, 'wk:' + day, 'commwk', en ? '📊 This week in the Community' : '📊 Η εβδομάδα στην Κοινότητα', body);
            }
          }
        }
      }
    } catch (e) { log('community push: ' + e.message); }
  }
  };
  if (only && only.comm) { await commStep(); return { ok: true, stats }; }
  if (only) {
    const rows = (await sb(`safety_trips?id=eq.${encodeURIComponent(only.id)}&user_id=eq.${encodeURIComponent(only.uid)}&select=*`)) || [];
    const t = rows[0]; if (!t) return { ok: true, sent: 0, why: 'no trip' };
    const c = await contactOf(t.user_id);
    if (only.phase === 'start') {
      if (t.status !== 'active' || t.start_sent) return { ok: true, sent: 0, why: 'already' };
      if (Date.parse(t.due_at) <= Date.now()) return { ok: true, sent: 0, why: 'late' };
      const n = await notify(c, startText(t), t, false);
      await patch(t.id, { start_sent: true });
      return { ok: true, sent: n };
    }
    if (only.phase === 'end') {
      if (t.status !== 'done' || t.done_sent || !t.start_sent) return { ok: true, sent: 0, why: 'skip' };
      const n = await notify(c, doneText(t), t, false);
      await patch(t.id, { done_sent: true });
      return { ok: true, sent: n };
    }
    return { ok: false, why: 'bad phase' };
  }

  // 2) Νέες έξοδοι: ενημέρωση "ξεκίνησε" (εφεδρικά, αν δεν πρόλαβε η άμεση ειδοποίηση από την εφαρμογή).
  //    Αν η ώρα επιστροφής έχει ήδη περάσει, δεν στέλνουμε «ξεκίνησε» (θα ακολουθήσει η ειδοποίηση ασφαλείας).
  for (const t of (await sb(`safety_trips?status=eq.active&start_sent=eq.false&select=*`)) || []) {
    const late = Date.parse(t.due_at) <= Date.now();
    const c = late ? null : await contactOf(t.user_id);
    const n = late ? 0 : await notify(c, startText(t), t, false);
    await sb(`safety_trips?id=eq.${encodeURIComponent(t.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ start_sent: true }) });
    if (n) stats.start++;
  }

  // 3) Εκπρόθεσμες έξοδοι: ειδοποίηση
  for (const t of (await sb(`safety_trips?status=eq.active&alerted_at=is.null&due_at=lt.${encodeURIComponent(nowIso)}&select=*`)) || []) {
    const c = await contactOf(t.user_id);
    const link = mapLink(t.last_lat, t.last_lon);
    const text = `ΕΙΔΟΠΟΙΗΣΗ ΑΣΦΑΛΕΙΑΣ: ${who(t)} είχε δηλώσει επιστροφή στις ${hm(t.due_at)} από έξοδο με σκάφος${t.route ? ' (' + t.route + ')' : ''} και δεν έχει επιβεβαιώσει ότι γύρισε.\n` +
      (link ? `Τελευταία γνωστή θέση (${hm(t.last_at)}): ${link}\n` : 'Δεν υπάρχει καταγεγραμμένη θέση.\n') +
      'Δοκίμασε να τον/την καλέσεις. Αν δεν απαντά, κάλεσε το 112.';
    await notify(c, text, t, true);
    // 1.14.13: και push στους φίλους του στην εφαρμογή (όπου κι αν βρίσκονται)
    if (webpush) try {
      const fr = ((await sb(`friends?owner=eq.${encodeURIComponent(t.user_id)}&select=viewer`)) || []).map(x => x.viewer).filter(v => v && v !== t.user_id);
      const nm = String(t.user_name || '').slice(0, 40) || 'Ο φίλος σου';
      const pl = { id: 'late:' + t.id, kind: 'sos', tag: 'late-' + t.id, url: '#map', title: '⚠️ Δεν γύρισε ακόμα · Not back yet',
        body: nm + ': είχε δηλώσει επιστροφή στις ' + hm(t.due_at) + ' και δεν έχει επιβεβαιώσει ότι γύρισε. Κάλεσέ τον· αν δεν απαντά, 112. · Was due back and has not confirmed.',
        place: (typeof t.last_lat === 'number' && typeof t.last_lon === 'number') ? { name: nm, lat: t.last_lat, lon: t.last_lon } : undefined };
      for (const f of fr) for (const r of ((await sb(`push_subs?user_id=eq.${encodeURIComponent(f)}&select=id,sub`)) || [])) {
        try { await webpush.sendNotification(r.sub, JSON.stringify(pl), { TTL: 6 * 3600, urgency: 'high' }); } catch (e) { if (e.statusCode === 404 || e.statusCode === 410) await sb(`push_subs?id=eq.${encodeURIComponent(r.id)}`, { method: 'DELETE' }).catch(() => {}); }
      }
    } catch (e) { log('late friends: ' + e.message); }
    await sb(`safety_trips?id=eq.${encodeURIComponent(t.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ alerted_at: nowIso, status: 'alerted' }) });
    stats.alert++;
  }

  // 3β) Χαμηλή μπαταρία
  for (const t of (await sb(`safety_trips?status=eq.active&lowbat_sent=eq.false&battery=lte.${LOWBAT}&select=*`).catch(() => [])) || []) {
    const c = await contactOf(t.user_id);
    const link = mapLink(t.last_lat, t.last_lon);
    await notify(c, `ΜΠΑΤΑΡΙΑ: το κινητό της εφαρμογής (${who(t)}) έχει ${t.battery}% μπαταρία και μπορεί να σβήσει σύντομα, ενώ είναι σε έξοδο με σκάφος${t.route ? ' (' + t.route + ')' : ''}. Επιστροφή δηλωμένη στις ${hm(t.due_at)}.\n` + (link ? `Τελευταία γνωστή θέση (${hm(t.last_at)}): ${link}` : ''), t, true);
    await patch(t.id, { lowbat_sent: true });
    stats.lowbat++;
  }

  // 3γ) Έλεγχος σιωπής: πρώτα ρωτάμε τον ψαρά στο Telegram, μετά την επαφή
  const nowMs = Date.now();
  for (const t of (await sb(`safety_trips?status=eq.active&silence_min=gt.0&silence_sent=eq.false&due_at=gt.${encodeURIComponent(nowIso)}&select=*`).catch(() => [])) || []) {
    const hb = Date.parse(t.hb_at || t.last_at || t.created_at || nowIso);
    const age = Math.round((nowMs - hb) / 60000);
    if (t.ping_at && Date.parse(t.ping_at) < hb) { await patch(t.id, { ping_at: null }); t.ping_at = null; }
    if (!t.ping_at) {
      if (age < t.silence_min) continue;
      const c = await contactOf(t.user_id);
      if (!c || c.self_chat_id == null || !TG) continue;
      try {
        await tg('sendMessage', { chat_id: c.self_chat_id, text: `Είσαι καλά; Δεν έχουμε σήμα από το κινητό σου εδώ και ${age} λεπτά στην έξοδό σου. Πάτα το κουμπί αν όλα πάνε καλά. Αν δεν απαντήσεις σε ${PING_WAIT_MIN} λεπτά, θα ειδοποιηθεί η επαφή ασφαλείας σου.`, reply_markup: { inline_keyboard: [[{ text: '✅ Είμαι καλά', callback_data: 'ok:' + t.id }]] } });
        await patch(t.id, { ping_at: nowIso }); stats.ping++;
      } catch (e) { log('Telegram ping: ' + e.message); }
    } else if (nowMs - Date.parse(t.ping_at) >= PING_WAIT_MIN * 60000) {
      const c = await contactOf(t.user_id);
      const link = mapLink(t.last_lat, t.last_lon);
      await notify(c, `ΕΙΔΟΠΟΙΗΣΗ ΑΣΦΑΛΕΙΑΣ: χάθηκε η επαφή με το κινητό (${who(t)}) εδώ και ${age} λεπτά, σε έξοδο με σκάφος${t.route ? ' (' + t.route + ')' : ''}, και δεν απάντησε στον έλεγχο «είσαι καλά;». Επιστροφή δηλωμένη στις ${hm(t.due_at)}.\n` +
        (link ? `Τελευταία γνωστή θέση (${hm(t.last_at)}): ${link}\n` : 'Δεν υπάρχει καταγεγραμμένη θέση.\n') + 'Δοκίμασε να τον/την καλέσεις. Αν δεν απαντά, κάλεσε το 112. Μπορεί απλώς να είναι εκτός δικτύου.', t, true);
      await patch(t.id, { silence_sent: true }); stats.silence++;
    }
  }

  // 4) Επέκταση ώρας μετά από ειδοποίηση: ξανά σε ετοιμότητα
  for (const t of (await sb(`safety_trips?status=eq.alerted&due_at=gt.${encodeURIComponent(nowIso)}&select=id`)) || [])
    await sb(`safety_trips?id=eq.${encodeURIComponent(t.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'active', alerted_at: null }) });

  // 5) Γύρισε ασφαλής: σε κάθε έξοδο για την οποία η επαφή ενημερώθηκε ότι ξεκίνησε (τελευταίες 6 ώρες), και πάντα μετά από ειδοποίηση
  const doneQ = 'safety_trips?status=eq.done&done_sent=eq.false&select=*&';
  const since = encodeURIComponent(new Date(Date.now() - 6 * 3600e3).toISOString());
  const doneList = (await sb(doneQ + `or=(alerted_at.not.is.null,silence_sent.eq.true,lowbat_sent.eq.true,and(start_sent.eq.true,created_at.gt.${since}))`).catch(() => sb(doneQ + 'alerted_at=not.is.null'))) || [];
  for (const t of doneList) {
    const c = await contactOf(t.user_id);
    await notify(c, doneText(t), t, false);
    await sb(`safety_trips?id=eq.${encodeURIComponent(t.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ done_sent: true }) });
    stats.clear++;
  }
  // 5β) 1.9.19: νέες σημειώσεις λιμανιών/ραμπών → στους διαχειριστές στο Telegram με ✅/❌
  if (TG) {
    try {
      const pend = (await sb('port_notes?status=eq.pending&tg_sent=eq.false&select=*&order=created_at.asc&limit=20')) || [];
      const chats = pend.length ? await adminChats() : [];
      const TAG = { shallow: 'ρηχά', rocks: 'βράχια', swell: 'φουσκοθαλασσιά', slippery: 'γλιστερή ράμπα', fee: 'χρέωση', parking: 'πάρκινγκ', fuel: 'καύσιμα', water: 'νερό', crowded: 'πολύς κόσμος', good: 'καλή ράμπα', night: 'σκοτεινό τη νύχτα', wind: 'εκτεθειμένο στον άνεμο' };
      for (const n of pend) {
        if (!chats.length) break;
        const text = `📝 Νέα σημείωση για ${n.port_name || 'λιμάνι/ράμπα'}\n` + (n.tags && n.tags.length ? 'Ετικέτες: ' + n.tags.map(t => TAG[t] || t).join(', ') + '\n' : '') +
          (n.note ? `«${n.note}»\n` : '') + mapLink(n.lat, n.lon);
        for (const chat of chats) await tg('sendMessage', { chat_id: chat, text, reply_markup: { inline_keyboard: [[{ text: '✅ Έγκριση', callback_data: 'pn:ok:' + n.id }, { text: '❌ Απόρριψη', callback_data: 'pn:no:' + n.id }]] } }).catch(e => log('port note send: ' + e.message));
        await sb(`port_notes?id=eq.${n.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ tg_sent: true }) });
        stats.pnSent = (stats.pnSent || 0) + 1;
      }
    } catch (e) { if (!/relation|does not exist|404/i.test(e.message)) log('port notes: ' + e.message); }
  }

  mark('safety');
  // 6) Πρόγνωση: ειδοποιήσεις push για καλές μέρες ψαρέματος στις τοποθεσίες κάθε χρήστη (έλεγχος κάθε ~3 ώρες)
  if (PF && webpush && late()) skip('fc');
  else if (PF && webpush) {
    const stale = new Date(Date.now() - 3 * 3600e3).toISOString();
    let rows = [];
    const stale1 = new Date(Date.now() - 14 * 60e3).toISOString(); // v31z355: καμπές πίεσης κάθε ~15 λεπτά
    // v31z357: όσοι έχουν ενεργή έξοδο ελέγχονται κι αυτοί κάθε ~15 λεπτά, με ειδοποιήσεις καμπής ανοιχτές
    let tripUsers = [];
    try { tripUsers = [...new Set(((await sb('safety_trips?status=eq.active&select=user_id')) || []).map(x => x.user_id).filter(Boolean))]; } catch (e) { /* χωρίς λίστα εξόδων */ }
    const tripOr = tripUsers.length ? `,and(user_id.in.(${tripUsers.join(',')}),checked_at.lt.${encodeURIComponent(stale1)})` : '';
    try { rows = (await sb(`push_subs?or=(checked_at.is.null,checked_at.lt.${encodeURIComponent(stale)},and(turn.eq.true,checked_at.lt.${encodeURIComponent(stale1)})${tripOr})&select=*`)) || []; }
    catch (e) {
      try { rows = (await sb(`push_subs?or=(checked_at.is.null,checked_at.lt.${encodeURIComponent(stale)})&select=*`)) || []; }
      catch (e2) { log('push_subs: ' + e2.message); }
    }
    for (const r of rows) {
      const upd = o => sb(`push_subs?id=eq.${encodeURIComponent(r.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(o) });
      try {
        // περιοχή ψαρέματος για την πίεση: η θέση της ενεργής εξόδου του χρήστη, αν υπάρχει
        // v31z358: ένας χρήστης με πολλές εγγραφές push (π.χ. παλιά συνδρομή ή δεύτερη συσκευή): ελέγχεται μόνο η πιο πρόσφατη
        // και τα μηνύματα πάνε σε όλες τις συσκευές του, ώστε να μην έρχονται διπλά ή με παλιές τοποθεσίες/γλώσσα
        let targets = [r];
        try { const all = await sb(`push_subs?user_id=eq.${r.user_id}&select=id,sub,updated_at`); if (Array.isArray(all) && all.length) targets = all; } catch (e) { /* μόνο αυτή */ }
        if (targets.length > 1) {
          const prim = targets.slice().sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))[0];
          if (prim && prim.id !== r.id) { await upd({ checked_at: new Date().toISOString() }); stats.dupRow = (stats.dupRow || 0) + 1; continue; }
        }
        // v31z358: γλώσσα ειδοποιήσεων από την εφαρμογή (στήλη lang ή μέσα στις τοποθεσίες)
        const lang = (r.lang === 'en' || ((r.places || []).find(p => p && p.lang) || {}).lang === 'en') ? 'en' : 'el';
        let area = null, onTrip = tripUsers.indexOf(r.user_id) >= 0;
        try { const tr = await sb(`safety_trips?user_id=eq.${r.user_id}&status=eq.active&last_lat=not.is.null&select=last_lat,last_lon&limit=1`); if (tr && tr[0]) { onTrip = true; area = { id: 'trip', name: lang === 'en' ? 'Trip now' : 'Έξοδος τώρα', lat: +tr[0].last_lat, lon: +tr[0].last_lon }; } } catch (e) { /* χωρίς έξοδο */ }
        // v31z539: ώρες ησυχίας 23:00–07:00 (ώρα Κύπρου), εκτός αν ο χρήστης τις έκλεισε ή είναι σε έξοδο. Δεν αλλάζει το checked_at, οπότε στις 07:00 ελέγχεται αμέσως.
        const quietOn = !((r.places || []).find(p => p && p.quiet === 'off'));
        let cyH = new Date().getUTCHours(); try { cyH = +new Date().toLocaleString('en-GB', { timeZone: 'Asia/Nicosia', hour: '2-digit', hour12: false }) % 24; } catch (e) { /* UTC */ }
        // v31z544: πλάνα εξόδου (από την εφαρμογή, μέσα στις τοποθεσίες) · στις ώρες ησυχίας ελέγχονται μόνο αυτά (π.χ. «ώρα να ξεκινήσεις» στις 05:00)
        const plans = ((r.places || []).find(p => p && Array.isArray(p.plans)) || {}).plans || [];
        const quietNow = quietOn && !onTrip && (cyH >= 23 || cyH < 7);
        if (quietNow && !plans.length) { stats.quiet = (stats.quiet || 0) + 1; continue; }
        // v31z357: κατά την έξοδο οι ειδοποιήσεις καμπής/έναρξης ανόδου είναι πάντα ανοιχτές
        const turnOn = r.turn === true || onTrip;
        const up = await prefsOf(r.user_id, r.places);   // 1.14.87: προφίλ και όρια του χρήστη, όπως στην εφαρμογή του
        const res = await PF.checkPlaces({ plans, onlyPlans: quietNow, front: !!(r.places || []).find(p => p && p.front === 'on'), lang, sp: ((r.places || []).find(p => p && p.sp) || {}).sp || null, prof: up.prof, limits: up.limits || undefined, places: r.places || [], threshold: r.threshold || 75, pressure: r.pressure !== false, wind: r.wind || null, turn: turnOn, notified: r.state || {}, area }, F);
        log(`Πρόγνωση ${String(r.id).slice(0, 6)}: καμπή=${r.turn === true ? 'ναι' : 'όχι'}${onTrip ? ' (έξοδος: ναι)' : ''} τοποθεσίες=${(r.places || []).length} περιοχή=${res.area ? res.area.name : '-'} ok=${res.okN} καλές=${res.goodsN} πίεση=${res.pressN} καμπές=${res.turnsN} άνεμος=${res.windsN} μηνύματα=${(res.msgs || []).length}` + (res.errs && res.errs.length ? ' ΣΦΑΛΜΑΤΑ: ' + res.errs.join(' | ').slice(0, 300) : ''));
        let gone = false, sent = 0, failed = 0;
        // v31z542: εβδομαδιαία σύνοψη, Κυριακή 19:00–22:59 (ώρα Κύπρου), μία φορά: έξοδοι, ψάρια (χωρίς λαγοκέφαλους), καλύτερη μέρα, επόμενη καλή μέρα
        try {
          const cyNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Nicosia' })), wd = cyNow.getDay(), hh = cyNow.getHours();
          const dkey = cyNow.getFullYear() + '-' + String(cyNow.getMonth() + 1).padStart(2, '0') + '-' + String(cyNow.getDate()).padStart(2, '0'), wk = 'wk:' + dkey;
          if (wd === 0 && hh >= 19 && hh <= 22 && !(res.notified || {})[wk]) {
            res.notified = res.notified || {}; res.notified[wk] = 1;
            const lo = new Date(cyNow.getTime() - 6 * 864e5), los = lo.getFullYear() + '-' + String(lo.getMonth() + 1).padStart(2, '0') + '-' + String(lo.getDate()).padStart(2, '0');
            const rows = (await sb(`records?select=kind,data&user_id=eq.${r.user_id}&kind=in.(bites,trips)&deleted=eq.false&data->>date=gte.${los}&limit=2000`).catch(() => [])) || [];
            const en = lang === 'en', t = (a, b) => en ? b : a, PEST = /λαγοκ[εέ]φαλ|κουνελ[οό]ψαρ|toadfish|puffer ?fish|lagocephalus|torquigener/i;
            const pest = b => !!b.pest || /^(Lagocephalus|Torquigener|Sphoeroides)\s/.test(b.latin || '') || PEST.test(b.species || '');
            const bs = rows.filter(x => x.kind === 'bites').map(x => x.data || {}).filter(b => !b.miss && !b.gear && !pest(b) && (b.date || '') <= dkey);
            const ps = rows.filter(x => x.kind === 'bites').map(x => x.data || {}).filter(b => pest(b) && (b.date || '') <= dkey).length;
            const trips = rows.filter(x => x.kind === 'trips').length, n = bs.reduce((s, b) => s + Math.max(1, Math.floor(+b.cnt) || 1), 0);
            const byDay = {}; bs.forEach(b => { byDay[b.date] = (byDay[b.date] || 0) + Math.max(1, Math.floor(+b.cnt) || 1); });
            const bd = Object.keys(byDay).sort((a, b) => byDay[b] - byDay[a])[0], sp = {}; bs.forEach(b => { if (b.species) sp[b.species] = (sp[b.species] || 0) + 1; });
            const top = Object.keys(sp).sort((a, b) => sp[b] - sp[a])[0], ng = res.nextGood;
            const DN = en ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['Κυριακή', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο'], dn = s => DN[new Date(s + 'T12:00:00Z').getUTCDay()];
            const pad = x => String(x).padStart(2, '0');
            const parts = [];
            if (trips || n) parts.push(t('Αυτή την εβδομάδα: ', 'This week: ') + trips + t(trips === 1 ? ' έξοδος, ' : ' έξοδοι, ', trips === 1 ? ' trip, ' : ' trips, ') + n + t(n === 1 ? ' ψάρι' : ' ψάρια', n === 1 ? ' fish' : ' fish') + (top ? t(', κυρίως ', ', mostly ') + top : '') + (bd && n > 1 ? t('. Καλύτερη μέρα: ', '. Best day: ') + dn(bd) + ' (' + byDay[bd] + ')' : '') + '.');
            else parts.push(t('Αυτή την εβδομάδα δεν κατέγραψες εξόδους.', 'No trips logged this week.'));
            if (ps) parts.push('🐡 ' + ps + t(ps === 1 ? ' λαγοκέφαλος (δεν μετράει).' : ' λαγοκέφαλοι (δεν μετράνε).', ' toadfish (not counted).'));
            if (ng) parts.push(t('Επόμενη καλή μέρα: ', 'Next good day: ') + dn(ng.date) + ' ' + pad(ng.win.s) + ':00–' + pad((ng.win.e + 1) % 24) + ':00 · ' + ng.place + ' · ' + t('δείκτης ', 'score ') + ng.best + '.');
            res.msgs = (res.msgs || []).concat([{ kind: 'info', key: wk, title: '📅 ' + t('Η εβδομάδα σου', 'Your week'), body: parts.join(' '), full: parts.join('\n'), place: null, t: null }]);
          }
        } catch (e) { log('weekly: ' + e.message); }
        // 1.14.13: Πέμπτη 18:00–21:59 (ώρα Κύπρου), μία φορά: η καλύτερη ευκαιρία του Σαββατοκύριακου στα σημεία σου, με τον δικό σου στόχο
        try {
          const cyNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Nicosia' })), wd = cyNow.getDay(), hh = cyNow.getHours();
          const dkey = cyNow.getFullYear() + '-' + String(cyNow.getMonth() + 1).padStart(2, '0') + '-' + String(cyNow.getDate()).padStart(2, '0'), wk = 'wke:' + dkey;
          if (wd === 4 && hh >= 18 && hh <= 21 && !(res.notified || {})[wk]) {
            res.notified = res.notified || {}; res.notified[wk] = 1;
            const en = lang === 'en', t = (a, b) => en ? b : a, g = res.wkGood, pad = x => String(x).padStart(2, '0');
            const DN = en ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] : ['Κυριακή', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο'];
            const body = g ? t('Καλύτερη ευκαιρία: ', 'Best chance: ') + DN[new Date(g.date + 'T12:00:00Z').getUTCDay()] + ' ' + pad(g.win.s) + ':00–' + pad((g.win.e + 1) % 24) + ':00 · ' + g.place + ' · ' + t('δείκτης ', 'score ') + g.best + '.'
              : t('Αυτό το Σαββατοκύριακο καμία μέρα δεν φτάνει τον στόχο σου στα σημεία σου. Δες την Πρόγνωση για τις καλύτερες ώρες.', 'This weekend no day reaches your target at your spots. See the Forecast for the best hours.');
            res.msgs = (res.msgs || []).concat([{ kind: 'info', key: wk, title: '🎣 ' + t('Το Σαββατοκύριακό σου', 'Your weekend'), body, full: body, place: g ? null : null, t: null }]);
          }
        } catch (e) { log('weekly: ' + e.message); }
        // 1.1.0 / 1.1.2: «Σήμερα / Αύριο στα σημεία σου»: το προηγούμενο βράδυ (19:00–22:59) για αύριο, ή/και το πρωί (07:00–09:59) για σήμερα.
        // Ρύθμιση από την εφαρμογή: places[].morning = 'eve' (προεπιλογή) | 'morn' | 'both' | 'off' (το παλιό 'on' = πρωί).
        try {
          const mv = ((r.places || []).find(p => p && p.morning) || {}).morning || 'eve';
          const mode = mv === 'on' ? 'morn' : mv;
          const cyNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Nicosia' })), hh = cyNow.getHours();
          const dkey = cyNow.getFullYear() + '-' + String(cyNow.getMonth() + 1).padStart(2, '0') + '-' + String(cyNow.getDate()).padStart(2, '0');
          const en = lang === 'en', pad = x => String(x).padStart(2, '0');
          res.notified = res.notified || {};
          const tg = res.todayGood, mk = 'mo:' + dkey;
          if ((mode === 'morn' || mode === 'both') && hh >= 7 && hh <= 9 && tg && tg.date === dkey && tg.win && tg.win.e >= hh && !res.notified[mk]) {
            res.notified[mk] = 1;
            const body = (en ? 'Today at ' : 'Σήμερα στο ') + tg.place + ': ' + pad(Math.max(tg.win.s, hh)) + ':00–' + pad((tg.win.e + 1) % 24) + ':00 · ' + (en ? 'score ' : 'δείκτης ') + tg.best + '.';
            res.msgs = (res.msgs || []).concat([{ kind: 'good', key: mk, title: '🌅 ' + (en ? 'Good fishing today' : 'Καλό ψάρεμα σήμερα'), body, full: body, place: null, t: null }]);
            stats.morning = (stats.morning || 0) + 1;
          }
          const mg = res.tmrGood, ek = mg ? 'ev:' + mg.date : null;
          /* αν ήδη φεύγει η βραδινή υπενθύμιση «Αύριο» για την ίδια τοποθεσία (από παλιότερη «καλή μέρα»), δεν στέλνεται δεύτερο μήνυμα */
          const dup = mg && (res.msgs || []).some(m => m && m.key && String(m.key).indexOf(':eve:' + mg.date) >= 0);
          if ((mode === 'eve' || mode === 'both') && hh >= 19 && hh <= 22 && mg && !res.notified[ek]) {
            res.notified[ek] = 1;
            if (!dup) {
              const body = (en ? 'Tomorrow at ' : 'Αύριο στο ') + mg.place + ': ' + pad(mg.win.s) + ':00–' + pad((mg.win.e + 1) % 24) + ':00 · ' + (en ? 'score ' : 'δείκτης ') + mg.best + '.';
              res.msgs = (res.msgs || []).concat([{ kind: 'good', key: ek, title: '🌙 ' + (en ? 'Good fishing tomorrow' : 'Καλό ψάρεμα αύριο'), body, full: body, place: null, t: mg.date }]);
              stats.evening = (stats.evening || 0) + 1;
            }
          }
        } catch (e) { log('morning: ' + e.message); }
        for (const m of res.msgs || []) {
          const at = new Date().toISOString();
          // v31z358: ίδιο μήνυμα την ίδια μέρα στον ίδιο χρήστη = μία φορά, ακόμα κι αν ο χρήστης έχει πολλές εγγραφές push (π.χ. παλιά συνδρομή)
          const ck = 'c' + m.kind + ':' + hash32(m.title + '|' + m.body) + ':' + at.slice(0, 10);
          const payload = { title: m.title, body: m.body, full: m.full, kind: m.kind, id: ck, tag: 'alk-' + ck, at, place: m.place || null, t: m.t || null };
          // ιστορικό στη βάση (για να φαίνεται στην εφαρμογή ακόμα κι αν δεν φτάσει το push)· αν υπάρχει ήδη, δεν ξαναστέλνεται
          let dup = false;
          try { const ins = await sb('notif_log', { method: 'POST', headers: { Prefer: 'return=representation,resolution=ignore-duplicates' }, body: JSON.stringify({ id: (r.user_id + '|' + ck).slice(0, 250), user_id: r.user_id, at, kind: m.kind, title: m.title, body: m.body, details: m.full, place: m.place || null, t: m.t || null }) }); dup = Array.isArray(ins) && ins.length === 0; }
          catch (e) { if (!stats.nlErr) { log('notif_log: ' + e.message + ' (τρέξε το notif_log.sql)'); stats.nlErr = 1; } }
          if (dup) { stats.dup = (stats.dup || 0) + 1; continue; }
          // στέλνεται σε όλες τις συσκευές του χρήστη μαζί
          for (const q of targets) {
            try { await webpush.sendNotification(q.sub, JSON.stringify(payload), { TTL: 6 * 3600 }); sent++; }
            catch (e) {
              if (e.statusCode === 404 || e.statusCode === 410) { await sb(`push_subs?id=eq.${encodeURIComponent(q.id)}`, { method: 'DELETE' }).catch(() => {}); if (q.id === r.id) gone = true; continue; }
              failed++; if (failed === 1) log('Push: ' + (e.statusCode || '') + ' ' + e.message + ' ' + String(e.body || '').slice(0, 160));
            }
          }
        }
        if (gone) continue;
        stats.fc += sent;
        // η κατάσταση «στάλθηκε» αποθηκεύεται πάντα, ώστε να μην ξαναβγαίνουν τα ίδια σε κάθε έλεγχο
        // v31z544: με πλάνο για σήμερα ξαναελέγχεται σε ~10 λεπτά (για το «ώρα να ξεκινήσεις»), αλλιώς σε ~3 ώρες
        const cyD = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Nicosia' }), planToday = plans.some(p => p && p.date === cyD);
        await upd({ checked_at: new Date(Date.now() - (planToday ? 170 * 60e3 : 0)).toISOString(), state: res.notified });
      } catch (e) { log('Forecast job: ' + e.message); try { await upd({ checked_at: new Date().toISOString() }); } catch (e2) { /* τίποτα */ } }
    }
  }
  mark('fc');
  // 7) Πτώση πίεσης κατά τη διάρκεια έξοδου: push και/ή Telegram στον ίδιο τον ψαρά (ενδεικτικό, από μοντέλο Open-Meteo)
  try {
    const PA_DROP = 3.0, PA_COOL = 3 * 3600e3;
    const act = (await sb('safety_trips?status=eq.active&last_lat=not.is.null&select=*')) || [];
    if (act.length && !('pa_at' in act[0])) log('Πίεση: λείπει η στήλη pa_at (τρέξε το safety-upgrade.sql).');
    else for (const t of act) {
      if (t.pa_at && Date.now() - Date.parse(t.pa_at) < PA_COOL) continue;
      let drop = null, now_ = null;
      try {
        const r = await F(`https://api.open-meteo.com/v1/forecast?latitude=${(+t.last_lat).toFixed(3)}&longitude=${(+t.last_lon).toFixed(3)}&hourly=pressure_msl&past_hours=4&forecast_hours=1&timezone=UTC`);
        const j = await r.json(), ts = (j.hourly && j.hourly.time) || [], ps = (j.hourly && j.hourly.pressure_msl) || [];
        let i = -1; for (let k = 0; k < ts.length; k++) if (Date.parse(ts[k] + 'Z') <= Date.now() && typeof ps[k] === 'number') i = k;
        if (i >= 3 && typeof ps[i - 3] === 'number') { now_ = ps[i]; drop = ps[i] - ps[i - 3]; }
      } catch (e) { log('Πίεση (Open-Meteo): ' + e.message); continue; }
      if (drop == null || drop > -PA_DROP) continue;
      const body = `Η πίεση πέφτει γρήγορα: ${drop.toFixed(1)} hPa σε 3 ώρες (τώρα ${Math.round(now_)} hPa). Συχνά σημαίνει αλλαγή καιρού. Κοίταξε τον ορίζοντα και την πρόγνωση. Ενδεικτικό, από μοντέλο.`;
      const c = await contactOf(t.user_id).catch(() => null);
      let sent = 0;
      if (c && c.self_chat_id != null && TG) { try { await tg('sendMessage', { chat_id: c.self_chat_id, text: '⚠ Alkyon: ' + body }); sent++; } catch (e) { log('Πίεση Telegram: ' + e.message); } }
      if (webpush) {
        const subs = await sb(`push_subs?user_id=eq.${t.user_id}&select=*`).catch(() => []);
        const at = new Date().toISOString(), key = 'trip-pa:' + t.id + ':' + at.slice(0, 13);
        try { await sb('notif_log', { method: 'POST', headers: { Prefer: 'return=minimal,resolution=ignore-duplicates' }, body: JSON.stringify({ id: (t.user_id + '|' + key).slice(0, 250), user_id: t.user_id, at, kind: 'pressure', title: '📉 Πτώση πίεσης στην έξοδο', body, details: body, place: { name: 'Έξοδος', lat: +t.last_lat, lon: +t.last_lon }, t: at }) }); } catch (e) { /* χωρίς ιστορικό */ }
        for (const r of subs || []) { try { await webpush.sendNotification(r.sub, JSON.stringify({ title: '📉 Πτώση πίεσης στην έξοδο', body, full: body, kind: 'pressure', id: key, tag: 'alk-trip-pa-' + at.slice(0, 13), at, place: { name: 'Έξοδος', lat: +t.last_lat, lon: +t.last_lon } }), { TTL: 3600 }); sent++; } catch (e) { if (e.statusCode === 404 || e.statusCode === 410) await sb(`push_subs?id=eq.${encodeURIComponent(r.id)}`, { method: 'DELETE' }).catch(() => {}); } }
      }
      await patch(t.id, { pa_at: new Date().toISOString() });
      if (sent) stats.pa++;
    }
  } catch (e) { log('Πίεση: ' + e.message); }
  mark('press');
  // 7β) Κοινότητα (βλ. commStep πιο πάνω· 1.9.61: καλείται και αμέσως από την εφαρμογή με action 'comm')
  if (late()) skip('comm'); else await commStep();
  mark('comm');

  // 7γ) 1.9.44 (1.9.47: καλύτερη ώρα, μόνο βράδια ±3 μέρες από τη νέα σελήνη): καλαμάρια γύρω από τη νέα σελήνη (μόνο όσοι το άνοιξαν: places[].squid === 'on').
  //   Οκτώβριος–Απρίλιος, 09:00–10:00 Κύπρου, από 3 μέρες πριν έως 2 μέρες μετά τη νέα σελήνη.
  //   Η καλύτερη ώρα κάθε βραδιού (δύση ±90′, άνεμος <8 kn, κύμα ≤0,6 m, PF.squidEves), πρώτο το καλύτερο. Μία ειδοποίηση ανά σελήνη ανά χρήστη (notif_log).
  if (webpush && late()) skip('squid');
  else if (webpush) {
    try {
      const nowD = new Date(), cyHs = +nowD.toLocaleString('en-GB', { timeZone: 'Asia/Nicosia', hour: '2-digit', hour12: false }).slice(0, 2), mon = +nowD.toLocaleString('en-GB', { timeZone: 'Asia/Nicosia', month: 'numeric' });
      const nm = PF.nextMoon(Date.now() - 2 * 86400000); /* η νέα σελήνη που δεν έχει περάσει πάνω από 2 μέρες */
      if (cyHs === 9 && (mon >= 10 || mon <= 4) && nm && nm.nw && nm.nw - Date.now() <= 3 * 86400000) {
        const nmKey = new Date(nm.nw).toISOString().slice(0, 10);
        const subsS = (await sb('push_subs?select=id,user_id,sub,places').catch(() => [])) || [];
        const byU = {}; for (const r of subsS) (byU[r.user_id] = byU[r.user_id] || []).push(r);
        const fcMem = {};
        for (const uid of Object.keys(byU)) {
          const rows = byU[uid]; const pls = rows.flatMap(r => r.places || []); if (!pls.find(p => p && p.squid === 'on')) continue;
          // 1.9.48: όλα τα μέρη του χρήστη (έως 6), όχι μόνο το πρώτο· το καλύτερο βράδυ από όλα, με το όνομα του μέρους
          const seen = {}, plist = [];
          for (const p of pls) { if (!p || typeof p.lat !== 'number' || typeof p.lon !== 'number') continue; const k = (+p.lat).toFixed(2) + ',' + (+p.lon).toFixed(2); if (seen[k]) continue; seen[k] = 1; plist.push({ p, k }); if (plist.length >= 6) break; }
          if (!plist.length) continue;
          const en = !!pls.find(p => p && p.lang === 'en');
          let good = [];
          for (const { p, k } of plist) {
            let fc = fcMem[k]; if (fc === undefined) { try { fc = await PF.getForecast(+p.lat, +p.lon, F, { days: 6, sp: { n: 'Καλαμάρι', l: 'Loligo vulgaris', sst: [14, 24] } }); } catch (e) { log('squid fc: ' + e.message); fc = null; } fcMem[k] = fc; }
            if (!fc || !fc.days) continue;
            good = good.concat(PF.squidEves(fc.days, nm.nw, { now: (fc.nowLocal || '').slice(0, 13) + ':00', lat: +p.lat, lon: +p.lon, tz: fc.tz }).map(g => ({ ...g, name: p.name || '' })));
          }
          if (!good.length) continue;
          good.sort((x, y) => y.score - x.score);
          // ένα βράδυ ανά μέρα στη λίστα (το καλύτερο μέρος εκείνης της μέρας)
          const byDay = {}; good = good.filter(g => byDay[g.date] ? false : (byDay[g.date] = 1));
          const multi = plist.length > 1;
          const pad = (n) => String(n).padStart(2, '0');
          const at_ = (g) => multi && g.name ? (en ? ' at ' : ' στο ') + g.name : '';
          const slot = (g) => PF.dayLabel(g.date) + ' ' + pad(g.hr) + ':00–' + pad((g.hr + 1) % 24) + ':00' + at_(g);
          const b0 = good[0], rest = good.slice(1, 4).map((g) => PF.dayLabel(g.date) + ' ' + pad(g.hr) + ':00' + at_(g));
          const nmTxt = new Date(nm.nw).toLocaleDateString(en ? 'en-GB' : 'el-GR', { timeZone: 'Asia/Nicosia', weekday: 'long', day: 'numeric', month: 'long' });
          const title = en ? '🦑 Squid: new moon ' + nmTxt : '🦑 Καλαμάρια: νέα σελήνη ' + nmTxt;
          const body = (en ? 'Best: ' : 'Καλύτερο: ') + slot(b0) + (en ? ' (score ' : ' (βαθμός ') + b0.score + ')' + (b0.dark && PF.darkTxt ? ' · ' + PF.darkTxt(b0.dark, en) : '') + (rest.length ? (en ? ' · also ' : ' · επίσης ') + rest.join(', ') : '') + (!multi && b0.name ? ' · ' + b0.name : '');
          const at = new Date().toISOString();
          let ins = null; try { ins = await sb('notif_log', { method: 'POST', headers: { Prefer: 'return=representation,resolution=ignore-duplicates' }, body: JSON.stringify({ id: (uid + '|sq:' + nmKey).slice(0, 250), user_id: uid, at, kind: 'good', title, body }) }); } catch (e) { log('squid notif_log: ' + e.message); continue; } /* 1.9.48: χωρίς καταγραφή δεν στέλνουμε (αλλιώς θα ξαναστελνόταν την επόμενη μέρα) */
          if (!Array.isArray(ins) || !ins.length) continue;
          for (const r of rows) {
            try { await webpush.sendNotification(r.sub, JSON.stringify({ title, body, full: body, kind: 'good', id: 'sq:' + nmKey, tag: 'alk-sq-' + nmKey, at }), { TTL: 6 * 3600 }); stats.squid = (stats.squid || 0) + 1; }
            catch (e) { if (e.statusCode === 404 || e.statusCode === 410) await sb(`push_subs?id=eq.${encodeURIComponent(r.id)}`, { method: 'DELETE' }).catch(() => {}); }
          }
        }
      }
    } catch (e) { log('squid: ' + e.message); }
  }

  mark('squid');
  // 8) v31z543: κατά την έξοδο, και με κλειστό κινητό: (α) καιρός που χαλάει τις επόμενες 3 ώρες στη θέση της εξόδου (καταιγίδα, άνεμος/ριπές/κύμα πάνω από τα όριά σου),
  //    (β) «ώρα να γυρίσεις»: απόσταση από το λιμάνι σου και ταχύτητα επιστροφής σε σχέση με τη δύση και την ώρα επιστροφής που δήλωσες. Έλεγχος ανά ~15 λεπτά.
  try {
    if (webpush && await stepDue('trip_wx', 15 * 60e3)) {
      const act = (await sb('safety_trips?status=eq.active&last_lat=not.is.null&select=*')) || [];
      for (const t of act) {
        const subs = (await sb(`push_subs?user_id=eq.${t.user_id}&select=*`).catch(() => [])) || []; if (!subs.length) continue;
        const pl = [].concat(...subs.map(x => x.places || [])), cfg = pl.find(p => p && (p.lim || p.home)) || pl[0] || {};
        const en = cfg.lang === 'en', tx = (a, b) => en ? b : a, L = Object.assign({ wind: 14, gust: 24, wave: 0.9 }, cfg.lim || {});
        const lat = +t.last_lat, lon = +t.last_lon, now = Date.now(), msgs = [];
        const hm = ms => new Date(ms).toLocaleTimeString('en-GB', { timeZone: 'Asia/Nicosia', hour: '2-digit', minute: '2-digit' });
        /* (α) καιρός */
        try {
          const q = `latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&forecast_hours=4&timezone=UTC`;
          const [w, m] = await Promise.all([F(`https://api.open-meteo.com/v1/forecast?${q}&hourly=wind_speed_10m,wind_gusts_10m,weather_code&wind_speed_unit=kn`).then(r => r.json()), F(`https://marine-api.open-meteo.com/v1/marine?${q}&hourly=wave_height`).then(r => r.json()).catch(() => null)]);
          const ts = (w.hourly && w.hourly.time) || [], H = w.hourly || {}, wv = (m && m.hourly && m.hourly.wave_height) || [];
          let storm = null, over = null;
          ts.forEach((tt, i) => { const ms = Date.parse(tt + 'Z'); if (ms < now - 3600e3 || ms > now + 3 * 3600e3) return;
            if (!storm && H.weather_code && H.weather_code[i] >= 95) storm = ms;
            const ws = H.wind_speed_10m && H.wind_speed_10m[i], gs = H.wind_gusts_10m && H.wind_gusts_10m[i], wh = wv[i];
            if (!over && ((ws != null && ws > L.wind) || (gs != null && gs > L.gust) || (wh != null && wh > L.wave))) over = { ms, ws, gs, wh }; });
          if (storm) msgs.push({ k: 'storm:' + new Date(storm).toISOString().slice(0, 13), title: tx('⛈ Πιθανή καταιγίδα', '⛈ Thunderstorm possible'), body: tx('Γύρω στις ', 'Around ') + hm(storm) + tx(' στην περιοχή της εξόδου σου. Κοίταξε τον ουρανό και σκέψου την επιστροφή.', ' near your trip area. Watch the sky and consider heading back.') });
          if (over) msgs.push({ k: 'wx:' + new Date(over.ms).toISOString().slice(0, 10), title: tx('💨 Ο καιρός χαλάει', '💨 Weather is getting worse'), body: tx('Γύρω στις ', 'Around ') + hm(over.ms) + ': ' + [over.ws != null ? tx('άνεμος ', 'wind ') + Math.round(over.ws) + ' kn' : '', over.gs != null && over.gs > L.gust ? tx('ριπές ', 'gusts ') + Math.round(over.gs) + ' kn' : '', over.wh != null && over.wh > L.wave ? tx('κύμα ', 'waves ') + over.wh.toFixed(1) + ' m' : ''].filter(Boolean).join(', ') + tx(' (πάνω από τα όριά σου).', ' (over your limits).'), ms: over.ms });
        } catch (e) { log('Καιρός εξόδου: ' + e.message); }
        /* (β) ώρα να γυρίσεις */
        const hm0 = cfg.home;
        if (hm0 && hm0.lat != null) {
          const R = Math.PI / 180, dx = (hm0.lon - lon) * R * Math.cos((hm0.lat + lat) / 2 * R), dy = (hm0.lat - lat) * R, km = Math.sqrt(dx * dx + dy * dy) * 6371 * 1.1, nm = km / 1.852;
          const kn = +hm0.kn > 2 ? +hm0.kn : 15, eta = nm / kn * 60;
          if (nm >= 0.5) {
            const name = hm0.name || tx('το λιμάνι', 'the port'), due = t.due_at ? Date.parse(t.due_at) : null;
            if (due && due > now && due - now <= (eta + 10) * 60e3) msgs.push({ k: 'due:' + t.due_at, title: tx('🏠 Ώρα να γυρίσεις', '🏠 Time to head back'), body: tx('Για να είσαι πίσω στις ', 'To be back by ') + hm(due) + tx(' που δήλωσες, ξεκίνα τώρα: ~', ' as planned, leave now: ~') + Math.round(eta) + tx('′ για ', ' min to ') + name + ' (' + nm.toFixed(1) + ' nm).' });
            try { if (PF && PF.sunMoon) { const d = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Nicosia' }), tz = Math.round((Date.parse(new Date().toLocaleString('en-US', { timeZone: 'Asia/Nicosia' })) - Date.parse(new Date().toLocaleString('en-US', { timeZone: 'UTC' }))) / 60000);
              const sm = PF.sunMoon(d, lat, lon, tz), set = Date.parse(d + 'T00:00:00Z') - tz * 60e3 + sm.set * 60e3;
              if (set > now && set - now <= (eta + 15) * 60e3) msgs.push({ k: 'sunset:' + d, title: tx('🌅 Η δύση πλησιάζει', '🌅 Sunset is near'), body: tx('Δύση στις ', 'Sunset at ') + hm(set) + tx('. Χρειάζεσαι ~', '. You need ~') + Math.round(eta) + tx('′ για ', ' min to ') + name + ' (' + nm.toFixed(1) + ' nm).' }); } } catch (e) { /* χωρίς δύση */ }
            const wx = msgs.find(x => x.ms); if (wx && wx.ms - now <= (eta + 30) * 60e3) msgs.push({ k: 'back:' + new Date(wx.ms).toISOString().slice(0, 13), title: tx('🏠 Ώρα να γυρίσεις', '🏠 Time to head back'), body: tx('Ο καιρός χαλάει γύρω στις ', 'The weather turns around ') + hm(wx.ms) + tx(' και η επιστροφή θέλει ~', ' and the trip home takes ~') + Math.round(eta) + tx('′ (', ' min (') + nm.toFixed(1) + ' nm).' });
          }
        }
        for (const m of msgs) {
          const at = new Date().toISOString(), key = 'trip-wx:' + t.id + ':' + m.k;
          let ins = null; try { ins = await sb('notif_log', { method: 'POST', headers: { Prefer: 'return=representation,resolution=ignore-duplicates' }, body: JSON.stringify({ id: (t.user_id + '|' + key).slice(0, 250), user_id: t.user_id, at, kind: 'info', title: m.title, body: m.body, details: m.body, place: { name: tx('Έξοδος', 'Trip'), lat, lon }, t: at }) }); } catch (e) { ins = [1]; }
          if (Array.isArray(ins) && !ins.length) continue; /* στάλθηκε ήδη */
          for (const r of subs) { try { await webpush.sendNotification(r.sub, JSON.stringify({ title: m.title, body: m.body, full: m.body, kind: 'info', id: key, tag: 'alk-' + key.slice(-40), at, place: { name: tx('Έξοδος', 'Trip'), lat, lon } }), { TTL: 1800 }); stats.tripwx = (stats.tripwx || 0) + 1; } catch (e) { /* συνδρομή που έληξε: καθαρίζεται στο 6 */ } }
        }
      }
      await stepOk('trip_wx');
    }
  } catch (e) { log('Καιρός εξόδου: ' + e.message); }
  mark('tripwx');
  // 8β) 1.14.21–1.14.23: «Πότε τσιμπάνε» από τον catch_obs (ανώνυμα, με συγκατάθεση).
  //  (α) Συμπλήρωση καιρού (κάθε εκτέλεση, λίγα κελιά) από το ιστορικό του Open-Meteo, ίδια πηγή για όλους:
  //      ψάρι/χαμένο → cond.e (η ώρα του) + cond.d (όλες οι ώρες φωτός της ίδιας μέρας, για σύγκριση)· έξοδος → cond.e (κάθε ώρα της). cond.enr=2.
  //  (β) Συγκεντρωτικά (μία φορά τη μέρα μετά τις 03:00 Κύπρου), δύο μέθοδοι:
  //      1. ΟΛΑ τα ψάρια, σύγκριση με τις ώρες της ίδιας μέρας (cc): πόσο πιο συχνή είναι μια συνθήκη στα ψάρια απ' ό,τι στις ώρες που υπήρχαν.
  //         Αφού ο ψαράς ήταν έξω εκείνη τη μέρα, η επιλογή «βγαίνω με καλό καιρό» δεν αλλοιώνει το αποτέλεσμα. Σελήνη: σύγκριση με ομοιόμορφη κατανομή.
  //      2. Έξοδοι (r): ψάρια ανά ώρα ψαρέματος, μετράνε και οι ώρες χωρίς ψάρι. Για είδος: οι έξοδοι με αυτόν τον στόχο (αν ≥ 10 ώρες).
  //      Ευρήματα (ins) με «both» όταν συμφωνούν και οι δύο, και «τι δούλεψε» (τεχνική, δόλωμα, βάθος) στις καλές συνθήκες.
  //      Κλειδιά bite_stats: 'all', 'sp:<είδος>', 'r:<κελί 2°>'· προσωπικά στον user_bite_stats (μόνο ο ίδιος τα διαβάζει).
  //  (γ) 1.14.23: κάθε απόγευμα (17–19 Κύπρου) ειδοποίηση «🎯 Αύριο … μοιάζει με τις καλύτερες ώρες σου» όταν η πρόγνωση ταιριάζει με τα προσωπικά ευρήματα.
  if (PF && late()) skip('bstats');
  else if (PF) {
    const HR = 3600000, DAY = 86400000, isoD = ms => new Date(ms).toISOString().slice(0, 10), nz = v => (typeof v === 'number' && isFinite(v)) ? v : null;
    const tzOf = lon => Math.round((+lon || 0) / 15) * 60, SMC = {}, SOL = {};
    const sunOf = (ms, la, lo) => { const tz = tzOf(lo), d = isoD(ms + tz * 60000), ck = d + ',' + la + ',' + lo; return { sm: SMC[ck] || (SMC[ck] = PF.sunMoon(d, +la, +lo, tz)), tz, d }; };
    const wxCache = {};
    const wxFor = async (la, lo, d1, d2) => {
      const ck = la + ',' + lo + ',' + d1 + ',' + d2; if (ck in wxCache) return wxCache[ck];
      const t1 = Date.parse(d1 + 'T00:00:00Z'), fut = Date.parse(d2 + 'T00:00:00Z') > Date.now() - DAY, recent = Date.now() - t1 < 85 * DAY;
      const past = Math.max(1, Math.min(92, Math.ceil((Date.now() - t1) / DAY) + 1)), pos = 'latitude=' + la + '&longitude=' + lo + '&timezone=GMT';
      const wv = 'temperature_2m,pressure_msl,wind_speed_10m,wind_gusts_10m,wind_direction_10m,cloud_cover,precipitation';
      const mv = 'wave_height,wave_period,sea_surface_temperature,sea_level_height_msl,ocean_current_velocity';
      const fd = fut ? 3 : 1;
      const wu = recent ? `https://api.open-meteo.com/v1/forecast?${pos}&hourly=${wv}&past_days=${past}&forecast_days=${fd}&wind_speed_unit=kn`
        : `https://archive-api.open-meteo.com/v1/archive?${pos}&hourly=${wv}&start_date=${d1}&end_date=${d2}&wind_speed_unit=kn`;
      const mu = `https://marine-api.open-meteo.com/v1/marine?${pos}&hourly=${mv}` + (recent ? `&past_days=${past}&forecast_days=${fd}` : `&start_date=${d1}&end_date=${d2}`) + '&cell_selection=sea';
      const get = u => F(u).then(r => r.ok ? r.json() : null).catch(() => null);
      const [w, m] = await Promise.all([get(wu), get(mu)]);
      if (!w || !w.hourly || !w.hourly.time) return (wxCache[ck] = null);
      const H = {}, wh = w.hourly, mh = (m && m.hourly) || {}, mi = {};
      (mh.time || []).forEach((t, i) => { mi[t] = i; });
      wh.time.forEach((t, i) => { const k = mi[t], g = (a) => k == null ? null : nz(mh[a] && mh[a][k]);
        H[t] = { wind: nz(wh.wind_speed_10m[i]), gust: nz(wh.wind_gusts_10m && wh.wind_gusts_10m[i]), wdeg: nz(wh.wind_direction_10m && wh.wind_direction_10m[i]), press: nz(wh.pressure_msl[i]), cloud: nz(wh.cloud_cover[i]), rain: nz(wh.precipitation && wh.precipitation[i]), temp: nz(wh.temperature_2m[i]),
          wave: g('wave_height'), per: g('wave_period'), sst: g('sea_surface_temperature'), sl: g('sea_level_height_msl'), cur: g('ocean_current_velocity') }; });
      return (wxCache[ck] = H);
    };
    const key = ms => new Date(Math.round(ms / HR) * HR).toISOString().slice(0, 13) + ':00';
    const feat = (H, ms) => { const t = Math.round(ms / HR) * HR, a = H[key(t)]; if (!a) return null; const b = H[key(t - 3 * HR)], p1 = H[key(t - HR)], n1 = H[key(t + HR)];
      const o = { t, wind: a.wind, gust: a.gust, wdeg: a.wdeg, press: a.press, cloud: a.cloud, rain: a.rain, temp: a.temp, wave: a.wave, per: a.per, sst: a.sst, cur: a.cur };
      if (a.press != null && b && b.press != null) o.pt = Math.round((a.press - b.press) * 10) / 10;
      if (p1 && n1 && p1.sl != null && n1.sl != null) o.tide = Math.round((n1.sl - p1.sl) * 100) / 100;
      // 1.14.25: νερό που ζεσταίνει/κρυώνει (3 μέρες) και θάλασσα τις 2 προηγούμενες μέρες (θολούρα από κύμα: εκτίμηση διαύγειας)
      const s72 = H[key(t - 72 * HR)]; if (a.sst != null && s72 && s72.sst != null) o.sstd = Math.round((a.sst - s72.sst) * 10) / 10;
      let wmx = null; for (let q = 1; q <= 48; q++) { const x = H[key(t - q * HR)]; if (x && x.wave != null && (wmx == null || x.wave > wmx)) wmx = x.wave; } if (wmx != null) o.wv48 = wmx;
      for (const k of Object.keys(o)) if (o[k] == null) delete o[k]; else if (k !== 't' && k !== 'tide' && k !== 'pt' && k !== 'sstd') o[k] = Math.round(o[k] * 10) / 10;
      return o; };
    // ώρες φωτός (ανατολή −1 h … δύση +1 h) της τοπικής μέρας μιας στιγμής
    // 1.14.26: σύγκριση με τις ώρες που θα μπορούσε να πιαστεί: τσίμπημα τη μέρα → ώρες φωτός· τσίμπημα βράδυ/νύχτα → από 2 ώρες πριν τη δύση ως την ανατολή
    const nightHours = (ms, la, lo) => { const { sm, tz, d } = sunOf(ms, la, lo); if (!sm || sm.rise == null) return []; const d0 = Date.parse(d + 'T00:00:00Z') - tz * 60000, m = (ms + tz * 60000) % DAY / 60000, out = [];
      let a, b; if (m < sm.rise + 60) { const p = sunOf(ms - DAY, la, lo).sm; a = d0 - DAY + ((p && p.set != null ? p.set : sm.set) - 120) * 60000; b = d0 + sm.rise * 60000; } else { const nx = sunOf(ms + DAY, la, lo).sm; a = d0 + (sm.set - 120) * 60000; b = d0 + DAY + ((nx && nx.rise != null ? nx.rise : sm.rise)) * 60000; }
      for (let t = Math.ceil(a / HR) * HR; t <= b; t += HR) out.push(t); return out; };
    const ctlHours = (ms, la, lo) => { const { sm, tz } = sunOf(ms, la, lo); if (!sm || sm.rise == null) return []; const m = (ms + tz * 60000) % DAY / 60000; return (m >= sm.rise - 60 && m <= sm.set - 120) ? dayHours(ms, la, lo) : nightHours(ms, la, lo); };
    const thermoOf = P => { if (!P || P.length < 3) return null; let best = null; const gr = i => (P[i].t - P[i + 1].t) / Math.max(0.5, P[i + 1].d - P[i].d);
      for (let i = 0; i < P.length - 1; i++) { const g = gr(i); if (!best || g > best.g) best = { g, i }; }
      if (!best || best.g < 0.05 || P[0].t - P[P.length - 1].t < 1) return null; let a = best.i; while (a > 0 && gr(a - 1) >= best.g * 0.5) a--; return { top: P[a].d }; };
    const dayHours = (ms, la, lo) => { const { sm, tz, d } = sunOf(ms, la, lo); if (!sm || sm.rise == null) return []; const d0 = Date.parse(d + 'T00:00:00Z') - tz * 60000, out = [];
      for (let m = Math.ceil((sm.rise - 60) / 60) * 60; m <= sm.set + 60; m += 60) out.push(d0 + m * 60000); return out; };
    /* 26/11/2026: όριο χρόνου μέσα στη συμπλήρωση (καιρός, χλωροφύλλη, θερμοκλινές): νέα εγγραφή ξεκινά μόνο ως το μισό του προϋπολογισμού·
       οι υπόλοιπες μένουν για την επόμενη εκτέλεση. Μέρα χωρίς δορυφορική τιμή/προφίλ ακόμα: νέα προσπάθεια το νωρίτερο σε 3 ώρες
       (cond.cht / cond.tht = πότε δοκιμάστηκε), όχι σε κάθε εκτέλεση των 5′. */
    const enrLate = () => Date.now() - T0 > budgetMs * 0.5, RETRY = 3 * HR;
    const patchCond = (id, cond) => sb(`catch_obs?id=eq.${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ cond }) });
    try {
      const todo = (await sb(`catch_obs?select=id,kind,day,ms,ms2,lat,lon,cond&cond->>enr=is.null&ms=lt.${Date.now() - 2 * HR}&lat=not.is.null&order=id.asc&limit=60`)) || [];
      let cells = 0, done = 0;
      for (const r of todo) {
        if (enrLate()) { skip('benr'); break; }
        if (r.kind === 'trip' && !(r.ms2 && r.ms2 < Date.now() - HR)) continue;
        const t0 = +r.ms - 80 * HR, t1 = (r.kind === 'trip' ? +r.ms2 : +r.ms) + 30 * HR;
        const ck = r.lat + ',' + r.lon + ',' + isoD(t0) + ',' + isoD(t1); if (!(ck in wxCache)) { if (cells >= 10) continue; cells++; }
        const H = await wxFor(+r.lat, +r.lon, isoD(t0), isoD(t1));
        const cond = Object.assign({}, r.cond || {}); delete cond.e; delete cond.d;
        if (!H) cond.enr = -1;
        else if (r.kind === 'trip') { const hs = []; for (let t = Math.ceil(+r.ms / HR) * HR; t <= +r.ms2 && hs.length < 24; t += HR) { const f = feat(H, t); if (f) hs.push(f); }
          if (!hs.length) { const f = feat(H, (+r.ms + +r.ms2) / 2); if (f) hs.push(f); } cond.e = hs; cond.enr = hs.length ? 2 : -1; }
        else { const f = feat(H, +r.ms); if (f) { cond.e = f; cond.d = ctlHours(+r.ms, r.lat, r.lon).map(t => feat(H, t)).filter(Boolean); } cond.enr = f ? 2 : -1; }
        await sb(`catch_obs?id=eq.${r.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ cond }) });
        done++;
      }
      if (done) stats.benr = done;
    } catch (e) { log('bite stats: enrich ' + e.message); }
    // 1.14.29: χλωροφύλλη (Copernicus Μεσογείου, δορυφόρος L4 χωρίς κενά από σύννεφα) τη μέρα του ψαριού/της εξόδου → f.chl σε κάθε ώρα (cond.chv = 1 όταν ελέγχθηκε)
    try {
      const todoC = (await sb(`catch_obs?select=id,day,lat,lon,cond&cond->>enr=eq.2&and=(or(cond->>chv.is.null,cond->>chv.eq.1),or(cond->>cht.is.null,cond->>cht.lt.${Date.now() - RETRY}))&lat=gt.30&lat=lt.46.5&lon=gt.-6&lon=lt.37&order=id.asc&limit=12`)) || [];
      if (todoC.length) {
        const lr = await F(env.SUPABASE_URL + '/functions/v1/water-clarity?mode=layers').then(r => r.ok ? r.json() : null).catch(() => null), L = lr && lr.chl && lr.chl.layer;
        // παλιότερες μέρες: το αρχείο (MY L4) του ίδιου δορυφορικού προϊόντος· το NRT κρατά μόνο τους τελευταίους μήνες
        let LMY = null; const myLayer = async () => { if (LMY !== null) return LMY; LMY = ''; try { const r = await F('https://wmts.marine.copernicus.eu/teroWmts/OCEANCOLOUR_MED_BGC_L4_MY_009_144?service=WMTS&version=1.0.0&request=GetCapabilities'); if (r.ok) { const ids = [...(await r.text()).matchAll(/<(?:[\w-]+:)?Identifier[^>]*>\s*([^<]+?\/CHL)\s*<\//gi)].map(m => m[1]).filter(x => /P1D/i.test(x)); LMY = ids.sort((a, b) => (/gapfree/i.test(b) ? 1 : 0) - (/gapfree/i.test(a) ? 1 : 0))[0] || ''; } } catch (e) { } return LMY; };
        if (L) {
          const tile = (la, lo) => { const n = 1024, x = (lo + 180) / 360 * n, sn = Math.sin(la * Math.PI / 180), y = (0.5 - Math.log((1 + sn) / (1 - sn)) / (4 * Math.PI)) * n, col = Math.floor(x), row = Math.floor(y); return { col, row, i: Math.min(255, Math.floor((x - col) * 256)), j: Math.min(255, Math.floor((y - row) * 256)) }; };
          const num = o => { const fs = o && Array.isArray(o.features) ? o.features : []; for (const f of fs) { const v = f && f.properties && f.properties.value; const n = Array.isArray(v) ? v.find(x => typeof x === 'number') : v; if (typeof n === 'number' && isFinite(n) && n > 0 && n < 50) return n; } return null; };
          const one = async (la, lo, day, ly) => { const t = tile(la, lo); try { const r = await F('https://wmts.marine.copernicus.eu/teroWmts/?service=WMTS&version=1.0.0&request=GetFeatureInfo&layer=' + encodeURIComponent(ly || L) + '&tilematrixset=EPSG:3857&tilematrix=10&tilerow=' + t.row + '&tilecol=' + t.col + '&i=' + t.i + '&j=' + t.j + '&INFOFORMAT=application/json&time=' + day + 'T00:00:00.000Z'); return r.ok ? num(await r.json()) : null; } catch (e) { return null; } };
          let nC = 0;
          for (const r of todoC) {
            if (enrLate()) { skip('bchl'); break; }
            const la = +r.lat, lo = +r.lon, day = r.day; if (!day) continue; const d = 0.04, dl = d / Math.cos(la * Math.PI / 180);
            const pts = [[la, lo], [la + d, lo], [la - d, lo], [la, lo + dl], [la, lo - dl], [la + d, lo + dl], [la - d, lo - dl], [la + d, lo - dl], [la - d, lo + dl]];
            let v = (await Promise.all(pts.map(p => one(p[0], p[1], day)))).filter(x => x != null);
            if (!v.length) { const my = await myLayer(); if (my) v = (await Promise.all(pts.map(p => one(p[0], p[1], day, my)))).filter(x => x != null); }
            if (!v.length) { const pts2 = pts.slice(1).map(p => [la + (p[0] - la) * 2.2, lo + (p[1] - lo) * 2.2]); v = (await Promise.all(pts2.map(p => one(p[0], p[1], day)))).filter(x => x != null); }   // κοντά στην ακτή: ~9 km γύρω
            v.sort((a, b) => a - b); const chl = v.length ? Math.round(v[v.length >> 1] * 1000) / 1000 : null;
            if (chl == null && day >= isoD(Date.now() - 4 * DAY)) { await patchCond(r.id, Object.assign({}, r.cond || {}, { cht: Date.now() })); continue; }   // ο δορυφόρος βγάζει τη μέρα με 1–3 μέρες καθυστέρηση: ξαναδοκιμάζει σε 3 ώρες
            const cond = Object.assign({}, r.cond || {}); delete cond.cht; cond.chv = 2; if (chl != null) { cond.chl = chl; const put = o => { if (Array.isArray(o)) o.forEach(x => { if (x) x.chl = chl; }); else if (o) o.chl = chl; }; put(cond.e); put(cond.d); }
            await sb(`catch_obs?id=eq.${r.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ cond }) }); nC++; }
          if (nC) stats.bchl = nC;
        }
      }
    } catch (e) { log('bite stats: chl ' + e.message); }
    // 1.14.30: θερμοκλινές τη μέρα του ψαριού (μοντέλο Copernicus Μεσογείου, μέσω water-clarity ?mode=profile&day=) → f.thd σε κάθε ώρα: 0 = ανακατεμένο νερό, αλλιώς βάθος (m) που αρχίζει
    try {
      const todoT = (await sb(`catch_obs?select=id,day,lat,lon,cond&cond->>enr=eq.2&cond->>thv=is.null&or=(cond->>tht.is.null,cond->>tht.lt.${Date.now() - RETRY})&lat=gt.30&lat=lt.46.5&lon=gt.-6&lon=lt.37&order=id.asc&limit=6`)) || [];
      let nT = 0;
      for (const r of todoT) {
        if (enrLate()) { skip('bthd'); break; }
        if (!r.day) continue; let v = null;
        try { const q = await F(env.SUPABASE_URL + '/functions/v1/water-clarity?mode=profile&lat=' + (+r.lat).toFixed(2) + '&lon=' + (+r.lon).toFixed(2) + '&day=' + r.day); v = await q.json().catch(() => null); } catch (e) { v = null; }
        const P = v && Array.isArray(v.prof) ? v.prof.filter(x => typeof x.d === 'number' && typeof x.t === 'number').sort((a, b) => a.d - b.d) : null;
        if (!v || ((!P || P.length < 3) && r.day >= isoD(Date.now() - 4 * DAY))) { await patchCond(r.id, Object.assign({}, r.cond || {}, { tht: Date.now() })); continue; }   // χωρίς απάντηση ή πολύ πρόσφατη μέρα: ξανά σε 3 ώρες
        const cond = Object.assign({}, r.cond || {}); delete cond.tht; cond.thv = 1;
        if (P && P.length >= 3) { const th = thermoOf(P), thd = th ? th.top : 0; cond.thd = thd; const put = o => { if (Array.isArray(o)) o.forEach(x => { if (x) x.thd = thd; }); else if (o) o.thd = thd; }; put(cond.e); put(cond.d); }
        await sb(`catch_obs?id=eq.${r.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ cond }) }); nT++; }
      if (nT) stats.bthd = nT;
    } catch (e) { log('bite stats: thermo ' + e.message); }

    // συνθήκες → κουτάκια (ίδια σειρά με τις ετικέτες στο v4/contrib.js)
    const sunBin = (ms, la, lo) => { const { sm, tz } = sunOf(ms, la, lo); const m = (ms + tz * 60000) % DAY / 60000;
      if (!sm || sm.rise == null) return null; if (m < sm.rise - 60 || m > sm.set + 60) return 0; if (m < sm.rise + 90) return 1; if (m > sm.set - 90) return 5; const mid = (sm.rise + sm.set) / 2; return m < mid - 120 ? 2 : m <= mid + 120 ? 3 : 4; };
    const solBin = (ms, la, lo) => { const d = isoD(ms), ck = d + ',' + la + ',' + lo; const ps = SOL[ck] || (SOL[ck] = PF.solunarPeriods(Date.parse(d + 'T00:00:00Z') - 6 * HR, Date.parse(d + 'T00:00:00Z') + 30 * HR, +la, +lo));
      const p = ps.find(x => ms >= x.s && ms <= x.e && x.kind === 'major') || ps.find(x => ms >= x.s && ms <= x.e); return p ? (p.kind === 'major' ? 0 : 1) : 2; };
    const FX = {
      sun: (f, ms, la, lo) => sunBin(ms, la, lo), moon: (f, ms) => Math.round(PF.moonPhase(ms).f * 8) % 8, sol: (f, ms, la, lo) => solBin(ms, la, lo),
      pt: f => f.pt == null ? null : f.pt <= -0.7 ? 0 : f.pt >= 0.7 ? 2 : 1,
      pl: f => f.press == null ? null : f.press < 1010 ? 0 : f.press < 1015 ? 1 : f.press < 1020 ? 2 : 3,
      wind: f => f.wind == null ? null : f.wind < 5 ? 0 : f.wind < 10 ? 1 : f.wind < 15 ? 2 : 3,
      wave: f => f.wave == null ? null : f.wave < 0.3 ? 0 : f.wave < 0.6 ? 1 : f.wave < 1 ? 2 : 3,
      tide: f => f.tide == null ? null : f.tide >= 0.02 ? 0 : f.tide <= -0.02 ? 1 : 2,
      cloud: f => f.cloud == null ? null : f.cloud < 25 ? 0 : f.cloud < 75 ? 1 : 2,
      rain: f => f.rain == null ? null : f.rain >= 0.2 ? 1 : 0,
      cur: f => f.cur == null ? null : f.cur < 0.4 ? 0 : f.cur < 1 ? 1 : 2,
      sstd: f => f.sstd == null ? null : f.sstd <= -0.5 ? 0 : f.sstd >= 0.5 ? 2 : 1,
      // 1.14.26: πραγματικό σκοτάδι = φάση σελήνης × πόσο ψηλά είναι × νέφωση (0 μέρα, 1 πολύ σκοτεινά, 2 μισοσκόταδο, 3 φεγγαρόφωτο)
      dark: (f, ms, la, lo) => { const sb = sunBin(ms, la, lo); if (sb == null) return null; if (sb >= 2 && sb <= 4) return 0; const al = PF.moonAlt(ms, +la, +lo), il = PF.moonPhase(ms).illum;
        const L = il * Math.max(0, Math.sin(al * Math.PI / 180)) * (1 - 0.8 * Math.min(100, Math.max(0, f.cloud == null ? 30 : f.cloud)) / 100); return L < 0.05 ? 1 : L < 0.25 ? 2 : 3; },
      // ώρες μετά τη δύση (0 μέρα, 1 0–1 h, 2 1–3 h, 3 3–6 h, 4 αργά τη νύχτα, 5 πριν την αυγή)
      aft: (f, ms, la, lo) => { const { sm, tz } = sunOf(ms, la, lo); if (!sm || sm.rise == null) return null; const m = (ms + tz * 60000) % DAY / 60000;
        if (m >= sm.rise && m < sm.set) return 0; if (m < sm.rise && m >= sm.rise - 90) return 5; const after = m >= sm.set ? m - sm.set : m + 1440 - sm.set; return after < 60 ? 1 : after < 180 ? 2 : after < 360 ? 3 : 4; },
      season: (f, ms) => { const mo = new Date(ms).getUTCMonth(); return mo === 11 || mo <= 1 ? 0 : mo <= 4 ? 1 : mo <= 7 ? 2 : 3; },
      sstb: f => f.sst == null ? null : f.sst < 16 ? 0 : f.sst < 19 ? 1 : f.sst < 22 ? 2 : f.sst < 25 ? 3 : 4,
      wv48: f => f.wv48 == null ? null : f.wv48 < 0.5 ? 0 : f.wv48 < 1.2 ? 1 : 2,
      // 1.14.29: χλωροφύλλη (mg/m³): πολύ καθαρό νερό … θολό/πλούσιο
      thc: f => f.thd == null ? null : f.thd === 0 ? 0 : f.thd < 20 ? 1 : f.thd < 50 ? 2 : 3,
      chl: f => f.chl == null ? null : f.chl < 0.04 ? 0 : f.chl < 0.07 ? 1 : f.chl < 0.12 ? 2 : 3,
    };
    const NB = { sun: 6, moon: 8, sol: 3, pt: 3, pl: 4, wind: 4, wave: 4, tide: 3, cloud: 3, rain: 2, cur: 3, sstd: 3, wv48: 3, dark: 4, aft: 6, season: 4, sstb: 5, chl: 4, thc: 4 };
    const DAYLEVEL = new Set(['season', 'sstb', 'chl', 'thc']);   // ίδιο όλη τη μέρα: μόνο από τις εξόδους, όχι σύγκριση ίδιας μέρας
    const bins = (f, ms, la, lo) => { const o = {}; for (const k of Object.keys(FX)) { const b = FX[k](f || {}, ms, la, lo); if (b != null) o[k] = b; } return o; };
    const depB = v => v == null ? null : v < 10 ? '0–10 m' : v < 30 ? '10–30 m' : v < 60 ? '30–60 m' : v < 100 ? '60–100 m' : '100+ m';
    const arr = n => Array(n).fill(0);
    // ένα «σύνολο» ψαριών (όλοι / είδος / περιοχή / ένας χρήστης) → data
    const analyse = (catches, trips, minCase, excl) => { const EX = new Set(excl || []);
      const c = {}, ctl = {}, fish = {}, eff = {}, worked = {};
      for (const k of Object.keys(NB)) { c[k] = arr(NB[k]); ctl[k] = arr(NB[k]); fish[k] = arr(NB[k]); eff[k] = arr(NB[k]); }
      const tripsBy = {}; for (const t of trips) (tripsBy[t.user_id] = tripsBy[t.user_id] || []).push(t);
      for (const t of trips) for (const f of t.cond.e) { const bb = bins(f, f.t, t.lat, t.lon); for (const k in bb) eff[k][bb[k]] += 1; }
      let n = 0; const users = new Set();
      // 1.14.25: κάθε τσίμπημα μετράει ως «γεγονός»: 30 γόπες μαζί ≈ 6, όχι 30 (1 + log2 του πλήθους)
      const ev = r => 1 + Math.log2(Math.max(1, Math.min(64, r.cnt || 1)));
      // δίκαιο βάρος: με ≥ 3 ψαράδες κανείς δεν ξεπερνά το 25% του συνόλου
      const uT = {}; let tot = 0; for (const r of catches) { const v = ev(r); uT[r.user_id] = (uT[r.user_id] || 0) + v; tot += v; }
      const nu = Object.keys(uT).length, uf = {}; for (const u in uT) uf[u] = nu >= 3 ? Math.min(1, 0.25 * tot / uT[u]) : 1;
      for (const r of catches) {
        const w = ev(r) * uf[r.user_id], e = r.cond && r.cond.e && !Array.isArray(r.cond.e) ? r.cond.e : null, bb = bins(e, +r.ms, r.lat, r.lon);
        n += Math.max(1, Math.min(999, r.cnt || 1)); users.add(r.user_id);
        const inTrip = (tripsBy[r.user_id] || []).some(t => +r.ms >= +t.ms - 15 * 60000 && +r.ms <= +t.ms2 + 15 * 60000);
        for (const f in bb) { c[f][bb[f]] += w; if (inTrip) fish[f][bb[f]] += w;
          const wk = (worked[f + ':' + bb[f]] = worked[f + ':' + bb[f]] || { tech: {}, bait: {}, dep: {}, lure: {} });
          const lc = r.cond && r.cond.lc, lw = r.cond && r.cond.lw; if (lc || lw) { const lk = [lc, lw != null ? lw : ''].filter(x => x !== '' && x != null).join(' '); wk.lure[lk] = (wk.lure[lk] || 0) + w; }
          if (r.tech) wk.tech[r.tech] = (wk.tech[r.tech] || 0) + w; const bt = r.cond && r.cond.bait; if (bt) wk.bait[bt] = (wk.bait[bt] || 0) + w; const db = depB(r.cond && r.cond.depth); if (db) wk.dep[db] = (wk.dep[db] || 0) + w; }
        // σύγκριση ίδιας μέρας: οι ώρες φωτός εκείνης της μέρας, με βάρος ώστε κάθε ψάρι να μετράει όσο ένα
        const dd = (r.cond && Array.isArray(r.cond.d)) ? r.cond.d : [];
        if (dd.length >= 3) { const cb = {}; for (const f of dd) { const b2 = bins(f, f.t, r.lat, r.lon); for (const k in b2) if (k !== 'moon') (cb[k] = cb[k] || arr(NB[k]))[b2[k]] += 1; }
          for (const k in cb) { const s = cb[k].reduce((a, b) => a + b, 0); if (s) cb[k].forEach((v, i) => { ctl[k][i] += w * v / s; }); } }
      }
      { const W = Object.keys(uT).reduce((a, u) => a + uT[u] * uf[u], 0); ctl.moon = arr(8).map(() => W / 8); }   // η σελήνη: κάθε φάση διαρκεί περίπου το ίδιο
      const data = { v: 3, f: {}, ins: [] }, cand = {};
      for (const f of Object.keys(NB)) { if (EX.has(f)) continue;
        const C = c[f].reduce((a, b) => a + b, 0), CT = ctl[f].reduce((a, b) => a + b, 0), E = eff[f].reduce((a, b) => a + b, 0), FS = fish[f].reduce((a, b) => a + b, 0), base = E > 0 ? FS / E : 0;
        const cc = !DAYLEVEL.has(f) && CT >= 5 ? c[f].map((v, i) => { const sh = ctl[f][i] / CT; return sh >= 0.03 && C ? Math.round((v / C) / sh * 100) / 100 : null; }) : null;
        const r = E >= 10 && FS >= 3 ? eff[f].map((e, i) => e >= 4 ? Math.round(fish[f][i] / e * 100) / 100 : null) : null;
        if (!C && !E) continue;
        data.f[f] = { c: c[f], e: eff[f].map(x => Math.round(x)), r, cc };
        // συνδυασμένο «πόσο πιο συχνά» ανά κουτάκι (για τον δανεισμό είδος ← ομάδα)
        data.f[f].l = c[f].map((v, i) => { const a = cc && cc[i] != null ? cc[i] : null, b = r && base > 0 && r[i] != null && eff[f][i] >= 4 ? r[i] / base : null; return a != null && b != null ? Math.sqrt(Math.max(0.01, a) * Math.max(0.01, b)) : a != null ? a : b; });
        if (cc) cc.forEach((l, i) => { if (l != null && c[f][i] >= minCase && (l >= 1.3 || l <= 0.7)) cand[f + ':' + i] = { f, b: i, lift: l, n: c[f][i], src: 'cc' }; });
        if (r && FS >= 5 && base > 0) eff[f].forEach((e, i) => { if (e >= 8 && fish[f] && fish[f][i] >= 5) { const l = fish[f][i] / e / base; if (l >= 1.25 || l <= 0.75) { const k = f + ':' + i, o = cand[k];
          if (o && (o.lift >= 1) === (l >= 1)) { o.lift = Math.sqrt(o.lift * l); o.src = 'both'; o.h = Math.round(e); } else if (!o) cand[k] = { f, b: i, lift: l, n: fish[f][i], h: Math.round(e), src: 'trip' }; } } });
      }
      const top = o => Object.entries(o).filter(x => x[1] >= 3).sort((a, b) => b[1] - a[1]).slice(0, 2).map(x => x[0]);
      data.wk = worked;
      data.ins = Object.values(cand).map(x => { x.lift = Math.round(x.lift * 100) / 100; if (x.lift > 1) { const wk = worked[x.f + ':' + x.b]; if (wk) { const w2 = { tech: top(wk.tech), bait: top(wk.bait), dep: top(wk.dep), lure: top(wk.lure) }; if (w2.tech.length || w2.bait.length || w2.dep.length || w2.lure.length) x.w = w2; } } return x; })
        .sort((a, b) => (b.src === 'both') - (a.src === 'both') || Math.abs(Math.log(b.lift)) - Math.abs(Math.log(a.lift))).slice(0, 6);
      data.hrs = Math.round(eff.sun.reduce((a, b) => a + b, 0));
      data.sun = c.sun; data.moon = c.moon; data.pt = c.pt; data.wind = c.wind;   // συμβατότητα με την 1.14.21
      return { n, users: users.size, data };
    };
    // 1.14.26: «δανεισμός» είδος ← ομάδα: με λίγα στοιχεία το είδος παίρνει τα ευρήματα της ομάδας του· όσο μαζεύονται, μετράει το ίδιο (K = 30 τσιμπήματα)
    const blend = (A, P, minCase) => { const K = 30, d = A.data, pd = P && P.data; if (!pd || !pd.f) { delete d.wk; return A; } const cand = [], top = o => Object.entries(o || {}).filter(x => x[1] >= 2).sort((a, b) => b[1] - a[1]).slice(0, 2).map(x => x[0]);
      for (const f of Object.keys(NB)) { const a = d.f[f], p = pd.f[f]; if (!a && !p) continue; const nb = NB[f];
        for (let i = 0; i < nb; i++) { const ns = a ? a.c[i] || 0 : 0, ls = a && a.l ? a.l[i] : null, lp = p && p.l ? p.l[i] : null; if (ls == null && lp == null) continue;
          const lg = ((ls != null ? ns * Math.log(Math.max(0.05, ls)) : 0) + (lp != null ? K * Math.log(Math.max(0.05, lp)) : 0)) / ((ls != null ? ns : 0) + (lp != null ? K : 0)), l = Math.exp(lg);
          if ((l >= 1.3 || l <= 0.7) && (ns >= minCase || (lp != null && p.c[i] >= 8))) { const x = { f, b: i, lift: Math.round(l * 100) / 100, n: Math.round(ns), src: ns >= 15 && ls != null && (ls >= 1) === (l >= 1) ? 'both' : 'blend' };
            if (l > 1) { const wk = d.wk && d.wk[f + ':' + i]; if (wk) { const w2 = { tech: top(wk.tech), bait: top(wk.bait), dep: top(wk.dep), lure: top(wk.lure) }; if (w2.tech.length || w2.bait.length || w2.dep.length || w2.lure.length) x.w = w2; } } cand.push(x); } } }
      d.ins = cand.sort((a, b) => b.n - a.n || Math.abs(Math.log(b.lift)) - Math.abs(Math.log(a.lift))).slice(0, 6); d.blend = true; delete d.wk; return A; };
    // 1.14.25: έλεγχος ότι η μάθηση βοηθάει. Οι έξοδοι χωρίζονται σε 4 ομάδες ανά μέρα· για κάθε ομάδα τα ευρήματα βγαίνουν ΧΩΡΙΣ αυτήν
    // και ελέγχεται αν ο δείκτης με τη διόρθωση ξεχωρίζει καλύτερα τις εξόδους με ψάρια (ψάρια ανά ώρα) από τον απλό δείκτη (AUC).
    // Αν δεν βοηθά, η διόρθωση απενεργοποιείται (learnOff). Χρειάζονται ≥ 8 έξοδοι με διαφορετικό αποτέλεσμα.
    // 1.14.87 (P1.3a): το f.rain των καταγεγραμμένων ωρών είναι βροχή σε mm/ώρα. Περνά ΜΟΝΟ ως mm (το θέλει η μάθηση, κλάση «βροχή ≥ 0,2 mm»)·
    // ΔΕΝ περνά πια και στο πεδίο rain, που για τον βαθμό σημαίνει πιθανότητα βροχής σε % (όρος −2 από 70% και πάνω). Πιθανότητα εκ των υστέρων δεν υπάρχει.
    const fcHour = (f, la, lo, prof) => { const tz = tzOf(lo), hr = Math.floor(((f.t + tz * 60000) % DAY) / HR);
      return { hr, chl: f.chl, thd: f.thd, wind: f.wind, gust: f.gust, wave: f.wave, pres: f.press, mm: f.rain, clp: f.cloud, mal: PF.moonAlt(f.t, +la, +lo), temp: f.temp, sst: f.sst, prof: prof || 'boat', t: new Date(f.t + tz * 60000).toISOString().slice(0, 16),
        ptrend: f.pt == null ? 'stable' : f.pt <= -3 ? 'fast' : f.pt <= -1 ? 'slow' : f.pt >= 1 ? 'rise' : 'stable',
        tide: f.tide == null ? null : f.tide > 0.01 ? 'up' : f.tide < -0.01 ? 'down' : 'slack', cloud: f.cloud == null ? 'part' : f.cloud < 20 ? 'clear' : f.cloud < 70 ? 'part' : 'over' }; };
    // 1.14.28: ο δείκτης «ξαναζυγίζεται» από τα στοιχεία (Poisson με ridge): κάθε ώρα εξόδου → πόσα τσιμπήματα είχε, ανά συνθήκη.
    // Ενεργοποιείται μόνο με ≥ 200 εξόδους ΚΑΙ αν στον έλεγχο (4 ομάδες ανά μέρα) ξεχωρίζει καλύτερα τις καλές εξόδους από τον σημερινό δείκτη.
    const FIT_MIN = 200;
    const fitPoisson = (catches, trips, ex) => {
      const EXs = new Set(ex || []), feats = Object.keys(NB).filter(k => !EXs.has(k)), idx = {}; let D = 0; for (const k of feats) { idx[k] = D; D += NB[k]; }
      const byU = {}; for (const r of catches) (byU[r.user_id] = byU[r.user_id] || []).push(r);
      const X = [], Y = []; for (const t of trips) for (const f of t.cond.e) { const bb = bins(f, f.t, t.lat, t.lon), row = []; for (const k in bb) if (idx[k] != null) row.push(idx[k] + bb[k]);
        const y = (byU[t.user_id] || []).filter(r => +r.ms >= f.t - HR / 2 && +r.ms < f.t + HR / 2).reduce((a, r) => a + 1 + Math.log2(Math.max(1, Math.min(64, r.cnt || 1))), 0); X.push(row); Y.push(y); }
      if (X.length < 50) return null; const N = X.length, w = new Float64Array(D), cnt = new Float64Array(D); let b0 = Math.log(Math.max(0.01, Y.reduce((a, b) => a + b, 0) / N)); for (const row of X) for (const j of row) cnt[j]++;
      const alpha = 2; for (let it = 0; it < 400; it++) { const g = new Float64Array(D); let gb = 0; for (let i = 0; i < N; i++) { let z = b0; for (const j of X[i]) z += w[j]; const lam = Math.exp(Math.min(5, z)), e = lam - Y[i]; gb += e; for (const j of X[i]) g[j] += e; }
        b0 -= 0.5 * gb / N; for (let j = 0; j < D; j++) w[j] -= 0.5 * (g[j] + alpha * w[j]) / Math.max(1, cnt[j] + alpha); }
      const ins = []; for (const k of feats) for (let b = 0; b < NB[k]; b++) { const j = idx[k] + b, l = Math.exp(w[j]); if (cnt[j] >= 20 && (l >= 1.3 || l <= 0.77)) ins.push({ f: k, b, lift: Math.round(l * 100) / 100, n: Math.round(cnt[j]), src: 'fit' }); }
      return { ins: ins.sort((a, c) => Math.abs(Math.log(c.lift)) - Math.abs(Math.log(a.lift))).slice(0, 8), score: (f, t) => { const bb = bins(f, f.t, t.lat, t.lon); let z = b0; for (const k in bb) if (idx[k] != null) z += w[idx[k] + bb[k]]; return z; } };
    };
    // 1.14.29: «Πόσο έπεσε μέσα»: κάθε έξοδος με τον βαθμό τσιμπήματος που θα έδινε ο δείκτης στις ώρες της (με τον καιρό που έγινε) → ψάρια ανά ώρα ανά ζώνη βαθμού
    const ACC_B = [50, 60, 70];
    // 1.14.86 (P1.2): ΕΓΚΥΡΗ ΕΞΟΔΟΣ για τον έλεγχο του βαθμού. Ο κανόνας είναι ένας, στο score-core.js (AlkyonScore.session), ίδιος με την εφαρμογή:
    // μετράνε οι έξοδοι που υπάρχουν ανεξάρτητα από το αν πιάστηκαν ψάρια (ζωντανή καταγραφή, «Ψάρεψα, τίποτα», με το χέρι), 20′ έως 16 ώρες, με θέση.
    // Μένουν έξω οι «έξοδοι από τα ψάρια της ημέρας» (έχουν πάντα ψάρια) και οι άκυρες. Η μάθηση (analyse) ΔΕΝ αλλάζει: χρησιμοποιεί όλες τις εξόδους όπως πριν.
    const sesOf = t => { try { return PF.session ? PF.session(t) : { kind: 'live', valid: true }; } catch (e) { return { kind: 'live', valid: true }; } };
    const evalOK = t => sesOf(t).valid;
    const sesCount = trips => { const o = {}; for (const t of trips) { const k = sesOf(t).kind; o[k] = (o[k] || 0) + 1; } return o; };
    const accOf = (catches, trips, g) => {
      const T = trips.filter(t => t.ms2 > t.ms && t.cond && Array.isArray(t.cond.e) && t.cond.e.length && evalOK(t)); if (T.length < 5) return null;
      const prof = g === 'spear' ? 'spear' : g === 'lake' ? 'lake' : 'boat', n = [0, 0, 0, 0], hr = [0, 0, 0, 0], fi = [0, 0, 0, 0], hit = [0, 0, 0, 0];
      for (const t of T) { const { sm } = sunOf(t.ms, t.lat, t.lon); let s = 0, k = 0; for (const f of t.cond.e) { const w = fcHour(f, t.lat, t.lon, prof); s += PF.hourScore(sm, w.hr, Object.assign({}, w, { bite: true })); k++; } if (!k) continue;
        const sc = s / k, b = sc < ACC_B[0] ? 0 : sc < ACC_B[1] ? 1 : sc < ACC_B[2] ? 2 : 3, fishN = catches.filter(r => r.user_id === t.user_id && +r.ms >= +t.ms - 15 * 60000 && +r.ms <= +t.ms2 + 15 * 60000).reduce((a, r) => a + Math.max(1, Math.min(64, r.cnt || 1)), 0);
        n[b]++; hr[b] += (t.ms2 - t.ms) / HR; fi[b] += fishN; if (fishN > 0 || t.cond.rt === 2) hit[b]++; }
      return { b: ACC_B, n, r: hr.map((h, i) => h >= 1 ? Math.round(fi[i] / h * 100) / 100 : null), hit: n.map((x, i) => x ? Math.round(hit[i] / x * 100) : null), trips: n.reduce((a, b) => a + b, 0) };
    };
    // vo = true: δοκιμάζεται ΜΟΝΟ στις έγκυρες εξόδους (TV)· τα ευρήματα κάθε ομάδας βγαίνουν όπως πάντα από όλες τις υπόλοιπες (T).
    // vo = false: ο έλεγχος όπως ήταν έως την 1.14.85 (από αυτόν εξαρτάται ακόμα το αν η μάθηση είναι ενεργή, ώστε να μην αλλάξει κανένας βαθμός).
    const backtest = (catches, trips, ex, g, vo) => {
      const T = trips.filter(t => t.ms2 > t.ms), TV = vo ? T.filter(evalOK) : T; if (TV.length < 8) return null;
      const fold = d => { let x = 0; for (const ch of String(d)) x = (x * 31 + ch.charCodeAt(0)) >>> 0; return x % 4; };
      const prof = g === 'spear' ? 'spear' : g === 'lake' ? 'lake' : 'boat';
      const res = [];
      for (let k = 0; k < 4; k++) {
        const test = TV.filter(t => fold(t.day) === k); if (!test.length) continue;
        const L = analyse(catches.filter(r => fold(r.day) !== k), T.filter(t => fold(t.day) !== k), 8, ex).data;
        for (const t of test) { const fishN = catches.filter(r => r.user_id === t.user_id && +r.ms >= +t.ms - 15 * 60000 && +r.ms <= +t.ms2 + 15 * 60000).reduce((a, r) => a + Math.max(1, r.cnt || 1), 0);
          let sb0 = 0, sb1 = 0, nh = 0; const { sm } = sunOf(t.ms, t.lat, t.lon);
          for (const f of t.cond.e) { const w = fcHour(f, t.lat, t.lon, prof), b0 = PF.hourScore(sm, w.hr, Object.assign({}, w, { bite: true }));
            const h1 = PF.learnAdj({ ins: L.ins || [] }, sm, Object.assign({}, w, { score: b0, bite: b0 })); sb0 += b0; sb1 += h1.bite; nh++; }
          if (nh) res.push({ y: fishN / Math.max(1, (t.ms2 - t.ms) / HR), rt: t.cond && t.cond.rt, b0: sb0 / nh, b1: sb1 / nh }); }
      }
      // 1.14.28: «Πώς ήταν το ψάρεμα;»: έξοδος χωρίς καταγεγραμμένα ψάρια αλλά «Καλό» (π.χ. δίχτυ) μετράει σαν τυπική έξοδος με ψάρια, «Μέτριο» λιγότερο
      { const pos = res.filter(x => x.y > 0).map(x => x.y).sort((a, b) => a - b), med = pos.length ? pos[Math.floor(pos.length / 2)] : 0.5; for (const x of res) if (!(x.y > 0) && (x.rt === 2 || x.rt === 1)) x.y = x.rt === 2 ? med : med / 3; }
      const auc = key => { let s2 = 0, p = 0; for (let i = 0; i < res.length; i++) for (let j = 0; j < res.length; j++) { if (res[i].y <= res[j].y) continue; p++; s2 += res[i][key] > res[j][key] ? 1 : res[i][key] === res[j][key] ? 0.5 : 0; } return p ? { a: Math.round(s2 / p * 100) / 100, p } : null; };
      const A = auc('b0'), B2 = auc('b1'); if (!A || A.p < 10) return null;
      const out = { n: res.length, base: A.a, adj: B2.a, on: B2.a >= A.a - 0.01 };
      if (T.length >= FIT_MIN) {
        // βαθμός κάθε εξόδου από το μοντέλο που μάθαμε χωρίς αυτήν
        const resF = []; for (let k = 0; k < 4; k++) { const test = TV.filter(t => fold(t.day) === k); if (!test.length) continue; const F = fitPoisson(catches.filter(r => fold(r.day) !== k), T.filter(t => fold(t.day) !== k), ex); if (!F) continue;
          for (const t of test) { const fishN = catches.filter(r => r.user_id === t.user_id && +r.ms >= +t.ms - 15 * 60000 && +r.ms <= +t.ms2 + 15 * 60000).reduce((a, r) => a + Math.max(1, r.cnt || 1), 0); let z = 0, nh = 0; for (const f of t.cond.e) { z += F.score(f, t); nh++; } if (nh) resF.push({ y: fishN / Math.max(1, (t.ms2 - t.ms) / HR), b2: z / nh }); } }
        let s2 = 0, p = 0; for (let i = 0; i < resF.length; i++) for (let j = 0; j < resF.length; j++) { if (resF[i].y <= resF[j].y) continue; p++; s2 += resF[i].b2 > resF[j].b2 ? 1 : resF[i].b2 === resF[j].b2 ? 0.5 : 0; }
        if (p) { out.fit = Math.round(s2 / p * 100) / 100; out.fitOn = out.fit >= Math.max(out.base, out.adj) + 0.02; } }
      return out;
    };
    try {
      const cyH = +new Date().toLocaleString('en-GB', { timeZone: 'Asia/Nicosia', hour: '2-digit', hour12: false }).slice(0, 2);
      const cur = ((await sb('bite_stats?key=eq.all&select=updated_at')) || [])[0];
      if (cyH >= 3 && (!cur || Date.now() - Date.parse(cur.updated_at) > 20 * HR)) {
        const rows = [];
        for (let off = 0; off < 50000; off += 1000) { const a = (await sb(`catch_obs?select=user_id,kind,sp,day,ms,ms2,lat,lon,cnt,tech,prof,cond&order=id.asc&limit=1000&offset=${off}`)) || []; rows.push(...a); if (a.length < 1000) break; }
        // 1.14.24: χωριστά ανά είδος ψαρέματος: θάλασσα με καλάμι (σκάφος/ακτή), ψαροντούφεκο, λίμνη/φράγμα
        // 1.14.26: κεφαλόποδα (καλαμάρι, θράψαλο, σουπιά, σουπιοκαλάμαρο, χταπόδι…) χωριστή ομάδα· έξοδοι με στόχο κεφαλόποδο το ίδιο
        const CEPH = new Set(['loligo vulgaris', 'loligo forbesii', 'alloteuthis media', 'alloteuthis subulata', 'todarodes sagittatus', 'illex coindetii', 'ommastrephes bartramii', 'sepia officinalis', 'sepia elegans', 'sepia orbignyana', 'sepioteuthis lessoniana', 'octopus vulgaris', 'eledone cirrhosa', 'eledone moschata']);
        const grpOf = r => (r.sp && CEPH.has(r.sp)) ? 'ceph' : r.prof === 'spear' ? 'spear' : r.prof === 'lake' ? 'lake' : 'sea';
        const EXG = { sea: [], spear: [], ceph: [], lake: ['wave', 'tide', 'cur', 'sstd', 'wv48', 'chl', 'thc'] };
        // 1.14.25: μικρά ψάρια που πιάνονται κοπαδιαστά (γόπα, μαρίδα, σαρδέλα, γαύρος, σαυρίδι, κολιός…) ή < 20 cm: χωριστά από τα μεγάλα
        const SMALL = new Set(['boops boops', 'spicara smaris', 'spicara maena', 'spicara flexuosa', 'sardina pilchardus', 'sardinella aurita', 'engraulis encrasicolus', 'trachurus trachurus', 'trachurus mediterraneus', 'trachurus picturatus', 'scomber colias', 'scomber japonicus', 'scomber scombrus', 'atherina hepsetus', 'atherina boyeri', 'diplodus annularis', 'chromis chromis', 'coris julis', 'thalassoma pavo', 'serranus scriba', 'serranus cabrilla', 'serranus hepatus', 'pagellus acarne', 'oblada melanura', 'sarpa salpa', 'mullus barbatus', 'mullus surmuletus', 'gobius niger', 'symphodus tinca']);
        const isSmall = r => (r.sp && SMALL.has(r.sp)) || (r.cond && typeof r.cond.len === 'number' && r.cond.len > 0 && r.cond.len < 20);
        // 1.14.30: έλεγχος ποιότητας: εκτός από μελλοντικές ώρες/αδύνατες θέσεις, διπλές καταγραφές (ίδιος, ίδιο είδος, ±2′), > 60 εγγραφές ψαριού τη μέρα από έναν, έξοδοι < 10′ ή > 24 ώρες
        const QC = { fut: 0, pos: 0, dup: 0, flood: 0, trip: 0, cnt: 0 }, seenQ = new Map(), perDay = {};
        const okRow = r => { if (r.ms != null && +r.ms > Date.now() + HR) { QC.fut++; return false; } if (r.lat != null && (Math.abs(+r.lat) > 90 || Math.abs(+r.lon) > 180 || (+r.lat === 0 && +r.lon === 0))) { QC.pos++; return false; }
          if (r.kind === 'trip') { if (r.ms2 != null && r.ms != null && (+r.ms2 - +r.ms < 10 * 60000 || +r.ms2 - +r.ms > 24 * HR)) { QC.trip++; return false; } return true; }
          if (r.kind !== 'catch') return true; if ((r.cnt || 1) > 200) { r.cnt = 200; QC.cnt++; }
          const pd = r.user_id + '|' + r.day; perDay[pd] = (perDay[pd] || 0) + 1; if (perDay[pd] > 60) { QC.flood++; return false; }
          const k = r.user_id + '|' + (r.sp || '') + '|' + (r.cnt || 1), prev = seenQ.get(k); if (prev && prev.some(t => Math.abs(t - +r.ms) < 120000)) { QC.dup++; return false; } (prev || seenQ.set(k, []).get(k)).push(+r.ms); return true; };
        rows.sort((a, b) => (+a.ms || 0) - (+b.ms || 0)); const rowsQ = rows.filter(okRow);
        if (Object.values(QC).some(x => x)) log('bite stats: qc ' + JSON.stringify(QC));
        const catchesAll = rowsQ.filter(r => r.kind === 'catch' && r.ms != null && r.lat != null);
        const tripsAll = rowsQ.filter(r => r.kind === 'trip' && r.cond && Array.isArray(r.cond.e) && r.cond.e.length);
        /* 21/11/2026 (gear-findings): ψάρια από ΠΑΘΗΤΙΚΑ εργαλεία (δίχτυ, παραγάδι, ζεμπίλι/παγίδα) ΔΕΝ μπαίνουν στα «πότε τσιμπάνε».
           Η ώρα τους είναι η ώρα ανάσυρσης, όχι η ώρα που πιάστηκαν (στις 21/11 τα 5 από τα 8 ήταν την αυγή, όπου κάθεται το κορυφαίο εύρημα «αυγή ×2,72»).
           Η εφαρμογή γράφει την τεχνική από τον Εξοπλισμό (gear-view.js, TYPES: el/en). Μένουν στο «Τι πιάνεται τώρα» (είδη ανά περιοχή), στο «Τι δούλεψε»
           ανά περιοχή και στον μετρητή ετοιμότητας, όπως πριν. Ο βαθμός δεν αλλάζει (η μάθηση είναι κλειδωμένη). */
        const PASSIVE = new Set(['δίχτυ', 'παραγάδι', 'ζεμπίλι / παγίδα', 'κλουβί', 'net', 'longline', 'trap / pot', 'trap', 'pot']);
        const passive = r => !!r.tech && PASSIVE.has(String(r.tech).trim().toLowerCase());
        const catchesBite = catchesAll.filter(r => !passive(r)), tripsBite = tripsAll.filter(t => !passive(t));
        stats.bgear = catchesAll.length - catchesBite.length;
        // 1.14.87 (P1.3a): μετρητής ετοιμότητας (μόνο πληροφορία): έγκυρες έξοδοι όλων των ειδών ψαρέματος, πόσοι χρήστες, πόσες είχαν ψάρια, σε σχέση με τα όρια του score-config (evalGate)
        let READY = null; try { if (PF.readiness) { const VS = tripsAll.filter(evalOK); READY = PF.readiness({ trips: VS.length, users: new Set(VS.map(t => t.user_id)).size,
          pos: VS.filter(t => catchesAll.some(r => r.user_id === t.user_id && +r.ms >= +t.ms - 15 * 60000 && +r.ms <= +t.ms2 + 15 * 60000)).length }); } } catch (e) { }
        const cell = r => (Math.floor(+r.lat / 2) * 2) + '_' + (Math.floor(+r.lon / 2) * 2);
        const now = new Date().toISOString(), out = [];
        // 1.14.29: ημερολόγιο εποχής: τσιμπήματα ανά μήνα (βάρος 1+log2 πλήθους, ώρα Κύπρου ≈ UTC μήνας)
        const monOf = cs => { const m = new Array(12).fill(0); for (const r of cs) { const mo = new Date(+r.ms).getUTCMonth(); m[mo] += 1 + Math.log2(Math.max(1, Math.min(64, r.cnt || 1))); } return m.map(v => Math.round(v * 10) / 10); };
        const prune = async (table, col, keep) => { if (rows.length < 20 || !keep.length) return 0; const K = new Set(keep);
          const have = (((await sb(`${table}?select=${col}`)) || []).map(x => x[col])), gone = have.filter(k => !K.has(k));
          if (!gone.length) return 0; if (gone.length > Math.floor(have.length / 2)) { log(`bite stats: ${table} prune skipped ${gone.length}/${have.length}`); return -gone.length; }
          for (let i = 0; i < gone.length; i += 50) await sb(`${table}?${col}=in.(${encodeURIComponent(gone.slice(i, i + 50).map(k => '"' + String(k).replace(/["\\]/g, m => '\\' + m) + '"').join(','))})`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
          return gone.length; };
        const put = (k, a, g) => { a.data.grp = g; out.push({ key: k, n: a.n, users: a.users, data: a.data, updated_at: now }); };
        for (const g of ['sea', 'spear', 'lake', 'ceph']) {
          const catches = catchesBite.filter(r => grpOf(r) === g), trips = tripsBite.filter(t => grpOf(t) === g), ex = EXG[g];
          if (g !== 'sea' && !catches.length) continue;
          const pre = g === 'sea' ? '' : 'g:' + g + '|';   // θάλασσα: 'all', 'sp:…', 'r:…' (όπως πριν) · αλλιώς 'g:spear', 'g:spear|sp:…'
          const A0 = analyse(catches, trips, 8, ex); const A0wk = A0.data.wk; delete A0.data.wk; try { const bt = backtest(catches, trips, ex, g); A0.data.trips = trips.length; A0.data.ses = sesCount(trips); try { const bv = backtest(catches, trips, ex, g, true); if (bv) A0.data.btv = { n: bv.n, base: bv.base, adj: bv.adj }; } catch (e) { } A0.data.fitMin = FIT_MIN; A0.data.acc = accOf(catches, trips, g); if (g === 'sea') A0.data.qc = QC; if (bt) { A0.data.bt = bt; if (bt.fitOn) { const F = fitPoisson(catches, trips, ex); if (F && F.ins.length) { A0.data.ins = F.ins; A0.data.fitted = true; } } else if (!bt.on) A0.data.learnOff = true; } } catch (e) { log('bite stats: backtest ' + e.message); }
          /* 1.14.94: Η ΜΑΘΗΣΗ ΕΙΝΑΙ ΚΛΕΙΔΩΜΕΝΗ. Τα ευρήματα συνεχίζουν να υπολογίζονται και να φαίνονται ως πληροφορία, αλλά ΔΕΝ διορθώνουν τον βαθμό (learnOff σε όλα τα κλειδιά),
             ό,τι κι αν δείξει ο νυχτερινός έλεγχος (bt.on). Γιατί: με λίγες εξόδους ο έλεγχος άνοιγε και έκλεινε τη μάθηση από μέρα σε μέρα για διαφορά μίας μονάδας
             (19/11: 46% έναντι 50% → κλειστή· 20/11: 53% έναντι 52% → ανοιχτή), άρα ο ίδιος καιρός έπαιρνε άλλο βαθμό. Ανοίγει μόνο με ρητή απόφαση (αλλαγή εδώ και deploy),
             όταν καλυφθούν οι πύλες του evalGate και η αξιολόγηση δείξει όφελος. Το learnOpen υπάρχει μόνο για τα tests του παλιού κανόνα· η παραγωγή δεν το περνά. */
          if (!learnOpen) { A0.data.learnOff = true; A0.data.learnLock = true; }
          A0.data.gearOut = catchesAll.filter(r => grpOf(r) === g && passive(r)).length;   // 21/11/2026: πόσα ψάρια παθητικών εργαλείων έμειναν έξω
          A0.data.mon = monOf(catches); if (g === 'sea' && READY) A0.data.ready = READY; put(g === 'sea' ? 'all' : 'g:' + g, A0, g);
          /* 1.14.90: ο διακόπτης της μάθησης ισχύει για ΟΛΑ τα στατιστικά της ομάδας. Πριν έκλεινε μόνο στο γενικό («all» / «g:…»)· τα στατιστικά ανά περιοχή, είδος και μέγεθος
             δεν είχαν διακόπτη, οπότε η εφαρμογή συνέχιζε να διορθώνει τον βαθμό (έως ±15%) όποτε διάλεγε αυτά, και δύο κινητά στο ίδιο σημείο έδειχναν άλλο βαθμό. */
          const OFF = !!A0.data.learnOff, putG = (k, a) => { if (OFF) a.data.learnOff = true; put(k, a, g); };
          if (g !== 'ceph') for (const [sz, cs] of [['big', catches.filter(r => !isSmall(r))], ['small', catches.filter(isSmall)]]) if (cs.length >= 10 && cs.length < catches.length) { const a = analyse(cs, trips, 6, ex); a.data.size = sz; delete a.data.wk; putG(pre + sz, a); }
          const bySp = {}; for (const r of catches) if (r.sp) (bySp[r.sp] = bySp[r.sp] || []).push(r);
          for (const [sp, cs] of Object.entries(bySp)) { if (cs.length < 5) continue; const tg = trips.filter(t => t.sp === sp || (Array.isArray(t.cond.tg) && t.cond.tg.includes(sp))) /* 1.14.78: όλοι οι στόχοι της εξόδου */, hrs = tg.reduce((a, t) => a + t.cond.e.length, 0);
            const a = blend(analyse(cs, hrs >= 10 ? tg : trips, 5, ex), A0, 5); a.data.tgt = hrs >= 10; a.data.mon = monOf(cs); putG(pre + 'sp:' + sp, a); }
          const byR = {}; for (const r of catches) (byR[cell(r)] = byR[cell(r)] || []).push(r);
          if (Object.keys(byR).length > 1) for (const [rc, cs] of Object.entries(byR)) { if (cs.length < 30) continue; putG(pre + 'r:' + rc, blend(analyse(cs, trips.filter(t => cell(t) === rc), 8, ex), A0, 8)); }
        }
        // 1.14.28: «Τι πιάνεται τώρα»: ανά κελί 1°, τσιμπήματα της τελευταίας εβδομάδας σε σχέση με τον μέσο όρο των 4 προηγούμενων· μόνο από ≥ 3 ψαράδες
        const trendNew = [];
        try {
          const todayD = isoD(Date.now()), dAgo = n => isoD(Date.now() - n * DAY), c1 = r => Math.floor(+r.lat) + '_' + Math.floor(+r.lon), TR = {};
          for (const r of catchesAll) { if (!r.day || r.day < dAgo(35)) continue; const k = c1(r) + '|' + (r.sp || (r.cond && r.cond.nm) || '?'), o = TR[k] = TR[k] || { cell: c1(r), sp: r.sp, nm: {}, g: grpOf(r), n7: 0, p: 0, u7: new Set(), u: new Set() };
            const v = 1 + Math.log2(Math.max(1, Math.min(64, r.cnt || 1))), nm = r.cond && r.cond.nm; if (nm) o.nm[nm] = (o.nm[nm] || 0) + 1; o.u.add(r.user_id); if (r.day >= dAgo(7)) { o.n7 += v; o.u7.add(r.user_id); } else o.p += v / 4; }
          // 1.14.29: «Τι δουλεύει τώρα»: τεχνική / δόλωμα / τεχνητό (χρώμα, γραμμάρια) των τελευταίων 7 ημερών ανά κελί· μόνο τιμές από ≥ 2 ψαράδες, σε κελί με ≥ 3
          const WK = {}; for (const r of catchesAll) { if (!r.day || r.day < dAgo(7)) continue; const o = WK[c1(r)] = WK[c1(r)] || { u: new Set(), tech: {}, bait: {}, lure: {} }; o.u.add(r.user_id);
            const add = (m, v) => { if (!v) return; v = String(v).trim(); if (!v) return; const x = m[v.toLowerCase()] = m[v.toLowerCase()] || { v, u: new Set(), n: 0 }; x.u.add(r.user_id); x.n += 1 + Math.log2(Math.max(1, Math.min(64, r.cnt || 1))); };
            add(o.tech, r.tech); add(o.bait, r.cond && r.cond.bait); const lc = r.cond && r.cond.lc, lw = r.cond && r.cond.lw; if (lc || lw != null) add(o.lure, [lc, lw != null ? lw + 'g' : ''].filter(Boolean).join(' ')); }
          const works = {}; for (const [cl, o] of Object.entries(WK)) { if (o.u.size < 3) continue; const top = m => Object.values(m).filter(x => x.u.size >= 2).sort((a, b) => b.n - a.n).slice(0, 3).map(x => ({ v: x.v, n: Math.round(x.n), u: x.u.size }));
            const w = { tech: top(o.tech), bait: top(o.bait), lure: top(o.lure), users: o.u.size }; if (w.tech.length || w.bait.length || w.lure.length) works[cl] = w; }
          const byCell = {};
          for (const o of Object.values(TR)) { if (o.u7.size < 3 || o.n7 < 5) continue; const ratio = (o.n7 + 1) / (o.p + 1), nm = Object.entries(o.nm).sort((a, b) => b[1] - a[1])[0];
            const it = { sp: o.sp, nm: nm ? nm[0] : o.sp, g: o.g, n7: Math.round(o.n7), prev: Math.round(o.p * 10) / 10, ratio: Math.round(ratio * 10) / 10, users: o.u7.size, up: ratio >= 2, fresh: o.p < 0.5 };
            (byCell[o.cell] = byCell[o.cell] || []).push(it); if (it.up) trendNew.push(Object.assign({ cell: o.cell }, it)); }
          for (const cl of Object.keys(works)) byCell[cl] = byCell[cl] || [];
          for (const [cl, items] of Object.entries(byCell)) out.push({ key: 'trend:' + cl, n: items.reduce((a, x) => a + x.n7, 0), users: Math.max(works[cl] ? works[cl].users : 0, ...items.map(x => x.users)), data: { items: items.sort((a, b) => b.n7 - a.n7).slice(0, 8), works: works[cl] || null, day: todayD }, updated_at: now });
        } catch (e) { log('bite stats: trend ' + e.message); }
        if (out.length) await sb('bite_stats?on_conflict=key', { method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(out) });
        /* 25/11/2026: σβήνονται τα κλειδιά που ΔΕΝ ξαναγράφτηκαν απόψε. Πριν έμεναν για πάντα με τα παλιά ευρήματα: π.χ. ο λούτσος μετά τη 21/11
           (έπεσε κάτω από 5 εγγραφές χωρίς τα δίχτυα) κρατούσε το «αυγή ×3,05» των ανασύρσεων. Ασφάλειες στο prune(): μόνο μετά από επιτυχή εγγραφή,
           μόνο με ≥ 20 παρατηρήσεις, και ποτέ πάνω από τα μισά κλειδιά σε ένα βράδυ (ένα άδειο ή μισό διάβασμα της βάσης δεν σβήνει τα ευρήματα). */
        stats.bgone = await prune('bite_stats', 'key', out.map(o => o.key));
        // προσωπικά (μόνο ο ίδιος τα διαβάζει): data = το είδος ψαρέματος που κάνει πιο συχνά, data.by = όλα όσα έχουν ≥ 10 ψάρια
        const byU = {}; for (const r of catchesBite) (byU[r.user_id] = byU[r.user_id] || []).push(r);
        const pers = [];
        for (const [u, cs0] of Object.entries(byU)) {
          const by = {}; let main = null, mainN = 0, tot = 0;
          for (const g of ['sea', 'spear', 'lake', 'ceph']) { const cs = cs0.filter(r => grpOf(r) === g), n = cs.reduce((a, r) => a + Math.max(1, Math.min(20, r.cnt || 1)), 0); tot += n; if (n < 10) continue;
            const a = analyse(cs, tripsBite.filter(t => t.user_id === u && grpOf(t) === g), 4, EXG[g]); const sp = {}; cs.forEach(r => { if (r.sp) sp[r.sp] = (sp[r.sp] || 0) + 1; });
            a.data.top = Object.entries(sp).sort((x, y) => y[1] - x[1]).slice(0, 3).map(x => x[0]); a.data.grp = g; try { a.data.acc = accOf(cs, tripsBite.filter(t => t.user_id === u && grpOf(t) === g), g); } catch (e) { } delete a.data.wk; by[g] = { n: a.n, data: a.data }; if (n > mainN) { mainN = n; main = g; } }
          if (!main) continue;
          const data = Object.assign({}, by[main].data, { by });
          // «Η παρέα μου»: εσύ + όσοι φίλοι μοιράζονται τα ψάρια τους μαζί σου (και συμμετέχουν)
          try { const fr = new Set(((await sb(`friends?viewer=eq.${encodeURIComponent(u)}&select=owner,share`)) || []).filter(x => x.share !== false).map(x => x.owner)); fr.delete(u);
            const crewC = catchesBite.filter(r => grpOf(r) === main && (r.user_id === u || fr.has(r.user_id))), cu = new Set(crewC.map(r => r.user_id));
            if (cu.size >= 2 && crewC.length >= 20) { const a = analyse(crewC, tripsBite.filter(t => grpOf(t) === main && (t.user_id === u || fr.has(t.user_id))), 5, EXG[main]); delete a.data.wk; data.crew = { n: a.n, users: cu.size, data: a.data }; } } catch (e) { }
          pers.push({ user_id: u, n: tot, data, updated_at: now }); }
        let persOk = !pers.length; if (pers.length) await sb('user_bite_stats?on_conflict=user_id', { method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(pers) }).then(() => { persOk = true; }).catch(e => log('bite stats: user ' + e.message));
        if (persOk) stats.bpgone = await prune('user_bite_stats', 'user_id', pers.map(p => p.user_id));   // 25/11/2026: προσωπικά ευρήματα χρηστών που δεν πληρούν πια τα όρια
        const rows_ = rows;
        stats.bstats = out.length; stats.bobs = rows_.length; stats.bpers = pers.length;
      }
    } catch (e) { log('bite stats: ' + e.message); }

    // (δ) 1.14.28: «Ανεβαίνουν/Εμφανίστηκαν … κοντά σου» (09:00–20:00 Κύπρου, μία φορά την εβδομάδα το πολύ)
        // ειδοποίηση «ανεβαίνουν…» σε όσους έχουν σημείο σε αυτό το κελί (μία φορά την εβδομάδα το πολύ)
    try { const cyH2 = +new Date().toLocaleString('en-GB', { timeZone: 'Asia/Nicosia', hour: '2-digit', hour12: false }).slice(0, 2);
      const trendNew = []; if (webpush && cyH2 >= 9 && cyH2 < 20) for (const x of ((await sb('bite_stats?key=like.trend:*&select=key,data').catch(() => [])) || [])) if (x.data && x.data.day >= isoD(Date.now() - 2 * DAY)) for (const it of ((x.data && x.data.items) || [])) if (it.up) trendNew.push(Object.assign({ cell: x.key.slice(6) }, it));
        if (webpush && trendNew.length) try {
          const subsT = (await sb('push_subs?select=id,user_id,sub,places').catch(() => [])) || [], wk = isoD(Date.now() - (new Date().getUTCDay() * DAY));
          const byUser = {}; for (const r of subsT) (byUser[r.user_id] = byUser[r.user_id] || []).push(r);
          for (const [u, subs] of Object.entries(byUser)) {
            const cells = new Set(); subs.forEach(r => (r.places || []).forEach(p => { if (p && typeof p.lat === 'number' && typeof p.lon === 'number' && p.trend !== false) cells.add(Math.floor(p.lat) + '_' + Math.floor(p.lon)); }));
            const hit = trendNew.filter(x => cells.has(x.cell)).sort((a, b) => b.ratio - a.ratio)[0]; if (!hit) continue;
            const recent = (await sb(`notif_log?user_id=eq.${encodeURIComponent(u)}&kind=eq.trend&at=gt.${encodeURIComponent(new Date(Date.now() - 6 * DAY).toISOString())}&select=id`)) || []; if (recent.length) continue;
            const nid = 'trend:' + u + ':' + hit.cell + ':' + (hit.sp || hit.nm) + ':' + wk, ceph = hit.g === 'ceph';
            const msg = { id: nid, kind: 'trend', tag: 'trend-' + hit.cell, url: '#log', title: (ceph ? '🦑 ' : '🎣 ') + (hit.fresh ? 'Εμφανίστηκαν: ' : 'Ανεβαίνουν: ') + hit.nm + ' κοντά σου', body: hit.n7 + ' τσιμπήματα την τελευταία εβδομάδα από ' + hit.users + ' ψαράδες' + (hit.fresh ? '' : ' (×' + String(hit.ratio).replace('.', ',') + ' από πριν)') + '. · ' + (hit.fresh ? 'Showing up' : 'On the rise') + ' near you.' };
            for (const r of subs) { try { await webpush.sendNotification(r.sub, JSON.stringify(msg), { TTL: 24 * 3600 }); } catch (e) { if (e.statusCode === 404 || e.statusCode === 410) await sb(`push_subs?id=eq.${encodeURIComponent(r.id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }).catch(() => {}); } }
            await sb('notif_log', { method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify({ id: nid, user_id: u, kind: 'trend', title: msg.title, body: msg.body, at: new Date().toISOString() }) }).catch(() => {});
            stats.trend = (stats.trend || 0) + 1; }
        } catch (e) { log('bite stats: trend push ' + e.message); }
    } catch (e) { log('bite stats: trend push ' + e.message); }
    // (γ) «🎯 Αύριο … μοιάζει με τις καλύτερες ώρες σου»
    try {
      const cyH = +new Date().toLocaleString('en-GB', { timeZone: 'Asia/Nicosia', hour: '2-digit', hour12: false }).slice(0, 2);
      if (webpush && cyH >= 17 && cyH < 19) {
        const tom = isoD(Date.now() + DAY), us = (await sb('user_bite_stats?select=user_id,n,data').catch(() => [])) || [];
        const LBL = { sun: ['νύχτα', 'αυγή', 'πρωί', 'μεσημέρι', 'απόγευμα', 'σούρουπο'], pt: ['πίεση πέφτει', 'πίεση σταθερή', 'πίεση ανεβαίνει'], sol: ['κύρια σεληνιακή περίοδος', 'δευτερεύουσα περίοδος', 'εκτός περιόδων'],
          pl: ['πίεση <1010', 'πίεση 1010–15', 'πίεση 1015–20', 'πίεση >1020'], wind: ['άνεμος 0–4 kn', 'άνεμος 5–9 kn', 'άνεμος 10–14 kn', 'άνεμος 15+ kn'], wave: ['κύμα <0,3 m', 'κύμα 0,3–0,6 m', 'κύμα 0,6–1 m', 'κύμα >1 m'],
          tide: ['στάθμη ανεβαίνει', 'στάθμη κατεβαίνει', 'στάθμη στάσιμη'], cloud: ['καθαρός ουρανός', 'λίγα σύννεφα', 'συννεφιά'], rain: ['χωρίς βροχή', 'βροχή'], cur: ['ρεύμα ασθενές', 'ρεύμα μέτριο', 'ρεύμα δυνατό'] };
        /* 1.14.89: «Το σχέδιο για αύριο» στη γλώσσα του χρήστη (πριν ήταν μισό ελληνικά, μισό αγγλικά για όλους). Ίδια σειρά με το LBL. */
        const LBL_EN = { sun: ['night', 'dawn', 'morning', 'midday', 'afternoon', 'dusk'], pt: ['pressure falling', 'pressure steady', 'pressure rising'], sol: ['major lunar period', 'minor lunar period', 'outside lunar periods'],
          pl: ['pressure <1010', 'pressure 1010–15', 'pressure 1015–20', 'pressure >1020'], wind: ['wind 0–4 kn', 'wind 5–9 kn', 'wind 10–14 kn', 'wind 15+ kn'], wave: ['waves <0.3 m', 'waves 0.3–0.6 m', 'waves 0.6–1 m', 'waves >1 m'],
          tide: ['tide rising', 'tide falling', 'slack tide'], cloud: ['clear sky', 'a few clouds', 'overcast'], rain: ['no rain', 'rain'], cur: ['weak current', 'moderate current', 'strong current'] };
        for (const u of us) {
          const good = ((u.data && u.data.ins) || []).filter(x => x.lift >= 1.3 && x.f !== 'moon'); if (good.length < 2) continue;
          const nid = 'best:' + u.user_id + ':' + tom; if (((await sb(`notif_log?id=eq.${encodeURIComponent(nid)}&select=id`)) || []).length) continue;
          const subs = (await sb(`push_subs?user_id=eq.${encodeURIComponent(u.user_id)}&select=id,sub,places`)) || []; if (!subs.length) continue;
          const pl = (subs.map(s => (s.places || []).find(p => p && typeof p.lat === 'number' && typeof p.lon === 'number')).find(Boolean)); if (!pl) continue;
          const la = Math.round(pl.lat * 10) / 10, lo = Math.round(pl.lon * 10) / 10, H = await wxFor(la, lo, isoD(Date.now() - DAY), isoD(Date.now() + 2 * DAY)); if (!H) continue;
          const hrs = dayHours(Date.parse(tom + 'T12:00:00Z') - tzOf(lo) * 60000, la, lo).filter(t => t > Date.now());
          const sc = hrs.map(t => { const f = feat(H, t); if (!f) return { t, s: 0, m: [] }; const bb = bins(f, t, la, lo), m = good.filter(x => bb[x.f] === x.b); return { t, s: m.reduce((a, x) => a + Math.log(x.lift), 0), m }; });
          let best = null; for (let i = 0; i < sc.length; i++) { if (sc[i].m.length < 2) continue; let j = i; while (j + 1 < sc.length && sc[j + 1].m.length >= 2 && j - i < 3) j++; const s = sc.slice(i, j + 1).reduce((a, x) => a + x.s, 0); if (!best || s > best.s) best = { i, j, s }; }
          if (!best) continue;
          const tz = new Date(sc[best.i].t).toLocaleString('en-GB', { timeZone: 'Asia/Nicosia', hour: '2-digit', minute: '2-digit', hour12: false });
          const tz2 = new Date(sc[best.j].t + HR).toLocaleString('en-GB', { timeZone: 'Asia/Nicosia', hour: '2-digit', minute: '2-digit', hour12: false });
          const en = !!subs.find(r => (r.places || []).find(p => p && p.lang === 'en')), LB = en ? LBL_EN : LBL;
          const why = [...new Set(sc[best.i].m.map(x => LB[x.f] && LB[x.f][x.b]).filter(Boolean))].slice(0, 3).join(' · ');
          // 1.14.30: «Το σχέδιο για αύριο»: και τι να δοκιμάσεις: ό,τι δούλεψε σε αυτές τις συνθήκες (προσωπικά ευρήματα), αλλιώς «τι δουλεύει τώρα» στην περιοχή
          let tryW = ''; { const ws = sc[best.i].m.map(x => x.w).filter(Boolean)[0]; const pick = w => w && [].concat(w.lure || [], w.tech || [], w.bait || []).slice(0, 2).join(', ');
            tryW = pick(ws) || ''; if (!tryW) { try { const tw = ((await sb(`bite_stats?key=eq.${encodeURIComponent('trend:' + Math.floor(pl.lat) + '_' + Math.floor(pl.lon))}&select=data`)) || [])[0]; const w = tw && tw.data && tw.data.day >= isoD(Date.now() - 3 * DAY) && tw.data.works; if (w) tryW = [].concat((w.lure || []).map(x => x.v), (w.tech || []).map(x => x.v), (w.bait || []).map(x => x.v)).slice(0, 2).join(', '); } catch (e) { } } }
          const pn = pl.name ? ' (' + String(pl.name).slice(0, 30) + ')' : '';
          const msg = en ? { id: nid, kind: 'best', tag: 'best-' + tom, url: '#forecast', title: '🎯 Plan for tomorrow: ' + tz + '–' + tz2,
            body: 'It matches the hours you catch the most fish in: ' + why + pn + '.' + (tryW ? ' Try: ' + tryW + '.' : '') + ' Your spots for that wind are in the forecast.' }
            : { id: nid, kind: 'best', tag: 'best-' + tom, url: '#forecast', title: '🎯 Το σχέδιο για αύριο: ' + tz + '–' + tz2,
            body: 'Μοιάζει με τις ώρες που πιάνεις τα περισσότερα ψάρια: ' + why + pn + '.' + (tryW ? ' Δοκίμασε: ' + tryW + '.' : '') + ' Τα σημεία σου για αυτόν τον άνεμο στην πρόγνωση.' };
          for (const r of subs) { try { await webpush.sendNotification(r.sub, JSON.stringify(msg), { TTL: 12 * 3600 }); } catch (e) { if (e.statusCode === 404 || e.statusCode === 410) await sb(`push_subs?id=eq.${encodeURIComponent(r.id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }).catch(() => {}); } }
          await sb('notif_log', { method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify({ id: nid, user_id: u.user_id, kind: 'best', title: msg.title, body: msg.body, at: new Date().toISOString() }) }).catch(() => {});
          stats.best = (stats.best || 0) + 1;
        }
      }
    } catch (e) { log('bite stats: best ' + e.message); }
    // (ε) 1.14.30: Κυριακή 18:00–20:00 Κύπρου: «📅 Η εβδομάδα σου»: ψάρια/έξοδοι της εβδομάδας (αν συμμετέχεις), πόσο έπεσε μέσα ο δείκτης, η καλύτερη μέρα της επόμενης εβδομάδας
    try {
      const nowCy = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Nicosia' })), cyH3 = nowCy.getHours();
      if (webpush && nowCy.getDay() === 0 && cyH3 >= 18 && cyH3 < 20) {
        const subsW = (await sb('push_subs?select=id,user_id,sub,places').catch(() => [])) || [], byUw = {}; for (const r of subsW) (byUw[r.user_id] = byUw[r.user_id] || []).push(r);
        const DNW = ['Κυριακή', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο'], todayW = isoD(Date.now()); let sent = 0;
        for (const [u, subs] of Object.entries(byUw)) {
          if (sent >= 40) break;
          const nid = 'week:' + u + ':' + todayW; if (((await sb(`notif_log?id=eq.${encodeURIComponent(nid)}&select=id`)) || []).length) continue;
          const pl = subs.map(x => (x.places || []).find(p => p && typeof p.lat === 'number' && typeof p.lon === 'number')).find(Boolean); if (!pl) continue;
          const mine = (await sb(`catch_obs?user_id=eq.${encodeURIComponent(u)}&day=gte.${isoD(Date.now() - 7 * DAY)}&select=kind,cnt`).catch(() => [])) || [];
          const fish = mine.filter(x => x.kind === 'catch').reduce((a, x) => a + Math.max(1, Math.min(200, x.cnt || 1)), 0), trips = mine.filter(x => x.kind === 'trip').length;
          let bestD = null; try { const up = await prefsOf(u, subs.reduce((a, x) => a.concat(x.places || []), [])); const fc = await PF.getForecast(+pl.lat, +pl.lon, F, { days: 7, learn: false, prof: up.prof, sp: up.sp, limits: up.limits }); for (const d of fc.days) { if (d.date <= todayW || !d.safe || !d.win) continue; if (!bestD || d.best > bestD.best) bestD = d; } } catch (e) { }
          let acc = ''; try { const us = ((await sb(`user_bite_stats?user_id=eq.${encodeURIComponent(u)}&select=data`)) || [])[0], a = us && us.data && us.data.acc; if (a && a.r) { const ok = a.r.map((x, i) => [x, i]).filter(x => x[0] != null && a.n[x[1]] >= 2); if (ok.length >= 2 && ok[0][0] > 0) { const k = ok[ok.length - 1][0] / ok[0][0]; if (k >= 1.2) acc = String(Math.round(k * 10) / 10); } } } catch (e) { }
          if (!bestD && !fish && !trips) continue;
          /* 1.14.89: στη γλώσσα του χρήστη (πριν: ελληνικά με αγγλική ουρά για όλους) */
          const enW = !!subs.find(r => (r.places || []).find(p => p && p.lang === 'en')), DNE = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          const pad2 = n => String(n).padStart(2, '0'), dix = bestD ? new Date(bestD.date + 'T12:00:00Z').getUTCDay() : 0, dn = bestD ? (enW ? DNE : DNW)[dix] : '';
          const win = bestD ? dn + ' ' + pad2(bestD.win.s) + ':00–' + pad2((bestD.win.e + 1) % 24) + ':00' : '', pnm = pl.name ? ', ' + String(pl.name).slice(0, 30) : '';
          const msg = enW ? { id: nid, kind: 'week', tag: 'week', url: '#forecast', title: '📅 Your week',
            body: (fish || trips ? 'This week: ' + fish + ' fish' + (trips ? ' in ' + trips + (trips === 1 ? ' trip' : ' trips') : '') + '.' : 'Nothing logged this week.') + (acc ? ' In the hours with a high score you caught ×' + acc + ' more.' : '') + (bestD ? ' Best day ahead: ' + win + ' (score ' + bestD.best + ')' + pnm + '.' : '') }
            : { id: nid, kind: 'week', tag: 'week', url: '#forecast', title: '📅 Η εβδομάδα σου',
            body: (fish || trips ? 'Αυτή την εβδομάδα: ' + fish + ' ψάρια' + (trips ? ' σε ' + trips + (trips === 1 ? ' έξοδο' : ' εξόδους') : '') + '.' : 'Καμία καταγραφή αυτή την εβδομάδα.') + (acc ? ' Στις ώρες με ψηλό δείκτη έπιασες ×' + acc.replace('.', ',') + ' περισσότερα.' : '') + (bestD ? ' Καλύτερη μέρα: ' + win + ' (δείκτης ' + bestD.best + ')' + pnm + '.' : '') };
          for (const r of subs) { try { await webpush.sendNotification(r.sub, JSON.stringify(msg), { TTL: 12 * 3600 }); } catch (e) { if (e.statusCode === 404 || e.statusCode === 410) await sb(`push_subs?id=eq.${encodeURIComponent(r.id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }).catch(() => {}); } }
          await sb('notif_log', { method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify({ id: nid, user_id: u, kind: 'week', title: msg.title, body: msg.body, at: new Date().toISOString() }) }).catch(() => {});
          sent++; stats.week = (stats.week || 0) + 1; }
      }
    } catch (e) { log('bite stats: week ' + e.message); }
  }
  mark('bstats');
  // 28/11/2026: λίστα «Ειδοποίησέ με» (website) → email καλωσορίσματος + email στον διαχειριστή (Resend). Χωρίς RESEND_API_KEY δεν κάνει τίποτα.
  if (env.RESEND_API_KEY && !late()) {
    try { const w = await waitlistStep({ sb, F, key: env.RESEND_API_KEY, log }); if (w.sent || w.failed) stats.wl = w; }
    catch (e) { log('waitlist: ' + e.message); }
  }
  mark('wl'); stats.ms = { ...TM, total: Date.now() - T0 };
  log('Safety job: ' + JSON.stringify(stats));
  // 9) 1.9.50: υγεία του server. Σε κάθε εκτέλεση γράφεται «heartbeat» (backups/_system/heartbeat.json, το διαβάζει το watchdog του GitHub).
  //    Αν ένα βήμα αποτύχει σε 2 συνεχόμενες εκτελέσεις (όχι ένα στιγμιαίο σφάλμα δικτύου), μήνυμα Telegram στους διαχειριστές, το πολύ μία φορά ανά 6 ώρες ανά βήμα.
  if (!only) {
    try {
      const HB = URL_ + '/storage/v1/object/backups/_system/heartbeat.json', AH = { apikey: KEY, Authorization: 'Bearer ' + KEY };
      const st0 = await F(HB, { headers: AH }).then(r => r.ok ? r.json() : {}).catch(() => ({})) || {};
      const now = Date.now(), byK = {}, fails = {}, alerted = { ...(st0.alerted || {}) };
      for (const e of ERRS) (byK[e.k] = byK[e.k] || []).push(e.m);
      for (const k of Object.keys(byK)) fails[k] = ((st0.fails || {})[k] || 0) + 1;
      const due = Object.keys(byK).filter(k => fails[k] >= 2 && !(alerted[k] && now - alerted[k] < 6 * 3600000));
      if (due.length && TG) {
        const chats = await adminChats();
        const text = '⚠ Alkyon server: σφάλμα σε ' + due.length + (due.length === 1 ? ' βήμα' : ' βήματα') + ' (2 συνεχόμενες εκτελέσεις)\n' + due.map(k => '• ' + byK[k][0]).join('\n');
        let ok = 0; for (const c of chats) { try { await tg('sendMessage', { chat_id: c, text }); ok++; } catch (_) { /* τίποτα */ } }
        if (ok) { for (const k of due) alerted[k] = now; stats.health = due.length; }
      }
      for (const k of Object.keys(alerted)) if (now - alerted[k] > 86400000) delete alerted[k];
      await F(HB, { method: 'POST', headers: { ...AH, 'Content-Type': 'application/json', 'x-upsert': 'true' }, body: JSON.stringify({ at: new Date(now).toISOString(), fails, alerted, stats }) });
    } catch (e) { log0('health: ' + e.message); }
  }
  return { ok: true, stats };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  let sendMail = null;
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    const nm = (await import('nodemailer')).default;
    const tr = nm.createTransport({ service: 'gmail', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
    sendMail = o => tr.sendMail({ from: `Alkyon <${process.env.SMTP_USER}>`, ...o });
  }
  let PF = null, webpush = null;
  try {
    const fs = await import('node:fs'); const g = {};
    /* 1.14.84 (P1.1): πρώτα τα βάρη και ο πυρήνας του βαθμού, μετά το forecast.js (ίδια σειρά με τη σελίδα και τις Edge Functions) */
    for (const f of ['score-config.js', 'score-core.js', 'forecast.js']) new Function('self', fs.readFileSync(f, 'utf8'))(g); PF = g.PF;
    if (process.env.VAPID_PUBLIC && process.env.VAPID_PRIVATE) {
      webpush = (await import('web-push')).default;
      webpush.setVapidDetails('https://dinospapani.github.io/Alkyon/', process.env.VAPID_PUBLIC, process.env.VAPID_PRIVATE);
    }
  } catch (e) { console.log('Πρόγνωση (push) ανενεργή: ' + e.message); PF = null; webpush = null; }
  const r = await run({ env: process.env, sendMail, PF, webpush });
  if (!r.ok) process.exit(1);
}
