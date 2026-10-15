import { day, pct, pctCls, sgn, toneCls, usd } from '../../lib/format';
import { Card, H2, Note, Section, TableBox } from '../../components/ui';

export default function Teams({ d, sel }) {
  const rows = ['All', ...sel.teams].map((t) => d.by.scope.get(t + '|' + sel.date)).filter(Boolean);
  return (
    <Section id="teams">
      <H2>Teams on this date</H2>
      <Card>
        <Note>Each collector counts for the team they were on that day, so redistributions never rewrite history. Week change compares with the capture shown.</Note>
        <TableBox>
          <table className="rms-table">
            <thead><tr>
              <th>Team</th><th>Collectors</th><th>Green</th><th>Green target</th><th>% green</th>
              <th>Purple moved</th><th>Purple target</th><th>% purple</th><th>Green, week</th><th>Purple, week</th><th>Compared with</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => {
                const w = d.by.wow.get(r.key);
                return (
                  <tr key={r.key} className={r.who === 'All' ? 'rms-total' : undefined}>
                    <td>{r.who}</td><td>{r.collectors}</td><td>{usd(r.green)}</td><td>{usd(r.green_target)}</td>
                    <td className={pctCls(r.pct_green)}>{pct(r.pct_green)}</td>
                    <td>{usd(r.purple_moved)}</td><td>{usd(r.purple_target)}</td>
                    <td className={pctCls(r.pct_purple)}>{pct(r.pct_purple)}</td>
                    <td className={toneCls(w?.green_change)}>{sgn(w?.green_change)}</td>
                    <td className={toneCls(w?.purple_change)}>{sgn(w?.purple_change)}</td>
                    <td>{w?.compared_to ? day(w.compared_to) : '—'}</td>
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
