'use client';
/** เพิ่ม / แก้ไขการแจ้งเตือน (บำรุงรักษา ต่อประกัน ต่อภาษี อื่นๆ) */
import { useState } from 'react';
import { ALERT_TYPES } from '@/lib/data';
import { todayISO } from '@/lib/format';
import Icon from './Icon';
import { Field, Modal } from './ui';
import { useStore } from './store';

export default function AlertModal({ item, onClose }) {
  const { cars, activeCar, settings, saveAlert, deleteAlert, confirm, toast } = useStore();
  const [form, setForm] = useState(() => ({
    type: item?.type || 'maintenance',
    carId: item?.carId || (activeCar ? activeCar.id : cars[0]?.id || ''),
    title: item?.title || '',
    due: item?.due || todayISO(),
    advance: item?.advance ?? settings.advanceDays ?? 30,
  }));
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function submit() {
    if (!form.due) return toast('กรุณาเลือกวันครบกำหนด', true);
    saveAlert({
      id: item?.id,
      type: form.type,
      carId: form.carId || null,
      title: form.title.trim() || ALERT_TYPES[form.type].label,
      due: form.due,
      advance: Number(form.advance) || 0,
      done: false,
    });
    toast(item ? 'แก้ไขการเตือนเรียบร้อย' : 'เพิ่มการเตือนเรียบร้อย');
    onClose();
  }

  return (
    <Modal
      title={item ? 'แก้ไขการเตือน' : 'เพิ่มการเตือน'}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          {item ? (
            <button
              type="button"
              className="btn btn-danger left"
              onClick={() =>
                confirm('ลบการเตือนนี้', 'ลบรายการเตือนนี้ถาวร', () => {
                  deleteAlert(item.id);
                  toast('ลบการเตือนแล้ว');
                  onClose();
                })
              }
            >
              <Icon name="trash" />ลบ
            </button>
          ) : null}
          <button type="button" className="btn" onClick={onClose}>ยกเลิก</button>
          <button type="submit" className="btn btn-primary">บันทึก</button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="ประเภท">
          <select value={form.type} onChange={(e) => set('type', e.target.value)}>
            {Object.entries(ALERT_TYPES).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </Field>
        <Field label="รถ">
          <select value={form.carId} onChange={(e) => set('carId', e.target.value)}>
            {cars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="หัวข้อ" style={{ gridColumn: '1 / -1' }}>
          <input type="text" placeholder="เช่น เช็คระยะ 40,000 km"
            value={form.title} onChange={(e) => set('title', e.target.value)} />
        </Field>
        <Field label="ครบกำหนดวันที่">
          <input type="date" required value={form.due} onChange={(e) => set('due', e.target.value)} />
        </Field>
        <Field label="เตือนล่วงหน้า (วัน)">
          <input type="number" min="0" step="any" inputMode="decimal"
            value={form.advance} onChange={(e) => set('advance', e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
