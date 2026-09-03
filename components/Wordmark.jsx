/**
 * ชื่อแบรนด์ KiloEV แบบรูปภาพ
 *
 * มีสี่ไฟล์: มี/ไม่มีสโลแกน คูณ สำหรับพื้นสว่าง/พื้นเข้ม
 * ที่ต้องมีรุ่นพื้นเข้มเพราะคำว่า "Kilo" เป็นกรมท่าเข้ม วางบนพื้นเข้มจะจมหายไป
 *
 * การสลับตามธีมทำด้วย CSS ไม่ใช่ JavaScript — วาดทั้งสองรูปแล้วซ่อนตัวที่ไม่ใช้
 * เพราะธีมถูกตั้งที่ <html data-theme> ตั้งแต่ก่อนหน้าเว็ปวาด ถ้ามาเลือกใน React
 * จะเห็นรูปผิดสีวาบหนึ่งตอนโหลด (เหมือนปัญหาจอขาววาบที่แก้ไปแล้วในธีม)
 *
 * ส่วนที่อยู่บนพื้นเข้มเสมอ (แถบข้าง) ส่ง fixed="dark" มาได้ ไม่ต้องวาดสองรูป
 */
/* eslint-disable @next/next/no-img-element */
export default function Wordmark({ tagline = false, fixed = null, height = 34, className = '' }) {
  const base = tagline ? '/wordmark-tagline' : '/wordmark';
  const alt = 'KiloEV';
  const style = { height, width: 'auto' };

  if (fixed) {
    const src = fixed === 'dark' ? `${base}-on-dark.png` : `${base}.png`;
    return <img className={`wordmark ${className}`} src={src} alt={alt} style={style} />;
  }

  return (
    <span className={`wordmark-swap ${className}`}>
      <img className="on-light" src={`${base}.png`} alt={alt} style={style} />
      <img className="on-dark" src={`${base}-on-dark.png`} alt="" aria-hidden="true" style={style} />
    </span>
  );
}
