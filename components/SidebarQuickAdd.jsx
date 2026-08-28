'use client';
/**
 * Quick Add แบบย่อในแถบเมนู — กรอกแค่ SOC ก่อน/หลัง และพลังงาน แล้วบันทึกได้เลย
 * ราคา/kWh ใช้ค่าเริ่มต้นของประเภทที่เลือกไว้ ส่วนเลขไมล์ก่อนชาร์จเติมจากครั้งก่อนให้เอง
 * ปุ่ม + เปิดฟอร์มเต็มสำหรับกรณีที่อยากกรอกละเอียด
 */
import { useState } from 'react';
import { useStore } from './store';
import Icon from './Icon';
import { isNum, n, nOrNull, todayISO } from '@/lib/format';
import { lastOdo } from '@/lib/calc';

export default function SidebarQuickAdd() {
  const { data, cars, activeCar, settings, saveSession, setQuickOpen, toast } = useStore();
  const [socBefore, setSocBefore] = useState('');
  const [socAfter, setSocAfter] = useState('');
  const [kwh, setKwh] = useState('');
  const [busy, setBusy] = useState(false);

  const carId = activeCar ? activeCar.id : cars[0]?.id || '';
  const canSave = Boolean(carId) && isNum(kwh) && Number(kwh) > 0;

  function save() {
    if (!canSave) return;
    setBusy(true);
    const price = nOrNull(settings.priceAC);
    const odo = lastOdo(data.sessions, cars, carId);
    saveSession({
      carId,
      date: todayISO(),
      time: '',
      type: 'AC',
      durationSec: null,
      station: '',
      odoBefore: odo,
      odoAfter: null,
      socBefore: nOrNull(socBefore),
      socAfter: nOrNull(socAfter),
      kwh: Number(kwh),
      price,
      fee: null,
      total: n(kwh) * n(price),
      dashEff: null,
      dashEffUnit: settings.dashEffUnit || 'km/kWh',
      note: '',
      images: [],
    });
    setSocBefore('');
    setSocAfter('');
    setKwh('');
    setBusy(false);
    toast('บันทึกการชาร์จเรียบร้อย');
  }

  return (
    <div className="sb-quick">
      <div className="hd">
        <div className="t">
          <b>Quick Add</b>
          <span>บันทึกการชาร์จล่าสุด</span>
        </div>
        <button type="button" className="add" onClick={() => setQuickOpen(true)} title="กรอกแบบละเอียด">
          <Icon name="plus" />
        </button>
      </div>

      <div className="sb-field">
        <label htmlFor="sq-a">% เริ่มต้น</label>
        <input id="sq-a" type="number" min="0" max="100" step="any" inputMode="decimal" placeholder="20"
          value={socBefore} onChange={(e) => setSocBefore(e.target.value)} />
      </div>
      <div className="sb-field">
        <label htmlFor="sq-b">% สิ้นสุด</label>
        <input id="sq-b" type="number" min="0" max="100" step="any" inputMode="decimal" placeholder="90"
          value={socAfter} onChange={(e) => setSocAfter(e.target.value)} />
      </div>
      <div className="sb-field">
        <label htmlFor="sq-k">พลังงาน</label>
        <input id="sq-k" type="number" min="0" step="any" inputMode="decimal" placeholder="32.45 kWh"
          value={kwh} onChange={(e) => setKwh(e.target.value)} />
      </div>

      <button type="button" className="save" onClick={save} disabled={!canSave || busy}>
        {cars.length ? 'บันทึก' : 'เพิ่มรถก่อน'}
      </button>
    </div>
  );
}
