import { useState } from 'react';
import { pct, pctCls, sgn, toneCls, usd } from '../../lib/format';
import { Card, H2, Note, Row, Section, TableBox } from '../../components/ui';

const COLUMNS = [
  ['collector', 'Collector'], ['team', 'Team', true], ['type', 'Type', true], ['green', 'Green'], ['pct_green', '% green'],
  ['baseline', 'Purple baseline'], ['purple_moved', 'Purple moved'], ['pct_purple', '% purple'],
  ['green_change', 'Green, week'], ['purple_change', 'Purple, week'], ['flags', 'Flags', true],
];

export default function Collectors({ raw, d, sel, set }) {
  const [sort, setSort] = useState({ key: 'pct_green', dir: -1 });
  const [q, setQ] = useState('');
  const { date, team, collector } = sel;
  const query = q.trim().toLowerCase();
  const rows = raw.snapshot_log
    .filter((r) => r.date === date && (team === 'All' || r.team === team) && (collector === 'All' || r.collector === collector))
    .map((r) => { const w = d.by.wow.get(r.key); return { ...r, green_change: w?.green_change ?? null, purple_change: w?.purple_change ?? null }; })
    .filter((r) => !query || (r.collector + ' ' + r.team + ' ' + r.flags).toLowerCase().includes(query))
    .sort((a, b) => { const x = a[sort.key], y = b[sort.key]; if (x == null) return 1; if (y == null) return -1; return (x < y ? -1 : x > y ? 1 : 0) * sort.dir; });
  const sortBy = (key) => setSort((s) => (s.key === key ? { key, dir: -s.dir } : { key, dir: -1 }));
  const open = (code) => { set({ page: 'dist', profile: code }); window.scrollTo({ top: 0 }); };

  return (
    <Section id="collectors">
      <Row>
        <H2>Collectors on this date</H2>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search collector or flag" aria-label="Search collectors"
          className="max-w-64 rounded-lg border border-line bg-bg px-2 py-1 text-caption text-fg" />
      </Row>
      <Card>
        <Note>Click a column to sort. Flags come from the snapshot rules (no baseline, negative purple, corrected baseline, purple not captured).</Note>
        <TableBox>
          <table className="rms-table">
            <thead><tr>
              {COLUMNS.map(([key, label, left]) => (
                <th key={key} className={left ? 'rms-left' : undefined} aria-sort={sort.key === key ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" className="cursor-pointer" onClick={() => sortBy(key)}>
                    {label}{sort.key === key && <span aria-hidden="true" className="ml-0.5">{sort.dir > 0 ? '↑' : '↓'}</span>}
                  </button>
                </th>
              ))}
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="cursor-pointer hover:bg-bg" onClick={() => open(r.collector)} title={'Open ' + r.collector + '’s profile'}>
                  <td>{r.collector}</td><td className="rms-left">{r.team}</td><td className="rms-left">{r.type}</td>
                  <td>{usd(r.green)}</td><td className={pctCls(r.pct_green)}>{pct(r.pct_green)}</td>
                  <td>{usd(r.baseline)}</td>
                  <td className={r.purple_moved != null && r.purple_moved < 0 ? 'text-bad' : undefined}>{usd(r.purple_moved)}</td>
                  <td className={pctCls(r.pct_purple)}>{pct(r.pct_purple)}</td>
                  <td className={toneCls(r.green_change)}>{sgn(r.green_change)}</td>
                  <td className={toneCls(r.purple_change)}>{sgn(r.purple_change)}</td>
                  <td className="rms-flag">{r.flags || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableBox>
      </Card>
    </Section>
  );
}
