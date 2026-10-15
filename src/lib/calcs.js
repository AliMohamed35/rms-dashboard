// Derived tables, computed in the browser from the raw json-server collections.
// Same rules as the original dashboard; computeAll() runs them in dependency order.

const DAY = 864e5;
const round2 = (v) => +v.toFixed(2);
const diff = (a, b) => (a == null || b == null ? null : round2(a - b));
const byDate = (a, b) => (a.date < b.date ? -1 : 1);

/** Totals by team and collector per day: green, purple moved, targets, % to target, pace, collectors at target. */
export function scopeDay(snapshot_log, team_history) {
  const bd = (iso) => { const [y, m, d] = iso.split('-').map(Number); let n = 0; for (let i = 1; i <= d; i++) { const w = new Date(Date.UTC(y, m - 1, i)).getUTCDay(); if (w > 0 && w < 6) n++; } return n; };
  const monthEnd = (iso) => { const [y, m] = iso.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
  const tgt = {};
  for (const t of team_history) if (t.in_wpr === 'YES') for (const w of ['All', t.team]) { const a = (tgt[w + '|' + t.month] ??= { g: 0, p: 0 }); a.g += t.green_target; a.p += t.purple_target; }
  const groups = {};
  for (const r of snapshot_log) for (const w of ['All', r.team]) (groups[w + '|' + r.date] ??= { who: w, date: r.date, month: r.month, rows: [] }).rows.push(r);
  const out = [];
  for (const g of Object.values(groups)) {
    const t = tgt[g.who + '|' + g.month] ?? { g: 0, p: 0 };
    const green = g.rows.reduce((s, r) => s + (r.green ?? 0), 0);
    const cap = g.rows.filter((r) => r.purple_moved != null);
    const moved = cap.length ? cap.reduce((s, r) => s + r.purple_moved, 0) : null;
    const n = bd(g.date), nt = bd(monthEnd(g.date));
    out.push({ key: g.who + '|' + g.date, who: g.who, level: g.who === 'All' ? 'all' : 'team', team: g.who, date: g.date, month: g.month,
      green: round2(green), purple_moved: moved == null ? null : round2(moved), green_target: t.g, purple_target: t.p,
      pct_green: t.g ? green / t.g : null, pct_purple: moved != null && t.p ? moved / t.p : null,
      business_day: n, business_days_in_month: nt, green_pace: round2(t.g * n / nt), purple_pace: round2(t.p * n / nt),
      collectors: g.rows.length, at_green: g.rows.filter((r) => r.pct_green >= 1).length, at_purple: g.rows.filter((r) => r.pct_purple >= 1).length });
  }
  for (const a of out.filter((o) => o.level === 'all')) {
    const ts = out.filter((o) => o.level === 'team' && o.date === a.date);
    a.teams = ts.length; a.teams_at_green = ts.filter((o) => o.pct_green >= 1).length; a.teams_at_purple = ts.filter((o) => o.pct_purple >= 1).length;
  }
  for (const r of snapshot_log) {
    const n = bd(r.date), nt = bd(monthEnd(r.date));
    out.push({ key: r.collector + '|' + r.date, who: r.collector, level: 'collector', team: r.team, date: r.date, month: r.month,
      green: r.green, purple_moved: r.purple_moved, green_target: r.green_target, purple_target: r.purple_target,
      pct_green: r.pct_green, pct_purple: r.pct_purple, business_day: n, business_days_in_month: nt,
      green_pace: round2(r.green_target * n / nt), purple_pace: round2(r.purple_target * n / nt),
      collectors: 1, at_green: r.pct_green >= 1 ? 1 : 0, at_purple: r.pct_purple >= 1 ? 1 : 0 });
  }
  return out;
}

/** Each total minus the same total 7 days earlier in the month (or the closest earlier capture). */
export function weekOverWeek(scope_day) {
  const by = {};
  for (const r of scope_day) (by[r.who] ??= []).push(r);
  const out = [];
  for (const rs of Object.values(by)) {
    rs.sort(byDate);
    for (const r of rs) {
      const weekAgo = new Date(Date.parse(r.date) - 7 * DAY).toISOString().slice(0, 10);
      const earlier = rs.filter((p) => p.month === r.month && p.date < r.date);
      const c = [...earlier].reverse().find((p) => p.date <= weekAgo) ?? earlier[0] ?? null;
      out.push({ key: r.key, who: r.who, level: r.level, team: r.team, date: r.date, compared_to: c ? c.date : null, exact_week: c ? c.date === weekAgo : false,
        green: r.green, green_prev: c ? c.green : null, green_change: diff(r.green, c ? c.green : null),
        purple_moved: r.purple_moved, purple_prev: c ? c.purple_moved : null, purple_change: diff(r.purple_moved, c ? c.purple_moved : null) });
    }
  }
  return out;
}

/** Each total minus last month's total on the same business day (or the latest capture before it). */
export function monthOverMonth(scope_day) {
  const prevMonth = (m) => { const [y, mm] = m.split('-').map(Number); return new Date(Date.UTC(y, mm - 2, 1)).toISOString().slice(0, 7); };
  const byWhoMonth = {};
  for (const p of scope_day) (byWhoMonth[p.who + '|' + p.month] ??= []).push(p);
  return scope_day.map((r) => {
    const cands = (byWhoMonth[r.who + '|' + prevMonth(r.month)] ?? []).filter((p) => p.business_day <= r.business_day).sort((a, b) => b.business_day - a.business_day);
    const c = cands[0] ?? null;
    return { key: r.key, who: r.who, date: r.date, business_day: r.business_day, compared_to: c ? c.date : null,
      green: r.green, green_prev: c ? c.green : null, green_change: diff(r.green, c ? c.green : null),
      purple_moved: r.purple_moved, purple_prev: c ? c.purple_moved : null, purple_change: diff(r.purple_moved, c ? c.purple_moved : null) };
  });
}

/** Closed months by collector: September from the closeout, later months from Close month. */
export function monthClose(sep_close, snapshot_log, closed_months) {
  closed_months = closed_months.filter((c) => c.month && c.collector);
  const days = snapshot_log.filter((r) => r.month === '2026-10').map((r) => r.date).sort();
  const latest = days.length ? days[days.length - 1] : null;
  const cur = {};
  for (const r of snapshot_log) if (r.date === latest) cur[r.collector] = r.purple_moved ?? 0;
  const sep = sep_close.map((s) => {
    const oct = cur[s.collector] ?? 0;
    return { key: s.month + '|' + s.collector, month: s.month, collector: s.collector, team: s.team, new_hire: s.new_hire, green_target: s.green_target, purple_target: s.purple_target,
      green_view1: s.green_closeout, green_view2: s.green_updated, purple_view1: s.purple_moved_closeout,
      next_month_moved: oct, next_month_as_of: latest, purple_view2: round2(s.purple_moved_closeout - oct) };
  });
  const later = closed_months.map((c) => ({ key: c.month + '|' + c.collector, month: c.month, collector: c.collector, team: c.team, new_hire: c.type === 'New Hire' ? 'Y' : 'N',
    green_target: c.green_target, purple_target: c.purple_target, green_view1: c.green_final, green_view2: c.green_final, purple_view1: c.purple_final ?? 0,
    next_month_moved: c.next_month_moved, next_month_as_of: c.next_month_as_of, purple_view2: c.purple_adjusted ?? 0, final_day: c.final_day }));
  return [...sep, ...later];
}

/** Team sums of each closed month in both views, with % to target. */
export function monthCloseTeam(month_close) {
  const order = [], acc = {};
  const add = (k, team, r) => {
    const a = (acc[k] ??= { key: k, month: r.month, team, collectors: 0, green_target: 0, purple_target: 0, green_view1: 0, green_view2: 0, purple_view1: 0, purple_view2: 0 });
    a.collectors++; a.green_target += r.green_target; a.purple_target += r.purple_target;
    a.green_view1 += r.green_view1 ?? 0; a.green_view2 += r.green_view2 ?? 0; a.purple_view1 += r.purple_view1 ?? 0; a.purple_view2 += r.purple_view2 ?? 0;
  };
  for (const r of month_close) { const k = r.month + '|' + r.team; if (!acc[k]) order.push(k); add(k, r.team, r); add(r.month + '|TOTAL', 'TOTAL', r); }
  const months = [...new Set(month_close.map((r) => r.month))];
  return months.flatMap((m) => [...order.filter((k) => k.startsWith(m + '|')), m + '|TOTAL']).map((k) => {
    const a = acc[k];
    for (const f of ['green_view1', 'green_view2', 'purple_view1', 'purple_view2']) a[f] = round2(a[f]);
    return { ...a, pct_green_view1: a.green_view1 / a.green_target, pct_green_view2: a.green_view2 / a.green_target,
      pct_purple_view1: a.purple_view1 / a.purple_target, pct_purple_view2: a.purple_view2 / a.purple_target };
  });
}

/** Each collector-month from the fee report, joined to that month's calls and Standard target. */
export function historyCollector(fees_history, calls_history, target_rules) {
  const tg = Object.fromEntries(target_rules.map((t) => [t.month + '|' + t.type, t]));
  const c = {};
  for (const r of calls_history) if (r.collector) {
    const a = (c[r.collector + '|' + r.month] ??= { ob: 0, obc: 0, talk: 0, ib: 0, how: r.assigned_by });
    if (r.kind === 'Outbound') { a.ob += r.total ?? 0; a.obc += r.completed ?? 0; a.talk += r.talk_seconds ?? 0; } else a.ib += r.completed ?? 0;
  }
  return fees_history.map((f) => {
    const a = c[f.key]; const t = tg[f.month + '|Standard'] ?? {};
    return { key: f.key, month: f.month, team: f.team, collector: f.collector, green: f.green, purple_moved: f.purple_moved, cv_refs: f.cv_refs, cv_enrolled: f.cv_enrolled,
      green_target: t.green_target ?? null, purple_target: t.purple_target ?? null,
      pct_green: t.green_target ? f.green / t.green_target : null, pct_purple: t.purple_target ? f.purple_moved / t.purple_target : null,
      ob_calls: a ? a.ob : null, ob_completed: a ? a.obc : null, ob_completion: a && a.ob ? a.obc / a.ob : null, ob_talk_hours: a ? +(a.talk / 3600).toFixed(1) : null,
      ib_answered: a ? a.ib : null, purple_per_100_calls: a && a.ob ? round2(f.purple_moved / a.ob * 100) : null,
      calls_match: a ? (a.how === 'inferred' ? 'Extension (inferred)' : 'Extension') : 'Not found' };
  });
}

/** Team and account totals per month with targets, % to target and per-collector averages. */
export function historyTeam(history_collector, sep_close, closed_months) {
  closed_months = closed_months.filter((c) => c.month && c.collector);
  const blank = { ob_calls: null, ob_completed: null, ib_answered: null, cv_refs: null };
  const rows = [...history_collector,
    ...closed_months.map((c) => ({ month: c.month, team: c.team, collector: c.collector, green: c.green_final, purple_moved: c.purple_final, green_target: c.green_target, purple_target: c.purple_target, ...blank })),
    ...sep_close.map((s) => ({ month: s.month, team: s.team, collector: s.collector, green: s.green_closeout, purple_moved: s.purple_moved_closeout, green_target: s.green_target, purple_target: s.purple_target, ...blank }))];
  const acc = {};
  for (const r of rows) for (const t of ['All', r.team]) {
    const a = (acc[t + '|' + r.month] ??= { key: t + '|' + r.month, team: t, month: r.month, collectors: 0, green: 0, purple_moved: 0, green_target: 0, purple_target: 0, ...blank });
    a.collectors++; a.green += r.green ?? 0; a.purple_moved += r.purple_moved ?? 0; a.green_target += r.green_target ?? 0; a.purple_target += r.purple_target ?? 0;
    for (const f of ['ob_calls', 'ob_completed', 'ib_answered', 'cv_refs']) if (r[f] != null) a[f] = (a[f] ?? 0) + r[f];
  }
  return Object.values(acc).map((a) => ({ ...a, green: round2(a.green), purple_moved: round2(a.purple_moved),
    avg_green: round2(a.green / a.collectors), avg_purple_moved: round2(a.purple_moved / a.collectors),
    pct_green: a.green_target ? a.green / a.green_target : null, pct_purple_moved: a.purple_target ? a.purple_moved / a.purple_target : null,
    avg_ob_calls: a.ob_calls == null ? null : +(a.ob_calls / a.collectors).toFixed(1), avg_ob_completed: a.ob_completed == null ? null : +(a.ob_completed / a.collectors).toFixed(1) }));
}

/** Account call totals by month, including extensions not matched to a collector. */
export function callsMonth(calls_history) {
  const acc = {};
  for (const r of calls_history) {
    const a = (acc[r.month] ??= { month: r.month, ob_calls: 0, ob_completed: 0, ib_answered: 0, unassigned_ob: 0 });
    if (r.kind === 'Outbound') { a.ob_calls += r.total ?? 0; a.ob_completed += r.completed ?? 0; if (!r.collector) a.unassigned_ob += r.total ?? 0; } else a.ib_answered += r.completed ?? 0;
  }
  return Object.values(acc).sort((a, b) => (a.month < b.month ? -1 : 1)).map((a) => ({ ...a, ob_completion: a.ob_calls ? a.ob_completed / a.ob_calls : null }));
}

/** Pearson correlation and least-squares slope between outbound calls and purple moved, per month. */
export function callsFit(history_collector) {
  const by = {};
  for (const r of history_collector) if (r.ob_calls != null && r.purple_moved != null) (by[r.month] ??= []).push(r);
  return Object.entries(by).map(([month, rs]) => {
    const n = rs.length, sum = (f) => rs.reduce((s, r) => s + f(r), 0);
    const mx = sum((r) => r.ob_calls) / n, my = sum((r) => r.purple_moved) / n;
    const sxy = sum((r) => (r.ob_calls - mx) * (r.purple_moved - my)), sxx = sum((r) => (r.ob_calls - mx) ** 2), syy = sum((r) => (r.purple_moved - my) ** 2);
    const r = sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
    return { month, n, r: r == null ? null : +r.toFixed(3), r2: r == null ? null : +(r * r).toFixed(3), purple_per_100_calls: sxx ? round2(sxy / sxx * 100) : null };
  });
}

/** Green and purple moved on each snapshot date since the previous capture in the same month. */
export function dailyMove(scope_day) {
  const bdays = (a, b) => { let n = 0; for (let t = Date.parse(a) + DAY; t <= Date.parse(b); t += DAY) { const w = new Date(t).getUTCDay(); if (w > 0 && w < 6) n++; } return n; };
  const by = {};
  for (const r of scope_day) (by[r.who] ??= []).push(r);
  const out = [];
  for (const rs of Object.values(by)) {
    rs.sort(byDate);
    rs.forEach((r, i) => {
      const prev = i > 0 && rs[i - 1].month === r.month ? rs[i - 1] : null;
      const startPrev = new Date(Date.parse(r.month + '-01') - DAY).toISOString().slice(0, 10);
      out.push({ key: r.key, who: r.who, level: r.level, team: r.team, date: r.date, month: r.month,
        previous_date: prev ? prev.date : 'month start', business_days: bdays(prev ? prev.date : startPrev, r.date),
        green_moved: diff(r.green, prev ? prev.green : 0), purple_moved_day: diff(r.purple_moved, prev ? prev.purple_moved : 0) });
    });
  }
  return out;
}

/** Week of the month (W1 = first week, Monday to Friday). */
export const weekOfMonth = (iso) => { const d = new Date(iso + 'T00:00:00Z'); const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)); return Math.floor((d.getUTCDate() - 1 + (first.getUTCDay() + 6) % 7) / 7) + 1; };

