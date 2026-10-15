// "Update numbers" (RAW FEES export → that day's snapshot) and "Days off" (monthly vacation report).
// Both read the file in the browser, show a summary to check, and save through json-server when confirmed.
import { useMemo, useRef, useState } from 'react';
import { useData } from '../data/DataProvider';
import { usd, sgn } from '../lib/format';
import { readTables } from '../lib/spreadsheet';
import { buildDay, parseFees, priorBusinessDay } from '../lib/fees';
import { matchPeople, parseVacationReport } from '../lib/vacation';
import { Btn, Card, CardTitle, Controls, List, Note, Row, Section, Status, fileInputCls } from '../components/ui';

export default function UpdatePanel({ onClose }) {
  return (
    <Section id="update">
      <FeesCard onClose={onClose} />
      <VacationCard />
    </Section>
  );
}

const sum = (a, f) => a.reduce((s, r) => s + (r[f] ?? 0), 0);

// Each card recognises the other card's report, so a file dropped in the wrong place gets a useful message.
const isVacationReport = (tables) => tables.some((t) => (t[0] || []).some((h) => /vacation days|planned days off/i.test(String(h ?? ''))));
const isFeesExport = (tables) => { try { parseFees(tables); return true; } catch { return false; } };

function FeesCard({ onClose }) {
  const { raw, save } = useData();
  const fileRef = useRef(null);
  const [fees, setFees] = useState(null);
  const [date, setDate] = useState(priorBusinessDay);
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  // Rebuilt whenever the file, the date or the saved data change.
  const built = useMemo(() => {
    if (!fees) return null;
    if (!date) return { error: 'Pick the date these numbers are for.' };
    try { return buildDay(date, fees, raw.snapshot_log, raw.team_history, raw.target_rules, raw.roster_changes); }
    catch (e) { return { error: e.message }; }
  }, [fees, date, raw]);

  const summary = useMemo(() => {
    if (!built || built.error) return [];
    const rs = built.rows, prev = raw.snapshot_log.filter((r) => r.date === built.lastDate);
    const sameMonth = prev.length && rs[0] && prev[0] && rs[0].month === prev[0].month;
    return [
      'Date: ' + date + (built.replaced ? ' (already saved — this will replace it)' : ''),
      'Collectors: ' + rs.length + ' · missing from the file: ' + rs.filter((r) => r.flags.includes('MISSING')).length,
      'Green MTD: ' + usd(sum(rs, 'green')) + (prev.length ? ' (' + sgn(sum(rs, 'green') - sum(prev, 'green')) + ' since ' + built.lastDate + ')' : ''),
      'Purple moved MTD: ' + usd(sum(rs, 'purple_moved')) + (sameMonth ? ' (' + sgn(sum(rs, 'purple_moved') - sum(prev, 'purple_moved')) + ' since ' + built.lastDate + ')' : ''),
      'Flagged: ' + (rs.filter((r) => r.flags).map((r) => r.collector + ' (' + r.flags.toLowerCase() + ')').join(', ') || 'none'),
      ...built.notes,
    ].map((left) => ({ left }));
  }, [built, date, raw]);

  const onFile = async (e) => {
    setFees(null); setMsg(null);
    const f = e.target.files[0]; if (!f) return;
    setMsg({ text: 'Reading ' + f.name + '…' });
    try {
      const tables = await readTables(f);
      if (isVacationReport(tables)) throw new Error(f.name + ' is the vacation-period report. Upload it in “Days off (vacation report)” below; this box takes the RAW FEES export.');
      const parsed = parseFees(tables);
      setFees(parsed);
      setMsg({ text: 'Read ' + Object.keys(parsed.total).length + ' agents from ' + f.name + '. Check the summary, then save.' });
    } catch (err) { setMsg({ text: err.message || 'Couldn’t read that file.', bad: true }); }
  };

  const onSave = async () => {
    if (!built || built.error) return;
    const d = built.rows[0]?.date ?? date;
    setSaving(true); setMsg({ text: 'Saving…' });
    try {
      const log = raw.snapshot_log.filter((r) => r.date !== d).concat(built.rows)
        .sort((a, b) => (a.date === b.date ? (a.collector < b.collector ? -1 : 1) : a.date < b.date ? -1 : 1));
      const changes = { snapshot_log: log };
      if (built.newTH) changes.team_history = built.newTH;
      const saved = await save(changes, 'Update numbers for ' + d);
      setMsg({ text: saved ? 'Saved. ' + d + ' is now on the dashboard for everyone.' : 'Already up to date: the numbers for ' + d + ' are exactly what’s saved, so nothing changed.' });
      setFees(null); if (fileRef.current) fileRef.current.value = '';
    } catch (e) {
      setMsg({ text: 'Couldn’t save (' + e.message + '). Nothing was changed; try again.', bad: true });
    } finally { setSaving(false); }
  };

  const ready = built && !built.error && built.rows.length > 0;
  const status = built?.error ? { text: built.error, bad: true } : msg;
  return (
    <Card>
      <Row><CardTitle>Update numbers</CardTitle><Btn onClick={onClose}>Close</Btn></Row>
      <Note>Upload the RAW FEES export from RMS Web Reporting (.ods, .xlsx or .csv) and pick the day it covers, normally the previous business day. The dashboard checks it isn’t a repeat, shows a summary, and saves it for everyone when you confirm.</Note>
      <Controls>
        <label className="flex flex-col gap-0.5 text-caption text-muted">Export file
          <input ref={fileRef} type="file" accept=".ods,.xlsx,.csv,.tsv,.txt" className={fileInputCls} onChange={onFile} />
        </label>
        <label className="flex flex-col gap-0.5 text-caption text-muted">Numbers are for
          <input type="date" className="text-body text-fg" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <Btn disabled={!ready || saving} onClick={onSave}>
          {ready ? (built.replaced ? 'Replace ' + date : 'Add ' + date + ' to the dashboard') : 'Add to the dashboard'}
        </Btn>
      </Controls>
      <Status msg={status} />
      <List items={summary} />
    </Card>
  );
}

