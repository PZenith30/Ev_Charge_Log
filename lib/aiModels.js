/**
 * เลือกโมเดล Gemini ที่บัญชีนี้ใช้ได้จริง
 *
 * Google เปลี่ยนและปลดชื่อรุ่นอยู่เรื่อยๆ และแต่ละบัญชีเห็นรายชื่อไม่เหมือนกัน
 * การฝังชื่อรุ่นตายตัวไว้ในโค้ดจึงพังได้เองโดยที่เราไม่ได้แก้อะไร
 * ไฟล์นี้ถามรายชื่อจาก API แล้วให้คะแนนเลือกตัวที่เหมาะกับงานแชท
 *
 * ใช้ฝั่ง server เท่านั้น (app/api/chat/route.js)
 */

export const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

/** รุ่นที่ไม่ใช่งานแชทข้อความ — ตัดออกก่อนเสมอ */
const NOT_CHAT = /embedding|aqa|imagen|veo|tts|image-generation|vision/;

/** ให้คะแนนความเหมาะสม ยิ่งมากยิ่งดี */
export function scoreModel(name) {
  const n = String(name || '').toLowerCase();
  if (!n || NOT_CHAT.test(n)) return -Infinity;
  let s = 0;
  if (n.includes('flash')) s += 100;              // เร็วและอยู่ในโควตาฟรี
  if (n.includes('lite')) s -= 15;      // งานนี้ต้องอ่าน JSON แล้วเทียบตัวเลข ตัวเต็มแม่นกว่า
  if (/preview|exp|thinking/.test(n)) s -= 60;    // ตัวทดลอง ถูกปลดบ่อย
  if (/-\d{3,}$/.test(n)) s -= 10;                // รุ่นที่ปักวันที่ไว้ มักหมดอายุ
  const v = /(\d+)[.-](\d+)/.exec(n);
  if (v) s += Number(v[1]) * 10 + Number(v[2]);   // เวอร์ชันใหม่กว่าได้แต้มมากกว่า
  return s;
}

/** เลือกรุ่นที่ดีที่สุดจากรายชื่อ — คืน null ถ้าไม่มีตัวไหนใช้ได้ */
export function pickModel(names = []) {
  const usable = names.filter((n) => scoreModel(n) > -Infinity);
  if (!usable.length) return null;
  return usable.sort((a, b) => scoreModel(b) - scoreModel(a))[0];
}

/** รายชื่อรุ่นที่บัญชีนี้เรียกแบบสตรีมได้จริง — คืน [] เมื่อเรียกไม่สำเร็จ */
export async function listUsableModels(key) {
  try {
    const res = await fetch(`${GEMINI_BASE}/models?pageSize=200&key=${encodeURIComponent(key)}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.models || [])
      .filter((m) => (m?.supportedGenerationMethods || []).includes('streamGenerateContent'))
      .map((m) => String(m?.name || '').replace(/^models\//, ''))
      .filter(Boolean);
  } catch {
    return [];
  }
}
