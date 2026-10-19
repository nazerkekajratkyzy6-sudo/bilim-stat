import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Maximize, Minimize, X } from 'lucide-react';
import { useStore } from '../store';
import {
  assessRisk, featureValue, FEATURE_PHRASE, leaveOneOut, METHOD_LABEL, METHOD_SHORT, predictWithout, RISK_LABEL,
  scopeModel, SCOPE_LABEL, type MethodId, type Scope,
} from '../lib/model';
import { describe, fmt, fmtSigned, isFail, toPercent, correlationTTest, correlationStrength, type PearsonResult, type Regression } from '../lib/stats';
import { buildReport, hypothesisText } from '../lib/report';
import { AnimatedNumber, C, Segmented, Tex, tx, txs } from '../components/ui';
import { ScatterPlot, PlotLegend } from '../components/ScatterPlot';
import { ErrorByStudent, GroupedBars, MethodBars, SpreadStrip } from '../components/charts';
import { eq } from './ModelPage';
import { LEVEL_STYLE } from './RiskPage';
import { BRAND_NAME, RESEARCH_TOPIC } from '../config';

const TITLES = [
  'Зерттеу мәселесі',
  'Зерттеу мақсаты және гипотезасы',
  'Нақты деректер',
  'Статистикалық талдау',
  'Авторлық математикалық модель',
  'Болжам жасау',
  'Модельді тексеру',
  'Нәтижелерді салыстыру',
  'Практикалық маңызы',
  'Қорытынды',
];

const METHODS: MethodId[] = ['mean', 'naive', 'regression'];

