/**
 * BILIM STAT — деректер моделі, болжау әдістері, Leave-One-Out тексеру және тәуекел сигналдары.
 */
import {
  fmt, clampPercent, clean, isFail, linearRegression, mae, maxAbsError, mean, pearson, predict, rmse, toPercent,
  stdDev, type Pair, type Regression,
} from './stats';

export type ClassId = '9' | '10' | '11';
export const CLASS_IDS: ClassId[] = ['9', '10', '11'];
export type Scope = ClassId | 'all';
export type Feature = 'first' | 'last' | 'mean';

export interface Score { score: number | null; max: number | null }

export interface StudentRecord {
  id: string;
  classId: ClassId;
  code: string;
  bjb: [Score, Score, Score];
  tjb: Score;
}

export interface ClassConfig { bjbCount: 2 | 3 }

export interface Dataset {
  version: 1;
  records: StudentRecord[];
  classes: Record<ClassId, ClassConfig>;
}

export const FEATURE_LABEL: Record<Feature, string> = {
  first: 'Бірінші БЖБ',
  last: 'Соңғы БЖБ',
  mean: 'БЖБ пайыздарының орташасы',
};

/** Сөйлем ішінде қолдануға арналған нұсқа (аббревиатура бас әріппен қалады). */
export const FEATURE_PHRASE: Record<Feature, string> = {
  first: 'бірінші БЖБ',
  last: 'соңғы БЖБ',
  mean: 'БЖБ пайыздарының орташасы',
};

export const SCOPE_LABEL: Record<Scope, string> = {
  '9': '9-сынып',
  '10': '10-сынып',
  '11': '11-сынып',
  all: 'Барлық сыныптар (біріктірілген)',
};

/* ───────────────────── Тексеру (валидация) ───────────────────── */

export type IssueLevel = 'error' | 'warning';
export interface Issue { level: IssueLevel; field: string; text: string }

export function validateScore(s: Score, label: string, required: boolean): Issue[] {
  const out: Issue[] = [];
  const hasScore = s.score !== null && s.score !== undefined;
  if (!hasScore) {
    if (required) out.push({ level: 'warning', field: label, text: `${label}: балл енгізілмеген` });
  } else if (!Number.isFinite(s.score!) || s.score! < 0) {
    out.push({ level: 'error', field: label, text: `${label}: балл теріс немесе сан емес` });
  }
  if (s.max === null || s.max === undefined) {
    if (hasScore) out.push({ level: 'error', field: label, text: `${label}: ең жоғары балл енгізілмеген — пайызға айналдыру мүмкін емес` });
  } else if (!Number.isFinite(s.max) || s.max <= 0) {
    out.push({ level: 'error', field: label, text: `${label}: ең жоғары балл оң сан болуы керек` });
  } else if (hasScore && s.score! > s.max) {
    out.push({ level: 'error', field: label, text: `${label}: балл (${s.score}) ең жоғары баллдан (${s.max}) артық` });
  }
  return out;
}

export function validateRecord(r: StudentRecord, cfg: ClassConfig): Issue[] {
  const out: Issue[] = [];
  if (!r.code.trim()) out.push({ level: 'error', field: 'code', text: 'Оқушы коды бос' });
  for (let i = 0; i < cfg.bjbCount; i++) out.push(...validateScore(r.bjb[i], `БЖБ ${i + 1}`, true));
  out.push(...validateScore(r.tjb, 'ТЖБ', false));
  return out;
}

/* ───────────────────── Туынды көрсеткіштер ───────────────────── */

export interface DerivedRow {
  rec: StudentRecord;
  bjbPct: (number | null)[]; // ұзындығы = bjbCount
  tjbPct: number | null;
  x: number | null; // таңдалған кіріс көрсеткіш, %
  y: number | null; // нақты ТЖБ, %
  issues: Issue[];
}

export function featureValue(bjbPct: (number | null)[], feature: Feature): number | null {
  if (bjbPct.length === 0) return null;
  if (feature === 'first') return bjbPct[0];
  if (feature === 'last') return bjbPct[bjbPct.length - 1];
  // орташа: барлық БЖБ пайызы болуы керек
  if (bjbPct.some((v) => v === null)) return null;
  return mean(bjbPct as number[]);
}

export function deriveRow(rec: StudentRecord, cfg: ClassConfig, feature: Feature): DerivedRow {
  const bjbPct = rec.bjb.slice(0, cfg.bjbCount).map((s) => toPercent(s.score, s.max));
  const tjbPct = toPercent(rec.tjb.score, rec.tjb.max);
  return {
    rec,
    bjbPct,
    tjbPct,
    x: featureValue(bjbPct, feature),
    y: tjbPct,
    issues: validateRecord(rec, cfg),
  };
}

export function deriveScope(ds: Dataset, scope: Scope, feature: Feature): DerivedRow[] {
  return ds.records
    .filter((r) => scope === 'all' || r.classId === scope)
    .map((r) => deriveRow(r, ds.classes[r.classId], feature));
}

