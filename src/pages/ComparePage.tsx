import { useMemo } from 'react';
import { Trophy } from 'lucide-react';
import { useStore } from '../store';
import { leaveOneOut, METHOD_LABEL, METHOD_SHORT, scopeModel, type MethodId, FEATURE_PHRASE } from '../lib/model';
import { fmt } from '../lib/stats';
import { Notice, PageHeader, Reveal, ScopeControls, SmallSampleNote, Tex } from '../components/ui';
import { ChartFrame, ErrorByStudent, MethodBars } from '../components/charts';

const METHODS: MethodId[] = ['mean', 'naive', 'regression'];

const DESC: Record<MethodId, string> = {
  mean: 'Болжам — қалған оқушылардың ТЖБ пайыздарының орташасы. Оқушының өз БЖБ нәтижесі ескерілмейді.',
  naive: 'Болжам — оқушының БЖБ пайызы: ŷ = x. Ешқандай оқыту қажет емес, модель «ТЖБ БЖБ-мен бірдей болады» деп болжайды.',
  regression: 'Болжам — қалған оқушылар бойынша құрылған ŷ = ax + b теңдеуі. Әр қадамда a мен b қайта есептеледі.',
};

export default function ComparePage() {
  const { data, settings } = useStore();
  const { scope, feature } = settings;
  const { points } = useMemo(() => scopeModel(data, scope, feature), [data, scope, feature]);
  const loo = useMemo(() => leaveOneOut(points), [points]);
  const ok = points.length >= 3;

  const label = (code: string, id: string) => (scope === 'all' ? `${id.split('-')[0]}·${code}` : code);

  return (
    <div>
      <PageHeader
        step={4}
        title="Үш әдісті салыстыру"
        lead="Әдістердің дәлдігі әділ тексеріледі: әр оқушы кезекпен талдаудан шығарылады, модель қалғандары бойынша құрылады және шығарылған оқушының ТЖБ-сы болжанады (Leave-One-Out). Ең дәл әдіс тек есептелген қате бойынша анықталады."
      />
      <div className="panel mb-6 p-4"><ScopeControls /></div>

      {!ok ? (
        <Notice tone="error" title="Тексеру мүмкін емес">Leave-One-Out тексеруі үшін кемінде 3 оқушының толық деректері қажет (қазір: {points.length}).</Notice>
      ) : (
        <>
          <div className="mb-6"><SmallSampleNote n={points.length} /></div>

          <section className="grid gap-4 lg:grid-cols-3">
            {METHODS.map((m, i) => {
              const s = loo.scores[m];
              const best = loo.best.includes(m);
              return (
                <div key={m} className={`relative rounded-[14px] border p-5 ${best ? 'border-violet bg-violet-wash' : 'border-grid-strong bg-white'}`}>
                  {best && <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-violet px-2.5 py-1 text-xs font-semibold text-white"><Trophy className="h-3.5 w-3.5" /> Ең кіші MAE</span>}
                  <div className="text-sm font-medium text-ink-faint">{i + 1}-әдіс</div>
                  <div className="mt-1 pr-24 font-display text-lg font-bold leading-snug text-ink">{METHOD_LABEL[m]}</div>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">{DESC[m]}</p>
                  <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-grid-strong pt-4 num">
                    <div><dt className="text-xs text-ink-faint">MAE</dt><dd className="font-display text-xl font-bold text-ink">{fmt(s.mae, 2)}</dd></div>
                    <div><dt className="text-xs text-ink-faint">RMSE</dt><dd className="font-display text-xl font-bold text-ink">{fmt(s.rmse, 2)}</dd></div>
                    <div><dt className="text-xs text-ink-faint">Ең үлкен</dt><dd className="font-display text-xl font-bold text-ink">{fmt(s.maxAbs, 2)}</dd></div>
                  </dl>
                  <div className="mt-1 text-xs text-ink-faint">пайыздық тармақ{s.failed ? ` · ${s.failed} қадамда болжам жасалмады` : ''}{s.clippedCount ? ` · ${s.clippedCount} болжам 0–100%-ға шектелді` : ''}</div>
                </div>
              );
            })}
          </section>

          <div className="mt-6">
            <BestVerdict loo={loo} />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <ChartFrame title="Әдістердің қателері" sub="Төмен баған — дәлірек әдіс. ★ — ең кіші MAE.">
              <MethodBars best={loo.best} data={METHODS.map((m) => ({ id: m, name: METHOD_SHORT[m], ...loo.scores[m] }))} />
            </ChartFrame>
            <ChartFrame title="Әр оқушы бойынша қате" sub="Оң мән — болжам нақты нәтижеден жоғары, теріс — төмен.">
              <ErrorByStudent data={loo.folds.map((f) => ({
                label: label(f.code, f.id),
                mean: f.preds.mean ? f.preds.mean.value - f.y : null,
                naive: f.preds.naive ? f.preds.naive.value - f.y : null,
                regression: f.preds.regression ? f.preds.regression.value - f.y : null,
              }))} />
            </ChartFrame>
          </div>

          <section className="panel mt-6 overflow-x-auto">
            <div className="px-5 pt-5 font-display text-base font-bold text-ink">Leave-One-Out қадамдары</div>
            <p className="px-5 pt-1 text-sm text-ink-faint">x — {FEATURE_PHRASE[feature]}, барлық мәндер пайызбен. Регрессия әр қадамда {points.length - 1} оқушы бойынша қайта құрылады.</p>
            <table className="mt-3 w-full min-w-[820px] text-sm num">
              <thead>
                <tr className="border-y border-grid-strong bg-paper text-left text-ink-soft">
                  <th className="px-4 py-2.5">Шығарылған оқушы</th>
                  <th className="px-4 py-2.5">x</th>
                  <th className="px-4 py-2.5 text-teal">Нақты y</th>
                  <th className="px-4 py-2.5">Оқыту жиынындағы теңдеу</th>
                  <th className="px-4 py-2.5">ŷ₁ орташа</th>
                  <th className="px-4 py-2.5">ŷ₂ = x</th>
                  <th className="px-4 py-2.5 text-violet">ŷ₃ регрессия</th>
                </tr>
              </thead>
              <tbody>
                {loo.folds.map((f) => (
                  <tr key={f.id} className="border-b border-grid last:border-0">
                    <td className="px-4 py-2 font-semibold text-ink">{label(f.code, f.id)}</td>
                    <td className="px-4 py-2">{fmt(f.x, 1)}</td>
                    <td className="px-4 py-2 font-semibold text-teal">{fmt(f.y, 1)}</td>
                    <td className="px-4 py-2 text-ink-soft">{f.regModel ? `ŷ = ${fmt(f.regModel.a, 3)}x ${f.regModel.b < 0 ? '−' : '+'} ${fmt(Math.abs(f.regModel.b), 2)}` : '—'}</td>
                    {METHODS.map((m) => {
                      const p = f.preds[m];
                      return (
                        <td key={m} className="px-4 py-2">
                          {p ? fmt(p.value, 1) : '—'}
                          {p && <span className="ml-1.5 text-xs text-ink-faint">({p.value - f.y >= 0 ? '+' : '−'}{fmt(Math.abs(p.value - f.y), 1)})</span>}
                          {p?.clipped && <span className="ml-1 text-xs text-amber" title={`бастапқы мән ${fmt(p.raw, 2)}`}>*</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="panel mt-6 p-6">
            <h2 className="font-display text-lg font-bold text-ink">Қате метрикалары</h2>
            <Reveal label="Формулаларды көрсету">
              <Tex block>{'\\text{MAE} = \\frac{1}{n}\\sum_{i=1}^{n} |y_i - \\hat y_{(-i)}| \\qquad \\text{RMSE} = \\sqrt{\\frac{1}{n}\\sum_{i=1}^{n} (y_i - \\hat y_{(-i)})^2} \\qquad \\max_i |y_i - \\hat y_{(-i)}|'}</Tex>
              <p className="mt-2 text-sm text-ink-soft"><Tex>{'\\hat y_{(-i)}'}</Tex> — i-оқушыны шығарып тастап құрылған модельдің сол оқушыға берген болжамы. Сондықтан ешбір оқушының ТЖБ-сы өз болжамын жасауға қатыспайды. RMSE үлкен қателерге MAE-ге қарағанда көбірек салмақ береді.</p>
            </Reveal>
          </section>
        </>
      )}
    </div>
  );
}

function BestVerdict({ loo }: { loo: ReturnType<typeof leaveOneOut> }) {
  const { scores, best } = loo;
  if (!best.length) return null;
  const reg = scores.regression, naive = scores.naive, mean = scores.mean;
  const names = best.map((b) => `«${METHOD_LABEL[b]}»`).join(' және ');
  const rmseBest = METHODS.filter((m) => scores[m].rmse !== null).sort((a, b) => scores[a].rmse! - scores[b].rmse!)[0];
  return (
    <Notice tone="info" title={`Осы деректерде MAE бойынша ең дәл әдіс: ${names}`}>
      {reg.mae !== null && mean.mae !== null && (
        <>Регрессияның орташа қатесі сыныптың орташасына негізделген болжамнан {fmt(mean.mae - reg.mae, 2)} п.т. {reg.mae < mean.mae ? 'аз' : 'көп'}. </>
      )}
      {reg.mae !== null && naive.mae !== null && (
        <>
          Регрессия мен ŷ = x әдісінің айырмасы: {fmt(Math.abs(reg.mae - naive.mae), 2)} п.т. ({reg.mae < naive.mae ? 'регрессия дәлірек' : 'ŷ = x әдісі дәлірек'}).{' '}
        </>
      )}
      {rmseBest && !best.includes(rmseBest) && <>RMSE бойынша ең кіші қате басқа әдісте: «{METHOD_LABEL[rmseBest]}» — бұл үлкен қателердің әсері әртүрлі екенін көрсетеді. </>}
      Шағын таңдамада әдістердің айырмашылығы кездейсоқ болуы мүмкін, сондықтан қорытынды тек осы деректерге қатысты.
    </Notice>
  );
}
