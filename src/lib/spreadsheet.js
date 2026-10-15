// Reads .ods, .xlsx, .csv/.tsv/.txt exports into arrays of rows, with no dependencies:
// workbooks are unzipped with the browser's DecompressionStream and their XML read directly.

async function unzip(buf) {
  const dv = new DataView(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('This file is not an .xlsx or .ods workbook.');
  const n = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const files = {};
  for (let k = 0; k < n; k++) {
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
    const nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lho = dv.getUint32(p + 42, true);
    files[new TextDecoder().decode(new Uint8Array(buf, p + 46, nl))] = { method, csize, lho };
    p += 46 + nl + el + cl;
  }
  const read = async (name) => {
    const f = files[name]; if (!f) return null;
    const ln = dv.getUint16(f.lho + 26, true), le = dv.getUint16(f.lho + 28, true);
    const data = new Uint8Array(buf, f.lho + 30 + ln + le, f.csize);
    if (f.method === 0) return new TextDecoder().decode(data);
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return await new Response(stream).text();
  };
  return { names: Object.keys(files), read };
}

const ent = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_m, c) => String.fromCharCode(+c)).replace(/&amp;/g, '&');
const attr = (a, name) => { const m = a.match(new RegExp(name + '="([^"]*)"')); return m ? m[1] : null; };

function odsTables(xml) {
  const tables = [];
  for (const tm of xml.matchAll(/<table:table [^>]*>([\s\S]*?)<\/table:table>/g)) {
    const rows = [];
    for (const rm of tm[1].matchAll(/<table:table-row([^>]*?)(?:\/>|>([\s\S]*?)<\/table:table-row>)/g)) {
      const rrep = Math.min(+(attr(rm[1], 'table:number-rows-repeated') || 1), 5);
      const cells = [];
      for (const cm of (rm[2] || '').matchAll(/<table:(?:covered-)?table-cell([^>]*?)(?:\/>|>([\s\S]*?)<\/table:(?:covered-)?table-cell>)/g)) {
        const rep = +(attr(cm[1], 'table:number-columns-repeated') || 1);
        const vt = attr(cm[1], 'office:value-type');
        let v = vt === 'float' || vt === 'currency' || vt === 'percentage' ? Number(attr(cm[1], 'office:value')) : ent((cm[2] || '').replace(/<text:s[^>]*\/>/g, ' ').replace(/<[^>]+>/g, '')).trim();
        if (v === '') v = null;
        for (let i = 0; i < Math.min(rep, 60) && cells.length < 60; i++) cells.push(v);
      }
      for (let i = 0; i < rrep; i++) rows.push(cells);
      if (rows.length > 3000) break;
    }
    tables.push(rows);
  }
  return tables;
}

async function xlsxTables(z) {
  const ss = [];
  const sst = await z.read('xl/sharedStrings.xml');
  if (sst) for (const m of sst.matchAll(/<si>([\s\S]*?)<\/si>/g)) ss.push(ent([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join('')));
  const colN = (s) => [...s].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
  const tables = [];
  for (const name of z.names.filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))) {
    const xml = await z.read(name); const rows = [];
    for (const cm of xml.matchAll(/<c r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const r = +cm[2] - 1, c = colN(cm[1]); if (c > 59 || r > 3000) continue;
      const t = attr(cm[3], 't'); const inner = cm[4] || '';
      const vm = inner.match(/<v>([\s\S]*?)<\/v>/);
      let v = null;
      if (t === 's' && vm) v = ss[+vm[1]];
      else if (t === 'inlineStr') v = ent([...inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join(''));
      else if (t === 'str' || t === 'e') v = vm ? ent(vm[1]) : null;
      else if (vm) v = Number(vm[1]);
      (rows[r] ??= [])[c] = v;
    }
    tables.push(Array.from(rows, (r) => r || []));
  }
  return tables;
}

export function delimited(text) {
  const first = text.split('\n')[0];
  const sep = (first.match(/\t/g) || []).length > (first.match(/,/g) || []).length ? '\t' : ',';
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  const num = (v) => {
    const s = v.trim(); if (s === '') return null;
    let t = s.replace(/[$,\s]/g, ''); const neg = /^\(.*\)$/.test(t); t = t.replace(/[()]/g, '');
    const isPct = t.endsWith('%'); t = t.replace('%', '');
    if (!/^-?\d*\.?\d+$/.test(t)) return s;
    let n = Number(t); if (neg) n = -n; if (isPct) n = n / 100; return n;
  };
  return [rows.map((r) => r.map(num))];
}

/** Every sheet of the file as an array of rows (arrays of cell values). */
export async function readTables(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv') || name.endsWith('.tsv') || name.endsWith('.txt')) return delimited(await file.text());
  if (name.endsWith('.xls')) throw new Error('Old .xls files can’t be read. Save it as .xlsx or .csv, or upload the .ods/.xlsx export.');
  const z = await unzip(await file.arrayBuffer());
  if (z.names.includes('content.xml')) return odsTables(await z.read('content.xml'));
  if (z.names.some((n) => n.startsWith('xl/'))) return xlsxTables(z);
  throw new Error('This file is not a fees export the dashboard can read.');
}
