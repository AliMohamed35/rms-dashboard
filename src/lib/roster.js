// Distribution editing and Close month.
// Rule: a change effective on or before the 15th counts for that whole month; after the 15th it counts from next month.
import { targetsFor } from './fees';

export const nextMonth = (m) => { const [y, mo] = m.split('-').map(Number); return new Date(Date.UTC(y, mo, 1)).toISOString().slice(0, 7); };
export const monthName = (m) => new Date(m + '-01T00:00:00Z').toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/**
 * Validates the form and describes the change in words.
 * Returns { change, summary } where change is null while the form is incomplete.
 */
export function describeChange(form, roster, th) {
  const { action: a, date } = form;
  if (!date) return { change: null, summary: '' };
  const counts = a === 'Not counted' || +date.slice(8, 10) <= 15 ? date.slice(0, 7) : nextMonth(date.slice(0, 7));
  let ch;
  if (a === 'Hired') {
    const code = form.code.trim().toUpperCase(), name = form.name.trim().toUpperCase();
    if (!/^[A-Z]{2,8}$/.test(code)) return { change: null, summary: 'Enter the new collector’s code (letters only, as it appears in RAW FEES).' };
    if (th.some((r) => r.collector === code && r.in_wpr === 'YES' && r.month >= counts)) return { change: null, summary: code + ' is already on a team.' };
    ch = { action: 'Hired', collector: code, name, from_team: null, to_team: form.team };
  } else {
    const c = roster.find((r) => r.collector === form.collector);
    if (!c) return { change: null, summary: 'Pick a collector.' };
    if (a === 'Moved' && form.team === c.team) return { change: null, summary: c.collector + ' is already on ' + c.team + '’s team.' };
    ch = { action: a, collector: c.collector, name: c.name, from_team: c.team, to_team: a === 'Moved' ? form.team : null };
    if (a === 'Not counted') {
      return { change: { ...ch, effective_date: date, counts_from: counts },
        summary: c.collector + ' is left out of ' + monthName(counts) + ' (not in team totals or targets) and comes back on ' + c.team + '’s list next month.' };
    }
  }
  ch.effective_date = date; ch.counts_from = counts;
  const what = ch.action === 'Moved' ? ch.collector + ' moves from ' + ch.from_team + ' to ' + ch.to_team
    : ch.action === 'Left' ? ch.collector + ' leaves ' + ch.from_team + '’s team'
    : ch.collector + ' joins ' + ch.to_team + '’s team as a new hire';
  const when = counts === date.slice(0, 7)
    ? ' This counts for all of ' + monthName(counts) + ' (on or before the 15th)' + (ch.action === 'Left' ? ', so they drop out of ' + monthName(counts) + '’s team totals.' : '.')
    : ' This counts from ' + monthName(counts) + ' (after the 15th, so ' + monthName(date.slice(0, 7)) + ' stays as it is).';
  return { change: ch, summary: what + '.' + when };
}

