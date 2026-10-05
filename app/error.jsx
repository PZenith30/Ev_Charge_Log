'use client';
/**
 * error boundary ของหน้าเว็ปทั้งหมดใต้ layout
 * จับ error ที่เกิดตอนเรนเดอร์หน้าใดหน้าหนึ่ง แล้วขึ้นข้อความแทนหน้าขาวล้วน
 */
import ErrorScreen from '@/components/ErrorScreen';

export default function Error({ error, reset }) {
  return <ErrorScreen error={error} reset={reset} />;
}
