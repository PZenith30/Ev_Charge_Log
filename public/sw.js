/**
 * Service Worker ของ KiloEV
 *
 * เป้าหมายคือ "เปิดแอปได้เร็วและไม่ตายเมื่อเน็ตหลุด" ไม่ใช่ใช้งานเต็มรูปแบบออฟไลน์
 * เพราะข้อมูลทั้งหมดอยู่บน Supabase ซึ่งต้องต่อเน็ตอยู่ดี
 *
 * กติกาสำคัญที่ยึดไว้
 *  - ไม่แตะคำขอที่ไม่ใช่ GET เด็ดขาด (การบันทึกข้อมูล การล็อกอิน การคุยกับ AI เป็น POST ทั้งหมด)
 *  - ไม่แตะ /api/* และโดเมนภายนอก (Supabase, Google, Wikipedia, Open Charge Map)
 *    เพราะแคชคำตอบพวกนี้ไว้จะทำให้เห็นข้อมูลเก่าหรือรูปที่ลิงก์หมดอายุ
 *  - หน้าเว็ปใช้ network-first เสมอ deploy ใหม่แล้วจะเห็นของใหม่ทันที ไม่ค้างรุ่นเก่า
 *  - ไฟล์ static ของ Next (/_next/static/*) ใช้ cache-first ได้ เพราะชื่อไฟล์มี hash อยู่แล้ว
 */

// ต้องเลื่อนเวอร์ชันนี้ทุกครั้งที่ไฟล์ใน PRECACHE หรือไอคอนเปลี่ยน
// เพราะ activate ลบเฉพาะแคชที่ชื่อไม่ตรงกับเวอร์ชันปัจจุบัน ชื่อเดิม = แคชเก่ารอด
const VERSION = 'v9';
// ชื่อแคชยังขึ้นต้นด้วย evlog- ตามเดิม แม้แอปจะเปลี่ยนชื่อแล้ว
// ถ้าเปลี่ยน ตัว activate จะลบแคชเก่าไม่เจอ เพราะมันกรองจาก prefix นี้
const STATIC_CACHE = `evlog-static-${VERSION}`;
const PAGE_CACHE = `evlog-pages-${VERSION}`;
const OFFLINE_URL = '/offline.html';

const PRECACHE = [OFFLINE_URL, '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      // ถ้าไฟล์ใดโหลดไม่ได้ก็ไม่ควรทำให้ติดตั้ง SW ล้มทั้งหมด
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('evlog-') && k !== STATIC_CACHE && k !== PAGE_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

/** คำขอที่ service worker ต้องปล่อยผ่าน ไม่ยุ่งด้วย */
function shouldBypass(request, url) {
  if (request.method !== 'GET') return true;
  if (url.origin !== self.location.origin) return true;   // Supabase / Google / OCM / Wikipedia
  if (url.pathname.startsWith('/api/')) return true;      // ข้อมูลสด ห้ามแคช
  if (request.headers.get('range')) return true;          // คำขอบางส่วนของไฟล์
  return false;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (shouldBypass(request, url)) return;

  // ไฟล์ที่ชื่อมี hash อยู่แล้ว เปลี่ยนเนื้อหาเมื่อไหร่ชื่อก็เปลี่ยน แคชยาวได้ปลอดภัย
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(request, copy));
            }
            return res;
          })
      )
    );
    return;
  }

  // หน้าเว็ป — เอาของใหม่ก่อนเสมอ ต่อเน็ตไม่ได้ค่อยใช้ของที่เก็บไว้
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(PAGE_CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match(OFFLINE_URL)))
    );
    return;
  }

  // ไฟล์อื่นในโดเมนเรา (ไอคอน รูปประกอบ) — ใช้ของที่เก็บไว้ก่อน แล้วอัปเดตเงียบๆ
  event.respondWith(
    caches.match(request).then((hit) => {
      const network = fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || network;
    })
  );
});

/** ให้หน้าเว็ปสั่งข้ามการรอคิวได้ ตอนกดปุ่ม "อัปเดตเดี๋ยวนี้" */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
