import { useState } from 'react';
import { useData } from '../../data/DataProvider';
import { day, monthLabel, monthLong, pct, pctCls, usd } from '../../lib/format';
import { buildClose, closableMonths, monthName } from '../../lib/roster';
import { Btn, Card, CardTitle, Controls, H2, Note, Row, Section, Select, Seg, Status, TableBox } from '../../components/ui';

const NSF_NOTE = ' A month settles around the 10th of the next month: an NSF on a payment taken in the closed month reduces that month (green, and purple too when the plan had future payments). After that the numbers don’t change.';

export default function MonthClose({ raw, d, p, set, meta }) {
  const v = p.view === '2' ? '2' : '1';
  const months = [...new Set(d.month_close.map((r) => r.month))].sort().reverse();
  const cm = months.includes(p.cmonth) ? p.cmonth : months[0];
  const rows = d.month_close.filter((r) => r.month === cm);
  const teams = d.month_close_team.filter((r) => r.month === cm);
  const asOf = rows[0]?.next_month_as_of ?? null;
  const note = (cm === '2026-09'
    ? (v === '1'
      ? 'View 1: SEP CLOSEOUT green and purple moved (30-Sep total minus September start), as reviewed. SHAB excluded; MAZE’s September start was keyed as MEZA, so his purple here is overstated.'
      : 'View 2: updated green, and purple moved minus October’s current moved purple as of ' + day(asOf) + ' (corrected baselines).')
    : (v === '1'
      ? 'View 1: final saved day of the month' + (rows[0]?.final_day ? ' (' + day(rows[0].final_day) + ')' : '') + '.'
      : 'View 2: purple moved minus next month’s moved purple as of ' + day(asOf) + ' when the month was closed.')) + NSF_NOTE;

  return (
    <Section id="close">
      <Row>
        <H2>{'Month close · ' + (cm ? monthLong(cm) : '')}</H2>
        <Select inline label="Month" value={cm} options={months.map((m) => [m, monthLabel(m)])} onChange={(x) => set({ cmonth: x })} />
        <Seg label="Close view" value={v} options={[['1', 'View 1 — closeout data'], ['2', 'View 2 — updated green / adjusted purple']]} onChange={(x) => set({ view: x })} />
      </Row>
      <Note>{note}</Note>
      {meta.writable && <CloseMonthCard raw={raw} />}
      <Card>
        <TableBox>
          <table className="rms-table">
            <thead><tr>
              <th>Team</th><th>Collectors</th><th>Green target</th><th>Green actual</th><th>% to target</th>
              <th>Purple target</th><th>Purple moved</th><th>% to target</th>
            </tr></thead>
            <tbody>
              {teams.map((r) => (
                <tr key={r.key} className={r.team === 'TOTAL' ? 'rms-total' : undefined}>
                  <td>{r.team}</td><td>{r.collectors}</td><td>{usd(r.green_target)}</td><td>{usd(r['green_view' + v])}</td>
                  <td className={pctCls(r['pct_green_view' + v])}>{pct(r['pct_green_view' + v])}</td>
                  <td>{usd(r.purple_target)}</td><td>{usd(r['purple_view' + v])}</td>
                  <td className={pctCls(r['pct_purple_view' + v])}>{pct(r['pct_purple_view' + v])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableBox>
      </Card>
      <Card>
        <CardTitle>Collector detail</CardTitle>
        <TableBox>
          <table className="rms-table">
            <thead><tr>
              <th>Collector</th><th className="rms-left">Team</th><th className="rms-left">New hire</th>
              <th>Green target</th><th>Green</th><th>Purple target</th><th>Purple moved</th><th>Next month moved (subtracted in View 2)</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td>{r.collector}</td><td className="rms-left">{r.team}</td><td className="rms-left">{r.new_hire === 'Y' ? 'Yes' : 'No'}</td>
                  <td>{usd(r.green_target)}</td><td>{usd(r['green_view' + v])}</td><td>{usd(r.purple_target)}</td><td>{usd(r['purple_view' + v])}</td><td>{usd(r.next_month_moved)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableBox>
      </Card>
    </Section>
  );
}

/** Editors: freeze a month's final numbers once NSFs have settled (from the 10th of the next month). */
function CloseMonthCard({ raw }) {
  const { save } = useData();
  const closed = raw.closed_months.filter((c) => c.month && c.collector);
  const months = closableMonths(raw.snapshot_log, raw.closed_months);
  const [picked, setPicked] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const month = months.includes(picked) ? picked : months[0];
  if (!months.length) return null;
  const plan = buildClose(month, raw.snapshot_log);

  const onClose = async () => {
    setBusy(true);
    try {
      await save({ closed_months: raw.closed_months.filter((r) => r.month !== month || !r.collector).concat(plan.rows) }, 'Close month ' + month);
      setMsg({ text: 'Closed. ' + month + ' is now a final month in the history and the profiles.' });
    } catch (e) {
      setMsg({ text: 'Couldn’t close (' + e.message + '). Nothing was changed.', bad: true });
    } finally { setBusy(false); }
  };

  const info = 'Freezes final numbers from ' + plan.finalDay + ' for ' + plan.rows.length + ' collectors'
    + (plan.asOf ? '; View 2 subtracts next month’s moved purple as of ' + plan.asOf + '.' : '.') + (plan.warn.length ? ' ' + plan.warn.join(' ') : '');
  return (
    <Card>
      <Controls>
        <Select label="Close" value={month} options={months.map((m) => [m, monthName(m) + (closed.some((c) => c.month === m) ? ' (close again)' : '')])} onChange={(x) => { setPicked(x); setMsg(null); }} />
        <Btn primary disabled={busy} onClick={onClose}>Close month</Btn>
      </Controls>
      <Status msg={msg ?? { text: info }} />
    </Card>
  );
}