export interface ModelPoint extends Pair { id: string; code: string; classId: ClassId }

/** Модельге жарамды нүктелер: x пен y екеуі де белгілі. */
export function modelPoints(rows: DerivedRow[]): ModelPoint[] {
  return rows
    .filter((r) => r.x !== null && r.y !== null)
    .map((r) => ({ id: r.rec.id, code: r.rec.code, classId: r.rec.classId, x: r.x!, y: r.y! }));
}

/* ───────────────────── Болжам ───────────────────── */

export interface PredictionDetail {
  raw: number; // модельдің бастапқы мәні
  value: number; // 0–100% аралығына шектелген практикалық болжам
  clipped: boolean;
}

export function makePrediction(raw: number): PredictionDetail {
  const value = clampPercent(raw);
  return { raw, value, clipped: value !== raw };
}

/**
 * Оқушыға болжам: модель осы оқушысыз құрылады (оның ТЖБ-сы модельге кірмейді).
 */
export function predictWithout(points: ModelPoint[], id: string, x: number) {
  const train = points.filter((p) => p.id !== id);
  const model = linearRegression(train);
  if (isFail(model)) return { model, prediction: null as PredictionDetail | null, trainN: train.length };
  return { model: model as Regression, prediction: makePrediction(predict(model as Regression, x)), trainN: train.length };
}

/* ───────────────────── Үш әдісті салыстыру (LOOCV) ───────────────────── */

export type MethodId = 'mean' | 'naive' | 'regression';
export const METHOD_LABEL: Record<MethodId, string> = {
  mean: 'Сыныптың орташа нәтижесі',
  naive: 'БЖБ нәтижесіне негізделген болжам',
  regression: 'Сызықтық регрессия',
};
export const METHOD_SHORT: Record<MethodId, string> = {
  mean: '1-әдіс: Орташа',
  naive: '2-әдіс: БЖБ %',
  regression: '3-әдіс: Регрессия',
};

export interface LooFold {
  id: string;
  code: string;
  x: number;
  y: number;
  trainN: number;
  preds: Record<MethodId, PredictionDetail | null>;
  regModel: { a: number; b: number } | null;
}

export interface MethodScore {
  method: MethodId;
  mae: number | null;
  rmse: number | null;
  maxAbs: number | null;
  n: number; // сәтті болжамдар саны
  failed: number; // болжам жасалмаған қадамдар
  clippedCount: number;
}

export interface LooResult {
  folds: LooFold[];
  scores: Record<MethodId, MethodScore>;
  best: MethodId[]; // MAE бойынша ең кіші қате (тең болса — бірнешеу)
  n: number;
}

export function leaveOneOut(points: ModelPoint[]): LooResult {
  const folds: LooFold[] = points.map((p) => {
    const train = points.filter((q) => q.id !== p.id);
    const trainY = train.map((q) => q.y);
    const meanY = mean(trainY);
    const reg = linearRegression(train);
    const regOk = !isFail(reg);
    return {
      id: p.id,
      code: p.code,
      x: p.x,
      y: p.y,
      trainN: train.length,
      preds: {
        mean: meanY === null ? null : makePrediction(meanY),
        naive: makePrediction(p.x),
        regression: regOk ? makePrediction(predict(reg as Regression, p.x)) : null,
      },
      regModel: regOk ? { a: (reg as Regression).a, b: (reg as Regression).b } : null,
    };
  });

  const methods: MethodId[] = ['mean', 'naive', 'regression'];
  const scores = {} as Record<MethodId, MethodScore>;
  for (const m of methods) {
    const ok = folds.filter((f) => f.preds[m] !== null);
    const actual = ok.map((f) => f.y);
    const pred = ok.map((f) => f.preds[m]!.value);
    const complete = ok.length === folds.length && folds.length > 0;
    scores[m] = {
      method: m,
      mae: complete ? mae(actual, pred) : null,
      rmse: complete ? rmse(actual, pred) : null,
      maxAbs: complete ? maxAbsError(actual, pred) : null,
      n: ok.length,
      failed: folds.length - ok.length,
      clippedCount: ok.filter((f) => f.preds[m]!.clipped).length,
    };
  }
  const valid = methods.filter((m) => scores[m].mae !== null);
  let best: MethodId[] = [];
  if (valid.length) {
    const minMae = Math.min(...valid.map((m) => scores[m].mae!));
    best = valid.filter((m) => Math.abs(scores[m].mae! - minMae) < 1e-9);
  }
  return { folds, scores, best, n: points.length };
}

/* ───────────────────── Тәуекел сигналдары ───────────────────── */

export interface RiskThresholds {
  lowPrediction: number; // болжам осыдан төмен болса (%)
  drop: number; // қатарлас БЖБ арасындағы төмендеу (п.т.)
  instability: number; // оқушының БЖБ пайыздарының стандартты ауытқуы (п.т.)
}

