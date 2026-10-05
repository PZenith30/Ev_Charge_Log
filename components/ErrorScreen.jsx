'use client';
/**
 * หน้าจอที่ขึ้นเมื่อเว็ปพัง — ใช้ร่วมกันทั้ง error.jsx และ global-error.jsx
 *
 * เขียนด้วย inline style ทั้งหมดโดยตั้งใจ ไม่พึ่ง globals.css เลย
 * เพราะถ้าไฟล์ CSS เองคือต้นเหตุ หน้าจอนี้ก็ต้องยังอ่านออกได้
 * และไม่เรียก useStore เพราะ store อาจเป็นตัวที่พังอยู่
 *
 * เหตุผลที่ต้องมีหน้านี้: ก่อนหน้านี้แอปไม่มี error boundary เลย
 * เวลาพังจึงขึ้นหน้าขาวล้วนที่ไม่บอกอะไร หาสาเหตุไม่ได้ทั้งผู้ใช้และคนแก้โค้ด
 */
import { useEffect, useState } from 'react';

const wrap = {
  minHeight: '100dvh',
  margin: 0,
  padding: 24,
  display: 'grid',
  placeItems: 'center',
  background: '#f7f9fc',
  color: '#111827',
  fontFamily: '"Inter","IBM Plex Sans Thai","Sarabun","Noto Sans Thai","Leelawadee UI",system-ui,sans-serif',
  lineHeight: 1.55,
};
const card = {
  width: '100%',
  maxWidth: 560,
  background: '#fff',
  border: '1px solid #e8edf3',
  borderRadius: 14,
  padding: '26px 24px',
  boxShadow: '0 16px 40px rgba(17,24,39,.13)',
};
const btn = {
  padding: '10px 16px',
  borderRadius: 10,
  border: '1px solid #d3dce6',
  background: '#fff',
  color: '#111827',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};
const btnMain = { ...btn, background: '#15803d', borderColor: '#15803d', color: '#fff' };

export default function ErrorScreen({ error, reset }) {
  const [busy, setBusy] = useState('');

  // ส่งรายละเอียดลง console ด้วย เผื่อผู้ใช้เปิดดูได้ แต่หน้าจอนี้ก็อ่านได้เองโดยไม่ต้องเปิด
  useEffect(() => {
    if (error) console.error('[KiloEV] เว็ปพัง:', error);
  }, [error]);

  /**
   * ล้าง service worker กับแคชทิ้งแล้วโหลดใหม่
   *
   * จำเป็นเพราะถ้า service worker เก็บหน้าเว็ปรุ่นที่พังไว้ การกดรีเฟรชธรรมดา
   * จะได้ของพังกลับมาซ้ำๆ ไม่มีทางออก ปุ่มนี้เป็นทางออกนั้น
   */
  async function hardReload() {
    setBusy('clearing');
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if (typeof caches !== 'undefined') {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch { /* ล้างไม่ได้ก็ยังโหลดใหม่ต่อไป ดีกว่าค้างอยู่ตรงนี้ */ }
    window.location.reload();
  }

  const message = error?.message || String(error || 'ไม่มีรายละเอียดเพิ่มเติม');

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.1em', color: '#b91c1c', marginBottom: 8 }}>
          KILOEV
        </div>
        <h1 style={{ fontSize: 20, margin: '0 0 6px', fontWeight: 680 }}>เว็ปทำงานต่อไม่ได้</h1>
        <p style={{ margin: '0 0 18px', fontSize: 14, color: '#526077' }}>
          ข้อมูลของคุณยังอยู่ครบบน Supabase ไม่ได้หายไปไหน — หน้าจอนี้พังเฉพาะการแสดงผล
        </p>

        <div style={{ fontSize: 11.5, fontWeight: 650, letterSpacing: '.05em', color: '#5e6c81', marginBottom: 6 }}>
          รายละเอียดข้อผิดพลาด
        </div>
        <pre
          style={{
            margin: '0 0 6px',
            padding: 12,
            background: '#f1f5f9',
            borderRadius: 10,
            fontSize: 12.5,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: 220,
            overflowY: 'auto',
          }}
        >
          {message}
        </pre>
        {error?.digest ? (
          <div style={{ fontSize: 11.5, color: '#5e6c81', marginBottom: 6 }}>รหัสอ้างอิง: {error.digest}</div>
        ) : null}
        <p style={{ margin: '0 0 18px', fontSize: 12.5, color: '#5e6c81' }}>
          ถ้าแจ้งปัญหา ให้คัดลอกข้อความในกรอบนี้ไปด้วย จะหาสาเหตุได้เร็วขึ้นมาก
        </p>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {reset ? (
            <button type="button" style={btnMain} onClick={reset}>ลองแสดงผลใหม่</button>
          ) : null}
          <button type="button" style={reset ? btn : btnMain} onClick={() => window.location.reload()}>
            โหลดหน้านี้ใหม่
          </button>
          <button type="button" style={btn} onClick={hardReload} disabled={busy === 'clearing'}>
            {busy === 'clearing' ? 'กำลังล้าง…' : 'ล้างแคชแล้วโหลดใหม่'}
          </button>
        </div>
        <p style={{ margin: '14px 0 0', fontSize: 12, color: '#5e6c81' }}>
          ถ้ากดโหลดใหม่แล้วยังพังเหมือนเดิม ให้กด <b>ล้างแคชแล้วโหลดใหม่</b> —
          ปุ่มนั้นลบตัวช่วยโหลดแบบออฟไลน์ที่อาจเก็บรุ่นที่พังไว้
        </p>
      </div>
    </div>
  );
}
