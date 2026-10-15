// Charts for the monthly history and the collector profile.
import { axisBottom, axisLeft, format, line, max, min, pointer, scaleBand, scaleLinear, scalePoint } from 'd3';
import { monthLong, monthShort, pct, usd, teamColor, PALETTE } from '../lib/format';
import { makeSvg, textWidth, gridY, baseX, tipBox, showTip, hideTip, AXIS, REF } from './helpers';

const count = (v) => (v == null ? '—' : format(',.0f')(v));

/** One line per series across months, labelled at its last point. */
export function lineChart(box, { series, fmt, goal }) {
  box.replaceChildren();
  const months = [...new Set(series.flatMap((s) => s.points.map((q) => q.month)))].sort();
  if (!months.length) return;
  const H = 240;
  const { svg, W } = makeSvg(box, H);
  const maxV = Math.max(goal ? 1 : 0, max(series.flatMap((s) => s.points.map((q) => q.v ?? 0))) || 1);
  const y = scaleLinear([0, maxV * 1.08], [H - 24, 10]).nice();
  const left = textWidth(svg, fmt(y.domain()[1])) + 10;
  let right = 12;
  for (const s of series) right = Math.max(right, textWidth(svg, s.label + ' ' + fmt(s.points.at(-1)?.v)) + 12);
  right = Math.min(right, W * 0.4);
  const x = scalePoint(months, [left, W - right]).padding(0.2);
  svg.append('g').attr('transform', `translate(${left},0)`).call(axisLeft(y).ticks(4).tickFormat(fmt).tickSize(-(W - left - right))).call(gridY);
  svg.append('g').attr('transform', `translate(0,${H - 24})`).call(axisBottom(x).tickFormat(monthShort)).call(baseX);
  if (goal) {
    svg.append('line').attr('x1', left).attr('x2', W - right).attr('y1', y(1)).attr('y2', y(1)).attr('stroke', REF).attr('stroke-dasharray', '5 4');
    svg.append('text').attr('x', left + 4).attr('y', y(1) - 4).text('Target');
  }
  const ln = line().defined((q) => q.v != null).x((q) => x(q.month)).y((q) => y(q.v));
  const ends = [];
  for (const s of series) {
    svg.append('path').datum(s.points).attr('fill', 'none').attr('stroke', s.color).attr('stroke-width', 2).attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round').attr('opacity', s.muted ? 0.3 : 1).attr('d', ln);
    svg.selectAll(null).data(s.points.filter((q) => q.v != null)).join('circle').attr('r', 2.5).attr('cx', (q) => x(q.month)).attr('cy', (q) => y(q.v)).attr('fill', s.color).attr('opacity', s.muted ? 0.3 : 1);
    const last = s.points.filter((q) => q.v != null).at(-1); if (last) ends.push({ s, y: y(last.v), x: x(last.month), v: last.v });
  }
  ends.sort((a, b) => a.y - b.y); for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 13) ends[i].y = ends[i - 1].y + 13;
  for (const e of ends) svg.append('text').attr('x', e.x + 6).attr('y', e.y + 4).style('fill', e.s.color).attr('opacity', e.s.muted ? 0.5 : 1).text(e.s.label + ' ' + fmt(e.v));
  const tip = tipBox(box);
  svg.append('rect').attr('x', left).attr('y', 0).attr('width', W - left - right).attr('height', H - 24).attr('fill', 'transparent')
    .on('mousemove', (ev) => {
      const [mx] = pointer(ev); const m = months.reduce((a, b) => (Math.abs(x(b) - mx) < Math.abs(x(a) - mx) ? b : a));
      const lines = [monthLong(m)];
      for (const s of series) {
        const q = s.points.find((z) => z.month === m); if (!q || q.v == null) continue;
        const sw = document.createElement('span'); sw.className = 'rms-dot'; sw.style.background = s.color;
        lines.push([sw, s.label + ' ' + fmt(q.v)]);
      }
      showTip(tip, box, x(m) / W * box.clientWidth + 10, 10, lines);
    }).on('mouseleave', () => hideTip(tip));
}

/** Outbound calls per month: full bar = made, darker part = completed. */
export function callsChart(box, { rows }) {
  box.replaceChildren();
  if (!rows.length) return;
  const H = 240;
  const { svg, W } = makeSvg(box, H);
  const y = scaleLinear([0, (max(rows, (r) => r.total ?? 0) || 1) * 1.08], [H - 24, 10]).nice();
  const left = textWidth(svg, count(y.domain()[1])) + 10;
  const x = scaleBand(rows.map((r) => r.month), [left, W - 12]).padding(0.3);
  svg.append('g').attr('transform', `translate(${left},0)`).call(axisLeft(y).ticks(4).tickFormat(count).tickSize(-(W - left - 12))).call(gridY);
  svg.append('g').attr('transform', `translate(0,${H - 24})`).call(axisBottom(x).tickFormat(monthShort)).call(baseX);
  const bw = Math.min(32, x.bandwidth());
  const bars = (f, opacity) => svg.selectAll(null).data(rows.filter((r) => r[f] != null)).join('rect')
    .attr('x', (r) => x(r.month) + (x.bandwidth() - bw) / 2).attr('width', bw).attr('y', (r) => y(r[f])).attr('height', (r) => y(0) - y(r[f])).attr('rx', 4)
    .style('fill', PALETTE[0]).attr('opacity', opacity);
  bars('total', 0.35); bars('completed', 1);
  const tip = tipBox(box);
  svg.selectAll(null).data(rows).join('rect').attr('x', (r) => x(r.month)).attr('width', x.bandwidth()).attr('y', 0).attr('height', H - 24).attr('fill', 'transparent')
    .on('mousemove', (_ev, r) => showTip(tip, box, (x(r.month) + x.bandwidth()) / W * box.clientWidth, 10,
      [monthLong(r.month), r.total == null ? 'Not in the call report' : 'Outbound ' + count(r.total) + ' · completed ' + count(r.completed)]))
    .on('mouseleave', () => hideTip(tip));
}

