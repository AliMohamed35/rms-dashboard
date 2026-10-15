// Charts on the WPR (weekly review) page.
import { axisBottom, axisLeft, format, max, min, pointer, scaleBand, scaleLinear } from 'd3';
import { pct, sgn, usd, teamColor, GREEN, PURPLE } from '../lib/format';
import { makeSvg, textWidth, gridY, baseX, tipBox, showTip, hideTip, AXIS, REF } from './helpers';

const pct0 = format('.0%');
const at = (box, ev) => { const [mx, my] = pointer(ev, box); return [mx + 12, my - 10]; };

/** Horizontal grouped bars: % of pace for green and purple per team, with a 100% line. */
export function paceChart(box, { rows }) {
  box.replaceChildren(); if (!rows.length) return;
  const rowH = 38, H = rows.length * rowH + 30;
  const { svg, W } = makeSvg(box, H);
  const maxV = Math.max(1.2, max(rows.flatMap((r) => [r.green_pct_pace ?? 0, r.purple_pct_pace ?? 0])) * 1.12);
  const left = 64;
  const x = scaleLinear([0, maxV], [left, W - 46]);
  const y = scaleBand(rows.map((r) => r.label), [6, H - 24]).padding(0.25);
  const y2 = scaleBand(['green', 'purple'], [0, y.bandwidth()]).padding(0.08);
  svg.append('g').attr('transform', `translate(0,${H - 24})`).call(axisBottom(x).ticks(Math.max(2, Math.floor(W / 110))).tickFormat(pct0)).call(baseX);
  svg.selectAll(null).data(rows).join('text').attr('x', left - 8).attr('y', (r) => y(r.label) + y.bandwidth() / 2 + 4).attr('text-anchor', 'end').text((r) => r.label)
    .style('font-weight', (r) => (r.label === 'TOTAL' ? 600 : null));
  const tip = tipBox(box);
  for (const [m, color] of [['green', GREEN], ['purple', PURPLE]]) {
    const f = m + '_pct_pace';
    const g = svg.selectAll(null).data(rows.filter((r) => r[f] != null)).join('g');
    g.append('rect').attr('x', left).attr('y', (r) => y(r.label) + y2(m)).attr('height', y2.bandwidth()).attr('width', (r) => Math.max(0, x(r[f]) - left)).attr('rx', 3).style('fill', color)
      .on('mousemove', (ev, r) => showTip(tip, box, ...at(box, ev), [r.label + ' · ' + m, pct(r[f]) + ' of pace', usd(r[m + '_end']) + ' vs ' + usd(r[m + '_should'])]))
      .on('mouseleave', () => hideTip(tip));
    g.append('text').attr('x', (r) => x(r[f]) + 4).attr('y', (r) => y(r.label) + y2(m) + y2.bandwidth() / 2 + 4).text((r) => pct(r[f])).style('pointer-events', 'none');
  }
  svg.append('line').attr('x1', x(1)).attr('x2', x(1)).attr('y1', 2).attr('y2', H - 24).attr('stroke', REF).attr('stroke-dasharray', '4 3');
  svg.append('text').attr('x', x(1) + 4).attr('y', 10).text('100%');
}

