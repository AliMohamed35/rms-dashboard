// Small building blocks shared by every section.
import { GREEN, PURPLE } from '../lib/format';

const cx = (...c) => c.filter(Boolean).join(' ');

export const Section = ({ id, className, children }) => <section id={id} className={cx('flex flex-col gap-3.5 scroll-mt-4', className)}>{children}</section>;
export const H2 = ({ children, className }) => <h2 className={cx('m-0 text-heading font-semibold', className)}>{children}</h2>;
export const Row = ({ children, className }) => <div className={cx('flex flex-wrap items-center justify-between gap-2', className)}>{children}</div>;
export const Controls = ({ children, className }) => <div className={cx('flex flex-wrap items-end gap-2', className)}>{children}</div>;
export const Card = ({ id, children, className }) => <div id={id} className={cx('flex min-w-0 flex-col gap-1 rounded-lg border border-line bg-panel p-4', className)}>{children}</div>;
export const CardTitle = ({ children, className }) => <p className={cx('m-0 text-body font-semibold', className)}>{children}</p>;
export const Note = ({ children, className }) => <p className={cx('m-0 text-caption leading-[1.45] text-muted [&_a]:text-inherit [&_a]:underline', className)}>{children}</p>;
export const Big = ({ children, className }) => <div className={cx('font-serif text-title leading-[1.15] font-normal tabular-nums', className)}>{children}</div>;
export const Line = ({ children, className, hidden }) => (hidden ? null : <div className={cx('text-caption text-muted tabular-nums', className)}>{children}</div>);
export const Grid = ({ children, wide }) => (
  <div className={cx('grid gap-3.5', wide ? 'grid-cols-[repeat(auto-fit,minmax(min(100%,22rem),1fr))]' : 'grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))]')}>{children}</div>
);
export const TableBox = ({ children, id }) => <div id={id} className="max-h-[28rem] overflow-auto">{children}</div>;

export const Dot = ({ color }) => <span className="rms-dot" style={{ background: color }} />;
export const GreenDot = () => <Dot color={GREEN} />;
export const PurpleDot = () => <Dot color={PURPLE} />;

/** Value with an optional tone class (text-ok / text-bad). */
export const V = ({ children, tone, as: Tag = 'span' }) => <Tag className={tone || undefined}>{children}</Tag>;

const btnBase = 'cursor-pointer rounded-lg border border-line bg-panel px-2 py-1 text-body text-fg disabled:cursor-not-allowed disabled:opacity-60';
export function Btn({ pressed, primary, className, ...rest }) {
  return (
    <button type="button" aria-pressed={pressed == null ? undefined : String(pressed)}
      className={cx(btnBase, pressed && 'bg-fg! text-bg!', primary && 'border-brand! bg-brand! text-white!', className)} {...rest} />
  );
}

/** Segmented button group. options: [[value, label], ...] */
export function Seg({ label, options, value, onChange }) {
  return (
    <div role="group" aria-label={label} className="inline-flex [&>button]:rounded-none [&>button:first-child]:rounded-l-lg [&>button:last-child]:rounded-r-lg">
      {options.map(([v, l]) => <Btn key={v} pressed={v === value} onClick={() => onChange(v)}>{l}</Btn>)}
    </div>
  );
}

const selectCls = 'min-w-28 rounded-lg border border-line bg-panel px-2 py-1 text-body text-fg';
/** Labelled select. options: [[value, label], ...] */
export function Select({ label, options, value, onChange, className, inline }) {
  const select = (
    <select aria-label={label} className={selectCls} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
  if (inline) return <label className={cx('text-caption leading-[1.45] text-muted', className)}>{label} {select}</label>;
  return <label className={cx('flex flex-col gap-0.5 text-caption text-muted', className)}>{label}{select}</label>;
}

/** Simple key/value list (rankings, upload summaries). */
export function List({ items, empty }) {
  return (
    <ul className="m-0 list-none p-0 text-caption tabular-nums">
      {items.length ? items.map((it, i) => (
        <li key={it.key ?? i} className="flex justify-between gap-2 border-b border-line py-[3px]">
          <span>{it.left}</span>{it.right != null && <span className={it.tone || undefined}>{it.right}</span>}
        </li>
      )) : empty != null && <li className="flex justify-between gap-2 border-b border-line py-[3px]"><span>{empty}</span><span /></li>}
    </ul>
  );
}

/** Status line under an editor form; red when something went wrong. */
export const Status = ({ msg }) => (msg ? <Note className={msg.bad ? 'text-bad!' : undefined}>{msg.text}</Note> : <Note />);

export const fileInputCls = 'text-body text-fg file:mr-2 file:cursor-pointer file:rounded-lg file:border-0 file:bg-brand file:px-4 file:py-1 file:font-semibold file:text-white hover:file:bg-brand-hover';
export const editorInputCls = 'rounded-lg border border-line bg-bg px-1.5 py-[3px] text-body text-fg';
