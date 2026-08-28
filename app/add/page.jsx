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
import { DASH_DECIMALS, DASH_UNITS, DEFAULT_DASH_UNIT } from '@/lib/data';

const blank = () => ({
  carId: '', date: todayISO(), type: 'AC', station: '',
  durH: '', durM: '', durS: '',
  odoBefore: '', odoAfter: '', socBefore: '', socAfter: '', dashEff: '',
  kwh: '', price: '', fee: '', total: '', note: '', images: [],
});

export default function AddPage() {
  const {
    data, cars, activeCar, settings, sessions, setSettings,
    saveSession, deleteSession, editingId, setEditingId, toast, confirm,
  } = useStore();
  const router = useRouter();

  const editing = editingId ? data.sessions.find((s) => s.id === editingId) : null;
  const [form, setForm] = useState(blank);
  const [odoTouched, setOdoTouched] = useState(false);
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
        total: editing.total ?? '',
        note: editing.note || '',
        images: editing.images || [],
      });
      setOdoTouched(true);
    } else {
      setDashUnit(settings.dashEffUnit || DEFAULT_DASH_UNIT);
      setForm({
        ...blank(),
        carId: activeCar ? activeCar.id : cars[0]?.id || '',
        price: isNum(settings.priceAC) ? String(settings.priceAC) : '',
      });
      setOdoTouched(false);
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

  /* เติมเลขไมล์ก่อนชาร์จให้อัตโนมัติจากการชาร์จครั้งก่อนของรถคันนั้น */
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
  const autoTotal = n(form.kwh) * n(form.price) + n(form.fee);
  const draft = {
    type: form.type,
    kwh: nOrNull(form.kwh),
    price: nOrNull(form.price),
    fee: nOrNull(form.fee),
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

  function submit(e) {
    e.preventDefault();
    if (!form.carId) return toast('กรุณาเลือกรถ', true);
    if (!form.date) return toast('กรุณาเลือกวันที่', true);
    if (!isNum(form.kwh) || Number(form.kwh) <= 0) return toast('กรุณากรอกพลังงานที่ชาร์จ (kWh)', true);

    const durationSec = n(form.durH) * 3600 + n(form.durM) * 60 + n(form.durS);

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
      kwh: Number(form.kwh),
      price: nOrNull(form.price),
      fee: nOrNull(form.fee),
      total,
      note: form.note.trim(),
      images: form.images,
    });
    toast(editing ? 'แก้ไขรายการเรียบร้อย' : 'บันทึกการชาร์จเรียบร้อย');
    setEditingId(null);
    router.push('/history');
  }

  function resetForm() {
    setEditingId(null);
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
          message="ยังไม่มีรถในระบบ — เพิ่มรถก่อนเริ่มบันทึกการชาร์จ"
          action={<Link href="/account" className="btn btn-primary btn-sm">ไปหน้าเพิ่มรถ</Link>}
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
    <form className="card" style={{ maxWidth: 920 }} onSubmit={submit}>
      {editing ? (
        <div className="form-sec" style={{ paddingBottom: 0, borderBottom: 0 }}>
          <div className="alert warn">
            <Icon name="edit" />
            <div style={{ flex: 1 }}>
              <div className="t1">กำลังแก้ไขรายการเดิม</div>
              <div className="t2">บันทึกทับรายการวันที่ {form.date}</div>
            </div>
            <button type="button" className="btn btn-sm" onClick={resetForm}>เพิ่มรายการใหม่แทน</button>
          </div>
        </div>
      ) : null}

      <div className="form-sec">
        <h4>ข้อมูลพื้นฐาน</h4>
        <div className="form-grid">
          <Field label="รถ">
            <select value={form.carId} onChange={(e) => set('carId', e.target.value)} required>
              {cars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="วันที่">
            <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} required />
          </Field>
          <Field label="เวลาที่ใช้ในการชาร์จ" help="ชั่วโมง : นาที : วินาที" style={{ gridColumn: 'span 2' }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {[['durH', 'ชม.'], ['durM', 'นาที'], ['durS', 'วิ']].map(([key, unit], i) => (
                <div key={key} style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1, minWidth: 0 }}>
                  {i > 0 ? <span className="faint" style={{ flex: 'none' }}>:</span> : null}
                  <input
                    type="number" min="0" step="1" inputMode="numeric" placeholder="0"
                    max={key === 'durH' ? undefined : 59}
                    style={{ flex: 1, minWidth: 0, textAlign: 'right' }}
                    value={form[key]} onChange={(e) => set(key, e.target.value)}
                  />
                  <span className="faint sm" style={{ flex: 'none' }}>{unit}</span>
                </div>
              ))}
            </div>
          </Field>
          <Field label="ประเภทการชาร์จ">
            <TypeToggle value={form.type} onChange={changeType} />
          </Field>
          <Field label="สถานี / สถานที่">
            <input type="text" list="station-list" placeholder="เช่น บ้าน, PTT Station"
              value={form.station} onChange={(e) => set('station', e.target.value)} />
            <datalist id="station-list">
              {stations.map((s) => <option key={s} value={s} />)}
            </datalist>
          </Field>
        </div>
      </div>

      <div className="form-sec">
        <h4>ข้อมูลรถ · ระยะทางและแบตเตอรี่</h4>
        <div className="form-grid">
          <Field
            label="เลขไมล์ก่อนชาร์จ (km)"
            help={!editing && prevOdo !== null ? `เติมอัตโนมัติจากครั้งก่อน (${fmtDist(prevOdo)} km)` : null}
          >
            <input type="number" min="0" step="0.1" inputMode="decimal" value={form.odoBefore}
              onChange={(e) => { setOdoTouched(true); set('odoBefore', e.target.value); }} />
          </Field>
          <Field label="เลขไมล์หลังชาร์จ (km)">
            <input type="number" min="0" step="0.1" inputMode="decimal"
              value={form.odoAfter} onChange={(e) => set('odoAfter', e.target.value)} />
          </Field>
          <Field label="ระยะทางที่วิ่งได้ (km)">
            <input type="text" className="calc" readOnly value={dist !== null ? fmtDist(dist) : '—'} />
          </Field>
          <Field label="SOC ก่อนชาร์จ (%)">
            <input type="number" min="0" max="100" step="1" inputMode="numeric"
              value={form.socBefore} onChange={(e) => set('socBefore', e.target.value)} />
          </Field>
          <Field label="SOC หลังชาร์จ (%)">
            <input type="number" min="0" max="100" step="1" inputMode="numeric"
              value={form.socAfter} onChange={(e) => set('socAfter', e.target.value)} />
          </Field>
          <Field label="SOC ที่เพิ่มขึ้น (%)">
            <input type="text" className="calc" readOnly value={socGain !== null ? `+${socGain}` : '—'} />
          </Field>
          <Field
            label="อัตราสิ้นเปลืองจากหน้าปัด"
            help="ค่าที่รถแสดงบนหน้าปัด · ทศนิยมได้ไม่เกิน 2 ตำแหน่ง · หน่วยที่เลือกจะถูกจำไว้ใช้ครั้งถัดไป"
            style={{ gridColumn: 'span 2' }}
          >
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="number" min="0" step="0.01" inputMode="decimal"
                placeholder={DASH_UNITS[dashUnit].placeholder}
                style={{ flex: 1, minWidth: 0 }}
                value={form.dashEff}
                onChange={(e) => set('dashEff', limitDecimals(e.target.value, DASH_DECIMALS))}
              />
              <select
                value={dashUnit}
                onChange={(e) => changeDashUnit(e.target.value)}
                style={{ width: 132, flex: 'none' }}
                title="หน่วยของค่าที่อ่านจากหน้าปัด"
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
        <h4>ข้อมูลพลังงานและค่าใช้จ่าย</h4>
        <div className="form-grid">
          <Field label="พลังงานที่ชาร์จ (kWh)">
            <input type="number" min="0" step="0.01" inputMode="decimal" placeholder="24.5" required
              value={form.kwh} onChange={(e) => set('kwh', e.target.value)} />
          </Field>
          <Field label="ราคา / kWh (บาท)">
            <input type="number" min="0" step="0.01" inputMode="decimal" placeholder="7.50"
              value={form.price} onChange={(e) => set('price', e.target.value)} />
          </Field>
          <Field label="ค่าบริการเพิ่มเติม (บาท)">
            <input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0"
              value={form.fee} onChange={(e) => set('fee', e.target.value)} />
          </Field>
          <Field label="ค่าใช้จ่ายรวม (บาท)" help="คำนวณอัตโนมัติ — แก้ทับได้ถ้ายอดจริงต่างจากนี้">
            <input type="number" min="0" step="0.01" inputMode="decimal" className="calc"
              placeholder={autoTotal ? autoTotal.toFixed(2) : '0.00'}
              value={form.total} onChange={(e) => set('total', e.target.value)} />
          </Field>
        </div>
      </div>

      <div className="form-sec">
        <h4>รูปแนบ &amp; หมายเหตุ</h4>
        <div style={{ marginBottom: 14 }}>
          <ImageUploader imageIds={form.images} onChange={(ids) => set('images', ids)} />
          <p className="help" style={{ marginTop: 8 }}>แนบสลิปธนาคาร หรือภาพหน้าจอจากแอปชาร์จได้หลายรูป</p>
        </div>
        <Field label="หมายเหตุ">
          <textarea placeholder="เช่น ชาร์จค้างคืน, ได้ส่วนลดโปรโมชั่น"
            value={form.note} onChange={(e) => set('note', e.target.value)} />
        </Field>
      </div>

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
            <Icon name="trash" />ลบรายการนี้
          </button>
        ) : null}
        <button type="button" className="btn" onClick={resetForm}>ล้างฟอร์ม</button>
        <button type="submit" className="btn btn-primary">
          <Icon name="check" />
          {editing ? 'บันทึกการแก้ไข' : 'บันทึกการชาร์จ'}
        </button>
      </div>
    </form>
  );
}
