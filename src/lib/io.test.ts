import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { importFile } from './io';

function fileFrom(aoa: (string | number | null)[][], name: string, type: 'xlsx' | 'csv') {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'S');
  const out = XLSX.write(wb, { type: 'array', bookType: type });
  return new File([out], name);
}

describe('Excel/CSV импорт', () => {
  it('Excel файлынан жазбаларды оқиды, БЖБ 3-ті анықтайды', async () => {
    const f = fileFrom([
      ['Сынып', 'Оқушы коды', 'БЖБ 1', 'БЖБ 1 ең жоғары балл', 'БЖБ 2', 'БЖБ 2 ең жоғары балл', 'БЖБ 3', 'БЖБ 3 ең жоғары балл', 'ТЖБ', 'ТЖБ ең жоғары балл'],
      [10, 'O01', 16, 17, 12, 13, 10, 11, 23, 25],
      [10, 'O02', 13, 17, 9, 13, 8, 11, 20, 25],
    ], 't.xlsx', 'xlsx');
    const r = await importFile(f);
    expect(r.errors).toEqual([]);
    expect(r.records).toHaveLength(2);
    expect(r.records[0].bjb[2]).toEqual({ score: 10, max: 11 });
    expect(r.bjbCount['10']).toBe(3);
  });
  it('орысша баған атаулары мен үтірлі сандар (CSV)', async () => {
    const f = fileFrom([['Класс', 'Код', 'СОР1', 'СОР2', 'СОЧ'], ['11', 'A1', '13', '16', '23,5']], 't.csv', 'csv');
    const r = await importFile(f);
    expect(r.records[0].tjb.score).toBe(23.5);
    expect(r.records[0].bjb[0].max).toBeNull();
  });
  it('қате сынып көрсетіледі', async () => {
    const f = fileFrom([['Сынып', 'Оқушы коды', 'БЖБ 1', 'ТЖБ'], [7, 'O01', 5, 10]], 't.xlsx', 'xlsx');
    const r = await importFile(f);
    expect(r.records).toHaveLength(0);
    expect(r.errors[0]).toMatch(/9, 10 немесе 11/);
  });
});

describe('Экспорттан кейін қайта импорт', () => {
  it('нүктелі үтірмен бөлінген CSV (экспорт форматы)', async () => {
    const csv = '﻿Сынып;Оқушы коды;БЖБ 1;БЖБ 1 ең жоғары балл;БЖБ 2;БЖБ 2 ең жоғары балл;БЖБ 3;БЖБ 3 ең жоғары балл;ТЖБ;ТЖБ ең жоғары балл\n11;O01;13;14;16;18;;;23;25\n';
    const r = await importFile(new File([csv], 'd.csv'));
    expect(r.errors).toEqual([]);
    expect(r.records[0].bjb[1]).toEqual({ score: 16, max: 18 });
    expect(r.records[0].tjb).toEqual({ score: 23, max: 25 });
    expect(r.bjbCount['11']).toBe(2);
  });
});
