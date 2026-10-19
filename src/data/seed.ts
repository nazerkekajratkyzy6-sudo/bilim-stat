import type { ClassId, Dataset, Score, StudentRecord } from '../lib/model';

/**
 * Бастапқы зерттеу деректері (оқушылар кодпен белгіленген, жеке деректер жоқ).
 * 9-сыныптың БЖБ 1 және БЖБ 2 ең жоғары баллдары расталмаған — әдейі бос қалдырылған (null).
 * Оларды «Нақты деректер» бөлімінде енгізу қажет; ойдан шығарылған мән қойылмайды.
 */

const s = (score: number | null, max: number | null): Score => ({ score, max });
const empty: Score = { score: null, max: null };

function build(
  classId: ClassId,
  bjb: { scores: number[]; max: number | null }[],
  tjb: { scores: number[]; max: number },
): StudentRecord[] {
  const n = tjb.scores.length;
  return Array.from({ length: n }, (_, i) => ({
    id: `${classId}-O${String(i + 1).padStart(2, '0')}`,
    classId,
    code: `O${String(i + 1).padStart(2, '0')}`,
    bjb: [0, 1, 2].map((k) => (bjb[k] ? s(bjb[k].scores[i], bjb[k].max) : { ...empty })) as [Score, Score, Score],
    tjb: s(tjb.scores[i], tjb.max),
  }));
}

export function seedDataset(): Dataset {
  return {
    version: 1,
    classes: { '9': { bjbCount: 2 }, '10': { bjbCount: 3 }, '11': { bjbCount: 2 } },
    records: [
      ...build(
        '9',
        [
          { scores: [12, 11, 11, 9, 9, 7, 6], max: null },
          { scores: [13, 12, 12, 8, 9, 6, 7], max: null },
        ],
        { scores: [18, 17, 19, 14, 15, 10, 12], max: 20 },
      ),
      ...build(
        '10',
        [
          { scores: [16, 13, 14, 7, 8], max: 17 },
          { scores: [12, 9, 10, 7, 6], max: 13 },
          { scores: [10, 8, 9, 6, 7], max: 11 },
        ],
        { scores: [23, 20, 19, 11, 12], max: 25 },
      ),
      ...build(
        '11',
        [
          { scores: [13, 14, 13, 14, 10, 8, 9], max: 14 },
          { scores: [16, 17, 18, 17, 13, 11, 10], max: 18 },
        ],
        { scores: [23, 24, 22, 24, 21, 15, 14], max: 25 },
      ),
    ],
  };
}