/** One dot per collector: outbound calls vs purple moved. */
export function scatterChart(box, { rows }) {
  box.replaceChildren();
  if (!rows.length) return;
  const H = 260;
  const { svg, W } = makeSvg(box, H);
  const y = scaleLinear([Math.min(0, min(rows, (r) => r.purple_moved)), max(rows, (r) => r.purple_moved) * 1.08], [H - 34, 10]).nice();
  const left = textWidth(svg, usd(y.domain()[1])) + 10;
  const x = scaleLinear([0, max(rows, (r) => r.ob_calls) * 1.05], [left, W - 12]).nice();
  svg.append('g').attr('transform', `translate(${left},0)`).call(axisLeft(y).ticks(4).tickFormat(usd).tickSize(-(W - left - 12))).call(gridY);
  svg.append('g').attr('transform', `translate(0,${H - 34})`).call(axisBottom(x).ticks(Math.max(2, Math.floor(W / 90))).tickFormat(format(','))).call((g) => g.attr('font-size', null).attr('font-family', null).select('.domain').attr('stroke', AXIS));
  svg.append('text').attr('x', W - 12).attr('y', H - 4).attr('text-anchor', 'end').text('Outbound calls');
  const tip = tipBox(box);
  svg.selectAll(null).data(rows).join('circle').attr('r', 5).attr('cx', (r) => x(r.ob_calls)).attr('cy', (r) => y(r.purple_moved)).style('fill', (r) => teamColor(r.team)).attr('opacity', 0.85)
    .on('mousemove', (_ev, r) => showTip(tip, box, x(r.ob_calls) / W * box.clientWidth + 10, y(r.purple_moved) - 40,
      [r.collector + ' · ' + r.team, format(',')(r.ob_calls) + ' calls · ' + usd(r.purple_moved) + ' purple']))
    .on('mouseleave', () => hideTip(tip));
}

/** A collector's months: bars coloured by that month's team, dashed tick = target, lighter = in progress. */
export function profileChart(box, { rows, field: f }) {
  box.replaceChildren(); if (!rows.length) return;
  const H = 240, tf = f === 'green' ? 'green_target' : 'purple_target';
  const { svg, W } = makeSvg(box, H);
  const vals = rows.flatMap((r) => [r[f], r[tf]]).filter((v) => v != null);
  const y = scaleLinear([Math.min(0, min(vals) ?? 0), (max(vals) ?? 1) * 1.1], [H - 24, 10]).nice();
  const left = textWidth(svg, usd(y.domain()[1])) + 10;
  const x = scaleBand(rows.map((r) => r.month), [left, W - 8]).padding(0.25);
  svg.append('g').attr('transform', `translate(${left},0)`).call(axisLeft(y).ticks(4).tickFormat(usd).tickSize(-(W - left - 8))).call(gridY);
  svg.append('g').attr('transform', `translate(0,${H - 24})`).call(axisBottom(x).tickFormat(monthShort)).call((g) => baseX(g, false));
  const tip = tipBox(box);
  for (const r of rows) {
    if (r[f] != null) svg.append('rect').attr('x', x(r.month)).attr('width', x.bandwidth()).attr('y', y(Math.max(0, r[f]))).attr('height', Math.max(1, Math.abs(y(r[f]) - y(0)))).attr('rx', 3)
      .style('fill', teamColor(r.team)).attr('opacity', r.closed ? 1 : 0.45)
      .on('mousemove', (ev) => { const [mx, my] = pointer(ev, box); showTip(tip, box, mx + 12, my - 10, [monthLong(r.month) + ' · ' + r.team, usd(r[f]) + (r[tf] ? ' of ' + usd(r[tf]) + ' (' + pct(r[f] / r[tf]) + ')' : ''), r.status]); })
      .on('mouseleave', () => hideTip(tip));
    if (r[tf]) svg.append('line').attr('x1', x(r.month) - 3).attr('x2', x(r.month) + x.bandwidth() + 3).attr('y1', y(r[tf])).attr('y2', y(r[tf])).attr('stroke', 'var(--color-fg)').attr('stroke-dasharray', '3 2').style('pointer-events', 'none');
  }
  svg.append('line').attr('x1', left).attr('x2', W - 8).attr('y1', y(0)).attr('y2', y(0)).attr('stroke', AXIS);
}
