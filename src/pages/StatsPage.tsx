import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { deriveScope, SCOPE_LABEL, CLASS_IDS, modelPoints, type DerivedRow, FEATURE_PHRASE } from '../lib/model';
import { describe, fmt, isFail, pearson, mean as meanOf, type Describe, type PearsonResult } from '../lib/stats';
import { C, Metric, Notice, PageHeader, Reveal, ScopeControls, Segmented, SmallSampleNote, Tex, tx } from '../components/ui';
import { ChartFrame, GroupedBars, Histogram, MeansChart, SpreadStrip } from '../components/charts';
import { ScatterPlot, PlotLegend } from '../components/ScatterPlot';

type Unit = 'pct' | 'raw';
type VarId = 'b0' | 'b1' | 'b2' | 'tjb';

function values(rows: DerivedRow[], v: VarId, unit: Unit): { label: string; v: number | null }[] {
  return rows.map((r) => {
    const label = r.rec.classId && rows.some((q) => q.rec.classId !== r.rec.classId) ? `${r.rec.classId}·${r.rec.code}` : r.rec.code;
    if (v === 'tjb') return { label, v: unit === 'pct' ? r.tjbPct : r.rec.tjb.score };
    const i = Number(v[1]);
    return { label, v: unit === 'pct' ? (r.bjbPct[i] ?? null) : r.rec.bjb[i].score };
  });
}

