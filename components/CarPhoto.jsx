'use client';
/**
 * รูปรถ — ไล่ลำดับจนกว่าจะได้รูป ไม่ค้างเป็นกล่องเปล่า
 *   1. รูปที่ผู้ใช้อัปโหลดเอง (ตรงกับรถคันจริงที่สุด)
 *   2. รูปที่ปักหมุดไว้จากอินเทอร์เน็ต (เก็บเป็น URL เต็ม)
 *   3. ค้นจาก Wikipedia ตามยี่ห้อ/รุ่น (แคชผลไว้ 30 วัน)
 *   4. ภาพวาด SVG
 * ทุกขั้นถ้าล้มเหลวจะตกไปขั้นถัดไปเสมอ
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
  const [loading, setLoading] = useState(false);
  const [broken, setBroken] = useState(false); // <img> โหลดไม่ขึ้น

  useEffect(() => {
    let alive = true;
    setSrc(null);
    setCredit(null);
    setBroken(false);

    /** ขั้นสุดท้าย: ลองค้นจาก Wikipedia — คืน true ถ้าได้รูป */
    async function tryWikipedia() {
      if (!autoFetch || (!brand && !model)) return false;
      const hit = await findCarImage(brand, model).catch(() => null);
      if (!alive || !hit) return false;
      setSrc(hit.url);
      setCredit(hit);
      return true;
    }

    // 2) ปักหมุดเป็นลิงก์ภายนอกไว้แล้ว ใช้ได้เลย
    if (isRemoteImage(photo)) {
      setSrc(photo);
      return () => { alive = false; };
    }

    // 1) ไฟล์ในบัคเก็ตของเรา ต้องขอ signed URL ก่อน
    if (photo) {
      setLoading(true);
      imgMany([photo])
        .then((r) => {
          if (!alive) return;
          const url = r[0]?.dataUrl;
          if (url) setSrc(url);
          else return tryWikipedia(); // ไฟล์หายหรือขอลิงก์ไม่ได้ อย่าค้างเป็นกล่องเปล่า
          return undefined;
        })
        .catch(() => { if (alive) tryWikipedia(); })
        .finally(() => { if (alive) setLoading(false); });
      return () => { alive = false; };
    }

    // 3) ยังไม่เคยตั้งรูป
    tryWikipedia();
    return () => { alive = false; };
  }, [photo, brand, model, autoFetch]);

  // ระหว่างรอลิงก์ของรูปที่มีอยู่จริง แสดงกล่องจางกันเลย์เอาต์กระตุก
  if (!src && loading) {
    return <div style={{ width: '100%', aspectRatio: '16 / 10', borderRadius: rounded, background: 'var(--surface-3)' }} />;
  }
  if (!src || broken) return <CarArt soc={soc} />;

  return (
    <div style={{ width: '100%' }}>
      {/* signed URL หมดอายุได้ และรูปจาก Wikipedia เป็นโดเมนภายนอก จึงใช้ <img> ตรงๆ แทน next/image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={car?.name ? `รูปรถ ${car.name}` : 'รูปรถ'}
        onError={() => setBroken(true)}
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
