'use client';
/** Quick Add — บันทึกด่วนด้วยข้อมูลเท่าที่จำเป็น ส่วนที่เหลือคำนวณให้อัตโนมัติ */
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Field, Modal, TypeToggle } from './ui';
import { useStore } from './store';
import { isNum, n, nOrNull, todayISO, fmt, fmtDist, money } from '@/lib/format';
import { lastOdo, sBahtKm, sDist, sEff, sTotal } from '@/lib/calc';

export default function QuickAdd() {
  const { data, cars, activeCar, settings, saveSession, setQuickOpen, toast } = useStore();
  const router = useRouter();

  const [carId, setCarId] = useState(activeCar ? activeCar.id : cars[0]?.id || '');
  const [date, setDate] = useState(todayISO());
  const [type, setType] = useState('AC');
  const [kwh, setKwh] = useState('');
  const [price, setPrice] = useState(String(settings.priceAC ?? ''));
  const [totalOverride, setTotalOverride] = useState('');
  const [odo, setOdo] = useState('');
  const [socBefore, setSocBefore] = useState('');
  const [socAfter, setSocAfter] = useState('');

  const odoBefore = useMemo(() => lastOdo(data.sessions, cars, carId), [data.sessions, cars, carId]);

  function changeType(t) {
    setType(t);
    const def = t === 'DC' ? settings.priceDC : settings.priceAC;
    if (isNum(def)) setPrice(String(def));
  }

  const autoTotal = n(kwh) * n(price);
  const total = isNum(totalOverride) ? Number(totalOverride) : autoTotal;

  const draft = {
    type,
    kwh: nOrNull(kwh),
    price: nOrNull(price),
    fee: 0,
    total,
    odoBefore,
    odoAfter: nOrNull(odo),
    socBefore: nOrNull(socBefore),
    socAfter: nOrNull(socAfter),
  };
  const dist = sDist(draft);
  const eff = sEff(draft);
  const bahtKm = sBahtKm(draft);

  function submit() {
    if (!carId) return toast('กรุณาเพิ่มรถก่อนบันทึกการชาร์จ', true);
    if (!isNum(kwh) || Number(kwh) <= 0) return toast('กรุณากรอกพลังงานที่ชาร์จ (kWh)', true);
    saveSession({
      carId,
      date,
      time: '',
      type,
      durationSec: null,
      station: '',
      odoBefore,
      odoAfter: nOrNull(odo),
      socBefore: nOrNull(socBefore),
      socAfter: nOrNull(socAfter),
      kwh: Number(kwh),
      price: nOrNull(price),
      fee: 0,
      total: sTotal(draft),
      dashEff: null,
      note: '',
      images: [],
    });
    toast('บันทึกการชาร์จเรียบร้อย');
    setQuickOpen(false);
  }

  return (
    <Modal
      title="Quick Add — บันทึกด่วน"
      onClose={() => setQuickOpen(false)}
      onSubmit={submit}
      footer={
        <>
          <button
            type="button"
            className="btn btn-ghost left"
            onClick={() => {
              setQuickOpen(false);
              router.push('/add');
            }}
          >
            กรอกแบบเต็ม →
          </button>
          <button type="button" className="btn" onClick={() => setQuickOpen(false)}>
            ยกเลิก
          </button>
          <button type="submit" className="btn btn-primary">
            บันทึก
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="รถ">
          <select value={carId} onChange={(e) => setCarId(e.target.value)}>
            {cars.length === 0 ? <option value="">— ยังไม่มีรถ —</option> : null}
            {cars.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
        <Field label="วันที่">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label="ประเภทการชาร์จ" style={{ gridColumn: '1 / -1' }}>
          <TypeToggle value={type} onChange={changeType} />
        </Field>
        <Field label="พลังงาน (kWh)">
          <input type="number" min="0" step="0.01" inputMode="decimal" required
            value={kwh} onChange={(e) => setKwh(e.target.value)} placeholder="24.5" />
        </Field>
        <Field label="ราคา / kWh (฿)">
          <input type="number" min="0" step="0.01" inputMode="decimal"
            value={price} onChange={(e) => setPrice(e.target.value)} placeholder="7.50" />
        </Field>
        <Field label="ค่าใช้จ่ายรวม (฿)" help="เว้นว่างไว้เพื่อใช้ค่าที่คำนวณให้">
          <input type="number" min="0" step="0.01" inputMode="decimal" className="calc"
            value={totalOverride} onChange={(e) => setTotalOverride(e.target.value)}
            placeholder={autoTotal ? autoTotal.toFixed(2) : '0.00'} />
        </Field>
        <Field
          label="เลขไมล์ปัจจุบัน (km)"
          help={odoBefore !== null ? `ครั้งก่อน ${fmtDist(odoBefore)} km` : 'ยังไม่มีเลขไมล์ตั้งต้น'}
        >
          <input type="number" min="0" step="0.1" inputMode="decimal"
            value={odo} onChange={(e) => setOdo(e.target.value)} />
        </Field>
        <Field label="SOC ก่อน (%)">
          <input type="number" min="0" max="100" step="1" inputMode="numeric"
            value={socBefore} onChange={(e) => setSocBefore(e.target.value)} />
        </Field>
        <Field label="SOC หลัง (%)">
          <input type="number" min="0" max="100" step="1" inputMode="numeric"
            value={socAfter} onChange={(e) => setSocAfter(e.target.value)} />
        </Field>
      </div>

      <div className="live" style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', marginTop: 14, padding: '12px 14px' }}>
        <div><div className="k">ค่าใช้จ่ายรวม</div><div className="v">{money(total)}</div></div>
        <div><div className="k">ระยะทาง</div><div className="v">{dist !== null ? `${fmtDist(dist)} km` : '—'}</div></div>
        <div><div className="k">km/kWh</div><div className="v">{eff !== null ? fmt(eff, 2) : '—'}</div></div>
        <div><div className="k">บาท/km</div><div className="v">{bahtKm !== null ? fmt(bahtKm, 2) : '—'}</div></div>
      </div>
    </Modal>
  );
}