/** Applies a roster change to team_history (and snapshot_log when it rewrites saved days) and logs it. */
export function applyChange(ch, raw) {
  const th = raw.team_history.map((r) => ({ ...r }));
  let log = raw.snapshot_log;
  const rc = [...raw.roster_changes];
  const cf = ch.counts_from;
  let logChanged = false;
  const note = (r, txt) => { r.notes = (r.notes ? r.notes + '; ' : '') + txt; };
  if (ch.action === 'Moved') {
    th.forEach((r) => { if (r.collector === ch.collector && r.month >= cf) { r.team = ch.to_team; note(r, 'Moved from ' + ch.from_team + ' (' + ch.effective_date + ')'); } });
    if (log.some((r) => r.collector === ch.collector && r.month >= cf)) { log = log.map((r) => (r.collector === ch.collector && r.month >= cf ? { ...r, team: ch.to_team } : r)); logChanged = true; }
  }
  if (ch.action === 'Not counted') {
    th.forEach((r) => { if (r.collector === ch.collector && r.month === cf) { r.in_wpr = 'NO'; note(r, 'Not counted in ' + cf); } });
    if (log.some((r) => r.collector === ch.collector && r.month === cf)) { log = log.filter((r) => !(r.collector === ch.collector && r.month === cf)); logChanged = true; }
  }
  if (ch.action === 'Left') {
    th.forEach((r) => { if (r.collector === ch.collector && r.month >= cf) { r.in_wpr = 'NO'; r.effective_to = ch.effective_date; note(r, 'Left ' + ch.effective_date); } });
    if (log.some((r) => r.collector === ch.collector && r.month >= cf)) { log = log.filter((r) => !(r.collector === ch.collector && r.month >= cf)); logChanged = true; }
  }
  if (ch.action === 'Hired' && th.some((r) => r.month === cf)) {
    const row = { month: cf, collector: ch.collector, name: ch.name, team: ch.to_team, type: 'New Hire', in_wpr: 'YES', effective_from: cf === ch.effective_date.slice(0, 7) ? ch.effective_date : cf + '-01', effective_to: null, notes: 'New hire (' + ch.effective_date + ')', key: ch.collector + '|' + cf };
    const t = targetsFor(ch.collector, cf, 'New Hire', [...th, row], raw.target_rules);
    th.push({ ...row, green_target: t ? t.green_target : null, purple_target: t ? t.purple_target : null });
  }
  rc.push({ ...ch, id: 'c' + Date.now(), made_at: new Date().toISOString(), made_by: 'Distribution tab', note: '' });
  const changes = { team_history: th, roster_changes: rc };
  if (logChanged) changes.snapshot_log = log;
  return changes;
}

const lastBiz = (m) => { const [y, mo] = m.split('-').map(Number); let d = new Date(Date.UTC(y, mo, 0)); while ([0, 6].includes(d.getUTCDay())) d = new Date(d - 864e5); return d.toISOString().slice(0, 10); };

/** Months that can be closed (or closed again): every month before the latest, except the September closeout. */
export function closableMonths(log, closed) {
  closed = closed.filter((c) => c.month && c.collector);
  const months = [...new Set(log.map((r) => r.month))].sort();
  const latest = months.at(-1);
  return months.filter((m) => m < latest && m !== '2026-09' && !closed.some((c) => c.month === m))
    .concat(months.filter((m) => m < latest && closed.some((c) => c.month === m)));
}

/** Final numbers for a month from its last saved day; View 2 subtracts next month's moved purple. */
export function buildClose(month, log) {
  const inM = log.filter((r) => r.month === month), finalDay = inM.map((r) => r.date).sort().at(-1);
  const nm = nextMonth(month), asOf = log.filter((r) => r.month === nm).map((r) => r.date).sort().at(-1) || null;
  const nextMoved = {}; for (const r of log) if (r.date === asOf) nextMoved[r.collector] = r.purple_moved ?? 0;
  const at = new Date().toISOString();
  const rows = inM.filter((r) => r.date === finalDay).map((r) => ({
    key: month + '|' + r.collector, month, collector: r.collector, team: r.team, type: r.type,
    green_final: r.green, purple_final: r.purple_moved, green_target: r.green_target, purple_target: r.purple_target,
    next_month_moved: nextMoved[r.collector] ?? 0, next_month_as_of: asOf,
    purple_adjusted: r.purple_moved == null ? null : Math.round((r.purple_moved - (nextMoved[r.collector] ?? 0)) * 100) / 100,
    final_day: finalDay, closed_at: at }));
  const warn = [];
  if (finalDay !== lastBiz(month)) warn.push('The last saved day is ' + finalDay + ', not the last business day of the month (' + lastBiz(month) + ').');
  if (new Date().toISOString().slice(0, 10) < nm + '-10') warn.push('It’s before the 10th, so NSFs may still change the month. You can close it again later; that replaces this close.');
  return { rows, warn, finalDay, asOf };
}
