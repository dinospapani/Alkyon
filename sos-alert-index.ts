// @ts-nocheck
// Alkyon 1.14.0 · Edge Function «sos-alert»: SOS σε κοντινά σκάφη. Χωριστά από τον quick-processor (cron), ώστε να ανεβαίνει μικρό.
// Τα βοηθητικά push (web push / FCM / APNs) είναι αντίγραφο από τον quick-processor (build_sos.py). Secrets: ίδια με τον quick-processor.
import webpush from 'npm:web-push@3.6.7';
let vapidSet = false;
/* 1.12.4: ειδοποιήσεις στην εφαρμογή Android μέσω Firebase Cloud Messaging (HTTP v1).
   Η εφαρμογή γράφει στο push_subs συνδρομή {endpoint:'fcm:…', fcm:'<token>'}. Το pushx() έχει την ίδια διεπαφή με το web-push
   (sendNotification(sub, payload, {TTL})): συνδρομή με «fcm» → Firebase, αλλιώς web-push. Ένα token που δεν ισχύει πια (UNREGISTERED)
   γυρίζει statusCode 410, ώστε ο υπάρχων κώδικας να σβήνει τη συνδρομή όπως κάνει με τις web-push.
   Secret: FCM_SERVICE_ACCOUNT = όλο το JSON του service account του Firebase (Project settings › Service accounts › Generate new private key). */
let fcmTok = '', fcmExp = 0;
function fcmSA() { try { const s = (Deno.env.get('FCM_SERVICE_ACCOUNT') || '').trim(); const j = s ? JSON.parse(s) : null; return j && j.client_email && j.private_key && j.project_id ? j : null; } catch (e) { return null; } }
function b64u(b) { let s = ''; const u = new Uint8Array(b); for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
async function fcmAccess(sa) {
  if (fcmTok && Date.now() < fcmExp - 120000) return fcmTok;
  const now = Math.floor(Date.now() / 1000), te = new TextEncoder();
  const head = b64u(te.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claim = b64u(te.encode(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })));
  const pem = String(sa.private_key).replace(/\\n/g, '\n').replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, te.encode(head + '.' + claim));
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + head + '.' + claim + '.' + b64u(sig) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error('FCM auth ' + r.status + ' ' + (j.error_description || j.error || ''));
  fcmTok = j.access_token; fcmExp = Date.now() + (j.expires_in || 3600) * 1000; return fcmTok;
}
async function fcmSend(sa, token, payload, ttl) {
  let p = {}; try { p = typeof payload === 'string' ? JSON.parse(payload) : (payload || {}); } catch (e) { p = { body: String(payload) }; }
  const data = {}; for (const k of Object.keys(p)) { const v = p[k]; if (v == null) continue; data[k] = typeof v === 'string' ? v : JSON.stringify(v); }
  const tag = p.tag ? String(p.tag).slice(0, 60) : undefined;
  const msg = { message: { token, notification: { title: String(p.title || 'Alkyon').slice(0, 200), body: String(p.body || '').slice(0, 1000) }, data,
    android: { priority: 'HIGH', ttl: Math.max(60, Math.min(2419200, Math.round(ttl || 86400))) + 's', notification: { channel_id: 'alkyon', icon: 'ic_stat_alkyon', color: '#FF7A4D', sound: 'default', tag } } } };
  const r = await fetch('https://fcm.googleapis.com/v1/projects/' + sa.project_id + '/messages:send', { method: 'POST', headers: { Authorization: 'Bearer ' + await fcmAccess(sa), 'Content-Type': 'application/json' }, body: JSON.stringify(msg) });
  if (!r.ok) { const t = await r.text().catch(() => ''); const e = new Error('FCM ' + r.status + ' ' + t.slice(0, 200)); e.statusCode = (r.status === 404 || /UNREGISTERED|registration-token-not-registered/i.test(t)) ? 410 : r.status; e.body = t; throw e; }
  return { statusCode: 200 };
}
/* 1.13.0: ειδοποιήσεις στο iPhone/iPad κατευθείαν μέσω Apple Push Notification service (APNs, HTTP/2, κλειδί .p8 με JWT ES256).
   Η εφαρμογή iOS γράφει {endpoint:'apns:…', apns:'<device token hex>', apns_env:'production'|'sandbox'}.
   Secrets: APNS_KEY_P8 (όλο το .p8), APNS_KEY_ID, APNS_TEAM_ID· προαιρετικά APNS_TOPIC (αλλιώς com.alkyonfishing.app). */
