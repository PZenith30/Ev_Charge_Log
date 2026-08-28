'use client';
/**
 * ภาพรถมองจากด้านบน วาดเป็น SVG เอง
 * ใช้แทนรูปถ่ายจริงเพราะไม่มีสิทธิ์ใช้ภาพรถของผู้ผลิต และไฟล์ SVG คมทุกความละเอียด
 * แถบกลางตัวรถทำหน้าที่เป็นเกจแบตเตอรี่ — เขียวเมื่อไฟเยอะ ส้ม/แดงเมื่อไฟใกล้หมด
 */
export default function CarArt({ soc = null, bodyColor = 'var(--surface-3)' }) {
  const pct = Number.isFinite(soc) ? Math.max(0, Math.min(100, soc)) : null;
  const level = pct === null ? 'var(--border-strong)' : pct <= 15 ? 'var(--danger)' : pct <= 35 ? 'var(--warn)' : 'var(--accent)';
  // แถบแบตเตอรี่สูง 34 หน่วย เริ่มจากด้านล่าง (y=79) ขึ้นไปตามเปอร์เซ็นต์
  const barH = pct === null ? 0 : (34 * pct) / 100;

  return (
    <svg viewBox="0 0 120 190" role="img" aria-label={pct === null ? 'รถยนต์ไฟฟ้า' : `แบตเตอรี่ ${pct}%`}>
      {/* เงาใต้รถ */}
      <ellipse cx="60" cy="182" rx="41" ry="5" fill="var(--text)" opacity=".07" />

      {/* ตัวถัง */}
      <rect x="16" y="10" width="88" height="168" rx="30" style={{ fill: bodyColor, stroke: 'var(--border-strong)' }} strokeWidth="1.5" />

      {/* กระจกหน้า / หลัง */}
      <path d="M28 44 Q60 34 92 44 L86 62 Q60 55 34 62 Z" style={{ fill: 'var(--text)' }} opacity=".13" />
      <path d="M32 132 Q60 125 88 132 L92 150 Q60 141 28 150 Z" style={{ fill: 'var(--text)' }} opacity=".13" />

      {/* หลังคา */}
      <rect x="30" y="68" width="60" height="56" rx="12" style={{ fill: 'var(--text)' }} opacity=".05" />

      {/* กระจกมองข้าง */}
      <rect x="8" y="62" width="10" height="15" rx="4" style={{ fill: bodyColor, stroke: 'var(--border-strong)' }} strokeWidth="1.2" />
      <rect x="102" y="62" width="10" height="15" rx="4" style={{ fill: bodyColor, stroke: 'var(--border-strong)' }} strokeWidth="1.2" />

      {/* ไฟหน้า / ไฟท้าย */}
      <rect x="26" y="13" width="18" height="6" rx="3" style={{ fill: 'var(--warn)' }} opacity=".55" />
      <rect x="76" y="13" width="18" height="6" rx="3" style={{ fill: 'var(--warn)' }} opacity=".55" />
      <rect x="26" y="171" width="18" height="5" rx="2.5" style={{ fill: 'var(--danger)' }} opacity=".5" />
      <rect x="76" y="171" width="18" height="5" rx="2.5" style={{ fill: 'var(--danger)' }} opacity=".5" />

      {/* เกจแบตเตอรี่กลางตัวรถ */}
      <rect x="45" y="79" width="30" height="34" rx="7" style={{ fill: 'var(--text)' }} opacity=".08" />
      {pct !== null ? (
        <rect x="45" y={79 + (34 - barH)} width="30" height={barH} rx="7" style={{ fill: level }} />
      ) : null}
      {/* สัญลักษณ์สายฟ้า */}
      <path
        d="M62 84 L54 98 h6 l-1 10 8-14 h-6 z"
        style={{ fill: pct !== null && pct > 45 ? '#fff' : 'var(--muted)' }}
        opacity={pct === null ? 0.5 : 0.9}
      />
    </svg>
  );
}