export default function DefensePage({ onExit }: { onExit: () => void }) {
  const { data, settings } = useStore();
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const [scope, setScope] = useState<Scope>(settings.scope);
  const [full, setFull] = useState(false);
  const feature = settings.feature;

  const go = useCallback((n: number) => {
    setI((cur) => {
      const nx = Math.max(0, Math.min(TITLES.length - 1, n));
      setDir(nx >= cur ? 1 : -1);
      return nx;
    });
  }, []);

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT')) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); go(i + 1); }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(i - 1); }
      if (e.key === 'Escape' && !document.fullscreenElement) onExit();
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [i, go, onExit]);

  useEffect(() => {
    const on = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  const toggleFull = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };

  const m = useMemo(() => scopeModel(data, scope, feature), [data, scope, feature]);
  const loo = useMemo(() => leaveOneOut(m.points), [m.points]);
  const report = useMemo(() => buildReport(data, feature, settings.varianceKind, settings.thresholds), [data, feature, settings.varianceKind, settings.thresholds]);
  const R = isFail(m.reg) ? null : (m.reg as Regression);
  const r = isFail(m.corr) ? null : (m.corr as PearsonResult).r;
  const needsScope = [2, 3, 4, 5, 6, 7, 8].includes(i);

  return (
    <div className="graph-paper flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-grid-strong bg-white/90 px-5 py-3 backdrop-blur sm:px-8">
        <div className="flex items-center gap-3">
          <span className="font-display text-lg font-extrabold text-ink">{BRAND_NAME}</span>
          <span className="hidden text-sm text-ink-faint sm:inline">Ғылыми қорғау</span>
        </div>
        <div className="flex items-center gap-2">
          {needsScope && <Segmented label="Сынып" value={scope} onChange={setScope} options={(['9', '10', '11', 'all'] as Scope[]).map((s) => ({ value: s, label: s === 'all' ? 'Барлығы' : `${s}-сынып` }))} />}
          <button onClick={toggleFull} aria-label={full ? 'Толық экраннан шығу' : 'Толық экран'} className="rounded-lg p-2 text-ink-soft hover:bg-blue-wash">{full ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}</button>
          <button onClick={onExit} aria-label="Қорғау режимінен шығу" className="rounded-lg p-2 text-ink-soft hover:bg-blue-wash"><X className="h-5 w-5" /></button>
        </div>
      </header>

      <main className="relative flex-1 overflow-hidden">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.section
            key={i}
            custom={dir}
            initial={{ opacity: 0, x: dir * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -40 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="mx-auto flex h-full max-w-[1400px] flex-col px-5 py-6 sm:px-10 lg:py-10"
          >
            <div className="mb-6 flex items-baseline gap-4">
              <span className="font-display text-5xl font-extrabold text-blue/25 num">{String(i + 1).padStart(2, '0')}</span>
              <h1 className="font-display text-3xl font-bold tracking-tight text-ink lg:text-5xl">{TITLES[i]}</h1>
            </div>
            <div className="flex-1">
              {i === 0 && <Slide1 />}
              {i === 1 && <Slide2 />}
              {i === 2 && <SlideData scope={scope} />}
              {i === 3 && <SlideStats scope={scope} />}
              {i === 4 && (R && r !== null ? (
                <div className="grid items-center gap-8 lg:grid-cols-[1.3fr_1fr]">
                  <div className="rounded-2xl border border-grid-strong bg-white p-3"><ScatterPlot points={m.points.map((p) => ({ id: p.id, label: scope === 'all' ? '' : p.code, x: p.x, y: p.y }))} line={R} labels={scope !== 'all'} height={440} xLabel={`x — ${FEATURE_PHRASE[feature]}, %`} /></div>
                  <div>
                    <div className="text-xl text-ink-soft">{SCOPE_LABEL[scope]}, n = {R.n}</div>
                    <div className="mt-3 text-[clamp(1.6rem,3vw,2.6rem)] text-ink"><Tex>{eq(R)}</Tex></div>
                    <div className="mt-8 grid grid-cols-2 gap-6">
                      <Big label="Корреляция, r" value={r} digits={3} color="text-violet" sub={`${correlationStrength(r)} байланыс`} />
                      <Big label="Детерминация, R²" value={R.r2} digits={3} color="text-violet" sub={R.r2 !== null ? `ТЖБ вариациясының ${fmt(R.r2 * 100, 0)}%-ы` : ''} />
                    </div>
                    {(() => { const t = correlationTTest(r, R.n); return t && <p className="mt-6 text-lg text-ink-soft"><Tex>{`t = ${tx(t.t, 2)} ${t.significant ? '>' : '\\le'} t_{\\text{кр}} = ${tx(t.tCrit, 3)}`}</Tex> — {t.significant ? 'байланыс маңызды (α = 0,05)' : 'маңыздылық расталмады'}</p>; })()}
                  </div>
                </div>
              ) : <Empty />)}
              {i === 5 && <SlidePredict scope={scope} />}
              {i === 6 && (loo.n >= 3 ? (
                <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
                  <div className="space-y-5 text-xl leading-relaxed text-ink-soft">
                    <p>Әр оқушы кезекпен шығарылып, модель қалған <b className="text-ink">{loo.n - 1}</b> оқушы бойынша қайта құрылды.</p>
                    <p>Шығарылған оқушының ТЖБ-сы оның өз болжамына қатыспайды.</p>
                    <div className="grid grid-cols-2 gap-6 pt-2">
                      <Big label="Регрессия MAE" value={loo.scores.regression.mae} digits={2} color="text-violet" sub="пайыздық тармақ" />
                      <Big label="Регрессия RMSE" value={loo.scores.regression.rmse} digits={2} color="text-violet" sub="пайыздық тармақ" />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-grid-strong bg-white p-4">
                    <ErrorByStudent data={loo.folds.map((f) => ({ label: scope === 'all' ? `${f.id.split('-')[0]}·${f.code}` : f.code, mean: f.preds.mean ? f.preds.mean.value - f.y : null, naive: f.preds.naive ? f.preds.naive.value - f.y : null, regression: f.preds.regression ? f.preds.regression.value - f.y : null }))} />
                  </div>
                </div>
              ) : <Empty />)}
              {i === 7 && (loo.n >= 3 ? (
                <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
                  <div className="rounded-2xl border border-grid-strong bg-white p-4"><MethodBars best={loo.best} data={METHODS.map((mm) => ({ id: mm, name: METHOD_SHORT[mm], ...loo.scores[mm] }))} /></div>
                  <div className="space-y-4">
                    {METHODS.map((mm) => (
                      <div key={mm} className={`rounded-xl border px-5 py-4 ${loo.best.includes(mm) ? 'border-violet bg-violet-wash' : 'border-grid-strong bg-white'}`}>
                        <div className="text-lg font-semibold text-ink">{METHOD_LABEL[mm]}</div>
                        <div className="mt-1 text-ink-soft num">MAE {fmt(loo.scores[mm].mae, 2)} · RMSE {fmt(loo.scores[mm].rmse, 2)} п.т.</div>
                      </div>
                    ))}
                    <p className="text-ink-faint">Ең дәл әдіс алдын ала белгіленбейді — тек есептелген қате бойынша.</p>
                  </div>
                </div>
              ) : <Empty />)}
              {i === 8 && <SlidePractice scope={scope} />}
              {i === 9 && (
                <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
                  <ul className="space-y-4 text-lg leading-relaxed text-ink-soft">
                    {[...report.classes, report.all].filter((c) => c.nModel >= 3).map((c) => <li key={c.scope} className="rounded-xl border border-grid-strong bg-white px-5 py-4">{hypothesisText(c)}</li>)}
                  </ul>
                  <div className="rounded-2xl border border-violet/25 bg-violet-wash p-6 text-xl leading-relaxed text-ink">
                    Мен деректерді зерттедім → математикалық заңдылықтарды анықтадым → болжам моделін құрдым → оны нақты нәтижелермен тексердім → практикалық қолдану жолдарын ұсындым.
                    <p className="mt-4 text-base text-ink-soft">Шектеу: таңдамалар шағын, сондықтан қорытындылар тек осы деректерге қатысты.</p>
                  </div>
                </div>
              )}
            </div>
          </motion.section>
        </AnimatePresence>
      </main>

      <footer className="flex items-center justify-between gap-4 border-t border-grid-strong bg-white/90 px-5 py-3 sm:px-8">
        <button onClick={() => go(i - 1)} disabled={i === 0} className="inline-flex items-center gap-1 rounded-xl px-3 py-2 font-medium text-ink hover:bg-blue-wash disabled:opacity-30"><ChevronLeft className="h-5 w-5" /> Артқа</button>
        <div className="flex flex-wrap justify-center gap-1.5">
          {TITLES.map((t, k) => (
            <button key={t} onClick={() => go(k)} aria-label={`${k + 1}. ${t}`} aria-current={k === i ? 'step' : undefined} className={`h-2.5 rounded-full transition-all ${k === i ? 'w-8 bg-blue' : 'w-2.5 bg-grid-strong hover:bg-sky'}`} />
          ))}
        </div>
        <button onClick={() => go(i + 1)} disabled={i === TITLES.length - 1} className="inline-flex items-center gap-1 rounded-xl bg-blue px-4 py-2 font-semibold text-white hover:brightness-110 disabled:opacity-30">Келесі <ChevronRight className="h-5 w-5" /></button>
      </footer>
    </div>
  );
}

function Big({ label, value, digits = 1, suffix = '', color = 'text-ink', sub }: { label: string; value: number | null | undefined; digits?: number; suffix?: string; color?: string; sub?: string }) {
  return (
    <div>
      <div className="text-base text-ink-soft">{label}</div>
      <div className={`font-display text-[clamp(2.2rem,4vw,3.6rem)] font-extrabold leading-tight ${color}`}><AnimatedNumber value={value} digits={digits} suffix={suffix} /></div>
      {sub && <div className="text-sm text-ink-faint">{sub}</div>}
    </div>
  );
}

function Empty() {
  return <p className="text-xl text-ink-soft">Бұл сынып үшін модельге жарамды деректер жеткіліксіз. Басқа сыныпты таңдаңыз.</p>;
}

function Slide1() {
  const { data } = useStore();
  const n = data.records.length;
  const works = data.records.reduce((s, r) => s + data.classes[r.classId].bjbCount + 1, 0);
  return (
    <div className="grid items-center gap-10 lg:grid-cols-[1.3fr_1fr]">
      <div>
        <p className="font-display text-[clamp(1.8rem,3.4vw,3rem)] font-bold leading-tight text-ink">БЖБ нәтижелері бойынша ТЖБ нәтижесін алдын ала болжауға бола ма?</p>
        <p className="mt-6 max-w-2xl text-xl leading-relaxed text-ink-soft">Мұғалім тоқсан бойы БЖБ баллдарын жинайды, бірақ олар әдетте тек журналда қалады. Егер БЖБ мен ТЖБ арасында математикалық заңдылық болса, қолдау қажет оқушыларды ТЖБ-ға дейін анықтауға болады.</p>
        <p className="mt-6 text-base text-ink-faint">{RESEARCH_TOPIC}</p>
      </div>
      <div className="grid grid-cols-2 gap-6 rounded-2xl border border-grid-strong bg-white p-8">
        <Big label="Оқушы" value={n} digits={0} color="text-blue" />
        <Big label="Сынып" value={3} digits={0} color="text-blue" />
        <Big label="Жиынтық жұмыс" value={works} digits={0} color="text-teal" />
        <Big label="Математикалық әдіс" value={4} digits={0} color="text-violet" sub="статистика, корреляция, регрессия, LOO" />
      </div>
    </div>
  );
}

function Slide2() {
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="rounded-2xl border border-grid-strong bg-white p-8">
        <div className="text-lg font-semibold text-blue">Мақсат</div>
        <p className="mt-3 text-2xl leading-relaxed text-ink">БЖБ мен ТЖБ арасындағы байланысты статистикалық әдістермен зерттеп, ТЖБ нәтижесін болжайтын модель құру және оның дәлдігін тексеру.</p>
      </div>
      <div className="rounded-2xl border border-violet/30 bg-violet-wash p-8">
        <div className="text-lg font-semibold text-violet">Гипотеза</div>
        <p className="mt-3 text-2xl leading-relaxed text-ink">БЖБ нәтижелері мен ТЖБ нәтижесі арасында оң сызықтық байланыс бар, сондықтан БЖБ негізіндегі модель ТЖБ-ны сыныптың орташа нәтижесіне қарағанда дәлірек болжайды.</p>
      </div>
      <div className="text-xl text-ink-soft lg:col-span-2">
        <Tex>{'\\text{Деректер} \\;\\to\\; \\bar x,\\ \\sigma^2,\\ V \\;\\to\\; r \\;\\to\\; \\hat y = ax + b \\;\\to\\; \\text{MAE},\\ \\text{RMSE}'}</Tex>
      </div>
    </div>
  );
}

function SlideData({ scope }: { scope: Scope }) {
  const { data, settings } = useStore();
  const { rows } = scopeModel(data, scope, settings.feature);
  const maxB = scope === 'all' ? 2 : data.classes[scope].bjbCount;
  const blues = [C.sky, C.blue, '#173f8f'];
  return (
    <div className="rounded-2xl border border-grid-strong bg-white p-5">
      <div className="mb-2 text-lg text-ink-soft">{SCOPE_LABEL[scope]}: нәтижелер пайызбен (әр жұмыстың ең жоғары баллы ескерілген)</div>
      <GroupedBars yMax={100} unit="Нәтиже, %"
        data={rows.map((r) => ({ label: scope === 'all' ? `${r.rec.classId}·${r.rec.code}` : r.rec.code, ...Object.fromEntries(r.bjbPct.slice(0, maxB).map((p, k) => [`b${k}`, p])), tjb: r.tjbPct }))}
        series={[...Array.from({ length: maxB }, (_, k) => ({ key: `b${k}`, name: `БЖБ ${k + 1}`, color: blues[k] })), { key: 'tjb', name: 'ТЖБ', color: C.teal }]} />
      {rows.some((r) => r.x === null) && <p className="mt-2 text-amber">Кейбір жұмыстардың ең жоғары баллы расталмаған — олар пайызбен көрсетілмейді.</p>}
    </div>
  );
}

function SlideStats({ scope }: { scope: Scope }) {
  const { data, settings } = useStore();
  const { points } = scopeModel(data, scope, settings.feature);
  const vk = settings.varianceKind;
  const y = describe(points.map((p) => p.y), vk);
  const x = describe(points.map((p) => p.x), vk);
  if (!points.length) return <Empty />;
  const s = vk === 'sample' ? 's' : 'σ';
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        <Big label="ТЖБ орташасы, ȳ" value={y.mean} suffix="%" color="text-teal" />
        <Big label={`ТЖБ стандартты ауытқуы, ${s}`} value={y.sd} color="text-violet" sub="пайыздық тармақ" />
        <Big label="ТЖБ вариация коэффициенті" value={y.cv} suffix="%" color="text-ink" />
        <Big label="БЖБ орташасы, x̄" value={x.mean} suffix="%" color="text-blue" />
      </div>
      <div className="rounded-2xl border border-grid-strong bg-white p-5">
        <div className="mb-1 text-ink-soft">ТЖБ нәтижелерінің орташадан шашырауы: қою жолақ — ±{s}, ашық — ±2{s}</div>
        <SpreadStrip values={points.map((p) => ({ label: p.code, v: p.y }))} mean={y.mean} sd={y.sd} unit="%" domain={[Math.min(40, Math.floor((y.min ?? 40) / 10) * 10), 100]} color={C.teal} />
      </div>
    </div>
  );
}

