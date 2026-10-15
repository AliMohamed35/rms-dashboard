import { pct, sgn } from '../../lib/format';
import { Card, CardTitle, Grid, H2, List, Row, Section, Seg } from '../../components/ui';

export default function Rankings({ raw, d, sel, p, set }) {
  const { date, team } = sel;
  const purple = p.metric === 'purple';
  const met = purple ? 'pct_purple' : 'pct_green';
  const chg = purple ? 'purple_change' : 'green_change';
  const ranked = raw.snapshot_log.filter((r) => r.date === date && (team === 'All' || r.team === team) && r[met] != null).sort((a, b) => b[met] - a[met]);
  const rank = (rows) => rows.map((r) => ({ key: r.key, left: r.collector + ' · ' + r.team, right: pct(r[met]), tone: r[met] >= 1 ? 'text-ok' : 'text-bad' }));
  const moves = d.wow.filter((r) => r.level === 'collector' && r.date === date && (team === 'All' || r.team === team) && r[chg] != null);
  const change = (rows) => rows.map((r) => ({ key: r.key, left: r.who + ' · ' + r.team, right: sgn(r[chg]), tone: r[chg] >= 0 ? 'text-ok' : 'text-bad' }));
  return (
    <Section id="rankings">
      <Row>
        <H2>Rankings</H2>
        <Seg label="Rank by" value={purple ? 'purple' : 'green'} options={[['green', 'Green'], ['purple', 'Purple']]} onChange={(v) => set({ metric: v })} />
      </Row>
      <Grid>
        <Card><CardTitle>Top 5, % to target</CardTitle><List items={rank(ranked.slice(0, 5))} empty="Not captured on this date" /></Card>
        <Card><CardTitle>Bottom 5, % to target</CardTitle><List items={rank(ranked.slice(-5).reverse())} empty="Not captured on this date" /></Card>
        <Card><CardTitle>Biggest gains over the week</CardTitle><List items={change(moves.filter((r) => r[chg] > 0).sort((a, b) => b[chg] - a[chg]).slice(0, 5))} empty="No earlier capture this month" /></Card>
        <Card><CardTitle>Biggest drops over the week</CardTitle><List items={change(moves.filter((r) => r[chg] < 0).sort((a, b) => a[chg] - b[chg]).slice(0, 5))} empty="No earlier capture this month" /></Card>
      </Grid>
    </Section>
  );
}