export default function StatsPage() {
  const { data, settings, setSettings } = useStore();
  const { scope, varianceKind: vk, feature } = settings;
  const rows = useMemo(() => deriveScope(data, scope, feature), [data, scope, feature]);
  const maxBjb = scope === 'all' ? 2 : data.classes[scope].bjbCount;
  const [unitSel, setUnit] = useState<Unit>('pct');
  const unit: Unit = scope === 'all' ? 'pct' : unitSel;
  const [varId, setVarId] = useState<VarId>('tjb');
  const vId: VarId = varId !== 'tjb' && Number(varId[1]) >= maxBjb ? 'tjb' : varId;
  const varIds: VarId[] = [...(['b0', 'b1', 'b2'] as VarId[]).slice(0, maxBjb), 'tjb'];
  const varName = (v: VarId) => (v === 'tjb' ? 'ТЖБ' : `БЖБ ${Number(v[1]) + 1}`);
  const unitLabel = unit === 'pct' ? '%' : 'балл';

  const vals = values(rows, vId, unit);
  const clean = vals.filter((p) => p.v !== null) as { label: string; v: number }[];
  const d = describe(clean.map((p) => p.v), vk);
  const missingCount = vals.length - clean.length;

  const table = varIds.map((v) => ({ v, d: describe(values(rows, v, unit).map((p) => p.v), vk) }));

  const points = modelPoints(rows);
  const corr = pearson(points);

  // Гистограмма: пайыз үшін 10%-дық аралықтар, балл үшін бүтін аралықтар
  const bins = useMemo(() => {
    if (!clean.length) return [];
    if (unit === 'pct') {
      const lo = Math.min(50, Math.floor(Math.min(...clean.map((p) => p.v)) / 10) * 10);
      const out: { label: string; count: number }[] = [];
      for (let a = lo; a < 100; a += 10) {
        const b = a + 10;
        out.push({ label: `${a}–${b}`, count: clean.filter((p) => p.v >= a && (b === 100 ? p.v <= 100 : p.v < b)).length });
      }
      return out;
    }
    const mn = Math.floor(Math.min(...clean.map((p) => p.v)));
    const mx = Math.ceil(Math.max(...clean.map((p) => p.v)));
    const w = Math.max(1, Math.ceil((mx - mn + 1) / 8));
    const out: { label: string; count: number }[] = [];
    for (let a = mn; a <= mx; a += w) out.push({ label: w === 1 ? `${a}` : `${a}–${a + w - 1}`, count: clean.filter((p) => p.v >= a && p.v < a + w).length });
    return out;
  }, [clean, unit]);

  const grouped = rows.map((r) => {
    const o: Record<string, any> = { label: scope === 'all' ? `${r.rec.classId}·${r.rec.code}` : r.rec.code };
    for (let i = 0; i < maxBjb; i++) o[`b${i}`] = unit === 'pct' ? r.bjbPct[i] : r.rec.bjb[i].score;
    o.tjb = unit === 'pct' ? r.tjbPct : r.rec.tjb.score;
    return o;
  });

  const classMeans = CLASS_IDS.map((c) => {
    const rr = deriveScope(data, c, 'mean');
    const bj = describe(rr.map((r) => r.x), vk);
    const tj = describe(rr.map((r) => r.tjbPct), vk);
    return { label: SCOPE_LABEL[c], bjb: bj.mean, bjbSd: bj.sd, tjb: tj.mean, tjbSd: tj.sd };
  });

  const blues = [C.sky, C.blue, '#173f8f'];
  const domain: [number, number] = unit === 'pct'
    ? [Math.min(40, Math.floor((d.min ?? 40) / 10) * 10), 100]
    : [Math.floor(Math.min(d.min ?? 0, (d.mean ?? 0) - 2 * (d.sd ?? 0))), Math.ceil(Math.max(d.max ?? 1, (d.mean ?? 0) + 2 * (d.sd ?? 0)))];

  return (
    <div>
      <PageHeader
        step={2}
        title="Статистикалық талдау"
        lead="Таңдалған көрсеткіштің орталық мәндері мен шашырауы. Барлық көрсеткіштер деректер өзгерген сайын қайта есептеледі."
      />

      <div className="panel mb-6 flex flex-col gap-4 p-4">
        <ScopeControls showFeature={false} />
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <span className="font-medium">Көрсеткіш</span>
            <Segmented label="Көрсеткіш" value={vId} onChange={setVarId} options={varIds.map((v) => ({ value: v, label: varName(v) }))} />
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <span className="font-medium">Өлшем</span>
            <Segmented label="Өлшем бірлігі" value={unit} onChange={setUnit} options={scope === 'all' ? [{ value: 'pct', label: 'Пайыз' }] : [{ value: 'pct', label: 'Пайыз' }, { value: 'raw', label: 'Балл' }]} />
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <span className="font-medium">Дисперсия</span>
            <Segmented
              label="Дисперсия түрі"
              value={vk}
              onChange={(v) => setSettings({ varianceKind: v })}
              options={[{ value: 'sample', label: 'Таңдамалы s², n−1' }, { value: 'population', label: 'Генералдық σ², n' }]}
            />
          </label>
        </div>
      </div>

      <div className="mb-6 space-y-3">
        <SmallSampleNote n={d.n} />
        {missingCount > 0 && (
          <Notice tone="warn" title={`${missingCount} мән есептеуге кірмеді`}>
            {unit === 'pct' ? 'Ең жоғары балл белгісіз немесе балл енгізілмеген. «Балл» өлшеміне ауысып, бастапқы баллдарды талдауға болады.' : 'Балл енгізілмеген.'}
          </Notice>
        )}
      </div>

      {d.n > 0 && (
        <section className="panel p-6">
          <h2 className="font-display text-xl font-bold text-ink">{SCOPE_LABEL[scope]}: {varName(vId)}, {unitLabel}</h2>
          <p className="mt-1 text-sm text-ink-faint">
            {vk === 'sample' ? 'Таңдамалы (түзетілген) дисперсия: бөлгіш n − 1. Сынып — үлкен жиынтықтан алынған таңдама ретінде қарастырылады.' : 'Генералдық дисперсия: бөлгіш n. Сынып — толық жиынтық ретінде қарастырылады.'}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
            <Metric label="Орташа мән, x̄" value={d.mean} accent="blue" />
            <Metric label="Медиана, Me" value={d.median} />
            <div>
              <div className="text-sm text-ink-soft">Мода, Mo</div>
              <div className="mt-0.5 font-display text-2xl font-bold text-ink num">{d.mode.values.length ? d.mode.values.map((v) => fmt(v, 2)).join('; ') : 'жоқ'}</div>
              <div className="mt-0.5 text-xs text-ink-faint">{d.mode.values.length ? `${d.mode.count} рет қайталанады` : 'барлық мән бір реттен кездеседі'}</div>
            </div>
            <Metric label={vk === 'sample' ? 'Дисперсия, s²' : 'Дисперсия, σ²'} value={d.variance} accent="violet" />
            <Metric label={vk === 'sample' ? 'Стандартты ауытқу, s' : 'Стандартты ауытқу, σ'} value={d.sd} accent="violet" />
            <Metric label="Вариация коэффициенті, V" value={d.cv} suffix="%" hint={d.cv === null ? undefined : d.cv < 10 ? 'шашырау аз (V < 10%)' : d.cv <= 33 ? 'шашырау орташа (10–33%)' : 'шашырау жоғары (V > 33%)'} />
            <Metric label="Ең төменгі" value={d.min} accent="teal" />
            <Metric label="Ең жоғары" value={d.max} accent="teal" />
          </div>
          <Reveal>
            <Calculation d={d} xs={clean.map((p) => p.v)} vk={vk} />
          </Reveal>
        </section>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <ChartFrame title="Стандартты ауытқу: мәндер орташадан қаншалықты алыс" sub={`Қою жолақ — x̄ ± ${vk === 'sample' ? 's' : 'σ'}, ашық жолақ — ±2${vk === 'sample' ? 's' : 'σ'}. Өлшем: ${unitLabel}.`}>
          <SpreadStrip values={clean} mean={d.mean} sd={d.sd} unit={unitLabel} domain={domain} color={vId === 'tjb' ? C.teal : C.blue} />
        </ChartFrame>
        <ChartFrame title={`Нәтижелердің үлестірімі: ${varName(vId)}`} sub="Әр аралыққа түскен оқушылар саны">
          <Histogram bins={bins} unit={unit === 'pct' ? 'Аралық, %' : 'Аралық, балл'} color={vId === 'tjb' ? C.teal : C.blue} />
        </ChartFrame>
      </div>

      <div className="mt-6">
        <ChartFrame title="Оқушылардың нәтижелері: БЖБ және ТЖБ" sub={unit === 'pct' ? 'Пайызбен салыстыру — әр жұмыстың ең жоғары баллы ескерілген' : 'Бастапқы баллдар (ең жоғары баллдар әртүрлі болуы мүмкін)'}>
          <GroupedBars data={grouped} unit={unit === 'pct' ? 'Нәтиже, %' : 'Балл'} yMax={unit === 'pct' ? 100 : undefined}
            series={[...Array.from({ length: maxBjb }, (_, i) => ({ key: `b${i}`, name: `БЖБ ${i + 1}`, color: blues[i] })), { key: 'tjb', name: 'ТЖБ', color: C.teal }]} />
        </ChartFrame>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <ChartFrame title="Шашырау диаграммасы: БЖБ → ТЖБ" sub={`x — ${FEATURE_PHRASE[feature]}, %; y — ТЖБ, %`}>
          {points.length ? (
            <>
              <ScatterPlot points={points.map((p) => ({ id: p.id, label: scope === 'all' ? `${p.classId}·${p.code}` : p.code, x: p.x, y: p.y }))} height={360} labels={scope !== 'all'} />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <PlotLegend items={[{ kind: 'point', label: 'оқушы' }, { kind: 'ref', label: 'ŷ = x' }]} />
                {!isFail(corr) && <span className="text-sm text-ink-soft">r = <b className="num text-ink">{fmt((corr as PearsonResult).r, 3)}</b></span>}
              </div>
            </>
          ) : (
            <Notice tone="warn">Шашырау диаграммасы үшін БЖБ пен ТЖБ пайыздары қажет.</Notice>
          )}
        </ChartFrame>
        <ChartFrame title="Сыныптардың орташа нәтижелері" sub={`Баған — орташа %, сызықша — ±${vk === 'sample' ? 's' : 'σ'}. БЖБ — оқушылардың БЖБ пайыздарының орташасы.`}>
          <MeansChart data={classMeans} />
        </ChartFrame>
      </div>

      <section className="panel mt-6 overflow-x-auto p-0">
        <div className="px-5 pt-5 font-display text-base font-bold text-ink">Барлық көрсеткіштер кестесі ({unitLabel})</div>
        <table className="mt-3 w-full min-w-[720px] text-sm num">
          <thead>
            <tr className="border-y border-grid-strong bg-paper text-left text-ink-soft">
              {['Көрсеткіш', 'n', 'x̄', 'Me', 'Mo', vk === 'sample' ? 's²' : 'σ²', vk === 'sample' ? 's' : 'σ', 'V, %', 'min', 'max'].map((h) => <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {table.map(({ v, d: t }) => (
              <tr key={v} className={`border-b border-grid last:border-0 ${v === vId ? 'bg-blue-wash/50' : ''}`}>
                <td className="px-4 py-2.5 font-semibold text-ink">{varName(v)}</td>
                <td className="px-4 py-2.5">{t.n}</td>
                <td className="px-4 py-2.5">{fmt(t.mean)}</td>
                <td className="px-4 py-2.5">{fmt(t.median)}</td>
                <td className="px-4 py-2.5">{t.mode.values.length ? t.mode.values.map((x) => fmt(x)).join('; ') : 'жоқ'}</td>
                <td className="px-4 py-2.5">{fmt(t.variance)}</td>
                <td className="px-4 py-2.5">{fmt(t.sd)}</td>
                <td className="px-4 py-2.5">{fmt(t.cv, 1)}</td>
                <td className="px-4 py-2.5">{fmt(t.min)}</td>
                <td className="px-4 py-2.5">{fmt(t.max)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Calculation({ d, xs, vk }: { d: Describe; xs: number[]; vk: 'sample' | 'population' }) {
  const n = d.n;
  const m = meanOf(xs)!;
  const list = xs.map((x) => tx(x, 2)).join(' + ');
  const devs = xs.map((x) => `(${tx(x, 2)} - ${tx(m, 2)})^2`);
  const shownDevs = devs.length > 4 ? `${devs.slice(0, 3).join(' + ')} + \\dots` : devs.join(' + ');
  const denom = vk === 'sample' ? 'n-1' : 'n';
  const denomV = vk === 'sample' ? n - 1 : n;
  const sym = vk === 'sample' ? 's' : '\\sigma';
  return (
    <div className="space-y-3 text-[0.95rem]">
      <div>
        <div className="font-semibold">Орташа мән</div>
        <Tex block>{`\\bar x = \\frac{1}{n}\\sum_{i=1}^{n} x_i = \\frac{${list}}{${n}} = ${tx(m, 4)}`}</Tex>
      </div>
      <div>
        <div className="font-semibold">Медиана</div>
        <p className="text-ink-soft">Мәндер өсу ретімен: {[...xs].sort((a, b) => a - b).map((x) => fmt(x, 2)).join('; ')}. {n % 2 ? `Ортадағы ${(n + 1) / 2}-мән` : `Ортадағы екі мәннің орташасы`}: <b className="text-ink num">{fmt(d.median, 4)}</b>.</p>
      </div>
      {d.variance !== null && (
        <div>
          <div className="font-semibold">Дисперсия ({vk === 'sample' ? 'таңдамалы' : 'генералдық'})</div>
          <Tex block>{`${sym}^2 = \\frac{\\sum (x_i - \\bar x)^2}{${denom}} = \\frac{${shownDevs}}{${denomV}} = \\frac{${tx(d.sumSq, 4)}}{${denomV}} = ${tx(d.variance, 4)}`}</Tex>
        </div>
      )}
      {d.sd !== null && (
        <div>
          <div className="font-semibold">Стандартты ауытқу және вариация коэффициенті</div>
          <Tex block>{`${sym} = \\sqrt{${tx(d.variance, 4)}} = ${tx(d.sd, 4)}, \\qquad V = \\frac{${sym}}{\\bar x}\\cdot 100\\% = \\frac{${tx(d.sd, 4)}}{${tx(m, 4)}}\\cdot 100\\% = ${tx(d.cv, 2)}\\%`}</Tex>
        </div>
      )}
    </div>
  );
}
