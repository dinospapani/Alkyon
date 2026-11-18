// Alkyon · unit tests: ψεύτικος server PostgREST (μόνο όσα χρειάζεται ο συγχρονισμός) και «συσκευές» που τρέχουν το πραγματικό v4/store.js σε Node vm.
// Ο server κάνει ό,τι και ο πραγματικός μετά το sql/2026-11-18-p0-trust.sql: updated_at από το ρολόι του server και απόρριψη παλιότερης έκδοσης (records_touch).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

export class FakeServer {
  constructor({ maxRows = 1000, guard = true, trigger = true } = {}) {
    this.trigger = trigger; if (!trigger) guard = false;
    this.rows = new Map(); this.clock = Date.parse('2026-11-18T10:00:00Z') * 1000; this.maxRows = maxRows; this.guard = guard;
    this.gets = 0; this.posts = 0; this.failGet = null; this.sentRows = 0;
  }
  now() { this.clock += 37; const ms = Math.floor(this.clock / 1000), us = String(this.clock % 1000).padStart(3, '0'); return new Date(ms).toISOString().replace('Z', us + '+00:00'); }
  key(u, k, id) { return u + '|' + k + '|' + id; }
  /* γράψιμο όπως από άλλη συσκευή / το ρολόι (μέσα από τον server) */
  upsert(uid, row) {
    const k = this.key(uid, row.kind, row.id), old = this.rows.get(k);
    const nu = +(row.data && row.data._u), ou = old ? +(old.data && old.data._u) : NaN;
    if (this.guard && old && Number.isFinite(nu) && Number.isFinite(ou) && nu < ou) return false;
    /* χωρίς τον trigger (πριν το migration): το updated_at είναι ό,τι στείλει ο client */
    const ua = !this.trigger && row.updated_at ? FakeServer.norm(row.updated_at) : this.now();
    this.rows.set(k, { user_id: uid, kind: row.kind, id: row.id, data: row.data || {}, deleted: !!row.deleted, updated_at: ua });
    return true;
  }
  list(uid) { return [...this.rows.values()].filter(r => r.user_id === uid); }
  get(uid, kind, id) { return this.rows.get(this.key(uid, kind, id)); }
  /* PostgREST: φίλτρα που χρησιμοποιεί ο client */
  static unq(v) { v = decodeURIComponent(v); return v.startsWith('"') ? v.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\') : v; }
  static cmpTs(a, b) { const pa = Date.parse(a.slice(0, 23) + 'Z'), pb = Date.parse(b.slice(0, 23) + 'Z'); if (pa !== pb) return pa < pb ? -1 : 1; const ua = +(a.slice(23, 26) || 0), ub = +(b.slice(23, 26) || 0); return ua === ub ? 0 : ua < ub ? -1 : 1; }
  static norm(ts) { /* ISO από τον client (π.χ. 2026-…Z) → ίδια μορφή με του server */ if (/\+00:00$/.test(ts)) return ts; const d = new Date(ts); return d.toISOString().replace('Z', '000+00:00'); }
  handle(method, url, body) {
    const u = new URL(url), p = u.pathname.replace(/^\/rest\/v1\//, ''), q = u.searchParams;
    if (p === 'rpc/alkyon_sync_version') { this.rpcCalls = (this.rpcCalls || 0) + 1; return this.trigger ? { status: 200, json: 2 } : { status: 404, json: { code: 'PGRST202' } }; }
    if (!p.startsWith('records')) return { status: 404, json: [] };
    const uidm = (q.get('user_id') || '').match(/^eq\.(.+)$/);
    if (method === 'GET') {
      this.gets++;
      if (this.failGet && this.failGet(this.gets)) return { status: 503, json: { message: 'temporarily unavailable' } };
      const uid = uidm ? uidm[1] : null; let a = this.list(uid);
      const kq = q.get('kind'), iq = q.get('id');
      if (kq) a = a.filter(r => r.kind === kq.replace(/^eq\./, ''));
      if (iq) { const ids = iq.replace(/^in\.\(|\)$/g, '').split(',').map(FakeServer.unq); a = a.filter(r => ids.includes(r.id)); }
      const ug = q.get('updated_at'); if (ug) { const t = FakeServer.norm(FakeServer.unq(ug.replace(/^gt\./, ''))); a = a.filter(r => FakeServer.cmpTs(r.updated_at, t) > 0); }
      const or = q.get('or');
      if (or) {
        const m = or.match(/^\(updated_at\.gt\.("(?:[^"\\]|\\.)*"),and\(updated_at\.eq\.("(?:[^"\\]|\\.)*"),kind\.gt\.("(?:[^"\\]|\\.)*")\),and\(updated_at\.eq\.("(?:[^"\\]|\\.)*"),kind\.eq\.("(?:[^"\\]|\\.)*"),id\.gt\.("(?:[^"\\]|\\.)*")\)\)$/);
        if (!m) throw new Error('unsupported or= ' + or);
        const T = FakeServer.unq(m[1]), K = FakeServer.unq(m[3]), I = FakeServer.unq(m[6]);
        a = a.filter(r => { const c = FakeServer.cmpTs(r.updated_at, T); return c > 0 || (c === 0 && (r.kind > K || (r.kind === K && r.id > I))); });
      }
      if (q.get('order')) a.sort((x, y) => FakeServer.cmpTs(x.updated_at, y.updated_at) || (x.kind < y.kind ? -1 : x.kind > y.kind ? 1 : 0) || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
      const lim = Math.min(+(q.get('limit') || 1e9), this.maxRows); a = a.slice(0, lim);
      this.sentRows += a.length;
      return { status: 200, json: a.map(r => ({ kind: r.kind, id: r.id, data: JSON.parse(JSON.stringify(r.data)), deleted: r.deleted, updated_at: r.updated_at })) };
    }
    if (method === 'POST') {
      this.posts++;
      const uid = this.authUid; const out = [];
      for (const r of JSON.parse(body)) if (this.upsert(uid, r)) out.push({ kind: r.kind, id: r.id });
      return { status: 201, json: out };
    }
    return { status: 405, json: {} };
  }
}

/* μία «συσκευή»: δικό της localStorage, το πραγματικό syncmerge.js + store.js, fetch προς τον ψεύτικο server */
export function device(server, { uid = 'u1', now = () => Date.now() } = {}) {
  const mem = new Map();
  const quota = { limit: Infinity };
  const localStorage = { getItem: k => mem.has(k) ? mem.get(k) : null, setItem: (k, v) => { if (String(v).length > quota.limit) { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; } mem.set(k, String(v)); }, removeItem: k => mem.delete(k), clear: () => mem.clear() };
  const ls = { get(k, d) { const v = localStorage.getItem(k); try { return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { localStorage.setItem(k, JSON.stringify(v)); } };
  const emitted = [];
  const AK = { T: (a) => a, ls, emit: (n) => emitted.push(n), prof: () => 'boat', EN: false, toast() {}, pest: () => false };
  const fetchFn = async (url, opt = {}) => {
    const method = (opt.method || 'GET').toUpperCase();
    if (/\/storage\/v1\//.test(url)) return resp(404, {});
    if (/\/auth\/v1\//.test(url)) return resp(200, {});
    server.authUid = (ls.get('alkyon-sess', null) || {}).uid || uid;
    const r = server.handle(method, url, opt.body);
    return resp(r.status, r.json, new Date(Math.floor(server.clock / 1000)).toUTCString());
  };
  function resp(status, json, date) { return { ok: status >= 200 && status < 300, status, headers: { get: h => h === 'date' ? (date || null) : null }, json: async () => json, text: async () => JSON.stringify(json), blob: async () => null }; }
  const timers = [];
  const ctx = {
    window: null, AK, localStorage, fetch: fetchFn, console,
    navigator: { onLine: true, userAgent: 'node', storage: null },
    document: { addEventListener() {}, hidden: false, createElement() { return {}; } },
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, clearTimeout() {},
    Date, Math, JSON, Promise, Object, Array, String, Number, Error, encodeURIComponent, decodeURIComponent, isFinite, URL,
  };
  ctx.window = ctx; ctx.self = ctx;
  ctx.window.addEventListener = () => {};
  vm.createContext(ctx);
  vm.runInContext(SRC('v4/syncmerge.js'), ctx, { filename: 'syncmerge.js' });
  vm.runInContext(SRC('v4/store.js'), ctx, { filename: 'store.js' });
  ls.set('alkyon-sess', { access_token: 't', refresh_token: 'r', exp: Date.now() + 3600e3, uid, email: uid + '@x' });
  const store = ctx.AK.store, cloud = ctx.AK.cloud;
  return { quota, ls, store, cloud, sync: () => cloud.sync(true), state: () => cloud.state(), mem, emitted, timers,
    recs: k => store.raw(k), rec: (k, id) => store.get(k, id), tombs: () => store.tombs() };
}