export const DEFAULT_THRESHOLDS: RiskThresholds = { lowPrediction: 60, drop: 10, instability: 8 };

export type RiskLevel = 'stable' | 'attention' | 'support' | 'unknown';
export const RISK_LABEL: Record<RiskLevel, string> = {
  stable: 'Тұрақты нәтиже',
  attention: 'Назар аудару қажет',
  support: 'Қосымша қолдау ұсынылады',
  unknown: 'Деректер жеткіліксіз',
};

export interface RiskSignal { key: 'low' | 'drop' | 'unstable'; active: boolean | null; value: number | null; basis: string }

export interface RiskAssessment {
  id: string;
  code: string;
  classId: ClassId;
  level: RiskLevel;
  signals: RiskSignal[];
  prediction: PredictionDetail | null;
  activeCount: number;
}

export function assessRisk(row: DerivedRow, points: ModelPoint[], th: RiskThresholds): RiskAssessment {
  const pct = row.bjbPct;
  // 1. Төмен болжам (модель осы оқушысыз құрылады)
  let prediction: PredictionDetail | null = null;
  if (row.x !== null) {
    const res = predictWithout(points, row.rec.id, row.x);
    prediction = res.prediction;
  }
  const low: RiskSignal = prediction
    ? {
        key: 'low',
        active: prediction.value < th.lowPrediction,
        value: prediction.value,
        basis: `Болжам ŷ = ${fmt(prediction.value, 1)}% ${prediction.value < th.lowPrediction ? '<' : '≥'} шек ${th.lowPrediction}%`,
      }
    : { key: 'low', active: null, value: null, basis: 'Болжам есептелмеді (деректер жеткіліксіз)' };

  // 2. Қатарлас БЖБ арасындағы төмендеу
  let maxDrop: number | null = null;
  for (let i = 1; i < pct.length; i++) {
    if (pct[i - 1] !== null && pct[i] !== null) {
      const d = pct[i - 1]! - pct[i]!;
      maxDrop = maxDrop === null ? d : Math.max(maxDrop, d);
    }
  }
  const drop: RiskSignal = maxDrop === null
    ? { key: 'drop', active: null, value: null, basis: 'Кемінде екі БЖБ пайызы қажет' }
    : {
        key: 'drop',
        active: maxDrop > th.drop,
        value: maxDrop,
        basis: maxDrop > 0
          ? `Ең үлкен төмендеу ${fmt(maxDrop, 1)} п.т. ${maxDrop > th.drop ? '>' : '≤'} шек ${th.drop} п.т.`
          : `Төмендеу жоқ (өзгеріс ${fmt((-maxDrop), 1)} п.т. өсу)`,
      };

  // 3. Тұрақсыздық: оқушының БЖБ пайыздарының генералдық стандартты ауытқуы
  const own = clean(pct);
  const sd = own.length >= 2 ? stdDev(own, 'population') : null;
  const unstable: RiskSignal = sd === null
    ? { key: 'unstable', active: null, value: null, basis: 'Кемінде екі БЖБ пайызы қажет' }
    : {
        key: 'unstable',
        active: sd > th.instability,
        value: sd,
        basis: `БЖБ пайыздарының σ = ${fmt(sd, 1)} п.т. ${sd > th.instability ? '>' : '≤'} шек ${th.instability} п.т.`,
      };

  const signals = [low, drop, unstable];
  const known = signals.filter((s) => s.active !== null);
  const activeCount = signals.filter((s) => s.active).length;
  let level: RiskLevel;
  if (known.length === 0) level = 'unknown';
  else if (activeCount === 0) level = 'stable';
  else if (activeCount === 1) level = 'attention';
  else level = 'support';
  return { id: row.rec.id, code: row.rec.code, classId: row.rec.classId, level, signals, prediction, activeCount };
}

/* ───────────────────── Жалпы талдау жиыны ───────────────────── */

export function scopeModel(ds: Dataset, scope: Scope, feature: Feature) {
  const rows = deriveScope(ds, scope, feature);
  const points = modelPoints(rows);
  const corr = pearson(points);
  const reg = linearRegression(points);
  return { rows, points, corr, reg };
}

/** 9-сынып сияқты ең жоғары баллы белгісіз БЖБ бар-жоғын анықтау. */
export function missingMaxes(ds: Dataset, classId: ClassId): string[] {
  const cfg = ds.classes[classId];
  const out = new Set<string>();
  for (const r of ds.records.filter((q) => q.classId === classId)) {
    for (let i = 0; i < cfg.bjbCount; i++) if (r.bjb[i].score !== null && (r.bjb[i].max === null || !(r.bjb[i].max! > 0))) out.add(`БЖБ ${i + 1}`);
    if (r.tjb.score !== null && (r.tjb.max === null || !(r.tjb.max! > 0))) out.add('ТЖБ');
  }
  return [...out];
}
