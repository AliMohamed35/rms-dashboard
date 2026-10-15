import { day, pct, pctCls, sgn, toneCls, usd } from '../../lib/format';
import { Card, H2, Note, Section, TableBox } from '../../components/ui';

export default function WatchList({ d, sel }) {
  const { date, team, collector } = sel;
  const rows = d.watch_list
    .filter((r) => r.date === date && (team === 'All' || r.team === team) && (collector === 'All' || r.collector === collector))
    .sort((a, b) => b.severity - a.severity || (a.purple_pct_pace ?? 9) - (b.purple_pct_pace ?? 9));
  return (
    <Section id="watch">
      <H2>{'Watch list · ' + (rows.length ? rows.length + ' collector' + (rows.length > 1 ? 's' : '') : 'nobody flagged') + ' on ' + day(date)}</H2>
      <Note>Collectors who need attention on this date: below 70% of pace after the 15th, purple down more than $100 since the previous saved day (often an NSF), or negative purple month to date.</Note>
      <Card>
        <TableBox>
          <table className="rms-table">
            <thead><tr><th>Collector</th><th className="rms-left">Team</th><th>Green % of pace</th><th>Purple % of pace</th><th>Purple since last day</th><th>Purple MTD</th><th className="rms-left">Why</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td>{r.collector}</td><td className="rms-left">{r.team}</td>
                  <td className={pctCls(r.green_pct_pace)}>{pct(r.green_pct_pace)}</td>
                  <td className={pctCls(r.purple_pct_pace)}>{pct(r.purple_pct_pace)}</td>
                  <td className={toneCls(r.purple_day)}>{sgn(r.purple_day)}</td>
                  <td className={r.purple_moved < 0 ? 'text-bad' : undefined}>{usd(r.purple_moved)}</td>
                  <td className="rms-flag">{r.reasons}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableBox>
      </Card>
    </Section>
  );
}
