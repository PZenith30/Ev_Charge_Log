/**
 * ข้อมูลอ้างอิงของแอป — ยี่ห้อ/รุ่นรถไฟฟ้า ประเภทต้นทุน และประเภทการแจ้งเตือน
 *
 * EV_DATA: [ชื่อรุ่น, ความจุแบตเตอรี่ (kWh), ระยะทางโดยประมาณ (km)]
 * ตัวเลขเป็นค่าประมาณจากสเปกผู้ผลิต ใช้เป็นค่าตั้งต้นตอนเพิ่มรถ และแก้ไขเองได้ภายหลัง
 */
export const EV_DATA = {
  BYD: [
    ['Atto 3', 60.5, 480],
    ['Dolphin', 44.9, 410],
    ['Seal Dynamic', 61.4, 510],
    ['Seal Premium / AWD', 82.5, 580],
    ['Sealion 6 DM-i', 18.3, 1000],
    ['Sealion 7', 82.5, 567],
    ['M6', 71.8, 530],
    ['e6', 71.7, 522],
  ],
  MG: [
    ['MG4 Electric', 51, 425],
    ['MG4 Electric X', 64, 530],
    ['MG ES', 44.5, 350],
    ['MG EP', 50.3, 380],
    ['ZS EV', 51.1, 403],
    ['MG5 EV', 50.3, 400],
    ['MG Cyberster', 77, 443],
    ['Maxus 9', 90, 540],
  ],
  NETA: [
    ['NETA V', 38.5, 384],
    ['NETA V-II', 40.7, 401],
    ['NETA X', 50, 401],
    ['NETA S', 66, 715],
    ['NETA Aya', 40, 401],
  ],
  Tesla: [
    ['Model 3 RWD', 60, 513],
    ['Model 3 Long Range', 79, 629],
    ['Model Y RWD', 60, 455],
    ['Model Y Long Range', 79, 565],
    ['Model S', 100, 634],
    ['Model X', 100, 576],
  ],
  ORA: [
    ['Good Cat 400 Pro', 47.8, 400],
    ['Good Cat 500 Ultra', 63.1, 500],
    ['Good Cat GT', 63.1, 460],
    ['ORA 03', 63.1, 500],
  ],
  Deepal: [
    ['S07', 79.97, 620],
    ['L07', 79.97, 650],
    ['S05', 56, 510],
  ],
  AION: [
    ['AION Y Plus', 63.2, 490],
    ['AION ES', 55.4, 442],
    ['AION V', 75.3, 650],
    ['Hyptec HT', 80, 560],
  ],
  XPENG: [
    ['G6 Standard', 66, 580],
    ['G6 Long Range', 87.5, 755],
    ['X9', 84.5, 610],
  ],
  Zeekr: [
    ['Zeekr 001', 100, 741],
    ['Zeekr X', 66, 560],
    ['Zeekr 009', 116, 822],
  ],
  Denza: [
    ['D9', 103.4, 600],
    ['N7', 91.3, 702],
  ],
  Leapmotor: [
    ['C10', 69.9, 605],
    ['T03', 37.3, 403],
  ],
  Wuling: [
    ['Bingo', 37.9, 410],
    ['Air EV', 26.7, 300],
  ],
  BMW: [
    ['iX3', 80, 460],
    ['i4 eDrive40', 83.9, 590],
    ['iX1', 66.5, 440],
    ['i5', 81.2, 582],
    ['i7', 101.7, 625],
    ['iX', 111.5, 630],
  ],
  'Mercedes-Benz': [
    ['EQA', 66.5, 496],
    ['EQB', 66.5, 468],
    ['EQE', 90.6, 639],
    ['EQE SUV', 90.6, 590],
    ['EQS', 107.8, 782],
  ],
  Volvo: [
    ['EX30', 69, 480],
    ['XC40 Recharge', 78, 500],
    ['C40 Recharge', 78, 530],
    ['EX90', 111, 600],
  ],
  Hyundai: [
    ['IONIQ 5', 72.6, 481],
    ['IONIQ 6', 77.4, 614],
    ['Kona Electric', 65.4, 514],
  ],
  Kia: [
    ['EV6', 77.4, 528],
    ['EV9', 99.8, 541],
    ['Niro EV', 64.8, 460],
  ],
  Nissan: [
    ['Leaf', 40, 311],
    ['Ariya', 87, 533],
  ],
  Toyota: [
    ['bZ4X', 71.4, 411],
    ['Lexus RZ 450e', 71.4, 395],
  ],
  Honda: [['e:N1', 68.8, 510]],
  Volkswagen: [
    ['ID.4', 82, 520],
    ['ID.3', 58, 426],
  ],
  Audi: [
    ['Q4 e-tron', 82, 520],
    ['Q8 e-tron', 114, 582],
    ['e-tron GT', 93.4, 488],
  ],
  Porsche: [
    ['Taycan', 89, 504],
    ['Macan Electric', 100, 613],
  ],
  Omoda: [['C5 EV', 61, 430]],
  Jaguar: [['I-PACE', 90, 470]],
  Lotus: [['Eletre', 112, 600]],
  Mine: [['Mine SPA1', 30, 200]],
  'อื่นๆ': [],
};

