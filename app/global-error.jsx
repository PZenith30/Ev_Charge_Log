'use client';
/**
 * error boundary ชั้นนอกสุด — จับ error ที่เกิดใน layout หรือใน StoreProvider เอง
 *
 * ชั้นนี้แทนที่ root layout ทั้งก้อน จึงต้องมี <html> กับ <body> ของตัวเอง
 * และไม่ import globals.css เพราะถ้าไฟล์ CSS คือต้นเหตุ หน้านี้ก็จะพังตามไปด้วย
 * (ErrorScreen ใช้ inline style ล้วนอยู่แล้ว)
 *
 * นี่คือชั้นที่ทำให้ "หน้าขาวล้วนไม่บอกอะไร" กลายเป็นข้อความที่อ่านได้
 * เพราะ error ใน StoreProvider จะทะลุ error.jsx ขึ้นมาถึงชั้นนี้
 */
import ErrorScreen from '@/components/ErrorScreen';

export default function GlobalError({ error, reset }) {
  return (
    <html lang="th">
      <body style={{ margin: 0 }}>
        <ErrorScreen error={error} reset={reset} />
      </body>
    </html>
  );
}
