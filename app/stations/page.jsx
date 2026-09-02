'use client';
/**
 * สถานีชาร์จใกล้ฉัน — ดึงจาก Open Charge Map ผ่าน Route Handler ของเราเอง
 * ไม่มีแผนที่ในตัว แต่ละสถานีเปิดต่อใน Google Maps ได้ เพื่อไม่ต้องเพิ่ม dependency
 */
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/components/store';
import { EmptyState, Field, Stat } from '@/components/ui';
import Icon from '@/components/Icon';
import {
  CITY_PRESETS, RADIUS_OPTIONS, connectorSummary, fetchStations,
  getCurrentPosition, mapsLink, readLastLocation, saveLastLocation,
} from '@/lib/stations';
import { fmt, fmt0, fmt1 } from '@/lib/format';

const PIN_COLORS = ['var(--accent)', 'var(--dc)', 'var(--purple)', 'var(--warn)', 'var(--faint)'];

export default function StationsPage() {
  const { toast, setQuickDraft } = useStore();
  const router = useRouter();

  const [loc, setLoc] = useState(null);
  const [radius, setRadius] = useState(15);
  const [type, setType] = useState('');       // '' | AC | DC
  const [minPower, setMinPower] = useState('');
  const [stations, setStations] = useState([]);
  const [attribution, setAttribution] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    setLoc(readLastLocation() || CITY_PRESETS[0]);
  }, []);

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

  // ค้นใหม่ทุกครั้งที่เปลี่ยนตำแหน่งหรือรัศมี
  useEffect(() => {
    if (loc) search(loc, radius);
  }, [loc, radius, search]);

  async function useMyLocation() {
    setLocating(true);
    try {
      const here = await getCurrentPosition();
      saveLastLocation(here);
      setLoc(here);
    } catch (e) {
      toast(e.message, true);
    } finally {
      setLocating(false);
    }
  }

  function pickCity(name) {
    const city = CITY_PRESETS.find((c) => c.name === name);
    if (!city) return;
    saveLastLocation(city);
    setLoc(city);
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
    return true;
  });

  const dcCount = shown.filter((s) => s.hasDC).length;
  const fastest = shown.reduce((a, s) => Math.max(a, s.maxPowerKW || 0), 0);
  const nearest = shown.length ? shown[0].distanceKm : null;

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

          <p className="sm faint mt">
            ตัวแปรนี้ไม่มี <code>NEXT_PUBLIC_</code> นำหน้า เพราะถูกอ่านฝั่งเซิร์ฟเวอร์เท่านั้น คีย์จึงไม่หลุดไปกับหน้าเว็ป
            <br />
            หน้าอื่นของแอปใช้งานได้ตามปกติแม้ยังไม่ตั้งค่าตัวนี้
          </p>

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
        <div className="filters">
          <Field label="ตำแหน่งที่ใช้ค้น">
            <select value={loc?.name || ''} onChange={(e) => pickCity(e.target.value)}>
              {loc && !CITY_PRESETS.some((c) => c.name === loc.name) ? (
                <option value={loc.name}>{loc.name}</option>
              ) : null}
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
        </div>

        <div className="card-head">
          <h3>
            {busy ? 'กำลังค้นหา…' : `พบ ${fmt0(shown.length)} สถานี`}
            <span className="hint">
              {loc ? `รอบ ${loc.name} รัศมี ${radius} km` : ''}
            </span>
          </h3>
          <button type="button" className="btn btn-sm" onClick={useMyLocation} disabled={locating || busy}>
            <Icon name={locating ? 'clock' : 'map-pin'} />
            {locating ? 'กำลังหาตำแหน่ง…' : 'ใช้ตำแหน่งปัจจุบัน'}
          </button>
          <button type="button" className="btn btn-sm" onClick={() => search(loc, radius)} disabled={busy}>
            <Icon name="refresh" />ค้นใหม่
          </button>
        </div>

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
                    <a
                      className="btn btn-sm"
                      href={mapsLink(s)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
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
              </p>
            ) : null}
          </div>
        ) : !busy && !error ? (
          <EmptyState message="ยังไม่มีผลการค้นหา — เลือกตำแหน่งแล้วกดค้นใหม่" />
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
