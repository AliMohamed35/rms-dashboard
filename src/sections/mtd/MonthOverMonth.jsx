import { day, sgn, toneCls, usd } from '../../lib/format';
import { Big, Card, CardTitle, GreenDot, Grid, H2, Line, Note, PurpleDot, Section } from '../../components/ui';

export default function MonthOverMonth({ d, sel }) {
  const mm = d.by.mom.get(sel.key);
  const compared = mm?.compared_to ? day(mm.compared_to) : '—';
  return (
    <Section id="mom">
      <H2>Month over month (same business day)</H2>
      <Grid>
        <Card>
          <CardTitle><GreenDot />Green vs last month</CardTitle>
          <Big className={toneCls(mm?.green_change)}>{sgn(mm?.green_change)}</Big>
          <Line>This month {usd(mm?.green)} · last month {usd(mm?.green_prev)}</Line>
          <Line>Compared with {compared}</Line>
        </Card>
        <Card>
          <CardTitle><PurpleDot />Purple vs last month</CardTitle>
          <Big className={toneCls(mm?.purple_change)}>{sgn(mm?.purple_change)}</Big>
          <Line>This month {usd(mm?.purple_moved)} · last month {usd(mm?.purple_prev)}</Line>
          <Line>Compared with {compared}</Line>
        </Card>
      </Grid>
      <Note>
        {mm && !mm.compared_to
          ? 'Last month has no capture on or before the same business day, so there is nothing to compare yet. Full closed months are compared in the September close below.'
          : 'Compares month-to-date totals on the same business day number of each month.'}
      </Note>
    </Section>
  );
}
