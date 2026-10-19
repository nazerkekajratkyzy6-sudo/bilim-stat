/**
 * Математикалық тесттер.
 * Бақылау мәндері тәуелсіз құралмен (Python: numpy, statistics) есептелген — README-де көрсетілген.
 */
import { describe as suite, expect, it } from 'vitest';
import {
  clampPercent, coefVariation, correlationTTest, describe, linearRegression, mae, maxAbsError, mean, median,
  mode, pearson, rmse, stdDev, toPercent, variance, isFail, clean, type Pair,
} from './stats';
import {
  assessRisk, deriveScope, featureValue, leaveOneOut, modelPoints, predictWithout, validateScore,
  DEFAULT_THRESHOLDS, type Dataset,
} from './model';
import { seedDataset } from '../data/seed';

const close = (a: number | null | undefined, b: number, d = 8) => {
  expect(a).not.toBeNull();
  expect(a!).toBeCloseTo(b, d);
};

suite('Орташа мән, медиана, мода', () => {
  it('қарапайым мысал', () => {
    close(mean([18, 17, 19, 14, 15, 10, 12]), 15);
    close(median([18, 17, 19, 14, 15, 10, 12]), 15);
    close(median([1, 2, 3, 4]), 2.5);
  });
  it('бос жиын', () => {
    expect(mean([])).toBeNull();
    expect(median([])).toBeNull();
  });
  it('мода: бірнеше мода және мода жоқ жағдайы', () => {
    expect(mode([12, 11, 11, 9, 9, 7, 6]).values).toEqual([9, 11]);
    expect(mode([18, 17, 19, 14, 15, 10, 12]).values).toEqual([]);
    expect(mode([5, 5, 5, 1]).values).toEqual([5]);
  });
});

suite('Дисперсия және стандартты ауытқу', () => {
  const x = [18, 17, 19, 14, 15, 10, 12];
  it('генералдық σ² = Σ(x−x̄)²/n', () => close(variance(x, 'population'), 9.142857142857142));
  it('таңдамалы s² = Σ(x−x̄)²/(n−1)', () => close(variance(x, 'sample'), 10.666666666666666));
  it('стандартты ауытқу = √дисперсия', () => {
    close(stdDev(x, 'population'), Math.sqrt(9.142857142857142));
    close(stdDev(x, 'sample'), Math.sqrt(10.666666666666666));
  });
  it('вариация коэффициенті', () => close(coefVariation([12, 11, 11, 9, 9, 7, 6], 'sample'), 23.850289136889195));
  it('нөлдік дисперсия', () => {
    close(variance([7, 7, 7], 'population'), 0);
    close(stdDev([7, 7, 7], 'sample'), 0);
  });
  it('таңдамалы дисперсия n=1 кезінде анықталмаған', () => {
    expect(variance([5], 'sample')).toBeNull();
    close(variance([5], 'population'), 0);
  });
  it('орташа 0 болса вариация коэффициенті анықталмаған', () => {
    expect(coefVariation([-1, 1], 'population')).toBeNull();
  });
});

suite('Пропусктерді өңдеу', () => {
  it('null және NaN мәндер алынып тасталады', () => {
    expect(clean([1, null, 2, undefined, NaN, 3])).toEqual([1, 2, 3]);
    const d = describe([4, null, 6], 'population');
    expect(d.n).toBe(2);
    close(d.mean, 5);
  });
});

suite('Корреляция', () => {
  it('толық оң және теріс байланыс', () => {
    const pos = pearson([{ x: 1, y: 2 }, { x: 2, y: 4 }, { x: 3, y: 6 }]);
    const neg = pearson([{ x: 1, y: 6 }, { x: 2, y: 4 }, { x: 3, y: 2 }]);
    expect(isFail(pos)).toBe(false);
    close((pos as any).r, 1);
    close((neg as any).r, -1);
  });
  it('x бойынша нөлдік дисперсия — қате қайтарады', () => {
    const r = pearson([{ x: 5, y: 1 }, { x: 5, y: 2 }, { x: 5, y: 3 }]);
    expect(isFail(r) && r.error).toBe('zero-variance-x');
  });
  it('нүкте аз болса — қате', () => {
    const r = pearson([{ x: 1, y: 1 }, { x: 2, y: 2 }]);
    expect(isFail(r) && r.error).toBe('too-few');
  });
  it('t-критерий: r=0,9, n=7', () => {
    const t = correlationTTest(0.9, 7)!;
    close(t.t, (0.9 * Math.sqrt(5)) / Math.sqrt(1 - 0.81), 10);
    expect(t.tCrit).toBe(2.571);
    expect(t.significant).toBe(true);
  });
});

