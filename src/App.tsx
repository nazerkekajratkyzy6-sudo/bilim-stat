import { lazy, Suspense, useState } from 'react';
import { Menu, Presentation, X } from 'lucide-react';
import { useRoute, type Route } from './store';
import { BRAND_NAME, SUBTITLE } from './config';
import Home from './pages/Home';
import DataPage from './pages/DataPage';
import StatsPage from './pages/StatsPage';
import ModelPage from './pages/ModelPage';
import ComparePage from './pages/ComparePage';
import StabilityPage from './pages/StabilityPage';
import RiskPage from './pages/RiskPage';
import OptimizePage from './pages/OptimizePage';
import ReportPage from './pages/ReportPage';

const DefensePage = lazy(() => import('./pages/DefensePage'));

export const STEPS: { route: Route; title: string; short: string }[] = [
  { route: 'data', title: 'Нақты деректер', short: 'Деректер' },
  { route: 'stats', title: 'Статистикалық талдау', short: 'Талдау' },
  { route: 'model', title: 'Болжам моделі', short: 'Модель' },
  { route: 'compare', title: 'Үш әдісті салыстыру', short: 'Салыстыру' },
  { route: 'stability', title: 'Модель тұрақтылығы', short: 'Тұрақтылық' },
  { route: 'risk', title: 'Оқу тәуекелін бағалау', short: 'Тәуекел' },
  { route: 'optimize', title: 'Білім сапасын оңтайландыру', short: 'Оңтайландыру' },
  { route: 'report', title: 'Зерттеу қорытындысы', short: 'Қорытынды' },
];

function Logo() {
  return (
    <svg width="34" height="34" viewBox="0 0 64 64" aria-hidden>
      <rect width="64" height="64" rx="16" fill="#1f5fd1" />
      <path d="M12 48 L52 18" stroke="#b9a8f5" strokeWidth="4" strokeLinecap="round" />
      <circle cx="16" cy="42" r="4.5" fill="#5eead4" />
      <circle cx="27" cy="38" r="4.5" fill="#5eead4" />
      <circle cx="36" cy="27" r="4.5" fill="#5eead4" />
      <circle cx="48" cy="24" r="4.5" fill="#5eead4" />
    </svg>
  );
}

export default function App() {
  const [route, go] = useRoute();
  const [open, setOpen] = useState(false);

  if (route === 'defense') {
    return (
      <Suspense fallback={<div className="grid h-screen place-items-center text-ink-soft">Жүктелуде…</div>}>
        <DefensePage onExit={() => go('home')} />
      </Suspense>
    );
  }

  const nav = (
    <nav aria-label="Зерттеу кезеңдері" className="flex flex-col gap-0.5">
      {STEPS.map((s, i) => {
        const active = route === s.route;
        return (
          <a
            key={s.route}
            href={`#/${s.route}`}
            onClick={() => setOpen(false)}
            aria-current={active ? 'page' : undefined}
            className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.95rem] transition-colors ${active ? 'bg-blue-wash font-semibold text-blue' : 'text-ink-soft hover:bg-paper hover:text-ink'}`}
          >
            <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs num ${active ? 'border-blue bg-blue text-white' : 'border-grid-strong bg-white text-ink-soft'}`}>{i + 1}</span>
            {s.title}
          </a>
        );
      })}
    </nav>
  );

  const defenseLink = (
    <a
      href="#/defense"
      className="flex items-center justify-center gap-2 rounded-xl bg-violet px-4 py-3 text-sm font-semibold text-white shadow-[0_6px_20px_-8px_rgba(109,79,216,0.7)] hover:brightness-110"
    >
      <Presentation className="h-4 w-4" />
      Ғылыми қорғау режимі
    </a>
  );

  const pages: Record<Exclude<Route, 'defense'>, JSX.Element> = {
    home: <Home go={go} />,
    data: <DataPage />,
    stats: <StatsPage />,
    model: <ModelPage />,
    compare: <ComparePage />,
    stability: <StabilityPage />,
    risk: <RiskPage />,
    optimize: <OptimizePage />,
    report: <ReportPage />,
  };

  const idx = STEPS.findIndex((s) => s.route === route);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[280px_1fr]">
      {/* Бүйір панелі */}
      <aside className="no-print sticky top-0 hidden h-screen flex-col gap-6 border-r border-grid-strong bg-white px-4 py-6 lg:flex">
        <a href="#/" className="flex items-center gap-3 px-2">
          <Logo />
          <div>
            <div className="font-display text-lg font-extrabold tracking-tight text-ink">{BRAND_NAME}</div>
            <div className="text-xs leading-tight text-ink-faint">{SUBTITLE}</div>
          </div>
        </a>
        <div className="flex-1 overflow-y-auto">{nav}</div>
        {defenseLink}
      </aside>

      {/* Мобильді жоғарғы жолақ */}
      <div className="no-print sticky top-0 z-30 flex items-center justify-between border-b border-grid-strong bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <a href="#/" className="flex items-center gap-2">
          <Logo />
          <span className="font-display font-extrabold text-ink">{BRAND_NAME}</span>
        </a>
        <button type="button" onClick={() => setOpen(true)} aria-label="Мәзірді ашу" className="rounded-lg p-2 text-ink hover:bg-blue-wash">
          <Menu className="h-6 w-6" />
        </button>
      </div>
      {open && (
        <div className="no-print fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-0 flex h-full w-[86%] max-w-sm flex-col gap-4 bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="font-display font-bold">Зерттеу кезеңдері</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Жабу" className="rounded-lg p-2 hover:bg-blue-wash"><X className="h-5 w-5" /></button>
            </div>
            <a href="#/" onClick={() => setOpen(false)} className="rounded-xl px-3 py-2.5 text-ink-soft hover:bg-paper">Басты бет</a>
            <div className="flex-1 overflow-y-auto">{nav}</div>
            {defenseLink}
          </div>
        </div>
      )}

      <main className="print-full mx-auto w-full max-w-[1180px] px-4 pb-24 pt-8 sm:px-8 lg:pt-12">
        {pages[route as Exclude<Route, 'defense'>]}
        {idx >= 0 && (
          <div className="no-print mt-14 flex flex-wrap justify-between gap-3 border-t border-grid-strong pt-6">
            {idx > 0 ? (
              <a href={`#/${STEPS[idx - 1].route}`} className="rounded-xl px-4 py-2.5 text-sm font-medium text-ink-soft hover:bg-blue-wash">
                ← {STEPS[idx - 1].title}
              </a>
            ) : <span />}
            {idx < STEPS.length - 1 && (
              <a href={`#/${STEPS[idx + 1].route}`} className="rounded-xl bg-blue px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110">
                Келесі кезең: {STEPS[idx + 1].title}
              </a>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
