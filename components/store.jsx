'use client';
/**
 * ศูนย์กลางสถานะของแอปทั้งหมด
 *
 * ข้อมูลอยู่ใน Supabase (Postgres + RLS) ผู้ใช้แต่ละคนเห็นเฉพาะข้อมูลของตัวเอง
 * ทุกการแก้ไขอัปเดตหน้าจอทันทีก่อน (optimistic) แล้วค่อยเขียนลงฐานข้อมูล
 * ถ้าเขียนไม่สำเร็จจะแจ้งเตือนแล้วดึงข้อมูลจริงกลับมาทับ เพื่อไม่ให้หน้าจอค้างข้อมูลผิด
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase, isSupabaseConfigured, authErrorText } from '@/lib/supabase';
import { DEFAULT_SETTINGS, THEME_CACHE_KEY, VIEW_ALL_KEY, emptyState } from '@/lib/defaults';
import * as db from '@/lib/db';
import { setStorageUser, imgDel, gcImages } from '@/lib/storage';
import { avgMonthlySpend, dueList, sortDesc } from '@/lib/calc';
import { filterByRange, previousRange, resolveRange } from '@/lib/period';
import { displayNameOf, savedNameOf, uuid } from '@/lib/format';
import { readLegacy } from '@/lib/legacy';
import { DEFAULT_LANG, readLang, saveLang, setCurrentLang, translate } from '@/lib/i18n';

const StoreCtx = createContext(null);

/** ความยาวชื่อผู้ใช้สูงสุด — ยาวกว่านี้แถบบนก็ตัดด้วย ellipsis อยู่ดี */
export const NAME_MAX = 40;

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

const readLocal = (key, fallback = null) => {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};
const writeLocal = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch { /* โหมดส่วนตัวบางเบราว์เซอร์เขียนไม่ได้ */ }
};

