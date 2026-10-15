// Local API: json-server on http://localhost:3001/api, reading and writing ./db.json.
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { fileStorage } from './storage.js';

const dbPath = fileURLToPath(new URL('../db.json', import.meta.url));
const port = Number(process.env.API_PORT) || 3001;
const app = await createApp({ storage: fileStorage(dbPath), adminToken: process.env.EDITOR_KEY || '' });
app.listen(port, () => console.log('json-server API on http://localhost:' + port + '/api  (data: db.json)'));
