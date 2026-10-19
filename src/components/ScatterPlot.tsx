import { motion, useReducedMotion } from 'framer-motion';
import { C } from './ui';
import { fmt } from '../lib/stats';

export interface PlotPoint {
  id: string;
  label: string;
  x: number;
  y: number;
  excluded?: boolean;
  highlight?: boolean;
}

interface Props {
  points: PlotPoint[];
  line?: { a: number; b: number } | null;
  ghostLine?: { a: number; b: number } | null;
  ghostLabel?: string;
  prediction?: { x: number; y: number; raw?: number } | null;
  showResiduals?: boolean;
  xLabel?: string;
  yLabel?: string;
  height?: number;
  animateKey?: string | number;
  labels?: boolean;
  onPointClick?: (id: string) => void;
}

const W = 640;

/** Миллиметрлік қағаздағы шашырау диаграммасы + регрессия түзуі. */
export function ScatterPlot({
  points, line, ghostLine, ghostLabel, prediction, showResiduals, xLabel = 'x — БЖБ, %', yLabel = 'y — ТЖБ, %',
  height = 420, animateKey, labels = true, onPointClick,
}: Props) {
  const reduce = useReducedMotion();
  const H = height;
  const m = { l: 56, r: 20, t: 18, b: 52 };
  const all = [...points.map((p) => p.x), ...(prediction ? [prediction.x] : [])];
  const ally = [...points.map((p) => p.y), ...(prediction ? [prediction.y] : [])];
  const lo = (v: number[]) => (v.length ? Math.max(0, Math.floor((Math.min(...v) - 6) / 10) * 10) : 0);
  const x0 = Math.min(lo(all), 60), x1 = 100;
  const y0 = Math.min(lo(ally), 60), y1 = 100;
  const sx = (x: number) => m.l + ((x - x0) / (x1 - x0)) * (W - m.l - m.r);
  const sy = (y: number) => H - m.b - ((y - y0) / (y1 - y0)) * (H - m.t - m.b);

  const seg = (ln: { a: number; b: number }) => {
    // түзуді графиктің ішкі аймағына қиып алу: y0 ≤ a·x + b ≤ y1
    let xa = x0, xb = x1;
    if (Math.abs(ln.a) > 1e-12) {
      const u = (y0 - ln.b) / ln.a, v = (y1 - ln.b) / ln.a;
      xa = Math.max(x0, Math.min(u, v));
      xb = Math.min(x1, Math.max(u, v));
    }
    if (xa >= xb) xb = xa;
    const f = (x: number) => Math.max(y0, Math.min(y1, ln.a * x + ln.b));
    return { x1: sx(xa), y1: sy(f(xa)), x2: sx(xb), y2: sy(f(xb)) };
  };

  const ticksX: number[] = [];
  for (let v = x0; v <= x1; v += 10) ticksX.push(v);
  const ticksY: number[] = [];
  for (let v = y0; v <= y1; v += 10) ticksY.push(v);

  // Бірдей координатадағы нүктелердің белгілерін біріктіру
  const coordKey = (p: PlotPoint) => `${p.x.toFixed(3)}|${p.y.toFixed(3)}`;
  const groups = new Map<string, string[]>();
  for (const p of points) groups.set(coordKey(p), [...(groups.get(coordKey(p)) ?? []), p.label]);
  const labelFor = (p: PlotPoint) => {
    const g = groups.get(coordKey(p))!;
    return g[0] === p.label ? g.join(', ') : '';
  };

  const L = line ? seg(line) : null;
  const G = ghostLine ? seg(ghostLine) : null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full select-none" role="img" aria-label="БЖБ мен ТЖБ арасындағы шашырау диаграммасы және регрессия түзуі">
      {/* миллиметрлік тор */}
      {Array.from({ length: Math.round((x1 - x0) / 2) + 1 }, (_, i) => x0 + i * 2).map((v) => (
        <line key={`gx${v}`} x1={sx(v)} x2={sx(v)} y1={m.t} y2={H - m.b} stroke={v % 10 === 0 ? C.gridStrong : C.grid} strokeWidth={v % 10 === 0 ? 1 : 0.6} />
      ))}
      {Array.from({ length: Math.round((y1 - y0) / 2) + 1 }, (_, i) => y0 + i * 2).map((v) => (
        <line key={`gy${v}`} y1={sy(v)} y2={sy(v)} x1={m.l} x2={W - m.r} stroke={v % 10 === 0 ? C.gridStrong : C.grid} strokeWidth={v % 10 === 0 ? 1 : 0.6} />
      ))}
      {/* осьтер */}
      <line x1={m.l} x2={W - m.r} y1={H - m.b} y2={H - m.b} stroke={C.soft} strokeWidth={1.2} />
      <line x1={m.l} x2={m.l} y1={m.t} y2={H - m.b} stroke={C.soft} strokeWidth={1.2} />
      {ticksX.map((v) => (
        <text key={`tx${v}`} x={sx(v)} y={H - m.b + 18} textAnchor="middle" fontSize={12} fill={C.soft} className="num">{v}</text>
      ))}
      {ticksY.map((v) => (
        <text key={`ty${v}`} x={m.l - 8} y={sy(v) + 4} textAnchor="end" fontSize={12} fill={C.soft} className="num">{v}</text>
      ))}
      <text x={(m.l + W - m.r) / 2} y={H - 10} textAnchor="middle" fontSize={13} fill={C.ink} fontWeight={600}>{xLabel}</text>
      <text transform={`translate(16 ${(m.t + H - m.b) / 2}) rotate(-90)`} textAnchor="middle" fontSize={13} fill={C.ink} fontWeight={600}>{yLabel}</text>

      {/* ŷ = x (2-әдіс) сілтеме сызығы */}
      <line x1={sx(Math.max(x0, y0))} y1={sy(Math.max(x0, y0))} x2={sx(100)} y2={sy(100)} stroke={C.faint} strokeDasharray="2 5" strokeWidth={1} />

      {G && (
        <g>
          <line {...G} stroke={C.violet} strokeOpacity={0.35} strokeWidth={2} strokeDasharray="7 6" />
          {ghostLabel && <text x={G.x2 - 4} y={G.y2 + 16} textAnchor="end" fontSize={11} fill={C.violet} opacity={0.7}>{ghostLabel}</text>}
        </g>
      )}

      {showResiduals && line && points.filter((p) => !p.excluded).map((p) => {
        const yh = line.a * p.x + line.b;
        return <line key={`res${p.id}`} x1={sx(p.x)} x2={sx(p.x)} y1={sy(p.y)} y2={sy(Math.max(y0, Math.min(y1, yh)))} stroke={C.rose} strokeOpacity={0.55} strokeWidth={1.5} />;
      })}

      {L && (
        <motion.line
          key={`line-${animateKey ?? ''}`}
          x1={L.x1} y1={L.y1} x2={L.x2} y2={L.y2}
          stroke={C.violet}
          strokeWidth={3}
          strokeLinecap="round"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, ease: 'easeInOut', delay: 0.15 }}
        />
      )}

      {points.map((p, i) => (
        <motion.g
          key={p.id}
          initial={reduce ? false : { opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          transition={{ delay: reduce ? 0 : i * 0.04, duration: 0.3 }}
          style={{ transformOrigin: `${sx(p.x)}px ${sy(p.y)}px`, cursor: onPointClick ? 'pointer' : 'default' }}
          onClick={() => onPointClick?.(p.id)}
        >
          <motion.circle
            animate={{ cx: sx(p.x), cy: sy(p.y) }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            r={p.highlight ? 8 : 6}
            fill={p.excluded ? 'white' : C.teal}
            stroke={p.excluded ? C.faint : p.highlight ? C.ink : 'white'}
            strokeWidth={p.highlight ? 2.5 : 1.5}
            strokeDasharray={p.excluded ? '3 2' : undefined}
          >
            <title>{`${p.label}: x = ${fmt(p.x, 1)}%, y = ${fmt(p.y, 1)}%${p.excluded ? ' (талдаудан алынған)' : ''}`}</title>
          </motion.circle>
          {labels && (
            <motion.text textAnchor={sx(p.x) > W - 90 ? 'end' : 'start'} animate={{ x: sx(p.x) > W - 90 ? sx(p.x) - 9 : sx(p.x) + 9, y: sy(p.y) - 9 }} transition={{ type: 'spring', stiffness: 260, damping: 26 }} fontSize={11} fill={p.excluded ? C.faint : C.soft}>
              {labelFor(p)}
            </motion.text>
          )}
        </motion.g>
      ))}

      {prediction && (
        <g>
          <line x1={sx(prediction.x)} x2={sx(prediction.x)} y1={H - m.b} y2={sy(prediction.y)} stroke={C.violet} strokeDasharray="4 4" />
          <line x1={m.l} x2={sx(prediction.x)} y1={sy(prediction.y)} y2={sy(prediction.y)} stroke={C.violet} strokeDasharray="4 4" />
          <motion.rect
            animate={{ x: sx(prediction.x) - 7, y: sy(prediction.y) - 7 }}
            width={14} height={14} rx={3} fill={C.violet} stroke="white" strokeWidth={2}
            transform={`rotate(45 ${sx(prediction.x)} ${sy(prediction.y)})`}
          />
          <text x={sx(prediction.x) + 12} y={sy(prediction.y) + 18} fontSize={12} fontWeight={600} fill={C.violet}>ŷ = {fmt(prediction.y, 1)}%</text>
        </g>
      )}
    </svg>
  );
}

export function PlotLegend({ items }: { items: { kind: 'point' | 'line' | 'dash' | 'diamond' | 'hollow' | 'ref' | 'residual'; label: string }[] }) {
  const sw = (k: string) => {
    switch (k) {
      case 'point': return <circle cx={10} cy={8} r={5} fill={C.teal} />;
      case 'hollow': return <circle cx={10} cy={8} r={5} fill="white" stroke={C.faint} strokeDasharray="3 2" />;
      case 'line': return <line x1={0} x2={20} y1={8} y2={8} stroke={C.violet} strokeWidth={3} />;
      case 'dash': return <line x1={0} x2={20} y1={8} y2={8} stroke={C.violet} strokeOpacity={0.4} strokeWidth={2} strokeDasharray="5 4" />;
      case 'ref': return <line x1={0} x2={20} y1={8} y2={8} stroke={C.faint} strokeDasharray="2 4" />;
      case 'residual': return <line x1={10} x2={10} y1={1} y2={15} stroke={C.rose} strokeWidth={2} />;
      default: return <rect x={5} y={3} width={10} height={10} fill={C.violet} transform="rotate(45 10 8)" />;
    }
  };
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-ink-soft">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-2">
          <svg width={20} height={16} aria-hidden>{sw(it.kind)}</svg>
          {it.label}
        </span>
      ))}
    </div>
  );
}