function SlidePredict({ scope }: { scope: Scope }) {
  const { data, settings } = useStore();
  const { rows, points, reg } = scopeModel(data, scope, settings.feature);
  const usable = rows.filter((r) => r.x !== null && r.y !== null);
  const [selId, setSelId] = useState('');
  const sel = usable.find((r) => r.rec.id === selId) ?? usable[usable.length - 1];
  const [slot, setSlot] = useState(0);
  const [score, setScore] = useState<number | null>(null);
  useEffect(() => setScore(null), [selId, slot, scope]);
  if (!sel || isFail(reg)) return <Empty />;
  const s = Math.min(slot, sel.bjbPct.length - 1);
  const sc = sel.rec.bjb[s];
  const cur = score ?? sc.score ?? 0;
  const pct = sel.bjbPct.map((p, k) => (k === s ? toPercent(cur, sc.max) : p));
  const x = featureValue(pct, settings.feature)!;
  const res = predictWithout(points, sel.rec.id, x);
  const base = predictWithout(points, sel.rec.id, sel.x!);
  const M = isFail(res.model) ? null : (res.model as Regression);
  const label = (r: (typeof rows)[number]) => (scope === 'all' ? `${r.rec.classId}·${r.rec.code}` : r.rec.code);
  return (
    <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
      <div className="rounded-2xl border border-grid-strong bg-white p-3">
        <ScatterPlot
          points={points.map((p) => ({ id: p.id, label: scope === 'all' ? '' : p.code, x: p.id === sel.rec.id ? x : p.x, y: p.y, highlight: p.id === sel.rec.id }))}
          line={M}
          prediction={res.prediction ? { x, y: res.prediction.value } : null}
          labels={scope !== 'all'}
          height={440}
          xLabel={`x — ${FEATURE_PHRASE[settings.feature]}, %`}
        />
        <div className="px-2"><PlotLegend items={[{ kind: 'point', label: 'нақты нәтиже' }, { kind: 'line', label: `${label(sel)} оқушысыз құрылған түзу` }, { kind: 'diamond', label: 'болжам' }]} /></div>
      </div>
      <div className="space-y-5">
        <label className="block text-lg text-ink-soft">Оқушы
          <select className="field ml-3 text-lg text-ink" value={sel.rec.id} onChange={(e) => setSelId(e.target.value)}>
            {usable.map((r) => <option key={r.rec.id} value={r.rec.id}>{label(r)}</option>)}
          </select>
        </label>
        {sel.bjbPct.length > 1 && <Segmented label="БЖБ" value={String(s)} onChange={(v) => setSlot(Number(v))} options={sel.bjbPct.map((_, k) => ({ value: String(k), label: `БЖБ ${k + 1}` }))} />}
        <div>
          <div className="text-lg text-ink-soft">БЖБ {s + 1}: <b className="text-ink num">{cur}</b> / {sc.max} балл {score !== null && score !== sc.score && <span className="text-ink-faint">(нақты {sc.score})</span>}</div>
          <input type="range" min={0} max={sc.max ?? 0} value={cur} onChange={(e) => setScore(Number(e.target.value))} className="mt-2 w-full" aria-label="БЖБ баллын өзгерту" />
        </div>
        {M && res.prediction && (
          <>
            <div className="text-xl"><Tex>{`\\hat y = ${txs(M.a, 3)}\\cdot ${tx(x, 1)} ${M.b < 0 ? '-' : '+'} ${tx(Math.abs(M.b), 2)} = ${tx(res.prediction.raw, 1)}\\%`}</Tex></div>
            <div className="grid grid-cols-2 gap-6">
              <Big label="ТЖБ болжамы" value={res.prediction.value} suffix="%" color="text-violet" sub={base.prediction && Math.abs(base.prediction.value - res.prediction.value) > 0.05 ? `бастапқы болжамнан ${fmtSigned(res.prediction.value - base.prediction.value, 1)} п.т.` : 'нақты БЖБ бойынша'} />
              <Big label="Нақты ТЖБ" value={sel.y} suffix="%" color="text-teal" />
            </div>
            {res.prediction.clipped && <p className="text-amber">Бастапқы мән {fmt(res.prediction.raw, 1)}% — 0–100%-ға шектелді.</p>}
          </>
        )}
      </div>
    </div>
  );
}

