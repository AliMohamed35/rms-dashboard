// Where db.json lives. json-server keeps the data in memory; a storage adapter loads it before
// each request and persists it after each change.
//   - fileStorage: the local db.json (development, or any host with a disk)
//   - blobStorage: one private JSON file in Vercel Blob (Vercel's filesystem is read-only)
//   - seedStorage: the bundled db.json, read-only (Vercel without a Blob store connected)
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
    writable: true,
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

export function seedStorage(path) {
  let cache = null;
  return {
    writable: false,
    async read() {
      cache ??= JSON.parse(await readFile(path, 'utf8'));
      return structuredClone(cache);
    },
    async write() { throw new ReadOnlyError(); },
  };
}

export function blobStorage(seedPath, { pathname = 'rms/db.json', access = 'private' } = {}) {
  let cache = null, etag = null;
  const seed = seedStorage(seedPath);
  return {
    writable: true,
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
