/** Зерттеу қорытындысын тек есептелген деректер негізінде құрастыру. */
import {
  assessRisk, CLASS_IDS, deriveScope, FEATURE_LABEL, leaveOneOut, METHOD_LABEL, missingMaxes, modelPoints,
  SCOPE_LABEL, type Dataset, type Feature, type LooResult, type RiskThresholds, type Scope, type RiskLevel,
} from './model';
import {
  correlationStrength, correlationTTest, describe, fmt, isFail, linearRegression, pearson,
  type Describe, type PearsonResult, type Regression, type VarianceKind,
} from './stats';

export interface ScopeSummary {
  scope: Scope;
  label: string;
  nRecords: number;
  nModel: number;
  missing: string[];
  x: Describe;
  y: Describe;
  r: number | null;
  reg: Regression | null;
  ttest: ReturnType<typeof correlationTTest>;
  loo: LooResult | null;
  risk: Record<RiskLevel, number>;
  hypothesis: { link: boolean | null; better: boolean | null };
}

export function summarize(ds: Dataset, scope: Scope, feature: Feature, vk: VarianceKind, th: RiskThresholds): ScopeSummary {
  const rows = deriveScope(ds, scope, feature);
  const pts = modelPoints(rows);
  const corr = pearson(pts);
  const reg = linearRegression(pts);
  const r = isFail(corr) ? null : (corr as PearsonResult).r;
  const ttest = r === null ? null : correlationTTest(r, pts.length);
  const loo = pts.length >= 3 ? leaveOneOut(pts) : null;
  const risk: Record<RiskLevel, number> = { stable: 0, attention: 0, support: 0, unknown: 0 };
  for (const row of rows) risk[assessRisk(row, pts, th).level]++;
  const regMae = loo?.scores.regression.mae ?? null;
  const meanMae = loo?.scores.mean.mae ?? null;
  return {
    scope,
    label: SCOPE_LABEL[scope],
    nRecords: rows.length,
    nModel: pts.length,
    missing: scope === 'all' ? [] : missingMaxes(ds, scope),
    x: describe(pts.map((p) => p.x), vk),
    y: describe(pts.map((p) => p.y), vk),
    r,
    reg: isFail(reg) ? null : (reg as Regression),
    ttest,
    loo,
    risk,
    hypothesis: {
      link: r === null || !ttest ? null : r > 0 && ttest.significant,
      better: regMae === null || meanMae === null ? null : regMae < meanMae,
    },
  };
}

export function buildReport(ds: Dataset, feature: Feature, vk: VarianceKind, th: RiskThresholds) {
  const classes = CLASS_IDS.map((c) => summarize(ds, c, feature, vk, th));
  const all = summarize(ds, 'all', feature, vk, th);
  return { classes, all, feature, vk, th, featureLabel: FEATURE_LABEL[feature], date: new Date() };
}

export type Report = ReturnType<typeof buildReport>;

/** Гипотеза бойынша қорытынды мәтін. */
export function hypothesisText(s: ScopeSummary): string {
  if (s.nModel < 3) return `${s.label}: модель құруға деректер жеткіліксіз (n = ${s.nModel}), гипотеза тексерілмеді.`;
  const parts: string[] = [];
  if (s.r !== null && s.ttest) {
    parts.push(
      s.hypothesis.link
        ? `r = ${fmt(s.r, 3)} (${correlationStrength(s.r)} оң байланыс), t = ${fmt(s.ttest.t, 2)} > ${fmt(s.ttest.tCrit, 3)} — байланыс α = 0,05 деңгейінде маңызды`
        : `r = ${fmt(s.r, 3)}, t = ${fmt(s.ttest.t, 2)}, сыни мән ${fmt(s.ttest.tCrit, 3)} — байланыстың маңыздылығы расталмады`,
    );
  }
  if (s.loo) {
    const sc = s.loo.scores;
    parts.push(
      s.hypothesis.better
        ? `регрессияның LOO қатесі (MAE = ${fmt(sc.regression.mae, 2)} п.т.) сыныптың орташасына негізделген болжамнан (${fmt(sc.mean.mae, 2)} п.т.) аз`
        : `регрессияның LOO қатесі (MAE = ${fmt(sc.regression.mae, 2)} п.т.) орташаға негізделген болжамнан (${fmt(sc.mean.mae, 2)} п.т.) аз емес`,
    );
    const best = s.loo.best.map((b) => `«${METHOD_LABEL[b]}»`).join(', ');
    parts.push(`MAE бойынша ең дәл әдіс — ${best}`);
  }
  const verdict = s.hypothesis.link && s.hypothesis.better ? 'Гипотеза осы деректерде расталады' : s.hypothesis.link === false || s.hypothesis.better === false ? 'Гипотеза толық расталмады' : 'Гипотезаны тексеру үшін деректер жеткіліксіз';
  return `${s.label}: ${parts.join('; ')}. ${verdict}.`;
}
