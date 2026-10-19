import { useMemo } from 'react';
import { FileDown, Printer } from 'lucide-react';
import { useStore } from '../store';
import { buildReport, hypothesisText, type ScopeSummary } from '../lib/report';
import { deriveScope, METHOD_LABEL, modelPoints, RISK_LABEL, type MethodId, FEATURE_PHRASE } from '../lib/model';
import { correlationStrength, fmt } from '../lib/stats';
import { exportJson } from '../lib/io';
import { Notice, Tex } from '../components/ui';
import { ScatterPlot } from '../components/ScatterPlot';
import { eq } from './ModelPage';
import { BRAND_NAME, RESEARCH_TOPIC, SECTION } from '../config';

const METHODS: MethodId[] = ['mean', 'naive', 'regression'];

export default function ReportPage() {
  const { data, settings } = useStore();
  const rep = useMemo(() => buildReport(data, settings.feature, settings.varianceKind, settings.thresholds), [data, settings]);
  const focus: ScopeSummary = settings.scope === 'all' ? rep.all : rep.classes.find((c) => c.scope === settings.scope)!;
  const valid = [...rep.classes, rep.all].filter((s) => s.nModel >= 3);
  const vkName = settings.varianceKind === 'sample' ? 'таңдамалы (бөлгіш n − 1)' : 'генералдық (бөлгіш n)';
  const sd = settings.varianceKind === 'sample' ? 's' : 'σ';
  const totalRecords = rep.classes.reduce((s, c) => s + c.nRecords, 0);
  const focusPoints = useMemo(() => modelPoints(deriveScope(data, focus.scope, settings.feature)).map((p) => ({ id: p.id, label: p.code, x: p.x, y: p.y })), [data, focus.scope, settings.feature]);

  const exportResults = () => exportJson({
    тақырып: RESEARCH_TOPIC,
    күні: rep.date.toISOString().slice(0, 10),
    кіріс_көрсеткіш: rep.featureLabel,
    дисперсия: vkName,
    сыныптар: [...rep.classes, rep.all].map((s) => ({
      сынып: s.label, жазбалар: s.nRecords, модельдегі_n: s.nModel,
      r: s.r, a: s.reg?.a ?? null, b: s.reg?.b ?? null, R2: s.reg?.r2 ?? null,
      t: s.ttest?.t ?? null, t_сыни: s.ttest?.tCrit ?? null,
      LOO: s.loo ? Object.fromEntries(METHODS.map((m) => [m, { MAE: s.loo!.scores[m].mae, RMSE: s.loo!.scores[m].rmse, max: s.loo!.scores[m].maxAbs }])) : null,
    })),
  }, 'bilim-stat-natijeler.json');

  return (
    <article className="mx-auto max-w-[860px]">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">Қорытынды енгізілген деректер мен ағымдағы параметрлерден автоматты құрылады.</p>
        <div className="flex gap-2">
          <button onClick={exportResults} className="inline-flex items-center gap-2 rounded-xl border border-grid-strong bg-white px-3.5 py-2 text-sm font-medium text-ink hover:border-sky"><FileDown className="h-4 w-4 text-teal" /> Нәтижелер (JSON)</button>
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-blue px-4 py-2 text-sm font-semibold text-white hover:brightness-110"><Printer className="h-4 w-4" /> Басып шығару / PDF</button>
        </div>
      </div>
      <p className="no-print -mt-3 mb-6 text-xs text-ink-faint">PDF алу үшін басып шығару терезесінде «PDF ретінде сақтау» таңдаңыз.</p>

      <div className="rounded-[14px] border border-grid-strong bg-white p-8 sm:p-12 print:border-0 print:p-0">
        <header className="border-b border-grid-strong pb-6">
          <div className="text-sm text-ink-faint">{BRAND_NAME} · зерттеу қорытындысы · {rep.date.toLocaleDateString('ru-RU')}</div>
          <h1 className="mt-2 font-display text-2xl font-bold leading-snug text-ink sm:text-3xl">{RESEARCH_TOPIC}</h1>
          <div className="mt-2 text-ink-soft">Секция: {SECTION}</div>
        </header>

        <Sec n={1} title="Зерттеу мақсаты">
          <p>БЖБ (бөлім бойынша жиынтық бағалау) нәтижелері мен ТЖБ (тоқсандық жиынтық бағалау) нәтижесі арасындағы байланысты математикалық статистика әдістерімен зерттеу, ТЖБ нәтижесін болжайтын модель құру, оның дәлдігін тексеру және білім сапасын арттыруға арналған практикалық ұсыныстар жасау.</p>
          <p className="mt-2"><b>Гипотеза.</b> БЖБ нәтижелері мен ТЖБ нәтижесі арасында оң сызықтық байланыс бар, сондықтан БЖБ негізінде құрылған модель ТЖБ-ны сыныптың орташа нәтижесіне қарағанда дәлірек болжайды.</p>
        </Sec>

        <Sec n={2} title="Деректер сипаттамасы">
          <p>Барлығы {totalRecords} жазба, үш сынып. Оқушылар кодпен белгіленген, жеке деректер қолданылмаған. Әртүрлі ең жоғары баллдарды салыстыру үшін әр балл пайызға айналдырылды.</p>
          <table className="mt-3 w-full text-sm num">
            <thead><tr className="border-b border-grid-strong text-left text-ink-soft"><th className="py-1.5 pr-3">Сынып</th><th className="py-1.5 pr-3">Жазба</th><th className="py-1.5 pr-3">Модельге кірді</th><th className="py-1.5">Ескерту</th></tr></thead>
            <tbody>
              {rep.classes.map((c) => (
                <tr key={c.scope} className="border-b border-grid">
                  <td className="py-1.5 pr-3 font-semibold">{c.label}</td><td className="py-1.5 pr-3">{c.nRecords}</td><td className="py-1.5 pr-3">{c.nModel}</td>
                  <td className="py-1.5 text-ink-soft">{c.missing.length ? `ең жоғары балл белгісіз: ${c.missing.join(', ')}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Sec>

        <Sec n={3} title="Қолданылған математикалық әдістер">
          <ul className="list-disc space-y-1 pl-5">
            <li>Сипаттамалық статистика: орташа мән, медиана, мода, дисперсия ({vkName}), стандартты ауытқу, вариация коэффициенті.</li>
            <li>Пирсонның корреляция коэффициенті және оның маңыздылығын Стьюдент t-критерийімен тексеру (α = 0,05).</li>
            <li>Ең кіші квадраттар әдісімен сызықтық регрессия <Tex>{'\\hat y = ax + b'}</Tex>, детерминация коэффициенті R². Кіріс көрсеткіш x — {FEATURE_PHRASE[rep.feature]}.</li>
            <li>Болжам дәлдігін бір-бірлеп шығарып тексеру (Leave-One-Out): MAE, RMSE, ең үлкен абсолют қате.</li>
          </ul>
        </Sec>

        <Sec n={4} title="Негізгі статистикалық көрсеткіштер (пайызбен)">
          <table className="w-full text-sm num">
            <thead><tr className="border-b border-grid-strong text-left text-ink-soft">
              <th className="py-1.5 pr-2">Сынып</th><th className="py-1.5 pr-2">n</th><th className="py-1.5 pr-2">x̄ (БЖБ)</th><th className="py-1.5 pr-2">{sd} (БЖБ)</th><th className="py-1.5 pr-2">ȳ (ТЖБ)</th><th className="py-1.5 pr-2">Me (ТЖБ)</th><th className="py-1.5 pr-2">{sd} (ТЖБ)</th><th className="py-1.5">V (ТЖБ), %</th>
            </tr></thead>
            <tbody>
              {valid.map((c) => (
                <tr key={c.scope} className="border-b border-grid">
                  <td className="py-1.5 pr-2 font-semibold">{c.label}</td><td className="py-1.5 pr-2">{c.nModel}</td>
                  <td className="py-1.5 pr-2">{fmt(c.x.mean, 1)}</td><td className="py-1.5 pr-2">{fmt(c.x.sd, 1)}</td>
                  <td className="py-1.5 pr-2">{fmt(c.y.mean, 1)}</td><td className="py-1.5 pr-2">{fmt(c.y.median, 1)}</td><td className="py-1.5 pr-2">{fmt(c.y.sd, 1)}</td><td className="py-1.5">{fmt(c.y.cv, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Sec>

        <Sec n={5} title="Корреляциялық талдау">
          <ul className="space-y-1.5">
            {valid.map((c) => (
              <li key={c.scope}>
                <b>{c.label}:</b> r = {fmt(c.r, 3)}{c.r !== null && ` — ${correlationStrength(c.r)} ${c.r > 0 ? 'оң' : 'теріс'} байланыс`}
                {c.ttest && `; t = ${fmt(c.ttest.t, 2)}, t сыни = ${fmt(c.ttest.tCrit, 3)} (df = ${c.ttest.df}) — ${c.ttest.significant ? 'маңызды' : 'маңызды емес'}.`}
              </li>
            ))}
          </ul>
        </Sec>

        <Sec n={6} title="Регрессия теңдеуі">
          <ul className="space-y-1.5">
            {valid.map((c) => c.reg && (
              <li key={c.scope}><b>{c.label}:</b> <Tex>{eq(c.reg)}</Tex>, R² = {fmt(c.reg.r2, 3)}</li>
            ))}
          </ul>
          {focus.reg && (
            <figure className="mt-4">
              <ScatterPlot points={focusPoints} line={focus.reg} height={340} labels={false} xLabel={`x — ${FEATURE_PHRASE[rep.feature]}, %`} />
              <figcaption className="text-center text-sm text-ink-faint">{focus.label}: шашырау диаграммасы және регрессия түзуі</figcaption>
            </figure>
          )}
          <p className="mt-2 text-sm text-ink-soft">Еңіс коэффициенті a — БЖБ көрсеткіші 1 пайыздық тармаққа өскенде ТЖБ болжамы орта есеппен қаншаға өзгеретінін көрсетеді.</p>
        </Sec>

        <Sec n={7} title="Болжам әдістерінің салыстырылуы (Leave-One-Out)">
          <table className="w-full text-sm num">
            <thead><tr className="border-b border-grid-strong text-left text-ink-soft">
              <th className="py-1.5 pr-2">Сынып</th>{METHODS.map((m) => <th key={m} className="py-1.5 pr-2">{METHOD_LABEL[m]}, MAE / RMSE</th>)}
            </tr></thead>
            <tbody>
              {valid.map((c) => c.loo && (
                <tr key={c.scope} className="border-b border-grid">
                  <td className="py-1.5 pr-2 font-semibold">{c.label}</td>
                  {METHODS.map((m) => (
                    <td key={m} className={`py-1.5 pr-2 ${c.loo!.best.includes(m) ? 'font-bold text-violet' : ''}`}>{fmt(c.loo!.scores[m].mae, 2)} / {fmt(c.loo!.scores[m].rmse, 2)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-sm text-ink-soft">Барлық қателер пайыздық тармақпен. Қалың қаріппен — осы сыныптағы ең кіші MAE.</p>
        </Sec>

        <Sec n={8} title="Модель дәлдігі">
          {focus.loo ? (
            <p>{focus.label} үшін регрессия моделі әр оқушыны модельден тыс қалдырып тексерілді. Орташа абсолют қате {fmt(focus.loo.scores.regression.mae, 2)} п.т., RMSE {fmt(focus.loo.scores.regression.rmse, 2)} п.т., ең үлкен қате {fmt(focus.loo.scores.regression.maxAbs, 2)} п.т. Яғни болжам нақты ТЖБ-дан орта есеппен шамамен {fmt(focus.loo.scores.regression.mae, 0)} пайыздық тармаққа ауытқиды.</p>
          ) : <p>{focus.label}: дәлдікті тексеруге деректер жеткіліксіз.</p>}
        </Sec>

        <Sec n={9} title="Гипотезаға қатысты қорытынды">
          <ul className="space-y-2">{[...rep.classes, rep.all].map((c) => <li key={c.scope}>{hypothesisText(c)}</li>)}</ul>
        </Sec>

        <Sec n={10} title="Зерттеу шектеулері">
          <ul className="list-disc space-y-1 pl-5">
            <li>Таңдамалар шағын (әр сыныпта 5–7 оқушы), сондықтан коэффициенттер бір оқушының нәтижесіне сезімтал; қорытындыны басқа сыныптарға жалпылауға болмайды.</li>
            <li>Модельде бір ғана кіріс көрсеткіш бар; ТЖБ-ға әсер ететін басқа факторлар (тақырып күрделілігі, қатысу, т.б.) ескерілмеген.</li>
            <li>Сыныптарды біріктіргенде әртүрлі пәндік мазмұн мен бағалау критерийлері бір шкалаға келтіріледі.</li>
            {rep.classes.some((c) => c.missing.length) && <li>Кейбір жұмыстардың ең жоғары баллы расталмаған, сондықтан олар модельге кірмеді.</li>}
            <li>Тәуекел шектері зерттеу үшін шартты түрде таңдалған, ресми норматив емес.</li>
          </ul>
        </Sec>

        <Sec n={11} title="Практикалық ұсыныстар">
          <ul className="list-disc space-y-1 pl-5">
            <li>БЖБ нәтижелерін тоқсан ішінде пайызбен бақылап, ТЖБ-ға дейін болжам жасау; болжамы төмен оқушыларға ерте қолдау жоспарлау.</li>
            <li>Ағымдағы параметрлер бойынша: {RISK_LABEL.support.toLowerCase()} — {focus.risk.support}, {RISK_LABEL.attention.toLowerCase()} — {focus.risk.attention}, {RISK_LABEL.stable.toLowerCase()} — {focus.risk.stable} оқушы ({focus.label}).</li>
            <li>Модельден күрт ауытқыған нәтижелерді (үлкен қалдықтар) қайта тексеру: бағалаудағы қате немесе ерекше жағдай болуы мүмкін.</li>
            <li>Қолдау көрсетілгеннен кейін нақты ТЖБ-ны болжаммен салыстырып, әсерді жаңа деректермен тексеру.</li>
            <li>Модельді жаңа тоқсандар мен сыныптардың деректерімен толықтырып, тұрақтылығын қайта бағалау.</li>
          </ul>
        </Sec>
      </div>
      {valid.length === 0 && <div className="mt-4"><Notice tone="error">Қорытынды жасау үшін кемінде бір сыныпта 3 толық жазба қажет.</Notice></div>}
    </article>
  );
}

function Sec({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="report-section mt-7 leading-relaxed text-ink">
      <h2 className="mb-2 font-display text-lg font-bold text-ink"><span className="mr-2 text-blue num">{n}.</span>{title}</h2>
      <div className="text-[0.97rem] text-ink-soft [&_b]:text-ink">{children}</div>
    </section>
  );
}
