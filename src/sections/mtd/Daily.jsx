import { useMemo } from 'react';
import { day, sgn, toneCls } from '../../lib/format';
import { dailyChart } from '../../charts/mtd';
import Chart from '../../components/Chart';
import { Big, Card, CardTitle, GreenDot, Grid, H2, Line, Note, PurpleDot, Section, TableBox } from '../../components/ui';

const since = (v) => (v === 'month start' ? 'month start' : day(v));

export default function Daily({ d, sel }) {
  const { date, month, who, team, collector, scopeName } = sel;
  const dr = d.by.daily.get(sel.key);
  const note = dr && dr.level !== 'collector' && dr.green_moved === 0 && dr.purple_moved_day === 0
    ? 'Nothing moved at all since the previous capture, so RAW FEES was most likely not refreshed that day; the next day carries both days of movement.'
    : dr && dr.business_days > 1
      ? 'This covers ' + dr.business_days + ' business days because the days in between were not captured. A negative number usually means an NSF or a reversal.'
      : 'How much green and purple changed since the previous capture. A negative number usually means an NSF or a reversal.';
  const chart = useMemo(() => ({
    rows: d.daily_move.filter((r) => r.who === who && r.month === month).sort((a, b) => (a.date < b.date ? -1 : 1)),
    selected: date,
  }), [d, who, month, date]);
  const rows = d.daily_move
    .filter((r) => r.level === 'collector' && r.date === date && (team === 'All' || r.team === team) && (collector === 'All' || r.who === collector))
    .sort((a, b) => (b.purple_moved_day ?? -1e9) - (a.purple_moved_day ?? -1e9));
  const sinceLine = <Line>Since {dr ? since(dr.previous_date) : '—'} · {dr ? dr.business_days : '—'} business day(s)</Line>;

  return (
    <Section id="daily">
      <H2>{'Moved on ' + day(date) + ' · ' + scopeName}</H2>
      <Note>{note}</Note>
      <Grid>
        <Card>
          <CardTitle><GreenDot />Green moved</CardTitle>
          <Big className={toneCls(dr?.green_moved)}>{sgn(dr?.green_moved)}</Big>
          {sinceLine}
        </Card>
        <Card>
          <CardTitle><PurpleDot />Purple moved</CardTitle>
          <Big className={toneCls(dr?.purple_moved_day)}>{sgn(dr?.purple_moved_day)}</Big>
          {sinceLine}
        </Card>
      </Grid>
      <Card>
        <CardTitle>Movement per captured day this month</CardTitle>
        <Note>Green and purple bars per capture; below zero means the total went down that day.</Note>
        <Chart draw={dailyChart} props={chart} />
      </Card>
      <Card>
        <CardTitle>Collectors on this day</CardTitle>
        <TableBox>
          <table className="rms-table">
            <thead><tr><th>Collector</th><th className="rms-left">Team</th><th>Green moved</th><th>Purple moved</th><th>Since</th><th>Business days</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td>{r.who}</td><td className="rms-left">{r.team}</td>
                  <td className={toneCls(r.green_moved)}>{sgn(r.green_moved)}</td>
                  <td className={toneCls(r.purple_moved_day)}>{sgn(r.purple_moved_day)}</td>
                  <td>{since(r.previous_date)}</td><td>{r.business_days}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableBox>
      </Card>
    </Section>
  );
}
