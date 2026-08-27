'use client';
/** เพิ่ม / แก้ไขรถ — เลือกยี่ห้อแล้วรุ่นจะกรองให้เอง พร้อมเติมความจุแบตและระยะทางให้อัตโนมัติ */
import { useMemo, useState } from 'react';
import { EV_DATA, OTHER } from '@/lib/data';
import Icon from './Icon';
import { Field, Modal } from './ui';
import { useStore } from './store';

const BRANDS = Object.keys(EV_DATA);

export default function CarModal({ car, onClose }) {
  const { saveCar, deleteCar, confirm, toast, data } = useStore();

  // ถ้ายี่ห้อ/รุ่นเดิมไม่อยู่ในลิสต์ ให้เข้าโหมด "อื่นๆ" พร้อมข้อความเดิม
  const initialBrandKnown = car?.brand && BRANDS.includes(car.brand);
  const [form, setForm] = useState(() => ({
    name: car?.name || '',
    brand: initialBrandKnown ? car.brand : car?.brand ? OTHER : '',
    brandOther: initialBrandKnown ? '' : car?.brand || '',
    model: car?.model || '',
    modelOther: '',
    batt: car?.batt ?? '',
    range: car?.range ?? '',
    odo: car?.odo ?? '',
    plate: car?.plate || '',
  }));
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const models = useMemo(() => EV_DATA[form.brand] || [], [form.brand]);
  const modelKnown = models.some((m) => m[0] === form.model);
  const needBrandOther = form.brand === OTHER || form.brand === '';
  const needModelOther = form.brand !== '' && (form.brand === OTHER || (!modelKnown && form.model === OTHER));

  function chooseBrand(b) {
    setForm((f) => ({ ...f, brand: b, model: '', modelOther: '' }));
  }

  /** เลือกรุ่นแล้วเติมความจุแบตและระยะทางให้ ถ้ายังไม่ได้กรอกเอง */
  function chooseModel(m) {
    const found = models.find((x) => x[0] === m);
    setForm((f) => ({
      ...f,
      model: m,
      batt: found && (f.batt === '' || f.batt === null) ? found[1] : f.batt,
      range: found && (f.range === '' || f.range === null) ? found[2] : f.range,
    }));
  }

  function submit() {
    const name = form.name.trim();
    if (!name) return toast('กรุณาตั้งชื่อรถ', true);
    const brand = form.brand === OTHER || !form.brand ? form.brandOther.trim() : form.brand;
    const model = form.model === OTHER || form.brand === OTHER || !form.brand
      ? form.modelOther.trim()
      : form.model;
    saveCar({
      id: car?.id,
      name,
      brand,
      model,
      batt: form.batt === '' ? null : Number(form.batt),
      range: form.range === '' ? null : Number(form.range),
      odo: form.odo === '' ? null : Number(form.odo),
      plate: form.plate.trim(),
    });
    toast(car ? 'แก้ไขข้อมูลรถเรียบร้อย' : 'เพิ่มรถเรียบร้อย');
    onClose();
  }

  const relatedCount = car
    ? data.sessions.filter((s) => s.carId === car.id).length +
      data.costs.filter((c) => c.carId === car.id).length
    : 0;

  return (
    <Modal
      title={car ? 'แก้ไขข้อมูลรถ' : 'เพิ่มรถ'}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          {car ? (
            <button
              type="button"
              className="btn btn-danger left"
              onClick={() =>
                confirm(
                  'ลบรถคันนี้',
                  `ข้อมูลการชาร์จและต้นทุนที่ผูกกับรถคันนี้ (${relatedCount} รายการ) จะถูกลบไปด้วยและกู้คืนไม่ได้`,
                  () => {
                    deleteCar(car.id);
                    toast('ลบรถแล้ว');
                    onClose();
                  }
                )
              }
            >
              <Icon name="trash" />ลบรถ
            </button>
          ) : null}
          <button type="button" className="btn" onClick={onClose}>ยกเลิก</button>
          <button type="submit" className="btn btn-primary">บันทึก</button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="ชื่อรถ (ตั้งเอง)" style={{ gridColumn: '1 / -1' }}>
          <input type="text" required placeholder="เช่น รถบ้าน, คันสีขาว"
            value={form.name} onChange={(e) => set('name', e.target.value)} />
        </Field>

        <Field label="ยี่ห้อ">
          <select value={form.brand} onChange={(e) => chooseBrand(e.target.value)}>
            <option value="">— เลือกยี่ห้อ —</option>
            {BRANDS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </Field>

        <Field label="รุ่น">
          <select
            value={modelKnown ? form.model : form.model ? OTHER : ''}
            onChange={(e) => chooseModel(e.target.value)}
            disabled={!form.brand || form.brand === OTHER}
          >
            <option value="">{form.brand ? '— เลือกรุ่น —' : '— เลือกยี่ห้อก่อน —'}</option>
            {models.map((m) => <option key={m[0]} value={m[0]}>{m[0]}</option>)}
            {form.brand && form.brand !== OTHER ? <option value={OTHER}>{OTHER} (ระบุเอง)</option> : null}
          </select>
        </Field>

        {needBrandOther ? (
          <Field label="ระบุยี่ห้อเอง">
            <input type="text" value={form.brandOther} onChange={(e) => set('brandOther', e.target.value)} />
          </Field>
        ) : null}
        {needModelOther ? (
          <Field label="ระบุรุ่นเอง">
            <input type="text" value={form.modelOther} onChange={(e) => set('modelOther', e.target.value)} />
          </Field>
        ) : null}

        <Field label="ความจุแบตเตอรี่ (kWh)">
          <input type="number" min="0" step="0.1" inputMode="decimal"
            value={form.batt} onChange={(e) => set('batt', e.target.value)} />
        </Field>
        <Field label="ระยะทางที่วิ่งได้ (km)">
          <input type="number" min="0" step="1" inputMode="numeric"
            value={form.range} onChange={(e) => set('range', e.target.value)} />
        </Field>
        <Field label="เลขไมล์ปัจจุบัน (km)" help="ใช้เป็นค่าตั้งต้นของการชาร์จครั้งแรก">
          <input type="number" min="0" step="1" inputMode="numeric"
            value={form.odo} onChange={(e) => set('odo', e.target.value)} />
        </Field>
        <Field label="ทะเบียน">
          <input type="text" placeholder="ไม่บังคับ"
            value={form.plate} onChange={(e) => set('plate', e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
