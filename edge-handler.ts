// Alkyon quick-processor: ο handler της Edge Function (μπαίνει στο τέλος του quick-processor-index.ts από το build_edge.py)
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
  const secret = Deno.env.get('CRON_SECRET');
  const E = k => Deno.env.get(k) || '';
  /* 1.9.25: τα κλειδιά VAPID πρέπει να είναι base64url χωρίς «=» (το web-push απέρριπτε το κλειδί και δεν έφευγε καμία ειδοποίηση).
     Καθαρίζουμε κενά/εισαγωγικά, μετατρέπουμε + / σε - _ και κόβουμε τα = ώστε να δουλεύει όπως κι αν αποθηκεύτηκε. */
  const V = k => E(k).trim().replace(/^["']|["']$/g, '').replace(/\s+/g, '').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  /* και το token του Telegram χωρίς κενά/εισαγωγικά/«bot» μπροστά */
  const TGT = () => E('TELEGRAM_BOT_TOKEN').trim().replace(/^["']|["']$/g, '').replace(/^bot/i, '');
  const env = {
    SUPABASE_URL: E('SUPABASE_URL'),
    SUPABASE_SERVICE_KEY: E('SERVICE_KEY') || E('SUPABASE_SERVICE_ROLE_KEY'),
    TELEGRAM_BOT_TOKEN: TGT(),
  };
  const isCron = !!secret && req.headers.get('x-cron-secret') === secret;
  if (!isCron) {
    // Διαδρομή εφαρμογής: άμεσο «ξεκίνησε/γύρισε» για μία έξοδο του συνδεδεμένου χρήστη (έλεγχος με το token του χρήστη).
    const auth = req.headers.get('authorization') || '';
    if (!/^Bearer\s+\S+/.test(auth)) return J({ ok: false, error: 'forbidden' }, 403);
    let body = {}; try { body = await req.json(); } catch (e) { /* κενό */ }
    // v31z351: δοκιμαστική ειδοποίηση push σε όλες τις συσκευές του συνδεδεμένου χρήστη (ελέγχει όλη την αλυσίδα server → κινητό)
    if (body && body.action === 'test') {
      try {
        const u = await fetch(env.SUPABASE_URL + '/auth/v1/user', { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: auth } });
        if (!u.ok) return J({ ok: false, error: 'unauthorized' }, 401);
        const uid = (await u.json()).id; if (!uid) return J({ ok: false, error: 'unauthorized' }, 401);
        const hasV = !!(E('VAPID_PUBLIC') && E('VAPID_PRIVATE'));
        if (!hasV && !fcmSA() && !apnsCfg()) return J({ ok: false, error: 'VAPID secrets missing' });
        if (hasV && !vapidSet) { webpush.setVapidDetails('https://dinospapani.github.io/Alkyon/', V('VAPID_PUBLIC'), V('VAPID_PRIVATE')); vapidSet = true; }
        const px = pushx(hasV ? webpush : null);
        const sr = await fetch(env.SUPABASE_URL + '/rest/v1/push_subs?user_id=eq.' + encodeURIComponent(uid) + '&select=id,sub,checked_at,turn', { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_KEY } });
        const subs = sr.ok ? await sr.json() : [];
        let sent = 0, gone = 0, err = '';
        const at = new Date().toISOString();
        for (const r of subs || []) {
          try { await px.sendNotification(r.sub, JSON.stringify({ title: 'Alkyon ✓', body: body.lang === 'en' ? 'Test notification from the server. Alerts reach this phone.' : 'Δοκιμαστική ειδοποίηση από τον server. Οι ειδοποιήσεις φτάνουν σε αυτό το κινητό.', kind: 'test', id: 'test-' + at, tag: 'alk-test', at }), { TTL: 600 }); sent++; }
          catch (e) { if (e.statusCode === 404 || e.statusCode === 410) { gone++; await fetch(env.SUPABASE_URL + '/rest/v1/push_subs?id=eq.' + encodeURIComponent(r.id), { method: 'DELETE', headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_KEY } }); } else err = String(e.statusCode || '') + ' ' + e.message; }
        }
        const last = (subs || []).map(r => r.checked_at).filter(Boolean).sort().pop() || null;
        return J({ ok: true, subs: (subs || []).length, sent, gone, err, last_check: last, turn: (subs || []).some(r => r.turn === true) });
      } catch (e) { return J({ ok: false, error: e.message }, 500); }
    }
    // 1.9.61: άμεση ειδοποίηση Κοινότητας: η εφαρμογή το καλεί αμέσως μετά από νέο ψάρι, like ή σχόλιο (ο cron κάθε 5′ μένει εφεδρικός· το notif_log εμποδίζει διπλή αποστολή)
    if (body && body.action === 'comm') {
      try {
        const u = await fetch(env.SUPABASE_URL + '/auth/v1/user', { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: auth } });
        if (!u.ok) return J({ ok: false, error: 'unauthorized' }, 401);
        const hasV = !!(E('VAPID_PUBLIC') && E('VAPID_PRIVATE'));
        if (!hasV && !fcmSA() && !apnsCfg()) return J({ ok: false, error: 'VAPID secrets missing' });
        if (hasV && !vapidSet) { webpush.setVapidDetails('https://dinospapani.github.io/Alkyon/', V('VAPID_PUBLIC'), V('VAPID_PRIVATE')); vapidSet = true; }
        const r = await run({ env, PF, webpush: pushx(hasV ? webpush : null), sendMail: null, log: m => console.log(String(m)), only: { comm: true } });
        return J({ ok: true, stats: r.stats });
      } catch (e) { return J({ ok: false, error: e.message }, 500); }
    }
    if (!body || body.action !== 'trip' || !/^[\w.-]{3,80}$/.test(String(body.id || '')) || !['start', 'end'].includes(body.phase)) return J({ ok: false, error: 'bad request' }, 400);
    try {
      const u = await fetch(env.SUPABASE_URL + '/auth/v1/user', { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: auth } });
      if (!u.ok) return J({ ok: false, error: 'unauthorized' }, 401);
      const uid = (await u.json()).id; if (!uid) return J({ ok: false, error: 'unauthorized' }, 401);
      const r = await run({ env, sendMail: null, log: m => console.log(String(m)), only: { uid, id: body.id, phase: body.phase } });
      return J(r);
    } catch (e) { console.log('trip error: ' + e.message); return J({ ok: false, error: e.message }, 500); }
  }
  let wp = null;
  if (E('VAPID_PUBLIC') && E('VAPID_PRIVATE')) {
    try {
      if (!vapidSet) { webpush.setVapidDetails('https://dinospapani.github.io/Alkyon/', V('VAPID_PUBLIC'), V('VAPID_PRIVATE')); vapidSet = true; }
      wp = webpush;
    } catch (e) { console.log('VAPID: ' + e.message); }
  }
  const logs = [];
  try {
    const r = await run({ env, PF, webpush: (wp || fcmSA() || apnsCfg()) ? pushx(wp) : null, sendMail: null, log: m => { logs.push(String(m)); console.log(m); } });
    return new Response(JSON.stringify({ ok: r.ok, stats: r.stats, logs }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.log('cron error: ' + e.message);
    return new Response(JSON.stringify({ ok: false, error: e.message, logs }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
