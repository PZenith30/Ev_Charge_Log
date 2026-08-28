'use client';
/**
 * รูปรถ — ลำดับความสำคัญ
 *   1. รูปที่ผู้ใช้อัปโหลดเอง (ตรงกับรถคันจริงที่สุด)
 *   2. รูปที่ปักหมุดไว้จากอินเทอร์เน็ต (เก็บเป็น URL เต็ม)
 *   3. ค้นจาก Wikipedia อัตโนมัติตามยี่ห้อ/รุ่น (แคชผลไว้ 30 วัน)
 *   4. ภาพวาด SVG
 */
import { useEffect, useState } from 'react';
import { imgMany } from '@/lib/storage';
import { findCarImage, isRemoteImage } from '@/lib/carImages';
import CarArt from './CarArt';

export default function CarPhoto({ car, soc = null, rounded = 12, showCredit = false, autoFetch = true }) {
  const photo = car?.photo || null;
  const brand = car?.brand || '';
  const model = car?.model || '';

  const [src, setSrc] = useState(null);
  const [credit, setCredit] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setSrc(null);
    setCredit(null);
    setFailed(false);

    // 2) ปักหมุดเป็นลิงก์ภายนอกไว้แล้ว
    if (isRemoteImage(photo)) {
      setSrc(photo);
      return undefined;
    }
    // 1) ไฟล์ในบัคเก็ตของเราเอง ต้องขอ signed URL ก่อน
    if (photo) {
      imgMany([photo])
        .then((r) => { if (alive) setSrc(r[0]?.dataUrl || null); })
        .catch(() => {});
      return () => { alive = false; };
    }
    // 3) ยังไม่มีรูป ลองค้นจากอินเทอร์เน็ตตามรุ่น
    if (autoFetch && (brand || model)) {
      findCarImage(brand, model)
        .then((hit) => {
          if (!alive || !hit) return;
          setSrc(hit.url);
          setCredit(hit);
        })
        .catch(() => {});
    }
    return () => { alive = false; };
  }, [photo, brand, model, autoFetch]);

  if (!src || failed) {
    // ระหว่างรอลิงก์ของรูปที่มีอยู่แล้ว กันเลย์เอาต์กระตุกด้วยกล่องเปล่า
    if (photo && !failed) {
      return <div style={{ width: '100%', aspectRatio: '16 / 10', borderRadius: rounded, background: 'var(--surface-3)' }} />;
    }
    return <CarArt soc={soc} />;
  }

  return (
    <div style={{ width: '100%' }}>
      {/* signed URL หมดอายุได้ และรูปจาก Wikipedia เป็นโดเมนภายนอก จึงใช้ <img> ตรงๆ แทน next/image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={car?.name ? `รูปรถ ${car.name}` : 'รูปรถ'}
        onError={() => setFailed(true)}
        style={{ width: '100%', borderRadius: rounded, display: 'block', objectFit: 'cover' }}
      />
      {showCredit && credit ? (
        <a
          href={credit.page}
          target="_blank"
          rel="noopener noreferrer"
          className="sm faint"
          style={{ display: 'block', marginTop: 6, fontSize: 11 }}
          title="รูปประกอบรุ่นรถ ไม่ใช่รถคันจริงของคุณ"
        >
          รูปประกอบจาก Wikipedia · {credit.title}
        </a>
      ) : null}
    </div>
  );
}