/** Month-to-date at the last saved day of each week, pace on that day, and movement since the previous week end. */
export function weekReview(scope_day) {
  const lastBizOfWeek = (iso) => { const d = new Date(iso + 'T00:00:00Z'); const fri = new Date(d.getTime() + (4 - (d.getUTCDay() + 6) % 7) * DAY); const me = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)); let e = fri < me ? fri : me; while ([0, 6].includes(e.getUTCDay())) e = new Date(e.getTime() - DAY); return e.toISOString().slice(0, 10); };
  const by = {};
  for (const r of scope_day) (by[r.who + '|' + r.month] ??= []).push(r);
  const out = [];
  for (const rs of Object.values(by)) {
    const weeks = {};
    for (const r of rs) {
      const a = (weeks[weekOfMonth(r.date)] ??= { g: null, p: null });
      if (!a.g || a.g.date < r.date) a.g = r;
      if (r.purple_moved != null && (!a.p || a.p.date < r.date)) a.p = r;
    }
    let pg = null, pp = null;
    for (const w of Object.keys(weeks).map(Number).sort((a, b) => a - b)) {
      const g = weeks[w].g, p = weeks[w].p;
      out.push({ key: g.who + '|' + g.month + '|W' + w, who: g.who, level: g.level, team: g.team, month: g.month, week: 'W' + w,
        week_end: g.date, purple_as_of: p ? p.date : null, complete: g.date === lastBizOfWeek(g.date), previous_week_end: pg ? pg.date : 'month start', collectors: g.collectors,
        green_end: g.green, green_should: g.green_pace, green_variance: diff(g.green, g.green_pace), green_pct_pace: g.green_pace ? g.green / g.green_pace : null, green_target: g.green_target, green_pct_goal: g.pct_green,
        green_week: diff(g.green, pg ? pg.green : 0),
        purple_end: p ? p.purple_moved : null, purple_should: p ? p.purple_pace : null, purple_variance: p ? diff(p.purple_moved, p.purple_pace) : null,
        purple_pct_pace: p && p.purple_pace ? p.purple_moved / p.purple_pace : null, purple_target: g.purple_target, purple_pct_goal: p ? p.pct_purple : null,
        purple_week: p ? diff(p.purple_moved, pp ? pp.purple_moved : 0) : null });
      pg = g; if (p) pp = p;
    }
  }
  return out;
}

