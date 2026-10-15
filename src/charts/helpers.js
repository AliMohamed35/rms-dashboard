import { select } from 'd3';

export const GRID = 'var(--color-chart-grid)';
export const AXIS = 'var(--color-chart-axis)';
export const REF = 'var(--color-chart-ref)';

/** Clears the box and appends a responsive svg of the given height. */
export function makeSvg(box, H) {
  box.replaceChildren();
  const W = box.clientWidth || 320;
  const svg = select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
  return { svg, W };
}

/** Width of the widest label, measured in the chart's own font. */
export function textWidth(svg, ...labels) {
  return Math.max(...labels.map((l) => { const t = svg.append('text').text(l); const w = t.node().getComputedTextLength(); t.remove(); return w; }));
}

/** Lets CSS (.rms-chart svg text) style the axis labels. */
export const axisStyle = (g) => g.attr('font-size', null).attr('font-family', null);
export const gridY = (g) => g.call(axisStyle).call((s) => s.select('.domain').remove()).call((s) => s.selectAll('line').attr('stroke', GRID));
export const baseX = (g, keepDomain = true) => g.call(axisStyle)
  .call((s) => (keepDomain ? s.select('.domain').attr('stroke', AXIS) : s.select('.domain').remove()))
  .call((s) => s.selectAll('line').remove());

export function tipBox(box) {
  const t = document.createElement('div'); t.className = 'rms-tip'; box.append(t); return t;
}

/** Fills the tooltip (first line muted) and positions it next to the pointer, inside the box. */
export function showTip(tip, box, x, y, lines) {
  tip.replaceChildren(...lines.map((l, i) => {
    const d = document.createElement('div');
    if (i === 0) d.className = 'rms-tip-date';
    if (typeof l === 'string') d.textContent = l; else d.append(...l);
    return d;
  }));
  tip.style.display = 'block';
  tip.style.left = Math.max(0, Math.min(x, box.clientWidth - tip.offsetWidth - 4)) + 'px';
  tip.style.top = Math.max(0, y) + 'px';
}

export const hideTip = (tip) => { tip.style.display = 'none'; };
