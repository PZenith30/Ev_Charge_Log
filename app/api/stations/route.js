/**
 * ค้นสถานีชาร์จใกล้พิกัดที่ระบุ ผ่าน Open Charge Map
 *
 * ทำเป็น Route Handler แทนที่จะยิงจากเบราว์เซอร์ตรงๆ เพราะ
 *  - คีย์อยู่ฝั่ง server ไม่หลุดไปกับโค้ดหน้าเว็ป (จึงไม่ใช้ NEXT_PUBLIC_)
 *  - ไม่ต้องพึ่งว่า OCM จะเปิด CORS ให้หรือไม่
 *  - ย่อข้อมูลก่อนส่งกลับ ทำให้ payload เล็กลงมาก
 *  - แคชที่ CDN ได้ ลดจำนวนครั้งที่ยิงไป OCM
 *
 * ข้อมูลจาก Open Charge Map ใช้สัญญาอนุญาต CC BY-SA — หน้าเว็ปต้องแสดงเครดิต
 */

const OCM_ENDPOINT = 'https://api.openchargemap.io/v3/poi';
const MAX_DISTANCE_KM = 100;
const MAX_RESULTS = 100;

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** ย่อข้อมูลดิบของ OCM ให้เหลือเฉพาะที่หน้าเว็ปใช้จริง */
function normalize(poi) {
  const addr = poi?.AddressInfo || {};
  const connections = (poi?.Connections || [])
    .map((c) => ({
      type: c?.ConnectionType?.Title || null,
      current: c?.CurrentType?.Title || null,     // AC (Single-Phase) / DC ฯลฯ
      powerKW: num(c?.PowerKW),
      quantity: num(c?.Quantity) || 1,
    }))
    .filter((c) => c.type || c.powerKW);

  const powers = connections.map((c) => c.powerKW).filter((p) => p !== null);
  const currents = connections.map((c) => (c.current || '').toUpperCase());

  return {
    id: poi?.ID ?? null,
    name: addr.Title || 'ไม่ทราบชื่อสถานี',
    operator: poi?.OperatorInfo?.Title || null,
    address: [addr.AddressLine1, addr.Town, addr.StateOrProvince].filter(Boolean).join(' '),
    town: addr.Town || null,
    lat: num(addr.Latitude),
    lng: num(addr.Longitude),
    distanceKm: num(addr.Distance),
    connections,
    maxPowerKW: powers.length ? Math.max(...powers) : null,
    pointCount: connections.reduce((a, c) => a + (c.quantity || 1), 0),
    hasDC: currents.some((c) => c.startsWith('DC')),
    hasAC: currents.some((c) => c.startsWith('AC')),
    usageCost: poi?.UsageCost || null,
    status: poi?.StatusType?.Title || null,
    ocmUrl: poi?.ID ? `https://openchargemap.org/site/poi/details/${poi.ID}` : null,
  };
}

export async function GET(request) {
  const sp = new URL(request.url).searchParams;
  const lat = num(sp.get('lat'));
  const lng = num(sp.get('lng'));

  if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return Response.json({ error: 'พิกัดไม่ถูกต้อง' }, { status: 400 });
  }

  const key = process.env.OPENCHARGEMAP_API_KEY;
  if (!key) {
    return Response.json(
      { error: 'ยังไม่ได้ตั้งค่า OPENCHARGEMAP_API_KEY — สมัครคีย์ฟรีที่ openchargemap.io แล้วใส่เป็น environment variable' },
      { status: 503 }
    );
  }

  const distance = Math.min(Math.max(num(sp.get('distance')) || 15, 1), MAX_DISTANCE_KM);
  const maxresults = Math.min(Math.max(num(sp.get('max')) || 60, 1), MAX_RESULTS);

  const url = new URL(OCM_ENDPOINT);
  url.searchParams.set('output', 'json');
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lng));
  url.searchParams.set('distance', String(distance));
  url.searchParams.set('distanceunit', 'KM');
  url.searchParams.set('maxresults', String(maxresults));
  url.searchParams.set('key', key);

  try {
    const res = await fetch(url, {
      headers: { 'X-API-Key': key, Accept: 'application/json' },
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      const detail = res.status === 401 || res.status === 403 ? 'คีย์ไม่ถูกต้องหรือหมดสิทธิ์' : `HTTP ${res.status}`;
      return Response.json({ error: `เรียก Open Charge Map ไม่สำเร็จ (${detail})` }, { status: 502 });
    }

    const raw = await res.json();
    const stations = (Array.isArray(raw) ? raw : [])
      .map(normalize)
      .filter((s) => s.lat !== null && s.lng !== null)
      .sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));

    return Response.json(
      { stations, attribution: 'ข้อมูลสถานีจาก Open Charge Map (CC BY-SA)' },
      {
        // พิกัดเดิมภายใน 10 นาทีให้ใช้ผลเดิมได้ ลดการยิงซ้ำ
        headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' },
      }
    );
  } catch (e) {
    const timedOut = e?.name === 'TimeoutError' || e?.name === 'AbortError';
    return Response.json(
      { error: timedOut ? 'Open Charge Map ตอบช้าเกินไป ลองใหม่อีกครั้ง' : 'เชื่อมต่อ Open Charge Map ไม่ได้' },
      { status: 504 }
    );
  }
}
