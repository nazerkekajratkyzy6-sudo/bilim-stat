import { useMemo } from 'react';
import { useStore } from '../store';
import { assessRisk, DEFAULT_THRESHOLDS, RISK_LABEL, scopeModel, type RiskAssessment, type RiskLevel } from '../lib/model';
import { fmt } from '../lib/stats';
import { Notice, PageHeader, ScopeControls, SmallSampleNote } from '../components/ui';

export const LEVEL_STYLE: Record<RiskLevel, string> = {
  stable: 'border-teal/40 bg-teal-wash text-teal',
  attention: 'border-amber/40 bg-amber-wash text-amber',
  support: 'border-rose/40 bg-rose-wash text-rose',
  unknown: 'border-grid-strong bg-paper text-ink-faint',
};

const SIGNAL_NAME = { low: 'Төмен болжам', drop: 'БЖБ арасындағы төмендеу', unstable: 'Нәтиженің тұрақсыздығы' } as const;

export function useRisk() {
  const { data, settings } = useStore();
  const { scope, feature, thresholds } = settings;
  return useMemo(() => {
    const { rows, points } = scopeModel(data, scope, feature);
    return { rows, points, risks: rows.map((r) => assessRisk(r, points, thresholds)) };
  }, [data, scope, feature, thresholds]);
}

export default function RiskPage() {
  const { settings, setSettings } = useStore();
  const th = settings.thresholds;
  const { risks, points } = useRisk();
  const counts = (['stable', 'attention', 'support', 'unknown'] as RiskLevel[]).map((l) => ({ l, n: risks.filter((r) => r.level === l).length }));
  const label = (r: RiskAssessment) => (settings.scope === 'all' ? `${r.classId}·${r.code}` : r.code);

  const Th = ({ k, title, unit, min, max }: { k: keyof typeof th; title: string; unit: string; min: number; max: number }) => (
    <label className="block">
      <span className="text-sm text-ink-soft">{title}</span>
      <div className="mt-1.5 flex items-center gap-3">
        <input type="range" min={min} max={max} step={1} value={th[k]} onChange={(e) => setSettings({ thresholds: { ...th, [k]: Number(e.target.value) } })} className="flex-1" aria-label={title} />
        <span className="w-16 text-right font-semibold text-ink num">{th[k]} {unit}</span>
      </div>
    </label>
  );

  return (
    <div>
      <PageHeader
        step={6}
        title="Оқу тәуекелін бағалау"
        lead="Мөлдір сигналдар жүйесі: әр ескертудің математикалық негізі көрсетіледі. Бұл диагноз емес және оқушының қабілеті туралы қорытынды емес — тек қосымша назар аударуға болатын нәтижелерді белгілеу."
      />
      <div className="panel mb-6 p-4"><ScopeControls /></div>

      <section className="panel mb-6 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-bold text-ink">Шекті мәндер</h2>
          <button onClick={() => setSettings({ thresholds: DEFAULT_THRESHOLDS })} className="text-sm font-medium text-blue hover:underline">Әдепкі мәндерге қайтару</button>
        </div>
        <p className="mt-1 text-sm text-ink-faint">Бұл — зерттеу үшін таңдалған шартты шектер, ресми норматив емес. Оларды өзгертіп, нәтиженің шекке қаншалықты тәуелді екенін көруге болады.</p>
        <div className="mt-4 grid gap-5 md:grid-cols-3">
          <Th k="lowPrediction" title="Төмен болжам: ŷ осыдан төмен" unit="%" min={30} max={90} />
          <Th k="drop" title="Қатарлас БЖБ арасындағы төмендеу" unit="п.т." min={1} max={40} />
          <Th k="instability" title="Оқушының БЖБ пайыздарының σ-сы" unit="п.т." min={1} max={30} />
        </div>
        <p className="mt-4 text-sm text-ink-soft">Деңгей белсенді сигналдар санымен анықталады: 0 — тұрақты нәтиже, 1 — назар аудару қажет, 2 немесе 3 — қосымша қолдау ұсынылады.</p>
      </section>

      <div className="mb-6 flex flex-wrap gap-3">
        {counts.filter((c) => c.l !== 'unknown' || c.n > 0).map((c) => (
          <div key={c.l} className={`rounded-xl border px-4 py-2.5 ${LEVEL_STYLE[c.l]}`}>
            <span className="font-display text-2xl font-bold num">{c.n}</span>
            <span className="ml-2 text-sm font-medium">{RISK_LABEL[c.l]}</span>
          </div>
        ))}
      </div>

      <div className="mb-6 space-y-3">
        <SmallSampleNote n={points.length} />
        <Notice tone="info" title="Сигналдар қалай есептеледі">
          Болжам оқушының өзінсіз құрылған регрессия моделімен жасалады. Тұрақсыздық — оқушының БЖБ пайыздарының генералдық стандартты ауытқуы (екі БЖБ үшін σ = |БЖБ₁ − БЖБ₂| / 2). Төмендеу сигналы тек нәтиже азайғанда іске қосылады, ал тұрақсыздық өзгерістің бағытына қарамайды.
        </Notice>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {risks.map((r) => (
          <article key={r.id} className="panel p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="font-display text-xl font-bold text-ink">{label(r)}</div>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${LEVEL_STYLE[r.level]}`}>{RISK_LABEL[r.level]}</span>
            </div>
            <ul className="mt-4 space-y-2.5">
              {r.signals.map((s) => (
                <li key={s.key} className="flex gap-3 text-sm">
                  <span aria-hidden className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${s.active === null ? 'bg-grid-strong' : s.active ? 'bg-rose' : 'bg-teal'}`} />
                  <div>
                    <div className="font-medium text-ink">{SIGNAL_NAME[s.key]}{s.active === null ? '' : s.active ? ' — иә' : ' — жоқ'}</div>
                    <div className="text-ink-faint num">{s.basis}</div>
                  </div>
                </li>
              ))}
            </ul>
            {r.prediction?.clipped && <p className="mt-3 text-xs text-amber">Болжамның бастапқы мәні {fmt(r.prediction.raw, 1)}% — 0–100%-ға шектелді.</p>}
          </article>
        ))}
      </section>
    </div>
  );
}
