import { Bar, BarChart, CartesianGrid, ErrorBar, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell, ReferenceLine } from 'recharts';
import { motion } from 'framer-motion';
import { C } from './ui';
import { fmt } from '../lib/stats';

const tooltipStyle = { borderRadius: 10, border: `1px solid ${C.gridStrong}`, fontSize: 13, color: C.ink };
const tickStyle = { fill: C.soft, fontSize: 12 };

export function ChartFrame({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <figure className="panel p-5">
      <figcaption className="mb-3">
        <div className="font-display text-base font-bold text-ink">{title}</div>
        {sub && <div className="mt-0.5 text-sm text-ink-faint">{sub}</div>}
      </figcaption>
      {children}
    </figure>
  );
}

/** Әр оқушы бойынша топтастырылған бағандар. */
export function GroupedBars({ data, series, unit, yMax }: { data: Record<string, any>[]; series: { key: string; name: string; color: string }[]; unit: string; yMax?: number }) {
  return (
    <div className="h-72">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 18 }} barCategoryGap="22%">
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="label" tick={tickStyle} tickLine={false} axisLine={{ stroke: C.gridStrong }} label={{ value: 'Оқушы коды', position: 'insideBottom', offset: -12, fill: C.soft, fontSize: 12 }} />
          <YAxis tick={tickStyle} tickLine={false} axisLine={false} domain={[0, yMax ?? 'auto']} label={{ value: unit, angle: -90, position: 'insideLeft', fill: C.soft, fontSize: 12, dy: 30 }} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [fmt(Number(v), 1), undefined]} cursor={{ fill: '#eaf0fc66' }} />
          <Legend verticalAlign="top" height={30} iconType="circle" />
          {series.map((s) => <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[4, 4, 0, 0]} />)}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Жиілік үлестірімі (гистограмма). */