/** Grouped vertical bars: movement per week, one bar per team, with a legend. */
export function moveChart(box, { weeks, teams, value, selectedWeek }) {
  box.replaceChildren(); if (!weeks.length) return;
  const H = 230;
  const { svg, W } = makeSvg(box, H);
  const vals = weeks.flatMap((w) => teams.map((t) => value(t, w))).filter((v) => v != null);
  const y = scaleLinear([Math.min(0, min(vals) ?? 0), Math.max(1, max(vals) ?? 1) * 1.1], [H - 40, 8]).nice();
  const left = textWidth(svg, usd(y.domain()[1]), usd(y.domain()[0])) + 10;
  const x = scaleBand(weeks, [left, W - 8]).padding(0.25);
  const x2 = scaleBand(teams, [0, x.bandwidth()]).padding(0.08);
  svg.append('g').attr('transform', `translate(${left},0)`).call(axisLeft(y).ticks(4).tickFormat(usd).tickSize(-(W - left - 8))).call(gridY);
  svg.append('g').attr('transform', `translate(0,${H - 40})`).call(axisBottom(x)).call((g) => baseX(g, false))
    .call((g) => g.selectAll('text').style('font-weight', (w) => (w === selectedWeek ? 600 : null)));
  svg.append('line').attr('x1', left).attr('x2', W - 8).attr('y1', y(0)).attr('y2', y(0)).attr('stroke', AXIS);
  const tip = tipBox(box);
  for (const w of weeks) for (const t of teams) {
    const v = value(t, w); if (v == null) continue;
    svg.append('rect').attr('x', x(w) + x2(t)).attr('width', x2.bandwidth()).attr('y', y(Math.max(0, v))).attr('height', Math.max(1, Math.abs(y(v) - y(0)))).attr('rx', 2)
      .style('fill', teamColor(t)).attr('opacity', w === selectedWeek ? 1 : 0.55)
      .on('mousemove', (ev) => showTip(tip, box, ...at(box, ev), [t + ' · ' + w, sgn(v)]))
      .on('mouseleave', () => hideTip(tip));
  }
  let lx = left;
  for (const t of teams) {
    const g = svg.append('g').attr('transform', `translate(${lx},${H - 12})`);
    g.append('rect').attr('width', 9).attr('height', 9).attr('y', -8).attr('rx', 2).style('fill', teamColor(t));
    const tx = g.append('text').attr('x', 13).text(t); lx += 13 + tx.node().getComputedTextLength() + 14;
  }
}

/** Horizontal bars per collector: % of pace, coloured by team. */
export function collectorPaceChart(box, { rows, metric: m }) {
  box.replaceChildren(); if (!rows.length) return;
  const f = m + '_pct_pace';
  rows = rows.filter((r) => r[f] != null).sort((a, b) => b[f] - a[f]);
  if (!rows.length) return;
  const rowH = 18, H = rows.length * rowH + 30;
  const { svg, W } = makeSvg(box, H);
  const left = 64;
  const x = scaleLinear([Math.min(0, min(rows, (r) => r[f])), Math.max(1.2, max(rows, (r) => r[f]) * 1.12)], [left, W - 46]);
  const y = scaleBand(rows.map((r) => r.who), [4, H - 24]).padding(0.18);
  svg.append('g').attr('transform', `translate(0,${H - 24})`).call(axisBottom(x).ticks(Math.max(2, Math.floor(W / 110))).tickFormat(pct0)).call(baseX);
  const tip = tipBox(box);
  const g = svg.selectAll(null).data(rows).join('g');
  g.append('text').attr('x', left - 6).attr('y', (r) => y(r.who) + y.bandwidth() / 2 + 4).attr('text-anchor', 'end').text((r) => r.who);
  g.append('rect').attr('x', (r) => x(Math.min(0, r[f]))).attr('y', (r) => y(r.who)).attr('height', y.bandwidth()).attr('width', (r) => Math.abs(x(r[f]) - x(0))).attr('rx', 2)
    .style('fill', (r) => teamColor(r.team))
    .on('mousemove', (ev, r) => showTip(tip, box, ...at(box, ev), [r.who + ' · ' + r.team, pct(r[f]) + ' of pace', usd(r[m + '_end']) + ' vs ' + usd(r[m + '_should']), 'This week ' + sgn(r[m + '_week'])]))
    .on('mouseleave', () => hideTip(tip));
  g.append('text').attr('x', (r) => x(Math.max(0, r[f])) + 4).attr('y', (r) => y(r.who) + y.bandwidth() / 2 + 4).text((r) => pct(r[f])).style('pointer-events', 'none');
  svg.append('line').attr('x1', x(1)).attr('x2', x(1)).attr('y1', 2).attr('y2', H - 24).attr('stroke', REF).attr('stroke-dasharray', '4 3');
}
