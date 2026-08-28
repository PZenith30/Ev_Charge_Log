'use client';
/**
 * รูปแนบ (สลิปธนาคาร / สกรีนช็อตจากแอปชาร์จ) — เก็บใน Supabase Storage
 *
 * บัคเก็ต `charge-images` เป็นแบบส่วนตัว โครงสร้าง path คือ `<user_id>/<uuid>.jpg`
 * policy ตรวจโฟลเดอร์แรกของ path เทียบกับ auth.uid() จึงกันข้ามผู้ใช้ได้
 * การแสดงผลใช้ signed URL อายุจำกัด ไม่เปิดสาธารณะ
 *
 * ชื่อฟังก์ชันคงเดิมจากตอนที่ใช้ IndexedDB เพื่อให้ ImageUploader และหน้ารายละเอียดไม่ต้องแก้
 * — สิ่งที่เคยเป็น "id ของรูป" ตอนนี้คือ "path ในบัคเก็ต"
 */
import { supabase, IMAGE_BUCKET } from './supabase';
import { uuid } from './format';

const SIGNED_URL_TTL = 60 * 60; // 1 ชั่วโมง
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;

let currentUserId = null;
/** store เรียกตอน login/logout เพื่อให้รู้ว่าจะอัปโหลดลงโฟลเดอร์ของใคร */
export function setStorageUser(id) {
  currentUserId = id;
}

/* ------------------------------ อ่านรูป ------------------------------ */

/** สร้าง signed URL ของหลาย path พร้อมกัน ข้ามใบที่หาไม่เจอ */
export async function imgMany(paths = []) {
  if (!supabase || !paths.length) return [];
  const { data, error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL);
  if (error) {
    console.warn('สร้างลิงก์รูปไม่สำเร็จ', error);
    return [];
  }
  return (data || [])
    .filter((d) => d.signedUrl && !d.error)
    .map((d) => ({ id: d.path, dataUrl: d.signedUrl, name: (d.path || '').split('/').pop() }));
}

/** ไฟล์ทั้งหมดของผู้ใช้ ใช้แสดงพื้นที่ที่ใช้ไปในหน้าบัญชี */
export async function imgAll() {
  if (!supabase || !currentUserId) return [];
  const { data, error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .list(currentUserId, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
  if (error) {
    console.warn('อ่านรายการรูปไม่สำเร็จ', error);
    return [];
  }
  return (data || []).map((f) => ({
    id: `${currentUserId}/${f.name}`,
    name: f.name,
    size: f.metadata?.size || 0,
  }));
}

/* ------------------------------ เขียน / ลบ ------------------------------ */

export async function imgDel(path) {
  if (!supabase || !path) return;
  const { error } = await supabase.storage.from(IMAGE_BUCKET).remove([path]);
  if (error) console.warn('ลบรูปไม่สำเร็จ', error);
}

/** ลบรูปที่ไม่มีรายการไหนอ้างถึงแล้ว (เกิดจากแนบรูปแล้วปิดฟอร์มโดยไม่บันทึก) */
export async function gcImages(state) {
  if (!supabase || !currentUserId) return;
  const used = new Set();
  for (const s of state.sessions || []) (s.images || []).forEach((p) => used.add(p));
  for (const c of state.costs || []) (c.images || []).forEach((p) => used.add(p));
  const all = await imgAll();
  const orphans = all.filter((f) => !used.has(f.id)).map((f) => f.id);
  if (orphans.length) await supabase.storage.from(IMAGE_BUCKET).remove(orphans);
}

/* --------------------------- ย่อรูปก่อนอัปโหลด --------------------------- */

/** ย่อด้านยาวสุดเหลือ 1600px แล้วบีบเป็น JPEG — คืน Blob */
function compress(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(fr.error);
    fr.onload = () => {
      const im = new Image();
      im.onerror = () => reject(new Error('ไฟล์รูปไม่ถูกต้อง'));
      im.onload = () => {
        let { width: w, height: h } = im;
        const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
        w = Math.round(w * scale);
        h = Math.round(h * scale);
        const cv = document.createElement('canvas');
        cv.width = w;
        cv.height = h;
        const cx = cv.getContext('2d');
        cx.fillStyle = '#ffffff';
        cx.fillRect(0, 0, w, h);
        cx.drawImage(im, 0, 0, w, h);
        cv.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('ย่อรูปไม่สำเร็จ'))),
          'image/jpeg',
          JPEG_QUALITY
        );
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

/** ย่อ + อัปโหลดหลายไฟล์ คืนรายการ {id: path, dataUrl: signedUrl} */
export async function addImageFiles(files) {
  if (!supabase || !currentUserId) throw new Error('ยังไม่ได้เข้าสู่ระบบ');
  const uploaded = [];
  for (const f of Array.from(files)) {
    if (!f.type || !f.type.startsWith('image/')) continue;
    try {
      const blob = await compress(f);
      const path = `${currentUserId}/${uuid()}.jpg`;
      const { error } = await supabase.storage
        .from(IMAGE_BUCKET)
        .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
      if (error) {
        console.warn('อัปโหลดรูปไม่สำเร็จ', error);
        continue;
      }
      uploaded.push(path);
    } catch (e) {
      console.warn('เตรียมรูปไม่สำเร็จ', e);
    }
  }
  return imgMany(uploaded);
}

/** อัปโหลด dataURL (ใช้ตอนย้ายรูปเดิมจาก IndexedDB ขึ้น Supabase) */
export async function uploadDataUrl(dataUrl) {
  if (!supabase || !currentUserId) throw new Error('ยังไม่ได้เข้าสู่ระบบ');
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const path = `${currentUserId}/${uuid()}.jpg`;
  const { error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: false });
  if (error) throw new Error(error.message);
  return path;
}
