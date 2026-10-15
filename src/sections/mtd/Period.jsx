import { day, pct, pctCls, sgn, toneCls, usd } from '../../lib/format';
import { Big, Card, CardTitle, GreenDot, Grid, H2, Line, PurpleDot, Section, V } from '../../components/ui';

const n = (v) => (v == null ? '—' : String(v));

export default function Period({ d, sel }) {
  const s = d.by.scope.get(sel.key), w = d.by.wow.get(sel.key), fr = d.by.forecast.get(sel.key);
  const compared = !w || !w.compared_to ? '—' : day(w.compared_to) + (w.exact_week ? '' : ' (no capture a week earlier)');
  const isAll = sel.who === 'All';
  return (
    <Section id="period">
      <H2>{sel.scopeName + ' · ' + day(sel.date)}</H2>
      <Grid>
        <Card id="kpi-green">
          <CardTitle><GreenDot />Green fee, month to date</CardTitle>
          <Big>{usd(s?.green)}</Big>
          <Line>Target {usd(s?.green_target)} · <V tone={pctCls(s?.pct_green)}>{pct(s?.pct_green)}</V> of target</Line>
          <Line>Week: <V tone={toneCls(w?.green_change)}>{sgn(w?.green_change)}</V> vs {compared}</Line>
        </Card>
        <Card id="kpi-purple">
          <CardTitle><PurpleDot />Purple moved, month to date</CardTitle>
          <Big>{usd(s?.purple_moved)}</Big>
          <Line>Target {usd(s?.purple_target)} · <V tone={pctCls(s?.pct_purple)}>{pct(s?.pct_purple)}</V> of target</Line>
          <Line>Week: <V tone={toneCls(w?.purple_change)}>{sgn(w?.purple_change)}</V> vs {compared}</Line>
        </Card>
        <Card id="kpi-pace">
          <CardTitle>Straight-line pace for this date</CardTitle>
          <Line>Green should be at <b>{usd(s?.green_pace)}</b></Line>
          <Line>Purple should be at <b>{usd(s?.purple_pace)}</b></Line>
          <Line>Business day {n(s?.business_day)} of {n(s?.business_days_in_month)} (Mon–Fri)</Line>
        </Card>
        <Card id="kpi-forecast">
          <CardTitle>Month-end forecast at this pace</CardTitle>
          <Line><GreenDot />Green <b>{usd(fr?.green_forecast)}</b> · <V tone={pctCls(fr?.green_forecast_pct)}>{pct(fr?.green_forecast_pct)}</V> of target</Line>
          <Line>needs <b>{usd(fr?.green_needed_per_day)}</b> per remaining day</Line>
          <Line><PurpleDot />Purple <b>{usd(fr?.purple_forecast)}</b> · <V tone={pctCls(fr?.purple_forecast_pct)}>{pct(fr?.purple_forecast_pct)}</V> of target</Line>
          <Line>needs <b>{usd(fr?.purple_needed_per_day)}</b> per remaining day</Line>
        </Card>
        <Card id="kpi-target">
          <CardTitle>At target</CardTitle>
          <Line>Collectors at green target: <b>{n(s?.at_green)}</b> of {n(s?.collectors)}</Line>
          <Line>Collectors at purple target: <b>{n(s?.at_purple)}</b> of {n(s?.collectors)}</Line>
          <Line hidden={!isAll}>Teams at green target: <b>{n(s?.teams_at_green)}</b> of {n(s?.teams)}</Line>
          <Line hidden={!isAll}>Teams at purple target: <b>{n(s?.teams_at_purple)}</b> of {n(s?.teams)}</Line>
        </Card>
      </Grid>
    </Section>
  );
}
