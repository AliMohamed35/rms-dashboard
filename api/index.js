// Vercel serverless function: the same json-server app as local dev, mounted at /api.
// Vercel's filesystem is read-only, so db.json is stored in one of:
//   1. the GitHub repo itself (a GitHub token is set): each save is a commit to db.json
//   2. Vercel Blob (BLOB_READ_WRITE_TOKEN is set)
//   3. nowhere: the bundled db.json is served read-only
import path from 'node:path';
import { createApp } from '../server/app.js';
import { githubConfig } from '../server/config.js';
import { blobStorage, githubStorage, seedStorage } from '../server/storage.js';

const seed = path.join(process.cwd(), 'db.json');
const gh = githubConfig(process.env);
const storage = gh ? githubStorage(seed, gh)
  : process.env.BLOB_READ_WRITE_TOKEN ? blobStorage(seed, { access: process.env.BLOB_ACCESS === 'public' ? 'public' : 'private' })
  : seedStorage(seed);
const appPromise = createApp({ storage, adminToken: process.env.EDITOR_KEY || '' });

// vercel.json rewrites /api/<path> to this function and passes <path> as ?__path=; restore the real path for Express.
function restorePath(req) {
  const url = new URL(req.url, 'http://localhost');
  const p = url.searchParams.get('__path');
  if (p == null) return;
  url.searchParams.delete('__path');
  req.url = '/api/' + p.replace(/^\/+/, '') + url.search;
  // Vercel may have pre-parsed req.query (with __path in it); json-server would read that as a filter.
  Object.defineProperty(req, 'query', { value: undefined, writable: true, configurable: true, enumerable: true });
}

export default async function handler(req, res) {
  const app = await appPromise;
  restorePath(req);
  return app(req, res);
}
