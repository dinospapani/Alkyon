// Alkyon 1.9.50 · watchdog: τρέχει στο GitHub Actions κάθε 30 λεπτά. Αν ο server (quick-processor) δεν έχει γράψει heartbeat
// για πάνω από 30 λεπτά, στέλνει μήνυμα Telegram στους διαχειριστές (το πολύ μία φορά ανά 6 ώρες) και ένα όταν ξαναρχίσει.
// Χρειάζεται τα secrets SUPABASE_SERVICE_KEY και TELEGRAM_BOT_TOKEN (τα ίδια με το «Alkyon safety»).
const URL_ = process.env.SUPABASE_URL || 'https://sgfohmqwdwtkhtrebnix.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_KEY, TG = process.env.TELEGRAM_BOT_TOKEN;
if (!KEY || !TG) { console.log('Λείπουν τα SUPABASE_SERVICE_KEY / TELEGRAM_BOT_TOKEN.'); process.exit(1); }
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };
const obj = p => URL_ + '/storage/v1/object/backups/_system/' + p;
const getJ = async p => { const r = await fetch(obj(p), { headers: H }); return r.ok ? r.json() : null; };
const putJ = (p, o) => fetch(obj(p), { method: 'POST', headers: { ...H, 'Content-Type': 'application/json', 'x-upsert': 'true' }, body: JSON.stringify(o) });
const rest = async p => { const r = await fetch(URL_ + '/rest/v1/' + p, { headers: H }); if (!r.ok) throw new Error('Supabase ' + r.status); return r.json(); };
const admins = async () => {
  const a = await rest('app_admins?select=user_id'); if (!a.length) return [];
  const c = await rest(`safety_contacts?user_id=in.(${a.map(x => x.user_id).join(',')})&select=self_chat_id`);
  return c.map(x => Number(x.self_chat_id)).filter(x => x && !isNaN(x));
};
const send = async text => { for (const chat of await admins()) await fetch(`https://api.telegram.org/bot${TG}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chat, text }) }); };
const hb = await getJ('heartbeat.json'), wd = (await getJ('watchdog.json')) || {};
const at = hb && hb.at ? Date.parse(hb.at) : 0, age = Math.round((Date.now() - at) / 60000), now = Date.now();
console.log('heartbeat:', hb ? hb.at : 'κανένα', '· πριν από', age, 'λεπτά');
if (!at || age > 30) {
  if (!wd.down || now - (wd.alerted || 0) > 6 * 3600000) {
    await send(`⚠ Alkyon server: δεν έχει τρέξει εδώ και ${at ? age + ' λεπτά' : 'άγνωστο χρόνο'}. Οι ειδοποιήσεις (ασφάλεια, πρόγνωση, καλαμάρια) δεν φεύγουν. Έλεγξε το Supabase › Edge Functions › quick-processor και το Cron.`);
    await putJ('watchdog.json', { down: true, alerted: now });
  }
} else if (wd.down) {
  await send('✅ Alkyon server: τρέχει ξανά κανονικά.');
  await putJ('watchdog.json', { down: false, alerted: 0 });
}
