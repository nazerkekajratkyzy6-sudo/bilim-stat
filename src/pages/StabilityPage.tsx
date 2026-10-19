import { useEffect, useMemo, useState } from 'react';
import { FlaskConical, RotateCcw } from 'lucide-react';
import { useStore } from '../store';
import { deriveScope, featureValue, leaveOneOut, modelPoints, predictWithout, type ModelPoint, type StudentRecord, FEATURE_PHRASE } from '../lib/model';
import { describe, fmt, fmtSigned, isFail, linearRegression, pearson, toPercent, type PearsonResult, type Regression } from '../lib/stats';
import { Notice, PageHeader, ScopeControls, Segmented, Tex } from '../components/ui';
import { ScatterPlot, PlotLegend } from '../components/ScatterPlot';
import { eq } from './ModelPage';

export default function StabilityPage() {
  const { data, settings, updateRecord } = useStore();
  const { feature } = settings;
  const scope = settings.scope === 'all' ? '11' : settings.scope;
  const cfg = data.classes[scope];
  const rows = useMemo(() => deriveScope(data, scope, feature), [data, scope, feature]);
  const basePoints = useMemo(() => modelPoints(rows), [rows]);

  const [selId, setSelId] = useState<string>('');
  const [slot, setSlot] = useState(0);
  const [score, setScore] = useState<number | null>(null);
  const [exclude, setExclude] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [saved, setSaved] = useState(false);

  const sel = rows.find((r) => r.rec.id === selId) ?? rows.find((r) => r.x !== null);
  useEffect(() => { setScore(null); setSaved(false); setConfirm(false); }, [selId, slot, scope, feature]);
  if (!sel) {
    return (
      <div>
        <PageHeader step={5} title="Модель тұрақтылығы" />
        <div className="panel mb-6 p-4"><ScopeControls allowAll={false} /></div>
        <Notice tone="error">Бұл сыныпта модельге жарамды деректер жоқ. Ең жоғары баллдарды «Нақты деректер» бөлімінде енгізіңіз.</Notice>
      </div>
    );
  }
  const s = Math.min(slot, cfg.bjbCount - 1);
  const orig = sel.rec.bjb[s];
  const max = orig.max ?? 0;
  const cur = score ?? orig.score ?? 0;
  const changed = score !== null && score !== orig.score;

  // Эксперименттік көшірме: нақты деректер өзгермейді
  const expPct = sel.bjbPct.map((p, i) => (i === s ? toPercent(cur, max) : p));
  const expX = featureValue(expPct, feature);
  const expPoints: ModelPoint[] = basePoints
    .map((p) => (p.id === sel.rec.id && expX !== null ? { ...p, x: expX } : p))
    .filter((p) => !(exclude && p.id === sel.rec.id));

  const baseReg = linearRegression(basePoints);
  const expReg = linearRegression(expPoints);
  const baseCorr = pearson(basePoints);
  const expCorr = pearson(expPoints);
  const baseX = describe(basePoints.map((p) => p.x), settings.varianceKind);
  const expXd = describe(expPoints.map((p) => p.x), settings.varianceKind);
  const baseLoo = leaveOneOut(basePoints);
  const expLoo = leaveOneOut(expPoints);
  const selPoint = expPoints.find((p) => p.id === sel.rec.id);
  const pred = expX !== null ? predictWithout(expPoints, sel.rec.id, expX).prediction : null;
  const basePred = sel.x !== null ? predictWithout(basePoints, sel.rec.id, sel.x).prediction : null;
  const R = isFail(expReg) ? null : (expReg as Regression);
  const R0 = isFail(baseReg) ? null : (baseReg as Regression);
  const r = isFail(expCorr) ? null : (expCorr as PearsonResult).r;
  const r0 = isFail(baseCorr) ? null : (baseCorr as PearsonResult).r;

  // Әр оқушының әсері: оны алып тастағанда коэффициенттер қалай өзгереді
  const influence = basePoints.map((p) => {
    const m = linearRegression(basePoints.filter((q) => q.id !== p.id));
    const c = pearson(basePoints.filter((q) => q.id !== p.id));
    return { p, a: isFail(m) ? null : (m as Regression).a, b: isFail(m) ? null : (m as Regression).b, r: isFail(c) ? null : (c as PearsonResult).r };
  });
  const maxInfl = influence.reduce((best, i) => (R0 && i.a !== null && Math.abs(i.a - R0.a) > Math.abs((best?.a ?? R0.a) - R0.a) ? i : best), null as null | (typeof influence)[number]);

  const saveToData = () => {
    updateRecord(sel.rec.id, (rec) => {
      const bjb = [...rec.bjb] as StudentRecord['bjb'];
      bjb[s] = { ...bjb[s], score: cur };
      return { ...rec, bjb };
    });
    setConfirm(false);
    setScore(null);
    setSaved(true);
  };

  const Delta = ({ a, b, d = 3 }: { a: number | null | undefined; b: number | null | undefined; d?: number }) =>
    a === null || a === undefined || b === null || b === undefined || Math.abs(a - b) < 1e-9 ? null : <span className={`ml-1 text-xs ${b > a ? 'text-teal' : 'text-rose'}`}>{fmtSigned(b - a, d)}</span>;

  return (
    <div>
      <PageHeader
        step={5}
        title="Модель тұрақтылығы"
        lead="Бір оқушының БЖБ нәтижесін өзгертіп немесе оны талдаудан уақытша алып тастап, коэффициенттердің қалай өзгеретінін бақылаңыз. Бұл эксперимент: нақты деректер растамайынша өзгермейді."
      />
      <div className="panel mb-6 p-4"><ScopeControls allowAll={false} /></div>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="panel p-4">
          <ScatterPlot
            points={[
              ...expPoints.map((p) => ({ id: p.id, label: p.code, x: p.x, y: p.y, highlight: p.id === sel.rec.id })),
              ...(exclude && sel.x !== null && sel.y !== null ? [{ id: sel.rec.id, label: sel.rec.code, x: expX ?? sel.x, y: sel.y, excluded: true }] : []),
            ]}
            line={R}
            ghostLine={changed || exclude ? R0 : null}
            ghostLabel="бастапқы түзу"
            showResiduals
            xLabel={`x — ${FEATURE_PHRASE[feature]}, %`}
          />
          <div className="px-2"><PlotLegend items={[{ kind: 'point', label: 'оқушы' }, { kind: 'line', label: 'эксперименттегі түзу' }, { kind: 'dash', label: 'бастапқы түзу' }, { kind: 'residual', label: 'қалдық (y − ŷ)' }, { kind: 'hollow', label: 'алынып тасталған' }]} /></div>
        </div>

        <div className="flex flex-col gap-5">
          <div className="rounded-[14px] border border-violet/25 bg-violet-wash p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-violet"><FlaskConical className="h-4 w-4" /> Эксперимент</div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="text-sm text-ink-soft">Оқушы
                <select className="field ml-2 text-ink" value={sel.rec.id} onChange={(e) => setSelId(e.target.value)}>
                  {rows.filter((r) => r.x !== null).map((r) => <option key={r.rec.id} value={r.rec.id}>{r.rec.code}</option>)}
                </select>
              </label>
              {cfg.bjbCount > 1 && (
                <Segmented label="Қай БЖБ" value={String(s)} onChange={(v) => setSlot(Number(v))} options={Array.from({ length: cfg.bjbCount }, (_, i) => ({ value: String(i), label: `БЖБ ${i + 1}` }))} />
              )}
            </div>
            <label className="mt-4 block text-sm text-ink-soft" htmlFor="bjb-slider">
              БЖБ {s + 1}: <b className="num text-ink">{cur}</b> / {max} балл
              {expPct[s] !== null && <span className="text-ink-faint"> ({fmt(expPct[s], 1)}%)</span>}
              {changed && <span className="text-ink-faint">, нақты: {orig.score}</span>}
            </label>
            <input id="bjb-slider" type="range" min={0} max={max} step={1} value={cur} onChange={(e) => setScore(Number(e.target.value))} className="mt-2 w-full" disabled={exclude} />
            <label className="mt-4 flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" className="h-4 w-4 accent-violet" checked={exclude} onChange={(e) => setExclude(e.target.checked)} />
              Бір оқушыны талдаудан уақытша алып тастау
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => { setScore(null); setExclude(false); }} disabled={!changed && !exclude} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-ink hover:bg-white disabled:opacity-40">
                <RotateCcw className="h-4 w-4" /> Бастапқы күйге
              </button>
              {changed && !exclude && !confirm && (
                <button onClick={() => setConfirm(true)} className="rounded-lg border border-violet px-3 py-1.5 text-sm font-semibold text-violet hover:bg-white">Нақты деректерге сақтау…</button>
              )}
            </div>
            {confirm && (
              <div className="mt-3">
                <Notice tone="warn" title="Нақты деректер өзгереді">
                  {sel.rec.code} оқушысының БЖБ {s + 1} баллы {orig.score} → {cur} болып жазылады. Бұл барлық бөлімдерге әсер етеді.
                  <div className="mt-2 flex gap-2">
                    <button onClick={saveToData} className="rounded-lg bg-violet px-3 py-1.5 text-sm font-semibold text-white">Иә, сақтау</button>
                    <button onClick={() => setConfirm(false)} className="rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-white">Болдырмау</button>
                  </div>
                </Notice>
              </div>
            )}
            {saved && <p className="mt-3 text-sm font-medium text-teal">Нақты деректерге сақталды.</p>}
          </div>

          <div className="panel p-5">
            <div className="text-sm text-ink-soft">Регрессия теңдеуі</div>
            <div className="mt-1 text-xl">{R ? <Tex>{eq(R)}</Tex> : <span className="text-rose">құрылмады</span>}</div>
            {R0 && (changed || exclude) && <div className="mt-1 text-sm text-ink-faint">бастапқы: <Tex>{eq(R0)}</Tex></div>}
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm num">
              <Row k="x орташасы" v={fmt(expXd.mean, 2)} d={<Delta a={baseX.mean} b={expXd.mean} d={2} />} />
              <Row k={`x дисперсиясы (${settings.varianceKind === 'sample' ? 's²' : 'σ²'})`} v={fmt(expXd.variance, 2)} d={<Delta a={baseX.variance} b={expXd.variance} d={2} />} />
              <Row k="Корреляция, r" v={fmt(r, 3)} d={<Delta a={r0} b={r} />} />
              <Row k="R²" v={fmt(R?.r2 ?? null, 3)} d={<Delta a={R0?.r2} b={R?.r2} />} />
              <Row k="Еңіс, a" v={fmt(R?.a ?? null, 3)} d={<Delta a={R0?.a} b={R?.a} />} />
              <Row k="Бос мүше, b" v={fmt(R?.b ?? null, 2)} d={<Delta a={R0?.b} b={R?.b} d={2} />} />
              <Row k="LOO MAE (регрессия)" v={`${fmt(expLoo.scores.regression.mae, 2)} п.т.`} d={<Delta a={baseLoo.scores.regression.mae} b={expLoo.scores.regression.mae} d={2} />} />
              <Row k={`${sel.rec.code} болжамы`} v={pred ? `${fmt(pred.value, 1)}%` : '—'} d={<Delta a={basePred?.value} b={pred?.value} d={1} />} />
            </dl>
            {selPoint && pred && <p className="mt-3 text-xs text-ink-faint">Болжам оқушының өзінсіз құрылған модельмен есептеледі; нақты ТЖБ = {fmt(selPoint.y, 1)}%.</p>}
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="panel p-6">
          <h2 className="font-display text-lg font-bold text-ink">Неге бір жазба көп әсер етеді?</h2>
          <p className="mt-3 leading-relaxed text-ink-soft">
            Еңіс коэффициенті <Tex>{'a = \\frac{\\sum (x_i-\\bar x)(y_i-\\bar y)}{\\sum (x_i-\\bar x)^2}'}</Tex> барлық оқушылардың ауытқуларының қосындысынан тұрады. n = {basePoints.length} болғанда әр оқушы қосындының шамамен {fmt(100 / Math.max(1, basePoints.length), 0)}%-ын береді. Орташадан алыс тұрған нүкте (x шетінде) бөлімге де, алымға да көп үлес қосады, сондықтан ол түзуді өзіне қарай «тартады».
          </p>
          {maxInfl && R0 && maxInfl.a !== null && (
            <p className="mt-3 leading-relaxed text-ink-soft">
              Осы деректерде ең ықпалды оқушы — <b className="text-ink">{maxInfl.p.code}</b>: оны алып тастағанда еңіс {fmt(R0.a, 3)}-тен {fmt(maxInfl.a, 3)}-ке өзгереді ({fmtSigned(((maxInfl.a - R0.a) / Math.abs(R0.a)) * 100, 1)}%).
            </p>
          )}
        </div>
        <div className="panel overflow-x-auto">
          <div className="px-5 pt-5 font-display text-base font-bold text-ink">Әр оқушыны алып тастағандағы коэффициенттер</div>
          <table className="mt-3 w-full min-w-[480px] text-sm num">
            <thead>
              <tr className="border-y border-grid-strong bg-paper text-left text-ink-soft">
                <th className="px-4 py-2">Алынған оқушы</th><th className="px-4 py-2">a</th><th className="px-4 py-2">b</th><th className="px-4 py-2">r</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-grid bg-violet-wash/50 font-semibold">
                <td className="px-4 py-2">Ешкім (барлық деректер)</td><td className="px-4 py-2">{fmt(R0?.a ?? null, 3)}</td><td className="px-4 py-2">{fmt(R0?.b ?? null, 2)}</td><td className="px-4 py-2">{fmt(r0, 3)}</td>
              </tr>
              {influence.map((i) => (
                <tr key={i.p.id} className={`border-b border-grid last:border-0 ${maxInfl?.p.id === i.p.id ? 'bg-amber-wash' : ''}`}>
                  <td className="px-4 py-2 font-semibold text-ink">{i.p.code}</td>
                  <td className="px-4 py-2">{fmt(i.a, 3)}<Delta a={R0?.a} b={i.a} /></td>
                  <td className="px-4 py-2">{fmt(i.b, 2)}<Delta a={R0?.b} b={i.b} d={2} /></td>
                  <td className="px-4 py-2">{fmt(i.r, 3)}<Delta a={r0} b={i.r} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Row({ k, v, d }: { k: string; v: string; d?: React.ReactNode }) {
  return (
    <div>
      <dt className="text-ink-faint">{k}</dt>
      <dd className="font-semibold text-ink">{v}{d}</dd>
    </div>
  );
}
