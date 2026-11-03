// Τρέχει στο GitHub Actions κάθε ~5 λεπτά. Στέλνει αυτόματα ειδοποίηση ασφαλείας (Telegram και email)
// όταν μια έξοδος δεν έχει επιβεβαιωθεί μετά την ώρα επιστροφής, όταν χαθεί η επαφή με το κινητό (πρώτα ρωτάει τον ψαρά στο Telegram)
// ή όταν η μπαταρία είναι πολύ χαμηλή. Στέλνει επίσης "ξεκίνησε" και "γύρισε ασφαλής".
import { pathToFileURL } from 'node:url';

const TZ = 'Asia/Nicosia';
const hm = iso => new Intl.DateTimeFormat('el-GR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
const hash32 = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
const mapLink = (la, lo) => (la != null && lo != null) ? `https://maps.google.com/?q=${(+la).toFixed(5)},${(+lo).toFixed(5)}` : '';

export async function run({ env, fetch: F = fetch, sendMail, log = console.log, PF = null, webpush = null, only = null }) {
  const URL_ = env.SUPABASE_URL, KEY = env.SUPABASE_SERVICE_KEY, TG = env.TELEGRAM_BOT_TOKEN;
  if (!URL_ || !KEY) { log('Λείπουν τα SUPABASE_URL / SUPABASE_SERVICE_KEY.'); return { ok: false }; }
  const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
  const sb = async (path, opt = {}) => {
    const r = await F(URL_ + '/rest/v1/' + path, { ...opt, headers: { ...H, ...(opt.headers || {}) } });
    if (!r.ok) throw new Error('Supabase ' + r.status + ' ' + (await r.text()).slice(0, 160));
    const t = await r.text(); return t ? JSON.parse(t) : null;
  };
  const tg = async (method, body) => {
    const r = await F(`https://api.telegram.org/bot${TG}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({})); if (!j.ok) throw new Error('Telegram ' + (j.description || r.status)); return j.result;
  };
  const stats = { linked: 0, start: 0, alert: 0, clear: 0, ping: 0, silence: 0, lowbat: 0, ok: 0, fc: 0, pa: 0 };
  const PING_WAIT_MIN = 15, LOWBAT = 10;
  const patch = (id, o) => sb(`safety_trips?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(o) });
  const contactOf = async uid => { const r = await sb(`safety_contacts?user_id=eq.${uid}&select=*`); return r && r[0]; };

  // 1) Σύνδεση επαφών Telegram: /start ΚΩΔΙΚΟΣ
  if (TG) {
    try {
      const ups = await tg('getUpdates', { timeout: 0, allowed_updates: ['message', 'callback_query'] });
      let last = null;
      for (const u of ups || []) {
        last = u.update_id;
        const cq = u.callback_query;
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
  // 6) Πρόγνωση: ειδοποιήσεις push για καλές μέρες ψαρέματος στις τοποθεσίες κάθε χρήστη (έλεγχος κάθε ~3 ώρες)
  if (PF && webpush) {
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
        const res = await PF.checkPlaces({ plans, onlyPlans: quietNow, front: !!(r.places || []).find(p => p && p.front === 'on'), lang, sp: ((r.places || []).find(p => p && p.sp) || {}).sp || null, places: r.places || [], threshold: r.threshold || 75, pressure: r.pressure !== false, wind: r.wind || null, turn: turnOn, notified: r.state || {}, area }, F);
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
  // 8) v31z543: κατά την έξοδο, και με κλειστό κινητό: (α) καιρός που χαλάει τις επόμενες 3 ώρες στη θέση της εξόδου (καταιγίδα, άνεμος/ριπές/κύμα πάνω από τα όριά σου),
  //    (β) «ώρα να γυρίσεις»: απόσταση από το λιμάνι σου και ταχύτητα επιστροφής σε σχέση με τη δύση και την ώρα επιστροφής που δήλωσες. Έλεγχος ανά ~15 λεπτά.
  try {
    if (webpush && new Date().getUTCMinutes() % 15 < 5) {
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
    }
  } catch (e) { log('Καιρός εξόδου: ' + e.message); }
  log('Safety job: ' + JSON.stringify(stats));
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
    new Function('self', fs.readFileSync('forecast.js', 'utf8'))(g); PF = g.PF;
    if (process.env.VAPID_PUBLIC && process.env.VAPID_PRIVATE) {
      webpush = (await import('web-push')).default;
      webpush.setVapidDetails('https://dinospapani.github.io/Alkyon/', process.env.VAPID_PUBLIC, process.env.VAPID_PRIVATE);
    }
  } catch (e) { console.log('Πρόγνωση (push) ανενεργή: ' + e.message); PF = null; webpush = null; }
  const r = await run({ env: process.env, sendMail, PF, webpush });
  if (!r.ok) process.exit(1);
}