function VacationCard() {
  const { raw, save } = useData();
  const fileRef = useRef(null);
  const [parsed, setParsed] = useState(null);
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  const report = useMemo(() => (parsed ? matchPeople(parsed, raw.people) : null), [parsed, raw.people]);
  const summary = useMemo(() => {
    if (!report) return [];
    const unmatched = report.summ.filter((s) => !s.collector);
    const off = report.days.filter((d) => d.kind === 'Day off').reduce((a, d) => a + d.days, 0);
    const top = report.summ.filter((s) => s.collector && s.days_off >= 3).sort((a, b) => b.days_off - a.days_off).map((s) => s.collector + ' ' + s.days_off);
    return [
      'Month: ' + report.month + (raw.vacation_summary.some((s) => s.month === report.month) ? ' (already uploaded — this replaces it)' : ''),
      'People: ' + report.summ.length + ' · days off in total: ' + off,
      'Most days off: ' + (top.join(', ') || 'nobody with 3 or more'),
      unmatched.length
        ? 'Not matched to a collector (no employee number on file): ' + unmatched.map((s) => s.emp_no + ' ' + s.name).join(', ') + '. Add them to people in db.json.'
        : 'Everyone matched to a collector code.',
    ].map((left) => ({ left }));
  }, [report, raw.vacation_summary]);

  const onFile = async (e) => {
    setParsed(null); setMsg(null);
    const f = e.target.files[0]; if (!f) return;
    setMsg({ text: 'Reading ' + f.name + '…' });
    try {
      const tables = await readTables(f);
      if (!isVacationReport(tables) && isFeesExport(tables)) throw new Error(f.name + ' is the RAW FEES export. Upload it in “Update numbers” above; this box takes the vacation-period report.');
      setParsed(parseVacationReport(tables, f.name));
      setMsg({ text: 'Check the summary, then save.' });
    } catch (err) { setMsg({ text: err.message || 'Couldn’t read that file.', bad: true }); }
  };

  const onSave = async () => {
    if (!report) return;
    const m = report.month;
    setSaving(true); setMsg({ text: 'Saving…' });
    try {
      const saved = await save({
        vacation_days: raw.vacation_days.filter((d) => d.month !== m).concat(report.days),
        vacation_summary: raw.vacation_summary.filter((s) => s.month !== m).concat(report.summ),
      }, 'Days-off report for ' + m);
      setMsg({ text: saved ? 'Saved. Days off for ' + m + ' are updated for everyone.' : 'Already up to date: this report matches the days off saved for ' + m + ', so nothing changed.' });
      setParsed(null); if (fileRef.current) fileRef.current.value = '';
    } catch (e) {
      setMsg({ text: 'Couldn’t save (' + e.message + '). Nothing was changed.', bad: true });
    } finally { setSaving(false); }
  };

  return (
    <Card>
      <CardTitle>Days off (vacation report)</CardTitle>
      <Note>Every Monday, upload the vacation-period report for the whole month (1st to last day). It replaces that month’s days off, so late changes and cancellations are picked up.</Note>
      <Controls>
        <label className="flex flex-col gap-0.5 text-caption text-muted">Report file
          <input ref={fileRef} type="file" accept=".xlsx,.ods" className={fileInputCls} onChange={onFile} />
        </label>
        <Btn disabled={!report || saving} onClick={onSave}>Save days off</Btn>
      </Controls>
      <Status msg={msg} />
      <List items={summary} />
    </Card>
  );
}
