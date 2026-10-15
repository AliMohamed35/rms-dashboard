import { useState } from 'react';
import { utcFormat } from 'd3';
import { useData } from './data/DataProvider';
import { useParams, useSelection } from './hooks/useDashboardState';
import { day, monthLabel, pct } from './lib/format';
import { Btn, Controls, Note, Select } from './components/ui';
import UndoButton from './components/UndoButton';
import UpdatePanel from './sections/UpdatePanel';
import Distribution from './sections/distribution/Distribution';
import WeeklyReview from './sections/wpr/WeeklyReview';
import Period from './sections/mtd/Period';
import WatchList from './sections/mtd/WatchList';
import Check80 from './sections/mtd/Check80';
import Daily from './sections/mtd/Daily';
import Trend from './sections/mtd/Trend';
import Teams from './sections/mtd/Teams';
import MonthOverMonth from './sections/mtd/MonthOverMonth';
import Rankings from './sections/mtd/Rankings';
import Collectors from './sections/mtd/Collectors';
import MonthClose from './sections/mtd/MonthClose';
import History from './sections/mtd/History';

const TABS = [['mtd', 'MTD'], ['wpr', 'WPR'], ['dist', 'Distribution']];
const weekdayDay = utcFormat('%a %-d');

export default function App() {
  const { status, error, raw, derived: d, meta, reload } = useData();
  const { p, set, reset, changed } = useParams();
  const sel = useSelection(raw, p);
  const [updateOpen, setUpdateOpen] = useState(false);

  if (status === 'loading') return <Shell><Title /><Skeleton /></Shell>;
  if (status === 'error') {
    return (
      <Shell>
        <Title />
        <div className="rounded-lg border border-line bg-panel p-4">
          <p className="m-0 text-body font-semibold text-bad">Couldn’t load the data</p>
          <Note className="mt-1">{error}</Note>
          <div className="mt-3"><Btn onClick={reload}>Try again</Btn></div>
        </div>
      </Shell>
    );
  }

  const ctx = { raw, d, sel, p, set, meta };
  const { page } = sel;
  const ds = d.data_status;
  const s = d.by.scope.get(sel.key);

  return (
    <Shell>
      <header id="top">
        <Title />
        <Note>
          {ds && 'Numbers up to ' + day(ds.latest_day) + ' · ' + (ds.missing_days.length
            ? 'Days with no numbers this month: ' + ds.missing_days.map((x) => weekdayDay(new Date(x))).join(', ')
            : 'No missing days this month')}
        </Note>
        {page === 'mtd' && (
          <p className="mt-1 mb-0 text-body leading-normal text-muted">
            {s && sel.scopeName + ' is at ' + pct(s.pct_green) + ' of the green target and '
              + (s.pct_purple == null ? 'purple was not captured' : pct(s.pct_purple) + ' of the purple target')
              + ' on ' + day(sel.date) + ', business day ' + s.business_day + ' of ' + s.business_days_in_month + '.'}
          </p>
        )}
      </header>

      <div role="tablist" aria-label="Page" className="flex gap-1 border-b border-line">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={page === id} onClick={() => set({ page: id })}
            className={'-mb-px cursor-pointer border-b-2 px-4 py-2 text-body font-semibold ' + (page === id ? 'border-fg text-fg' : 'border-transparent text-muted hover:text-fg')}>
            {label}
          </button>
        ))}
      </div>

      <Controls>
        {page !== 'dist' && <Select label="Month" value={sel.month} options={sel.months.map((m) => [m, monthLabel(m)])} onChange={(v) => set({ month: v, collector: 'All', date: null })} />}
        {page !== 'dist' && <Select label="Team" value={sel.team} options={[['All', 'All teams'], ...sel.teams.map((t) => [t, t])]} onChange={(v) => set({ team: v, collector: 'All' })} />}
        {page === 'mtd' && <Select label="Collector" value={sel.collector} options={[['All', 'All collectors'], ...sel.people.map((r) => [r.collector, r.collector + ' — ' + r.name])]} onChange={(v) => set({ collector: v })} />}
        {page === 'mtd' && <Select label="Snapshot date" value={sel.date} options={sel.dates.map((x) => [x, day(x)])} onChange={(v) => set({ date: v })} />}
        {page !== 'dist' && <Btn onClick={reset} disabled={!changed} title={changed ? 'Back to all teams, all collectors and the latest day' : 'Nothing to reset: showing all teams, all collectors and the latest day'}>Reset</Btn>}
        {meta.writable && <Btn onClick={() => setUpdateOpen((o) => !o)}>Update numbers</Btn>}
        {meta.writable && <UndoButton />}
      </Controls>

      {meta.writable && updateOpen && <UpdatePanel onClose={() => setUpdateOpen(false)} />}

      {page === 'mtd' && (
        <Note>Daily snapshots start in September. January to August are monthly totals:{' '}
          <a href="#history" onClick={(e) => { e.preventDefault(); document.getElementById('history')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
            see Monthly history at the bottom of the page</a>.
        </Note>
      )}

      {page === 'dist' && <Distribution {...ctx} />}
      {page === 'wpr' && <WeeklyReview {...ctx} />}
      {page === 'mtd' && (
        <>
          <Period {...ctx} />
          <WatchList {...ctx} />
          <Check80 {...ctx} />
          <Daily {...ctx} />
          <Trend {...ctx} />
          <Teams {...ctx} />
          <MonthOverMonth {...ctx} />
          <Rankings {...ctx} />
          <Collectors {...ctx} />
          <MonthClose {...ctx} />
          <History {...ctx} />
        </>
      )}
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="mx-auto max-w-319 px-4.5 pt-5.5 pb-15">
      <div className="flex flex-col gap-6.5">
        {children}
      </div>
    </div>
  );
}

const Title = () => <h1 className="m-0 font-serif text-title font-normal">RMS fee dashboard</h1>;

function Skeleton() {
  const bar = 'rounded bg-line animate-pulse';
  return (
    <div aria-busy="true" aria-label="Loading" className="flex flex-col gap-6.5">
      <div className="flex flex-col gap-2"><div className={bar + ' h-3.5 w-72'} /><div className={bar + ' h-4 w-md max-w-full'} /></div>
      <div className={bar + ' h-9 w-80'} />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))] gap-3.5">
        {[0, 1, 2, 3, 4].map((i) => <div key={i} className={bar + ' h-32'} />)}
      </div>
    </div>
  );
}
