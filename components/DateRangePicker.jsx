'use client';
/** ตัวเลือกช่วงเวลาบนแถบบน — preset สำเร็จรูป + กำหนดเองด้วยวันที่เริ่ม/สิ้นสุด */
import { useCallback, useState } from 'react';
import { PERIOD_PRESETS, rangeText } from '@/lib/period';
import Icon from './Icon';
import { useDismiss } from './ui';
import { useStore } from './store';

export default function DateRangePicker() {
  const { period, setPeriod, range } = useStore();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(range.from || '');
  const [to, setTo] = useState(range.to || '');
  const boxRef = useDismiss(open, useCallback(() => setOpen(false), []));

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
        <div className="menu" role="menu" style={{ minWidth: 250 }}>
          {PERIOD_PRESETS.filter((p) => p.key !== 'custom').map((p) => (
            <button
              key={p.key}
              type="button"
              role="menuitem"
              className="menu-item"
              style={period.key === p.key ? { color: 'var(--accent-text)', fontWeight: 600 } : undefined}
              onClick={() => pick(p.key)}
            >
              <Icon name={period.key === p.key ? 'check' : 'calendar'} />
              {p.label}
            </button>
          ))}

          <div className="menu-sep" />
          <div style={{ padding: '2px 7px 4px' }}>
            <div className="menu-label" style={{ padding: '0 4px 8px' }}>กำหนดเอง</div>
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
