// Where db.json lives. json-server keeps the data in memory; a storage adapter loads it before
// each request and persists it after each change.
//   - fileStorage:   the local db.json (development, or any host with a disk)
//   - githubStorage: db.json in the GitHub repo, read and committed through the GitHub API (Vercel)
//   - blobStorage:   one private JSON file in Vercel Blob (Vercel, alternative to GitHub)
//   - seedStorage:   the bundled db.json, read-only (nothing configured)
import { createHash } from 'node:crypto';
import { readFile, writeFile, rename, stat } from 'node:fs/promises';

export class ReadOnlyError extends Error {
  constructor() {
    super('Saving is turned off on this deployment: connect a Vercel Blob store to the project (Storage → Blob) and redeploy.');
    this.status = 503;
  }
}

export class ConflictError extends Error {
  constructor() {
    super('Someone else saved a change at the same moment. Reload the page and try again.');
    this.status = 409;
  }
}

export function fileStorage(path) {
  let cache = null, mtime = 0;
  return {
    kind: 'file',
    writable: true,
    problem: null,
    async read() {
      const s = await stat(path);
      if (!cache || s.mtimeMs !== mtime) { cache = JSON.parse(await readFile(path, 'utf8')); mtime = s.mtimeMs; }
      return structuredClone(cache);
    },
    async write(state) {
      const tmp = path + '.tmp';
      await writeFile(tmp, JSON.stringify(state, null, 2));
      await rename(tmp, path);
      cache = structuredClone(state); mtime = (await stat(path)).mtimeMs;
    },
  };
}

export function seedStorage(path, problem = 'no GitHub token or Blob store is configured on this deployment.') {
  let cache = null;
  return {
    kind: 'readonly',
    writable: false,
    problem,
    async read() {
      cache ??= JSON.parse(await readFile(path, 'utf8'));
      return structuredClone(cache);
    },
    async write() { throw new ReadOnlyError(); },
  };
}

/**
 * db.json inside a GitHub repository. Reads use the raw contents API with ETags (a 304 is free and doesn't count
 * against the rate limit); each save is one commit, guarded by the file's blob SHA so concurrent saves can't
 * overwrite each other. With several tokens configured, the first one that can access the repo is used. If GitHub
 * can't be reached or no token has access, the bundled db.json is served read-only and `problem` says why.
 */
