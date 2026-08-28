'use client';
/**
 * รูปรถ — ใช้รูปจริงที่ผู้ใช้อัปโหลดไว้ ถ้ายังไม่มีก็วาดภาพรถ SVG แทน
 * รูปเก็บใน Supabase Storage บัคเก็ตเดียวกับสลิป จึงต้องขอ signed URL ก่อนแสดง
 */
import { useEffect, useState } from 'react';
import { imgMany } from '@/lib/storage';
import CarArt from './CarArt';

export default function CarPhoto({ car, soc = null, rounded = 12 }) {
  const path = car?.photo || null;
  const [url, setUrl] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setUrl(null);
    setFailed(false);
    if (!path) return;
    let alive = true;
    imgMany([path])
      .then((r) => { if (alive) setUrl(r[0]?.dataUrl || null); })
      .catch(() => {});
    return () => { alive = false; };
  }, [path]);

  if (!path || failed) return <CarArt soc={soc} />;
  if (!url) {
    // ระหว่างรอลิงก์รูป กันไม่ให้เลย์เอาต์กระตุก
    return <div style={{ width: '100%', aspectRatio: '16 / 10', borderRadius: rounded, background: 'var(--surface-3)' }} />;
  }
  return (
    // รูปมาจาก signed URL ที่หมดอายุได้ จึงใช้ <img> ตรงๆ แทน next/image
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={car?.name ? `รูปรถ ${car.name}` : 'รูปรถ'}
      onError={() => setFailed(true)}
      style={{ width: '100%', borderRadius: rounded, display: 'block', objectFit: 'cover' }}
    />
  );
}
