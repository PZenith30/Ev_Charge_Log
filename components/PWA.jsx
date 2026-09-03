'use client';
/**
 * ส่วนที่ทำให้เว็ปติดตั้งลงเครื่องได้
 *  - ลงทะเบียน service worker (public/sw.js)
 *  - ดักเหตุการณ์ beforeinstallprompt แล้วเก็บไว้ให้ผู้ใช้กดติดตั้งเมื่อพร้อม
 *    (เบราว์เซอร์ให้เรียก prompt() ได้เฉพาะตอนผู้ใช้กดอะไรสักอย่างเท่านั้น)
 *  - แจ้งเมื่อมีเวอร์ชันใหม่รออยู่ พร้อมปุ่มโหลดทันที
 *
 * iOS ไม่มี beforeinstallprompt จึงต้องบอกวิธีติดตั้งด้วยข้อความแทน
 */
import { useEffect, useState } from 'react';
import Icon from './Icon';
import { useStore } from './store';

const DISMISS_KEY = 'evlog.installDismissed';

const isIOS = () =>
  typeof navigator !== 'undefined' &&
  /iphone|ipad|ipod/i.test(navigator.userAgent) &&
  !/crios|fxios/i.test(navigator.userAgent);

const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true);

export default function PWA() {
  const { toast, t } = useStore();
  const [prompt, setPrompt] = useState(null);   // ตัว event ที่เก็บไว้เรียกตอนกดปุ่ม
  const [waiting, setWaiting] = useState(null); // service worker เวอร์ชันใหม่ที่รออยู่
  const [showIOS, setShowIOS] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    // ---------- ลงทะเบียน service worker ----------
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          if (reg.waiting) setWaiting(reg.waiting);
          reg.addEventListener('updatefound', () => {
            const sw = reg.installing;
            if (!sw) return;
            sw.addEventListener('statechange', () => {
              // มีของใหม่พร้อมแล้ว และของเก่ายังทำงานอยู่ = มีเวอร์ชันใหม่รอ
              if (sw.state === 'installed' && navigator.serviceWorker.controller) setWaiting(sw);
            });
          });
        })
        .catch(() => { /* ไม่รองรับหรือถูกบล็อก ก็ใช้เว็ปตามปกติได้ */ });

      let reloading = false;
      const onChange = () => {
        if (reloading) return;
        reloading = true;
        window.location.reload();
      };
      navigator.serviceWorker.addEventListener('controllerchange', onChange);

      // ---------- ปุ่มติดตั้ง ----------
      const onPrompt = (e) => {
        e.preventDefault();
        try {
          if (localStorage.getItem(DISMISS_KEY) === '1') return;
        } catch { /* อ่านไม่ได้ก็แสดงปุ่มไปเลย */ }
        setPrompt(e);
      };
      window.addEventListener('beforeinstallprompt', onPrompt);

      const onInstalled = () => {
        setPrompt(null);
        setShowIOS(false);
        toast('ติดตั้งแอปเรียบร้อย เปิดจากหน้าจอหลักได้เลย');
      };
      window.addEventListener('appinstalled', onInstalled);

      return () => {
        navigator.serviceWorker.removeEventListener('controllerchange', onChange);
        window.removeEventListener('beforeinstallprompt', onPrompt);
        window.removeEventListener('appinstalled', onInstalled);
      };
    }
    return undefined;
  }, [toast]);

  // iOS ไม่ยิง beforeinstallprompt ต้องบอกวิธีเอง
  useEffect(() => {
    if (!isIOS() || isStandalone()) return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === '1') return;
    } catch { /* ไม่เป็นไร */ }
    setShowIOS(true);
  }, []);

  function dismiss() {
    setPrompt(null);
    setShowIOS(false);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch { /* ไม่เป็นไร */ }
  }

  async function install() {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    setPrompt(null);
    if (outcome === 'dismissed') dismiss();
  }

  function update() {
    waiting?.postMessage('SKIP_WAITING');
    setWaiting(null);
  }

  if (waiting) {
    return (
      <div className="pwa-bar">
        <Icon name="refresh" />
        <span>{t('มีเวอร์ชันใหม่พร้อมใช้งาน')}</span>
        <button type="button" className="btn btn-sm btn-primary" onClick={update}>{t('โหลดเลย')}</button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setWaiting(null)}>{t('ไว้ก่อน')}</button>
      </div>
    );
  }

  if (prompt) {
    return (
      <div className="pwa-bar">
        <Icon name="download" />
        <span>{t('ติดตั้งเป็นแอปบนเครื่อง เปิดเร็วขึ้นและใช้เต็มจอ')}</span>
        <button type="button" className="btn btn-sm btn-primary" onClick={install}>{t('ติดตั้ง')}</button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={dismiss}>{t('ไม่เอา')}</button>
      </div>
    );
  }

  if (showIOS) {
    return (
      <div className="pwa-bar">
        <Icon name="download" />
        <span>
          ติดตั้งลงหน้าจอหลัก: กดปุ่มแชร์ใน Safari แล้วเลือก <b>{t('เพิ่มไปยังหน้าจอโฮม')}</b>
        </span>
        <button type="button" className="btn btn-sm btn-ghost" onClick={dismiss}>{t('รับทราบ')}</button>
      </div>
    );
  }

  return null;
}
