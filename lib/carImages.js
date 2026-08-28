'use client';
/**
 * ค้นรูปรถจากอินเทอร์เน็ตตามยี่ห้อ/รุ่นที่บันทึกไว้
 *
 * ใช้ Wikipedia API เพราะเป็นแหล่งเดียวที่ใช้ได้จริงในเบราว์เซอร์:
 *  - รูปมีสัญญาอนุญาตเปิด (Creative Commons / สาธารณสมบัติ) ไม่ใช่รูปลิขสิทธิ์ของผู้ผลิต
 *  - รองรับ CORS (origin=*) จึงเรียกตรงจากหน้าเว็ปได้ ไม่ต้องมี server กลาง
 *  - ไม่ต้องใช้ API key และไม่จำกัดโควตาสำหรับการใช้งานเบาๆ แบบนี้
 *
 * ข้อจำกัดที่ต้องยอมรับ:
 *  - เป็นรูป "รุ่นรถ" ไม่ใช่รถคันจริงของผู้ใช้ สี/ทริมอาจไม่ตรง
 *  - บางรุ่นที่ขายเฉพาะในไทยอาจไม่มีบทความ จึงหาไม่เจอ
 *  - ผลลัพธ์มาจากการค้นหา จึงมีโอกาสได้รูปผิดรุ่นอยู่บ้าง
 * ด้วยเหตุนี้รูปที่ผู้ใช้อัปโหลดเองจึงมาก่อนเสมอ
 */

const CACHE_KEY = 'evlog.carimg';
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // เก็บผลไว้ 30 วัน กันยิงซ้ำทุกครั้งที่เปิดหน้า
const ENDPOINT = 'https://en.wikipedia.org/w/api.php';

const keyOf = (brand, model) => `${(brand || '').trim()}|${(model || '').trim()}`.toLowerCase();

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}
function writeCache(key, value) {
  try {
    const all = readCache();
    all[key] = { ...value, ts: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(all));
  } catch { /* โหมดส่วนตัวเขียนไม่ได้ ก็แค่ไม่ได้แคช */ }
}

/** true = ค่านี้ยังใช้ได้ ไม่หมดอายุ */
const fresh = (entry) => entry && Date.now() - (entry.ts || 0) < TTL_MS;

/**
 * ค้นรูปของรุ่นรถ
 * @returns {Promise<{url:string, page:string, title:string}|null>}
 */
export async function findCarImage(brand, model, { force = false } = {}) {
  const brandTxt = (brand || '').trim();
  const modelTxt = (model || '').trim();
  if (!brandTxt && !modelTxt) return null;

  const key = keyOf(brandTxt, modelTxt);
  if (!force) {
    const cached = readCache()[key];
    if (fresh(cached)) return cached.miss ? null : cached;
  }

  // ใส่คำว่า car ต่อท้ายเพื่อกันไปเจอบทความคนละเรื่องที่ชื่อพ้องกัน
  const query = `${brandTxt} ${modelTxt} car`.trim();
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: query,
    gsrlimit: '1',
    prop: 'pageimages|info',
    piprop: 'thumbnail',
    pithumbsize: '800',
    inprop: 'url',
    format: 'json',
    origin: '*',
  });

  try {
    const res = await fetch(`${ENDPOINT}?${params}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const pages = data?.query?.pages;
    const page = pages ? Object.values(pages)[0] : null;
    const url = page?.thumbnail?.source;

    if (!url) {
      writeCache(key, { miss: true });
      return null;
    }
    const hit = { url, page: page.fullurl || '', title: page.title || modelTxt };
    writeCache(key, hit);
    return hit;
  } catch (e) {
    console.warn('ค้นรูปรถไม่สำเร็จ', e);
    return null; // ไม่แคชกรณีเน็ตล่ม จะได้ลองใหม่รอบหน้า
  }
}

/** ล้างแคชรูปที่จำไว้ (ใช้ตอนอยากให้ค้นใหม่) */
export function clearCarImageCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch { /* ไม่เป็นไร */ }
}

/** รูปนี้เป็นลิงก์ภายนอกหรือไฟล์ในบัคเก็ตของเรา */
export const isRemoteImage = (photo) => typeof photo === 'string' && /^https?:\/\//i.test(photo);
