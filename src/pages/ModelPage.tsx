import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { makePrediction, predictWithout, scopeModel, type ModelPoint, FEATURE_PHRASE } from '../lib/model';
import { correlationStrength, correlationTTest, fmt, fmtSigned, isFail, predict, type PearsonResult, type Regression } from '../lib/stats';
import { Metric, Notice, PageHeader, Reveal, ScopeControls, Segmented, SmallSampleNote, Tex, tx, txs } from '../components/ui';
import { ScatterPlot, PlotLegend } from '../components/ScatterPlot';

export function failText(err: string, n: number) {
  if (err === 'too-few') return `Модель құру үшін кемінде 3 оқушының БЖБ және ТЖБ пайыздары қажет (қазір: ${n}).`;
  if (err === 'zero-variance-x') return 'Барлық оқушылардың кіріс көрсеткіші бірдей — x бойынша вариация жоқ, сондықтан еңіс коэффициентін есептеу мүмкін емес.';
  if (err === 'zero-variance-y') return 'Барлық оқушылардың ТЖБ нәтижесі бірдей — корреляцияны есептеу мүмкін емес.';
  return 'Модель құрылмады.';
}

export const eq = (m: { a: number; b: number }, d = 3) => `\\hat y = ${tx(m.a, d)}\\,x ${m.b < 0 ? '-' : '+'} ${tx(Math.abs(m.b), d)}`;

