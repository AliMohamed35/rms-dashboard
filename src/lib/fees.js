// "Update numbers": turns a RAW FEES export into that day's snapshot rows, with the same rules as the archive.
// Also holds the team rules shared with the Distribution editor (targets and starting a new month).

const DAY = 864e5;
const isoDate = (t) => new Date(t).toISOString().slice(0, 10);
const monthsBetween = (a, b) => { const [ya, ma] = a.split('-').map(Number), [yb, mb] = b.split('-').map(Number); return (yb - ya) * 12 + (mb - ma); };

/** RAW FEES: green = Total Fee − |Negative Fee| (left block), purple = Total 12mo Fee (right block). */
export function parseFees(tables) {
  const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const rows of tables) {
    for (let h = 0; h < Math.min(rows.length, 20); h++) {
      const hdr = (rows[h] || []).map(norm);
      const a1 = hdr.indexOf('agent'), tf = hdr.indexOf('totalfee'), nf = hdr.indexOf('negativefee');
      const a2 = hdr.indexOf('agent', a1 + 1), t12 = hdr.indexOf('total12mofee');
      if (a1 < 0 || tf < 0 || nf < 0 || a2 < 0 || t12 < 0) continue;
      const green = {}, total = {};
      for (let r = h + 1; r < rows.length; r++) {
        const row = rows[r] || [];
        const k1 = String(row[a1] ?? '').trim().toUpperCase(), k2 = String(row[a2] ?? '').trim().toUpperCase();
        if (k1 && !(k1 in green) && typeof row[tf] === 'number') green[k1] = Math.round((row[tf] - Math.abs(typeof row[nf] === 'number' ? row[nf] : 0)) * 100) / 100;
        if (k2 && !(k2 in total) && typeof row[t12] === 'number') total[k2] = Math.round(row[t12] * 100) / 100;
      }
      return { green, total };
    }
  }
  throw new Error('Couldn’t find the fees table: the file needs the Agent, Total Fee, Negative Fee and Total 12mo Fee columns.');
}

/**
 * Targets for a collector in a month. New hires: the first counted month uses the hire-month targets; then green
 * starts at 1,000 and steps up 500 a month until it reaches the Standard target (then they are Standard).
 */
export function targetsFor(collector, month, type, th, rules) {
  const std = rules.find((r) => r.month === month && r.type === 'Standard');
  if (!std) return null;
  if (type !== 'New Hire') return { type: 'Standard', green_target: std.green_target, purple_target: std.purple_target };
  const first = th.filter((x) => x.collector === collector && x.type === 'New Hire').map((x) => x.month).sort()[0] || month;
  const k = monthsBetween(first, month);
  const hire = rules.find((r) => r.type === 'New Hire' && r.month === '2026-09'); // hire-month targets ($250 / $2,000)
  if (k <= 0) return { type: 'New Hire', green_target: hire.green_target, purple_target: hire.purple_target };
  const g = Math.min(std.green_target, 1000 + 500 * (k - 1));
  return { type: g >= std.green_target ? 'Standard' : 'New Hire', green_target: g, purple_target: std.purple_target };
}

/** The team list for a new month: last month's list plus the roster changes due from this month. */
export function startMonth(month, prevMonth, th, rules, changes) {
  const due = changes.filter((c) => c.counts_from === month);
  const skipped = (c) => changes.some((x) => x.collector === c && x.action === 'Not counted' && x.counts_from === prevMonth) && !changes.some((x) => x.collector === c && x.action === 'Left' && x.counts_from <= prevMonth);
  let rows = th.filter((r) => r.month === prevMonth && (r.in_wpr === 'YES' || skipped(r.collector))).map((r) => ({ ...r, in_wpr: 'YES' }));
  for (const c of due) {
    if (c.action === 'Left') rows = rows.filter((r) => r.collector !== c.collector);
    if (c.action === 'Moved') rows.forEach((r) => { if (r.collector === c.collector) r.team = c.to_team; });
    if (c.action === 'Hired' && !rows.some((r) => r.collector === c.collector))
      rows.push({ collector: c.collector, name: c.name, team: c.to_team, type: 'New Hire', in_wpr: 'YES' });
  }
  const thPlus = [...th, ...rows.filter((r) => r.type === 'New Hire' && !th.some((x) => x.collector === r.collector)).map((r) => ({ ...r, month }))];
  return rows.map((r) => {
    const t = targetsFor(r.collector, month, r.type, thPlus, rules);
    if (!t) throw new Error('There are no targets for ' + month + ' yet.');
    return { month, collector: r.collector, name: r.name, team: r.team, type: t.type, green_target: t.green_target, purple_target: t.purple_target,
      in_wpr: 'YES', effective_from: month + '-01', effective_to: null, notes: due.filter((c) => c.collector === r.collector).map((c) => c.action + (c.to_team ? ' to ' + c.to_team : '')).join('; '), key: r.collector + '|' + month };
  });
}

