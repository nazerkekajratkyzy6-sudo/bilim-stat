import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import katex from 'katex';
import { animate, AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, ChevronDown, Info, XCircle } from 'lucide-react';
import { useStore } from '../store';
import { FEATURE_LABEL, SCOPE_LABEL, type Feature, type Scope } from '../lib/model';
import { fmt } from '../lib/stats';

export const C = {
  ink: '#13305a',
  soft: '#4a6285',
  faint: '#7f93b0',
  grid: '#e2edf9',
  gridStrong: '#c9dcf2',
  sky: '#36a3f2',
  blue: '#1f5fd1',
  teal: '#0f9f91',
  violet: '#6d4fd8',
  amber: '#c47a06',
  rose: '#cf2f56',
};

/* ───── Формула (KaTeX) ───── */
export function Tex({ children, block = false, className = '' }: { children: string; block?: boolean; className?: string }) {
  const html = useMemo(
    () => katex.renderToString(children, { displayMode: block, throwOnError: false, strict: false }),
    [children, block],
  );
  return block ? (
    <div className={`overflow-x-auto py-1 ${className}`} dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <span className={className} dangerouslySetInnerHTML={{ __html: html }} />
  );
}

/** Санды KaTeX үшін форматтау (үтірлі ондық бөлшек). */
export const tx = (v: number | null | undefined, d = 2) => (v === null || v === undefined || !Number.isFinite(v) ? '—' : fmt(v, d).replace(',', '{,}').replace(/\s/g, '\\,'));
export const txs = (v: number, d = 2) => (v < 0 ? `(${tx(v, d)})` : tx(v, d));

/* ───── Анимациялық сан ───── */
export function AnimatedNumber({ value, digits = 2, suffix = '' }: { value: number | null | undefined; digits?: number; suffix?: string }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(value ?? 0);
  const prev = useRef(value ?? 0);
  useEffect(() => {
    if (value === null || value === undefined || !Number.isFinite(value)) return;
    if (reduce) {
      setShown(value);
      prev.current = value;
      return;
    }
    const c = animate(prev.current, value, { duration: 0.6, ease: 'easeOut', onUpdate: (v) => setShown(v) });
    prev.current = value;
    return () => c.stop();
  }, [value, reduce]);
  if (value === null || value === undefined || !Number.isFinite(value)) return <span className="num">—</span>;
  return <span className="num">{fmt(shown, digits)}{suffix}</span>;
}

/* ───── Бет тақырыбы ───── */
export function PageHeader({ step, title, lead, children }: { step?: number; title: string; lead?: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-3xl">
        {step !== undefined && (
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-ink-soft">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-blue text-xs font-semibold text-white num">{step}</span>
            Зерттеу кезеңі
          </div>
        )}
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">{title}</h1>
        {lead && <p className="mt-3 text-[1.05rem] leading-relaxed text-ink-soft">{lead}</p>}
      </div>
      {children}
    </header>
  );
}

/* ───── Хабарлама ───── */
export function Notice({ tone = 'info', title, children }: { tone?: 'info' | 'warn' | 'error'; title?: string; children: ReactNode }) {
  const map = {
    info: { cls: 'border-sky/40 bg-sky-wash text-ink', icon: <Info className="h-5 w-5 text-blue" /> },
    warn: { cls: 'border-amber/40 bg-amber-wash text-ink', icon: <AlertTriangle className="h-5 w-5 text-amber" /> },
    error: { cls: 'border-rose/40 bg-rose-wash text-ink', icon: <XCircle className="h-5 w-5 text-rose" /> },
  }[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'note'} className={`flex gap-3 rounded-xl border px-4 py-3 text-[0.95rem] leading-relaxed ${map.cls}`}>
      <div className="mt-0.5 shrink-0">{map.icon}</div>
      <div>
        {title && <div className="font-semibold">{title}</div>}
        <div className="text-ink-soft">{children}</div>
      </div>
    </div>
  );
}

/* ───── Ашылатын есептеу блогы ───── */
export function Reveal({ label = 'Есептеуді көрсету', children }: { label?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-blue hover:bg-blue-wash"
      >
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        {open ? 'Есептеуді жасыру' : label}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="mt-2 rounded-xl border border-grid-strong bg-paper px-4 py-3 text-ink">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ───── Сегменттелген таңдау ───── */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-xl border border-grid-strong bg-white p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${value === o.value ? 'bg-blue text-white' : 'text-ink-soft hover:bg-blue-wash'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ───── Талдау параметрлері: сынып және кіріс көрсеткіш ───── */
export function ScopeControls({ showFeature = true, allowAll = true }: { showFeature?: boolean; allowAll?: boolean }) {
  const { settings, setSettings } = useStore();
  const scopes: Scope[] = allowAll ? ['9', '10', '11', 'all'] : ['9', '10', '11'];
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <span className="font-medium">Сынып</span>
        <Segmented
          label="Сынып"
          value={settings.scope === 'all' && !allowAll ? '11' : settings.scope}
          onChange={(v) => setSettings({ scope: v })}
          options={scopes.map((s) => ({ value: s, label: s === 'all' ? 'Барлығы' : SCOPE_LABEL[s] }))}
        />
      </label>
      {showFeature && (
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <span className="font-medium">Кіріс көрсеткіш x</span>
          <select
            className="field text-ink"
            value={settings.feature}
            onChange={(e) => setSettings({ feature: e.target.value as Feature })}
          >
            {(Object.keys(FEATURE_LABEL) as Feature[]).map((f) => (
              <option key={f} value={f}>{FEATURE_LABEL[f]}</option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

/* ───── Көрсеткіш ───── */
export function Metric({ label, value, digits = 2, suffix = '', hint, accent = 'ink' }: { label: ReactNode; value: number | null | undefined; digits?: number; suffix?: string; hint?: ReactNode; accent?: 'ink' | 'blue' | 'teal' | 'violet' }) {
  const color = { ink: 'text-ink', blue: 'text-blue', teal: 'text-teal', violet: 'text-violet' }[accent];
  return (
    <div className="min-w-0">
      <div className="text-sm text-ink-soft">{label}</div>
      <div className={`mt-0.5 font-display text-2xl font-bold ${color}`}>
        <AnimatedNumber value={value} digits={digits} suffix={suffix} />
      </div>
      {hint && <div className="mt-0.5 text-xs leading-snug text-ink-faint">{hint}</div>}
    </div>
  );
}

export function SmallSampleNote({ n }: { n: number }) {
  if (n >= 30) return null;
  return (
    <Notice tone="warn" title={`Шағын таңдама: n = ${n}`}>
      Нәтижелер тек осы топқа қатысты. Аз деректер бойынша алынған заңдылықты барлық оқушыларға ортақ заң ретінде қабылдауға болмайды: бір оқушының нәтижесі коэффициенттерді айтарлықтай өзгерте алады.
    </Notice>
  );
}