function SlidePractice({ scope }: { scope: Scope }) {
  const { data, settings } = useStore();
  const { rows, points } = scopeModel(data, scope, settings.feature);
  const risks = rows.map((r) => assessRisk(r, points, settings.thresholds));
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
      <div className="space-y-4">
        {(['stable', 'attention', 'support'] as const).map((l) => (
          <div key={l} className={`flex items-center gap-5 rounded-2xl border px-6 py-4 ${LEVEL_STYLE[l]}`}>
            <span className="font-display text-5xl font-extrabold num">{risks.filter((r) => r.level === l).length}</span>
            <span className="text-xl font-semibold">{RISK_LABEL[l]}</span>
          </div>
        ))}
        <p className="text-ink-faint">Шектер: болжам &lt; {settings.thresholds.lowPrediction}%, төмендеу &gt; {settings.thresholds.drop} п.т., σ &gt; {settings.thresholds.instability} п.т. — зерттеу үшін таңдалған, ресми норматив емес.</p>
      </div>
      <ul className="space-y-4 text-xl leading-relaxed text-ink-soft">
        <li className="rounded-xl border border-grid-strong bg-white px-5 py-4">Мұғалім ТЖБ-ға дейін қолдау қажет оқушыларды математикалық негізбен көреді.</li>
        <li className="rounded-xl border border-grid-strong bg-white px-5 py-4">Модельден күрт ауытқыған нәтижелер бағалауды қайта тексеруге себеп болады.</li>
        <li className="rounded-xl border border-grid-strong bg-white px-5 py-4">«Егер қолдау көрсетілсе» сценарийі мақсат қоюға көмектеседі — бірақ ол дәлел емес, математикалық болжам.</li>
      </ul>
    </div>
  );
}