suite('Сызықтық регрессия', () => {
  it('дәл түзу y = 2x + 1', () => {
    const pts: Pair[] = [0, 1, 2, 3].map((x) => ({ x, y: 2 * x + 1 }));
    const m = linearRegression(pts);
    expect(isFail(m)).toBe(false);
    close((m as any).a, 2);
    close((m as any).b, 1);
    close((m as any).r2, 1);
  });
  it('x тұрақты болса — модель құрылмайды', () => {
    const m = linearRegression([{ x: 3, y: 1 }, { x: 3, y: 5 }]);
    expect(isFail(m) && m.error).toBe('zero-variance-x');
  });
  it('R² = r² (бір айнымалы ЕКК үшін)', () => {
    const pts: Pair[] = [{ x: 1, y: 2 }, { x: 2, y: 3.5 }, { x: 4, y: 4 }, { x: 5, y: 7 }];
    const m = linearRegression(pts) as any;
    const r = (pearson(pts) as any).r;
    close(m.r2, r * r, 10);
  });
});

suite('Қате метрикалары', () => {
  const a = [10, 20, 30];
  const p = [12, 18, 33];
  it('MAE', () => close(mae(a, p), (2 + 2 + 3) / 3));
  it('RMSE', () => close(rmse(a, p), Math.sqrt((4 + 4 + 9) / 3)));
  it('Ең үлкен абсолют қате', () => close(maxAbsError(a, p), 3));
  it('ұзындықтар сәйкес келмесе — null', () => expect(mae([1], [1, 2])).toBeNull());
});

suite('Нормалау және шекаралық мәндер', () => {
  it('балл → пайыз', () => {
    close(toPercent(13, 14), (13 / 14) * 100);
    close(toPercent(0, 25), 0);
    close(toPercent(25, 25), 100);
  });
  it('ең жоғары балл белгісіз немесе қате', () => {
    expect(toPercent(12, null)).toBeNull();
    expect(toPercent(12, 0)).toBeNull();
    expect(toPercent(30, 25)).toBeNull();
    expect(toPercent(-1, 25)).toBeNull();
  });
  it('әртүрлі ең жоғары баллдар қате емес', () => {
    expect(validateScore({ score: 16, max: 17 }, 'БЖБ 1', true)).toEqual([]);
    expect(validateScore({ score: 10, max: 11 }, 'БЖБ 3', true)).toEqual([]);
  });
  it('балл ең жоғары баллдан артық — қате', () => {
    expect(validateScore({ score: 19, max: 18 }, 'БЖБ 2', true)[0].level).toBe('error');
  });
  it('шектеу 0–100%', () => {
    expect(clampPercent(112)).toBe(100);
    expect(clampPercent(-4)).toBe(0);
    expect(clampPercent(55)).toBe(55);
  });
  it('кіріс көрсеткіш: орташа үшін барлық БЖБ қажет', () => {
    expect(featureValue([80, null], 'mean')).toBeNull();
    close(featureValue([80, 90], 'mean'), 85);
    expect(featureValue([80, 90], 'last')).toBe(90);
  });
});

/* ───── Нақты деректер бойынша тәуелсіз бақылау (numpy) ───── */

const ds: Dataset = seedDataset();

suite('11-сынып: тәуелсіз бақылау мәндері', () => {
  it('ТЖБ % сипаттамасы', () => {
    const rows = deriveScope(ds, '11', 'mean');
    const y = rows.map((r) => r.tjbPct!);
    close(mean(y), 81.71428571428571);
    close(variance(y, 'population'), 241.63265306122443, 6);
    close(variance(y, 'sample'), 281.90476190476187, 6);
    close(median(y), 88);
  });
  const cases = [
    { f: 'first', r: 0.923086373, a: 0.8654545455, b: 10.1818181818, reg: [5.3307760593, 8.0453677597, 15.1578947368], naive: [5.3469387755, 6.4496253875, 12.5714285714] },
    { f: 'last', r: 0.91969878, a: 0.8666666667, b: 11.5555555556, reg: [7.0127822404, 7.8277313799, 12.0566572238], naive: [4.5079365079, 6.5319726474, 12] },
    { f: 'mean', r: 0.9337194657, a: 0.8893831451, b: 8.9603243556, reg: [5.7589437392, 7.5499411695, 13.8842181119], naive: [4.1383219955, 5.8511666874, 12.1746031746] },
  ] as const;
  for (const c of cases) {
    it(`кіріс: ${c.f}`, () => {
      const pts = modelPoints(deriveScope(ds, '11', c.f));
      expect(pts.length).toBe(7);
      const m = linearRegression(pts) as any;
      close((pearson(pts) as any).r, c.r, 8);
      close(m.a, c.a, 8);
      close(m.b, c.b, 8);
      const loo = leaveOneOut(pts);
      close(loo.scores.regression.mae, c.reg[0], 8);
      close(loo.scores.regression.rmse, c.reg[1], 8);
      close(loo.scores.regression.maxAbs, c.reg[2], 8);
      close(loo.scores.naive.mae, c.naive[0], 8);
      close(loo.scores.naive.rmse, c.naive[1], 8);
      close(loo.scores.mean.mae, 15.8095238095, 8);
      close(loo.scores.mean.rmse, 18.1352940116, 8);
      close(loo.scores.mean.maxAbs, 30, 8);
    });
  }
});

