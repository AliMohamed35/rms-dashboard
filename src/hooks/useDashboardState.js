import { useCallback, useEffect, useMemo, useState } from 'react';
import { TEAM_ORDER } from '../lib/format';

export const DEFAULTS = {
  page: 'mtd', month: '2026-10', team: 'All', collector: 'All', date: null, metric: 'green', view: '1',
  hmetric: 'purple_moved', hscale: 'total', hmonth: '2026-08', hcollector: null, week: null, wmetric: 'green',
  profile: null, pmetric: 'purple_moved', cmonth: null,
};

const PAGES = ['mtd', 'wpr', 'dist'];
const pageFromUrl = () => { const v = new URLSearchParams(window.location.search).get('page'); return PAGES.includes(v) ? { page: v } : {}; };

/** Filter/view parameters. set({ x: null }) falls back to the default; reset() clears every filter but stays on the tab. The tab is kept in ?page=. */
export function useParams() {
  const [params, setParams] = useState(pageFromUrl);
  const set = useCallback((o) => setParams((p) => {
    const next = { ...p, ...o };
    for (const k of Object.keys(o)) if (o[k] == null) delete next[k];
    return next;
  }), []);
  const reset = useCallback(() => setParams((p) => (p.page ? { page: p.page } : {})), []);
  const changed = Object.keys(params).some((k) => k !== 'page');
  const p = useMemo(() => ({ ...DEFAULTS, ...Object.fromEntries(Object.entries(params).filter(([, v]) => v != null)) }), [params]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (p.page === DEFAULTS.page) url.searchParams.delete('page'); else url.searchParams.set('page', p.page);
    if (url.href !== window.location.href) window.history.replaceState(null, '', url);
  }, [p.page]);

  return { p, set, reset, changed };
}

/** The month / team / collector / snapshot date actually in effect, falling back to valid options. */
export function useSelection(raw, p) {
  return useMemo(() => {
    if (!raw) return null;
    const th = raw.team_history, log = raw.snapshot_log;
    const page = ['wpr', 'dist'].includes(p.page) ? p.page : 'mtd';
    const months = [...new Set(th.map((r) => r.month))].sort().reverse();
    const month = months.includes(p.month) ? p.month : months[0];
    const teams = TEAM_ORDER.filter((t) => th.some((r) => r.month === month && r.team === t && r.in_wpr === 'YES'));
    const team = teams.includes(p.team) ? p.team : 'All';
    const people = th.filter((r) => r.month === month && r.in_wpr === 'YES' && (team === 'All' || r.team === team)).sort((a, b) => (a.collector < b.collector ? -1 : 1));
    const collector = people.some((r) => r.collector === p.collector) ? p.collector : 'All';
    const dates = [...new Set(log.filter((r) => r.month === month).map((r) => r.date))].sort().reverse();
    const date = dates.includes(p.date) ? p.date : dates[0];
    const who = collector !== 'All' ? collector : team;
    const scopeName = collector !== 'All' ? collector : team === 'All' ? 'All teams' : team + '’s team';
    return { page, months, month, teams, team, people, collector, dates, date, who, scopeName, key: who + '|' + date };
  }, [raw, p]);
}
