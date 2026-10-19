import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { featureValue, leaveOneOut, predictWithout, RISK_LABEL, FEATURE_PHRASE } from '../lib/model';
import { fmt, fmtSigned, mean, toPercent } from '../lib/stats';
import { Metric, Notice, PageHeader, ScopeControls, Segmented, Tex, tx, txs } from '../components/ui';
import { useRisk, LEVEL_STYLE } from './RiskPage';

export default function OptimizePage() {
  const { data, settings } = useStore();
  const { feature, thresholds } = settings;
  const { rows, points, risks } = useRisk();
  const loo = useMemo(() => leaveOneOut(points), [points]);
  const [recheckTh, setRecheckTh] = useState(12);
  const code = (id: string) => {
    const r = rows.find((q) => q.rec.id === id)!;
    return settings.scope === 'all' ? `${r.rec.classId}·${r.rec.code}` : r.rec.code;
  };

  // 1. Қайта тексеру: модель қатесі үлкен немесе деректерде қате бар
  const recheck = [
    ...loo.folds.filter((f) => f.preds.regression && Math.abs(f.y - f.preds.regression.value) > recheckTh).map((f) => ({
      id: f.id,
      why: `нақты ТЖБ ${fmt(f.y, 1)}%, болжам ${fmt(f.preds.regression!.value, 1)}% — айырма ${fmtSigned(f.y - f.preds.regression!.value, 1)} п.т.`,
    })),
    ...rows.filter((r) => r.issues.some((i) => i.level === 'error')).map((r) => ({ id: r.rec.id, why: r.issues.filter((i) => i.level === 'error').map((i) => i.text).join('; ') })),
  ];
  // 2. Қосымша түсіндіру: тәуекел деңгейі
  const support = risks.filter((r) => r.level === 'support' || r.level === 'attention');
  // 3. Қайта диагностика: болжам шекке жақын (±5 п.т.) немесе БЖБ төмендеген
  const rediag = risks.filter((r) => {
    const p = r.prediction?.value;
    const drop = r.signals.find((s) => s.key === 'drop');
    return (p !== undefined && Math.abs(p - thresholds.lowPrediction) <= 5) || drop?.active;
  });

  /* ───── Сценарий ───── */
  const usable = rows.filter((r) => r.x !== null);
  const [selId, setSelId] = useState('');
  const sel = usable.find((r) => r.rec.id === selId) ?? usable.find((r) => risks.find((q) => q.id === r.rec.id)?.level === 'support') ?? usable[0];
  const [gain, setGain] = useState(2);
  const lastIdx = sel ? sel.bjbPct.length - 1 : 0;
  const [slot, setSlot] = useState<number | null>(null);
  const s = sel ? Math.min(slot ?? lastIdx, lastIdx) : 0;

  let scenario: null | { oldX: number; newX: number; oldP: number; newP: number; raw: number; a: number; b: number; newScore: number; max: number; capped: boolean } = null;
  if (sel) {
    const sc = sel.rec.bjb[s];
    if (sc.score !== null && sc.max) {
      const newScore = Math.min(sc.max, sc.score + gain);
      const pct = sel.bjbPct.map((p, i) => (i === s ? toPercent(newScore, sc.max) : p));
      const newX = featureValue(pct, feature);
      const res = predictWithout(points, sel.rec.id, sel.x!);
      if (res.prediction && newX !== null && 'a' in res.model) {
        const nr = predictWithout(points, sel.rec.id, newX).prediction!;
        scenario = { oldX: sel.x!, newX, oldP: res.prediction.value, newP: nr.value, raw: nr.raw, a: res.model.a, b: res.model.b, newScore, max: sc.max, capped: sc.score + gain > sc.max };
      }
    }
  }

  return (
    <div>
      <PageHeader
        step={7}
        title="Білім сапасын оңтайландыру"
        lead="Есептеулер негізінде мұғалімге шешім қабылдауға көмектесетін ұсыныстар. Бұл — зерттеу құралы: соңғы шешімді мұғалім қабылдайды."
      />
      <div className="panel mb-6 p-4"><ScopeControls /></div>

      <section className="grid gap-5 lg:grid-cols-2">
        <Card title="Қайта тексеруге тұрарлық нәтижелер" lead={`Нақты ТЖБ мен болжам арасындағы айырма ${recheckTh} п.т.-тан артық немесе деректерде қате бар.`}>
          <label className="mb-3 flex items-center gap-3 text-sm text-ink-soft">Шек
            <input type="range" min={5} max={30} value={recheckTh} onChange={(e) => setRecheckTh(Number(e.target.value))} className="flex-1" aria-label="Қайта тексеру шегі" />
            <span className="w-14 font-semibold text-ink num">{recheckTh} п.т.</span>
          </label>
          <List items={recheck.map((r) => ({ key: r.id + r.why, title: code(r.id), text: r.why }))} empty="Модельден күрт ауытқыған нәтиже жоқ." />
        </Card>
        <Card title="Қосымша түсіндіру ұйымдастыруға болатын оқушылар" lead="Тәуекел сигналдары бойынша «назар аудару қажет» немесе «қосымша қолдау ұсынылады» деңгейі.">
          <List items={support.map((r) => ({ key: r.id, title: code(r.id), badge: r.level, text: r.signals.filter((x) => x.active).map((x) => x.basis).join('; ') }))} empty="Сигналы бар оқушы жоқ." />
        </Card>
        <Card title="Қайта диагностика пайдалы болатын жағдайлар" lead={`Болжам шекке жақын (${thresholds.lowPrediction} ± 5%) немесе БЖБ нәтижесі төмендеген: бір өлшемге сүйенбей, қосымша тексеру қажет.`}>
          <List items={rediag.map((r) => ({ key: r.id, title: code(r.id), text: [r.prediction ? `болжам ${fmt(r.prediction.value, 1)}%` : null, r.signals.find((x) => x.key === 'drop')?.active ? r.signals.find((x) => x.key === 'drop')!.basis : null].filter(Boolean).join('; ') }))} empty="Шекаралық жағдайлар жоқ." />
        </Card>
        <Card title="Қолдаудан кейін нені бақылау керек" lead="Қолдаудың әсерін бағалау үшін бастапқы мәндерді сақтап, келесі БЖБ мен ТЖБ-дан кейін салыстыру қажет.">
          <ul className="space-y-2 text-sm text-ink-soft">
            <li>• Келесі БЖБ пайызының өзгерісі (x бойынша бастапқы мән төменде көрсетілген).</li>
            <li>• Нақты ТЖБ мен осы модельдің болжамы арасындағы айырма: қолдау болжамнан жоғары нәтижеге әкелді ме?</li>
            <li>• Сыныптағы стандартты ауытқу: нәтижелердің шашырауы азайды ма?</li>
            <li>• Салыстыру үшін қолдау көрсетілмеген оқушылардың нәтижесі қалай өзгергенін де қараңыз.</li>
          </ul>
          <p className="mt-3 text-sm text-ink-faint">Сынып бойынша бастапқы мән: x̄ = {fmt(mean(points.map((p) => p.x)), 1)}%, ТЖБ орташасы = {fmt(mean(points.map((p) => p.y)), 1)}%.</p>
        </Card>
      </section>

      <section className="mt-8 rounded-[14px] border border-violet/25 bg-violet-wash p-6">
        <h2 className="font-display text-2xl font-bold text-ink">Егер қосымша қолдау көрсетілсе…</h2>
        <p className="mt-2 max-w-3xl text-ink-soft">Оқушының БЖБ баллы жоспарланған мөлшерге өссе, модель ТЖБ болжамын қалай өзгертетінін есептейміз.</p>
        <div className="mt-3"><Notice tone="warn" title="Бұл — математикалық сценарий">Есептеу қосымша сабақ нәтижені міндетті түрде көтеретінін дәлелдемейді. Ол тек «БЖБ осындай болса, модель нені болжайды» деген сұраққа жауап береді.</Notice></div>

        {sel && (
          <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <div className="space-y-4">
              <label className="block text-sm text-ink-soft">Оқушы
                <select className="field ml-2 text-ink" value={sel.rec.id} onChange={(e) => setSelId(e.target.value)}>
                  {usable.map((r) => {
                    const lv = risks.find((q) => q.id === r.rec.id)?.level;
                    return <option key={r.rec.id} value={r.rec.id}>{code(r.rec.id)}{lv ? ` — ${RISK_LABEL[lv]}` : ''}</option>;
                  })}
                </select>
              </label>
              {sel.bjbPct.length > 1 && (
                <div className="text-sm text-ink-soft">Қай БЖБ жақсарады
                  <div className="mt-1.5"><Segmented label="БЖБ" value={String(s)} onChange={(v) => setSlot(Number(v))} options={sel.bjbPct.map((_, i) => ({ value: String(i), label: `БЖБ ${i + 1}` }))} /></div>
                </div>
              )}
              <label className="block text-sm text-ink-soft" htmlFor="gain">Болжамды жақсару: <b className="text-ink num">+{gain}</b> балл</label>
              <input id="gain" type="range" min={0} max={sel.rec.bjb[s].max ?? 10} value={gain} onChange={(e) => setGain(Number(e.target.value))} className="w-full" />
              <p className="text-xs text-ink-faint">Кіріс көрсеткіш: {FEATURE_PHRASE[feature]}. Модель оқушының өзінсіз құрылады.</p>
            </div>
            {scenario ? (
              <div className="rounded-xl border border-violet/20 bg-white p-5">
                <div className="grid grid-cols-3 gap-3">
                  <Metric label="БЖБ балл" value={scenario.newScore} digits={0} hint={`${sel.rec.bjb[s].score} → ${scenario.newScore} / ${scenario.max}`} />
                  <Metric label="x" value={scenario.newX} digits={1} suffix="%" hint={`бұрын ${fmt(scenario.oldX, 1)}%`} accent="blue" />
                  <Metric label="ТЖБ болжамы" value={scenario.newP} digits={1} suffix="%" hint={`бұрын ${fmt(scenario.oldP, 1)}%`} accent="violet" />
                </div>
                <div className="mt-4 text-[0.95rem]">
                  <Tex block>{`\\Delta\\hat y = a\\cdot\\Delta x = ${txs(scenario.a, 3)}\\cdot ${txs(scenario.newX - scenario.oldX, 2)} = ${txs(scenario.a * (scenario.newX - scenario.oldX), 2)}\\ \\text{п.т.}`}</Tex>
                </div>
                <p className="mt-2 text-sm text-ink-soft">
                  Болжамның өзгерісі: <b className="text-violet num">{fmtSigned(scenario.newP - scenario.oldP, 1)} п.т.</b>
                  {Math.abs(scenario.newP - scenario.oldP - scenario.a * (scenario.newX - scenario.oldX)) > 0.01 && ' (болжам 0–100%-ға шектелгендіктен айырма формуладан ерекшеленеді)'}
                </p>
                {scenario.capped && <p className="mt-2 text-sm text-amber">Балл ең жоғары баллмен ({scenario.max}) шектелді.</p>}
                {scenario.raw > 100 && <p className="mt-2 text-sm text-amber">Модельдің бастапқы мәні {fmt(scenario.raw, 1)}% — 100%-ға шектелді.</p>}
                <p className="mt-3 text-xs text-ink-faint">Формула: <Tex>{`\\hat y = ${tx(scenario.a, 3)}x ${scenario.b < 0 ? '-' : '+'} ${tx(Math.abs(scenario.b), 2)}`}</Tex></p>
              </div>
            ) : (
              <Notice tone="warn">Бұл оқушы үшін сценарийді есептеу мүмкін емес: балл, ең жоғары балл немесе модель жоқ.</Notice>
            )}
          </div>
        )}
      </section>
      {data.records.length === 0 && <Notice tone="error">Деректер жоқ.</Notice>}
    </div>
  );
}

function Card({ title, lead, children }: { title: string; lead: string; children: React.ReactNode }) {
  return (
    <div className="panel p-5">
      <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
      <p className="mb-4 mt-1 text-sm text-ink-faint">{lead}</p>
      {children}
    </div>
  );
}

function List({ items, empty }: { items: { key: string; title: string; text: string; badge?: keyof typeof LEVEL_STYLE }[]; empty: string }) {
  if (!items.length) return <p className="text-sm text-ink-soft">{empty}</p>;
  return (
    <ul className="space-y-2">
      {items.map((i) => (
        <li key={i.key} className="flex gap-3 rounded-lg bg-paper px-3 py-2 text-sm">
          <span className="w-14 shrink-0 font-semibold text-ink">{i.title}</span>
          <span className="flex-1 text-ink-soft num">{i.text}</span>
          {i.badge && <span className={`h-fit shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${LEVEL_STYLE[i.badge]}`}>{RISK_LABEL[i.badge]}</span>}
        </li>
      ))}
    </ul>
  );
}
