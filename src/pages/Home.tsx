import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Play, RotateCcw } from 'lucide-react';
import { useStore, type Route } from '../store';
import { scopeModel, type Scope } from '../lib/model';
import { isFail, predict, fmt, type Regression, type PearsonResult } from '../lib/stats';
import { ScatterPlot, PlotLegend } from '../components/ScatterPlot';
import { Segmented, Tex, tx, txs } from '../components/ui';
import { BRAND_NAME, RESEARCH_TOPIC, SUBTITLE } from '../config';

const FLOW: { label: string; route: Route; note: string }[] = [
  { label: 'Нақты деректер', route: 'data', note: 'БЖБ және ТЖБ баллдары, кодпен' },
  { label: 'Статистикалық талдау', route: 'stats', note: 'орташа, дисперсия, σ, V' },
  { label: 'Математикалық модель', route: 'model', note: 'ŷ = ax + b, r, R²' },
  { label: 'Болжам', route: 'model', note: 'модель оқушысыз құрылады' },
  { label: 'Дәлдігін тексеру', route: 'compare', note: 'Leave-One-Out, MAE, RMSE' },
  { label: 'Практикалық ұсыныстар', route: 'optimize', note: 'тәуекел сигналдары, сценарий' },
];

export default function Home({ go }: { go: (r: Route) => void }) {
  const { data } = useStore();
  const [scope, setScope] = useState<Scope>('11');
  const { points, reg, corr } = useMemo(() => scopeModel(data, scope, 'mean'), [data, scope]);
  const regOk = !isFail(reg);
  const r = reg as Regression;

  // Демонстрация кезеңдері: 0 — бос, 1 — нүктелер, 2 — түзу, 3 — болжам
  const [stage, setStage] = useState(0);
  const [run, setRun] = useState(0);
  useEffect(() => {
    setStage(0);
    const t = [setTimeout(() => setStage(1), 250), setTimeout(() => setStage(2), 1500), setTimeout(() => setStage(3), 2800)];
    return () => t.forEach(clearTimeout);
  }, [run, scope]);

  const demoX = points.length ? Math.round(points.reduce((s, p) => s + p.x, 0) / points.length - 8) : 70;
  const pred = regOk ? predict(r, demoX) : null;

  return (
    <div>
      <section className="grid items-start gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="pt-2">
          <h1 className="font-display text-[clamp(2.6rem,6vw,4.4rem)] font-extrabold leading-[0.95] tracking-tight text-ink">
            {BRAND_NAME}
          </h1>
          <p className="mt-4 font-display text-xl font-semibold text-blue">{SUBTITLE}</p>
          <p className="mt-6 max-w-xl font-display text-2xl font-semibold leading-snug text-ink">
            Бағалаудан — талдауға.<br />Талдаудан — болжамға.
          </p>
          <p className="mt-4 max-w-xl text-[1.05rem] leading-relaxed text-ink-soft">
            БЖБ және ТЖБ нәтижелерін математикалық статистика әдістерімен зерттеп, оқу нәтижелерін болжауға арналған интерактивті зертхана.
          </p>
          <div className="mt-8 grid max-w-xl grid-cols-2 gap-3">
            <button onClick={() => go('stats')} className="rounded-xl bg-blue px-4 py-3.5 text-left font-semibold text-white hover:brightness-110">Зерттеуді бастау</button>
            <button onClick={() => go('data')} className="rounded-xl border border-grid-strong bg-white px-4 py-3.5 text-left font-semibold text-ink hover:border-sky">Деректерді қарау</button>
            <button onClick={() => go('model')} className="rounded-xl border border-violet/30 bg-violet-wash px-4 py-3.5 text-left font-semibold text-violet hover:border-violet">Болжам жасау</button>
            <button onClick={() => go('compare')} className="rounded-xl border border-teal/30 bg-teal-wash px-4 py-3.5 text-left font-semibold text-teal hover:border-teal">Модельді тексеру</button>
          </div>
        </div>

        {/* Тірі демонстрация: нақты есептеулер */}
        <div className="panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-grid-strong px-5 py-3">
            <div className="text-sm font-semibold text-ink">Баллдан болжамға дейін — нақты деректермен</div>
            <div className="flex items-center gap-2">
              <Segmented label="Сынып" value={scope} onChange={setScope} options={[{ value: '10', label: '10' }, { value: '11', label: '11' }, { value: 'all', label: 'Барлығы' }]} />
              <button onClick={() => setRun((k) => k + 1)} aria-label="Демонстрацияны қайталау" className="rounded-lg p-2 text-ink-soft hover:bg-blue-wash">
                {stage === 3 ? <RotateCcw className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="px-2 pt-2">
            <ScatterPlot
              key={`${scope}-${run}`}
              points={stage >= 1 ? points.map((p) => ({ id: p.id, label: scope === 'all' ? `${p.classId}·${p.code}` : p.code, x: p.x, y: p.y })) : []}
              line={stage >= 2 && regOk ? r : null}
              prediction={stage >= 3 && pred !== null ? { x: demoX, y: Math.max(0, Math.min(100, pred)) } : null}
              labels={scope !== 'all'}
              height={380}
              xLabel="x — БЖБ орташа пайызы, %"
            />
            <div className="px-3 pb-3"><PlotLegend items={[{ kind: 'point', label: 'нақты нәтиже' }, { kind: 'line', label: 'регрессия түзуі' }, { kind: 'diamond', label: 'болжам' }, { kind: 'ref', label: 'ŷ = x' }]} /></div>
          </div>
          <div className="grid gap-4 border-t border-grid-strong bg-paper px-5 py-4 sm:grid-cols-3">
            <Stage active={stage >= 1} title="1. Деректер">
              n = <b className="num">{points.length}</b> оқушы, баллдар пайызға айналды
            </Stage>
            <Stage active={stage >= 2} title="2. Модель">
              {regOk ? <Tex>{`\\hat y = ${tx(r.a, 3)}x ${r.b < 0 ? '-' : '+'} ${tx(Math.abs(r.b), 2)}`}</Tex> : 'модель құрылмады'}
              {!isFail(corr) && <div className="mt-1 text-ink-faint">r = {fmt((corr as PearsonResult).r, 3)}</div>}
            </Stage>
            <Stage active={stage >= 3} title="3. Болжам">
              {pred !== null ? <Tex>{`x = ${demoX}\\% \\Rightarrow \\hat y = ${txs(pred, 1)}\\%`}</Tex> : '—'}
            </Stage>
          </div>
        </div>
      </section>

      {/* Зерттеу процесінің сызбасы */}
      <section className="mt-16">
        <h2 className="font-display text-2xl font-bold text-ink">Зерттеу жолы</h2>
        <p className="mt-2 max-w-2xl text-ink-soft">Әр кезеңді басып, сол бөлімге өтіңіз. Кезеңдер бір-біріне тәуелді: деректер өзгерсе, барлық есептеулер қайта жасалады.</p>
        <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {FLOW.map((f, i) => (
            <motion.li key={f.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.06 }}>
              <button
                onClick={() => go(f.route)}
                className="group relative flex h-full w-full flex-col rounded-xl border border-grid-strong bg-white p-4 text-left transition-colors hover:border-blue hover:bg-blue-wash"
              >
                <span className="font-display text-3xl font-extrabold text-grid-strong group-hover:text-blue num">{i + 1}</span>
                <span className="mt-2 font-semibold text-ink">{f.label}</span>
                <span className="mt-1 text-sm text-ink-faint">{f.note}</span>
                {i < FLOW.length - 1 && <span aria-hidden className="absolute -right-2.5 top-1/2 z-10 hidden -translate-y-1/2 text-grid-strong xl:block">▸</span>}
              </button>
            </motion.li>
          ))}
        </ol>
      </section>

      <section className="mt-16 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="panel p-6">
          <h2 className="font-display text-lg font-bold text-ink">Ғылыми жұмыстың тақырыбы</h2>
          <p className="mt-2 leading-relaxed text-ink-soft">«{RESEARCH_TOPIC}»</p>
        </div>
        <div className="rounded-[14px] border border-violet/25 bg-violet-wash p-6">
          <h2 className="font-display text-lg font-bold text-violet">Болжам қалай жасалады</h2>
          <p className="mt-2 leading-relaxed text-ink-soft">
            Болжамды нейрондық желі емес, математикалық статистика жасайды: ең кіші квадраттар әдісімен құрылған сызықтық регрессия. Барлық коэффициенттер енгізілген деректерден есептеледі және әр формуланы ашып тексеруге болады.
          </p>
        </div>
      </section>
    </div>
  );
}

function Stage({ active, title, children }: { active: boolean; title: string; children: React.ReactNode }) {
  return (
    <div className={`text-sm transition-opacity duration-500 ${active ? 'opacity-100' : 'opacity-35'}`}>
      <div className="font-semibold text-ink">{title}</div>
      <div className="mt-1 text-ink-soft">{children}</div>
    </div>
  );
}