/** The business day before today (local calendar), the usual date of an export. */
export function priorBusinessDay() {
  const now = new Date(); let t = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - DAY;
  while ([0, 6].includes(new Date(t).getUTCDay())) t -= DAY;
  return isoDate(t);
}

/** Builds the snapshot rows for `date` from parsed fees; starts the month's team list if it doesn't exist yet. */
export function buildDay(date, fees, log, th, rules, changes = []) {
  const month = date.slice(0, 7);
  const notes = [];
  let roster = th.filter((r) => r.month === month);
  let newTH = null;
  if (!roster.length) {
    const prevMonth = th.map((r) => r.month).filter((m) => m < month).sort().at(-1);
    if (!prevMonth) throw new Error('No team list to start ' + month + ' from.');
    const std = rules.find((r) => r.month === month && r.type === 'Standard');
    if (!std) throw new Error('There are no targets for ' + month + ' yet. Add that month’s targets to target_rules in db.json first.');
    roster = startMonth(month, prevMonth, th, rules, changes);
    newTH = [...th, ...roster];
    notes.push('Started ' + month + ' with the ' + prevMonth + ' team list, this month’s targets and any team changes due from ' + month + '.');
  }
  const active = roster.filter((r) => r.in_wpr === 'YES' && (!r.effective_from || r.effective_from <= date) && (!r.effective_to || r.effective_to >= date));
  const earlier = log.filter((r) => r.date < date);
  const lastDate = earlier.map((r) => r.date).sort().at(-1);
  const lastRows = earlier.filter((r) => r.date === lastDate);
  if (lastRows.length && lastRows.every((r) => fees.green[r.collector] === r.green && fees.total[r.collector] === r.purple_total))
    throw new Error('These numbers are identical to ' + lastDate + ', so the export hasn’t been refreshed. Check the report’s date range and export again.');
  const prevMonthLast = {};
  const pm = earlier.filter((r) => r.month < month).map((r) => r.date).sort().at(-1);
  for (const r of earlier) if (r.date === pm && r.purple_total != null) prevMonthLast[r.collector] = r.purple_total;
  const baseOf = (c) => { const b = log.find((r) => r.collector === c && r.month === month && r.baseline != null); return b ? b.baseline : prevMonthLast[c]; };
  const d = new Date(date + 'T00:00:00Z'), dayNr = (d.getUTCDay() + 6) % 7;
  const thu = new Date(d.getTime() + (3 - dayNr) * DAY), y1 = Date.UTC(thu.getUTCFullYear(), 0, 1);
  const isoWeek = thu.getUTCFullYear() + '-W' + String(Math.floor((thu - y1) / DAY / 7) + 1).padStart(2, '0');
  const rows = active.map((t) => {
    const c = t.collector, g = fees.green[c] ?? null, T = fees.total[c] ?? null, b = baseOf(c);
    const flags = [];
    if (g == null || T == null) flags.push('MISSING FROM RAW FEES');
    let moved;
    if (b == null) { moved = 0; flags.push('NO BASELINE'); } else moved = T == null ? null : Math.round((T - b) * 100) / 100;
    if (moved != null && moved < 0) flags.push('NEGATIVE PURPLE MOVED');
    return { date, month, iso_week: isoWeek, week_start: isoDate(d.getTime() - dayNr * DAY), collector: c, team: t.team, type: t.type,
      green: g, purple_total: T, baseline: b ?? null, purple_moved: moved, green_target: t.green_target, purple_target: t.purple_target,
      pct_green: g == null || !t.green_target ? null : Math.round(g / t.green_target * 1e4) / 1e4,
      pct_purple: moved == null || !t.purple_target ? null : Math.round(moved / t.purple_target * 1e4) / 1e4,
      flags: flags.join(', '), source: 'Update numbers (as of ' + date + ')', key: c + '|' + date };
  });
  return { rows, newTH, notes, lastDate, replaced: log.some((r) => r.date === date) };
}
