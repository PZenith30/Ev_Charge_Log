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
  if (n.includes('lite')) s -= 15;                // งานนี้ต้องอ่าน JSON แล้วเทียบตัวเลข ตัวเต็มแม่นกว่า
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

/** แปลข้อความ error ของ Google เป็นคำอธิบายที่บอกวิธีแก้ */
export function explainGoogleError(status, message) {
  const m = String(message || '');
  const low = m.toLowerCase();

  if (low.includes('api key not valid') || low.includes('api_key_invalid')) {
    return 'คีย์ไม่ถูกต้อง — คัดลอกคีย์ใหม่จาก aistudio.google.com/apikey แล้ววางให้ครบ ระวังช่องว่างหรือเครื่องหมายคำพูดติดมาด้วย';
  }
  if (low.includes('has not been used') || low.includes('is disabled') || low.includes('service_disabled')) {
    return 'โปรเจกต์ของคีย์นี้ยังไม่ได้เปิดใช้งาน Generative Language API — เปิดที่ Google Cloud Console แล้วรอสักครู่ให้มีผล';
  }
  if (low.includes('referer') || low.includes('referrer') || low.includes('ip address') || low.includes('api_key_http_referrer') || low.includes('blocked')) {
    return 'คีย์ถูกจำกัดการใช้งาน (HTTP referrer หรือ IP) — คีย์นี้ถูกเรียกจากเซิร์ฟเวอร์ ต้องตั้งเป็น None หรืออนุญาต IP ของเซิร์ฟเวอร์';
  }
  if (low.includes('permission') || status === 403) {
    return 'คีย์ไม่มีสิทธิ์เรียก Generative Language API — ตรวจ API restrictions ของคีย์ว่าอนุญาต Generative Language API แล้ว';
  }
  if (status === 429) return 'โควตาเต็มชั่วคราว รอสักครู่แล้วลองใหม่';
  return m || `เรียกไม่สำเร็จ (HTTP ${status})`;
}

/**
 * รายชื่อรุ่นที่บัญชีนี้เรียกแบบสตรีมได้จริง
 * คืน { models, error, status } — ตั้งใจไม่กลืน error เพราะข้อความจาก Google
 * คือสิ่งเดียวที่บอกได้ว่าคีย์ผิด API ไม่ได้เปิด หรือคีย์ถูกจำกัดการใช้งาน
 */
export async function listUsableModels(key) {
  try {
    const res = await fetch(`${GEMINI_BASE}/models?pageSize=200&key=${encodeURIComponent(key)}`, {
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      let raw = '';
      try {
        raw = (await res.json())?.error?.message || '';
      } catch { /* อ่าน body ไม่ได้ก็ไม่เป็นไร */ }
      return { models: [], streamable: [], all: [], status: res.status, error: explainGoogleError(res.status, raw), raw };
    }

    const data = await res.json();
    const raws = data?.models || [];
    const nameOf = (m) => String(m?.name || '').replace(/^models\//, '');
    const all = raws.map(nameOf).filter(Boolean);

    // กรองด้วย generateContent เป็นหลัก — บางบัญชีไม่ประกาศ streamGenerateContent
    // ไว้ใน metadata ทั้งที่โมเดลเดียวกันสตรีมได้ ถ้ากรองด้วยตัวนั้นจะได้ลิสต์ว่างทั้งที่ใช้ได้
    const supports = (m, method) => (m?.supportedGenerationMethods || []).includes(method);
    const models = raws.filter((m) => supports(m, 'generateContent') || supports(m, 'streamGenerateContent'))
      .map(nameOf).filter(Boolean);
    const streamable = raws.filter((m) => supports(m, 'streamGenerateContent')).map(nameOf).filter(Boolean);

    return { models, streamable, all, status: 200, error: null, raw: '' };
  } catch (e) {
    const timedOut = e?.name === 'TimeoutError' || e?.name === 'AbortError';
    return {
      models: [],
      streamable: [],
      all: [],
      status: 0,
      error: timedOut ? 'ขอรายชื่อโมเดลนานเกินไป (timeout)' : 'เชื่อมต่อ Google ไม่ได้',
      raw: String(e?.message || ''),
    };
  }
}

/** ตรวจรูปแบบคีย์เบื้องต้น คืนคำเตือนถ้าดูผิดปกติ */
export function keyFormatWarning(key) {
  const k = String(key || '');
  if (!k) return 'ยังไม่ได้ใส่คีย์';
  if (k !== k.trim()) return 'คีย์มีช่องว่างหรือขึ้นบรรทัดใหม่ติดมาด้วย';
  if (/^["']|["']$/.test(k)) return 'คีย์มีเครื่องหมายคำพูดติดมาด้วย ให้ใส่เฉพาะตัวคีย์';
  if (k.length < 30) return 'คีย์สั้นผิดปกติ อาจคัดลอกมาไม่ครบ';
  return null;
}

/** เรียงรุ่นจากเหมาะสุดไปน้อยสุด ใช้ไล่ลองทีละตัวเมื่อตัวแรกใช้ไม่ได้ */
export function rankModels(names = []) {
  return names.filter((n) => scoreModel(n) > -Infinity).sort((a, b) => scoreModel(b) - scoreModel(a));
}

/**
 * error นี้แปลว่า "รุ่นนี้ใช้ไม่ได้ ลองตัวถัดไป" หรือไม่
 * บางรุ่นรองรับเฉพาะ Interactions API หรือ endpoint อื่น จึงตอบ 400 ทั้งที่คีย์ถูกต้อง
 */
export function isModelUnusable(status, message) {
  const m = String(message || '').toLowerCase();
  if (status === 404) return true;
  if (status !== 400) return false;
  return /only supports|not supported|unsupported|does not support|is not found|invalid model|cannot be used/.test(m);
}

/** error นี้ลองรุ่นอื่นไปก็ไม่ช่วย ต้องหยุดแล้วบอกผู้ใช้เลย */
export function isFatalError(status, message) {
  const m = String(message || '').toLowerCase();
  if (status === 401 || status === 403 || status === 429) return true;
  return /api key not valid|api_key_invalid|permission|has not been used|is disabled|billing/.test(m);
}

/**
 * จัดลำดับผู้สมัครให้กระจายข้ามรุ่น แทนที่จะเอาแต่ตัวคะแนนสูงสุดซึ่งมักมาจากตระกูลเดียวกัน
 *
 * เหตุผล: ถ้ารุ่นใหม่ทั้งตระกูลรองรับเฉพาะ Interactions API การไล่ลอง 4 ตัวแรก
 * ตามคะแนนล้วนๆ จะเจอปัญหาเดิมซ้ำทั้ง 4 ครั้ง ไม่มีโอกาสได้แตะรุ่นเก่าที่ใช้ generateContent ได้
 * จึงหยิบตัวแทนของแต่ละเวอร์ชันมาก่อน (2.5 -> 2.0 -> 1.5) แล้วค่อยตามด้วยที่เหลือ
 */
export function diversifyModels(names = []) {
  const ranked = rankModels(names);
  const seenFamily = new Set();
  const leaders = [];
  const rest = [];
  for (const n of ranked) {
    const family = (/(\d+)[.-](\d+)/.exec(n) || [])[0] || 'other';
    if (seenFamily.has(family)) rest.push(n);
    else {
      seenFamily.add(family);
      leaders.push(n);
    }
  }
  return [...leaders, ...rest];
}