/** Team and results per collector per month: closed months final, the current month to date. */
export function collectorMonths(history_collector, sep_close, scope_day, team_history, closed_months) {
  closed_months = closed_months.filter((c) => c.month && c.collector);
  const out = [], seen = new Set();
  const add = (r) => { if (!seen.has(r.key)) { seen.add(r.key); out.push(r); } };
  for (const r of history_collector) add({ key: r.collector + '|' + r.month, collector: r.collector, month: r.month, team: r.team, green: r.green, purple_moved: r.purple_moved, green_target: r.green_target, purple_target: r.purple_target, pct_green: r.pct_green, pct_purple: r.pct_purple, closed: true, status: 'Final' });
  for (const s of sep_close) add({ key: s.collector + '|' + s.month, collector: s.collector, month: s.month, team: s.team, green: s.green_closeout, purple_moved: s.purple_moved_closeout, green_target: s.green_target, purple_target: s.purple_target, pct_green: s.green_closeout / s.green_target, pct_purple: s.purple_moved_closeout / s.purple_target, closed: true, status: 'Final (closeout)' });
  for (const c of closed_months) add({ key: c.collector + '|' + c.month, collector: c.collector, month: c.month, team: c.team, green: c.green_final, purple_moved: c.purple_final, green_target: c.green_target, purple_target: c.purple_target, pct_green: c.green_target ? c.green_final / c.green_target : null, pct_purple: c.purple_target && c.purple_final != null ? c.purple_final / c.purple_target : null, closed: true, status: 'Final (closed ' + (c.closed_at || '').slice(0, 10) + ')' });
  const latest = {};
  for (const r of scope_day) if (r.level === 'collector') { const k = r.who + '|' + r.month; if (!latest[k] || latest[k].date < r.date) latest[k] = r; }
  for (const [k, r] of Object.entries(latest)) add({ key: k, collector: r.who, month: r.month, team: r.team, green: r.green, purple_moved: r.purple_moved, green_target: r.green_target, purple_target: r.purple_target, pct_green: r.pct_green, pct_purple: r.pct_purple, closed: false, status: 'Month to date, ' + r.date });
  for (const t of team_history) if (t.in_wpr === 'YES') add({ key: t.collector + '|' + t.month, collector: t.collector, month: t.month, team: t.team, green: null, purple_moved: null, green_target: t.green_target, purple_target: t.purple_target, pct_green: null, pct_purple: null, closed: false, status: 'No numbers yet' });
  return out.sort((a, b) => (a.collector === b.collector ? (a.month < b.month ? -1 : 1) : a.collector < b.collector ? -1 : 1));
}

