import { useMemo, useState } from 'react';
import { day, monthLabel, monthShort, pct, pctCls, teamColor, usd, TEAM_ORDER } from '../../lib/format';
import { profileChart } from '../../charts/history';
import Chart from '../../components/Chart';
import { Btn, Card, CardTitle, Controls, H2, Line, Note, Row, Section, Select, Seg, TableBox } from '../../components/ui';
import DistEditor from './DistEditor';

const span = (from, to, fmt, sep = '–') => fmt(from) + (to !== from ? sep + fmt(to) : '');

export default function Distribution({ raw, d, p, set, meta }) {
  const th = raw.team_history, cm = d.collector_months, stints = d.collector_stints;
  const month = th.map((r) => r.month).sort().at(-1);
  const roster = th.filter((r) => r.month === month);
  const active = roster.filter((r) => r.in_wpr === 'YES');
  const [editorOpen, setEditorOpen] = useState(false);
  const [picked, setPicked] = useState(null); // collector clicked on the board while the editor is open

  // Latest saved week per collector this month, for the G / P figures on each card.
  const lastWeek = useMemo(() => {
    const out = {};
    for (const r of d.week_review) if (r.level === 'collector' && r.month === month && (!out[r.who] || out[r.who].week < r.week)) out[r.who] = r;
    return out;
  }, [d.week_review, month]);

  const cur = new Map(active.map((r) => [r.collector, r.team]));
  const months = [...new Set(cm.map((r) => r.month))].sort();
  const codes = [...new Set(cm.map((r) => r.collector))].sort((a, b) => {
    const ta = cur.has(a) ? TEAM_ORDER.indexOf(cur.get(a)) : 9, tb = cur.has(b) ? TEAM_ORDER.indexOf(cur.get(b)) : 9;
    return ta - tb || (a < b ? -1 : 1);
  });
  const byKey = new Map(cm.map((r) => [r.key, r]));
  const who = p.profile && codes.includes(p.profile) ? p.profile : codes[0];
  const pm = p.pmetric === 'green' ? 'green' : 'purple_moved';
  const rows = cm.filter((r) => r.collector === who);
  const chart = { rows, field: pm };
  const myStints = stints.filter((s) => s.collector === who);
  const name = th.find((r) => r.collector === who && r.name)?.name;
  const gone = roster.filter((r) => r.in_wpr !== 'YES').map((r) => r.collector);

  const pick = (code) => { set({ profile: code }); if (editorOpen) setPicked((prev) => ({ code, n: (prev?.n ?? 0) + 1 })); };

  return (
    <Section id="dist">
      <Row>
        <H2>{'Teams · ' + monthLabel(month)}</H2>
        {meta.writable && <Btn primary onClick={() => setEditorOpen((o) => !o)}>Make a change</Btn>}
      </Row>
      <Note>Rule: a move, new hire or leaver effective on or before the 15th counts for that whole month; after the 15th the month stays as it was and the change counts from the 1st of next month. Nothing is overwritten: every change is kept in the log below.</Note>
      {meta.writable && editorOpen && <DistEditor raw={raw} picked={picked} onClose={() => setEditorOpen(false)} />}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,13rem),1fr))] gap-3.5">
        {TEAM_ORDER.filter((t) => active.some((r) => r.team === t)).map((t) => {
          const people = active.filter((r) => r.team === t).sort((a, b) => (a.collector < b.collector ? -1 : 1));
          return (
            <div key={t} className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-line bg-panel p-3">
              <div className="flex items-baseline justify-between border-b-[3px] pb-1 font-semibold" style={{ borderColor: teamColor(t) }}>
                <span>{t}</span>
                <Line>{people.length + ' · ' + usd(people.reduce((s, r) => s + (r.green_target || 0), 0)) + ' / ' + usd(people.reduce((s, r) => s + (r.purple_target || 0), 0))}</Line>
              </div>
              {people.map((r) => {
                const w = lastWeek[r.collector];
                return (
                  <button key={r.collector} type="button" onClick={() => pick(r.collector)} aria-current={p.profile === r.collector ? 'true' : undefined}
                    className={'flex cursor-pointer justify-between gap-1.5 rounded-lg border bg-bg px-2 py-1.5 text-left text-caption hover:border-fg ' + (p.profile === r.collector ? 'border-fg' : 'border-line')}>
                    <div>
                      <b>{r.collector}</b>
                      {r.type === 'New Hire' && <span className="ml-1 rounded-full border border-line px-1.5 text-[10px] text-muted">new</span>}
                      <Line>{(r.name || '').split(' ').slice(0, 2).join(' ')}</Line>
                    </div>
                    <div className="text-right">
                      <div className={pctCls(w?.green_pct_pace)}>G {pct(w?.green_pct_pace)}</div>
                      <div className={pctCls(w?.purple_pct_pace)}>P {pct(w?.purple_pct_pace)}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
      <Note>
        {gone.length
          ? 'Not counted in ' + monthLabel(month) + ': ' + gone.join(', ') + '. G and P are % of pace (green, purple) at the latest saved week.'
          : 'G and P on each card are % of pace (green, purple) at the latest saved week. Click a card to see that collector’s profile.'}
      </Note>

      <Card id="profile" className="scroll-mt-4">
        <Row>
          <CardTitle>{'Collector profile · ' + who + (name ? ' — ' + name : '')}</CardTitle>
          <Controls>
            <Select label="Collector" value={who} options={codes.map((c) => [c, c + (cur.has(c) ? ' (' + cur.get(c) + ')' : ' (left)')])} onChange={(v) => set({ profile: v })} />
            <Seg label="Profile metric" value={pm} options={[['purple_moved', 'Purple moved'], ['green', 'Green']]} onChange={(v) => set({ pmetric: v })} />
          </Controls>
        </Row>
        <Note>Which team they were on, month by month, and how they did there. Bars are coloured by the team that month; the dashed tick is that month’s target; a lighter bar is a month still in progress.</Note>
        <div className="flex min-h-[30px] gap-0.5">
          {myStints.map((s) => (
            <div key={s.key} className="overflow-hidden rounded px-0.5 py-1.5 text-center text-[11px] whitespace-nowrap text-white"
              style={{ flex: rows.filter((r) => r.month >= s.from_month && r.month <= s.to_month).length, background: teamColor(s.team) }}>
              {s.team + ' · ' + span(s.from_month, s.to_month, monthShort)}
            </div>
          ))}
        </div>
        <Chart draw={profileChart} props={chart} />
        <TableBox>
          <table className="rms-table">
            <thead><tr><th>Team</th><th className="rms-left">Months</th><th>Closed months</th><th>Avg purple moved</th><th>Avg % purple target</th><th>Avg green</th><th>Avg % green target</th></tr></thead>
            <tbody>
              {myStints.map((s) => (
                <tr key={s.key}>
                  <td className="font-semibold" style={{ color: teamColor(s.team) }}>{s.team}</td>
                  <td className="rms-left">{span(s.from_month, s.to_month, monthLabel, ' – ') + (s.in_progress ? ' (current month in progress)' : '')}</td>
                  <td>{s.months}</td><td>{usd(s.avg_purple_moved)}</td>
                  <td className={pctCls(s.avg_pct_purple)}>{pct(s.avg_pct_purple)}</td>
                  <td>{usd(s.avg_green)}</td>
                  <td className={pctCls(s.avg_pct_green)}>{pct(s.avg_pct_green)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableBox>
      </Card>

      <Card>
        <CardTitle>Who was where</CardTitle>
        <Note>Each cell is the team that collector was on that month. Click a row to open the profile above.</Note>
        <TableBox>
          <table className="rms-grid-table">
            <thead><tr><td>Collector</td>{months.map((m) => <th key={m}>{monthShort(m)}</th>)}</tr></thead>
            <tbody>
              {codes.map((c) => (
                <tr key={c} onClick={() => { set({ profile: c }); document.getElementById('profile')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
                  <td style={cur.has(c) ? undefined : { color: 'var(--color-muted)' }}>{c}</td>
                  {months.map((m) => {
                    const r = byKey.get(c + '|' + m);
                    return r
                      ? <td key={m} className="rms-cell" style={{ background: teamColor(r.team) }} title={c + ' · ' + m + ' · ' + r.team}>{r.team.slice(0, 1) + r.team.slice(1).toLowerCase()}</td>
                      : <td key={m} />;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </TableBox>
      </Card>

      <Card>
        <CardTitle>Change log</CardTitle>
        <TableBox>
          <table className="rms-table">
            <thead><tr><th>Effective</th><th>Collector</th><th className="rms-left">Change</th><th className="rms-left">From</th><th className="rms-left">To</th><th>Counts from</th><th className="rms-left">Recorded by</th></tr></thead>
            <tbody>
              {[...raw.roster_changes].sort((a, b) => (a.made_at < b.made_at ? 1 : -1)).map((r) => (
                <tr key={r.id}>
                  <td>{day(r.effective_date)}</td><td>{r.collector}</td><td className="rms-left">{r.action}</td>
                  <td className="rms-left">{r.from_team || '—'}</td><td className="rms-left">{r.to_team || '—'}</td>
                  <td>{r.counts_from ? monthLabel(r.counts_from) : '—'}</td><td className="rms-left">{r.made_by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableBox>
      </Card>
    </Section>
  );
}
