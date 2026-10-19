/**
 * BILIM STAT — математикалық ядро.
 * Барлық функциялар таза (pure): кіріс деректерді өзгертпейді, кездейсоқ сандар қолданбайды.
 */

export type VarianceKind = 'population' | 'sample';

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Бос (null/undefined/NaN) мәндерді алып тастайды. */
export function clean(xs: ReadonlyArray<number | null | undefined>): number[] {
  return xs.filter(isNum);
}

export function sum(xs: readonly number[]): number {
  let s = 0;
  for (const x of xs) s += x;
  return s;
}

export function mean(xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  return sum(xs) / xs.length;
}

export function median(xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Мода: ең жиі кездесетін мән(дер).
 * Егер барлық мәндер бір реттен кездессе — мода жоқ (бос массив).
 */
export function mode(xs: readonly number[]): { values: number[]; count: number } {
  if (xs.length === 0) return { values: [], count: 0 };
  const freq = new Map<number, number>();
  for (const x of xs) freq.set(x, (freq.get(x) ?? 0) + 1);
  let best = 0;
  for (const c of freq.values()) best = Math.max(best, c);
  if (best <= 1) return { values: [], count: 1 };
  const values = [...freq.entries()].filter(([, c]) => c === best).map(([v]) => v).sort((a, b) => a - b);
  return { values, count: best };
}

/**
 * Дисперсия.
 *  population: σ² = Σ(xᵢ − x̄)² / n        (генералдық)
 *  sample:     s² = Σ(xᵢ − x̄)² / (n − 1)  (таңдамалы, түзетілген)
 */
export function variance(xs: readonly number[], kind: VarianceKind): number | null {
  const n = xs.length;
  if (n === 0) return null;
  if (kind === 'sample' && n < 2) return null;
  const m = mean(xs)!;
  let ss = 0;
  for (const x of xs) ss += (x - m) ** 2;
  return ss / (kind === 'sample' ? n - 1 : n);
}

export function stdDev(xs: readonly number[], kind: VarianceKind): number | null {
  const v = variance(xs, kind);
  return v === null ? null : Math.sqrt(v);
}

/** Вариация коэффициенті V = σ / x̄ · 100%. Орташа 0 болса — анықталмаған. */
export function coefVariation(xs: readonly number[], kind: VarianceKind): number | null {
  const m = mean(xs);
  const s = stdDev(xs, kind);
  if (m === null || s === null || m === 0) return null;
  return (s / Math.abs(m)) * 100;
}

export interface Describe {
  n: number;
  mean: number | null;
  median: number | null;
  mode: { values: number[]; count: number };
  variance: number | null;
  sd: number | null;
  cv: number | null;
  min: number | null;
  max: number | null;
  range: number | null;
  sumSq: number | null; // Σ(xᵢ − x̄)²
}

export function describe(raw: ReadonlyArray<number | null | undefined>, kind: VarianceKind): Describe {
  const xs = clean(raw);
  const m = mean(xs);
  const mn = xs.length ? Math.min(...xs) : null;
  const mx = xs.length ? Math.max(...xs) : null;
  return {
    n: xs.length,
    mean: m,
    median: median(xs),
    mode: mode(xs),
    variance: variance(xs, kind),
    sd: stdDev(xs, kind),
    cv: coefVariation(xs, kind),
    min: mn,
    max: mx,
    range: mn !== null && mx !== null ? mx - mn : null,
    sumSq: m === null ? null : sum(xs.map((x) => (x - m) ** 2)),
  };
}

/* ───────────────────────── Корреляция ───────────────────────── */

export interface Pair { x: number; y: number }

export interface PearsonResult {
  n: number;
  r: number;
  meanX: number;
  meanY: number;
  sxx: number; // Σ(x − x̄)²
  syy: number; // Σ(y − ȳ)²
  sxy: number; // Σ(x − x̄)(y − ȳ)
}

export type PearsonFail = { error: 'too-few' | 'zero-variance-x' | 'zero-variance-y'; n: number };

const EPS = 1e-12;

function sums(points: readonly Pair[]) {
  const n = points.length;
  const meanX = sum(points.map((p) => p.x)) / n;
  const meanY = sum(points.map((p) => p.y)) / n;
  let sxx = 0, syy = 0, sxy = 0;
  for (const p of points) {
    const dx = p.x - meanX;
    const dy = p.y - meanY;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  return { n, meanX, meanY, sxx, syy, sxy };
}

/** Пирсон корреляция коэффициенті r = Sxy / √(Sxx·Syy). */
export function pearson(points: readonly Pair[]): PearsonResult | PearsonFail {
  if (points.length < 3) return { error: 'too-few', n: points.length };
  const s = sums(points);
  if (s.sxx < EPS) return { error: 'zero-variance-x', n: s.n };
  if (s.syy < EPS) return { error: 'zero-variance-y', n: s.n };
  const r = s.sxy / Math.sqrt(s.sxx * s.syy);
  return { ...s, r: Math.max(-1, Math.min(1, r)) };
}

export const isFail = <T extends object>(v: T | { error: string }): v is { error: any; n: number } =>
  'error' in v;

/** Корреляцияның маңыздылығы: t = r·√(n−2) / √(1−r²), df = n − 2. */
export function correlationTTest(r: number, n: number) {
  const df = n - 2;
  if (df < 1) return null;
  const t = Math.abs(r) >= 1 ? Infinity : (r * Math.sqrt(df)) / Math.sqrt(1 - r * r);
  const tCrit = tCritical05(df);
  return { t, df, tCrit, significant: Math.abs(t) > tCrit };
}

/** Стьюдент үлестірімінің екіжақты α = 0,05 сыни мәндері (кесте). */
export function tCritical05(df: number): number {
  const table: Record<number, number> = {
    1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228,
    11: 2.201, 12: 2.179, 13: 2.16, 14: 2.145, 15: 2.131, 16: 2.12, 17: 2.11, 18: 2.101, 19: 2.093, 20: 2.086,
    21: 2.08, 22: 2.074, 23: 2.069, 24: 2.064, 25: 2.06, 26: 2.056, 27: 2.052, 28: 2.048, 29: 2.045, 30: 2.042,
  };
  if (df in table) return table[df];
  if (df <= 40) return 2.021;
  if (df <= 60) return 2.0;
  if (df <= 120) return 1.98;
  return 1.96;
}

/** Байланыс күші (Чеддок шкаласы — шартты жіктеу). */
export function correlationStrength(r: number): string {
  const a = Math.abs(r);
  if (a < 0.1) return 'байланыс іс жүзінде жоқ';
  if (a < 0.3) return 'әлсіз';
  if (a < 0.5) return 'орташа';
  if (a < 0.7) return 'айтарлықтай';
  if (a < 0.9) return 'күшті';
  return 'өте күшті';
}

/* ───────────────────────── Регрессия ───────────────────────── */

export interface Regression {
  a: number; // еңіс коэффициенті
  b: number; // бос мүше
  n: number;
  r: number | null;
  r2: number | null;
  meanX: number;
  meanY: number;
  sxx: number;
  sxy: number;
  ssRes: number;
  ssTot: number;
}

export type RegressionFail = { error: 'too-few' | 'zero-variance-x'; n: number };

/**
 * Ең кіші квадраттар әдісі: ŷ = a·x + b
 *  a = Σ(x − x̄)(y − ȳ) / Σ(x − x̄)²,   b = ȳ − a·x̄
 *  R² = 1 − SSres / SStot
 */
export function linearRegression(points: readonly Pair[], minPoints = 2): Regression | RegressionFail {
  if (points.length < Math.max(2, minPoints)) return { error: 'too-few', n: points.length };
  const s = sums(points);
  if (s.sxx < EPS) return { error: 'zero-variance-x', n: s.n };
  const a = s.sxy / s.sxx;
  const b = s.meanY - a * s.meanX;
  let ssRes = 0;
  for (const p of points) ssRes += (p.y - (a * p.x + b)) ** 2;
  const ssTot = s.syy;
  const r2 = ssTot < EPS ? null : 1 - ssRes / ssTot;
  const r = s.syy < EPS ? null : s.sxy / Math.sqrt(s.sxx * s.syy);
  return { a, b, n: s.n, r, r2, meanX: s.meanX, meanY: s.meanY, sxx: s.sxx, sxy: s.sxy, ssRes, ssTot };
}

export const predict = (m: Pick<Regression, 'a' | 'b'>, x: number) => m.a * x + m.b;

export function clampPercent(v: number): number {
  return Math.max(0, Math.min(100, v));
}

/* ───────────────────────── Қателер ───────────────────────── */

export function mae(actual: readonly number[], pred: readonly number[]): number | null {
  if (actual.length === 0 || actual.length !== pred.length) return null;
  return sum(actual.map((a, i) => Math.abs(a - pred[i]))) / actual.length;
}

export function rmse(actual: readonly number[], pred: readonly number[]): number | null {
  if (actual.length === 0 || actual.length !== pred.length) return null;
  return Math.sqrt(sum(actual.map((a, i) => (a - pred[i]) ** 2)) / actual.length);
}

export function maxAbsError(actual: readonly number[], pred: readonly number[]): number | null {
  if (actual.length === 0 || actual.length !== pred.length) return null;
  return Math.max(...actual.map((a, i) => Math.abs(a - pred[i])));
}

/* ───────────────────────── Нормалау ───────────────────────── */

/** Баллды пайызға айналдыру. Ең жоғары балл белгісіз/қате болса — null. */
export function toPercent(score: number | null | undefined, max: number | null | undefined): number | null {
  if (!isNum(score) || !isNum(max) || max <= 0) return null;
  if (score < 0 || score > max) return null;
  return (score / max) * 100;
}

/** Сандарды қазақша форматтау (үтірмен). */
export function fmt(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  const r = Number(v.toFixed(digits));
  return r.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: digits }).replace(/ /g, ' ');
}

export function fmtSigned(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return (v > 0 ? '+' : v < 0 ? '−' : '') + fmt(Math.abs(v), digits);
}
