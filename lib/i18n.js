/**
 * ระบบสองภาษา ไทย (ค่าเริ่มต้น) กับอังกฤษ
 *
 * ออกแบบให้ "ข้อความไทยเป็นคีย์" ไม่ได้ตั้งคีย์แยกแบบ nav.history
 * เหตุผล
 *   - ภาษาไทยเป็นค่าเริ่มต้น พอใช้ไทยเป็นคีย์ โหมดไทยจึงไม่ต้องเปิดพจนานุกรมเลย
 *   - ข้อความที่ยังไม่ได้แปลจะตกกลับเป็นภาษาไทยเอง ไม่ใช่โชว์คีย์ดิบให้ผู้ใช้เห็น
 *   - อ่านโค้ดแล้วเห็นข้อความจริงเลย ไม่ต้องเปิดสองไฟล์เทียบกัน
 *   - ข้อมูลคงที่อย่าง NAV / COST_CATS / PERIOD_PRESETS ไม่ต้องแก้โครงสร้าง
 *     แค่ห่อด้วย t() ตอนเอาไปแสดง
 *
 * ภาษาเก็บใน localStorage ไม่ได้เก็บลง Supabase โดยตั้งใจ
 *   ตาราง settings เป็นคอลัมน์ตายตัว การเพิ่มคอลัมน์ต้องรัน SQL ก่อน
 *   ถ้าผู้ใช้ยังไม่รัน การบันทึกการตั้งค่า "ทั้งหมด" จะพัง ไม่ใช่แค่เรื่องภาษา
 *   ภาษาเป็นค่าที่ผูกกับเครื่องคล้ายธีม จึงยอมให้เป็นรายเครื่องไปก่อน
 */

export const LANGS = [
  { code: 'th', label: 'ไทย', short: 'TH' },
  { code: 'en', label: 'English', short: 'EN' },
];
export const DEFAULT_LANG = 'th';
export const LANG_KEY = 'evlog.lang';   // ขึ้นต้นด้วย evlog. ให้เข้าชุดกับคีย์อื่นในเครื่อง

export const isLang = (v) => LANGS.some((l) => l.code === v);