export default function ModelPage() {
  const { data, settings } = useStore();
  const { scope, feature } = settings;
  const { points, corr, reg, rows } = useMemo(() => scopeModel(data, scope, feature), [data, scope, feature]);
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [selId, setSelId] = useState<string | null>(null);
  const [newX, setNewX] = useState(75);
  const label = (p: ModelPoint) => (scope === 'all' ? `${p.classId}·${p.code}` : p.code);

  const regOk = !isFail(reg);
  const R = reg as Regression;
  const C_ = corr as PearsonResult;
  const sel = points.find((p) => p.id === selId) ?? points[0];
  const loo = sel ? predictWithout(points, sel.id, sel.x) : null;
  const looModel = loo && !isFail(loo.model) ? (loo.model as Regression) : null;
  const newPred = regOk ? makePrediction(predict(R, newX)) : null;
  const tt = !isFail(corr) ? correlationTTest(C_.r, C_.n) : null;
  const excluded = rows.length - points.length;

  return (
    <div>
      <PageHeader
        step={3}
        title="Болжам моделі"
        lead={<>Сызықтық регрессия <Tex>{'\\hat y = ax + b'}</Tex>: мұнда x — {FEATURE_PHRASE[feature]} (%), ŷ — ТЖБ болжамы (%). Коэффициенттер a мен b ең кіші квадраттар әдісімен деректерден есептеледі.</>}
      />
      <div className="panel mb-6 p-4"><ScopeControls /></div>

      <div className="mb-6 space-y-3">
        {isFail(reg) && <Notice tone="error" title="Модель құрылмады">{failText(reg.error, reg.n)}</Notice>}
        {excluded > 0 && <Notice tone="warn" title={`${excluded} оқушы модельге кірмеді`}>Олардың БЖБ немесе ТЖБ пайызы есептелмеді (балл немесе ең жоғары балл жоқ). «Нақты деректер» бөлімінде толықтырыңыз.</Notice>}
        {points.length > 0 && <SmallSampleNote n={points.length} />}
      </div>

      {regOk && (
        <>
          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <div className="panel p-4">
              <ScatterPlot
                points={points.map((p) => ({ id: p.id, label: label(p), x: p.x, y: p.y, highlight: mode === 'existing' && p.id === sel?.id }))}
                line={mode === 'existing' && looModel ? looModel : R}
                ghostLine={mode === 'existing' && looModel ? R : null}
                prediction={mode === 'existing' && loo?.prediction && sel ? { x: sel.x, y: loo.prediction.value } : mode === 'new' && newPred ? { x: newX, y: newPred.value } : null}
                labels={scope !== 'all'}
                animateKey={`${scope}-${feature}`}
                onPointClick={(id) => { setMode('existing'); setSelId(id); }}
                height={480}
                xLabel={`x — ${FEATURE_PHRASE[feature]}, %`}
              />
              <div className="px-2 pb-1">
                <PlotLegend items={[
                  { kind: 'point', label: 'нақты нәтиже' },
                  { kind: 'line', label: mode === 'existing' ? 'таңдалған оқушысыз құрылған түзу' : 'регрессия түзуі' },
                  ...(mode === 'existing' ? [{ kind: 'dash' as const, label: 'барлық деректер бойынша түзу' }] : []),
                  { kind: 'diamond', label: 'болжам' },
                ]} />
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <div className="rounded-[14px] border border-violet/25 bg-violet-wash p-5">
                <div className="text-sm font-medium text-violet">Регрессия теңдеуі (барлық n = {R.n} оқушы)</div>
                <div className="mt-2 text-2xl text-ink"><Tex>{eq(R)}</Tex></div>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <Metric label="Пирсон коэффициенті, r" value={C_.r ?? null} digits={3} accent="violet" hint={!isFail(corr) ? `${C_.r > 0 ? 'оң' : 'теріс'}, ${correlationStrength(C_.r)} байланыс` : undefined} />
                  <Metric label="Детерминация, R²" value={R.r2} digits={3} accent="violet" hint={R.r2 !== null ? `ТЖБ өзгерісінің ${fmt(R.r2 * 100, 1)}%-ы x арқылы түсіндіріледі` : undefined} />
                </div>
                {tt && (
                  <p className="mt-4 text-sm leading-relaxed text-ink-soft">
                    Маңыздылық: <Tex>{`t = \\frac{r\\sqrt{n-2}}{\\sqrt{1-r^2}} = ${tx(tt.t, 2)}`}</Tex>, сыни мән <Tex>{`t_{0{,}05;\\,${tt.df}} = ${tx(tt.tCrit, 3)}`}</Tex>.{' '}
                    {tt.significant ? 'Корреляция α = 0,05 деңгейінде статистикалық маңызды.' : 'Корреляция α = 0,05 деңгейінде статистикалық маңызды емес.'}
                  </p>
                )}
              </div>

              <div className="panel p-5">
                <Segmented label="Болжам түрі" value={mode} onChange={setMode} options={[{ value: 'existing', label: 'Сыныптағы оқушы' }, { value: 'new', label: 'Жаңа оқушы' }]} />
                {mode === 'existing' && sel && loo && (
                  <div className="mt-4">
                    <label className="text-sm text-ink-soft">Оқушы
                      <select className="field ml-2 text-ink" value={sel.id} onChange={(e) => setSelId(e.target.value)}>
                        {points.map((p) => <option key={p.id} value={p.id}>{label(p)}</option>)}
                      </select>
                    </label>
                    {looModel && loo.prediction ? (
                      <>
                        <p className="mt-3 text-sm text-ink-soft">Модель осы оқушысыз, қалған {loo.trainN} оқушы бойынша құрылды — оның ТЖБ-сы болжамға әсер етпейді:</p>
                        <div className="mt-1 text-lg"><Tex>{`${eq(looModel)} \\;\\Rightarrow\\; \\hat y = ${txs(looModel.a, 3)}\\cdot${tx(sel.x, 2)} ${looModel.b < 0 ? '-' : '+'} ${tx(Math.abs(looModel.b), 3)} = ${tx(loo.prediction.raw, 2)}\\%`}</Tex></div>
                        {loo.prediction.clipped && <Notice tone="warn" title="Болжам 0–100% аралығынан шықты">Модельдің бастапқы мәні {fmt(loo.prediction.raw, 2)}%. Практикалық болжам {fmt(loo.prediction.value, 2)}% деп шектелді.</Notice>}
                        <div className="mt-4 grid grid-cols-3 gap-3">
                          <Metric label="Болжам, ŷ" value={loo.prediction.value} digits={1} suffix="%" accent="violet" />
                          <Metric label="Нақты ТЖБ, y" value={sel.y} digits={1} suffix="%" accent="teal" />
                          <div>
                            <div className="text-sm text-ink-soft">Айырма, y − ŷ</div>
                            <div className="mt-0.5 font-display text-2xl font-bold text-ink num">{fmtSigned(sel.y - loo.prediction.value, 1)}</div>
                            <div className="text-xs text-ink-faint">пайыздық тармақ</div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <Notice tone="warn">{failText(isFail(loo.model) ? loo.model.error : 'too-few', loo.trainN)}</Notice>
                    )}
                    <p className="mt-3 text-xs text-ink-faint">Нүктені басып та оқушыны таңдауға болады.</p>
                  </div>
                )}
                {mode === 'new' && newPred && (
                  <div className="mt-4">
                    <label className="block text-sm text-ink-soft" htmlFor="newx">Жаңа оқушының кіріс көрсеткіші x ({FEATURE_PHRASE[feature]})</label>
                    <div className="mt-2 flex items-center gap-3">
                      <input id="newx" type="range" min={0} max={100} step={0.5} value={newX} onChange={(e) => setNewX(Number(e.target.value))} className="flex-1" />
                      <input aria-label="x мәні, %" type="number" min={0} max={100} step={0.5} value={newX} onChange={(e) => setNewX(Math.max(0, Math.min(100, Number(e.target.value))))} className="field w-20 text-center" />
                      <span className="text-ink-soft">%</span>
                    </div>
                    <div className="mt-3 text-lg"><Tex>{`\\hat y = ${txs(R.a, 3)}\\cdot ${tx(newX, 1)} ${R.b < 0 ? '-' : '+'} ${tx(Math.abs(R.b), 3)} = ${tx(newPred.raw, 2)}\\%`}</Tex></div>
                    {newPred.clipped && <Notice tone="warn" title="Болжам 0–100% аралығынан шықты">Бастапқы есептеу {fmt(newPred.raw, 2)}%, практикалық болжам {fmt(newPred.value, 2)}%.</Notice>}
                    <div className="mt-3"><Metric label="ТЖБ болжамы" value={newPred.value} digits={1} suffix="%" accent="violet" /></div>
                    {(newX < Math.min(...points.map((p) => p.x)) || newX > Math.max(...points.map((p) => p.x))) && (
                      <p className="mt-3 text-sm text-amber">x мәні модель құрылған деректер аралығынан тыс ({fmt(Math.min(...points.map((p) => p.x)), 1)}–{fmt(Math.max(...points.map((p) => p.x)), 1)}%). Мұндай экстраполяция сенімділігі төмен.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="panel mt-6 p-6">
            <h2 className="font-display text-lg font-bold text-ink">Коэффициенттер қалай есептелді</h2>
            <Reveal>
              <RegressionCalc points={points} R={R} r={C_?.r ?? null} label={label} />
            </Reveal>
          </section>
        </>
      )}
    </div>
  );
}

function RegressionCalc({ points, R, r, label }: { points: ModelPoint[]; R: Regression; r: number | null; label: (p: ModelPoint) => string }) {
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm num">
          <thead>
            <tr className="border-b border-grid-strong text-left text-ink-soft">
              <th className="px-3 py-2">Оқушы</th>
              <th className="px-3 py-2"><Tex>{'x_i'}</Tex></th>
              <th className="px-3 py-2"><Tex>{'y_i'}</Tex></th>
              <th className="px-3 py-2"><Tex>{'x_i-\\bar x'}</Tex></th>
              <th className="px-3 py-2"><Tex>{'y_i-\\bar y'}</Tex></th>
              <th className="px-3 py-2"><Tex>{'(x_i-\\bar x)(y_i-\\bar y)'}</Tex></th>
              <th className="px-3 py-2"><Tex>{'(x_i-\\bar x)^2'}</Tex></th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => {
              const dx = p.x - R.meanX, dy = p.y - R.meanY;
              return (
                <tr key={p.id} className="border-b border-grid">
                  <td className="px-3 py-1.5 font-semibold">{label(p)}</td>
                  <td className="px-3 py-1.5">{fmt(p.x, 2)}</td>
                  <td className="px-3 py-1.5">{fmt(p.y, 2)}</td>
                  <td className="px-3 py-1.5">{fmt(dx, 2)}</td>
                  <td className="px-3 py-1.5">{fmt(dy, 2)}</td>
                  <td className="px-3 py-1.5">{fmt(dx * dy, 2)}</td>
                  <td className="px-3 py-1.5">{fmt(dx * dx, 2)}</td>
                </tr>
              );
            })}
            <tr className="font-semibold">
              <td className="px-3 py-2">Қосынды</td>
              <td className="px-3 py-2" colSpan={4}><Tex>{`\\bar x = ${tx(R.meanX, 3)},\\; \\bar y = ${tx(R.meanY, 3)}`}</Tex></td>
              <td className="px-3 py-2">{fmt(R.sxy, 2)}</td>
              <td className="px-3 py-2">{fmt(R.sxx, 2)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <Tex block>{`a = \\frac{\\sum (x_i-\\bar x)(y_i-\\bar y)}{\\sum (x_i-\\bar x)^2} = \\frac{${tx(R.sxy, 3)}}{${tx(R.sxx, 3)}} = ${tx(R.a, 4)}`}</Tex>
      <Tex block>{`b = \\bar y - a\\,\\bar x = ${tx(R.meanY, 3)} - ${txs(R.a, 4)}\\cdot ${tx(R.meanX, 3)} = ${tx(R.b, 4)}`}</Tex>
      {r !== null && <Tex block>{`r = \\frac{\\sum (x_i-\\bar x)(y_i-\\bar y)}{\\sqrt{\\sum (x_i-\\bar x)^2 \\cdot \\sum (y_i-\\bar y)^2}} = \\frac{${tx(R.sxy, 3)}}{\\sqrt{${tx(R.sxx, 3)}\\cdot ${tx(R.ssTot, 3)}}} = ${tx(r, 4)}`}</Tex>}
      {R.r2 !== null && <Tex block>{`R^2 = 1 - \\frac{SS_{\\text{қалд}}}{SS_{\\text{жалпы}}} = 1 - \\frac{${tx(R.ssRes, 3)}}{${tx(R.ssTot, 3)}} = ${tx(R.r2, 4)}`}</Tex>}
    </div>
  );
}
