import { useMemo, useRef, useState } from 'react';
import { Download, FileSpreadsheet, Plus, RotateCcw, Trash2, Upload } from 'lucide-react';
import { useStore } from '../store';
import { CLASS_IDS, deriveRow, missingMaxes, SCOPE_LABEL, type ClassId, type Score, type StudentRecord } from '../lib/model';
import { exportCsv, exportTemplate, exportXlsx, importFile, type ImportResult } from '../lib/io';
import { fmt } from '../lib/stats';
import { Notice, PageHeader, Segmented } from '../components/ui';

function parseNum(v: string): number | null {
  const t = v.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

function NumInput({ value, onChange, label, invalid, width = 'w-16', placeholder }: { value: number | null; onChange: (v: number | null) => void; label: string; invalid?: boolean; width?: string; placeholder?: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value === null || Number.isNaN(value) ? '' : String(value));
  return (
    <input
      inputMode="decimal"
      aria-label={label}
      aria-invalid={invalid || undefined}
      placeholder={placeholder}
      className={`field ${width} text-center text-ink`}
      value={shown}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== null) {
          const n = parseNum(draft);
          onChange(Number.isNaN(n as number) ? null : n);
        }
        setDraft(null);
      }}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
    />
  );
}

export default function DataPage() {
  const { data, updateRecord, addRecord, removeRecord, setBjbCount, setClassMax, resetData, replaceData } = useStore();
  const [cls, setCls] = useState<ClassId>('9');
  const [pending, setPending] = useState<ImportResult | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cfg = data.classes[cls];
  const recs = data.records.filter((r) => r.classId === cls);
  const rows = useMemo(() => recs.map((r) => deriveRow(r, cfg, 'mean')), [recs, cfg]);
  const missing = missingMaxes(data, cls);
  const errorCount = rows.reduce((s, r) => s + r.issues.filter((i) => i.level === 'error').length, 0);

  const slots: (0 | 1 | 2)[] = cfg.bjbCount === 3 ? [0, 1, 2] : [0, 1];
  const setScore = (r: StudentRecord, slot: 0 | 1 | 2 | 'tjb', patch: Partial<Score>) =>
    updateRecord(r.id, (rec) => {
      if (slot === 'tjb') return { ...rec, tjb: { ...rec.tjb, ...patch } };
      const bjb = [...rec.bjb] as StudentRecord['bjb'];
      bjb[slot] = { ...bjb[slot], ...patch };
      return { ...rec, bjb };
    });

  const commonMax = (slot: 0 | 1 | 2 | 'tjb') => {
    const vals = recs.map((r) => (slot === 'tjb' ? r.tjb.max : r.bjb[slot].max));
    return vals.length && vals.every((v) => v === vals[0]) ? vals[0] : null;
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      setPending(await importFile(f));
    } catch {
      setPending({ records: [], errors: ['Файлды оқу мүмкін болмады. Excel (.xlsx) немесе CSV форматын қолданыңыз.'], bjbCount: {} });
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const applyImport = (mode: 'replace' | 'append') => {
    if (!pending) return;
    const classesInFile = new Set(pending.records.map((r) => r.classId));
    const kept = mode === 'replace' ? data.records.filter((r) => !classesInFile.has(r.classId)) : data.records;
    const classes = { ...data.classes };
    for (const [c, n] of Object.entries(pending.bjbCount)) {
      const k = c as ClassId;
      classes[k] = { bjbCount: mode === 'append' ? (Math.max(classes[k].bjbCount, n!) as 2 | 3) : n! };
    }
    replaceData({ ...data, records: [...kept, ...pending.records], classes });
    setPending(null);
  };

  return (
    <div>
      <PageHeader
        step={1}
        title="Нақты деректер"
        lead="БЖБ мен ТЖБ баллдары сынып бойынша енгізіледі. Оқушылар тек кодпен белгіленеді — аты-жөні қажет емес. Ең жоғары баллдар әртүрлі болуы қалыпты: салыстыру үшін әр балл пайызға айналдырылады."
      />

      <div className="no-print mb-5 flex flex-wrap items-center gap-2">
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl border border-grid-strong bg-white px-3.5 py-2 text-sm font-medium text-ink hover:border-sky">
          <Upload className="h-4 w-4 text-blue" /> Excel / CSV импорттау
        </button>
        <button onClick={() => exportXlsx(data)} className="inline-flex items-center gap-2 rounded-xl border border-grid-strong bg-white px-3.5 py-2 text-sm font-medium text-ink hover:border-sky">
          <FileSpreadsheet className="h-4 w-4 text-teal" /> Excel-ге экспорттау
        </button>
        <button onClick={() => exportCsv(data)} className="inline-flex items-center gap-2 rounded-xl border border-grid-strong bg-white px-3.5 py-2 text-sm font-medium text-ink hover:border-sky">
          <Download className="h-4 w-4 text-teal" /> CSV-ге экспорттау
        </button>
        <button onClick={exportTemplate} className="rounded-xl px-3.5 py-2 text-sm font-medium text-ink-soft hover:bg-blue-wash">Импорт үлгісін жүктеу</button>
        <span className="flex-1" />
        <button onClick={() => setConfirmReset(true)} className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium text-rose hover:bg-rose-wash">
          <RotateCcw className="h-4 w-4" /> Бастапқы деректерге қайтару
        </button>
      </div>

      {confirmReset && (
        <div className="mb-5">
          <Notice tone="warn" title="Барлық өзгерістер өшіріледі">
            Енгізілген және импортталған деректер бастапқы зерттеу деректерімен ауыстырылады.
            <div className="mt-3 flex gap-2">
              <button onClick={() => { resetData(); setConfirmReset(false); }} className="rounded-lg bg-rose px-3 py-1.5 text-sm font-semibold text-white">Иә, қайтару</button>
              <button onClick={() => setConfirmReset(false)} className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink hover:bg-white">Болдырмау</button>
            </div>
          </Notice>
        </div>
      )}

      {pending && (
        <div className="mb-5">
          <Notice tone={pending.records.length ? 'info' : 'error'} title={pending.records.length ? `Файлда ${pending.records.length} жазба табылды` : 'Импорт сәтсіз'}>
            {pending.records.length > 0 && (
              <div>Сыныптар: {[...new Set(pending.records.map((r) => r.classId))].sort().map((c) => SCOPE_LABEL[c]).join(', ')}</div>
            )}
            {pending.errors.length > 0 && <ul className="mt-1 list-disc pl-5">{pending.errors.slice(0, 8).map((e) => <li key={e}>{e}</li>)}</ul>}
            <div className="mt-3 flex flex-wrap gap-2">
              {pending.records.length > 0 && (
                <>
                  <button onClick={() => applyImport('replace')} className="rounded-lg bg-blue px-3 py-1.5 text-sm font-semibold text-white">Осы сыныптардың деректерін ауыстыру</button>
                  <button onClick={() => applyImport('append')} className="rounded-lg border border-blue px-3 py-1.5 text-sm font-semibold text-blue">Бар деректерге қосу</button>
                </>
              )}
              <button onClick={() => setPending(null)} className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink hover:bg-white">Болдырмау</button>
            </div>
          </Notice>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <Segmented label="Сынып" value={cls} onChange={setCls} options={CLASS_IDS.map((c) => ({ value: c, label: `${SCOPE_LABEL[c]} · ${data.records.filter((r) => r.classId === c).length}` }))} />
        <label className="inline-flex items-center gap-2 text-sm text-ink-soft">
          <input type="checkbox" className="h-4 w-4 accent-blue" checked={cfg.bjbCount === 3} onChange={(e) => setBjbCount(cls, e.target.checked ? 3 : 2)} />
          БЖБ 3 бар
        </label>
      </div>

      {missing.length > 0 && (
        <div className="mb-4">
          <Notice tone="warn" title={`${SCOPE_LABEL[cls]}: ең жоғары балл расталмаған (${missing.join(', ')})`}>
            Ең жоғары балл белгісіз болғандықтан, бұл баллдар пайызға айналдырылмайды және модельге кірмейді. Ойдан шығарылған мән қойылмайды — нақты ең жоғары баллды кестенің жоғарғы жолына енгізіңіз.
          </Notice>
        </div>
      )}

      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-grid-strong bg-paper text-left text-ink-soft">
              <th className="px-3 py-3 font-semibold">Оқушы коды</th>
              {slots.map((s) => <th key={s} className="px-2 py-3 text-center font-semibold text-blue">БЖБ {s + 1}</th>)}
              <th className="px-2 py-3 text-center font-semibold text-teal">ТЖБ</th>
              <th className="px-2 py-3 text-left font-semibold">Пайыз, %</th>
              <th className="w-10" />
            </tr>
            <tr className="border-b border-grid-strong bg-paper/60 text-ink-faint">
              <td className="px-3 pb-3 text-xs">Ең жоғары балл (барлығына)</td>
              {slots.map((s) => {
                const cm = commonMax(s);
                return (
                  <td key={s} className="px-2 pb-3 text-center">
                    <NumInput label={`БЖБ ${s + 1} ең жоғары балл, барлық оқушыға`} value={cm} onChange={(v) => setClassMax(cls, s, v)} invalid={cm === null && recs.some((r) => r.bjb[s].max === null)} placeholder="макс." />
                  </td>
                );
              })}
              <td className="px-2 pb-3 text-center">
                <NumInput label="ТЖБ ең жоғары балл, барлық оқушыға" value={commonMax('tjb')} onChange={(v) => setClassMax(cls, 'tjb', v)} placeholder="макс." />
              </td>
              <td colSpan={2} />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ rec, bjbPct, tjbPct, issues }) => (
              <tr key={rec.id} className="border-b border-grid last:border-0 align-top">
                <td className="px-3 py-2.5">
                  <input aria-label="Оқушы коды" className="field w-20 font-semibold text-ink" value={rec.code} onChange={(e) => updateRecord(rec.id, (r) => ({ ...r, code: e.target.value }))} />
                  {(() => {
                    // Ең жоғары балл жоқ қатесі жоғарыдағы ескертуде бір рет көрсетіледі
                    const shown = issues.filter((i) => !(missing.length && i.text.includes('ең жоғары балл енгізілмеген')));
                    return shown.length > 0 && (
                      <ul className="mt-1.5 max-w-[16rem] space-y-0.5 text-xs">
                        {shown.map((i) => <li key={i.text} className={i.level === 'error' ? 'text-rose' : 'text-amber'}>{i.text}</li>)}
                      </ul>
                    );
                  })()}
                </td>
                {slots.map((s) => (
                  <td key={s} className="px-2 py-2.5 text-center">
                    <div className="inline-flex items-center gap-1">
                      <NumInput label={`${rec.code} БЖБ ${s + 1} балл`} value={rec.bjb[s].score} onChange={(v) => setScore(rec, s, { score: v })} invalid={issues.some((i) => i.field === `БЖБ ${s + 1}` && i.level === 'error')} />
                      <span className="text-ink-faint">/</span>
                      <NumInput label={`${rec.code} БЖБ ${s + 1} ең жоғары балл`} value={rec.bjb[s].max} onChange={(v) => setScore(rec, s, { max: v })} width="w-14" placeholder="?" invalid={rec.bjb[s].max === null && rec.bjb[s].score !== null} />
                    </div>
                  </td>
                ))}
                <td className="px-2 py-2.5 text-center">
                  <div className="inline-flex items-center gap-1">
                    <NumInput label={`${rec.code} ТЖБ балл`} value={rec.tjb.score} onChange={(v) => setScore(rec, 'tjb', { score: v })} invalid={issues.some((i) => i.field === 'ТЖБ' && i.level === 'error')} />
                    <span className="text-ink-faint">/</span>
                    <NumInput label={`${rec.code} ТЖБ ең жоғары балл`} value={rec.tjb.max} onChange={(v) => setScore(rec, 'tjb', { max: v })} width="w-14" placeholder="?" />
                  </div>
                </td>
                <td className="px-2 py-2.5 text-xs leading-relaxed text-ink-soft num">
                  {bjbPct.map((p, i) => <div key={i}>БЖБ {i + 1}: {p === null ? '—' : fmt(p, 1)}</div>)}
                  <div className="font-semibold text-teal">ТЖБ: {tjbPct === null ? '—' : fmt(tjbPct, 1)}</div>
                </td>
                <td className="px-1 py-2.5">
                  <button onClick={() => removeRecord(rec.id)} aria-label={`${rec.code} жазбасын жою`} className="rounded-lg p-2 text-ink-faint hover:bg-rose-wash hover:text-rose">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-grid-strong px-3 py-3">
          <button onClick={() => addRecord(cls)} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-blue hover:bg-blue-wash">
            <Plus className="h-4 w-4" /> Оқушы қосу
          </button>
          <span className="text-sm text-ink-faint">
            {recs.length} жазба, {errorCount > 0 ? `${errorCount} қате` : 'қате жоқ'}. Деректер осы браузерде автоматты сақталады.
          </span>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Notice tone="info" title="Пайызға айналдыру">
          Әр балл өз ең жоғары баллына бөлінеді: 16/17 → 94,1%. Сондықтан 17, 13 және 11 балдық жұмыстарды бір шкалада салыстыруға болады.
        </Notice>
        <Notice tone="info" title="Жеке деректер">
          Кестеде аты-жөні жоқ, тек O01, O02 сияқты кодтар. Деректер серверге жіберілмейді, тек осы браузерде сақталады.
        </Notice>
      </div>
    </div>
  );
}