suite('10-сынып: тәуелсіз бақылау мәндері', () => {
  it('кіріс: орташа БЖБ', () => {
    const pts = modelPoints(deriveScope(ds, '10', 'mean'));
    const m = linearRegression(pts) as any;
    close((pearson(pts) as any).r, 0.9730716666, 8);
    close(m.a, 1.1161242939, 8);
    close(m.b, -9.6282581678, 8);
    close(m.r2, 0.9468684683, 8);
    const loo = leaveOneOut(pts);
    close(loo.scores.regression.mae, 5.0567091532, 8);
    close(loo.scores.naive.mae, 4.4278074866, 8);
    close(loo.scores.mean.mae, 22, 8);
  });
  it('кіріс: соңғы БЖБ', () => {
    const pts = modelPoints(deriveScope(ds, '10', 'last'));
    const loo = leaveOneOut(pts);
    close(loo.scores.regression.mae, 7.2285714286, 8);
    close(loo.scores.regression.maxAbs, 15, 8);
    expect(loo.best).toEqual(['regression']);
  });
});

suite('Leave-One-Out: ақпарат ағуы жоқ', () => {
  it('әр қадамда тексерілетін оқушы оқыту жиынына кірмейді', () => {
    const pts = modelPoints(deriveScope(ds, '11', 'mean'));
    const loo = leaveOneOut(pts);
    for (const f of loo.folds) {
      expect(f.trainN).toBe(pts.length - 1);
      const train = pts.filter((p) => p.id !== f.id);
      const m = linearRegression(train) as any;
      close(f.regModel!.a, m.a, 12);
      close(f.preds.mean!.value, mean(train.map((p) => p.y))!, 12);
    }
  });
  it('оқушының ТЖБ-сын өзгерту оның өз болжамына әсер етпейді', () => {
    const pts = modelPoints(deriveScope(ds, '11', 'mean'));
    const target = pts[2];
    const before = predictWithout(pts, target.id, target.x).prediction!.raw;
    const altered = pts.map((p) => (p.id === target.id ? { ...p, y: 0 } : p));
    const after = predictWithout(altered, target.id, target.x).prediction!.raw;
    close(after, before, 12);
  });
  it('жеңімпаз алдын ала белгіленбеген: ең кіші MAE бойынша анықталады', () => {
    const pts = modelPoints(deriveScope(ds, '11', 'mean'));
    const loo = leaveOneOut(pts);
    const maes = (['mean', 'naive', 'regression'] as const).map((m) => loo.scores[m].mae!);
    const min = Math.min(...maes);
    for (const b of loo.best) close(loo.scores[b].mae, min, 12);
  });
});

suite('9-сынып: ең жоғары балл белгісіз', () => {
  it('пайыз есептелмейді, модель нүктелері жоқ', () => {
    const rows = deriveScope(ds, '9', 'mean');
    expect(rows.every((r) => r.x === null)).toBe(true);
    expect(modelPoints(rows).length).toBe(0);
    expect(rows[0].issues.some((i) => i.level === 'error')).toBe(true);
  });
  it('ең жоғары балл енгізілгеннен кейін модель құрылады', () => {
    const d2: Dataset = structuredClone(ds);
    d2.records.filter((r) => r.classId === '9').forEach((r) => { r.bjb[0].max = 15; r.bjb[1].max = 15; });
    const pts = modelPoints(deriveScope(d2, '9', 'mean'));
    expect(pts.length).toBe(7);
    expect(isFail(linearRegression(pts))).toBe(false);
  });
});

suite('Тәуекел сигналдары', () => {
  it('төмендеу мен тұрақсыздық дұрыс есептеледі', () => {
    const rows = deriveScope(ds, '11', 'mean');
    const pts = modelPoints(rows);
    // O05: БЖБ1 = 10/14 = 71,43%, БЖБ2 = 13/18 = 72,22% → төмендеу жоқ
    const r5 = assessRisk(rows[4], pts, DEFAULT_THRESHOLDS);
    const drop = r5.signals.find((s) => s.key === 'drop')!;
    close(drop.value, (10 / 14) * 100 - (13 / 18) * 100, 10);
    expect(drop.active).toBe(false);
    const sd = r5.signals.find((s) => s.key === 'unstable')!;
    close(sd.value, Math.abs((10 / 14) * 100 - (13 / 18) * 100) / 2, 10);
  });
});
