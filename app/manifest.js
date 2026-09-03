/**
 * Web App Manifest — Next.js เสิร์ฟไฟล์นี้เป็น /manifest.webmanifest ให้เอง
 * และใส่ <link rel="manifest"> ใน <head> ให้อัตโนมัติ ไม่ต้องเพิ่มเอง
 */
export default function manifest() {
  return {
    name: 'KiloEV — บันทึกการชาร์จรถไฟฟ้า',
    short_name: 'KiloEV',  // Android ตัดชื่อที่ยาวเกิน 12 ตัวบนหน้าจอโฮม (KiloEV = 6 ตัว)
    description: 'บันทึกการชาร์จรถ EV คำนวณค่าใช้จ่ายและอัตราสิ้นเปลืองอัตโนมัติ พร้อมแดชบอร์ดและรายงาน',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#f7f9fc',
    theme_color: '#22c55e',
    lang: 'th',
    dir: 'ltr',
    categories: ['productivity', 'utilities'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // maskable ให้ Android ตัดเป็นทรงของเครื่องได้โดยสายฟ้าไม่โดนตัด
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'บันทึกการชาร์จ', short_name: 'บันทึก', url: '/add' },
      { name: 'ประวัติการชาร์จ', short_name: 'ประวัติ', url: '/history' },
      { name: 'สถานีชาร์จใกล้ฉัน', short_name: 'สถานี', url: '/stations' },
    ],
  };
}
