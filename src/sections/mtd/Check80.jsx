import { byTeamOrder, day, monthLabel, usd } from '../../lib/format';
import { Card, H2, Note, Section, TableBox } from '../../components/ui';

const BELOW = 'Below 80% even after days off';
const resultCls = (r) => 'rms-left ' + (r === BELOW ? 'text-bad' : 'text-ok');

export default function Check80({ d, sel }) {
  const { month, team, collector } = sel;
  const rows = d.check80
    .filter((r) => r.month === month && (team === 'All' || r.team === team) && (collector === 'All' || r.collector === collector) && (r.green_below || r.purple_below))
    .sort((a, b) => (a.team === b.team ? (a.collector < b.collector ? -1 : 1) : byTeamOrder(a.team, b.team)));
  const any = d.check80.find((r) => r.month === month);
  const note = !any ? 'No vacation report uploaded for ' + monthLabel(month) + ' yet.'
    : (any.closed ? 'Final month. ' : 'Month in progress: the 80% bar is 80% of target to date (' + any.days_so_far + ' of ' + any.business_days + ' business days). ')
      + 'Showing collectors under that bar. Adjusted 80% = 80% × target × worked days ÷ business days in the month.';
  return (
    <Section id="check80">
      <H2>{'80% check · ' + monthLabel(month) + (any ? (any.closed ? ' (final)' : ' (to ' + day(any.as_of) + ')') : '')}</H2>
      <Note>{note}</Note>
      <Card>
        <TableBox>
          <table className="rms-table">
            <thead><tr>
              <th>Collector</th><th className="rms-left">Team</th><th>Days off</th><th>Worked days</th>
              <th>Green</th><th>80% bar</th><th>Adjusted 80%</th><th className="rms-left">Green</th>
              <th>Purple moved</th><th>80% bar</th><th>Adjusted 80%</th><th className="rms-left">Purple</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td>{r.collector}</td><td className="rms-left">{r.team}</td><td>{r.days_off}</td><td>{r.worked_days}</td>
                  <td>{usd(r.green)}</td><td>{usd(r.green_80)}</td><td>{usd(r.green_adj80)}</td><td className={resultCls(r.green_result)}>{r.green_result}</td>
                  <td>{usd(r.purple)}</td><td>{usd(r.purple_80)}</td><td>{usd(r.purple_adj80)}</td><td className={resultCls(r.purple_result)}>{r.purple_result}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={12} className="rms-left">{any ? 'Nobody under 80% for this selection.' : '—'}</td></tr>}
            </tbody>
          </table>
        </TableBox>
      </Card>
    </Section>
  );
}
