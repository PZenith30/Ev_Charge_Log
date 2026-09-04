/** ส่งออกข้อมูล — CSV สำหรับเปิดใน Excel/Sheets และ JSON สำหรับสำรอง/กู้คืน */
import { COST_CATS } from './data';
import { hms, n, todayISO } from './format';
import { sDashReading, sDist, sSoc, sTotal, sEff, sEff100, sKwh100, sBahtKm, sPricePerKwh } from './calc';

export function download(filename, content, mime = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 500);
}

const cell = (v) => '"' + String(v === null || v === undefined ? '' : v).replace(/"/g, '""') + '"';
/** BOM (U+FEFF) นำหน้าเพื่อให้ Excel อ่านภาษาไทยไม่เพี้ยน */
const BOM = '\uFEFF';
const toCsv = (rows) => BOM + rows.map((r) => r.map(cell).join(',')).join('\r\n');

const num = (v, d) => (v === null || v === undefined || !Number.isFinite(v) ? '' : v.toFixed(d));

export function sessionsToCsv(list, carName) {
  const head = [
    'วันที่', 'รถ', 'ประเภท', 'สถานี',
    'เวลาที่ใช้ชาร์จ (ชม:นาที:วิ)', 'เวลาที่ใช้ชาร์จ (วินาที)',
    'เลขไมล์ครั้งก่อน (km)', 'เลขไมล์ปัจจุบัน (km)', 'ระยะทางที่วิ่งได้ (km)',
    'SOC ก่อน (%)', 'SOC หลัง (%)', 'SOC เพิ่ม (%)',
    'พลังงาน (kWh)', 'ราคา/kWh (฿)', 'ค่าปรับ (฿)', 'ส่วนลด (฿)', 'ค่าใช้จ่ายรวม (฿)',
    'km/kWh', 'km/100kWh', 'kWh/100km', 'บาท/km',
    'หน้าปัด (km/kWh)', 'หน้าปัด (km/100kWh)', 'หน่วยที่กรอก', 'หมายเหตุ',
  ];
  const rows = list.map((s) => {
    const dash = sDashReading(s);
    return [
      s.date, carName(s.carId), s.type || 'AC', s.station || '',
      hms(Number(s.durationSec)), s.durationSec ?? '',
      s.odoBefore ?? '', s.odoAfter ?? '', num(sDist(s), 2),
      s.socBefore ?? '', s.socAfter ?? '', sSoc(s) ?? '',
      n(s.kwh).toFixed(2), num(sPricePerKwh(s), 2), n(s.fee).toFixed(2), n(s.discount).toFixed(2), sTotal(s).toFixed(2),
      num(sEff(s), 3), num(sEff100(s), 1), num(sKwh100(s), 2), num(sBahtKm(s), 3),
      dash ? dash.base.toFixed(2) : '', dash ? (dash.base * 100).toFixed(0) : '', dash ? dash.unit : '',
      s.note || '',
    ];
  });
  return toCsv([head, ...rows]);
}

export function costsToCsv(list, carName) {
  const head = ['วันที่', 'ประเภท', 'รถ', 'จำนวนเงิน (฿)', 'รายละเอียด'];
  const rows = list.map((c) => [
    c.date,
    (COST_CATS[c.cat] || COST_CATS.other).label,
    carName(c.carId),
    n(c.amount).toFixed(2),
    c.note || '',
  ]);
  return toCsv([head, ...rows]);
}

/**
 * ส่งออกข้อมูลเป็นไฟล์ JSON
 * ตัวรูปแนบไม่ได้อยู่ในไฟล์นี้ — รูปเก็บอยู่ในบัคเก็ตของ Supabase Storage
 * ไฟล์นี้เก็บแค่ path ของรูปไว้อ้างอิง
 */
export function exportBackup(state) {
  const payload = {
    app: 'ev-charge-log',   // ตัวระบุรูปแบบไฟล์ ไม่ใช่ชื่อแบรนด์ คงไว้เพื่อให้ไฟล์สำรองเก่ายังเข้ากันได้
    version: 2,
    exportedAt: new Date().toISOString(),
    data: state,
  };
  download('kiloev-' + todayISO() + '.json', JSON.stringify(payload), 'application/json');
}

/** อ่านไฟล์สำรอง คืน {data, images} — โยน Error พร้อมข้อความไทยเมื่อไฟล์ไม่ถูกต้อง */
export function readBackup(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ'));
    fr.onload = () => {
      let parsed;
      try {
        parsed = JSON.parse(fr.result);
      } catch {
        return reject(new Error('ไฟล์ไม่ถูกต้อง — อ่าน JSON ไม่ได้'));
      }
      if (!parsed || !parsed.data || !Array.isArray(parsed.data.sessions)) {
        return reject(new Error('ไฟล์นี้ไม่ใช่ไฟล์สำรองของ KiloEV'));
      }
      resolve({ data: parsed.data, images: parsed.images || [] });
    };
    fr.readAsText(file);
  });
}