export function Histogram({ bins, unit, color = C.blue }: { bins: { label: string; count: number }[]; unit: string; color?: string }) {
  return (
    <div className="h-64">
      <ResponsiveContainer>
        <BarChart data={bins} margin={{ top: 8, right: 8, left: 4, bottom: 18 }} barCategoryGap={2}>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="label" tick={{ ...tickStyle, fontSize: 11 }} tickLine={false} axisLine={{ stroke: C.gridStrong }} label={{ value: unit, position: 'insideBottom', offset: -12, fill: C.soft, fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={tickStyle} tickLine={false} axisLine={false} label={{ value: 'Оқушы саны', angle: -90, position: 'insideLeft', fill: C.soft, fontSize: 12, dy: 40 }} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [v, 'оқушы саны']} cursor={{ fill: '#eaf0fc66' }} />
          <Bar dataKey="count" fill={color} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Сыныптардың орташа мәндері ± стандартты ауытқу. */
export function MeansChart({ data }: { data: { label: string; bjb: number | null; bjbSd: number | null; tjb: number | null; tjbSd: number | null }[] }) {
  return (
    <div className="h-72">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 4 }} barCategoryGap="28%">
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="label" tick={tickStyle} tickLine={false} axisLine={{ stroke: C.gridStrong }} />
          <YAxis domain={[0, 100]} tick={tickStyle} tickLine={false} axisLine={false} label={{ value: 'Орташа, %', angle: -90, position: 'insideLeft', fill: C.soft, fontSize: 12, dy: 30 }} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [v === null ? 'деректер жоқ' : `${fmt(Number(v), 1)}%`, undefined]} cursor={{ fill: '#eaf0fc66' }} />
          <Legend verticalAlign="top" height={30} iconType="circle" />
          <Bar dataKey="bjb" name="БЖБ орташа %" fill={C.blue} radius={[4, 4, 0, 0]}>
            <ErrorBar dataKey="bjbSd" width={6} stroke={C.ink} strokeWidth={1.2} />
          </Bar>
          <Bar dataKey="tjb" name="ТЖБ %" fill={C.teal} radius={[4, 4, 0, 0]}>
            <ErrorBar dataKey="tjbSd" width={6} stroke={C.ink} strokeWidth={1.2} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Стандартты ауытқуды көрсету: мәндер нүктелері, орташа және ±σ, ±2σ жолақтары. */
export function SpreadStrip({ values, mean, sd, unit, color = C.blue, domain }: { values: { label: string; v: number }[]; mean: number | null; sd: number | null; unit: string; color?: string; domain: [number, number] }) {
  const W = 640, H = 150, ml = 20, mr = 20;
  const [d0, d1] = domain;
  const sx = (v: number) => ml + ((Math.max(d0, Math.min(d1, v)) - d0) / (d1 - d0 || 1)) * (W - ml - mr);
  const cy = 70;
  const ticks: number[] = [];
  const step = (d1 - d0) / 5;
  for (let i = 0; i <= 5; i++) ticks.push(d0 + i * step);
  // бірдей мәндерді тігінен тарату
  const seen = new Map<number, number>();
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Мәндердің орташадан ауытқуы">
      {mean !== null && sd !== null && (
        <>
          <motion.rect initial={{ opacity: 0 }} animate={{ opacity: 1, x: sx(mean - 2 * sd), width: sx(mean + 2 * sd) - sx(mean - 2 * sd) }} y={cy - 34} height={68} fill={color} fillOpacity={0.07} rx={8} />
          <motion.rect initial={{ opacity: 0 }} animate={{ opacity: 1, x: sx(mean - sd), width: sx(mean + sd) - sx(mean - sd) }} y={cy - 34} height={68} fill={color} fillOpacity={0.16} rx={8} />
          <motion.line animate={{ x1: sx(mean), x2: sx(mean) }} y1={cy - 42} y2={cy + 42} stroke={C.ink} strokeWidth={2} />
          <text x={sx(mean)} y={cy - 48} textAnchor="middle" fontSize={12} fill={C.ink} fontWeight={600}>x̄ = {fmt(mean, 1)}</text>
          <text x={sx(mean + sd)} y={cy + 52} textAnchor="middle" fontSize={11} fill={C.soft}>+σ</text>
          <text x={sx(mean - sd)} y={cy + 52} textAnchor="middle" fontSize={11} fill={C.soft}>−σ</text>
        </>
      )}
      <line x1={ml} x2={W - mr} y1={cy} y2={cy} stroke={C.gridStrong} />
      {values.map((p) => {
        const key = Math.round(p.v * 10);
        const k = seen.get(key) ?? 0;
        seen.set(key, k + 1);
        const off = (k % 2 === 0 ? -1 : 1) * Math.ceil(k / 2) * 13;
        return (
          <motion.circle key={p.label} animate={{ cx: sx(p.v), cy: cy + off }} r={6} fill={color} stroke="white" strokeWidth={1.5}>
            <title>{`${p.label}: ${fmt(p.v, 1)} ${unit}`}</title>
          </motion.circle>
        );
      })}
      {ticks.map((t) => (
        <text key={t} x={sx(t)} y={H - 6} textAnchor="middle" fontSize={11} fill={C.faint} className="num">{fmt(t, 0)}</text>
      ))}
    </svg>
  );
}

/** Үш әдістің қателері. */
export function MethodBars({ data, best }: { data: { name: string; mae: number | null; rmse: number | null; maxAbs: number | null; id: string }[]; best: string[] }) {
  const colors: Record<string, string> = { mean: C.faint, naive: C.blue, regression: C.violet };
  return (
    <div className="h-80">
      <ResponsiveContainer>
        <BarChart data={[
          { metric: 'MAE', ...Object.fromEntries(data.map((d) => [d.id, d.mae])) },
          { metric: 'RMSE', ...Object.fromEntries(data.map((d) => [d.id, d.rmse])) },
          { metric: 'Ең үлкен қате', ...Object.fromEntries(data.map((d) => [d.id, d.maxAbs])) },
        ]} margin={{ top: 8, right: 8, left: 4, bottom: 4 }} barCategoryGap="20%">
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="metric" tick={tickStyle} tickLine={false} axisLine={{ stroke: C.gridStrong }} />
          <YAxis tick={tickStyle} tickLine={false} axisLine={false} label={{ value: 'Қате, пайыздық тармақ', angle: -90, position: 'insideLeft', fill: C.soft, fontSize: 12, dy: 70 }} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [v === null ? '—' : `${fmt(Number(v), 2)} п.т.`, undefined]} cursor={{ fill: '#eaf0fc66' }} />
          <Legend verticalAlign="top" height={30} iconType="circle" />
          {data.map((d) => (
            <Bar key={d.id} dataKey={d.id} name={d.name + (best.includes(d.id) ? ' ★' : '')} fill={colors[d.id]} radius={[4, 4, 0, 0]}>
              {[0, 1, 2].map((i) => <Cell key={i} fillOpacity={best.includes(d.id) ? 1 : 0.55} />)}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Әр оқушы бойынша болжам қатесі (LOO). */
export function ErrorByStudent({ data }: { data: { label: string; mean: number | null; naive: number | null; regression: number | null }[] }) {
  return (
    <div className="h-72">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 18 }} barCategoryGap="18%">
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="label" tick={tickStyle} tickLine={false} axisLine={{ stroke: C.gridStrong }} label={{ value: 'Тексерілген оқушы', position: 'insideBottom', offset: -12, fill: C.soft, fontSize: 12 }} />
          <YAxis tick={tickStyle} tickLine={false} axisLine={false} label={{ value: 'Қате (ŷ − y), п.т.', angle: -90, position: 'insideLeft', fill: C.soft, fontSize: 12, dy: 60 }} />
          <ReferenceLine y={0} stroke={C.soft} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [v === null ? '—' : `${fmt(Number(v), 1)} п.т.`, undefined]} cursor={{ fill: '#eaf0fc66' }} />
          <Legend verticalAlign="top" height={30} iconType="circle" />
          <Bar dataKey="mean" name="1-әдіс: Орташа" fill={C.faint} radius={[3, 3, 3, 3]} />
          <Bar dataKey="naive" name="2-әдіс: БЖБ %" fill={C.blue} radius={[3, 3, 3, 3]} />
          <Bar dataKey="regression" name="3-әдіс: Регрессия" fill={C.violet} radius={[3, 3, 3, 3]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
