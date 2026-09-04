/**
 * ตรวจค่าที่กรอกในฟอร์มบันทึกการชาร์จ
 *
 * แยกออกมาเป็นฟังก์ชันล้วน ไม่ผูกกับ React เพื่อให้เขียนเทสต์ครอบได้จริง
 * และให้ฟอร์มเต็มกับ Quick Add ใช้กติกาชุดเดียวกัน ไม่ต้องเขียนซ้ำสองที่
 *
 * แบ่งเป็นสองกลุ่มเพราะจังหวะที่ควรขึ้นข้อความต่างกัน
 *   missingFields — ยังไม่ได้กรอกช่องที่จำเป็น ขึ้นตอนกดบันทึกเท่านั้น
 *                   ถ้าขึ้นตั้งแต่เปิดหน้า ฟอร์มจะแดงทั้งที่ผู้ใช้ยังไม่ได้ทำอะไรผิด
 *   fieldErrors   — กรอกมาแล้วแต่ค่าผิด ขึ้นทันทีระหว่างพิมพ์ จะได้แก้ตรงนั้นเลย
 *
 * ข้อความคืนเป็นภาษาไทย แล้วให้ <Field> เรียก t() แปลอีกทีตามภาษาที่เลือก
 */
import { isNum, todayISO } from './format';

const num = (v) => (isNum(v) ? Number(v) : null);

/**
 * กรอกอะไรมาจริงๆ หรือยัง
 * ต้อง trim ก่อน เพราะ isNum('   ') คืน true (Number ของช่องว่างล้วนคือ 0)
 * ถ้าไม่ตัดช่องว่างทิ้ง ช่องที่มีแต่เว้นวรรคจะถูกมองเป็นเลข 0 แล้วขึ้นว่า "ต้องมากกว่า 0"
 * ทั้งที่ผู้ใช้ยังไม่ได้กรอกอะไรเลย
 */
const filled = (v) => String(v ?? '').trim() !== '';

/** ช่องที่ไม่กรอกแล้วบันทึกไม่ได้เลย — เหลือแค่สองช่องนี้ ที่เหลือกรอกทีหลังได้ */
export function missingFields(form) {
  const out = {};
  if (!form.carId) out.carId = 'เลือกรถก่อนถึงจะบันทึกได้';
  if (!form.date) out.date = 'ใส่วันที่ก่อนถึงจะบันทึกได้';
  return out;
}

/**
 * ค่าที่กรอกมาแล้วแต่ผิด
 * ช่องที่เว้นว่างไว้ไม่ถือว่าผิด เพราะตั้งใจให้กรอกทีหลังได้
 */
export function fieldErrors(form, today = todayISO()) {
  const out = {};

  /** ตัวเลขที่ห้ามติดลบ — ค่าลบในฟอร์มนี้ไม่มีความหมายที่ถูกต้องเลยสักช่อง */
  for (const k of ['odoBefore', 'odoAfter', 'kwh', 'price', 'fee', 'discount', 'total', 'durH', 'durM', 'durS']) {
    const v = num(form[k]);
    if (v !== null && v < 0) out[k] = 'ห้ามติดลบ';
  }

  // วันที่ล่วงหน้าแปลว่าพิมพ์ปีหรือเดือนผิด — สมุดบันทึกไม่มีเหตุให้จดล่วงหน้า
  // และถ้าปล่อยผ่าน รายงานรายเดือนจะเพี้ยนไปทั้งเดือนโดยไม่มีอะไรเตือน
  if (form.date && form.date > today) out.date = 'วันที่ล่วงหน้าเกินวันนี้';

  // SOC เป็นเปอร์เซ็นต์ของแบต จึงอยู่นอกช่วง 0-100 ไม่ได้
  for (const k of ['socBefore', 'socAfter']) {
    const v = num(form[k]);
    if (v !== null && (v < 0 || v > 100)) out[k] = 'ต้องอยู่ระหว่าง 0 ถึง 100';
  }

  const odoBefore = num(form.odoBefore);
  const odoAfter = num(form.odoAfter);
  if (!out.odoAfter && odoBefore !== null && odoAfter !== null && odoAfter < odoBefore) {
    out.odoAfter = 'น้อยกว่าเลขไมล์ครั้งก่อน';
  }

  const socBefore = num(form.socBefore);
  const socAfter = num(form.socAfter);
  if (!out.socAfter && socBefore !== null && socAfter !== null && socAfter < socBefore) {
    out.socAfter = 'น้อยกว่า SOC ก่อนชาร์จ';
  }

  // ศูนย์ในสองช่องนี้ไม่ใช่ "ยังไม่กรอก" แต่เป็นค่าที่เป็นไปไม่ได้
  // (ชาร์จแล้วต้องได้พลังงาน · รถวิ่งได้ 0 กม./kWh ไม่มีจริง)
  if (num(form.kwh) === 0 && filled(form.kwh)) out.kwh = 'ต้องมากกว่า 0';
  const dashEff = num(form.dashEff);
  if (dashEff !== null && dashEff <= 0) out.dashEff = 'ต้องมากกว่า 0';

  // ส่วนลดเกินยอดทำให้ยอดรวมติดลบ ซึ่งถูกหนีบเป็น 0 อยู่แล้ว
  // ถ้าไม่บอก ผู้ใช้จะเห็นยอด 0 บาทโดยไม่รู้ว่าพิมพ์ผิดตรงไหน
  const discount = num(form.discount);
  if (!out.discount && discount !== null && discount > 0) {
    const gross = (num(form.kwh) ?? 0) * (num(form.price) ?? 0) + (num(form.fee) ?? 0);
    if (gross > 0 && discount > gross) out.discount = 'ส่วนลดมากกว่ายอดค่าชาร์จ';
  }

  return out;
}

/**
 * บันทึกครบแล้วหรือยัง
 * "ยังไม่ครบ" = จดข้อมูลก่อนชาร์จไว้ แต่ยังไม่ได้ใส่พลังงานที่ชาร์จได้จริง
 * ใช้ตัวเดียวกันทั้งในฟอร์ม (เปลี่ยนข้อความบนปุ่ม) และในหน้าประวัติ (ติดป้ายกำกับ)
 */
export const isSessionComplete = (s) => filled(s?.kwh) && isNum(s.kwh) && Number(s.kwh) > 0;
