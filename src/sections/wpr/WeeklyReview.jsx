import { byTeamOrder, day, monthLabel, pct, pctCls, sgn, toneCls, usd } from '../../lib/format';
import { collectorPaceChart, moveChart, paceChart } from '../../charts/wpr';
import Chart from '../../components/Chart';
import { Card, CardTitle, GreenDot, Grid, H2, Note, PurpleDot, Row, Section, Select, Seg, TableBox } from '../../components/ui';

const METRICS = ['green', 'purple'];

export default function WeeklyReview({ d, sel, p, set }) {
  const { month, teams, team } = sel;
  const wr = d.week_review, wk = d.by.week;
  const weekRows = wr.filter((r) => r.month === month && r.who === 'All').sort((a, b) => (a.week < b.week ? -1 : 1));
  const defWeek = (weekRows.filter((r) => r.complete).at(-1) || weekRows.at(-1) || {}).week;
  const week = weekRows.some((r) => r.week === p.week) ? p.week : defWeek;
  const wAll = weekRows.find((r) => r.week === week);
  const weeks = weekRows.map((r) => r.week);
  const scope = [...teams, 'All'];
  const row = (t, w) => wk.get(t + '|' + month + '|' + w);
  const wm = p.wmetric === 'purple' ? 'purple' : 'green';

  const collectors = wr.filter((r) => r.level === 'collector' && r.month === month && r.week === week && (team === 'All' || r.team === team))
    .sort((a, b) => (a.team === b.team ? (a.who < b.who ? -1 : 1) : byTeamOrder(a.team, b.team)));

  // Charts redraw when this section re-renders, i.e. when a filter or the data changes.
  const upto = weeks.filter((w) => w <= week);
  const move = (m) => ({ weeks: upto, teams, selectedWeek: week, value: (t, w) => row(t, w)?.[m + '_week'] ?? null });
  const charts = {
    pace: { rows: scope.map((t) => row(t, week)).filter(Boolean).map((r) => ({ ...r, label: r.who === 'All' ? 'TOTAL' : r.who })) },
    green: move('green'),
    purple: move('purple'),
  };
  const collectorChart = { rows: collectors, metric: wm };

  return (
    <Section id="wpr">
      <Row>
        <H2>{'Weekly review · ' + (wAll ? week + ', week ending ' + day(wAll.week_end) : monthLabel(month))}</H2>
        <Select inline label="Week" value={week} onChange={(v) => set({ week: v })}
          options={weekRows.map((r) => [r.week, r.week + ' · week ending ' + day(r.week_end) + (r.complete ? '' : ' (in progress)')])} />
      </Row>
      <Note>
        {wAll && !wAll.complete
          ? 'This week is still in progress: numbers are as of ' + day(wAll.week_end) + '. Pick an earlier week for a closed one.'
          : 'Numbers as of the last saved day of the week. "Should be" is the straight-line pace to the month goal on that day.'}
      </Note>

      <Card>
        <CardTitle>Team scorecard at week end</CardTitle>
        <TableBox>
          <table className="rms-table">
            <thead><tr>
              <th>Team</th><th>Collectors</th>
              <th>Green MTD</th><th>Should be</th><th>Variance</th><th>% of pace</th><th>Month goal</th><th>% of goal</th>
              <th>Purple MTD</th><th>Should be</th><th>Variance</th><th>% of pace</th><th>Month goal</th><th>% of goal</th>
              <th>Days off (week)</th><th>People off</th>
            </tr></thead>
            <tbody>
              {scope.map((t) => {
                const r = row(t, week); if (!r) return null;
                const off = d.by.daysOff.get(r.key);
                return (
                  <tr key={r.key} className={t === 'All' ? 'rms-total' : undefined}>
                    <td>{t === 'All' ? 'TOTAL' : t}</td><td>{r.collectors}</td>
                    {METRICS.map((m) => [
                      <td key={m + 'e'}>{usd(r[m + '_end'])}</td>, <td key={m + 's'}>{usd(r[m + '_should'])}</td>,
                      <td key={m + 'v'} className={toneCls(r[m + '_variance'])}>{sgn(r[m + '_variance'])}</td>,
                      <td key={m + 'p'} className={pctCls(r[m + '_pct_pace'])}>{pct(r[m + '_pct_pace'])}</td>,
                      <td key={m + 't'}>{usd(r[m + '_target'])}</td>,
                      <td key={m + 'g'} className={pctCls(r[m + '_pct_goal'])}>{pct(r[m + '_pct_goal'])}</td>,
                    ])}
                    <td>{off ? off.days_off : 0}</td><td>{off ? off.people_off : 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableBox>
      </Card>

      <Card>
        <CardTitle>% of pace at week end, by team</CardTitle>
        <Note>Green and purple month-to-date against where each team should be on that day. The dashed line is 100% (exactly on pace).</Note>
        <Chart draw={paceChart} props={charts.pace} />
      </Card>

      <Grid wide>
        {METRICS.map((m) => (
          <Card key={m}>
            <CardTitle>{m === 'green' ? <><GreenDot />Green movement by week</> : <><PurpleDot />Purple movement by week</>}</CardTitle>
            <Chart draw={moveChart} props={charts[m]} />
            <TableBox>
              <table className="rms-table">
                <thead><tr><th>Team</th>{weeks.map((w) => <th key={w}>{w}</th>)}<th>MTD</th></tr></thead>
                <tbody>
                  {scope.map((t) => {
                    const rs = weeks.map((w) => row(t, w));
                    const last = rs.filter(Boolean).filter((x) => x.week <= week).at(-1);
                    return (
                      <tr key={t} className={t === 'All' ? 'rms-total' : undefined}>
                        <td>{t === 'All' ? 'TOTAL' : t}</td>
                        {rs.map((r, i) => {
                          const shown = r && r.week <= week;
                          return <td key={weeks[i]} className={(shown ? toneCls(r[m + '_week']) : '') + (r && r.week === week ? ' font-semibold' : '')}>{shown ? sgn(r[m + '_week']) : ''}</td>;
                        })}
                        <td>{last ? usd(last[m + '_end']) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableBox>
          </Card>
        ))}
      </Grid>

      <Card>
        <Row>
          <CardTitle>{'Collectors, ' + wm + ' % of pace at week end' + (team === 'All' ? '' : ' · ' + team)}</CardTitle>
          <Seg label="Collector chart metric" value={wm} options={[['green', 'Green'], ['purple', 'Purple']]} onChange={(v) => set({ wmetric: v })} />
        </Row>
        <Note>Bars are coloured by team; the dashed line is 100% of pace.</Note>
        <Chart draw={collectorPaceChart} props={collectorChart} />
      </Card>

      <Card>
        <CardTitle>{'Collector breakdown · ' + (team === 'All' ? 'all teams' : team + '’s team')}</CardTitle>
        <Note>Use the Team filter at the top to show one team.</Note>
        <TableBox>
          <table className="rms-table">
            <thead><tr>
              <th>Collector</th><th className="rms-left">Team</th>
              <th>Green MTD</th><th>Should be</th><th>Variance</th><th>% of pace</th><th>This week</th><th>Goal</th>
              <th>Purple MTD</th><th>Should be</th><th>Variance</th><th>% of pace</th><th>This week</th><th>Goal</th>
              <th>Days off (week)</th><th className="rms-left">Which days</th>
            </tr></thead>
            <tbody>
              {collectors.map((r) => {
                const off = d.by.daysOff.get(r.key);
                return (
                  <tr key={r.key}>
                    <td>{r.who}</td><td className="rms-left">{r.team}</td>
                    {METRICS.map((m) => [
                      <td key={m + 'e'}>{usd(r[m + '_end'])}</td>, <td key={m + 's'}>{usd(r[m + '_should'])}</td>,
                      <td key={m + 'v'} className={toneCls(r[m + '_variance'])}>{sgn(r[m + '_variance'])}</td>,
                      <td key={m + 'p'} className={pctCls(r[m + '_pct_pace'])}>{pct(r[m + '_pct_pace'])}</td>,
                      <td key={m + 'w'} className={toneCls(r[m + '_week'])}>{sgn(r[m + '_week'])}</td>,
                      <td key={m + 't'}>{usd(r[m + '_target'])}</td>,
                    ])}
                    <td>{off ? off.days_off : 0}</td><td className="rms-left">{off ? off.dates : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableBox>
      </Card>
    </Section>
  );
}
