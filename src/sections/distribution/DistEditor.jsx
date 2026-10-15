// Editors: move a collector, mark as left, leave out for a month, or add a new hire.
import { useState } from 'react';
import { useData } from '../../data/DataProvider';
import { TEAM_ORDER } from '../../lib/format';
import { applyChange, describeChange } from '../../lib/roster';
import { Btn, Card, CardTitle, Controls, Note, Row, Status, editorInputCls } from '../../components/ui';

const ACTIONS = [['Moved', 'Move to another team'], ['Left', 'Mark as left'], ['Not counted', 'Leave out this month (not working)'], ['Hired', 'Add a new hire']];
const labelCls = 'flex flex-col gap-0.5 text-caption text-muted';

export default function DistEditor({ raw, picked, onClose }) {
  const { save } = useData();
  const month = raw.team_history.map((r) => r.month).sort().at(-1);
  const roster = raw.team_history.filter((r) => r.month === month && r.in_wpr === 'YES');
  const collectors = [...roster].sort((a, b) => (a.collector < b.collector ? -1 : 1));
  const teams = TEAM_ORDER.filter((t) => roster.some((r) => r.team === t));
  const [form, setForm] = useState(() => ({
    action: 'Moved', collector: collectors[0]?.collector ?? '', team: teams[0] ?? '', code: '', name: '', date: new Date().toISOString().slice(0, 10),
  }));
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const update = (patch) => { setForm((f) => ({ ...f, ...patch })); setMsg(null); };

  // Clicking a card on the board while the editor is open picks that collector.
  const [seenPick, setSeenPick] = useState(picked);
  if (picked !== seenPick) {
    setSeenPick(picked);
    if (picked && roster.some((r) => r.collector === picked.code)) setForm((f) => ({ ...f, collector: picked.code }));
  }

  const { change, summary } = describeChange(form, roster, raw.team_history);

  const onSave = async () => {
    if (!change) return;
    setBusy(true); setMsg({ text: 'Saving…' });
    try {
      await save(applyChange(change, raw), change.action + ' ' + change.collector + (change.to_team ? ' to ' + change.to_team : '') + ' (' + change.effective_date + ')');
      setMsg({ text: 'Saved. The change is in the log below and the dashboard now uses it.' });
      setForm((f) => ({ ...f, code: '', name: '' }));
    } catch (e) {
      setMsg({ text: 'Couldn’t save (' + e.message + '). Nothing was changed.', bad: true });
    } finally { setBusy(false); }
  };

  const a = form.action;
  return (
    <Card id="dist-editor">
      <Row><CardTitle>Make a change</CardTitle><Btn onClick={onClose}>Close</Btn></Row>
      <Controls>
        <label className={labelCls}>Change
          <select className={editorInputCls} value={a} onChange={(e) => update({ action: e.target.value })}>
            {ACTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        {a !== 'Hired' && (
          <label className={labelCls}>Collector
            <select className={editorInputCls} value={form.collector} onChange={(e) => update({ collector: e.target.value })}>
              {collectors.map((r) => <option key={r.collector} value={r.collector}>{r.collector + ' — ' + (r.name || '') + ' (' + r.team + ')'}</option>)}
            </select>
          </label>
        )}
        {a === 'Hired' && (
          <>
            <label className={labelCls}>Code <input className={editorInputCls} type="text" size={8} placeholder="e.g. ABCD" value={form.code} onChange={(e) => update({ code: e.target.value })} /></label>
            <label className={labelCls}>Name <input className={editorInputCls} type="text" size={22} value={form.name} onChange={(e) => update({ name: e.target.value })} /></label>
          </>
        )}
        {(a === 'Moved' || a === 'Hired') && (
          <label className={labelCls}>To team
            <select className={editorInputCls} value={form.team} onChange={(e) => update({ team: e.target.value })}>
              {teams.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
        )}
        <label className={labelCls}>Effective date <input className={editorInputCls} type="date" value={form.date} onChange={(e) => update({ date: e.target.value })} /></label>
        <Btn primary disabled={!change || busy} onClick={onSave}>Save change</Btn>
      </Controls>
      <Note>{summary}</Note>
      <Status msg={msg} />
    </Card>
  );
}
