'use client';
/** บัญชี & รถของฉัน — จัดการรถ ค่าเริ่มต้น ธีม บัญชีผู้ใช้ และข้อมูลบน Supabase */
import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/components/store';
import { EmptyState, Field } from '@/components/ui';
import CarModal from '@/components/CarModal';
import Icon from '@/components/Icon';
import { lastOdo, summarize } from '@/lib/calc';
import { fmt0, fmt1, fmtDist, isNum, money0, uuid } from '@/lib/format';
import { exportBackup, readBackup } from '@/lib/exporters';
import { imgAll } from '@/lib/storage';
import { bulkInsert } from '@/lib/db';
import { buildDemoState } from '@/lib/demo';
import { clearLegacy, migrateLegacy } from '@/lib/legacy';

export default function AccountPage() {
  const {
    user, data, cars, settings, setSettings, wipeAll, reload,
    confirm, toast, logout, sessions, changePassword,
    legacyFound, setLegacyFound,
  } = useStore();

  const [editing, setEditing] = useState(undefined);
  const [priceAC, setPriceAC] = useState(String(settings.priceAC ?? ''));
  const [priceDC, setPriceDC] = useState(String(settings.priceDC ?? ''));
  const [usage, setUsage] = useState({ images: 0, bytes: 0 });
  const [newPass, setNewPass] = useState('');
  const [passBusy, setPassBusy] = useState(false);
  const [migrating, setMigrating] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    imgAll()
      .then((imgs) => setUsage({ images: imgs.length, bytes: imgs.reduce((a, i) => a + (i.size || 0), 0) }))
      .catch(() => {});
  }, [data.sessions.length, data.costs.length]);

  function saveDefaults() {
    setSettings({
      priceAC: priceAC === '' ? null : Number(priceAC),
      priceDC: priceDC === '' ? null : Number(priceDC),
    });
    toast('บันทึกค่าเริ่มต้นเรียบร้อย');
  }

  async function doChangePassword() {
    if (newPass.length < 6) return toast('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร', true);
    setPassBusy(true);
    const error = await changePassword(newPass);
    setPassBusy(false);
    if (error) return toast(error, true);
    setNewPass('');
    toast('เปลี่ยนรหัสผ่านเรียบร้อย');
  }

  /** ออก id ใหม่ให้ทุกแถวแล้วผูก carId กลับให้ถูก ก่อนใส่เข้าบัญชีนี้ */
  function remapForImport(d) {
    const carMap = new Map();
    const importedCars = (d.cars || []).map((c) => {
      const id = uuid();
      carMap.set(c.id, id);
      return { ...c, id };
    });
    const mapCar = (old) => carMap.get(old) || null;
    return {
      cars: importedCars,
      sessions: (d.sessions || []).map((s) => ({ ...s, id: uuid(), carId: mapCar(s.carId), images: [] })),
      costs: (d.costs || []).map((c) => ({ ...c, id: uuid(), carId: mapCar(c.carId), images: [] })),
      alerts: (d.alerts || []).map((a) => ({ ...a, id: uuid(), carId: mapCar(a.carId) })),
    };
  }

  async function handleImport(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    let parsed;
    try {
      parsed = await readBackup(file);
    } catch (err) {
      return toast(err.message, true);
    }
    const payload = remapForImport(parsed.data);
    confirm(
      'นำเข้าข้อมูล',
      `จะเพิ่มข้อมูลจากไฟล์นี้เข้าบัญชีปัจจุบัน (${payload.cars.length} คัน, ${payload.sessions.length} การชาร์จ, ${payload.costs.length} ต้นทุน) โดยไม่ลบของเดิม · รูปแนบไม่ได้อยู่ในไฟล์สำรองจึงไม่ถูกนำเข้า`,
      async () => {
        try {
          await bulkInsert(user.id, payload);
          await reload(user.id);
          toast('นำเข้าข้อมูลเรียบร้อย');
        } catch (err) {
          toast(err.message, true);
        }
      }
    );
  }

  function handleDemo() {
    confirm('ใส่ข้อมูลตัวอย่าง', 'จะเพิ่มรถตัวอย่างพร้อมประวัติการชาร์จเข้าบัญชีนี้ โดยไม่ลบข้อมูลเดิม', async () => {
      const demo = buildDemoState({ theme: settings.theme });
      const payload = remapForImport(demo);
      try {
        await bulkInsert(user.id, payload);
        await reload(user.id);
        toast('ใส่ข้อมูลตัวอย่างเรียบร้อย');
      } catch (err) {
        toast(err.message, true);
      }
    });
  }

  function handleWipe() {
    confirm('ล้างข้อมูลทั้งหมด', 'ลบรถ ประวัติการชาร์จ ต้นทุน และการเตือนทั้งหมดออกจากบัญชีนี้ถาวร', () => {
      wipeAll();
      toast('ล้างข้อมูลแล้ว');
    });
  }

  async function runMigration() {
    setMigrating('กำลังเตรียมข้อมูล…');
    try {
      const result = await migrateLegacy(user.id, setMigrating);
      setLegacyFound(null);
      await reload(user.id);
      toast(
        result
          ? `ย้ายขึ้น Supabase แล้ว: ${result.sessions} การชาร์จ · ${result.cars} คัน · ${result.images} รูป`
          : 'ไม่พบข้อมูลเดิมให้ย้าย'
      );
    } catch (err) {
      toast(err.message, true);
    } finally {
      setMigrating('');
    }
  }

  const legacyCount = legacyFound
    ? legacyFound.sessions.length + legacyFound.costs.length + legacyFound.cars.length
    : 0;

  return (
    <>
      {legacyFound ? (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-body">
            <div className="alert warn">
              <Icon name="upload" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="t1">พบข้อมูลเดิมที่เก็บไว้ในเบราว์เซอร์เครื่องนี้</div>
                <div className="t2">
                  {legacyFound.cars.length} คัน · {legacyFound.sessions.length} การชาร์จ · {legacyFound.costs.length} ต้นทุน
                  {' '}(รวม {legacyCount} รายการ) — ย้ายขึ้นบัญชี Supabase เพื่อใช้ข้ามเครื่องได้
                </div>
              </div>
            </div>
            <div className="rowflex mt">
              <button type="button" className="btn btn-primary" onClick={runMigration} disabled={Boolean(migrating)}>
                <Icon name="upload" />
                {migrating || 'ย้ายข้อมูลขึ้น Supabase'}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={Boolean(migrating)}
                onClick={() =>
                  confirm('ทิ้งข้อมูลเดิม', 'ลบข้อมูลที่ค้างอยู่ในเบราว์เซอร์เครื่องนี้ทิ้งโดยไม่ย้ายขึ้น Supabase', () => {
                    clearLegacy();
                    setLegacyFound(null);
                    toast('ลบข้อมูลเดิมในเครื่องแล้ว');
                  })
                }
              >
                ไม่ต้องย้าย ลบทิ้ง
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="card">
        <div className="card-head">
          <h3>
            รถของฉัน
            <span className="hint">เพิ่มได้หลายคัน · สลับคันที่ดูข้อมูลได้จากแถบด้านบน</span>
          </h3>
          <button type="button" className="btn btn-sm btn-primary" onClick={() => setEditing(null)}>
            <Icon name="plus" />เพิ่มรถ
          </button>
        </div>
        <div className="rows">
          {cars.map((c) => {
            const s = summarize(data.sessions.filter((x) => x.carId === c.id));
            const odo = lastOdo(data.sessions, cars, c.id);
            const spec = [
              [c.brand, c.model].filter(Boolean).join(' ') || 'ไม่ระบุรุ่น',
              isNum(c.batt) ? `${fmt1(Number(c.batt))} kWh` : null,
              isNum(c.range) ? `วิ่งได้ ${fmt0(Number(c.range))} km` : null,
              c.plate || null,
            ].filter(Boolean).join(' · ');
            return (
              <button type="button" className="row-item" key={c.id} onClick={() => setEditing(c)}>
                <div className="ic" style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}>
                  <Icon name="car" />
                </div>
                <div className="body">
                  <div className="t1">
                    {c.name}
                    {settings.activeCar === c.id ? <span className="pill pill-ok" style={{ marginLeft: 8 }}>ใช้งานอยู่</span> : null}
                  </div>
                  <div className="t2">{spec}</div>
                </div>
                <div className="r">
                  <div className="a">{odo !== null ? `${fmtDist(odo)} km` : '—'}</div>
                  <div className="b">{s.count} ครั้ง · {money0(s.cost)}</div>
                </div>
              </button>
            );
          })}
          {!cars.length ? (
            <EmptyState
              message="ยังไม่มีรถ — เพิ่มรถคันแรกเพื่อเริ่มบันทึกการชาร์จ"
              action={
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing(null)}>
                  เพิ่มรถคันแรก
                </button>
              }
            />
          ) : null}
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h3>ค่าเริ่มต้นและธีม</h3></div>
        <div className="card-body">
          <div className="form-grid">
            <Field label="ราคาเริ่มต้น AC (฿/kWh)" help="ใช้เติมให้อัตโนมัติตอนบันทึกการชาร์จ">
              <input type="number" min="0" step="any" inputMode="decimal" placeholder="4.50"
                value={priceAC} onChange={(e) => setPriceAC(e.target.value)} />
            </Field>
            <Field label="ราคาเริ่มต้น DC (฿/kWh)">
              <input type="number" min="0" step="any" inputMode="decimal" placeholder="7.50"
                value={priceDC} onChange={(e) => setPriceDC(e.target.value)} />
            </Field>
            <Field label="ธีม">
              <select value={settings.theme || 'auto'} onChange={(e) => setSettings({ theme: e.target.value })}>
                <option value="auto">ตามระบบ</option>
                <option value="light">สว่าง</option>
                <option value="dark">มืด</option>
              </select>
            </Field>
          </div>
          <div className="mt">
            <button type="button" className="btn btn-primary" onClick={saveDefaults}>
              <Icon name="check" />บันทึก
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>
            ข้อมูลของคุณ
            <span className="hint">เก็บบน Supabase · เข้าถึงได้จากทุกเครื่องที่ล็อกอินบัญชีนี้</span>
          </h3>
        </div>
        <div className="card-body">
          <div className="alert" style={{ marginBottom: 14 }}>
            <Icon name="inbox" style={{ color: 'var(--accent)' }} />
            <div>
              <div className="t1">สรุปข้อมูลในบัญชี</div>
              <div className="t2">
                {data.sessions.length} การชาร์จ · {data.costs.length} ต้นทุน · {cars.length} คัน · {usage.images} รูป
                <br />
                รูปแนบใช้พื้นที่ {(usage.bytes / 1048576).toFixed(2)} MB ในบัคเก็ต charge-images
              </div>
            </div>
          </div>

          <div className="rowflex">
            <button type="button" className="btn" onClick={() => { exportBackup(data); toast('ส่งออกข้อมูลเรียบร้อย'); }}>
              <Icon name="download" />ส่งออกข้อมูล (JSON)
            </button>
            <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
              <Icon name="upload" />นำเข้าจากไฟล์
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={handleImport} />
            <button type="button" className="btn" onClick={handleDemo}>
              <Icon name="copy" />ใส่ข้อมูลตัวอย่าง
            </button>
            <button type="button" className="btn btn-danger" onClick={handleWipe}>
              <Icon name="trash" />ล้างข้อมูลทั้งหมด
            </button>
          </div>
          <p className="sm faint mt">
            ไฟล์ส่งออกมีเฉพาะข้อมูลตัวเลขและข้อความ — รูปแนบอยู่ใน Supabase Storage จึงไม่ถูกรวมไปด้วย
            การนำเข้าจะเพิ่มข้อมูลเข้าบัญชีนี้โดยไม่ลบของเดิม
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h3>บัญชีผู้ใช้</h3></div>
        <div className="card-body">
          <dl className="kv" style={{ maxWidth: 420 }}>
            <dt>อีเมล</dt><dd style={{ wordBreak: 'break-all' }}>{user?.email}</dd>
            <dt>เข้าสู่ระบบด้วย</dt><dd>Supabase Auth (อีเมล + รหัสผ่าน)</dd>
            <dt>จำนวนการชาร์จที่บันทึก</dt><dd>{sessions.length}</dd>
          </dl>

          <div className="form-grid mt" style={{ maxWidth: 420 }}>
            <Field label="ตั้งรหัสผ่านใหม่" help="อย่างน้อย 6 ตัวอักษร">
              <input
                type="password" autoComplete="new-password" placeholder="••••••"
                value={newPass} onChange={(e) => setNewPass(e.target.value)}
              />
            </Field>
          </div>
          <div className="rowflex mt">
            <button type="button" className="btn" onClick={doChangePassword} disabled={passBusy || !newPass}>
              <Icon name="check" />{passBusy ? 'กำลังบันทึก…' : 'เปลี่ยนรหัสผ่าน'}
            </button>
            <button type="button" className="btn" onClick={logout}>
              <Icon name="logout" />ออกจากระบบ
            </button>
          </div>
        </div>
      </div>

      {editing !== undefined ? (
        <CarModal car={editing} onClose={() => setEditing(undefined)} />
      ) : null}
    </>
  );
}
