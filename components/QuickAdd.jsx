'use client';
/** Quick Add — บันทึกด่วนด้วยข้อมูลเท่าที่จำเป็น ส่วนที่เหลือคำนวณให้อัตโนมัติ */
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Field, Modal, TypeToggle } from './ui';
import { useStore } from './store';
import { isNum, n, nOrNull, todayISO, fmt, fmtDist, money } from '@/lib/format';
import { lastOdo, sBahtKm, sDist, sEff, sTotal } from '@/lib/calc';
import { fieldErrors, isSessionComplete, missingFields } from '@/lib/validate';

export default function QuickAdd() {
  const {
    data, cars, activeCar, settings, saveSession,
    setQuickOpen, quickDraft, setQuickDraft, toast, t
  } = useStore();
  const router = useRouter();

  // รับค่าที่ยกมาจาก Quick Add ในแถบเมนู (ถ้ามี) แล้วล้างทิ้งหลังใช้
  const d = quickDraft || {};
  const [carId, setCarId] = useState(d.carId || (activeCar ? activeCar.id : cars[0]?.id || ''));
  const [date, setDate] = useState(d.date || todayISO());
  const [type, setType] = useState(d.type || 'AC');
  const [kwh, setKwh] = useState(d.kwh ?? '');
  const [price, setPrice] = useState(d.price ?? String(settings.priceAC ?? ''));
  const [totalOverride, setTotalOverride] = useState(d.total ?? '');
  const [odo, setOdo] = useState(d.odo ?? '');
  const [socBefore, setSocBefore] = useState(d.socBefore ?? '');
  const [socAfter, setSocAfter] = useState(d.socAfter ?? '');
  // เคยกดบันทึกแล้วหรือยัง — ข้อความ "ยังไม่ได้กรอก" รอจังหวะนี้ก่อนค่อยขึ้น
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (quickDraft) setQuickDraft(null);
    // ตั้งใจให้ทำครั้งเดียวตอนเปิด — ค่าถูกอ่านไปใส่ state ข้างบนแล้ว
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    discount: 0,
    total,
    odoBefore,
    odoAfter: nOrNull(odo),
    socBefore: nOrNull(socBefore),
    socAfter: nOrNull(socAfter),
  };
  const dist = sDist(draft);
  const eff = sEff(draft);
  const bahtKm = sBahtKm(draft);

  /* ---------------- การตรวจค่าที่กรอก ---------------- */
  // ใช้กติกาชุดเดียวกับฟอร์มเต็ม จะได้ไม่มีกรณีที่บันทึกได้ที่หนึ่งแต่ไม่ได้อีกที่หนึ่ง
  const vForm = {
    carId, date, kwh, price, total: totalOverride,
    odoBefore: odoBefore ?? '', odoAfter: odo, socBefore, socAfter,
    fee: '', discount: '', dashEff: '',
  };
  const errors = fieldErrors(vForm);
  const missing = missingFields(vForm);
  const errFor = (k) => errors[k] || (tried ? missing[k] : null);
  const hasError = Object.keys(errors).length > 0;
  const complete = isSessionComplete({ kwh });

  function submit() {
    setTried(true);
    if (!cars.length) return toast('กรุณาเพิ่มรถก่อนบันทึกการชาร์จ', true);
    if (Object.keys({ ...missing, ...errors }).length) {
      return toast('ยังมีช่องที่ต้องแก้ ดูข้อความสีแดงใต้ช่องนั้น', true);
    }
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
      // เว้นว่างได้ เก็บ 0 ไว้ก่อนแล้วใช้ 0 นี่เป็นตัวบอกว่ายังไม่ครบ (เหมือนฟอร์มเต็ม)
      kwh: isNum(kwh) ? Number(kwh) : 0,
      price: nOrNull(price),
      fee: 0,
      discount: 0,
      total: sTotal(draft),
      dashEff: null,
      note: '',
      images: [],
    });
    toast(complete ? 'บันทึกการชาร์จเรียบร้อย' : 'บันทึกไว้แล้ว — ชาร์จเสร็จค่อยกลับมาเติมพลังงานที่ได้');
    setQuickOpen(false);
  }

  return (
    <Modal
      title={t('Quick Add — บันทึกด่วน')}
      onClose={() => setQuickOpen(false)}
      onSubmit={submit}
      noValidate
      footer={
        <>
          <button
            type="button"
            className="btn btn-ghost left"
            onClick={() => {
              // ยกทุกค่าที่กรอกไว้ไปให้ฟอร์มเต็ม จะได้กรอกต่อได้เลย
              setQuickDraft({ carId, date, type, kwh, price, total: totalOverride, odo, socBefore, socAfter });
              setQuickOpen(false);
              router.push('/add');
            }}
          >
            {t('กรอกแบบเต็ม →')}
          </button>
          <button type="button" className="btn" onClick={() => setQuickOpen(false)}>
            {t('ยกเลิก')}
          </button>
          <button type="submit" className="btn btn-primary" disabled={hasError}>
            {complete ? t('บันทึก') : t('บันทึกไว้ก่อน')}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label={t('รถ')} required error={errFor('carId')}>
          <select value={carId} onChange={(e) => setCarId(e.target.value)}>
            {cars.length === 0 ? <option value="">{t('— ยังไม่มีรถ —')}</option> : null}
            {cars.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
        <Field label={t('วันที่')} required error={errFor('date')}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label={t('ประเภทการชาร์จ')} style={{ gridColumn: '1 / -1' }}>
          <TypeToggle value={type} onChange={changeType} />
        </Field>
        {/* เว้นว่างได้ เผื่อจดไว้ก่อนเริ่มชาร์จ รายการจะขึ้นป้าย "ยังไม่ครบ" ในหน้าประวัติ */}
        <Field
          label={t('พลังงาน (kWh)')}
          help={complete ? null : t('เว้นว่างไว้ก่อนได้ ชาร์จเสร็จค่อยกลับมากรอก')}
          error={errFor('kwh')}
        >
          <input type="number" min="0" step="any" inputMode="decimal"
            value={kwh} onChange={(e) => setKwh(e.target.value)} placeholder="24.5" />
        </Field>
        <Field label={t('ราคา / kWh (฿)')} error={errFor('price')}>
          <input type="number" min="0" step="any" inputMode="decimal"
            value={price} onChange={(e) => setPrice(e.target.value)} placeholder="7.50" />
        </Field>
        <Field label={t('ค่าใช้จ่ายรวม (฿)')} help={t('เว้นว่างไว้เพื่อใช้ค่าที่คำนวณให้')} error={errFor('total')}>
          <input type="number" min="0" step="any" inputMode="decimal" className="calc"
            value={totalOverride} onChange={(e) => setTotalOverride(e.target.value)}
            placeholder={autoTotal ? autoTotal.toFixed(2) : '0.00'} />
        </Field>
        <Field
          label={t('เลขไมล์ปัจจุบัน (km)')}
          help={odoBefore !== null ? `ครั้งก่อน ${fmtDist(odoBefore)} km` : 'ยังไม่มีเลขไมล์ตั้งต้น'}
          error={errFor('odoAfter')}
        >
          <input type="number" min="0" step="any" inputMode="decimal"
            value={odo} onChange={(e) => setOdo(e.target.value)} />
        </Field>
        <Field label={t('SOC ก่อน (%)')} error={errFor('socBefore')}>
          <input type="number" min="0" max="100" step="any" inputMode="decimal"
            value={socBefore} onChange={(e) => setSocBefore(e.target.value)} />
        </Field>
        <Field label={t('SOC หลัง (%)')} error={errFor('socAfter')}>
          <input type="number" min="0" max="100" step="any" inputMode="decimal"
            value={socAfter} onChange={(e) => setSocAfter(e.target.value)} />
        </Field>
      </div>

      <div className="live" style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', marginTop: 14, padding: '12px 14px' }}>
        <div><div className="k">{t('ค่าใช้จ่ายรวม')}</div><div className="v">{money(total)}</div></div>
        <div><div className="k">{t('ระยะทาง')}</div><div className="v">{dist !== null ? `${fmtDist(dist)} km` : '—'}</div></div>
        <div><div className="k">km/kWh</div><div className="v">{eff !== null ? fmt(eff, 2) : '—'}</div></div>
        <div><div className="k">{t('บาท/km')}</div><div className="v">{bahtKm !== null ? fmt(bahtKm, 2) : '—'}</div></div>
      </div>
    </Modal>
  );
}
