/** ค่าเริ่มต้นและรูปทรงของข้อมูล — แยกไว้ไฟล์เดียวเพื่อไม่ให้ import วนกัน */

export const DEFAULT_SETTINGS = {
  theme: 'auto',          // auto | light | dark
  priceAC: 4.5,
  priceDC: 7.5,
  budget: 0,              // งบต่อเดือน (0 = ไม่ตั้ง)
  advanceDays: 30,        // เตือนล่วงหน้ากี่วัน
  activeCar: null,        // id ของรถที่เลือกอยู่
  dashEffUnit: 'km/kWh',  // หน่วยอัตราสิ้นเปลืองหน้าปัดที่เลือกไว้ล่าสุด
};

export const emptyState = () => ({
  cars: [],
  sessions: [],
  costs: [],
  alerts: [],
  settings: { ...DEFAULT_SETTINGS },
});

/** คีย์ใน localStorage ที่ยังใช้อยู่ (ค่าที่ผูกกับเครื่อง ไม่ใช่ข้อมูลผู้ใช้) */
export const THEME_CACHE_KEY = 'evlog.theme';   // ให้สคริปต์ตั้งธีมอ่านได้ก่อนหน้าเว็ปวาด
export const VIEW_ALL_KEY = 'evlog.viewAllCars'; // เลือกดู "รถทุกคัน" อยู่หรือไม่
export const LEGACY_KEY = 'evlog.v1';            // ข้อมูลเดิมก่อนย้ายขึ้น Supabase