export function StoreProvider({ children }) {
  const [phase, setPhase] = useState('loading'); // loading | unconfigured | anon | ready
  const [user, setUser] = useState(null);
  const [data, setData] = useState(emptyState);
  const [dataLoading, setDataLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [dark, setDark] = useState(false);
  // เริ่มที่ภาษาไทยเสมอให้ตรงกับที่เซิร์ฟเวอร์เรนเดอร์ แล้วค่อยสลับตามที่เก็บไว้หลัง mount
  const [lang, setLangState] = useState(DEFAULT_LANG);
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  // ค่าที่กรอกค้างไว้ตอนสลับจาก Quick Add ไปฟอร์มเต็ม (หรือจากแถบเมนูเข้า Quick Add)
  const [quickDraft, setQuickDraft] = useState(null);
  // หน้าต่างเปลี่ยนรหัสผ่าน — เปิดได้ทั้งจากเมนูโปรไฟล์และหน้าบัญชี
  const [pwOpen, setPwOpen] = useState(false);
  // แผงผู้ช่วย AI — เปิดจากปุ่มลอยหรือเมนูโปรไฟล์
  const [chatOpen, setChatOpen] = useState(false);
  // หน้าต่างตั้งชื่อผู้ใช้ — เปิดได้ทั้งจากเมนูโปรไฟล์และหน้าบัญชี
  const [nameOpen, setNameOpen] = useState(false);
  const [viewAllCars, setViewAllCars] = useState(false);
  const [legacyFound, setLegacyFound] = useState(null);
  // ช่วงเวลาที่เลือกบนแถบบน — ใช้ร่วมกันทั้งแดชบอร์ด สถิติ และหน้าวิเคราะห์
  const [period, setPeriodState] = useState({ key: 'month', from: null, to: null });

  const dataRef = useRef(data);
  dataRef.current = data;
  // เก็บกวาดรูปกำพร้าแค่ครั้งเดียวต่อเซสชัน ไม่งั้นจะไปลบรูปที่เพิ่งแนบในฟอร์มที่ยังไม่บันทึก
  const gcDone = useRef(false);

  /* ---------------- toast / confirm ---------------- */
  const toast = useCallback((message, isErr = false) => {
    const id = uuid();
    setToasts((t) => [...t, { id, message, isErr }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
  }, []);
  const confirm = useCallback((title, message, onConfirm) => {
    setConfirmState({ title, message, onConfirm });
  }, []);

  /* ---------------- โหลดข้อมูลของผู้ใช้ ---------------- */
  const reload = useCallback(async (uid) => {
    if (!uid) return;
    setDataLoading(true);
    setLoadError(null);
    try {
      const next = await db.fetchAll(uid);
      setData(next);
      writeLocal(THEME_CACHE_KEY, next.settings.theme || 'auto');
      if (!gcDone.current) {
        gcDone.current = true;
        gcImages(next).catch(() => {});
      }
    } catch (e) {
      setLoadError(e.message);
    } finally {
      setDataLoading(false);
    }
  }, []);

  /* ---------------- ติดตามสถานะการเข้าสู่ระบบ ---------------- */
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setPhase('unconfigured');
      return;
    }
    setViewAllCars(readLocal(VIEW_ALL_KEY) === '1');

    let alive = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!alive) return;
      setUser(session?.user ?? null);
      setPhase(session?.user ? 'ready' : 'anon');
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setPhase(session?.user ? 'ready' : 'anon');
    });
    return () => {
      alive = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  /* ---------------- เมื่อผู้ใช้เปลี่ยน ให้โหลด/ล้างข้อมูล ---------------- */
  /**
   * ผูกกับ user.id ไม่ใช่ตัว user ทั้งก้อน
   * เพราะ Supabase สร้างอ็อบเจ็กต์ผู้ใช้ขึ้นใหม่ทุกครั้งที่ต่ออายุ token และทุกครั้งที่แก้โปรไฟล์
   * ถ้าผูกทั้งก้อน แค่เปลี่ยนชื่อผู้ใช้ก็จะดึงข้อมูลใหม่ทั้งชุดและหน้าจอกระพริบเป็น "กำลังโหลด"
   * ทั้งที่ยังเป็นผู้ใช้คนเดิมและข้อมูลไม่ได้เปลี่ยนอะไรเลย
   */
  const userId = user?.id ?? null;
  useEffect(() => {
    setStorageUser(userId);
    if (!userId) {
      setData(emptyState());
      setLegacyFound(null);
      return;
    }
    reload(userId);
    setLegacyFound(readLegacy());
  }, [userId, reload]);

  /* ---------------- ภาษา (ไทย / อังกฤษ) ---------------- */
  // อ่านจาก localStorage หลัง mount ไม่ใช่ตอนตั้งค่าเริ่มต้นของ state
  // เพราะเซิร์ฟเวอร์เรนเดอร์ครั้งแรกเป็นภาษาไทยเสมอ ถ้าอ่านตั้งแต่แรกจะไม่ตรงกันแล้ว hydration พัง
  useEffect(() => {
    const saved = readLang();
    setCurrentLang(saved);
    setLangState(saved);
    document.documentElement.lang = saved;
  }, []);

  const setLang = useCallback((code) => {
    setCurrentLang(code);
    saveLang(code);
    setLangState(code);
    document.documentElement.lang = code;
  }, []);

  /**
   * ตัวแปลที่คอมโพเนนต์เรียกใช้
   * ผูก lang ไว้ใน dependency เพื่อให้ทุกที่ที่ใช้ t วาดใหม่ตอนสลับภาษา
   */
  const t = useCallback((text, vars) => translate(text, vars, lang), [lang]);

  /* ---------------- ธีม (Dark / Light / ตามระบบ) ---------------- */
  useEffect(() => {
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
  }, [data.settings.theme]);

  /* ================================ auth ================================ */
  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return error ? authErrorText(error) : null;
  }, []);

  const signUp = useCallback(async (email, password) => {
    const { data: res, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined },
    });
    if (error) return { error: authErrorText(error) };
    // ถ้าโปรเจกต์เปิดยืนยันอีเมลไว้ จะยังไม่มี session กลับมา
    return { needsConfirm: !res.session };
  }, []);

  const resetPassword = useCallback(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
    });
    return error ? authErrorText(error) : null;
  }, []);

  const changePassword = useCallback(async (password) => {
    const { error } = await supabase.auth.updateUser({ password });
    return error ? authErrorText(error) : null;
  }, []);

  /* ---------------- ชื่อผู้ใช้ที่แสดงบนหน้าจอ ---------------- */
  /**
   * เก็บไว้ใน user_metadata ของ Supabase Auth ไม่ใช่ตาราง settings
   *
   * ตาราง settings เป็นคอลัมน์ตายตัว ถ้าเพิ่มคอลัมน์ใหม่แล้วผู้ใช้ยังไม่ได้รัน SQL
   * การบันทึกค่าตั้งค่า "ทุกตัว" จะพังหมด ไม่ใช่แค่ชื่อ — ทางนี้ไม่ต้องรัน SQL เลย
   * และชื่อจะติดตามไปทุกเครื่องที่ล็อกอินบัญชีเดียวกัน
   */
  // ผูก lang ไว้ด้วย เพราะคำสำรอง "ผู้ใช้" ต้องเปลี่ยนตามภาษาที่เลือก
  const displayName = useMemo(() => displayNameOf(user), [user, lang]);
  const savedName = savedNameOf(user);

  const saveDisplayName = useCallback(async (name) => {
    const { data: res, error } = await supabase.auth.updateUser({
      data: { display_name: String(name || '').trim().slice(0, NAME_MAX) },
    });
    if (error) return authErrorText(error);
    // อัปเดตทันทีไม่ต้องรอ onAuthStateChange จะได้เห็นชื่อใหม่บนแถบบนทันทีที่กดบันทึก
    if (res?.user) setUser(res.user);
    return null;
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setData(emptyState());
  }, []);

  /* ========================= เขียนข้อมูล (optimistic) ========================= */

  /** อัปเดตหน้าจอก่อน แล้วเขียนลงฐานข้อมูล — ถ้าพลาดให้ดึงข้อมูลจริงกลับมาทับ */
  const persist = useCallback(
    async (optimistic, write) => {
      if (!user) return;
      const before = dataRef.current;
      setData(optimistic(before));
      try {
        await write(user.id);
      } catch (e) {
        toast(e.message, true);
        reload(user.id);
      }
    },
    [user, toast, reload]
  );

  const saveSession = useCallback(
    (s) => {
      const item = { ...s, id: s.id || uuid(), created: s.created || Date.now() };
      persist(
        (d) => ({ ...d, sessions: upsert(d.sessions, item) }),
        (uid) => db.upsertSession(item, uid)
      );
      return item.id;
    },
    [persist]
  );
  const deleteSession = useCallback(
    (id) => {
      const target = dataRef.current.sessions.find((s) => s.id === id);
      (target?.images || []).forEach((p) => imgDel(p));
      persist(
        (d) => ({ ...d, sessions: d.sessions.filter((s) => s.id !== id) }),
        () => db.deleteSessionRow(id)
      );
    },
    [persist]
  );

  const saveCost = useCallback(
    (c) => {
      const item = { ...c, id: c.id || uuid() };
      persist(
        (d) => ({ ...d, costs: upsert(d.costs, item) }),
        (uid) => db.upsertCost(item, uid)
      );
    },
    [persist]
  );
  const deleteCost = useCallback(
    (id) => {
      const target = dataRef.current.costs.find((c) => c.id === id);
      (target?.images || []).forEach((p) => imgDel(p));
      persist(
        (d) => ({ ...d, costs: d.costs.filter((c) => c.id !== id) }),
        () => db.deleteCostRow(id)
      );
    },
    [persist]
  );

  const saveCar = useCallback(
    (c) => {
      const item = { ...c, id: c.id || uuid() };
      const isFirst = dataRef.current.cars.length === 0;
      persist(
        (d) => ({
          ...d,
          cars: upsert(d.cars, item),
          settings: { ...d.settings, activeCar: d.settings.activeCar || item.id },
        }),
        async (uid) => {
          await db.upsertCar(item, uid);
          if (isFirst) await db.upsertSettings({ ...dataRef.current.settings, activeCar: item.id }, uid);
        }
      );
    },
    [persist]
  );
  const deleteCar = useCallback(
    (id) => {
      persist(
        (d) => {
          const cars = d.cars.filter((c) => c.id !== id);
          const activeCar = d.settings.activeCar === id ? (cars[0] ? cars[0].id : null) : d.settings.activeCar;
          return {
            ...d,
            cars,
            // ฐานข้อมูลลบให้เองด้วย on delete cascade — ตรงนี้แค่ทำให้หน้าจอตรงกัน
            sessions: d.sessions.filter((s) => s.carId !== id),
            costs: d.costs.filter((c) => c.carId !== id),
            alerts: d.alerts.filter((a) => a.carId !== id),
            settings: { ...d.settings, activeCar },
          };
        },
        () => db.deleteCarRow(id)
      );
    },
    [persist]
  );

  const saveAlert = useCallback(
    (a) => {
      const item = { ...a, id: a.id || uuid() };
      persist(
        (d) => ({ ...d, alerts: upsert(d.alerts, item) }),
        (uid) => db.upsertAlert(item, uid)
      );
    },
    [persist]
  );
  const deleteAlert = useCallback(
    (id) => {
      persist(
        (d) => ({ ...d, alerts: d.alerts.filter((a) => a.id !== id) }),
        () => db.deleteAlertRow(id)
      );
    },
    [persist]
  );

  const setSettings = useCallback(
    (partial) => {
      if (partial.theme) writeLocal(THEME_CACHE_KEY, partial.theme);
      persist(
        (d) => ({ ...d, settings: { ...d.settings, ...partial } }),
        (uid) => db.upsertSettings({ ...dataRef.current.settings, ...partial }, uid)
      );
    },
    [persist]
  );

  const toggleTheme = useCallback(() => {
    const cur = dataRef.current.settings.theme || 'auto';
    const isDark = cur === 'dark' || (cur === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    setSettings({ theme: isDark ? 'light' : 'dark' });
  }, [setSettings]);

  /** เลือกดูรถคันเดียว หรือ "รถทุกคัน" (อย่างหลังเป็นค่าประจำเครื่อง ไม่เก็บในฐานข้อมูล) */
  const setActiveCar = useCallback(
    (value) => {
      if (value === '__all__') {
        setViewAllCars(true);
        writeLocal(VIEW_ALL_KEY, '1');
        return;
      }
      setViewAllCars(false);
      writeLocal(VIEW_ALL_KEY, '0');
      setSettings({ activeCar: value });
    },
    [setSettings]
  );

  const wipeAll = useCallback(() => {
    if (!user) return;
    setData((d) => ({ ...emptyState(), settings: { ...d.settings, activeCar: null } }));
    db.deleteEverything(user.id).catch((e) => {
      toast(e.message, true);
      reload(user.id);
    });
  }, [user, toast, reload]);

  /* ---------------- ข้อมูลที่คำนวณจาก state ---------------- */
  const activeCar = useMemo(() => {
    if (viewAllCars) return null;
    return data.cars.find((c) => c.id === data.settings.activeCar) || data.cars[0] || null;
  }, [data.cars, data.settings.activeCar, viewAllCars]);

  const showAllCars = viewAllCars || !activeCar;

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

  /* ---------------- กรองตามช่วงเวลาที่เลือกบนแถบบน ---------------- */
  const setPeriod = useCallback((key, custom) => {
    setPeriodState({ key, from: custom?.from ?? null, to: custom?.to ?? null });
  }, []);
  const range = useMemo(
    () => resolveRange(period.key, { from: period.from, to: period.to }),
    [period]
  );
  const prevRange = useMemo(() => previousRange(range), [range]);

  const periodSessions = useMemo(() => filterByRange(sessions, range), [sessions, range]);
  const periodCosts = useMemo(() => filterByRange(costs, range), [costs, range]);
  const prevSessions = useMemo(
    () => (prevRange ? filterByRange(sessions, prevRange) : []),
    [sessions, prevRange]
  );
  const prevCosts = useMemo(
    () => (prevRange ? filterByRange(costs, prevRange) : []),
    [costs, prevRange]
  );

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
    phase, user, data, dataLoading, loadError, reload,
    signIn, signUp, resetPassword, changePassword, logout,
    toast, toasts, confirm, confirmState, setConfirmState,
    lightbox, setLightbox,
    quickOpen, setQuickOpen,
    quickDraft, setQuickDraft,
    pwOpen, setPwOpen,
    chatOpen, setChatOpen,
    nameOpen, setNameOpen,
    displayName, savedName, saveDisplayName,
    editingId, setEditingId,
    dark, toggleTheme, setSettings, setActiveCar,
    lang, setLang, t,
    saveSession, deleteSession,
    saveCost, deleteCost,
    saveCar, deleteCar,
    saveAlert, deleteAlert,
    wipeAll,
    legacyFound, setLegacyFound,
    cars: data.cars, settings: data.settings,
    sessions, costs, alerts, activeCar, showAllCars, viewAllCars, carName,
    due, budgetOver, alertCount,
    period, setPeriod, range, prevRange,
    periodSessions, periodCosts, prevSessions, prevCosts,
  };

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export { DEFAULT_SETTINGS };
