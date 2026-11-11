/* Alkyon · Cloudflare Worker για το alkyonfishing.com.
   Τα αρχεία της εφαρμογής σερβίρονται ως static assets (φάκελος dist/web, από το tools/build-web.mjs).
   Ο Worker τρέχει πρώτος μόνο για:
   - /.well-known/assetlinks.json: σωστό Content-Type, για την επαλήθευση των App Links του Android
   (Το /privacy το σερβίρουν μόνα τους τα assets από το privacy.html· το html_handling στέλνει το /privacy.html → /privacy.)
   Όλα τα υπόλοιπα πάνε κατευθείαν στα αρχεία (env.ASSETS). */
export default {
  async fetch(req, env) {
    const u = new URL(req.url);
    if (u.pathname === '/.well-known/assetlinks.json') {
      const r = await env.ASSETS.fetch(req);
      const h = new Headers(r.headers); h.set('Content-Type', 'application/json'); h.set('Access-Control-Allow-Origin', '*');
      return new Response(r.body, { status: r.status, headers: h });
    }
    return env.ASSETS.fetch(req);
  },
  /* 1.12.12: κάθε 15′ ξεκινά τη μετατροπή του ραντάρ του ΤΜ Κύπρου στο GitHub (radar-sync.yml).
     Το χρονόμετρο του GitHub τρέχει στην πράξη περίπου μία φορά την ώρα· αυτό κάνει τις εικόνες πιο φρέσκες.
     Χρειάζεται το secret GH_DISPATCH_TOKEN (fine-grained token μόνο για το Alkyon, δικαίωμα Actions: read and write). */
  async scheduled(event, env, ctx) {
    if (!env.GH_DISPATCH_TOKEN) return;
    ctx.waitUntil(fetch('https://api.github.com/repos/dinospapani/Alkyon/actions/workflows/radar-sync.yml/dispatches', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + env.GH_DISPATCH_TOKEN, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'alkyon-radar-cron', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: 'main' })
    }).then(r => { if (r.status !== 204) return r.text().then(t => console.log('dispatch', r.status, t.slice(0, 200))); }).catch(e => console.log('dispatch error', String(e))));
  }
};