export function readLang() {
  try {
    const v = localStorage.getItem(LANG_KEY);
    return isLang(v) ? v : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}
export function saveLang(code) {
  try {
    localStorage.setItem(LANG_KEY, code);
  } catch { /* โหมดส่วนตัวเขียนไม่ได้ */ }
}

/**
 * ภาษาปัจจุบันแบบตัวแปรระดับโมดูล
 *
 * มีไว้ให้ฟังก์ชันที่ไม่ใช่คอมโพเนนต์ใช้ได้ด้วย เช่นตัวจัดรูปแบบวันที่ใน lib/format.js
 * ซึ่งถูกเรียกจากหลายที่ ถ้าต้องส่ง lang เข้าไปทุกจุดจะรกมาก
 * การเปลี่ยนค่านี้ไม่ได้สั่งให้ React วาดใหม่เอง แต่ store เปลี่ยน state พร้อมกันอยู่แล้ว
 * ทุกอย่างจึงวาดใหม่และอ่านค่าล่าสุดตอนวาด
 */
let currentLang = DEFAULT_LANG;
export const getLang = () => currentLang;
export function setCurrentLang(code) {
  currentLang = isLang(code) ? code : DEFAULT_LANG;
}

/** แทนที่ {name} ด้วยค่าที่ส่งมา — ชื่อช่องต้องเป็นอักษรอังกฤษ เพราะ \w ไม่ครอบอักษรไทย */
function fill(text, vars) {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

/**
 * แปลข้อความ — คืนข้อความไทยเดิมเมื่อยังไม่มีคำแปล
 * @param {string} text ข้อความภาษาไทย (ใช้เป็นคีย์)
 * @param {object} [vars] ค่าที่จะเติมลงในช่อง {name}
 * @param {string} [lang] ระบุภาษาเองได้ ไม่ระบุจะใช้ภาษาปัจจุบัน
 */
export function translate(text, vars, lang) {
  const code = lang || currentLang;
  if (typeof text !== 'string' || !text) return text;
  if (code === 'th') return fill(text, vars);
  const dict = DICT[code];
  return fill((dict && dict[text]) || text, vars);
}

/** ใช้ในสคริปต์ตรวจ ว่าแปลไปแล้วกี่ข้อความ */
export const dictSize = (code) => Object.keys(DICT[code] || {}).length;
export const hasTranslation = (code, text) => Boolean(DICT[code] && DICT[code][text]);

/**
 * พจนานุกรมอังกฤษ — คีย์คือข้อความไทยที่ปรากฏในโค้ด ต้องตรงทุกตัวอักษรรวมช่องว่าง
 * เรียงตามหมวดให้หาง่าย ไม่ได้เรียงตามตัวอักษร
 */
const EN = {
  /* ---------------- เมนูและหัวข้อหน้า ---------------- */
  'แดชบอร์ด': 'Dashboard',
  'หน้าหลัก': 'Home',
  'ภาพรวมการชาร์จและค่าใช้จ่ายทั้งหมด': 'Overview of charging and all costs',
  'บันทึกการชาร์จ': 'Log a charge',
  'กรอกข้อมูลการชาร์จแต่ละครั้ง ระบบคำนวณให้อัตโนมัติ': 'Enter each session — the rest is calculated for you',
  'ประวัติ': 'History',
  'ประวัติการชาร์จ': 'Charge history',
  'ค้นหา กรอง และแก้ไขรายการย้อนหลัง': 'Search, filter and edit past records',
  'ต้นทุน': 'Costs',
  'ต้นทุนรถ': 'Vehicle costs',
  'ต้นทุนอื่น': 'Other costs',
  'ค่าไฟ ค่าบำรุงรักษา ประกันภัย ภาษี และอื่นๆ': 'Electricity, maintenance, insurance, tax and more',
  'สถานีชาร์จ': 'Stations',
  'ค้นสถานีชาร์จใกล้ตัวจาก Open Charge Map': 'Find nearby stations via Open Charge Map',
  'รายงาน': 'Reports',
  'สรุปรายเดือน / รายปี พร้อมพิมพ์เป็น PDF': 'Monthly and yearly summaries, printable as PDF',
  'เตือน': 'Reminders',
  'แจ้งเตือน': 'Reminders',
  'กำหนดการบำรุงรักษา ต่อประกัน ต่อภาษี และงบประมาณ': 'Maintenance, insurance, tax schedules and budget',
  'บัญชี': 'Account',
  'บัญชีและรถของฉัน': 'Account and my cars',
  'บัญชี & รถของฉัน': 'Account & my cars',
  'จัดการรถ ค่าเริ่มต้น และข้อมูลสำรอง': 'Manage cars, defaults and backups',
  'บัญชีผู้ใช้': 'User account',
  'เมนูลัด': 'Shortcuts',
  'สถานีชาร์จใกล้ฉัน': 'Stations near me',
  'บันทึกการชาร์จด่วน': 'Quick add charge',
  'บันทึกด่วน': 'Quick add',
  'แชทกับ AI': 'Chat with AI',
  'ช่วง{range} — เปลี่ยนได้ที่แถบด้านบน': '{range} — change it in the top bar',
  'ถามผู้ช่วย AI': 'Ask the AI assistant',
  'เข้าสู่ระบบด้วย Supabase Auth': 'Signed in with Supabase Auth',
  'เปลี่ยนเป็น {lang}': 'Switch to {lang}',
  'สลับเป็นโหมดมืด': 'Switch to dark mode',
  'สลับเป็นโหมดสว่าง': 'Switch to light mode',
  'ออกจากระบบ': 'Sign out',
  'ต้องออกจากระบบตอนนี้เลยไหม ข้อมูลถูกบันทึกไว้บน Supabase แล้ว': 'Sign out now? Your data is already saved on Supabase.',
  'เปลี่ยนรหัสผ่าน': 'Change password',
  'ภาษา': 'Language',
  'ตั้งแยกในแต่ละเครื่อง · มีผลทันทีโดยไม่ต้องกดบันทึก': 'Set per device — applies immediately, no need to save',

  /* ---------------- เข้าสู่ระบบ ---------------- */
  'เข้าสู่ระบบ': 'Sign in',
  'บันทึกและวิเคราะห์การชาร์จรถไฟฟ้าของคุณ': 'Track and analyse your EV charging',
  'สมัครสมาชิก': 'Sign up',
  'สร้างบัญชีใหม่เพื่อเริ่มบันทึกการชาร์จ': 'Create an account to start logging charges',
  'ลืมรหัสผ่าน': 'Forgot password',
  'กรอกอีเมลที่ใช้สมัคร ระบบจะส่งลิงก์ตั้งรหัสใหม่ให้': 'Enter your email and we will send a reset link',
  'ส่งลิงก์ตั้งรหัสใหม่': 'Send reset link',
  'อีเมล': 'Email',
  'รหัสผ่าน': 'Password',
  'ยืนยันรหัสผ่าน': 'Confirm password',
  'อย่างน้อย 6 ตัวอักษร': 'At least 6 characters',
  'กำลังดำเนินการ…': 'Working…',
  'ลืมรหัสผ่าน?': 'Forgot password?',
  'ยังไม่มีบัญชี? สมัคร': 'No account? Sign up',
  'มีบัญชีแล้ว? เข้าสู่ระบบ': 'Already have an account? Sign in',
  'กลับไปเข้าสู่ระบบ': 'Back to sign in',
  'แสดงรหัสผ่าน': 'Show password',
  'ซ่อนรหัสผ่าน': 'Hide password',
  'กรุณากรอกอีเมล': 'Please enter your email',
  'กรุณากรอกรหัสผ่าน': 'Please enter your password',
  'รูปแบบอีเมลไม่ถูกต้อง': 'That email address is not valid',
  'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร': 'Password must be at least 6 characters',
  'รหัสผ่านทั้งสองช่องไม่ตรงกัน': 'The two passwords do not match',
  'รหัสผ่านสั้นเกินไป ต้องมีอย่างน้อย 6 ตัวอักษร': 'Password is too short — at least 6 characters',
  'อีเมลหรือรหัสผ่านไม่ถูกต้อง': 'Wrong email or password',
  'อีเมลนี้สมัครไว้แล้ว ลองเข้าสู่ระบบแทน': 'That email is already registered — try signing in',
  'ยังไม่ได้ยืนยันอีเมล — กรุณาเปิดลิงก์ยืนยันในอีเมลก่อน': 'Email not confirmed yet — open the confirmation link we sent you',
  'ส่งคำขอถี่เกินไป กรุณารอสักครู่แล้วลองใหม่': 'Too many requests — wait a moment and try again',
  'ยังไม่ได้เข้าสู่ระบบ': 'Not signed in',
  'เซสชันหมดอายุ — กรุณาเข้าสู่ระบบใหม่': 'Session expired — please sign in again',
  'เปลี่ยนรหัสผ่านเรียบร้อย': 'Password changed',
  'บันทึกรหัสผ่านใหม่': 'Save new password',

  /* ---------------- คำที่ใช้ซ้ำทั้งเว็ป ---------------- */
  'บันทึก': 'Save',
  'ยกเลิก': 'Cancel',
  'ลบ': 'Delete',
  'แก้ไข': 'Edit',
  'เพิ่ม': 'Add',
  'ปิด': 'Close',
  'ยืนยัน': 'Confirm',
  'ค้นหา': 'Search',
  'ล้าง': 'Clear',
  'ทั้งหมด': 'All',
  'ครั้ง': 'times',
  'รายการ': 'items',
  'รายละเอียด': 'Details',
  'บาท': 'THB',
  'วันนี้': 'Today',
  'วัน': 'days',
  'ชม.': 'h',
  'นาที': 'min',
  'วิ': 's',
  'รถ': 'Car',
  'รถทุกคัน': 'All cars',
  'รถยนต์ไฟฟ้า': 'Electric vehicle',
  'ยังไม่มีข้อมูล': 'No data yet',
  'ไม่ระบุ': 'Not set',
  'ไม่ระบุรุ่น': 'Model not set',
  'ไม่ระบุสถานี': 'No station',
  'ลองใหม่': 'Try again',
  'ค้นใหม่': 'Search again',
  'ดูทั้งหมด': 'View all',

  /* ---------------- ช่วงเวลา ---------------- */
  '7 วันล่าสุด': 'Last 7 days',
  '30 วันล่าสุด': 'Last 30 days',
  'เดือนนี้': 'This month',
  'เดือนที่แล้ว': 'Last month',
  'ปีนี้': 'This year',
  'กำหนดเอง': 'Custom',
  'จากเมื่อวาน': 'vs yesterday',
  'จาก 7 วันก่อนหน้า': 'vs previous 7 days',
  'จาก 30 วันก่อนหน้า': 'vs previous 30 days',
  'จากเดือนก่อนหน้า': 'vs previous month',
  'จากเดือนที่แล้ว': 'vs last month',
  'จากปีที่แล้ว': 'vs last year',
  'จากช่วงก่อนหน้า': 'vs previous period',
  'ไม่มีข้อมูลเทียบ': 'Nothing to compare',

  /* ---------------- บันทึกการชาร์จ ---------------- */
  'AC (ชาร์จปกติ)': 'AC (normal)',
  'DC (ชาร์จเร็ว)': 'DC (fast)',
  'ชาร์จ AC': 'AC charge',
  'ชาร์จเร็ว DC': 'DC fast charge',
  'วันที่': 'Date',
  'เวลา': 'Time',
  'ประเภท': 'Type',
  'สถานี': 'Station',
  'พลังงาน (kWh)': 'Energy (kWh)',
  'ราคา/kWh (฿)': 'Price per kWh (฿)',
  'ค่าปรับ (฿)': 'Penalty (฿)',
  'ส่วนลด (฿)': 'Discount (฿)',
  'ค่าใช้จ่ายรวม': 'Total cost',
  'ค่าใช้จ่ายรวม (฿)': 'Total cost (฿)',
  'ค่าใช้จ่าย/km': 'Cost per km',
  'บาท/km': 'THB/km',
  'ค่าชาร์จ': 'Charging',
  'เลขไมล์ก่อนชาร์จ (km)': 'Odometer before (km)',
  'เลขไมล์หลังชาร์จ (km)': 'Odometer after (km)',
  'SOC ก่อน (%)': 'SOC before (%)',
  'SOC หลัง (%)': 'SOC after (%)',
  'SOC เพิ่ม (%)': 'SOC gained (%)',
  'SOC ที่เพิ่มขึ้น': 'SOC gained',
  'เวลาที่ใช้ชาร์จ (ชม:นาที:วิ)': 'Charging time (h:mm:ss)',
  'เวลาที่ใช้ชาร์จ (วินาที)': 'Charging time (seconds)',
  'ระยะทาง': 'Distance',
  'ระยะทางที่วิ่งได้': 'Range',
  'ระยะทางที่วิ่งได้ (km)': 'Range (km)',
  'หน่วยที่กรอก': 'Entered unit',
  'อีกหน่วย': 'Other unit',
  'หน้าปัด (km/kWh)': 'Dash reading (km/kWh)',
  'หน้าปัด (km/100kWh)': 'Dash reading (km/100kWh)',
  'หมายเหตุ': 'Notes',
  'รูปแนบ': 'Attachments',
  'แนบรูป': 'Attach photo',
  'บันทึกการชาร์จเรียบร้อย': 'Charge saved',
  'บันทึกการแก้ไข': 'Save changes',
  'แก้ไขรายการเรียบร้อย': 'Changes saved',
  'กรุณาเลือกรถ': 'Please choose a car',
  'กรุณาเลือกวันที่': 'Please choose a date',
  'กรุณากรอกพลังงานที่ชาร์จ (kWh)': 'Please enter the energy charged (kWh)',
  'กรุณาเพิ่มรถก่อนบันทึกการชาร์จ': 'Add a car before logging a charge',
  'เพิ่มรถก่อน': 'Add a car first',
  'ยังไม่มีเลขไมล์ตั้งต้น': 'No starting odometer yet',
  'ยังไม่เคยกรอก SOC': 'No SOC entered yet',
  'ยังไม่ได้กรอกเวลาที่ใช้ชาร์จ': 'Charging time not entered',
  'ยังไม่มีข้อมูล SOC': 'No SOC data',
  'ยกข้อมูลที่กรอกไว้มาให้แล้ว': 'Carried over what you already entered',
  'ลบการชาร์จรายการนี้ออกจากประวัติถาวร รวมถึงรูปที่แนบไว้': 'Permanently delete this session and its photos',
  'ลบรายการนี้': 'Delete this record',
  'ลบรายการแล้ว': 'Record deleted',
  'ยังไม่มีประวัติการชาร์จ': 'No charging history yet',
  'ไม่พบรายการที่ตรงกับตัวกรอง': 'Nothing matches these filters',
  'ไม่มีรายการชาร์จในงวดนี้': 'No charges in this period',
  'ไม่มีรายการให้ส่งออก': 'Nothing to export',

  /* ---------------- ต้นทุนและแจ้งเตือน ---------------- */
  'ค่าไฟ': 'Electricity',
  'ค่าบำรุงรักษา': 'Maintenance',
  'ค่าประกันภัย': 'Insurance',
  'ค่าภาษี': 'Road tax',
  'ค่าใช้จ่ายอื่นๆ': 'Other',
  'บำรุงรักษา': 'Maintenance',
  'ประกันภัย': 'Insurance',
  'ภาษี': 'Road tax',
  'อื่นๆ': 'Other',
  'จำนวนเงิน (฿)': 'Amount (฿)',
  'เพิ่มรายการต้นทุน': 'Add a cost',
  'เพิ่มรายการต้นทุนเรียบร้อย': 'Cost added',
  'แก้ไขรายการต้นทุน': 'Edit cost',
  'ลบรายการต้นทุนนี้ถาวร รวมถึงรูปที่แนบไว้': 'Permanently delete this cost and its photos',
  'กรุณากรอกจำนวนเงิน': 'Please enter an amount',
  'เพิ่มการเตือน': 'Add a reminder',
  'เพิ่มการเตือนเรียบร้อย': 'Reminder added',
  'แก้ไขการเตือน': 'Edit reminder',
  'แก้ไขการเตือนเรียบร้อย': 'Reminder updated',
  'ลบการเตือนนี้': 'Delete this reminder',
  'ลบการเตือนแล้ว': 'Reminder deleted',
  'ลบรายการเตือนนี้ถาวร': 'Permanently delete this reminder',
  'กรุณาเลือกวันครบกำหนด': 'Please choose a due date',
  'ครบกำหนดวันนี้': 'Due today',

  /* ---------------- รถ ---------------- */
  'เพิ่มรถ': 'Add a car',
  'เพิ่มรถเรียบร้อย': 'Car added',
  'แก้ไขข้อมูลรถ': 'Edit car',
  'แก้ไขข้อมูลรถเรียบร้อย': 'Car updated',
  'ลบรถคันนี้': 'Delete this car',
  'ลบรถแล้ว': 'Car deleted',
  'กรุณาตั้งชื่อรถ': 'Please name the car',
  '— เลือกยี่ห้อก่อน —': '— Choose a brand first —',
  '— เลือกรุ่น —': '— Choose a model —',
  'รูปรถ': 'Car photo',
  'ค้นรูปจากอินเทอร์เน็ต': 'Find a photo online',
  'ค้นรูปรถไม่สำเร็จ': 'Could not find a photo',
  'เลือกยี่ห้อและรุ่นก่อน จึงจะค้นรูปได้': 'Choose a brand and model first',

  /* ---------------- สถานีชาร์จ ---------------- */
  'ตำแหน่งฉัน': 'My location',
  'ตำแหน่งปัจจุบัน': 'Current location',
  'ยังไม่ได้เลือกตำแหน่ง': 'No location chosen yet',
  '— เลือกเมือง —': '— Choose a city —',
  'กรุงเทพฯ': 'Bangkok',
  'นนทบุรี': 'Nonthaburi',
  'ชลบุรี / พัทยา': 'Chonburi / Pattaya',
  'เชียงใหม่': 'Chiang Mai',
  'ขอนแก่น': 'Khon Kaen',
  'ภูเก็ต': 'Phuket',
  'หาดใหญ่': 'Hat Yai',
  'กำลังค้นหา…': 'Searching…',
  'กำลังค้น…': 'Searching…',
  'กำลังหา…': 'Locating…',
  'ไม่พบสถานีในรัศมีนี้ — ลองขยายรัศมีดู': 'No stations within this radius — try a wider one',
  'ไม่มีรายละเอียดที่อยู่': 'No address details',
  'ยังไม่ได้ตั้งคีย์': 'API key not set',
  'ยังไม่ได้ใส่คีย์': 'API key missing',
  'คีย์ไม่ถูกต้อง': 'Invalid API key',
  'เบราว์เซอร์นี้ไม่รองรับการระบุตำแหน่ง': 'This browser cannot determine your location',
  'ไม่ได้รับอนุญาตให้เข้าถึงตำแหน่ง — เลือกเมืองหรือพิมพ์ค้นหาสถานที่แทนได้': 'Location permission denied — choose a city or search for a place instead',
  'หาตำแหน่งไม่พบ ลองใหม่อีกครั้ง': 'Could not find your location — try again',
  'ขอตำแหน่งนานเกินไป ลองใหม่อีกครั้ง': 'Locating took too long — try again',
  'ค้นสถานที่ไม่สำเร็จ': 'Place search failed',

  /* ---------------- ผู้ช่วย AI ---------------- */
  'สรุปการชาร์จช่วงที่เลือกให้หน่อย': 'Summarise the selected period',
  'ค่าใช้จ่ายเฉลี่ยต่อกิโลเมตรเท่าไหร่': 'What is my average cost per km?',
  'ชาร์จที่ไหนคุ้มที่สุด': 'Which station is the best value?',
  'Efficiency ช่วงนี้ดีขึ้นหรือแย่ลง': 'Is my efficiency improving or getting worse?',
  'ผู้ช่วยไม่ได้ตอบอะไรกลับมา ลองถามใหม่อีกครั้ง': 'The assistant returned nothing — try asking again',
  'ตรวจการตั้งค่า AI': 'Check AI settings',
  'กำลังตรวจ…': 'Checking…',
  'คัดลอกผลตรวจแล้ว': 'Diagnostics copied',
  'คัดลอกไม่ได้ — ลากคลุมข้อความแล้วคัดลอกเองได้': 'Could not copy — select the text and copy it manually',

  /* ---------------- ข้อมูลและการตั้งค่า ---------------- */
  'บันทึกการตั้งค่าเรียบร้อย': 'Settings saved',
  'บันทึกค่าเริ่มต้นเรียบร้อย': 'Defaults saved',
  'บันทึกข้อมูลไม่สำเร็จ': 'Could not save',
  'นำเข้าข้อมูล': 'Import data',
  'นำเข้าข้อมูลเรียบร้อย': 'Data imported',
  'ส่งออกข้อมูลเรียบร้อย': 'Data exported',
  'ส่งออกรายงานเป็น CSV แล้ว': 'Report exported as CSV',
  'ใส่ข้อมูลตัวอย่าง': 'Load sample data',
  'ใส่ข้อมูลตัวอย่างเรียบร้อย': 'Sample data loaded',
  'จะเพิ่มรถตัวอย่างพร้อมประวัติการชาร์จเข้าบัญชีนี้ โดยไม่ลบข้อมูลเดิม': 'Adds a sample car and history to this account without deleting anything',
  'ล้างข้อมูลทั้งหมด': 'Erase everything',
  'ล้างข้อมูลแล้ว': 'All data erased',
  'ลบรถ ประวัติการชาร์จ ต้นทุน และการเตือนทั้งหมดออกจากบัญชีนี้ถาวร': 'Permanently delete every car, session, cost and reminder in this account',
  'ย้ายข้อมูลขึ้น Supabase': 'Move data to Supabase',
  'ไม่พบข้อมูลเดิมให้ย้าย': 'No old data found to move',
  'ทิ้งข้อมูลเดิม': 'Discard old data',
  'ลบข้อมูลที่ค้างอยู่ในเบราว์เซอร์เครื่องนี้ทิ้งโดยไม่ย้ายขึ้น Supabase': 'Delete the leftover data in this browser without moving it to Supabase',
  'ลบข้อมูลเดิมในเครื่องแล้ว': 'Leftover local data deleted',
  'กำลังอัปโหลดข้อมูลขึ้น Supabase…': 'Uploading to Supabase…',
  'กำลังอ่านรูปแนบเดิม…': 'Reading existing attachments…',
  'กำลังเตรียมข้อมูล…': 'Preparing data…',
  'กำลังบันทึก…': 'Saving…',
  'ไฟล์นี้ไม่ใช่ไฟล์สำรองของ KiloEV': 'This is not a KiloEV backup file',
  'ไฟล์ไม่ถูกต้อง — อ่าน JSON ไม่ได้': 'Invalid file — could not read the JSON',
  'อ่านไฟล์ไม่สำเร็จ': 'Could not read the file',

  /* ---------------- รูปภาพ ---------------- */
  'ไฟล์รูปไม่ถูกต้อง': 'Invalid image file',
  'ไม่พบไฟล์รูปที่แนบได้': 'No usable image files',
  'ย่อรูปไม่สำเร็จ': 'Could not resize the image',
  'เตรียมรูปไม่สำเร็จ': 'Could not prepare the image',
  'อัปโหลดรูปไม่สำเร็จ': 'Upload failed',
  'แนบรูปไม่สำเร็จ': 'Could not attach the photo',
  'ลบรูปไม่สำเร็จ': 'Could not delete the photo',
  'สร้างลิงก์รูปไม่สำเร็จ': 'Could not create the image link',
  'อ่านรายการรูปไม่สำเร็จ': 'Could not list the images',
  'ย้ายรูปไม่สำเร็จ ข้ามใบนี้': 'Could not move this photo — skipped',

  /* ---------------- กราฟและสถานะว่าง ---------------- */
  'ยังไม่มีข้อมูลพอที่จะแสดงกราฟ': 'Not enough data to draw a chart',
  'ต้องมีข้อมูลอย่างน้อย 2 จุดจึงจะแสดงแนวโน้มได้': 'A trend needs at least two data points',

  /* ---------------- ข้อผิดพลาดของระบบ ---------------- */
  'เชื่อมต่อ Supabase ไม่ได้ — ตรวจอินเทอร์เน็ตและค่า Project URL': 'Cannot reach Supabase — check your connection and the Project URL',
  'เชื่อมต่อฐานข้อมูลไม่ได้ ตรวจอินเทอร์เน็ตอีกครั้ง': 'Cannot reach the database — check your connection',
  'ยังไม่มีตารางในฐานข้อมูล — เปิด Supabase SQL Editor แล้วรัน supabase/schema.sql': 'No tables yet — open the Supabase SQL Editor and run supabase/schema.sql',
  'ไม่มีสิทธิ์เขียนข้อมูลนี้ — ตรวจว่ารัน schema.sql ครบแล้วหรือยัง': 'Not allowed to write this — check that schema.sql ran completely',
  'เกิดข้อผิดพลาดที่ไม่รู้จัก': 'Something went wrong',
  'ติดตั้งแอปเรียบร้อย เปิดจากหน้าจอหลักได้เลย': 'Installed — open it from your home screen',

  /* ---------------- แดชบอร์ดและกราฟ ---------------- */
  'สถานะรถปัจจุบัน': 'Current vehicle status',
  'สถานีที่ใช้บ่อย': 'Most used stations',
  'สัดส่วนสถานีชาร์จ': 'Station share',
  'สัดส่วนต้นทุน': 'Cost breakdown',
  'สัดส่วนต้นทุนตามประเภท': 'Cost breakdown by category',
  'ค่าใช้จ่ายเฉลี่ย': 'Average cost',
  'การใช้พลังงานเฉลี่ย': 'Average consumption',
  'แบตเตอรี่': 'Battery',
  'หน่วย kWh': 'in kWh',
  'คำนวณจากระยะทาง ÷ พลังงานที่ชาร์จ': 'Distance ÷ energy charged',
  'ประวัติการชาร์จล่าสุด': 'Recent charges',
  'บันทึกการชาร์จล่าสุด': 'Latest charge',
  'จำนวนการชาร์จที่บันทึก': 'Charges recorded',
  'พลังงานที่ชาร์จในงวด': 'Energy charged this period',
  'ต้นทุนรวมในงวด': 'Total cost this period',
  'ต้นทุนอื่นในงวด': 'Other costs this period',
  'ต้นทุนรถทั้งหมด': 'All vehicle costs',
  'ค่าชาร์จ + ต้นทุนอื่น': 'Charging + other costs',
  'ค่าไฟ · บำรุงรักษา · ประกันภัย · ภาษี · อื่นๆ': 'Electricity · maintenance · insurance · tax · other',
  'บำรุงรักษา · ประกันภัย · ภาษี': 'Maintenance · insurance · tax',
  'ไม่มีการชาร์จในงวดนี้': 'No charges in this period',
  'ไม่มีต้นทุนอื่นในงวดนี้': 'No other costs in this period',
  'รายวัน': 'Daily',
  'รายเดือน': 'Monthly',
  'รายปี': 'Yearly',
  'เดือน': 'Month',
  'รวม': 'Total',
  'รวม (฿)': 'Total (฿)',
  'รวมทั้งปี': 'Year total',
  'ระยะทาง (km)': 'Distance (km)',
  'พลังงาน': 'Energy',
  'ค่าใช้จ่าย (฿)': 'Cost (฿)',
  '฿/kWh': '฿/kWh',
  '฿/km': '฿/km',
  'สรุปรายเดือน': 'Monthly summary',
  'สร้างรายงาน': 'Generate report',
  'ใช้ช่วงนี้': 'Use this range',
  'ล้างตัวกรอง': 'Clear filters',
  'ล้างฟอร์ม': 'Clear form',
  'วันที่ / เวลา': 'Date / time',
  'วันที่ ล่าสุด → เก่า': 'Date, newest first',
  'วันที่ เก่า → ล่าสุด': 'Date, oldest first',
  'ค่าใช้จ่าย มาก → น้อย': 'Cost, highest first',
  'พลังงาน มาก → น้อย': 'Energy, highest first',
  'Efficiency ดี → แย่': 'Efficiency, best first',
  'มีหัว AC': 'Has AC',
  'มีหัว DC': 'Has DC',

  /* ---------------- ฟอร์มและหัวข้อย่อย ---------------- */
  'ข้อมูลพื้นฐาน': 'Basics',
  'ข้อมูลพลังงานและค่าใช้จ่าย': 'Energy and cost',
  'ข้อมูลรถ · ระยะทางและแบตเตอรี่': 'Vehicle · range and battery',
  'รูปแนบและหมายเหตุ': 'Attachments and notes',
  'แนบสลิปธนาคาร หรือภาพหน้าจอจากแอปชาร์จได้หลายรูป': 'Attach bank slips or screenshots from your charging app',
  '% เริ่มต้น': 'Start %',
  '% สิ้นสุด': 'End %',
  'กำลังแก้ไขรายการเดิม': 'Editing an existing record',
  'เพิ่มรายการใหม่แทน': 'Add a new one instead',
  'กรอกแบบเต็ม →': 'Full form →',
  '— เลือกยี่ห้อ —': '— Choose a brand —',
  '— ยังไม่มีรถ —': '— No cars yet —',
  '— ไม่มีข้อมูล —': '— No data —',
  'ถ้าไม่ใส่ ระบบจะลองค้นรูปประกอบของรุ่นนี้จาก Wikipedia ให้เอง ไม่เจอจึงใช้ภาพวาดแทน': 'Leave empty and we will look for a stock photo of this model on Wikipedia, falling back to an illustration',
  'ใช้แสดงในแถบเมนูและการ์ดสถานะรถ · รูปที่อัปโหลดเองจะตรงกับรถคันจริงที่สุด': 'Shown in the sidebar and the status card — your own photo matches your actual car best',

  /* ---------------- สถานะว่างและปุ่มเริ่มต้น ---------------- */
  'เพิ่มรถคันแรก': 'Add your first car',
  'เพิ่มรายการแรก': 'Add the first record',
  'เพิ่มการเตือนแรก': 'Add the first reminder',
  'บันทึกการชาร์จครั้งแรก': 'Log your first charge',
  'ไปหน้าเพิ่มรถ': 'Go to add a car',
  'ยังไม่มีรายการที่ใกล้ครบกำหนด': 'Nothing due soon',
  'ยังไม่ได้ตั้งการเตือนและงบประมาณ': 'No reminders or budget set yet',
  'สถานะการแจ้งเตือน': 'Reminder status',
  'งบประมาณค่าใช้จ่ายต่อเดือน': 'Monthly budget',
  'ค่าใช้จ่ายอยู่ในงบประมาณ': 'Spending is within budget',
  'ค่าใช้จ่ายเฉลี่ยต่อเดือนเกินงบประมาณ': 'Average monthly spending is over budget',
  'ทุกปี': 'Yearly',

  /* ---------------- บัญชีและการตั้งค่า ---------------- */
  'สรุปข้อมูลในบัญชี': 'Account summary',
  'ข้อมูลของคุณถูกเก็บบน Supabase และเห็นได้เฉพาะบัญชีนี้': 'Your data lives on Supabase and is visible only to this account',
  'เข้าสู่ระบบด้วย': 'Signed in with',
  'Supabase Auth (อีเมล + รหัสผ่าน)': 'Supabase Auth (email + password)',
  'เปลี่ยนแล้วยังใช้งานต่อได้ทันทีในเครื่องนี้ · เครื่องอื่นที่ล็อกอินค้างไว้จะยังใช้ได้จนกว่าเซสชันจะหมดอายุ': 'You stay signed in on this device — other devices stay signed in until their session expires',
  'สว่าง': 'Light',
  'มืด': 'Dark',
  'ตามระบบ': 'System',
  'ใช้งานอยู่': 'In use',
  'พบข้อมูลเดิมที่เก็บไว้ในเบราว์เซอร์เครื่องนี้': 'Found older data stored in this browser',
  'ไม่ต้องย้าย ลบทิ้ง': 'Do not move it — delete',
  'ไว้ก่อน': 'Later',
  'ไม่เอา': 'No thanks',
  'รับทราบ': 'Got it',
  '← กลับไปหน้าเข้าสู่ระบบ': '← Back to sign in',

  /* ---------------- ผู้ช่วย AI และ PWA ---------------- */
  'ผู้ช่วย AI': 'AI assistant',
  'รู้จักเว็ปนี้และข้อมูลการชาร์จของคุณ': 'Knows this app and your charging data',
  'ถามอะไรก็ได้เกี่ยวกับการชาร์จรถของคุณ หรือวิธีใช้เว็ปนี้': 'Ask anything about your charging or how to use the app',
  'คำถามและข้อมูลสรุปจะถูกส่งไปประมวลผลที่ Google (Gemini) ปิดการส่งข้อมูลได้ที่ด้านล่าง': 'Your question and a summary are sent to Google (Gemini) for processing — you can turn data sharing off below',
  'ส่งข้อมูลการชาร์จของฉันให้ AI (ปิดแล้วจะตอบได้แค่วิธีใช้เว็ป)': 'Share my charging data with the AI (off = it can only explain how to use the app)',
  'มีเวอร์ชันใหม่พร้อมใช้งาน': 'A new version is available',
  'โหลดเลย': 'Reload now',
  'ติดตั้ง': 'Install',
  'ติดตั้งเป็นแอปบนเครื่อง เปิดเร็วขึ้นและใช้เต็มจอ': 'Install as an app — faster to open and full screen',
  'เพิ่มไปยังหน้าจอโฮม': 'Add to home screen',

  /* ---------------- สถานะระบบ ---------------- */
  'กำลังโหลดข้อมูลจาก Supabase…': 'Loading data from Supabase…',
  'โหลดข้อมูลไม่สำเร็จ': 'Could not load your data',
  'ยังไม่ได้เชื่อมต่อ Supabase': 'Supabase is not connected',
  'แอปต้องใช้ค่าสองตัวนี้จึงจะทำงานได้': 'The app needs these two values to run',
  'รันในเครื่อง:': 'Running locally:',
  'บน Vercel:': 'On Vercel:',
  'หาค่าได้ที่ Supabase Dashboard → Project Settings → Data API': 'Find them in Supabase Dashboard → Project Settings → Data API',
  'วิธีตั้งค่า': 'How to set it up',
  '2. Vercel → Project Settings → Environment Variables เพิ่มตัวแปร': '2. Vercel → Project Settings → Environment Variables, add',
  'OPENCHARGEMAP_API_KEY = คีย์ที่ได้มา': 'OPENCHARGEMAP_API_KEY = your key',
  'ปิดหน้าต่าง': 'Close dialog',
  'ปิดรูป': 'Close photo',
  'เทียบ{label}ไม่ได้': 'no {label} comparison',

  /* ---------------- ป้ายกำกับช่องกรอก ---------------- */
  'ประเภทการชาร์จ': 'Charge type',
  'สถานี / สถานที่': 'Station / place',
  'พลังงานที่ชาร์จ (kWh)': 'Energy charged (kWh)',
  'ราคา / kWh (บาท)': 'Price per kWh (THB)',
  'ราคา / kWh (฿)': 'Price per kWh (฿)',
  'ค่าปรับ (บาท)': 'Penalty (THB)',
  'ส่วนลด (บาท)': 'Discount (THB)',
  'ค่าปรับ': 'Penalty',
  'ส่วนลด': 'Discount',
  'เช่น ค่าจอดเกินเวลาหลังชาร์จเต็ม': 'e.g. idle fee after the battery is full',
  'เช่น โค้ดโปรโมชั่น หรือแต้มที่ใช้แลก': 'e.g. promo code or points redeemed',
  'ใช้ยอดที่คำนวณ': 'Use calculated total',
  'แก้ยอดเองเป็น {v}': 'overridden to {v}',
  'หุบแถบเมนู': 'Collapse menu',
  'ขยายแถบเมนู': 'Expand menu',
  'ค่าใช้จ่ายรวม (บาท)': 'Total cost (THB)',
  'จำนวนเงิน (บาท)': 'Amount (THB)',
  'เวลาที่ใช้ในการชาร์จ': 'Charging time',
  'SOC ก่อนชาร์จ (%)': 'SOC before (%)',
  'SOC หลังชาร์จ (%)': 'SOC after (%)',
  'SOC ที่เพิ่มขึ้น (%)': 'SOC gained (%)',
  'อัตราสิ้นเปลืองจากหน้าปัด': 'Dash efficiency reading',
  'หน่วยของค่าที่อ่านจากหน้าปัด': 'Unit shown on your dashboard',
  'หัวข้อ': 'Title',
  'ครบกำหนดวันที่': 'Due date',
  'เตือนล่วงหน้า (วัน)': 'Remind this many days ahead',
  'ตั้งแต่วันที่': 'From',
  'ถึงวันที่': 'To',
  'เลือกช่วงเวลา': 'Choose a period',
  'เรียงตาม': 'Sort by',
  'กรองรายการ': 'Filter list',
  'ค้นหาสถานที่': 'Search for a place',
  'หรือเลือกเมือง': 'Or pick a city',
  'รัศมี': 'Radius',
  'กำลังไฟขั้นต่ำ (kW)': 'Minimum power (kW)',
  'ไม่จำกัด': 'No limit',
  'ไม่บังคับ': 'Optional',
  '฿': '฿',

  /* ---------------- รถ ---------------- */
  'รถของฉัน': 'My cars',
  'ชื่อรถ (ตั้งเอง)': 'Car name (your own)',
  'ยี่ห้อ': 'Brand',
  'รุ่น': 'Model',
  'ระบุยี่ห้อเอง': 'Enter a brand',
  'ระบุรุ่นเอง': 'Enter a model',
  'ทะเบียน': 'Plate',
  'ความจุแบตเตอรี่ (kWh)': 'Battery capacity (kWh)',
  'เลขไมล์ปัจจุบัน (km)': 'Current odometer (km)',
  'เลือกรูปรถของคุณ': 'Choose your car photo',
  'รูปรถจากอินเทอร์เน็ต': 'Car photo from the web',
  'ลบรถ': 'Delete car',
  'ลบรูป': 'Remove photo',
  'เพิ่มได้หลายคัน · สลับคันที่ดูข้อมูลได้จากแถบด้านบน': 'Add as many as you like — switch between them from the top bar',
  'เลือกรถที่ต้องการดูข้อมูล': 'Choose which car to view',
  'ยังไม่ได้เลือกรถ': 'No car selected',

  /* ---------------- สรุปและตัวเลข ---------------- */
  'การชาร์จทั้งหมด': 'Total charges',
  'จำนวนครั้ง': 'Sessions',
  'พลังงานรวม': 'Total energy',
  'ระยะทางรวม': 'Total distance',
  'ค่าชาร์จรวม': 'Total charging cost',
  'ต้นทุนอื่นรวม': 'Other costs total',
  'ต้นทุนรวมทั้งหมด': 'Grand total',
  'เวลาชาร์จรวม': 'Total charging time',
  'ค่าใช้จ่ายสูงสุด': 'Highest cost',
  'ค่าใช้จ่ายต่ำสุด': 'Lowest cost',
  'กำลังไฟสูงสุด': 'Peak power',
  'สถานีที่พบ': 'Stations found',
  'ใกล้ที่สุด': 'Nearest',
  'แห่ง': 'places',
  'บาทรวม': 'THB total',
  'มีรูปแนบ': 'Has photos',
  'ค่าไฟ / บำรุงรักษา': 'Electricity / maintenance',

  /* ---------------- ปุ่ม ---------------- */
  'บันทึกที่นี่': 'Log a charge here',
  'แผนที่': 'Map',
  'เพิ่มรายการ': 'Add record',
  'บันทึกการตั้งค่า': 'Save settings',
  'ส่งออกข้อมูล (JSON)': 'Export data (JSON)',
  'นำเข้าจากไฟล์': 'Import from file',
  'พิมพ์ / บันทึก PDF': 'Print / save as PDF',
  'คัดลอกผลตรวจ': 'Copy diagnostics',
  'ล้างบทสนทนา': 'Clear conversation',
  'ส่ง': 'Send',
  'หยุด': 'Stop',
  'สลับธีม': 'Switch theme',
  'กรอกแบบละเอียด': 'Full form',
  'Quick Add — บันทึกด่วน': 'Quick Add',
  'ยืนยันรหัสผ่านใหม่': 'Confirm new password',
  'รหัสผ่านใหม่': 'New password',

  /* ---------------- หัวข้อการ์ด ---------------- */
  'ข้อมูลของคุณ': 'Your data',
  'ค่าเริ่มต้นและธีม': 'Defaults and theme',
  'ธีม': 'Theme',
  'ราคาเริ่มต้น AC (฿/kWh)': 'Default AC price (฿/kWh)',
  'ราคาเริ่มต้น DC (฿/kWh)': 'Default DC price (฿/kWh)',
  'งบประมาณ (บาท / เดือน)': 'Budget (THB / month)',
  'เก็บบน Supabase · เข้าถึงได้จากทุกเครื่องที่ล็อกอินบัญชีนี้': 'Stored on Supabase — available on every device signed into this account',

  /* ---------------- คำอธิบายใต้ช่องกรอก ---------------- */
  'คำนวณอัตโนมัติ — แก้ทับได้ถ้ายอดจริงต่างจากนี้': 'Calculated for you — type over it if the real amount differs',
  'เว้นว่างไว้เพื่อใช้ค่าที่คำนวณให้': 'Leave empty to use the calculated value',
  'ต้องกรอกเลขไมล์ก่อน/หลังชาร์จจึงจะคำนวณได้': 'Needs the odometer before and after to calculate',
  'ชั่วโมง : นาที : วินาที · กรอกเกิน 59 ได้ ระบบจะรวมให้เอง เช่น 90 นาที = 1 ชม. 30 นาที': 'Hours : minutes : seconds — values over 59 roll over, so 90 minutes becomes 1 h 30 min',
  'ค่าที่รถแสดงบนหน้าปัด · ทศนิยมได้ไม่เกิน 2 ตำแหน่ง · หน่วยที่เลือกจะถูกจำไว้ใช้ครั้งถัดไป': 'What your car shows on the dash — up to 2 decimals, and the unit you pick is remembered',
  'ใช้เติมให้อัตโนมัติตอนบันทึกการชาร์จ': 'Used to prefill new charging records',
  'ใช้เป็นค่าตั้งต้นของการชาร์จครั้งแรก': 'Used as the starting point for your first charge',
  'ใช้กับรายการที่ไม่ได้ระบุจำนวนวันเอง': 'Applies to reminders without their own lead time',
  'เตือนเมื่อค่าใช้จ่ายเฉลี่ยต่อเดือนเกินงบนี้ · 0 = ไม่ตั้งงบ': 'Warn when the monthly average goes over this — 0 means no budget',
  'พิมพ์ชื่อสถานที่ ห้าง อำเภอ หรือจังหวัด แล้วเลือกจากรายการ': 'Type a place, mall, district or province, then pick from the list',

  /* ---------------- ตัวอย่างข้อความในช่องกรอก ---------------- */
  'เช่น บ้าน, PTT Station': 'e.g. Home, PTT Station',
  'เช่น รถบ้าน, คันสีขาว': 'e.g. Daily driver, the white one',
  'เช่น ชาร์จค้างคืน, ได้ส่วนลดโปรโมชั่น': 'e.g. Charged overnight, promo discount',
  'เช่น เช็คระยะ 20,000 km': 'e.g. 20,000 km service',
  'เช่น เช็คระยะ 40,000 km': 'e.g. 40,000 km service',
  'เช่น เซ็นทรัลลาดพร้าว, อำเภอเมืองขอนแก่น': 'e.g. CentralPlaza Ladprao, Mueang Khon Kaen',
  'สถานี, หมายเหตุ, วันที่…': 'Station, notes, date…',
  'ชื่อสถานี ผู้ให้บริการ หรือชนิดหัวชาร์จ': 'Station name, operator or connector type',
  'พิมพ์คำถาม… (Enter ส่ง · Shift+Enter ขึ้นบรรทัดใหม่)': 'Ask a question… (Enter to send · Shift+Enter for a new line)',

  /* ---------------- สถานะว่าง ---------------- */
  'ยังไม่มีข้อมูล — เริ่มจากเพิ่มรถของคุณ แล้วบันทึกการชาร์จครั้งแรก': 'Nothing here yet — add your car, then log your first charge',
  'ยังไม่มีรถ — เพิ่มรถคันแรกเพื่อเริ่มบันทึกการชาร์จ': 'No cars yet — add your first one to start logging',
  'ยังไม่มีรถในระบบ — เพิ่มรถก่อนเริ่มบันทึกการชาร์จ': 'No cars yet — add one before logging a charge',
  'ยังไม่มีรายการต้นทุน': 'No costs recorded',
  'ยังไม่มีรายการต้นทุน — บันทึกค่าไฟ ค่าบำรุงรักษา ประกันภัย หรือภาษีได้ที่นี่': 'No costs yet — record electricity, maintenance, insurance or tax here',
  'ยังไม่มีการเตือน — เพิ่มกำหนดบำรุงรักษา ต่อประกัน หรือต่อภาษี': 'No reminders yet — add maintenance, insurance or tax dates',
  'ยังไม่มีการชาร์จในช่วงเวลานี้': 'No charges in this period',
  'ไม่มีการชาร์จในช่วงเวลาที่เลือก': 'No charges in the selected period',
  'ไม่มีค่าใช้จ่ายในงวดนี้': 'No costs in this period',
  'ยังไม่มีข้อมูลสถานี': 'No station data',
  'ยังไม่มีข้อมูลสถานีในช่วงเวลานี้': 'No station data for this period',
  'ยังไม่มีข้อมูลรายเดือน': 'No monthly data yet',
  'ยังไม่มีข้อมูลสำหรับสร้างรายงาน': 'Not enough data to build a report',
};

const DICT = { en: EN };

export default translate;
