// Talks to json-server (server/app.js). Locally Vite proxies /api to it; on Vercel /api is a function.
const BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');
const KEY_STORE = 'rms-editor-key';

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const storedKey = () => { try { return localStorage.getItem(KEY_STORE) || ''; } catch { return ''; } };
const storeKey = (k) => { try { if (k) localStorage.setItem(KEY_STORE, k); else localStorage.removeItem(KEY_STORE); } catch { /* private window */ } };

async function request(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...(method !== 'GET' && storedKey() ? { 'X-Editor-Key': storedKey() } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Can’t reach the API at ' + BASE + '. Is json-server running (npm run dev)?');
  }
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
  if (!res.ok) throw new ApiError(res.status, (data && data.error) || res.status + ' ' + res.statusText);
  return data;
}

/** Writes ask for the editor key once (when the server has EDITOR_KEY set) and remember it in this browser. */
async function write(path, body) {
  try {
    return await request(path, { method: 'POST', body });
  } catch (e) {
    if (e.status !== 401) throw e;
    storeKey('');
    const key = window.prompt('Enter the editor key to save changes:');
    if (!key) throw new ApiError(401, 'Saving needs the editor key.');
    storeKey(key.trim());
    try { return await request(path, { method: 'POST', body }); } catch (e2) { if (e2.status === 401) storeKey(''); throw e2; }
  }
}

export const api = {
  meta: () => request('/_meta'),
  db: () => request('/db'),
  lastChange: () => request('/_history/last'),
  save: (label, ops) => write('/_save', { label, ops }),
  undo: (id) => write('/_undo', { id }),
};
