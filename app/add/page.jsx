'use client';
/** หน้าบันทึกการชาร์จแบบเต็ม — ใช้ทั้งเพิ่มใหม่และแก้ไขรายการเดิม */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useStore } from '@/components/store';
import { EmptyState, Field, TypeToggle } from '@/components/ui';
import ImageUploader from '@/components/ImageUploader';
import Icon from '@/components/Icon';
import { fmt, fmt0, fmtDist, isNum, limitDecimals, money, n, nOrNull, splitDuration, todayISO } from '@/lib/format';
import { lastOdo, sBahtKm, sDist, sEff, sEff100, sSoc, sTotal } from '@/lib/calc';
import { fieldErrors, isSessionComplete, missingFields } from '@/lib/validate';
import { DASH_DECIMALS, DASH_UNITS, DEFAULT_DASH_UNIT } from '@/lib/data';

const blank = () => ({
  carId: '', date: todayISO(), type: 'AC', station: '',
  durH: '', durM: '', durS: '',
  odoBefore: '', odoAfter: '', socBefore: '', socAfter: '', dashEff: '',
  kwh: '', price: '', fee: '', discount: '', total: '', note: '', images: [],
});

export default function AddPage() {
  const {
    data, cars, activeCar, settings, sessions, setSettings,
    saveSession, deleteSession, editingId, setEditingId, toast, confirm,
    quickDraft, setQuickDraft, t
  } = useStore();
  const router = useRouter();

  const editing = editingId ? data.sessions.find((s) => s.id === editingId) : null;
  const [form, setForm] = useState(blank);
  const [odoTouched, setOdoTouched] = useState(false);
  // เคยกดบันทึกแล้วหรือยัง — ใช้ตัดสินว่าจะขึ้นข้อความ "ยังไม่ได้กรอก" ได้หรือยัง
  // ถ้าขึ้นตั้งแต่เปิดหน้า ฟอร์มจะแดงทั้งที่ผู้ใช้ยังไม่ได้ทำอะไรผิดสักอย่าง
  const [tried, setTried] = useState(false);
  // หน่วยของอัตราสิ้นเปลืองหน้าปัด — จำค่าที่เลือกไว้ครั้งล่าสุดจาก settings
  const [dashUnit, setDashUnit] = useState(settings.dashEffUnit || DEFAULT_DASH_UNIT);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  /* โหลดค่าเริ่มต้น: รายการที่กำลังแก้ไข หรือฟอร์มเปล่าพร้อมค่า default */
  useEffect(() => {
    if (editing) {
      const unit = DASH_UNITS[editing.dashEffUnit] ? editing.dashEffUnit : DEFAULT_DASH_UNIT;
      const dur = splitDuration(Number(editing.durationSec));
      setDashUnit(unit);
      setForm({
        ...blank(),
        ...editing,
        station: editing.station || '',
        durH: dur.h, durM: dur.m, durS: dur.s,
        odoBefore: editing.odoBefore ?? '',
        odoAfter: editing.odoAfter ?? '',
        socBefore: editing.socBefore ?? '',
        socAfter: editing.socAfter ?? '',
        dashEff: isNum(editing.dashEff)
          ? String(Number(DASH_UNITS[unit].fromBase(Number(editing.dashEff)).toFixed(DASH_DECIMALS)))
          : '',
        kwh: editing.kwh ?? '',
        price: editing.price ?? '',
        fee: editing.fee ?? '',
        discount: editing.discount ?? '',
        total: editing.total ?? '',
        note: editing.note || '',
        images: editing.images || [],
      });
      setOdoTouched(true);
    } else {
      // ค่าที่ยกมาจาก Quick Add ตอนกด "กรอกแบบเต็ม →"
      const d = quickDraft || {};
      const type = d.type === 'DC' ? 'DC' : 'AC';
      const defPrice = type === 'DC' ? settings.priceDC : settings.priceAC;
      setDashUnit(settings.dashEffUnit || DEFAULT_DASH_UNIT);
      setForm({
        ...blank(),
        carId: d.carId || (activeCar ? activeCar.id : cars[0]?.id || ''),
        date: d.date || todayISO(),
        type,
        station: d.station || '',
        kwh: d.kwh ?? '',
        price: d.price ?? (isNum(defPrice) ? String(defPrice) : ''),
        total: d.total ?? '',
        odoAfter: d.odo ?? '',
        socBefore: d.socBefore ?? '',
        socAfter: d.socAfter ?? '',
      });
      // d.odo คือเลขไมล์ "ปัจจุบัน" ส่วนเลขไมล์ครั้งก่อนยังให้ระบบเติมจากการชาร์จครั้งก่อนตามเดิม
      setOdoTouched(false);
      if (quickDraft) {
        setQuickDraft(null);
        toast(d.station ? `เติมสถานี "${d.station}" ให้แล้ว` : 'ยกข้อมูลที่กรอกไว้มาให้แล้ว');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId]);

  /** เปลี่ยนหน่วย: แปลงตัวเลขที่กรอกไว้ตามหน่วยใหม่ แล้วจำหน่วยนี้ไว้ใช้ครั้งถัดไป */
  function changeDashUnit(next) {
    setForm((f) => {
      if (!isNum(f.dashEff)) return f;
      const base = DASH_UNITS[dashUnit].toBase(Number(f.dashEff));
      return { ...f, dashEff: String(Number(DASH_UNITS[next].fromBase(base).toFixed(DASH_DECIMALS))) };
    });
    setDashUnit(next);
    setSettings({ dashEffUnit: next });
  }

  /* เติมเลขไมล์ครั้งก่อนให้อัตโนมัติจากการชาร์จครั้งก่อนของรถคันนั้น */
  const prevOdo = useMemo(
    () => (form.carId ? lastOdo(data.sessions.filter((s) => s.id !== editingId), cars, form.carId) : null),
    [data.sessions, cars, form.carId, editingId]
  );
  useEffect(() => {
    if (!editing && !odoTouched && prevOdo !== null) set('odoBefore', String(prevOdo));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prevOdo, editing, odoTouched]);

  const stations = useMemo(
    () => Array.from(new Set(sessions.map((s) => s.station).filter(Boolean))).slice(0, 30),
    [sessions]
  );

  function changeType(t) {
    const def = t === 'DC' ? settings.priceDC : settings.priceAC;
    setForm((f) => ({ ...f, type: t, price: isNum(def) ? String(def) : f.price }));
  }

  /* ---------------- ค่าที่คำนวณสด ---------------- */
  // ยอดที่คำนวณให้ — หนีบไม่ให้ติดลบเหมือนใน sTotal ส่วนลดเกินยอดแปลว่ากรอกผิด
  const energyCost = n(form.kwh) * n(form.price);
  const autoTotal = Math.max(0, energyCost + n(form.fee) - n(form.discount));
  const draft = {
    type: form.type,
    kwh: nOrNull(form.kwh),
    price: nOrNull(form.price),
    fee: nOrNull(form.fee),
    discount: nOrNull(form.discount),
    total: isNum(form.total) ? Number(form.total) : autoTotal,
    odoBefore: nOrNull(form.odoBefore),
    odoAfter: nOrNull(form.odoAfter),
    socBefore: nOrNull(form.socBefore),
    socAfter: nOrNull(form.socAfter),
  };
  const dist = sDist(draft);
  const socGain = sSoc(draft);
  const total = sTotal(draft);
  const eff = sEff(draft);
  const eff100 = sEff100(draft);
  const bahtKm = sBahtKm(draft);

  /* ---------------- การตรวจค่าที่กรอก ---------------- */
  const errors = useMemo(() => fieldErrors(form), [form]);
  const missing = useMemo(() => missingFields(form), [form]);
  /** ข้อความใต้ช่อง — ค่าที่กรอกผิดขึ้นทันที ส่วน "ยังไม่ได้กรอก" รอจนกดบันทึกก่อน */
  const errFor = (k) => errors[k] || (tried ? missing[k] : null);
  const hasError = Object.keys(errors).length > 0;
  /**
   * บันทึกได้แม้ยังกรอกไม่ครบ เพราะการชาร์จใช้เวลานาน
   * ข้อมูลอย่างสถานี ราคา/kWh เลขไมล์ SOC ก่อนชาร์จ ควรจดตอนถึงหัวชาร์จได้เลย
   * แล้วค่อยกลับมาเติมพลังงานที่ชาร์จได้จริงตอนถอดสาย
   */
  const complete = isSessionComplete({ kwh: form.kwh });

  function submit(e) {
    e.preventDefault();
    setTried(true);
    const stop = { ...missingFields(form), ...fieldErrors(form) };
    if (Object.keys(stop).length) return toast('ยังมีช่องที่ต้องแก้ ดูข้อความสีแดงใต้ช่องนั้น', true);

    // กรอกเกิน 59 นาที/วินาทีได้ ผลรวมจะถูกปรับให้เป็น ชม./นาที/วินาที ตอนแสดงผลเอง
    const durationSec = Math.round(n(form.durH) * 3600 + n(form.durM) * 60 + n(form.durS));

    saveSession({
      id: editing?.id,
      created: editing?.created,
      carId: form.carId,
      date: form.date,
      time: editing?.time || '',
      type: form.type,
      durationSec: durationSec > 0 ? durationSec : null,
      station: form.station.trim(),
      odoBefore: nOrNull(form.odoBefore),
      odoAfter: nOrNull(form.odoAfter),
      socBefore: nOrNull(form.socBefore),
      socAfter: nOrNull(form.socAfter),
      // เก็บเป็น km/kWh เสมอ แล้วจำหน่วยที่กรอกไว้เพื่อแสดงกลับให้ตรงกับที่ผู้ใช้อ่านจากหน้าปัด
      dashEff: isNum(form.dashEff) ? DASH_UNITS[dashUnit].toBase(Number(form.dashEff)) : null,
      dashEffUnit: dashUnit,
      // ยังไม่ได้ชาร์จก็บันทึกได้ คอลัมน์ kwh ในฐานข้อมูลเป็น not null default 0 อยู่แล้ว
      // จึงเก็บเป็น 0 ไว้ก่อน แล้วใช้ 0 นี่แหละเป็นตัวบอกว่า "ยังไม่ครบ"
      kwh: isNum(form.kwh) ? Number(form.kwh) : 0,
      price: nOrNull(form.price),
      fee: nOrNull(form.fee),
      discount: nOrNull(form.discount),
      total,
      note: form.note.trim(),
      images: form.images,
    });
    toast(
      complete
        ? (editing ? 'แก้ไขรายการเรียบร้อย' : 'บันทึกการชาร์จเรียบร้อย')
        : 'บันทึกไว้แล้ว — ชาร์จเสร็จค่อยกลับมาเติมพลังงานที่ได้'
    );
    setEditingId(null);
    router.push('/history');
  }

  function resetForm() {
    setEditingId(null);
    setTried(false);
    setForm({
      ...blank(),
      carId: form.carId,
      price: isNum(settings.priceAC) ? String(settings.priceAC) : '',
    });
    setOdoTouched(false);
  }

  if (!cars.length) {
    return (
      <div className="card">
        <EmptyState
          message={t('ยังไม่มีรถในระบบ — เพิ่มรถก่อนเริ่มบันทึกการชาร์จ')}
          action={<Link href="/account" className="btn btn-primary btn-sm">{t('ไปหน้าเพิ่มรถ')}</Link>}
        />
      </div>
    );
  }

  const liveItems = [
    ['ระยะทางที่วิ่งได้', dist !== null ? `${fmtDist(dist)} km` : '—'],
    ['SOC ที่เพิ่มขึ้น', socGain !== null ? `+${socGain}%` : '—'],
    ['ค่าใช้จ่ายรวม', money(total)],
    ['Efficiency', eff !== null ? `${fmt(eff, 2)} km/kWh` : '—'],
    ['อีกหน่วย', eff100 !== null ? `${fmt0(eff100)} km/100kWh` : '—'],
    ['ค่าใช้จ่าย/km', bahtKm !== null ? `${fmt(bahtKm, 2)} ฿/km` : '—'],
  ];

  return (
    // noValidate = ปิดกล่องเตือนของเบราว์เซอร์ ใช้ข้อความสีแดงใต้ช่องของเราแทน
    // เพราะกล่องของเบราว์เซอร์ขึ้นทีละช่อง เป็นภาษาของระบบ และชี้ตำแหน่งไม่ชัดเท่า
    <form className="card" style={{ maxWidth: 920 }} onSubmit={submit} noValidate>
      {editing ? (
        <div className="form-sec" style={{ paddingBottom: 0, borderBottom: 0 }}>
          {/* เปิดรายการที่ค้างมาแก้ ต้องบอกตั้งแต่บนสุดว่าขาดอะไร ไม่ใช่ให้เลื่อนไปเจอเอง
              ส่วนรายการที่กรอกครบแล้ว แค่เตือนว่ากำลังบันทึกทับของเดิมก็พอ */}
          <div className={`alert ${complete ? 'warn' : 'danger'}`}>
            <Icon name={complete ? 'edit' : 'clock'} />
            <div style={{ flex: 1 }}>
              <div className="t1">
                {complete ? t('กำลังแก้ไขรายการเดิม') : t('รายการนี้ยังกรอกไม่ครบ')}
              </div>
              <div className="t2">
                {complete
                  ? `บันทึกทับรายการวันที่ ${form.date}`
                  : t('ขาดพลังงานที่ชาร์จ (kWh) · กรอกแล้วกดบันทึกเพื่อให้รายการสมบูรณ์')}
              </div>
            </div>
            <button type="button" className="btn btn-sm" onClick={resetForm}>{t('เพิ่มรายการใหม่แทน')}</button>
          </div>
        </div>
      ) : null}

      <div className="form-sec">
        <h4>{t('ข้อมูลพื้นฐาน')}</h4>
        {/* บอกไว้ครั้งเดียวที่หัวฟอร์ม จะได้รู้ว่าที่เหลือเว้นว่างไว้ก่อนได้ */}
        {/* ข้อความทั้งหมดอยู่ใน span เดียว ไม่แยกเป็นหลายชิ้นใน flex
            ไม่งั้นดอกจันจะหลุดไปคนละบรรทัดกับคำว่า "ช่องที่มี" ตอนจอแคบ */}
        <p className="req-note">
          <Icon name="alert" />
          <span>{t('ช่องที่มี')} <b>*</b> {t('ต้องกรอก · ช่องอื่นเว้นว่างไว้ก่อนแล้วกลับมาเติมทีหลังได้')}</span>
        </p>
        <div className="form-grid">
          <Field label={t('รถ')} required error={errFor('carId')}>
            <select value={form.carId} onChange={(e) => set('carId', e.target.value)}>
              {cars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label={t('วันที่')} required error={errFor('date')}>
            <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
          </Field>
          <Field
            label={t('เวลาที่ใช้ในการชาร์จ')}
            help={t('ชั่วโมง : นาที : วินาที · กรอกเกิน 59 ได้ ระบบจะรวมให้เอง เช่น 90 นาที = 1 ชม. 30 นาที')}
            style={{ gridColumn: 'span 2' }}
          >
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {[['durH', 'ชม.'], ['durM', 'นาที'], ['durS', 'วิ']].map(([key, unit], i) => (
                <div key={key} style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1, minWidth: 0 }}>
                  {i > 0 ? <span className="faint" style={{ flex: 'none' }}>:</span> : null}
                  <input
                    type="number" min="0" step="any" inputMode="decimal" placeholder="0"
                    style={{ flex: 1, minWidth: 0, textAlign: 'right' }}
                    value={form[key]} onChange={(e) => set(key, e.target.value)}
                  />
                  <span className="faint sm" style={{ flex: 'none' }}>{unit}</span>
                </div>
              ))}
            </div>
          </Field>
          <Field label={t('ประเภทการชาร์จ')}>
            <TypeToggle value={form.type} onChange={changeType} />
          </Field>
          <Field label={t('สถานี / สถานที่')}>
            <input type="text" list="station-list" placeholder={t('เช่น บ้าน, PTT Station')}
              value={form.station} onChange={(e) => set('station', e.target.value)} />
            <datalist id="station-list">
              {stations.map((s) => <option key={s} value={s} />)}
            </datalist>
          </Field>
        </div>
      </div>

      <div className="form-sec">
        <h4>{t('ข้อมูลรถ · ระยะทางและแบตเตอรี่')}</h4>
        <div className="form-grid">
          <Field
            label={t('เลขไมล์ครั้งก่อน (km)')}
            error={errFor('odoBefore')}
            help={!editing && prevOdo !== null ? `เติมอัตโนมัติจากครั้งก่อน (${fmtDist(prevOdo)} km)` : null}
          >
            <input type="number" min="0" step="any" inputMode="decimal" value={form.odoBefore}
              onChange={(e) => { setOdoTouched(true); set('odoBefore', e.target.value); }} />
          </Field>
          <Field label={t('เลขไมล์ปัจจุบัน (km)')} error={errFor('odoAfter')}>
            <input type="number" min="0" step="any" inputMode="decimal"
              value={form.odoAfter} onChange={(e) => set('odoAfter', e.target.value)} />
          </Field>
          <Field label={t('ระยะทางที่วิ่งได้ (km)')}>
            <input type="text" className="calc" readOnly value={dist !== null ? fmtDist(dist) : '—'} />
          </Field>
          <Field label={t('SOC ก่อนชาร์จ (%)')} error={errFor('socBefore')}>
            <input type="number" min="0" max="100" step="any" inputMode="decimal"
              value={form.socBefore} onChange={(e) => set('socBefore', e.target.value)} />
          </Field>
          <Field label={t('SOC หลังชาร์จ (%)')} error={errFor('socAfter')}>
            <input type="number" min="0" max="100" step="any" inputMode="decimal"
              value={form.socAfter} onChange={(e) => set('socAfter', e.target.value)} />
          </Field>
          <Field label={t('SOC ที่เพิ่มขึ้น (%)')}>
            <input type="text" className="calc" readOnly value={socGain !== null ? `+${socGain}` : '—'} />
          </Field>
          <Field
            label={t('อัตราสิ้นเปลืองจากหน้าปัด')}
            help={t('ค่าที่รถแสดงบนหน้าปัด · ทศนิยมได้ไม่เกิน 2 ตำแหน่ง · หน่วยที่เลือกจะถูกจำไว้ใช้ครั้งถัดไป')}
            error={errFor('dashEff')}
            style={{ gridColumn: 'span 2' }}
          >
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="number" min="0" step="any" inputMode="decimal"
                placeholder={DASH_UNITS[dashUnit].placeholder}
                style={{ flex: 1, minWidth: 0 }}
                value={form.dashEff}
                onChange={(e) => set('dashEff', limitDecimals(e.target.value, DASH_DECIMALS))}
              />
              <select
                value={dashUnit}
                onChange={(e) => changeDashUnit(e.target.value)}
                style={{ width: 132, flex: 'none' }}
                title={t('หน่วยของค่าที่อ่านจากหน้าปัด')}
              >
                {Object.keys(DASH_UNITS).map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </Field>
        </div>
      </div>

      <div className="form-sec">
        <h4>{t('ข้อมูลพลังงานและค่าใช้จ่าย')}</h4>
        <div className="form-grid">
          {/* ช่องนี้เคยเป็นช่องบังคับ ทำให้จดข้อมูลตอนถึงหัวชาร์จไว้ก่อนไม่ได้เลย
              ตอนนี้เว้นว่างได้ รายการจะถูกทำเครื่องหมาย "ยังไม่ครบ" ไว้จนกว่าจะกลับมาเติม */}
          <Field
            label={t('พลังงานที่ชาร์จ (kWh)')}
            help={complete ? null : t('เว้นว่างไว้ก่อนได้ ชาร์จเสร็จค่อยกลับมากรอก')}
            error={errFor('kwh')}
          >
            <input type="number" min="0" step="any" inputMode="decimal" placeholder="24.5"
              value={form.kwh} onChange={(e) => set('kwh', e.target.value)} />
          </Field>
          <Field label={t('ราคา / kWh (บาท)')} error={errFor('price')}>
            <input type="number" min="0" step="any" inputMode="decimal" placeholder="7.50"
              value={form.price} onChange={(e) => set('price', e.target.value)} />
          </Field>
          {/* ค่าปรับกับส่วนลดวางคู่กัน เพราะเป็นสองตัวที่บวก/ลบยอดเหมือนกัน แค่คนละทาง */}
          <Field label={t('ค่าปรับ (บาท)')} help={t('เช่น ค่าจอดเกินเวลาหลังชาร์จเต็ม')} error={errFor('fee')}>
            <input type="number" min="0" step="any" inputMode="decimal" placeholder="0"
              value={form.fee} onChange={(e) => set('fee', e.target.value)} />
          </Field>
          <Field label={t('ส่วนลด (บาท)')} help={t('เช่น โค้ดโปรโมชั่น หรือแต้มที่ใช้แลก')} error={errFor('discount')}>
            <input type="number" min="0" step="any" inputMode="decimal" placeholder="0"
              value={form.discount} onChange={(e) => set('discount', e.target.value)} />
          </Field>
          <Field
            label={t('ค่าใช้จ่ายรวม (บาท)')}
            help={t('คำนวณอัตโนมัติ — แก้ทับได้ถ้ายอดจริงต่างจากนี้')}
            error={errFor('total')}
            style={{ gridColumn: '1 / -1' }}
          >
            <div className="total-row">
              <input type="number" min="0" step="any" inputMode="decimal" className="calc"
                placeholder={autoTotal ? autoTotal.toFixed(2) : '0.00'}
                value={form.total} onChange={(e) => set('total', e.target.value)} />
              {/* ปุ่มนี้โผล่เฉพาะตอนแก้ทับไว้ จะได้กลับไปใช้ยอดที่คำนวณได้ในคลิกเดียว */}
              {form.total !== '' ? (
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => set('total', '')}>
                  <Icon name="refresh" />{t('ใช้ยอดที่คำนวณ')}
                </button>
              ) : null}
            </div>
          </Field>
        </div>

        {/* แสดงวิธีคิดยอดให้เห็นกับตา ผู้ใช้จะได้รู้ว่าตัวเลขมาจากไหนโดยไม่ต้องคิดเอง */}
        {energyCost || n(form.fee) || n(form.discount) ? (
          <div className="calc-line">
            <span>{fmt(n(form.kwh), 2)} kWh × {fmt(n(form.price), 2)} = {money(energyCost)}</span>
            {n(form.fee) ? <span className="up">+ {t('ค่าปรับ')} {money(n(form.fee))}</span> : null}
            {n(form.discount) ? <span className="down">− {t('ส่วนลด')} {money(n(form.discount))}</span> : null}
            <b>= {money(autoTotal)}</b>
            {isNum(form.total) && Number(form.total) !== autoTotal ? (
              <span className="warn">{t('แก้ยอดเองเป็น {v}', { v: money(Number(form.total)) })}</span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="form-sec">
        <h4>{t('รูปแนบและหมายเหตุ')}</h4>
        <div style={{ marginBottom: 14 }}>
          <ImageUploader imageIds={form.images} onChange={(ids) => set('images', ids)} />
          <p className="help" style={{ marginTop: 8 }}>{t('แนบสลิปธนาคาร หรือภาพหน้าจอจากแอปชาร์จได้หลายรูป')}</p>
        </div>
        <Field label={t('หมายเหตุ')}>
          <textarea placeholder={t('เช่น ชาร์จค้างคืน, ได้ส่วนลดโปรโมชั่น')}
            value={form.note} onChange={(e) => set('note', e.target.value)} />
        </Field>
      </div>

      {/* อธิบายสถานะ "ยังไม่ครบ" ตรงจุดที่จะกดบันทึกพอดี ไม่ต้องเลื่อนกลับไปอ่านข้างบน */}
      {!complete ? (
        <div className="form-sec" style={{ paddingTop: 0, borderBottom: 0 }}>
          <div className="alert warn">
            <Icon name="clock" />
            <div style={{ flex: 1 }}>
              <div className="t1">{t('ยังไม่ได้กรอกพลังงานที่ชาร์จ')}</div>
              <div className="t2">
                {t('บันทึกไว้ก่อนได้เลย รายการจะถูกทำเครื่องหมาย "ยังไม่ครบ" ไว้ในหน้าประวัติ ชาร์จเสร็จค่อยกดแก้ไขมาเติม')}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="live">
        {liveItems.map(([k, v]) => (
          <div key={k}>
            <div className="k">{k}</div>
            <div className="v">{v}</div>
          </div>
        ))}
      </div>

      <div className="form-foot">
        {editing ? (
          <button
            type="button"
            className="btn btn-danger left"
            onClick={() =>
              confirm('ลบรายการนี้', 'ลบการชาร์จรายการนี้ออกจากประวัติถาวร รวมถึงรูปที่แนบไว้', () => {
                deleteSession(editing.id);
                setEditingId(null);
                toast('ลบรายการแล้ว');
                router.push('/history');
              })
            }
          >
            <Icon name="trash" />{t('ลบรายการนี้')}
          </button>
        ) : null}
        <button type="button" className="btn" onClick={resetForm}>{t('ล้างฟอร์ม')}</button>
        {/* ข้อความบนปุ่มบอกตรงๆ ว่ากำลังจะบันทึกแบบไหน จะได้ไม่เผลอคิดว่าจดครบแล้ว */}
        <button type="submit" className="btn btn-primary" disabled={hasError}>
          <Icon name={complete ? 'check' : 'clock'} />
          {complete
            ? (editing ? t('บันทึกการแก้ไข') : t('บันทึกการชาร์จ'))
            : t('บันทึกไว้ก่อน')}
        </button>
      </div>
    </form>
  );
}
