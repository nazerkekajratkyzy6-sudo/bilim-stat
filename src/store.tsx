import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { VarianceKind } from './lib/stats';
import {
  DEFAULT_THRESHOLDS, type ClassId, type Dataset, type Feature, type RiskThresholds, type Scope, type StudentRecord,
} from './lib/model';
import { seedDataset } from './data/seed';

const KEY_DATA = 'bilim-stat:dataset:v1';
const KEY_SETTINGS = 'bilim-stat:settings:v1';

export interface Settings {
  scope: Scope;
  feature: Feature;
  varianceKind: VarianceKind;
  thresholds: RiskThresholds;
}

const DEFAULT_SETTINGS: Settings = {
  scope: '11',
  feature: 'mean',
  varianceKind: 'sample',
  thresholds: DEFAULT_THRESHOLDS,
};

function load<T>(key: string, fallback: () => T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback();
    return JSON.parse(raw) as T;
  } catch {
    return fallback();
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* сақтау мүмкін емес (жеке режим) — деректер жадта қалады */
  }
}

interface Store {
  data: Dataset;
  settings: Settings;
  setSettings: (patch: Partial<Settings>) => void;
  updateRecord: (id: string, fn: (r: StudentRecord) => StudentRecord) => void;
  addRecord: (classId: ClassId) => void;
  removeRecord: (id: string) => void;
  setBjbCount: (classId: ClassId, n: 2 | 3) => void;
  setClassMax: (classId: ClassId, slot: 0 | 1 | 2 | 'tjb', max: number | null) => void;
  replaceData: (d: Dataset) => void;
  resetData: () => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Dataset>(() => {
    const d = load<Dataset | null>(KEY_DATA, () => null);
    return d && d.version === 1 && Array.isArray(d.records) ? d : seedDataset();
  });
  const [settings, setSettingsState] = useState<Settings>(() => ({ ...DEFAULT_SETTINGS, ...load(KEY_SETTINGS, () => ({})) }));

  useEffect(() => save(KEY_DATA, data), [data]);
  useEffect(() => save(KEY_SETTINGS, settings), [settings]);

  const setSettings = useCallback((patch: Partial<Settings>) => setSettingsState((s) => ({ ...s, ...patch })), []);

  const updateRecord = useCallback((id: string, fn: (r: StudentRecord) => StudentRecord) => {
    setData((d) => ({ ...d, records: d.records.map((r) => (r.id === id ? fn(r) : r)) }));
  }, []);

  const addRecord = useCallback((classId: ClassId) => {
    setData((d) => {
      const same = d.records.filter((r) => r.classId === classId);
      const tmpl = same[same.length - 1];
      const used = new Set(same.map((r) => r.code));
      let k = same.length + 1;
      while (used.has(`O${String(k).padStart(2, '0')}`)) k++;
      const code = `O${String(k).padStart(2, '0')}`;
      const rec: StudentRecord = {
        id: `${classId}-${code}-${Date.now().toString(36)}`,
        classId,
        code,
        bjb: [0, 1, 2].map((i) => ({ score: null, max: tmpl ? tmpl.bjb[i].max : null })) as StudentRecord['bjb'],
        tjb: { score: null, max: tmpl ? tmpl.tjb.max : null },
      };
      return { ...d, records: [...d.records, rec] };
    });
  }, []);

  const removeRecord = useCallback((id: string) => setData((d) => ({ ...d, records: d.records.filter((r) => r.id !== id) })), []);

  const setBjbCount = useCallback((classId: ClassId, n: 2 | 3) => {
    setData((d) => ({ ...d, classes: { ...d.classes, [classId]: { bjbCount: n } } }));
  }, []);

  const setClassMax = useCallback((classId: ClassId, slot: 0 | 1 | 2 | 'tjb', max: number | null) => {
    setData((d) => ({
      ...d,
      records: d.records.map((r) => {
        if (r.classId !== classId) return r;
        if (slot === 'tjb') return { ...r, tjb: { ...r.tjb, max } };
        const bjb = [...r.bjb] as StudentRecord['bjb'];
        bjb[slot] = { ...bjb[slot], max };
        return { ...r, bjb };
      }),
    }));
  }, []);

  const replaceData = useCallback((d: Dataset) => setData(d), []);
  const resetData = useCallback(() => setData(seedDataset()), []);

  const value = useMemo(
    () => ({ data, settings, setSettings, updateRecord, addRecord, removeRecord, setBjbCount, setClassMax, replaceData, resetData }),
    [data, settings, setSettings, updateRecord, addRecord, removeRecord, setBjbCount, setClassMax, replaceData, resetData],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider жоқ');
  return s;
}

/* ───── Қарапайым hash-маршрутизатор ───── */

export type Route =
  | 'home' | 'data' | 'stats' | 'model' | 'compare' | 'stability' | 'risk' | 'optimize' | 'report' | 'defense';

const ROUTES: Route[] = ['home', 'data', 'stats', 'model', 'compare', 'stability', 'risk', 'optimize', 'report', 'defense'];

function parse(): Route {
  const h = window.location.hash.replace(/^#\/?/, '');
  return (ROUTES as string[]).includes(h) ? (h as Route) : 'home';
}

export function useRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(parse);
  useEffect(() => {
    const on = () => {
      setRoute(parse());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const go = useCallback((r: Route) => {
    window.location.hash = r === 'home' ? '/' : `/${r}`;
  }, []);
  return [route, go];
}