/** Consecutive months a collector spent on one team, with averages over the closed months. */
export function collectorStints(collector_months) {
  const out = []; let cur = null;
  const avg = (a, f) => { const v = a.map((x) => x[f]).filter((x) => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
  const close = () => {
    if (!cur) return; const c = cur.rows.filter((r) => r.closed);
    out.push({ key: cur.collector + '|' + cur.rows[0].month, collector: cur.collector, team: cur.team, from_month: cur.rows[0].month, to_month: cur.rows.at(-1).month,
      months: c.length, in_progress: cur.rows.some((r) => !r.closed), avg_purple_moved: avg(c, 'purple_moved'), avg_pct_purple: avg(c, 'pct_purple'), avg_green: avg(c, 'green'), avg_pct_green: avg(c, 'pct_green') });
  };
  for (const r of collector_months) {
    if (!cur || cur.collector !== r.collector || cur.team !== r.team) { close(); cur = { collector: r.collector, team: r.team, rows: [] }; }
    cur.rows.push(r);
  }
  close();
  return out;
}

/** The latest saved day and the business days of that month with nothing saved. */
export function dataStatus(snapshot_log) {
  const dates = [...new Set(snapshot_log.map((r) => r.date))].sort();
  const latest = dates.at(-1); if (!latest) return null;
  const [y, m, d] = latest.split('-').map(Number), missing = [];
  for (let i = 1; i <= d; i++) { const t = new Date(Date.UTC(y, m - 1, i)); const iso = t.toISOString().slice(0, 10); if (t.getUTCDay() > 0 && t.getUTCDay() < 6 && !dates.includes(iso)) missing.push(iso); }
  return { latest_day: latest, month: latest.slice(0, 7), missing_days: missing };
}

/** Month-end forecast at the current pace and what is still needed per remaining business day. */
export function forecast(scope_day) {
  return scope_day.map((r) => {
    const left = r.business_days_in_month - r.business_day;
    const fc = (v) => (v == null || !r.business_day ? null : round2(v / r.business_day * r.business_days_in_month));
    const need = (v, t) => (v == null || !t ? null : left > 0 ? round2(Math.max(0, t - v) / left) : null);
    const gf = fc(r.green), pf = fc(r.purple_moved);
    return { key: r.key, who: r.who, level: r.level, team: r.team, date: r.date, days_left: left,
      green_forecast: gf, green_forecast_pct: gf != null && r.green_target ? gf / r.green_target : null, green_needed_per_day: need(r.green, r.green_target),
      purple_forecast: pf, purple_forecast_pct: pf != null && r.purple_target ? pf / r.purple_target : null, purple_needed_per_day: need(r.purple_moved, r.purple_target) };
  });
}

/** Collectors below 70% of pace after the 15th, purple down more than $100 since the last day, or negative purple. */
export function watchList(scope_day, daily_move) {
  const mv = new Map(daily_move.filter((r) => r.level === 'collector').map((r) => [r.key, r]));
  const out = [];
  for (const r of scope_day) {
    if (r.level !== 'collector') continue;
    const reasons = [], late = +r.date.slice(8, 10) > 15;
    const gp = r.green_pace ? r.green / r.green_pace : null, pp = r.purple_pace && r.purple_moved != null ? r.purple_moved / r.purple_pace : null;
    const m = mv.get(r.key), pday = m ? m.purple_moved_day : null;
    if (late && gp != null && gp < 0.7) reasons.push('Green below 70% of pace');
    if (late && pp != null && pp < 0.7) reasons.push('Purple below 70% of pace');
    if (pday != null && pday < -100 && m.previous_date !== 'month start') reasons.push('Purple down since ' + m.previous_date + ' (possible NSF)');
    if (r.purple_moved != null && r.purple_moved < 0) reasons.push('Negative purple this month');
    if (reasons.length) out.push({ key: r.key, collector: r.who, team: r.team, date: r.date, green_pct_pace: gp, purple_pct_pace: pp, purple_day: pday, purple_moved: r.purple_moved, reasons: reasons.join('; '), severity: reasons.length });
  }
  return out;
}

/** Days off per collector, team and account for each week of the month (only collectors counted that month). */
export function daysOffWeek(vacation_days, team_history) {
  const team = new Map(team_history.filter((t) => t.in_wpr === 'YES').map((t) => [t.collector + '|' + t.month, t.team]));
  const acc = {};
  for (const v of vacation_days) {
    if (!v.collector || v.kind !== 'Day off') continue;
    const t = team.get(v.collector + '|' + v.month); if (!t) continue;
    const w = 'W' + weekOfMonth(v.date);
    for (const who of [v.collector, t, 'All']) {
      const k = who + '|' + v.month + '|' + w;
      const a = (acc[k] ??= { key: k, who, level: who === v.collector ? 'collector' : who === 'All' ? 'all' : 'team', team: t, month: v.month, week: w, days_off: 0, people: new Set(), dates: [] });
      a.days_off += v.days; a.people.add(v.collector); if (who === v.collector) a.dates.push(v.date.slice(8) + (v.days < 1 ? ' (½)' : ''));
    }
  }
  return Object.values(acc).map((a) => ({ key: a.key, who: a.who, level: a.level, team: a.team, month: a.month, week: a.week, days_off: a.days_off, people_off: a.people.size, dates: a.dates.sort().join(', ') }));
}

/** Actual vs 80% of target to date, and the 80% bar scaled to the days actually worked. */
export function check80(collector_months, vacation_days, vacation_summary) {
  const months = new Set(vacation_summary.map((s) => s.month));
  const bd = (from, to) => { let n = 0; for (let t = Date.parse(from + 'T00:00:00Z'); t <= Date.parse(to + 'T00:00:00Z'); t += DAY) { const w = new Date(t).getUTCDay(); if (w > 0 && w < 6) n++; } return n; };
  const monthEnd = (m) => { const [y, mo] = m.split('-').map(Number); return new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10); };
  const out = [];
  for (const r of collector_months) {
    if (!months.has(r.month) || r.green == null) continue;
    const end = monthEnd(r.month), m2 = (r.status || '').match(/\d{4}-\d{2}-\d{2}/);
    const asOf = r.closed || !m2 ? end : m2[0];
    const n = bd(r.month + '-01', end), e = bd(r.month + '-01', asOf);
    const off = vacation_days.filter((v) => v.collector === r.collector && v.kind === 'Day off' && v.month === r.month && v.date <= asOf).reduce((s, v) => s + v.days, 0);
    const worked = Math.max(0, e - off);
    const res = (actual, t) => {
      const bar = 0.8 * t * e / n, adj = 0.8 * t * worked / n;
      return { bar: round2(bar), adj: round2(adj), below: actual < bar, result: actual >= bar ? 'At or above 80%' : actual >= adj ? 'Meets 80% for days worked' : 'Below 80% even after days off' };
    };
    const g = res(r.green, r.green_target), p = res(r.purple_moved ?? 0, r.purple_target);
    out.push({ key: r.key, collector: r.collector, team: r.team, month: r.month, as_of: asOf, closed: r.closed, business_days: n, days_so_far: e, days_off: off, worked_days: worked,
      green: r.green, green_target: r.green_target, green_80: g.bar, green_adj80: g.adj, green_result: g.result, green_below: g.below,
      purple: r.purple_moved, purple_target: r.purple_target, purple_80: p.bar, purple_adj80: p.adj, purple_result: p.result, purple_below: p.below });
  }
  return out;
}

const index = (rows) => new Map(rows.map((r) => [r.key, r]));

/** Runs every calculation once and returns the derived tables plus key lookups. */
export function computeAll(raw) {
  const scope_day = scopeDay(raw.snapshot_log, raw.team_history);
  const wow = weekOverWeek(scope_day);
  const mom = monthOverMonth(scope_day);
  const month_close = monthClose(raw.sep_close, raw.snapshot_log, raw.closed_months);
  const history_collector = historyCollector(raw.fees_history, raw.calls_history, raw.target_rules);
  const daily_move = dailyMove(scope_day);
  const collector_months = collectorMonths(history_collector, raw.sep_close, scope_day, raw.team_history, raw.closed_months);
  const week_review = weekReview(scope_day);
  const fc = forecast(scope_day);
  const days_off_week = daysOffWeek(raw.vacation_days, raw.team_history);
  return {
    scope_day, wow, mom, month_close, history_collector, daily_move, collector_months, week_review, days_off_week,
    forecast: fc,
    month_close_team: monthCloseTeam(month_close),
    history_team: historyTeam(history_collector, raw.sep_close, raw.closed_months),
    calls_month: callsMonth(raw.calls_history),
    calls_fit: callsFit(history_collector),
    collector_stints: collectorStints(collector_months),
    data_status: dataStatus(raw.snapshot_log),
    watch_list: watchList(scope_day, daily_move),
    check80: check80(collector_months, raw.vacation_days, raw.vacation_summary),
    by: {
      scope: index(scope_day), wow: index(wow), mom: index(mom), daily: index(daily_move),
      forecast: index(fc), week: index(week_review), daysOff: index(days_off_week),
    },
  };
}
