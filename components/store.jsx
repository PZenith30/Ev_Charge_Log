'use client';
/**
 * ศูนย์กลางสถานะของแอปทั้งหมด
 * เก็บข้อมูลใน React state แล้ว sync ลง localStorage ทุกครั้งที่เปลี่ยน
 * ข้อมูลถูกโหลดใน useEffect (ไม่ใช่ตอน render) เพื่อไม่ให้ hydration ของ Next.js ไม่ตรงกัน
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AUTH_KEY, DEFAULT_SETTINGS, emptyState, gcImages, imgDel, loadState, migrateSession, saveState } from '@/lib/storage';
import { avgMonthlySpend, dueList, sortDesc } from '@/lib/calc';
import { uid } from '@/lib/format';

const StoreCtx = createContext(null);

export function useStore() {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error('useStore ต้องถูกเรียกภายใน <StoreProvider>');
  return ctx;
}

const upsert = (list, item) => {
  const i = list.findIndex((x) => x.id === item.id);
  if (i < 0) return [...list, item];
  const copy = list.slice();
  copy[i] = item;
  return copy;
};

export function StoreProvider({ children }) {
  const [data, setData] = useState(emptyState);
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [dark, setDark] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const dataRef = useRef(data);
  dataRef.current = data;
  const skipFirstSave = useRef(true);

  /* ---------------- toast / confirm ---------------- */
  const toast = useCallback((message, isErr = false) => {
    const id = uid();
    setToasts((t) => [...t, { id, message, isErr }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);
  const confirm = useCallback((title, message, onConfirm) => {
    setConfirmState({ title, message, onConfirm });
  }, []);

  /* ---------------- โหลดข้อมูลครั้งแรก ---------------- */
  useEffect(() => {
    const loaded = loadState();
    setData(loaded);
    try {
      setAuthed(sessionStorage.getItem(AUTH_KEY) === '1');
    } catch {
      /* บางเบราว์เซอร์ในโหมดส่วนตัวอ่าน sessionStorage ไม่ได้ */
    }
    setReady(true);
    gcImages(loaded).catch(() => {});
  }, []);

  /* ---------------- บันทึกเมื่อข้อมูลเปลี่ยน ---------------- */
  useEffect(() => {
    if (!ready) return;
    if (skipFirstSave.current) {
      skipFirstSave.current = false;
      return;
    }
    if (!saveState(data)) toast('บันทึกไม่สำเร็จ — พื้นที่เก็บข้อมูลของเบราว์เซอร์เต็ม', true);
  }, [data, ready, toast]);

  /* ---------------- ธีม (Dark / Light / ตามระบบ) ---------------- */
  useEffect(() => {
    if (!ready) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const t = data.settings.theme || 'auto';
      const isDark = t === 'dark' || (t === 'auto' && mq.matches);
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
      setDark(isDark);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [ready, data.settings.theme]);

  /* ---------------- auth (รหัสคงที่ ฝั่งเบราว์เซอร์) ---------------- */
  const login = useCallback((user, pass) => {
    if (user.trim().toLowerCase() === 'admin' && pass === 'Admin') {
      try { sessionStorage.setItem(AUTH_KEY, '1'); } catch { /* ไม่เป็นไร */ }
      setAuthed(true);
      return true;
    }
    return false;
  }, []);
  const logout = useCallback(() => {
    try { sessionStorage.removeItem(AUTH_KEY); } catch { /* ไม่เป็นไร */ }
    setAuthed(false);
  }, []);

  /* ---------------- actions ---------------- */
  const setSettings = useCallback((partial) => {
    setData((d) => ({ ...d, settings: { ...d.settings, ...partial } }));
  }, []);
  const toggleTheme = useCallback(() => {
    setData((d) => {
      const cur = d.settings.theme || 'auto';
      const isDark =
        cur === 'dark' || (cur === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      return { ...d, settings: { ...d.settings, theme: isDark ? 'light' : 'dark' } };
    });
  }, []);

  const saveSession = useCallback((s) => {
    const item = { ...s, id: s.id || uid(), created: s.created || Date.now() };
    setData((d) => ({ ...d, sessions: upsert(d.sessions, item) }));
    return item.id;
  }, []);
  const deleteSession = useCallback((id) => {
    const target = dataRef.current.sessions.find((s) => s.id === id);
    (target?.images || []).forEach((imgId) => imgDel(imgId));
    setData((d) => ({ ...d, sessions: d.sessions.filter((s) => s.id !== id) }));
  }, []);

  const saveCost = useCallback((c) => {
    const item = { ...c, id: c.id || uid() };
    setData((d) => ({ ...d, costs: upsert(d.costs, item) }));
  }, []);
  const deleteCost = useCallback((id) => {
    const target = dataRef.current.costs.find((c) => c.id === id);
    (target?.images || []).forEach((imgId) => imgDel(imgId));
    setData((d) => ({ ...d, costs: d.costs.filter((c) => c.id !== id) }));
  }, []);

  const saveCar = useCallback((c) => {
    const item = { ...c, id: c.id || uid() };
    setData((d) => ({
      ...d,
      cars: upsert(d.cars, item),
      settings: { ...d.settings, activeCar: d.settings.activeCar || item.id },
    }));
  }, []);
  const deleteCar = useCallback((id) => {
    setData((d) => {
      const cars = d.cars.filter((c) => c.id !== id);
      const activeCar = d.settings.activeCar === id ? (cars[0] ? cars[0].id : null) : d.settings.activeCar;
      return {
        ...d,
        cars,
        sessions: d.sessions.filter((s) => s.carId !== id),
        costs: d.costs.filter((c) => c.carId !== id),
        alerts: d.alerts.filter((a) => a.carId !== id),
        settings: { ...d.settings, activeCar },
      };
    });
  }, []);

  const saveAlert = useCallback((a) => {
    const item = { ...a, id: a.id || uid() };
    setData((d) => ({ ...d, alerts: upsert(d.alerts, item) }));
  }, []);
  const deleteAlert = useCallback((id) => {
    setData((d) => ({ ...d, alerts: d.alerts.filter((a) => a.id !== id) }));
  }, []);

  const replaceAll = useCallback((next) => {
    setData({
      cars: next.cars || [],
      sessions: (next.sessions || []).map(migrateSession),
      costs: next.costs || [],
      alerts: next.alerts || [],
      settings: { ...DEFAULT_SETTINGS, ...(next.settings || {}) },
    });
  }, []);
  const wipeAll = useCallback(() => {
    const blank = emptyState();
    gcImages(blank).catch(() => {});
    setData(blank);
  }, []);

  /* ---------------- ข้อมูลที่คำนวณจาก state ---------------- */
  const activeCar = useMemo(() => {
    if (data.settings.activeCar === '__all__') return null;
    return data.cars.find((c) => c.id === data.settings.activeCar) || data.cars[0] || null;
  }, [data.cars, data.settings.activeCar]);

  const showAllCars = data.settings.activeCar === '__all__' || !activeCar;

  const filterByCar = useCallback(
    (list) => (showAllCars ? list : list.filter((x) => !x.carId || x.carId === activeCar.id)),
    [showAllCars, activeCar]
  );

  const sessions = useMemo(() => sortDesc(filterByCar(data.sessions)), [data.sessions, filterByCar]);
  const costs = useMemo(
    () => filterByCar(data.costs).slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    [data.costs, filterByCar]
  );
  const alerts = useMemo(() => filterByCar(data.alerts), [data.alerts, filterByCar]);

  const carName = useCallback((id) => {
    const c = data.cars.find((x) => x.id === id);
    return c ? c.name : '—';
  }, [data.cars]);

  const due = useMemo(() => dueList(alerts, data.settings.advanceDays), [alerts, data.settings.advanceDays]);
  const budgetOver = useMemo(() => {
    const b = Number(data.settings.budget) || 0;
    if (b <= 0) return null;
    const avg = avgMonthlySpend(sessions, costs);
    return avg > b ? { budget: b, avg } : null;
  }, [data.settings.budget, sessions, costs]);
  const alertCount = due.filter((a) => a.level !== 'ok').length + (budgetOver ? 1 : 0);

  const value = {
    ready, data, setData,
    authed, login, logout,
    toast, toasts, confirm, confirmState, setConfirmState,
    lightbox, setLightbox,
    quickOpen, setQuickOpen,
    editingId, setEditingId,
    dark, toggleTheme, setSettings,
    saveSession, deleteSession,
    saveCost, deleteCost,
    saveCar, deleteCar,
    saveAlert, deleteAlert,
    replaceAll, wipeAll,
    cars: data.cars, settings: data.settings,
    sessions, costs, alerts, activeCar, showAllCars, carName,
    due, budgetOver, alertCount,
  };

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}