export function githubStorage(seedPath, { token, tokens = [{ token, source: 'token' }], owner, repo, branch = 'main', path = 'db.json', apiBase = 'https://api.github.com' }) {
  const seed = seedStorage(seedPath);
  const url = `${apiBase}/repos/${owner}/${repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;
  const where = `${owner}/${repo} (${branch}:${path})`;
  const headersFor = (t) => ({ Authorization: 'Bearer ' + t.token, 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'rms-dashboard' });
  const blobSha = (buf) => createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');
  const detail = async (res) => { try { return (await res.json()).message || ''; } catch { return ''; } };
  let active = 0, cache = null, sha = null, etag = null, recent = null;

  /** e.g. "GITHUB_TOKEN (…f3a9, GitHub account alice)": enough to identify a token without revealing it. */
  const describe = async (t) => {
    let who = '';
    try {
      const r = await fetch(apiBase + '/user', { headers: { ...headersFor(t), Accept: 'application/vnd.github+json' } });
      who = r.ok ? ', GitHub account ' + (await r.json()).login : r.status === 401 ? ', rejected by GitHub as invalid or expired' : '';
    } catch { /* offline */ }
    return `${t.source} (…${t.token.slice(-4)}${who})`;
  };

  /** GET db.json with one token: { res } when usable, { missing } when the file isn't there yet, { fail } when the token has no access. */
  const attempt = async (t, conditional) => {
    const res = await fetch(url + '?ref=' + encodeURIComponent(branch), {
      headers: { ...headersFor(t), Accept: 'application/vnd.github.raw+json', ...(conditional && etag && cache ? { 'If-None-Match': etag } : {}) },
      cache: 'no-store',
    });
    if (res.ok || res.status === 304) return { res };
    if (res.status === 404) {
      // Either the file isn't on this branch yet (the first save creates it) or the token can't see the repo.
      const repoRes = await fetch(`${apiBase}/repos/${owner}/${repo}`, { headers: { ...headersFor(t), Accept: 'application/vnd.github+json' } });
      return repoRes.ok ? { missing: true } : { fail: repoRes.status + ' ' + (await detail(repoRes)) };
    }
    if (res.status === 401 || res.status === 403) return { fail: res.status + ' ' + (await detail(res)) };
    return { error: `GitHub answered ${res.status} ${await detail(res)}`.trim() };
  };

  const self = {
    kind: 'github',
    writable: true,
    problem: null,
    async read() {
      let out = null;
      const failures = [];
      try {
        for (let i = 0; i < tokens.length && !out; i++) {
          const idx = (active + i) % tokens.length;
          const r = await attempt(tokens[idx], idx === active);
          if (r.fail) { failures.push({ t: tokens[idx], why: r.fail.trim() }); continue; }
          if (idx !== active) { active = idx; etag = null; }
          out = r;
        }
      } catch (e) {
        self.problem = 'can’t reach GitHub (' + e.message + ').';
        return cache ? structuredClone(cache) : seed.read();
      }
      if (!out) {
        const tried = await Promise.all(failures.map(async (f) => (await describe(f.t)) + ': ' + f.why));
        self.problem = `no GitHub token can read ${where}. Tried ${tried.join('; ')}. In the token’s settings on GitHub set Resource owner to ${owner}, `
          + `add ${owner}/${repo} under Repository access, and set Contents to "Read and write".`;
        return seed.read();
      }
      if (out.error) { self.problem = out.error; return cache ? structuredClone(cache) : seed.read(); }
      self.problem = null;
      if (out.missing) { sha = null; cache = await seed.read(); return structuredClone(cache); }
      const res = out.res;
      if (res.status === 304) return structuredClone(cache);
      const buf = Buffer.from(await res.arrayBuffer());
      const fetchedSha = blobSha(buf);
      // Right after our own save, GitHub may briefly still serve the previous version: keep ours.
      if (recent && fetchedSha !== recent.sha && Date.now() - recent.at < 15000) return structuredClone(cache);
      cache = JSON.parse(buf.toString('utf8')); sha = fetchedSha; etag = res.headers.get('etag');
      return structuredClone(cache);
    },
    async write(state, label = 'Update data') {
      if (self.problem) throw Object.assign(new Error('Saving is turned off: ' + self.problem), { status: 503 });
      const t = tokens[active];
      const text = JSON.stringify(state, null, 2) + '\n';
      const res = await fetch(url, {
        method: 'PUT',
        headers: { ...headersFor(t), Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Dashboard data: ' + label, content: Buffer.from(text, 'utf8').toString('base64'), branch, ...(sha ? { sha } : {}) }),
      });
      if (res.status === 409 || res.status === 422) { etag = null; throw new ConflictError(); }
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        const why = res.status + ' ' + (await detail(res));
        throw Object.assign(new Error(`Couldn’t save to GitHub: the token ${await describe(t)} can read ${where} but not write to it. `
          + `In the token’s settings on GitHub set Contents to "Read and write". (${why.trim()})`), { status: 502 });
      }
      if (!res.ok) throw Object.assign(new Error(`Couldn’t save to GitHub: ${res.status} ${await detail(res)}`.trim()), { status: 502 });
      const out = await res.json();
      sha = out.content?.sha ?? blobSha(Buffer.from(text, 'utf8'));
      cache = structuredClone(state); etag = null; recent = { sha, at: Date.now() };
    },
  };
  return self;
}

export function blobStorage(seedPath, { pathname = 'rms/db.json', access = 'private' } = {}) {
  let cache = null, etag = null;
  const seed = seedStorage(seedPath);
  return {
    kind: 'blob',
    writable: true,
    problem: null,
    async read() {
      const { get, BlobNotFoundError } = await import('@vercel/blob');
      // useCache:false reads from origin, so a save is visible on the next request from any instance.
      let res;
      try { res = await get(pathname, { access, useCache: false, ...(etag ? { ifNoneMatch: etag } : {}) }); }
      catch (e) { if (e instanceof BlobNotFoundError) res = null; else throw e; }
      if (!res) { cache = await seed.read(); etag = null; return structuredClone(cache); } // first run: start from the bundled db.json
      if (res.statusCode === 200) { cache = await new Response(res.stream).json(); etag = res.blob.etag; }
      return structuredClone(cache);
    },
    async write(state) {
      const { put, BlobPreconditionFailedError } = await import('@vercel/blob');
      try {
        const out = await put(pathname, JSON.stringify(state), {
          access, contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 60,
          ...(etag ? { ifMatch: etag } : {}),
        });
        cache = structuredClone(state); etag = out.etag ?? null;
      } catch (e) {
        if (e instanceof BlobPreconditionFailedError) { etag = null; throw new ConflictError(); }
        throw e;
      }
    },
  };
}
