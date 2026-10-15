// Charts on the MTD page: cumulative trend against straight-line pace, and movement per captured day.
import { axisBottom, axisLeft, line, max, min, pointer, scaleBand, scaleLinear, scaleUtc, utcDay, utcDays, utcFormat } from 'd3';
import { day, sgn, usd, GREEN, PURPLE } from '../lib/format';
import { makeSvg, textWidth, gridY, baseX, tipBox, showTip, hideTip, AXIS, REF } from './helpers';

const shortDay = utcFormat('%-d %b');

/** Cumulative line for one month with the dashed straight-line pace and the target line. */
export function trendChart(box, { rows, field, targetField, color, month }) {
  box.replaceChildren();
  if (!rows.length) return;
  const H = 220;
  const { svg, W } = makeSvg(box, H);
  const [y, m] = month.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1)), end = new Date(Date.UTC(y, m, 0));
  const bdays = utcDays(start, utcDay.offset(end, 1)).filter((d) => d.getUTCDay() > 0 && d.getUTCDay() < 6);
  const target = rows[0][targetField];
  const pace = [{ x: start, v: 0 }, ...bdays.map((d, i) => ({ x: d, v: target * (i + 1) / bdays.length }))];
  const pts = rows.map((r) => ({ x: new Date(r.date), v: r[field], r }));
  const maxV = max([target, max(pts, (p) => p.v ?? 0)]) || 1;
  const minV = Math.min(0, min(pts, (p) => p.v ?? 0));
  const yScale = scaleLinear([minV, maxV * 1.08], [H - 24, 10]).nice();
  const left = textWidth(svg, usd(yScale.domain()[1])) + 10;
  const x = scaleUtc([start, end], [left, W - 12]);
  svg.append('g').attr('transform', `translate(${left},0)`).call(axisLeft(yScale).ticks(4).tickFormat(usd).tickSize(-(W - left - 12))).call(gridY);
  svg.append('g').attr('transform', `translate(0,${H - 24})`).call(axisBottom(x).ticks(Math.max(2, Math.floor(W / 90))).tickFormat(shortDay)).call(baseX);
  svg.append('line').attr('x1', left).attr('x2', W - 12).attr('y1', yScale(target)).attr('y2', yScale(target)).attr('stroke', REF).attr('stroke-dasharray', '2 3');
  svg.append('path').datum(pace).attr('fill', 'none').attr('stroke', REF).attr('stroke-width', 1.5).attr('stroke-dasharray', '5 4')
    .attr('d', line().x((p) => x(p.x)).y((p) => yScale(p.v)));
  const ln = line().defined((p) => p.v != null).x((p) => x(p.x)).y((p) => yScale(p.v));
  svg.append('path').datum(pts).attr('fill', 'none').attr('stroke', color).attr('stroke-width', 2).attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round').attr('d', ln);
  svg.selectAll('circle.pt').data(pts.filter((p) => p.v != null)).join('circle').attr('class', 'pt').attr('r', 3).attr('cx', (p) => x(p.x)).attr('cy', (p) => yScale(p.v)).attr('fill', color);
  const tip = tipBox(box);
  const dot = svg.append('circle').attr('r', 5).attr('fill', 'none').attr('stroke', color).attr('stroke-width', 2).style('display', 'none');
  svg.append('rect').attr('x', left).attr('y', 0).attr('width', W - left - 12).attr('height', H - 24).attr('fill', 'transparent')
    .on('mousemove', (ev) => {
      const [mx] = pointer(ev); const t = x.invert(mx);
      const cand = pts.filter((p) => p.v != null); if (!cand.length) return;
      const p = cand.reduce((a, b) => (Math.abs(b.x - t) < Math.abs(a.x - t) ? b : a));
      const paceV = target * bdays.filter((d) => d <= p.x).length / bdays.length;
      dot.style('display', null).attr('cx', x(p.x)).attr('cy', yScale(p.v));
      showTip(tip, box, x(p.x) / W * box.clientWidth + 10, yScale(p.v) - 50, [day(p.r.date), 'Actual ' + usd(p.v), 'Pace ' + usd(paceV) + ' · target ' + usd(target)]);
    })
    .on('mouseleave', () => { hideTip(tip); dot.style('display', 'none'); });
}

/** Green and purple bars per capture; the selected date is drawn solid. */
export function dailyChart(box, { rows, selected }) {
  box.replaceChildren();
  if (!rows.length) return;
  const H = 240;
  const { svg, W } = makeSvg(box, H);
  const vals = rows.flatMap((r) => [r.green_moved, r.purple_moved_day]).filter((v) => v != null);
  const y = scaleLinear([Math.min(0, min(vals) ?? 0), Math.max(0, max(vals) ?? 1) * 1.08], [H - 24, 10]).nice();
  const left = textWidth(svg, usd(y.domain()[1]), usd(y.domain()[0])) + 10;
  const x = scaleBand(rows.map((r) => r.date), [left, W - 12]).padding(0.25);
  const x2 = scaleBand(['g', 'p'], [0, x.bandwidth()]).padding(0.1);
  svg.append('g').attr('transform', `translate(${left},0)`).call(axisLeft(y).ticks(4).tickFormat(usd).tickSize(-(W - left - 12))).call(gridY);
  svg.append('g').attr('transform', `translate(0,${H - 24})`).call(axisBottom(x).tickFormat((d) => shortDay(new Date(d)))).call((g) => baseX(g, false));
  svg.append('line').attr('x1', left).attr('x2', W - 12).attr('y1', y(0)).attr('y2', y(0)).attr('stroke', AXIS);
  const bar = (k, f, color) => svg.selectAll(null).data(rows.filter((r) => r[f] != null)).join('rect')
    .attr('x', (r) => x(r.date) + x2(k)).attr('width', x2.bandwidth()).attr('y', (r) => y(Math.max(0, r[f]))).attr('height', (r) => Math.abs(y(r[f]) - y(0))).attr('rx', 3)
    .style('fill', color).attr('opacity', (r) => (r.date === selected ? 1 : 0.55));
  bar('g', 'green_moved', GREEN); bar('p', 'purple_moved_day', PURPLE);
  const tip = tipBox(box);
  svg.selectAll(null).data(rows).join('rect').attr('x', (r) => x(r.date)).attr('width', x.bandwidth()).attr('y', 0).attr('height', H - 24).attr('fill', 'transparent')
    .on('mousemove', (_ev, r) => showTip(tip, box, (x(r.date) + x.bandwidth()) / W * box.clientWidth, 10,
      [day(r.date) + (r.business_days > 1 ? ' (' + r.business_days + ' business days)' : ''), 'Green ' + sgn(r.green_moved), 'Purple ' + sgn(r.purple_moved_day)]))
    .on('mouseleave', () => hideTip(tip));
}
