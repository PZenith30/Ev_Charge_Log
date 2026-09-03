'use client';
/** เพิ่ม / แก้ไขรายการต้นทุนรถ (ค่าไฟ บำรุงรักษา ประกันภัย ภาษี อื่นๆ) */
import { useState } from 'react';
import { COST_CATS } from '@/lib/data';
import { isNum, todayISO } from '@/lib/format';
import Icon from './Icon';
import ImageUploader from './ImageUploader';
import { Field, Modal } from './ui';
import { useStore } from './store';

export default function CostModal({ cost, onClose }) {
  const { cars, activeCar, saveCost, deleteCost, confirm, toast, t } = useStore();
  const [form, setForm] = useState(() => ({
    cat: cost?.cat || 'maintenance',
    date: cost?.date || todayISO(),
    amount: cost?.amount ?? '',
    carId: cost?.carId || (activeCar ? activeCar.id : cars[0]?.id || ''),
    note: cost?.note || '',
    images: cost?.images || [],
  }));
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function submit() {
    if (!isNum(form.amount)) return toast('กรุณากรอกจำนวนเงิน', true);
    saveCost({
      id: cost?.id,
      cat: form.cat,
      date: form.date,
      amount: Number(form.amount),
      carId: form.carId || null,
      note: form.note.trim(),
      images: form.images,
    });
    toast(cost ? 'แก้ไขรายการเรียบร้อย' : 'เพิ่มรายการต้นทุนเรียบร้อย');
    onClose();
  }

  return (
    <Modal
      title={cost ? 'แก้ไขรายการต้นทุน' : 'เพิ่มรายการต้นทุน'}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          {cost ? (
            <button
              type="button"
              className="btn btn-danger left"
              onClick={() =>
                confirm('ลบรายการนี้', 'ลบรายการต้นทุนนี้ถาวร รวมถึงรูปที่แนบไว้', () => {
                  deleteCost(cost.id);
                  toast('ลบรายการแล้ว');
                  onClose();
                })
              }
            >
              <Icon name="trash" />{t('ลบ')}
            </button>
          ) : null}
          <button type="button" className="btn" onClick={onClose}>{t('ยกเลิก')}</button>
          <button type="submit" className="btn btn-primary">{t('บันทึก')}</button>
        </>
      }
    >
      <div className="form-grid">
        <Field label={t('ประเภท')}>
          <select value={form.cat} onChange={(e) => set('cat', e.target.value)}>
            {Object.entries(COST_CATS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </Field>
        <Field label={t('วันที่')}>
          <input type="date" required value={form.date} onChange={(e) => set('date', e.target.value)} />
        </Field>
        <Field label={t('จำนวนเงิน (บาท)')}>
          <input type="number" min="0" step="any" inputMode="decimal" required
            value={form.amount} onChange={(e) => set('amount', e.target.value)} />
        </Field>
        <Field label={t('รถ')}>
          <select value={form.carId} onChange={(e) => set('carId', e.target.value)}>
            {cars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label={t('รายละเอียด')} style={{ gridColumn: '1 / -1' }}>
          <input type="text" placeholder={t('เช่น เช็คระยะ 20,000 km')}
            value={form.note} onChange={(e) => set('note', e.target.value)} />
        </Field>
      </div>

      <div className="mt">
        <div className="sm muted" style={{ marginBottom: 8, fontWeight: 550 }}>{t('รูปแนบ')}</div>
        <ImageUploader imageIds={form.images} onChange={(ids) => set('images', ids)} />
      </div>
    </Modal>
  );
}
