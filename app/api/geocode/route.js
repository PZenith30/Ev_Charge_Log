/**
 * ค้นชื่อสถานที่ให้เป็นพิกัด — ใช้ Nominatim ของ OpenStreetMap
 *
 * ทำไมต้องผ่าน Route Handler แทนที่จะยิงจากเบราว์เซอร์
 *  - นโยบายของ Nominatim บังคับให้ระบุ User-Agent ที่บอกได้ว่าเป็นแอปอะไร
 *    ซึ่งเบราว์เซอร์ตั้ง header นี้เองไม่ได้
 *  - แคชที่ CDN ได้ ลดจำนวนครั้งที่ยิงไปหาเซิร์ฟเวอร์อาสาสมัครของ OSM
 *  - เลี่ยงปัญหา CORS
 *
 * บริการนี้ฟรีและไม่ต้องใช้คีย์ แต่ควรใช้อย่างประหยัด ฝั่งหน้าเว็ปจึงหน่วงก่อนยิง
 */

const ENDPOINT = 'https://nominatim.openstreetmap.org/search';
const UA = 'EV-Charge-Log/1.0 (personal EV charging tracker)';

export async function GET(request) {
  const q = (new URL(request.url).searchParams.get('q') || '').trim();
  if (q.length < 2) return Response.json({ places: [] });

  const url = new URL(ENDPOINT);
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '6');
  url.searchParams.set('countrycodes', 'th');   // เน้นในไทยก่อน ตรงกับผู้ใช้เป้าหมาย
  url.searchParams.set('accept-language', 'th');

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return Response.json({ places: [], error: `ค้นสถานที่ไม่สำเร็จ (HTTP ${res.status})` }, { status: 502 });
    }

    const raw = await res.json();
    const places = (Array.isArray(raw) ? raw : [])
      .map((p) => {
        const lat = Number(p?.lat);
        const lng = Number(p?.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        const full = String(p?.display_name || '');
        return {
          // ชื่อสั้นไว้แสดงเป็นหัวข้อ ส่วนที่อยู่เต็มไว้เป็นบรรทัดรอง
          name: p?.name || full.split(',')[0] || q,
          detail: full.split(',').slice(1, 4).join(',').trim(),
          lat,
          lng,
        };
      })
      .filter(Boolean);

    return Response.json(
      { places },
      { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } }
    );
  } catch (e) {
    const timedOut = e?.name === 'TimeoutError' || e?.name === 'AbortError';
    return Response.json(
      { places: [], error: timedOut ? 'ค้นสถานที่นานเกินไป ลองใหม่อีกครั้ง' : 'เชื่อมต่อบริการค้นสถานที่ไม่ได้' },
      { status: 504 }
    );
  }
}
