/** Excel/CSV импорт және экспорт. */
// SheetJS жүктемесі қажет болғанда ғана жүктеледі (басты бет жылдам ашылуы үшін)
const loadXlsx = () => import('xlsx');
import { CLASS_IDS, type ClassId, type Dataset, type Score, type StudentRecord } from './model';

export const COLUMNS = [
  'Сынып', 'Оқушы коды',
  'БЖБ 1', 'БЖБ 1 ең жоғары балл',
  'БЖБ 2', 'БЖБ 2 ең жоғары балл',
  'БЖБ 3', 'БЖБ 3 ең жоғары балл',
  'ТЖБ', 'ТЖБ ең жоғары балл',
] as const;

const norm = (s: string) => s.toLowerCase().replace(/[\s_.\-]+/g, '').replace('ё', 'е');

// Бағандардың балама атаулары (қазақша/орысша/латынша)
const ALIASES: Record<string, string[]> = {
  'Сынып': ['сынып', 'класс', 'class', 'grade'],
  'Оқушы коды': ['оқушыкоды', 'код', 'кодученика', 'code', 'id', 'оқушы'],
  'БЖБ 1': ['бжб1', 'сор1', 'bjb1'],
  'БЖБ 1 ең жоғары балл': ['бжб1еңжоғарыбалл', 'бжб1max', 'сор1max', 'бжб1макс', 'max1', 'бжб1максимум'],
  'БЖБ 2': ['бжб2', 'сор2', 'bjb2'],
  'БЖБ 2 ең жоғары балл': ['бжб2еңжоғарыбалл', 'бжб2max', 'сор2max', 'бжб2макс', 'max2', 'бжб2максимум'],
  'БЖБ 3': ['бжб3', 'сор3', 'bjb3'],
  'БЖБ 3 ең жоғары балл': ['бжб3еңжоғарыбалл', 'бжб3max', 'сор3max', 'бжб3макс', 'max3', 'бжб3максимум'],
  'ТЖБ': ['тжб', 'соч', 'tjb'],
  'ТЖБ ең жоғары балл': ['тжбеңжоғарыбалл', 'тжбmax', 'сочmax', 'тжбмакс', 'maxтжб', 'тжбмаксимум'],
};

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).trim().replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export interface ImportResult {
  records: StudentRecord[];
  errors: string[];
  bjbCount: Partial<Record<ClassId, 2 | 3>>;
}

export async function importFile(file: File): Promise<ImportResult> {
  const XLSX = await loadXlsx();
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', raw: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null, raw: true });
  const errors: string[] = [];
  if (rows.length === 0) return { records: [], errors: ['Файлда деректер жоқ'], bjbCount: {} };

  const headers = Object.keys(rows[0]);
  const map: Record<string, string | undefined> = {};
  for (const col of COLUMNS) {
    map[col] = headers.find((h) => norm(h) === norm(col)) ?? headers.find((h) => ALIASES[col].includes(norm(h)));
  }
  for (const req of ['Сынып', 'Оқушы коды', 'БЖБ 1', 'ТЖБ']) if (!map[req]) errors.push(`«${req}» бағаны табылмады`);
  if (errors.length) return { records: [], errors, bjbCount: {} };

  const get = (row: Record<string, unknown>, col: string) => (map[col] ? row[map[col]!] : null);
  const sc = (row: Record<string, unknown>, a: string, b: string): Score => ({ score: num(get(row, a)), max: num(get(row, b)) });

  const records: StudentRecord[] = [];
  const has3: Partial<Record<ClassId, boolean>> = {};
  rows.forEach((row, i) => {
    const cls = String(get(row, 'Сынып') ?? '').replace(/[^0-9]/g, '') as ClassId;
    if (!CLASS_IDS.includes(cls)) {
      errors.push(`${i + 2}-жол: сынып 9, 10 немесе 11 болуы керек`);
      return;
    }
    const code = String(get(row, 'Оқушы коды') ?? '').trim() || `O${String(i + 1).padStart(2, '0')}`;
    const b3 = sc(row, 'БЖБ 3', 'БЖБ 3 ең жоғары балл');
    if (b3.score !== null) has3[cls] = true;
    records.push({
      id: `${cls}-${code}-${Date.now().toString(36)}-${i}`,
      classId: cls,
      code,
      bjb: [sc(row, 'БЖБ 1', 'БЖБ 1 ең жоғары балл'), sc(row, 'БЖБ 2', 'БЖБ 2 ең жоғары балл'), b3],
      tjb: sc(row, 'ТЖБ', 'ТЖБ ең жоғары балл'),
    });
  });
  const bjbCount: Partial<Record<ClassId, 2 | 3>> = {};
  for (const c of CLASS_IDS) if (records.some((r) => r.classId === c)) bjbCount[c] = has3[c] ? 3 : 2;
  return { records, errors, bjbCount };
}

function rowsOf(ds: Dataset, classes: ClassId[]) {
  return ds.records
    .filter((r) => classes.includes(r.classId))
    .map((r) => ({
      'Сынып': Number(r.classId),
      'Оқушы коды': r.code,
      'БЖБ 1': r.bjb[0].score, 'БЖБ 1 ең жоғары балл': r.bjb[0].max,
      'БЖБ 2': r.bjb[1].score, 'БЖБ 2 ең жоғары балл': r.bjb[1].max,
      'БЖБ 3': ds.classes[r.classId].bjbCount === 3 ? r.bjb[2].score : null,
      'БЖБ 3 ең жоғары балл': ds.classes[r.classId].bjbCount === 3 ? r.bjb[2].max : null,
      'ТЖБ': r.tjb.score, 'ТЖБ ең жоғары балл': r.tjb.max,
    }));
}

export async function exportXlsx(ds: Dataset, filename = 'bilim-stat-derekter.xlsx') {
  const XLSX = await loadXlsx();
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rowsOf(ds, CLASS_IDS), { header: [...COLUMNS] });
  ws['!cols'] = COLUMNS.map((c) => ({ wch: Math.max(8, c.length + 2) }));
  XLSX.utils.book_append_sheet(wb, ws, 'Деректер');
  XLSX.writeFile(wb, filename);
}

export async function exportCsv(ds: Dataset, filename = 'bilim-stat-derekter.csv') {
  const XLSX = await loadXlsx();
  const ws = XLSX.utils.json_to_sheet(rowsOf(ds, CLASS_IDS), { header: [...COLUMNS] });
  const csv = XLSX.utils.sheet_to_csv(ws, { FS: ';' });
  download(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), filename);
}

export async function exportTemplate() {
  const XLSX = await loadXlsx();
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([[...COLUMNS], [10, 'O01', 16, 17, 12, 13, 10, 11, 23, 25]]);
  XLSX.utils.book_append_sheet(wb, ws, 'Үлгі');
  XLSX.writeFile(wb, 'bilim-stat-ulgi.xlsx');
}

export function exportJson(obj: unknown, filename: string) {
  download(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }), filename);
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
