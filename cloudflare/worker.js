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
  }
};