export const OTHER = 'อื่นๆ';

export const COST_CATS = {
  electric: { label: 'ค่าไฟ', color: '#3b7ff5' },
  maintenance: { label: 'ค่าบำรุงรักษา', color: '#0f9f6e' },
  insurance: { label: 'ค่าประกันภัย', color: '#8b5cf6' },
  tax: { label: 'ค่าภาษี', color: '#e5811f' },
  other: { label: 'ค่าใช้จ่ายอื่นๆ', color: '#64748b' },
};

/**
 * หน่วยของอัตราสิ้นเปลืองที่อ่านจากหน้าปัดรถ — แต่ละรุ่นแสดงไม่เหมือนกัน
 * เก็บลงฐานข้อมูลเป็น km/kWh เสมอ (base) แล้วแปลงกลับตอนแสดงผลตามหน่วยที่ผู้ใช้กรอก
 */
export const DASH_UNITS = {
  'km/kWh': { label: 'km/kWh', toBase: (v) => v, fromBase: (v) => v, placeholder: '5.20' },
  'km/100kWh': { label: 'km/100kWh', toBase: (v) => v / 100, fromBase: (v) => v * 100, placeholder: '520.00' },
};
export const DEFAULT_DASH_UNIT = 'km/kWh';
/** จำนวนทศนิยมสูงสุดที่กรอกได้ในช่องอัตราสิ้นเปลืองหน้าปัด (ใช้ทั้งสองหน่วย) */
export const DASH_DECIMALS = 2;

export const ALERT_TYPES = {
  maintenance: { label: 'บำรุงรักษา', icon: 'car' },
  insurance: { label: 'ประกันภัย', icon: 'alert' },
  tax: { label: 'ภาษี', icon: 'coin' },
  other: { label: 'อื่นๆ', icon: 'bell' },
};

/** เมนูหลัก — ใช้ทั้งใน sidebar (desktop) และ tab bar (mobile) */
export const NAV = [
  { href: '/', label: 'แดชบอร์ด', short: 'หน้าหลัก', icon: 'grid', tab: true, sub: 'ภาพรวมการชาร์จและค่าใช้จ่ายทั้งหมด' },
  { href: '/add', label: 'บันทึกการชาร์จ', short: 'บันทึก', icon: 'plus', sub: 'กรอกข้อมูลการชาร์จแต่ละครั้ง ระบบคำนวณให้อัตโนมัติ' },
  { href: '/history', label: 'ประวัติการชาร์จ', short: 'ประวัติ', icon: 'list', tab: true, sub: 'ค้นหา กรอง และแก้ไขรายการย้อนหลัง' },
  { href: '/costs', label: 'ต้นทุนรถ', short: 'ต้นทุน', icon: 'wallet', tab: true, sub: 'ค่าไฟ ค่าบำรุงรักษา ประกันภัย ภาษี และอื่นๆ' },
  { href: '/report', label: 'รายงาน', short: 'รายงาน', icon: 'chart', tab: true, sub: 'สรุปรายเดือน / รายปี พร้อมพิมพ์เป็น PDF' },
  { href: '/alerts', label: 'แจ้งเตือน', short: 'เตือน', icon: 'bell', sub: 'กำหนดการบำรุงรักษา ต่อประกัน ต่อภาษี และงบประมาณ' },
  { href: '/account', label: 'บัญชี & รถของฉัน', short: 'บัญชี', icon: 'user', tab: true, sub: 'จัดการรถ ค่าเริ่มต้น และข้อมูลสำรอง' },
];
