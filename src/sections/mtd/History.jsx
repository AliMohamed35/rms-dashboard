import { useMemo } from 'react';
import { format } from 'd3';
import { monthLabel, monthLong, num, pct, pctCls, teamColor, usd, TEAM_ORDER } from '../../lib/format';
import { callsChart, lineChart, scatterChart } from '../../charts/history';
import Chart from '../../components/Chart';
import { Btn, Card, CardTitle, Controls, Grid, H2, Note, Row, Section, Select, Seg, TableBox } from '../../components/ui';

const byMonth = (a, b) => (a.month < b.month ? -1 : 1);
const two = format('.2f');

export default function History({ raw, d, sel, p, set }) {
  const { team } = sel;
  const hc = d.history_collector, ht = d.history_team;
  const hmetric = p.hmetric === 'green' ? 'green' : 'purple_moved';
  const hscale = ['avg', 'pct'].includes(p.hscale) ? p.hscale : 'total';
  const avg = hscale === 'avg', pctMode = hscale === 'pct';
  const hcol = p.hcollector && hc.some((r) => r.collector === p.hcollector) ? p.hcollector : null;
  const label = hmetric === 'green' ? 'Green' : 'Purple moved';

  const charts = useMemo(() => {
    if (hcol) {
      const pts = hc.filter((r) => r.collector === hcol).sort(byMonth);
      const sep = raw.sep_close.find((s) => s.collector === hcol);
      const pf = hmetric === 'green' ? 'pct_green' : 'pct_purple';
      const points = pts.map((r) => ({ month: r.month, v: pctMode ? r[pf] : r[hmetric] }));
      if (sep) {
        const v = hmetric === 'green' ? sep.green_closeout : sep.purple_moved_closeout, t = hmetric === 'green' ? sep.green_target : sep.purple_target;
        points.push({ month: sep.month, v: pctMode ? v / t : v });
      }
      return {
        trendTitle: label + (pctMode ? ', % to target' : '') + ' by month · ' + hcol,
        trend: { series: [{ label: hcol, color: teamColor(pts.at(-1)?.team), points }], fmt: pctMode ? pct : usd, goal: pctMode },
        callsTitle: 'Outbound calls by month · ' + hcol,
        calls: { rows: pts.map((r) => ({ month: r.month, total: r.ob_calls, completed: r.ob_completed })) },
      };
    }
    const f = pctMode ? (hmetric === 'green' ? 'pct_green' : 'pct_purple_moved') : avg ? (hmetric === 'green' ? 'avg_green' : 'avg_purple_moved') : hmetric;
    const teamsAll = TEAM_ORDER.filter((t) => ht.some((r) => r.team === t));
    const list = avg || pctMode ? ['All', ...teamsAll] : teamsAll;
    const series = list.map((t) => ({ label: t, color: teamColor(t), muted: team !== 'All' && t !== team,
      points: ht.filter((r) => r.team === t).sort(byMonth).map((r) => ({ month: r.month, v: r[f] })) }));
    return {
      trendTitle: label + (pctMode ? ', % to target' : avg ? ' per collector' : ', team total') + ' by month',
      trend: { series, fmt: pctMode ? pct : usd, goal: pctMode },
      callsTitle: 'Outbound calls by month · ' + (team === 'All' ? 'all collectors' : team + '’s team') + (avg ? ', per collector' : ''),
      calls: { rows: ht.filter((r) => r.team === team).sort(byMonth).map((r) => ({ month: r.month, total: avg ? r.avg_ob_calls : r.ob_calls, completed: avg ? r.avg_ob_completed : r.ob_completed })) },
    };
  }, [hc, ht, raw.sep_close, hcol, hmetric, pctMode, avg, label, team]);

  const hmonths = [...new Set(hc.map((r) => r.month))].sort().reverse();
  const hm = hmonths.includes(p.hmonth) ? p.hmonth : hmonths[0];
  const fit = d.calls_fit.find((r) => r.month === hm);
  const scatter = { rows: hc.filter((r) => r.month === hm && r.ob_calls != null && (team === 'All' || r.team === team)) };
  const rows = hc.filter((r) => r.month === hm && (team === 'All' || r.team === team)).sort((a, b) => (b.purple_moved ?? 0) - (a.purple_moved ?? 0));

  return (
    <Section id="history">
      <Row>
        <H2>Monthly history, January to September</H2>
        <Controls>
          <Seg label="History metric" value={hmetric} options={[['purple_moved', 'Purple moved'], ['green', 'Green']]} onChange={(v) => set({ hmetric: v })} />
          <Seg label="History scale" value={hscale} options={[['total', 'Team total'], ['avg', 'Per collector'], ['pct', '% to target']]} onChange={(v) => set({ hscale: v })} />
          {hcol && <Btn onClick={() => set({ hcollector: null })}>{hcol} ×</Btn>}
        </Controls>
      </Row>
      <Note>Targets per collector: $400 green / $4,800 purple from January to July (both reset monthly), then a green target that steps up $500 a month because payment plans keep paying green every month: $500 in August, $1,000 in September, $1,500 in October, up to $3,000. Purple is $4,000 from August and resets monthly. September new hires: $250 / $2,000, then $1,000 in October, +$500 a month after. January to August come from the monthly performance report (FEES and CALLS); September is the closeout (View 1). Each collector counts for the team they were on that month. Kady's and Ben's teams start in May.</Note>
      <Grid wide>
        <Card><CardTitle>{charts.trendTitle}</CardTitle><Note>Lines are labelled at their last month.</Note><Chart draw={lineChart} props={charts.trend} /></Card>
        <Card><CardTitle>{charts.callsTitle}</CardTitle><Note>Full bar: outbound calls made; darker part: completed. September calls are not in the report yet.</Note><Chart draw={callsChart} props={charts.calls} /></Card>
      </Grid>
      <Grid wide>
        <Card>
          <Row><CardTitle>Calls vs purple moved</CardTitle><Select inline label="Month" value={hm} options={hmonths.map((m) => [m, monthLabel(m)])} onChange={(v) => set({ hmonth: v })} /></Row>
          <Note>One dot per collector. Correlation r <b>{fit?.r == null ? '—' : two(fit.r)}</b>, R² <b>{fit?.r2 == null ? '—' : two(fit.r2)}</b>, about <b>{usd(fit?.purple_per_100_calls)}</b> purple per 100 extra calls, from {fit ? fit.n : '—'} collectors.</Note>
          <Chart draw={scatterChart} props={scatter} />
        </Card>
        <Card>
          <CardTitle>Account call totals</CardTitle>
          <Note>Everything in the call report, including team leaders, QA and extensions not matched to a collector.</Note>
          <TableBox>
            <table className="rms-table">
              <thead><tr><th>Month</th><th>Outbound</th><th>Completed</th><th>Completion</th><th>Inbound answered</th><th>Not matched to a collector</th></tr></thead>
              <tbody>
                {d.calls_month.map((r) => (
                  <tr key={r.month}><td>{monthLabel(r.month)}</td><td>{num(r.ob_calls)}</td><td>{num(r.ob_completed)}</td><td>{pct(r.ob_completion)}</td><td>{num(r.ib_answered)}</td><td>{num(r.unassigned_ob)}</td></tr>
                ))}
              </tbody>
            </table>
          </TableBox>
        </Card>
      </Grid>
      <Card>
        <Row><CardTitle>{'Collectors · ' + monthLong(hm)}</CardTitle><Note>Click a collector to see their months in the charts above.</Note></Row>
        <TableBox>
          <table className="rms-table">
            <thead><tr>
              <th>Collector</th><th className="rms-left">Team</th><th>Green</th><th>% green</th><th>Purple moved</th><th>% purple</th>
              <th>CV refs</th><th>CV enrolled</th><th>Outbound calls</th><th>Completion</th><th>Talk hours</th>
              <th>Inbound answered</th><th>Purple per 100 calls</th><th className="rms-left">Calls matched by</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="cursor-pointer hover:bg-bg" onClick={() => set({ hcollector: r.collector })}>
                  <td>{r.collector}</td><td className="rms-left">{r.team}</td>
                  <td>{usd(r.green)}</td><td className={pctCls(r.pct_green)}>{pct(r.pct_green)}</td>
                  <td>{usd(r.purple_moved)}</td><td className={pctCls(r.pct_purple)}>{pct(r.pct_purple)}</td>
                  <td>{num(r.cv_refs)}</td><td>{num(r.cv_enrolled)}</td><td>{num(r.ob_calls)}</td><td>{pct(r.ob_completion)}</td>
                  <td>{num(r.ob_talk_hours, ',.1f')}</td><td>{num(r.ib_answered)}</td><td>{usd(r.purple_per_100_calls)}</td><td className="rms-left">{r.calls_match}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableBox>
      </Card>
    </Section>
  );
}