let apnsJwt = '', apnsAt = 0;
function apnsCfg() { const k = (Deno.env.get('APNS_KEY_P8') || '').trim(), id = (Deno.env.get('APNS_KEY_ID') || '').trim(), team = (Deno.env.get('APNS_TEAM_ID') || '').trim();
  return k && id && team ? { k, id, team, topic: (Deno.env.get('APNS_TOPIC') || 'com.alkyonfishing.app').trim() } : null; }
async function apnsToken(c) {
  if (apnsJwt && Date.now() - apnsAt < 45 * 60000) return apnsJwt;   /* η Apple δέχεται το ίδιο token 20′–60′ */
  const te = new TextEncoder(), now = Math.floor(Date.now() / 1000);
  const head = b64u(te.encode(JSON.stringify({ alg: 'ES256', kid: c.id }))), claim = b64u(te.encode(JSON.stringify({ iss: c.team, iat: now })));
  const pem = c.k.replace(/\\n/g, '\n').replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const key = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), ch => ch.charCodeAt(0)), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, te.encode(head + '.' + claim));   /* r||s, όπως θέλει το JWT */
  apnsJwt = head + '.' + claim + '.' + b64u(sig); apnsAt = Date.now(); return apnsJwt;
}
async function apnsSend(c, sub, payload, ttl) {
  let p = {}; try { p = typeof payload === 'string' ? JSON.parse(payload) : (payload || {}); } catch (e) { p = { body: String(payload) }; }
  const body = Object.assign({}, p, { aps: { alert: { title: String(p.title || 'Alkyon').slice(0, 200), body: String(p.body || '').slice(0, 1000) }, sound: 'default', 'thread-id': p.tag ? String(p.tag).slice(0, 60) : undefined } });
  const host = sub.apns_env === 'sandbox' ? 'api.sandbox.push.apple.com' : 'api.push.apple.com';
  const exp = Math.floor(Date.now() / 1000) + Math.max(60, Math.min(2419200, Math.round(ttl || 86400)));
  const h = { authorization: 'bearer ' + await apnsToken(c), 'apns-topic': c.topic, 'apns-push-type': 'alert', 'apns-priority': '10', 'apns-expiration': String(exp), 'content-type': 'application/json' };
  if (p.tag) h['apns-collapse-id'] = String(p.tag).slice(0, 60);
  const r = await fetch('https://' + host + '/3/device/' + encodeURIComponent(String(sub.apns)), { method: 'POST', headers: h, body: JSON.stringify(body) });
  if (!r.ok) { const t = await r.text().catch(() => ''); const e = new Error('APNs ' + r.status + ' ' + t.slice(0, 200)); e.statusCode = (r.status === 410 || /BadDeviceToken|Unregistered|DeviceTokenNotForTopic/.test(t)) ? 410 : r.status; e.body = t; throw e; }
  return { statusCode: 200 };
}
function pushx(wp) {
  return { sendNotification: async (sub, payload, opts) => {
    if (sub && sub.apns) { const c = apnsCfg(); if (!c) { const e = new Error('APNS secrets missing'); e.statusCode = 500; throw e; } return apnsSend(c, sub, payload, opts && opts.TTL); }
    if (sub && sub.fcm) { const sa = fcmSA(); if (!sa) { const e = new Error('FCM_SERVICE_ACCOUNT missing'); e.statusCode = 500; throw e; } return fcmSend(sa, String(sub.fcm), payload, opts && opts.TTL); }
    if (!wp) { const e = new Error('VAPID secrets missing'); e.statusCode = 500; throw e; }
    return wp.sendNotification(sub, payload, opts);
  } };
}
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const J = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const E = k => Deno.env.get(k) || '';
  const V = k => E(k).trim().replace(/^["']|["']$/g, '').replace(/\s+/g, '').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const env = { SUPABASE_URL: E('SUPABASE_URL'), SUPABASE_SERVICE_KEY: E('SERVICE_KEY') || E('SUPABASE_SERVICE_ROLE_KEY') };
  const auth = req.headers.get('authorization') || '';
  if (!/^Bearer\s+\S+/.test(auth)) return J({ ok: false, error: 'forbidden' }, 403);
  let body = {}; try { body = await req.json(); } catch (e) { /* κενό */ }
    // 1.14.0: SOS σε κοντινά σκάφη: ο χρήστης έχει γράψει τη γραμμή του στο sos_alerts (RLS). Εδώ στέλνουμε push σε όσους είναι στη θάλασσα
    // (ζωντανή έξοδος ή έξοδος με ασφάλεια, θέση της τελευταίας ώρας) έως 10 ναυτικά μίλια μακριά. phase 'start' μία φορά ανά SOS· 'ok' = «είναι καλά».
    if (body && body.action === 'sos' && ['start', 'ok'].includes(body.phase)) {
      try {
        const u = await fetch(env.SUPABASE_URL + '/auth/v1/user', { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: auth } });
        if (!u.ok) return J({ ok: false, error: 'unauthorized' }, 401);
        const uid = (await u.json()).id; if (!uid) return J({ ok: false, error: 'unauthorized' }, 401);
        const H = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_KEY };
        const g = async (p) => { const r = await fetch(env.SUPABASE_URL + '/rest/v1/' + p, { headers: H }); return r.ok ? await r.json() : []; };
        const row = (await g('sos_alerts?user_id=eq.' + encodeURIComponent(uid) + '&select=*'))[0];
        if (!row) return J({ ok: false, error: 'no sos' }, 400);
        if (body.phase === 'start' && (row.status !== 'active' || row.notified > 0)) return J({ ok: true, sent: 0, why: 'already' });
        if (body.phase === 'ok' && (row.status !== 'ok' || !(row.notified > 0))) return J({ ok: true, sent: 0, why: 'skip' });
        const since = new Date(Date.now() - 60 * 60000).toISOString();
        const live = await g('trip_live?active=eq.true&at=gt.' + encodeURIComponent(since) + '&select=user_id,lat,lon');
        const saf = await g('safety_trips?status=in.(active,alerted)&last_at=gt.' + encodeURIComponent(since) + '&select=user_id,last_lat,last_lon');
        const R = Math.PI / 180, dist = (a, b, c, d) => { const x = Math.sin((c - a) * R / 2) ** 2 + Math.cos(a * R) * Math.cos(c * R) * Math.sin((d - b) * R / 2) ** 2; return 12742 * Math.asin(Math.sqrt(x)); };
        const brg = (a, b, c, d) => { const y = Math.sin((d - b) * R) * Math.cos(c * R), x = Math.cos(a * R) * Math.sin(c * R) - Math.sin(a * R) * Math.cos(c * R) * Math.cos((d - b) * R); return (Math.atan2(y, x) / R + 360) % 360; };
        const near = new Map();
        for (const p of [...live.map(x => ({ u: x.user_id, la: x.lat, lo: x.lon })), ...saf.map(x => ({ u: x.user_id, la: x.last_lat, lo: x.last_lon }))]) {
          if (!p.u || p.u === uid || typeof p.la !== 'number' || typeof p.lo !== 'number') continue;
          const km = dist(p.la, p.lo, row.lat, row.lon); if (km > 18.52) continue;
          const o = near.get(p.u); if (!o || km < o.km) near.set(p.u, { km, b: brg(p.la, p.lo, row.lat, row.lon) });
        }
        const hasV = !!(E('VAPID_PUBLIC') && E('VAPID_PRIVATE'));
        if (hasV && !vapidSet) { webpush.setVapidDetails('https://dinospapani.github.io/Alkyon/', V('VAPID_PUBLIC'), V('VAPID_PRIVATE')); vapidSet = true; }
        const px = pushx(hasV ? webpush : null);
        const CMP = ['Β', 'ΒΑ', 'Α', 'ΝΑ', 'Ν', 'ΝΔ', 'Δ', 'ΒΔ'], CEN = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        const nm = String(row.name || '').slice(0, 40) || 'Ψαράς / Angler';
        let sent = 0, people = 0;
        for (const [ru, o] of near) {
          const subs = await g('push_subs?user_id=eq.' + encodeURIComponent(ru) + '&select=id,sub');
          if (!subs.length) continue; people++;
          const nmi = (o.km / 1.852).toFixed(1), k = Math.round(o.b / 45) % 8;
          const msg = body.phase === 'start'
            ? { id: 'sos:' + row.id, kind: 'sos', tag: 'sos-' + row.id, url: '#map', title: '🆘 SOS κοντά σου · SOS near you', body: nm + ' χρειάζεται βοήθεια, ' + nmi.replace('.', ',') + ' ν.μ. ' + CMP[k] + '. Αν μπορείς, πήγαινε· ειδοποίησε 112 / VHF 16. · Needs help, ' + nmi + ' nm ' + CEN[k] + '.', place: { name: 'SOS', lat: row.lat, lon: row.lon } }
            : { id: 'sosok:' + row.id, kind: 'sos', tag: 'sos-' + row.id, url: '#map', title: '✓ SOS έληξε · SOS cancelled', body: nm + ': είναι καλά, δεν χρειάζεται πια βοήθεια. · Is OK now, no help needed.' };
          for (const r of subs) {
            try { await px.sendNotification(r.sub, JSON.stringify(msg), { TTL: 3600, urgency: 'high' }); sent++; }
            catch (e) { if (e.statusCode === 404 || e.statusCode === 410) await fetch(env.SUPABASE_URL + '/rest/v1/push_subs?id=eq.' + encodeURIComponent(r.id), { method: 'DELETE', headers: H }).catch(() => {}); }
          }
        }
        if (body.phase === 'start') await fetch(env.SUPABASE_URL + '/rest/v1/sos_alerts?user_id=eq.' + encodeURIComponent(uid), { method: 'PATCH', headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ notified: Math.max(1, people) }) });
        return J({ ok: true, near: near.size, people, sent });
      } catch (e) { return J({ ok: false, error: e.message }, 500); }
    }
  // 1.14.1: νέο μήνυμα «Πες μας τη γνώμη σου» → push στους διαχειριστές. Ο καθένας μπορεί να το καλέσει, αλλά στέλνει μόνο για μηνύματα
  // των τελευταίων 10′ που δεν έχουν ήδη σταλεί (notif_log kind 'fb'), οπότε δεν γίνεται κατάχρηση.
  if (body && body.action === 'fb') {
    try {
      const H = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_KEY };
      const g = async (p) => { const r = await fetch(env.SUPABASE_URL + '/rest/v1/' + p, { headers: H }); return r.ok ? await r.json() : []; };
      const admins = (await g('app_admins?select=user_id')).map(x => x.user_id).filter(Boolean);
      if (!admins.length) return J({ ok: true, sent: 0, why: 'no admins' });
      const since = new Date(Date.now() - 10 * 60000).toISOString();
      const fbs = await g('app_errors?kind=eq.feedback&at=gt.' + encodeURIComponent(since) + '&select=at,msg,stack&order=at.asc&limit=10');
      if (!fbs.length) return J({ ok: true, sent: 0, why: 'none' });
      const done = new Set((await g('notif_log?kind=eq.fb&at=gt.' + encodeURIComponent(new Date(Date.now() - 30 * 60000).toISOString()) + '&select=id')).map(x => x.id));
      const fresh = fbs.filter(f => !done.has('fb:' + f.at));
      if (!fresh.length) return J({ ok: true, sent: 0, why: 'already' });
      const hasV = !!(E('VAPID_PUBLIC') && E('VAPID_PRIVATE'));
      if (hasV && !vapidSet) { webpush.setVapidDetails('https://dinospapani.github.io/Alkyon/', V('VAPID_PUBLIC'), V('VAPID_PRIVATE')); vapidSet = true; }
      const px = pushx(hasV ? webpush : null);
      const TOP = { idea: 'Ιδέα', bug: 'Πρόβλημα', like: 'Μου αρέσει' };
      let sent = 0;
      for (const f of fresh) {
        const tp = (/topic: (\w+)/.exec(f.stack || '') || [])[1] || '';
        const msg = { id: 'fb:' + f.at, kind: 'fb', tag: 'fb-' + f.at, url: '#profile', title: '💬 ' + (TOP[tp] ? TOP[tp] + ' · ' : '') + 'Νέο μήνυμα χρήστη', body: String(f.msg || '').slice(0, 160) };
        for (const a of admins) {
          const subs = await g('push_subs?user_id=eq.' + encodeURIComponent(a) + '&select=id,sub');
          for (const r of subs) { try { await px.sendNotification(r.sub, JSON.stringify(msg), { TTL: 86400 }); sent++; } catch (e) { if (e.statusCode === 404 || e.statusCode === 410) await fetch(env.SUPABASE_URL + '/rest/v1/push_subs?id=eq.' + encodeURIComponent(r.id), { method: 'DELETE', headers: H }).catch(() => {}); } }
          await fetch(env.SUPABASE_URL + '/rest/v1/notif_log', { method: 'POST', headers: { ...H, 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify({ id: 'fb:' + f.at, user_id: a, kind: 'fb', title: msg.title, body: msg.body, at: new Date().toISOString() }) }).catch(() => {});
        }
      }
      return J({ ok: true, sent, n: fresh.length });
    } catch (e) { return J({ ok: false, error: e.message }, 500); }
  }
  return J({ ok: false, error: 'bad request' }, 400);
});
