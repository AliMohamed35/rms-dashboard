import { useEffect, useState } from 'react';
import { useData } from '../data/DataProvider';
import { Btn } from './ui';

/** Undo the last saved change. The first click arms it (shows what will be undone); the second click undoes. */
export default function UndoButton() {
  const { lastChange, undo } = useData();
  const [mode, setMode] = useState({ state: 'idle' }); // idle | armed | busy | error

  useEffect(() => {
    if (mode.state !== 'armed') return;
    const t = setTimeout(() => setMode({ state: 'idle' }), 6000);
    return () => clearTimeout(t);
  }, [mode.state]);

  if (!lastChange) return null;

  const onClick = async () => {
    if (mode.state !== 'armed') { setMode({ state: 'armed' }); return; }
    setMode({ state: 'busy' });
    try { await undo(lastChange.id); setMode({ state: 'idle' }); }
    catch (e) { setMode({ state: 'error', msg: e.message }); }
  };

  const label = mode.state === 'armed' ? 'Click again to undo: ' + lastChange.label
    : mode.state === 'busy' ? 'Undoing…'
    : mode.state === 'error' ? 'Couldn’t undo (' + mode.msg + ')'
    : 'Undo last change';
  return (
    <Btn onClick={onClick} disabled={mode.state === 'busy'} title={'Undo: ' + lastChange.label + ' (' + new Date(lastChange.at).toLocaleString() + ')'}>
      {label}
    </Btn>
  );
}
