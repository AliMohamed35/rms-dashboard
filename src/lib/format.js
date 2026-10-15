import { format, utcFormat } from 'd3';

const money = format('$,.0f');
const percent = format('.1%');
const dayFmt = utcFormat('%a %-d %b');
const monthFmt = utcFormat('%b %Y');
const monthLongFmt = utcFormat('%B %Y');
const monthShortFmt = utcFormat('%b');

export const usd = (v) => (v == null ? '—' : money(v));
export const pct = (v) => (v == null ? '—' : percent(v));
export const sgn = (v) => (v == null ? '—' : (v >= 0 ? '+' : '−') + money(Math.abs(v)));
export const day = (s) => (s ? dayFmt(new Date(s)) : '—');
export const monthLabel = (m) => monthFmt(new Date(m + '-01'));
export const monthLong = (m) => monthLongFmt(new Date(m + '-01'));
export const monthShort = (m) => monthShortFmt(new Date(m + '-01'));
export const num = (v, f = ',') => (v == null ? '—' : format(f)(v));

/** Tailwind class for a signed change: green when up, red when down. */
export const toneCls = (v) => (v == null ? '' : v > 0 ? 'text-ok' : v < 0 ? 'text-bad' : '');
/** Tailwind class for a share of target: green at or above 100%, red below. */
export const pctCls = (v) => (v == null ? '' : v >= 1 ? 'text-ok' : 'text-bad');

export const TEAM_ORDER = ['KADY', 'MANAR', 'LOAY', 'BEN'];
export const PALETTE = ['#2a6fdb', '#d9822b', '#3aa675', '#c4475b', '#7c4dbd', '#5b6770'];
const TEAM_COLORS = { KADY: PALETTE[0], MANAR: PALETTE[1], LOAY: PALETTE[2], BEN: PALETTE[3] };
export const teamColor = (t) => TEAM_COLORS[t] || 'var(--color-fg)';
export const GREEN = '#1a8a5a';
export const PURPLE = '#7c4dbd';
export const byTeamOrder = (a, b) => TEAM_ORDER.indexOf(a) - TEAM_ORDER.indexOf(b);
