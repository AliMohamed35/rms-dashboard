import { useMemo } from 'react';
import { GREEN, PURPLE } from '../../lib/format';
import { trendChart } from '../../charts/mtd';
import Chart from '../../components/Chart';
import { Card, CardTitle, GreenDot, Grid, H2, Note, PurpleDot, Section } from '../../components/ui';

export default function Trend({ d, sel }) {
  const { who, month } = sel;
  const rows = useMemo(() => d.scope_day.filter((r) => r.who === who && r.month === month).sort((a, b) => (a.date < b.date ? -1 : 1)), [d, who, month]);
  const green = useMemo(() => ({ rows, field: 'green', targetField: 'green_target', color: GREEN, month }), [rows, month]);
  const purple = useMemo(() => ({ rows, field: 'purple_moved', targetField: 'purple_target', color: PURPLE, month }), [rows, month]);
  return (
    <Section id="trend">
      <H2>Daily trend against straight-line pace</H2>
      <Grid wide>
        <Card>
          <CardTitle><GreenDot />Green, cumulative</CardTitle>
          <Note>Solid line: captured days. Dashed: straight-line pace to the month's target. Gaps are days with no capture.</Note>
          <Chart draw={trendChart} props={green} />
        </Card>
        <Card>
          <CardTitle><PurpleDot />Purple moved, cumulative</CardTitle>
          <Note>Purple moved is the 12-month fee minus the start-of-month baseline.</Note>
          <Chart draw={trendChart} props={purple} />
        </Card>
      </Grid>
    </Section>
  );
}
