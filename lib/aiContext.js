/**
 * สรุปข้อมูลของผู้ใช้ให้กะทัดรัดก่อนส่งไปให้ AI
 *
 * หลักการ
 *  - ใช้สูตรจาก lib/calc.js ตัวเดียวกับที่หน้าจอใช้ ตัวเลขจึงตรงกันเสมอ
 *  - ส่งเป็นค่าสรุปเป็นหลัก ไม่ส่งทุกแถว เพื่อประหยัด token และลดข้อมูลที่ออกนอกเครื่อง
 *  - ไม่ส่งฟิลด์ที่ระบุตัวตนหรือไม่มีประโยชน์กับ AI: ทะเบียนรถ อีเมล path รูป
 */
import { monthlyTotals, dueList, sDist, sEff, sKwh100, sTotal, summarize } from './calc';
import { COST_CATS } from './data';
import { n, todayISO } from './format';

/** จำนวนการชาร์จล่าสุดที่ส่งไปให้ AI ดูรายตัว */
export const RECENT_LIMIT = 25;
const MONTH_LIMIT = 12;
const NOTE_LIMIT = 120;

const r2 = (v) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Math.round(Number(v) * 100) / 100);
const r0 = (v) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Math.round(Number(v)));

/** ดึงเฉพาะตัวเลขสรุปที่ AI ใช้ตอบได้จริง */
function pickSummary(s) {
  return {
    ครั้ง: s.count,
    พลังงานkWh: r2(s.kwh),
    ค่าชาร์จบาท: r2(s.cost),
    ระยะทางkm: r2(s.dist),
    ชั่วโมงที่ชาร์จ: r2(s.seconds / 3600),
    ครั้งAC: s.ac,
    ครั้งDC: s.dc,
    ราคาเฉลี่ยบาทต่อkWh: r2(s.avgPrice),
    ราคาเฉลี่ยAC: r2(s.acPrice),
    ราคาเฉลี่ยDC: r2(s.dcPrice),
    kmต่อkWh: r2(s.eff),
    kWhต่อ100km: r2(s.kwh100),
    บาทต่อkm: r2(s.bahtKm),
  };
}

/**
 * สร้าง context สำหรับส่งให้ AI
 * @param store ค่าที่ดึงมาจาก useStore() — sessions/costs ถูกกรองตามรถที่เลือกไว้แล้ว
 */
export function buildContext({
  cars = [],
  sessions = [],
  costs = [],
  alerts = [],
  settings = {},
  activeCar = null,
  showAllCars = false,
  periodSessions = [],
  periodCosts = [],
  range = {},
} = {}) {
  const all = summarize(sessions);
  const inPeriod = summarize(periodSessions);
  const months = monthlyTotals(sessions, costs).slice(-MONTH_LIMIT);

  const byCat = {};
  for (const c of costs) {
    const label = (COST_CATS[c.cat] || COST_CATS.other).label;
    byCat[label] = r2((byCat[label] || 0) + n(c.amount));
  }

  const budget = n(settings.budget);
  const monthCount = months.length || 1;
  const avgPerMonth = months.reduce((a, [, m]) => a + m.charge + m.other, 0) / monthCount;

  const due = dueList(alerts, settings.advanceDays)
    .filter((a) => a.level !== 'ok')
    .slice(0, 10)
    .map((a) => ({ หัวข้อ: a.title || a.type, ประเภท: a.type, ครบกำหนด: a.due, เหลืออีกกี่วัน: a.days }));

  const recent = sessions.slice(0, RECENT_LIMIT).map((s) => ({
    วันที่: s.date,
    ประเภท: s.type === 'DC' ? 'DC' : 'AC',
    สถานี: s.station || null,
    พลังงานkWh: r2(s.kwh),
    ค่าใช้จ่ายบาท: r2(sTotal(s)),
    ระยะทางkm: r2(sDist(s)),
    kmต่อkWh: r2(sEff(s)),
    kWhต่อ100km: r2(sKwh100(s)),
    socก่อน: r0(s.socBefore),
    socหลัง: r0(s.socAfter),
    นาทีที่ชาร์จ: r0(n(s.durationSec) / 60) || null,
    หมายเหตุ: s.note ? String(s.note).slice(0, NOTE_LIMIT) : null,
  }));

  return {
    วันนี้: todayISO(),
    สกุลเงิน: 'บาท',
    // ตั้งใจไม่ส่งทะเบียนรถและ path รูป เพราะ AI ไม่ต้องใช้
    รถ: cars.map((c) => ({
      ชื่อ: c.name,
      ยี่ห้อ: c.brand || null,
      รุ่น: c.model || null,
      ความจุแบตkWh: r2(c.batt),
      ระยะทางที่วิ่งได้km: r0(c.range),
      กำลังดูอยู่: !showAllCars && activeCar?.id === c.id,
    })),
    กำลังดูข้อมูลของ: showAllCars ? 'รถทุกคัน' : activeCar?.name || 'ยังไม่ได้เลือกรถ',
    ช่วงเวลาที่เลือกบนหน้าจอ: range.from || range.to ? { ตั้งแต่: range.from, ถึง: range.to } : 'ทั้งหมด',
    สรุปทั้งหมดตั้งแต่เริ่มบันทึก: pickSummary(all),
    สรุปเฉพาะช่วงที่เลือก: pickSummary(inPeriod),
    ต้นทุนอื่นในช่วงที่เลือกบาท: r2(periodCosts.reduce((a, c) => a + n(c.amount), 0)),
    ยอดรายเดือน: months.map(([month, m]) => ({
      เดือน: month,
      ค่าชาร์จ: r2(m.charge),
      ต้นทุนอื่น: r2(m.other),
      พลังงานkWh: r2(m.kwh),
      ระยะทางkm: r2(m.dist),
      จำนวนครั้ง: m.count,
    })),
    ต้นทุนแยกประเภท: byCat,
    งบประมาณต่อเดือน: budget > 0 ? { ตั้งไว้: budget, ใช้จริงเฉลี่ย: r2(avgPerMonth), เกินงบ: avgPerMonth > budget } : 'ยังไม่ได้ตั้งงบ',
    ราคาเริ่มต้นที่ตั้งไว้: { AC: r2(settings.priceAC), DC: r2(settings.priceDC) },
    รายการเตือนที่ใกล้ครบกำหนด: due.length ? due : 'ไม่มี',
    [`การชาร์จล่าสุด${RECENT_LIMIT}ครั้ง`]: recent,
    หมายเหตุ: `ส่งมาเฉพาะ ${recent.length} รายการล่าสุด จากทั้งหมด ${sessions.length} รายการ`,
  };
}
