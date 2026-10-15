import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { computeAll } from '../lib/calcs';

const REQUIRED = ['snapshot_log', 'team_history', 'sep_close', 'fees_history', 'calls_history', 'target_rules'];
const OPTIONAL = ['roster_changes', 'closed_months', 'people', 'vacation_days', 'vacation_summary'];
const keyField = (collection) => (collection === 'roster_changes' ? 'id' : 'key');

function normalize(db) {
  const missing = REQUIRED.filter((c) => !Array.isArray(db?.[c]));
  if (missing.length) throw new Error('db.json is missing: ' + missing.join(', '));
  return Object.fromEntries([...REQUIRED, ...OPTIONAL].map((c) => [c, Array.isArray(db[c]) ? db[c] : []]));
}

/** Turns "the new contents of these collections" into minimal upsert/delete ops by key. */
function diffOps(raw, changes) {
  return Object.entries(changes).map(([collection, rows]) => {
    const kf = keyField(collection);
    const old = new Map((raw[collection] ?? []).map((r) => [String(r[kf]), r]));
    const next = new Set(rows.map((r) => String(r[kf])));
    return {
      collection,
      upsert: rows.filter((r) => { const o = old.get(String(r[kf])); return !o || JSON.stringify(o) !== JSON.stringify(r); }),
      delete: [...old.keys()].filter((k) => !next.has(k)),
    };
  }).filter((op) => op.upsert.length || op.delete.length);
}

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [state, setState] = useState({ status: 'loading', raw: null, error: null });
  const [meta, setMeta] = useState({ writable: false, auth: false });
  const [lastChange, setLastChange] = useState(null);

  const refreshUndo = useCallback(async () => {
    try { setLastChange(await api.lastChange()); } catch { setLastChange(null); }
  }, []);

  const load = useCallback(async () => {
    try {
      const [db, m] = await Promise.all([api.db(), api.meta().catch(() => ({ writable: false, auth: false }))]);
      setState({ status: 'ready', raw: normalize(db), error: null });
      setMeta(m);
      if (m.writable) refreshUndo();
    } catch (e) {
      setState((s) => (s.raw ? s : { status: 'error', raw: null, error: e.message }));
    }
  }, [refreshUndo]);

  useEffect(() => { load(); }, [load]);

  const derived = useMemo(() => (state.raw ? computeAll(state.raw) : null), [state.raw]);

  /** Saves new contents for one or more collections as one undoable change. Resolves false when nothing differs. */
  const save = useCallback(async (changes, label) => {
    const ops = diffOps(state.raw, changes);
    if (!ops.length) return false;
    await api.save(label, ops);
    await load();
    return true;
  }, [state.raw, load]);

  const undo = useCallback(async (id) => {
    await api.undo(id);
    await load();
  }, [load]);

  const value = useMemo(() => ({ ...state, derived, meta, lastChange, save, undo, reload: load }), [state, derived, meta, lastChange, save, undo, load]);
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside <DataProvider>');
  return ctx;
}
