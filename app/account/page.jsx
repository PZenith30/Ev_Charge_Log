'use client';
/** บัญชี & รถของฉัน — จัดการรถ ค่าเริ่มต้น ธีม บัญชีผู้ใช้ และข้อมูลบน Supabase */
import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/components/store';
import { CollapsibleCard, EmptyState, Field } from '@/components/ui';
import CarModal from '@/components/CarModal';
import { LANGS } from '@/lib/i18n';
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
    user, data, cars, settings, setSettings, wipeAll, reload, lang, setLang,
    confirm, toast, logout, sessions, setPwOpen,
    legacyFound, setLegacyFound, t
  } = useStore();

  const [editing, setEditing] = useState(undefined);
  const [priceAC, setPriceAC] = useState(String(settings.priceAC ?? ''));
  const [priceDC, setPriceDC] = useState(String(settings.priceDC ?? ''));
  const [usage, setUsage] = useState({ images: 0, bytes: 0 });
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
                <div className="t1">{t('พบข้อมูลเดิมที่เก็บไว้ในเบราว์เซอร์เครื่องนี้')}</div>
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
                {t('ไม่ต้องย้าย ลบทิ้ง')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <CollapsibleCard
        id="acc-cars"
        title={t('รถของฉัน')}
        hint={t('เพิ่มได้หลายคัน · สลับคันที่ดูข้อมูลได้จากแถบด้านบน')}
        actions={
          <button type="button" className="btn btn-sm btn-primary" onClick={() => setEditing(null)}>
            <Icon name="plus" />{t('เพิ่มรถ')}
          </button>
        }
      >
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
                    {settings.activeCar === c.id ? <span className="pill pill-ok" style={{ marginLeft: 8 }}>{t('ใช้งานอยู่')}</span> : null}
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
              message={t('ยังไม่มีรถ — เพิ่มรถคันแรกเพื่อเริ่มบันทึกการชาร์จ')}
              action={
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing(null)}>
                  {t('เพิ่มรถคันแรก')}
                </button>
              }
            />
          ) : null}
        </div>
      </CollapsibleCard>

      <CollapsibleCard id="acc-defaults" title={t('ค่าเริ่มต้นและธีม')} className="mt">
        <div className="card-body">
          <div className="form-grid">
            <Field label={t('ราคาเริ่มต้น AC (฿/kWh)')} help={t('ใช้เติมให้อัตโนมัติตอนบันทึกการชาร์จ')}>
              <input type="number" min="0" step="any" inputMode="decimal" placeholder="4.50"
                value={priceAC} onChange={(e) => setPriceAC(e.target.value)} />
            </Field>
            <Field label={t('ราคาเริ่มต้น DC (฿/kWh)')}>
              <input type="number" min="0" step="any" inputMode="decimal" placeholder="7.50"
                value={priceDC} onChange={(e) => setPriceDC(e.target.value)} />
            </Field>
            <Field label={t('ธีม')}>
              <select value={settings.theme || 'auto'} onChange={(e) => setSettings({ theme: e.target.value })}>
                <option value="auto">{t('ตามระบบ')}</option>
                <option value="light">{t('สว่าง')}</option>
                <option value="dark">{t('มืด')}</option>
              </select>
            </Field>
            {/* ภาษาเก็บในเครื่อง ไม่ได้เก็บลง Supabase จึงไม่ต้องกดบันทึก มีผลทันที */}
            <Field label={t('ภาษา')} help={t('ตั้งแยกในแต่ละเครื่อง · มีผลทันทีโดยไม่ต้องกดบันทึก')}>
              <select value={lang} onChange={(e) => setLang(e.target.value)}>
                {LANGS.map((l) => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="mt">
            <button type="button" className="btn btn-primary" onClick={saveDefaults}>
              <Icon name="check" />{t('บันทึก')}
            </button>
          </div>
        </div>
      </CollapsibleCard>

      <CollapsibleCard
        id="acc-data"
        title={t('ข้อมูลของคุณ')}
        hint={t('เก็บบน Supabase · เข้าถึงได้จากทุกเครื่องที่ล็อกอินบัญชีนี้')}
        className="mt"
      >
        <div className="card-body">
          <div className="alert" style={{ marginBottom: 14 }}>
            <Icon name="inbox" style={{ color: 'var(--accent)' }} />
            <div>
              <div className="t1">{t('สรุปข้อมูลในบัญชี')}</div>
              <div className="t2">
                {data.sessions.length} การชาร์จ · {data.costs.length} ต้นทุน · {cars.length} คัน · {usage.images} รูป
                <br />
                รูปแนบใช้พื้นที่ {(usage.bytes / 1048576).toFixed(2)} MB ในบัคเก็ต charge-images
              </div>
            </div>
          </div>

          <div className="rowflex">
            <button type="button" className="btn" onClick={() => { exportBackup(data); toast('ส่งออกข้อมูลเรียบร้อย'); }}>
              <Icon name="download" />{t('ส่งออกข้อมูล (JSON)')}
            </button>
            <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
              <Icon name="upload" />{t('นำเข้าจากไฟล์')}
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={handleImport} />
            <button type="button" className="btn" onClick={handleDemo}>
              <Icon name="copy" />{t('ใส่ข้อมูลตัวอย่าง')}
            </button>
            <button type="button" className="btn btn-danger" onClick={handleWipe}>
              <Icon name="trash" />{t('ล้างข้อมูลทั้งหมด')}
            </button>
          </div>
          <p className="sm faint mt">
            ไฟล์ส่งออกมีเฉพาะข้อมูลตัวเลขและข้อความ — รูปแนบอยู่ใน Supabase Storage จึงไม่ถูกรวมไปด้วย
            การนำเข้าจะเพิ่มข้อมูลเข้าบัญชีนี้โดยไม่ลบของเดิม
          </p>
        </div>
      </CollapsibleCard>

      <CollapsibleCard id="acc-user" title={t('บัญชีผู้ใช้')} className="mt">
        <div className="card-body">
          <dl className="kv" style={{ maxWidth: 420 }}>
            <dt>{t('อีเมล')}</dt><dd style={{ wordBreak: 'break-all' }}>{user?.email}</dd>
            <dt>{t('เข้าสู่ระบบด้วย')}</dt><dd>{t('Supabase Auth (อีเมล + รหัสผ่าน)')}</dd>
            <dt>{t('จำนวนการชาร์จที่บันทึก')}</dt><dd>{sessions.length}</dd>
          </dl>

          <div className="rowflex mt">
            {/* ใช้หน้าต่างเดียวกับที่เรียกจากเมนูโปรไฟล์ จะได้ไม่มีฟอร์มซ้ำสองที่ */}
            <button type="button" className="btn" onClick={() => setPwOpen(true)}>
              <Icon name="settings" />{t('เปลี่ยนรหัสผ่าน')}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => confirm('ออกจากระบบ', 'ต้องออกจากระบบตอนนี้เลยไหม ข้อมูลถูกบันทึกไว้บน Supabase แล้ว', logout)}
            >
              <Icon name="logout" />{t('ออกจากระบบ')}
            </button>
          </div>
        </div>
      </CollapsibleCard>

      {editing !== undefined ? (
        <CarModal car={editing} onClose={() => setEditing(undefined)} />
      ) : null}
    </>
  );
}
