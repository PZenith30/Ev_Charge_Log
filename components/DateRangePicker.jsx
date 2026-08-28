'use client';
/** ตัวเลือกช่วงเวลาบนแถบบน — preset สำเร็จรูป + กำหนดเองด้วยวันที่เริ่ม/สิ้นสุด */
import { useEffect, useRef, useState } from 'react';
import { PERIOD_PRESETS, rangeText } from '@/lib/period';
import Icon from './Icon';
import { useStore } from './store';

export default function DateRangePicker() {
  const { period, setPeriod, range } = useStore();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(range.from || '');
  const [to, setTo] = useState(range.to || '');
  const boxRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function pick(key) {
    if (key === 'custom') {
      setFrom(range.from || '');
      setTo(range.to || '');
      return; // รอผู้ใช้กรอกวันที่แล้วกดใช้ช่วงนี้
    }
    setPeriod(key);
    setOpen(false);
  }

  function applyCustom() {
    if (!from || !to) return;
    setPeriod('custom', { from: from <= to ? from : to, to: from <= to ? to : from });
    setOpen(false);
  }

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <button type="button" className="btn" onClick={() => setOpen((o) => !o)} title="เลือกช่วงเวลา">
        <Icon name="calendar" />
        <span>{rangeText(period.key, range)}</span>
        <Icon name="chevron-down" style={{ width: 14, height: 14, opacity: 0.6 }} />
      </button>

      {open ? (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 60, width: 260,
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)',
            boxShadow: 'var(--shadow-lg)', padding: 8,
          }}
        >
          {PERIOD_PRESETS.filter((p) => p.key !== 'custom').map((p) => (
            <button
              key={p.key}
              type="button"
              className={`navlink${period.key === p.key ? ' active' : ''}`}
              style={
                period.key === p.key
                  ? undefined
                  : { color: 'var(--muted)', background: 'none' }
              }
              onClick={() => pick(p.key)}
            >
              {p.label}
            </button>
          ))}

          <div style={{ borderTop: '1px solid var(--border)', margin: '8px 4px', paddingTop: 10 }}>
            <div className="sm muted" style={{ marginBottom: 8, fontWeight: 550 }}>กำหนดเอง</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ fontSize: 13, padding: '6px 8px' }} />
              <span className="faint">–</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ fontSize: 13, padding: '6px 8px' }} />
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{ width: '100%', marginTop: 8 }}
              onClick={applyCustom}
              disabled={!from || !to}
            >
              ใช้ช่วงนี้
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
