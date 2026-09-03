'use client';
/**
 * สถานีชาร์จใกล้ฉัน — ดึงจาก Open Charge Map ผ่าน Route Handler ของเราเอง
 *
 * ลำดับการเลือกจุดค้นหา: ตำแหน่งที่เคยใช้ล่าสุด > ขอตำแหน่งจริงจากเบราว์เซอร์ > กรุงเทพฯ
 * ขอตำแหน่งตั้งแต่เปิดหน้า เพราะถ้าปล่อยให้เริ่มที่กรุงเทพฯ ผู้ใช้ต่างจังหวัดจะเห็นข้อมูลที่ไม่เกี่ยวเลย
 *
 * ไม่มีแผนที่ในตัว แต่ละสถานีเปิดต่อใน Google Maps ได้ เพื่อไม่ต้องเพิ่ม dependency
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/components/store';
import { EmptyState, Field, Stat, useDismiss } from '@/components/ui';
import Icon from '@/components/Icon';
import {
  CITY_PRESETS, RADIUS_OPTIONS, accuracyText, connectorSummary, fetchStations, geocode,
  isCoarse, locateBest, mapsLink, matchStation, movedFar, readLastLocation, saveLastLocation,
} from '@/lib/stations';
import { fmt, fmt0, fmt1 } from '@/lib/format';

const PIN_COLORS = ['var(--accent)', 'var(--dc)', 'var(--purple)', 'var(--warn)', 'var(--faint)'];

export default function StationsPage() {
  const { toast, setQuickDraft } = useStore();
  const router = useRouter();

  const [loc, setLoc] = useState(null);
  const [radius, setRadius] = useState(15);
  const [type, setType] = useState('');
  const [minPower, setMinPower] = useState('');
  const [filter, setFilter] = useState('');          // กรองรายการที่โหลดมาแล้ว
  const [stations, setStations] = useState([]);
  const [attribution, setAttribution] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState(null);
  const [locating, setLocating] = useState(false);

  // ค้นสถานที่
  const [place, setPlace] = useState('');
  const [places, setPlaces] = useState([]);
  const [placeOpen, setPlaceOpen] = useState(false);
  const [placeBusy, setPlaceBusy] = useState(false);
  const placeRef = useDismiss(placeOpen, useCallback(() => setPlaceOpen(false), []));

  const search = useCallback(async (target, dist) => {
    if (!target) return;
    setBusy(true);
    setError('');
    setErrorCode(null);
    try {
      const data = await fetchStations({ lat: target.lat, lng: target.lng, distance: dist });
      setStations(data.stations || []);
      setAttribution(data.attribution || '');
      if (!data.stations?.length) setError('ไม่พบสถานีในรัศมีนี้ — ลองขยายรัศมีดู');
    } catch (e) {
      setStations([]);
      setError(e.message);
      setErrorCode(e.code || null);
    } finally {
      setBusy(false);
    }
  }, []);

  /** ตั้งจุดค้นหาใหม่แล้วจำไว้ใช้ครั้งหน้า */
  const useLocation = useCallback((next) => {
    saveLastLocation(next);
    setLoc(next);
  }, []);

  // เปิดหน้าครั้งแรก — ใช้ตำแหน่งที่เคยใช้ ถ้าไม่มีค่อยขอตำแหน่งจริง
  const bootstrapped = useRef(false);
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    const saved = readLastLocation();

    // ผู้ใช้เลือกเมืองหรือค้นสถานที่ไว้เอง — เคารพตัวเลือกนั้น ไม่ไปขอ GPS ทับ
    if (saved?.source === 'user') {
      setLoc(saved);
      return;
    }

    // ตำแหน่ง GPS เก่าใช้วาดหน้าจอไปก่อนไม่ให้ว่างเปล่า แต่ต้องขอใหม่เสมอ
    // เพราะอาจเดินทางไปที่อื่นแล้ว หรือรอบก่อนได้ตำแหน่งหยาบมา
    if (saved) setLoc(saved);

    setLocating(true);
    locateBest()
      .then((here) => { if (!saved || movedFar(here, saved)) useLocation(here); })
      .catch((e) => {
        if (saved) return;   // ขอใหม่ไม่ได้ ก็ใช้ค่าเดิมที่วาดไว้แล้วต่อไป
        // ไม่อนุญาตหรือหาไม่เจอ — เริ่มที่กรุงเทพฯ ไปก่อน แล้วให้เลือกเมืองหรือค้นหาเอง
        setLoc(CITY_PRESETS[0]);
        toast(e.message, true);
      })
      .finally(() => setLocating(false));
  }, [useLocation, toast]);

  useEffect(() => {
    if (loc) search(loc, radius);
  }, [loc, radius, search]);

  async function useMyLocation() {
    setLocating(true);
    try {
      const here = await locateBest();
      useLocation(here);
      if (isCoarse(here.accuracyM)) {
        toast(`ตำแหน่งที่ได้คลาดเคลื่อน ${accuracyText(here.accuracyM)} — ถ้าไม่ตรงให้พิมพ์ค้นหาสถานที่`, true);
      }
    } catch (e) {
      toast(e.message, true);
    } finally {
      setLocating(false);
    }
  }

  // หน่วงก่อนยิงค้นสถานที่ เพื่อไม่ให้รบกวนเซิร์ฟเวอร์อาสาสมัครของ OSM ทุกตัวอักษร
  useEffect(() => {
    const q = place.trim();
    if (q.length < 2) {
      setPlaces([]);
      return undefined;
    }
    const id = setTimeout(() => {
      setPlaceBusy(true);
      geocode(q)
        .then((list) => {
          setPlaces(list);
          setPlaceOpen(list.length > 0);
        })
        .catch((e) => toast(e.message, true))
        .finally(() => setPlaceBusy(false));
    }, 500);
    return () => clearTimeout(id);
  }, [place, toast]);

  function pickPlace(p) {
    setPlaceOpen(false);
    setPlace('');
    setPlaces([]);
    useLocation({ name: p.name, lat: p.lat, lng: p.lng, source: 'user' });
  }

  function pickCity(name) {
    const city = CITY_PRESETS.find((c) => c.name === name);
    if (city) useLocation({ ...city, source: 'user' });
  }

  /** ไปหน้าบันทึกการชาร์จโดยเติมชื่อสถานีไว้ให้แล้ว */
  function logHere(s) {
    setQuickDraft({ station: s.name, type: s.hasDC ? 'DC' : 'AC' });
    router.push('/add');
  }

  const shown = stations.filter((s) => {
    if (type === 'DC' && !s.hasDC) return false;
    if (type === 'AC' && !s.hasAC) return false;
    if (minPower && (s.maxPowerKW ?? 0) < Number(minPower)) return false;
    return matchStation(s, filter);
  });

  const isPresetCity = CITY_PRESETS.some((c) => c.name === loc?.name);
  const dcCount = shown.filter((s) => s.hasDC).length;
  const fastest = shown.reduce((a, s) => Math.max(a, s.maxPowerKW || 0), 0);
  // หาค่าน้อยสุดเอง ไม่พึ่งว่า API จะเรียงตามระยะทางมาให้
  const dists = shown.map((s) => s.distanceKm).filter((d) => Number.isFinite(d));
  const nearest = dists.length ? Math.min(...dists) : null;

  // ยังไม่ได้ตั้งคีย์ — แสดงวิธีตั้งค่าให้ชัด แทนที่จะเป็นข้อความ error สั้นๆ
  if (errorCode === 'NO_KEY' || errorCode === 'BAD_KEY') {
    return (
      <div className="card">
        <div className="card-body">
          <div className="alert warn" style={{ marginBottom: 16 }}>
            <Icon name="alert" />
            <div>
              <div className="t1">หน้านี้ยังใช้ไม่ได้ — {errorCode === 'NO_KEY' ? 'ยังไม่ได้ตั้งคีย์' : 'คีย์ไม่ถูกต้อง'}</div>
              <div className="t2">{error}</div>
            </div>
          </div>

          <div className="sm" style={{ lineHeight: 1.9 }}>
            <b>วิธีตั้งค่า</b>
            <br />
            1. สมัครคีย์ฟรีที่{' '}
            <a href="https://openchargemap.org/site/develop/api" target="_blank" rel="noopener noreferrer">
              openchargemap.org/site/develop/api
            </a>{' '}
            (ไม่ต้องผูกบัตร)
            <br />
            2. Vercel → Project Settings → Environment Variables เพิ่มตัวแปร
            <pre
              style={{
                background: 'var(--surface-3)', padding: '10px 12px', borderRadius: 'var(--r-sm)',
                fontSize: 12.5, overflowX: 'auto', margin: '8px 0',
              }}
            >OPENCHARGEMAP_API_KEY = คีย์ที่ได้มา</pre>
            3. กด <b>Redeploy</b> (ตัวแปรใหม่จะมีผลต่อเมื่อ deploy รอบถัดไป)
          </div>

          <div className="mt">
            <button type="button" className="btn" onClick={() => search(loc, radius)} disabled={busy}>
              <Icon name="refresh" />ลองใหม่
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="card">
        {/* ---------- ค้นหาสถานที่ ---------- */}
        <div className="card-body" style={{ paddingBottom: 0 }}>
          <div ref={placeRef} style={{ position: 'relative' }}>
            <Field
              label="ค้นหาสถานที่"
              help="พิมพ์ชื่อสถานที่ ห้าง อำเภอ หรือจังหวัด แล้วเลือกจากรายการ"
            >
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                  <input
                    type="text"
                    value={place}
                    onChange={(e) => setPlace(e.target.value)}
                    onFocus={() => places.length && setPlaceOpen(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && places.length) {
                        e.preventDefault();
                        pickPlace(places[0]);
                      }
                    }}
                    placeholder="เช่น เซ็นทรัลลาดพร้าว, อำเภอเมืองขอนแก่น"
                    spellCheck={false}
                  />
                  {placeBusy ? (
                    <span
                      className="sm faint"
                      style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)' }}
                    >
                      กำลังค้น…
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="btn"
                  onClick={useMyLocation}
                  disabled={locating || busy}
                  style={{ flex: 'none' }}
                >
                  <Icon name={locating ? 'clock' : 'map-pin'} />
                  <span className="hide-mobile">{locating ? 'กำลังหา…' : 'ตำแหน่งฉัน'}</span>
                </button>
              </div>
            </Field>

            {placeOpen && places.length ? (
              <div className="menu" style={{ left: 0, right: 'auto', width: '100%', maxWidth: 460 }}>
                {places.map((p, i) => (
                  <button
                    key={`${p.lat},${p.lng},${i}`}
                    type="button"
                    className="menu-item"
                    onClick={() => pickPlace(p)}
                    style={{ alignItems: 'flex-start' }}
                  >
                    <Icon name="map-pin" style={{ marginTop: 2 }} />
                    <span style={{ minWidth: 0 }}>
                      <b style={{ display: 'block', fontWeight: 600 }}>{p.name}</b>
                      {p.detail ? <span className="sm faint">{p.detail}</span> : null}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {/* ---------- ตัวกรอง ---------- */}
        <div className="filters">
          <Field label="หรือเลือกเมือง">
            <select value={isPresetCity ? loc.name : ''} onChange={(e) => pickCity(e.target.value)}>
              {/* ตำแหน่งจาก GPS หรือจากการค้นหาไม่มีในรายการ จึงต้องมี option ว่างไว้แสดงชื่อ */}
              {isPresetCity ? null : <option value="">{loc?.name || '— เลือกเมือง —'}</option>}
              {CITY_PRESETS.map((c) => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="รัศมี">
            <select value={radius} onChange={(e) => setRadius(Number(e.target.value))}>
              {RADIUS_OPTIONS.map((r) => (
                <option key={r} value={r}>{r} km</option>
              ))}
            </select>
          </Field>
          <Field label="ประเภท">
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">ทั้งหมด</option>
              <option value="AC">มีหัว AC</option>
              <option value="DC">มีหัว DC</option>
            </select>
          </Field>
          <Field label="กำลังไฟขั้นต่ำ (kW)">
            <input
              type="number" min="0" step="any" inputMode="decimal" placeholder="ไม่จำกัด"
              value={minPower} onChange={(e) => setMinPower(e.target.value)}
            />
          </Field>
          <Field label="กรองรายการ" style={{ gridColumn: 'span 2' }}>
            <input
              type="text" placeholder="ชื่อสถานี ผู้ให้บริการ หรือชนิดหัวชาร์จ" spellCheck={false}
              value={filter} onChange={(e) => setFilter(e.target.value)}
            />
          </Field>
        </div>

        <div className="card-head">
          <h3>
            {busy ? 'กำลังค้นหา…' : `พบ ${fmt0(shown.length)} สถานี`}
            <span className="hint">
              {/* โชว์พิกัดจริงด้วย ผู้ใช้จะได้ตรวจเองได้ว่าค้นจากจุดไหน เวลาผลไม่ตรงกับที่คาด */}
              {loc
                ? `รอบ ${loc.name}${accuracyText(loc.accuracyM) ? ` (${accuracyText(loc.accuracyM)})` : ''} `
                  + `· ${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)} · รัศมี ${radius} km`
                : 'ยังไม่ได้เลือกตำแหน่ง'}
              {filter && stations.length !== shown.length ? ` · กรองจาก ${stations.length} รายการ` : ''}
            </span>
          </h3>
          <button type="button" className="btn btn-sm" onClick={() => search(loc, radius)} disabled={busy || !loc}>
            <Icon name="refresh" />ค้นใหม่
          </button>
        </div>

        {/* เตือนเมื่อเบราว์เซอร์บอกเองว่าตำแหน่งหยาบ — ในเมืองพลาดเกิน 1 กม. ก็คนละย่านแล้ว */}
        {loc && isCoarse(loc.accuracyM) ? (
          <div className="card-body" style={{ paddingBottom: 0 }}>
            <div className="alert warn">
              <Icon name="alert" />
              <div>
                <div className="t1">ตำแหน่งที่ได้อาจคลาดเคลื่อน {accuracyText(loc.accuracyM)}</div>
                <div className="t2">
                  มักเกิดตอนอยู่ในอาคารหรือใช้คอมที่ไม่มี GPS เบราว์เซอร์จะเดาจาก WiFi หรือ IP แทน
                  ถ้าสถานีที่ขึ้นไม่ใช่ย่านของคุณ ให้พิมพ์ชื่อย่านในช่องค้นหาสถานที่ด้านบน
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="card-body">
            <div className="alert warn">
              <Icon name="alert" />
              <div className="t2" style={{ marginTop: 0 }}>{error}</div>
            </div>
          </div>
        ) : null}

        {shown.length ? (
          <div className="card-body">
            <div className="station-list">
              {shown.map((s, i) => (
                <div className="station-row" key={s.id ?? `${s.lat},${s.lng},${i}`}>
                  <span className="station-pin" style={{ background: PIN_COLORS[i % PIN_COLORS.length] }}>
                    {i + 1}
                  </span>
                  <div className="body">
                    <div className="t1">{s.name}</div>
                    <div className="t2">
                      {[s.operator, s.address].filter(Boolean).join(' · ') || 'ไม่มีรายละเอียดที่อยู่'}
                    </div>
                    <div className="t3">
                      {s.hasDC ? <span className="pill pill-DC">DC</span> : null}
                      {s.hasAC ? <span className="pill pill-AC">AC</span> : null}
                      {s.maxPowerKW ? <span>สูงสุด {fmt1(s.maxPowerKW)} kW</span> : null}
                      {s.pointCount ? <span>· {s.pointCount} หัวชาร์จ</span> : null}
                    </div>
                    {connectorSummary(s.connections) ? (
                      <div className="t3">{connectorSummary(s.connections)}</div>
                    ) : null}
                    {s.usageCost ? <div className="t3">ค่าบริการ: {s.usageCost}</div> : null}
                  </div>
                  <div className="r" style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                    <div className="a">{s.distanceKm !== null ? `${fmt(s.distanceKm, 1)} km` : '—'}</div>
                    <a className="btn btn-sm" href={mapsLink(s)} target="_blank" rel="noopener noreferrer">
                      <Icon name="map-pin" />แผนที่
                    </a>
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => logHere(s)}>
                      <Icon name="plus" />บันทึกที่นี่
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {attribution ? (
              <p className="sm faint mt">
                {attribution} ·{' '}
                <a href="https://openchargemap.org" target="_blank" rel="noopener noreferrer">
                  openchargemap.org
                </a>
                {' · '}ค้นสถานที่โดย{' '}
                <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
                  OpenStreetMap
                </a>
              </p>
            ) : null}
          </div>
        ) : !busy && !error ? (
          <EmptyState
            message={
              filter
                ? `ไม่พบสถานีที่ตรงกับ "${filter}" — ลองล้างช่องกรองรายการ`
                : 'ยังไม่มีผลการค้นหา — กด "ตำแหน่งฉัน" หรือพิมพ์ค้นหาสถานที่'
            }
          />
        ) : null}
      </div>

      {shown.length ? (
        <div className="stats mt">
          <Stat tone="accent" icon="map-pin" label="สถานีที่พบ" value={fmt0(shown.length)} unit="แห่ง"
            detail={loc ? `รอบ ${loc.name}` : null} />
          <Stat tone="dc" icon="bolt" label="มีหัว DC" value={fmt0(dcCount)} unit="แห่ง"
            detail={`จากทั้งหมด ${shown.length} แห่ง`} />
          <Stat tone="warn" icon="gauge" label="กำลังไฟสูงสุด" value={fastest ? fmt1(fastest) : '—'} unit="kW" />
          <Stat tone="purple" icon="road" label="ใกล้ที่สุด" value={nearest !== null ? fmt(nearest, 1) : '—'} unit="km" />
        </div>
      ) : null}
    </>
  );
}
