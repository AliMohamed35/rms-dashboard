// The API: json-server serves every collection of db.json read-only under /api (GET /api/snapshot_log,
// GET /api/team_history?month=2026-10, ...). Every change goes through POST /api/_save, which applies
// it atomically and records the inverse in `history`, so POST /api/_undo can roll back the last one.
import { timingSafeEqual } from 'node:crypto';
import jsonServer from 'json-server';

const EDITABLE = new Set(['snapshot_log', 'team_history', 'roster_changes', 'closed_months', 'vacation_days', 'vacation_summary']);
const PRIVATE = new Set(['history']);
const HISTORY_LIMIT = 20;
const MAX_BODY = 4 * 1024 * 1024;
export const keyField = (collection) => (collection === 'roster_changes' ? 'id' : 'key');

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

async function readJson(req) {
  // On Vercel the body may already be parsed onto req.body; locally we read the stream.
  if (req.body != null && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) return JSON.parse(String(req.body) || '{}');
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > MAX_BODY) throw new HttpError(413, 'The upload is too large.'); chunks.push(c); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { throw new HttpError(400, 'The request body is not valid JSON.'); }
}

function sameToken(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

// Applies upserts/deletes by key and returns the ops that undo them.
function applyOps(state, ops) {
  const inverse = [];
  for (const op of ops) {
    const { collection } = op;
    if (!EDITABLE.has(collection)) throw new HttpError(400, 'Collection "' + collection + '" cannot be changed.');
    const kf = keyField(collection);
    const upsert = Array.isArray(op.upsert) ? op.upsert : [];
    const del = Array.isArray(op.delete) ? op.delete.map(String) : [];
    if (upsert.some((r) => !r || typeof r !== 'object' || r[kf] == null)) throw new HttpError(400, 'Every row in ' + collection + ' needs a "' + kf + '".');
    const touched = new Set([...del, ...upsert.map((r) => String(r[kf]))]);
    const rows = state[collection] ?? [];
    const before = rows.filter((r) => touched.has(String(r[kf])));
    state[collection] = rows.filter((r) => !touched.has(String(r[kf]))).concat(upsert);
    inverse.push({ collection, delete: upsert.map((r) => String(r[kf])), upsert: before });
  }
  return inverse;
}

const publicState = (state) => Object.fromEntries(Object.entries(state).filter(([k]) => !PRIVATE.has(k)));
const lastUndoable = (state) => [...(state.history ?? [])].reverse().find((h) => !h.undone) ?? null;
const summary = (h) => (h ? { id: h.id, label: h.label, at: h.at } : null);

export async function createApp({ storage, adminToken = '' }) {
  const app = jsonServer.create();
  // json-server builds its routes from the collections present at start-up.
  const router = jsonServer.router(publicState(await storage.read()));
  let queue = Promise.resolve();
  const exclusive = (fn) => { const run = queue.then(fn, fn); queue = run.catch(() => {}); return run; };

  app.disable('x-powered-by');
  // Vercel rewrites /api/* to this function with the original path; locally the app is mounted the same way.
  app.use((req, _res, next) => { if (!req.url.startsWith('/api')) req.url = '/api' + (req.url.startsWith('/') ? '' : '/') + req.url; next(); });

  const api = jsonServer.create();
  api.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (req.method !== 'GET' && req.method !== 'HEAD' && adminToken && !sameToken(req.get('x-editor-key') || '', adminToken))
      return res.status(401).json({ error: 'This change needs the editor key.' });
    next();
  });

  api.get('/_meta', (_req, res) => res.json({ writable: storage.writable, auth: Boolean(adminToken) }));

  api.get('/db', async (_req, res, next) => {
    try { res.json(publicState(await storage.read())); } catch (e) { next(e); }
  });

  api.get('/_history/last', async (_req, res, next) => {
    try { res.json(summary(lastUndoable(await storage.read()))); } catch (e) { next(e); }
  });

  api.post('/_save', async (req, res, next) => {
    try {
      const body = await readJson(req);
      const label = String(body.label || 'Change').slice(0, 200);
      if (!Array.isArray(body.ops) || !body.ops.length) throw new HttpError(400, 'Nothing to save.');
      const entry = await exclusive(async () => {
        const state = await storage.read();
        const inverse = applyOps(state, body.ops);
        const h = { id: 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), at: new Date().toISOString(), label, undo: inverse, undone: false };
        state.history = [...(state.history ?? []), h].slice(-HISTORY_LIMIT);
        await storage.write(state);
        return h;
      });
      res.status(201).json(summary(entry));
    } catch (e) { next(e); }
  });

  api.post('/_undo', async (req, res, next) => {
    try {
      const body = await readJson(req);
      const done = await exclusive(async () => {
        const state = await storage.read();
        const h = lastUndoable(state);
        if (!h) throw new HttpError(404, 'There is nothing to undo.');
        if (body.id && body.id !== h.id) throw new HttpError(409, 'The last change is no longer "' + body.id + '". Reload the page and try again.');
        applyOps(state, h.undo);
        h.undone = true; h.undone_at = new Date().toISOString();
        await storage.write(state);
        return h;
      });
      res.json(summary(done));
    } catch (e) { next(e); }
  });

  // Everything else is plain json-server, read-only, loaded fresh from storage.
  api.use(async (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(405).json({ error: 'Use POST /api/_save to change data.' });
    if (PRIVATE.has(req.path.split('/')[1])) return res.status(404).json({});
    try {
      router.db.setState(publicState(await storage.read()));
      next();
    } catch (e) { next(e); }
  });
  api.use(router);

  app.use('/api', api);
  app.use((req, res) => res.status(404).json({ error: 'Not found: ' + req.method + ' ' + req.url }));
  app.use((err, _req, res, _next) => {
    const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    if (status === 500) console.error(err);
    res.status(status).json({ error: status === 500 ? 'Server error: ' + (err.message || 'unknown') : err.message });
  });
  return app;
}
