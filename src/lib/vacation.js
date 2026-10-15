// Days off: parses the monthly vacation-period report. People are matched to collectors by employee number.
const MON = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function parseVacationReport(tables, fileName) {
  const fm = fileName.match(/(\d{4})-(\d{2})-\d{2}_(\d{4})-(\d{2})-\d{2}/);
  let summary = null, detailed = null;
  for (const rows of tables) {
    const h = (rows[0] || []).map(norm);
    if (h.includes('vacationdaystakensubmitted')) summary = { rows, h };
    else if (h.includes('planneddaysoff') && h.includes('employeeno')) detailed = { rows, h };
  }
  if (!summary) throw new Error('This doesn’t look like the vacation-period report: the Summary sheet with "Vacation Days (taken / submitted)" wasn’t found.');
  const col = (t, name) => t.h.indexOf(name);
  const S = summary, iNo = col(S, 'employeeno'), iName = col(S, 'name'), iOff = col(S, 'daysoff'), iEx = col(S, 'excusestaken'),
    iVac = col(S, 'vacationdaystakensubmitted'), iExc = col(S, 'excusedaystakensubmitted'), iReason = col(S, 'reasons'),
    iPL = col(S, 'plannedleave'), iAb = col(S, 'absenteeism'), iSh = col(S, 'shrinkage'), iTS = col(S, 'totalshrinkage');
  const det = {};
  if (detailed) {
    const T = detailed;
    for (const r of T.rows.slice(1)) if (r[col(T, 'employeeno')] != null)
      det[String(r[col(T, 'employeeno')]).padStart(3, '0')] = { planned: r[col(T, 'planneddaysoff')], casual: r[col(T, 'casualdaysoff')], sick: r[col(T, 'sickdaysoff')] };
  }
  const year = fm ? +fm[1] : new Date().getFullYear();
  const days = [], summ = [], months = new Set();
  for (const r of S.rows.slice(1)) {
    if (r[iNo] == null || String(r[iName] || '').trim().toLowerCase().startsWith('totals')) continue;
    const no = String(r[iNo]).trim().padStart(3, '0'), name = String(r[iName] || '').trim();
    for (const [kind, txt] of [['Day off', r[iVac]], ['Excuse', r[iExc]]]) {
      for (const part of String(txt || '').split(';')) {
        const m = part.match(/^\s*([A-Z][a-z]{2}) (\d+)\s*(½d|\d+(?:\.\d+)?h)?/); if (!m || !MON[m[1]]) continue;
        const date = year + '-' + String(MON[m[1]]).padStart(2, '0') + '-' + String(+m[2]).padStart(2, '0');
        const amt = m[3] || ''; months.add(date.slice(0, 7));
        days.push({ key: no + '|' + date + '|' + kind, emp_no: no, collector: null, name, date, month: date.slice(0, 7), kind,
          days: kind === 'Day off' ? (amt === '½d' ? 0.5 : 1) : 0, hours: amt.endsWith('h') ? Number(amt.slice(0, -1)) : null });
      }
    }
    const dd = det[no] || {};
    summ.push({ emp_no: no, collector: null, name, planned: dd.planned ?? null, casual: dd.casual ?? null, sick: dd.sick ?? null, days_off: r[iOff], excuses: r[iEx],
      planned_leave_pct: r[iPL] ?? null, absenteeism_pct: r[iAb] ?? null, shrinkage_pct: r[iSh] ?? null, total_shrinkage_pct: r[iTS] ?? null, reasons: r[iReason] || '' });
  }
  const month = fm ? fm[1] + '-' + fm[2] : [...months].sort()[0];
  if (!month) throw new Error('Couldn’t tell which month this report covers.');
  summ.forEach((s) => { s.month = month; s.key = s.emp_no + '|' + month; });
  return { month, days: days.filter((d) => d.month === month), summ };
}

/** Fills in collector codes from `people` (by employee number). Returns new objects. */
export function matchPeople(parsed, people) {
  const map = new Map(people.map((p) => [p.emp_no, p.collector]));
  return {
    ...parsed,
    days: parsed.days.map((d) => ({ ...d, collector: map.get(d.emp_no) || null })),
    summ: parsed.summ.map((s) => ({ ...s, collector: map.get(s.emp_no) || null })),
  };
}
