'use client';
/** บัญชี & รถของฉัน — จัดการรถ ค่าเริ่มต้น ธีม และข้อมูลสำรอง */
import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/components/store';
import { EmptyState, Field } from '@/components/ui';
import CarModal from '@/components/CarModal';
import Icon from '@/components/Icon';
import { lastOdo, summarize } from '@/lib/calc';
import { fmt0, fmt1, fmtDist, isNum, money0 } from '@/lib/format';
import { exportBackup, readBackup, restoreImages } from '@/lib/exporters';
import { imgAll } from '@/lib/storage';
import { buildDemoState } from '@/lib/demo';

export default function AccountPage() {
  const {
    data, cars, settings, setSettings, replaceAll, wipeAll,
    confirm, toast, logout, sessions,
  } = useStore();

  const [editing, setEditing] = useState(undefined);
  const [priceAC, setPriceAC] = useState(String(settings.priceAC ?? ''));
  const [priceDC, setPriceDC] = useState(String(settings.priceDC ?? ''));
  const [withImages, setWithImages] = useState(true);
  const [usage, setUsage] = useState({ images: 0, imageBytes: 0 });
  const fileRef = useRef(null);

  useEffect(() => {
    imgAll()
      .then((imgs) => {
        setUsage({
          images: imgs.length,
          imageBytes: imgs.reduce((a, i) => a + (i.dataUrl ? i.dataUrl.length : 0), 0),
        });
      })
      .catch(() => {});
  }, [data.sessions.length, data.costs.length]);

  const stateBytes = new Blob([JSON.stringify(data)]).size;

  function saveDefaults() {
    setSettings({
      priceAC: priceAC === '' ? null : Number(priceAC),
      priceDC: priceDC === '' ? null : Number(priceDC),
    });
    toast('บันทึกค่าเริ่มต้นเรียบร้อย');
  }

  async function handleExport() {
    try {
      await exportBackup(data, withImages);
      toast('สำรองข้อมูลเรียบร้อย');
    } catch {
      toast('สำรองข้อมูลไม่สำเร็จ', true);
    }
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
    confirm(
      'กู้คืนข้อมูล',
      `ข้อมูลปัจจุบันทั้งหมดจะถูกแทนที่ด้วยข้อมูลจากไฟล์นี้ (${parsed.data.sessions.length} การชาร์จ, ${parsed.images.length} รูป)`,
      async () => {
        replaceAll(parsed.data);
        if (parsed.images.length) await restoreImages(parsed.images);
        toast('กู้คืนข้อมูลเรียบร้อย');
      }
    );
  }

  function handleDemo() {
    confirm('ใส่ข้อมูลตัวอย่าง', 'ข้อมูลปัจจุบันทั้งหมดจะถูกแทนที่ด้วยข้อมูลตัวอย่าง', () => {
      replaceAll(buildDemoState({ theme: settings.theme }));
      toast('ใส่ข้อมูลตัวอย่างเรียบร้อย');
    });
  }

  function handleWipe() {
    confirm('ล้างข้อมูลทั้งหมด', 'ลบรถ ประวัติการชาร์จ ต้นทุน การเตือน และรูปแนบทั้งหมดถาวร', () => {
      wipeAll();
      toast('ล้างข้อมูลแล้ว');
    });
  }

  return (
    <>
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
              <input type="number" min="0" step="0.01" inputMode="decimal" placeholder="4.50"
                value={priceAC} onChange={(e) => setPriceAC(e.target.value)} />
            </Field>
            <Field label="ราคาเริ่มต้น DC (฿/kWh)">
              <input type="number" min="0" step="0.01" inputMode="decimal" placeholder="7.50"
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
            ข้อมูลและการสำรอง
            <span className="hint">ข้อมูลทั้งหมดเก็บอยู่ในเบราว์เซอร์เครื่องนี้เท่านั้น</span>
          </h3>
        </div>
        <div className="card-body">
          <div className="alert" style={{ marginBottom: 14 }}>
            <Icon name="inbox" style={{ color: 'var(--accent)' }} />
            <div>
              <div className="t1">ข้อมูลในเครื่องนี้</div>
              <div className="t2">
                {data.sessions.length} การชาร์จ · {data.costs.length} ต้นทุน · {cars.length} คัน · {usage.images} รูป
                <br />
                ใช้พื้นที่ {(stateBytes / 1024).toFixed(1)} KB (localStorage) + {(usage.imageBytes / 1048576).toFixed(2)} MB (IndexedDB)
                <br />
                ถ้าล้างข้อมูลเบราว์เซอร์หรือเปิดจากเครื่องอื่นจะไม่เห็นข้อมูลนี้ — แนะนำให้สำรองเป็นไฟล์เก็บไว้
              </div>
            </div>
          </div>

          <div className="rowflex">
            <button type="button" className="btn" onClick={handleExport}>
              <Icon name="download" />สำรองข้อมูล (JSON)
            </button>
            <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
              <Icon name="upload" />กู้คืนข้อมูล
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={handleImport} />
            <button type="button" className="btn" onClick={handleDemo}>
              <Icon name="copy" />ใส่ข้อมูลตัวอย่าง
            </button>
            <button type="button" className="btn btn-danger" onClick={handleWipe}>
              <Icon name="trash" />ล้างข้อมูลทั้งหมด
            </button>
          </div>

          <label className="rowflex sm muted mt" style={{ gap: 7, cursor: 'pointer' }}>
            <input type="checkbox" checked={withImages} onChange={(e) => setWithImages(e.target.checked)}
              style={{ width: 'auto', accentColor: 'var(--accent)' }} />
            รวมรูปแนบในไฟล์สำรอง (ไฟล์จะใหญ่ขึ้นมาก)
          </label>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h3>บัญชีผู้ใช้</h3></div>
        <div className="card-body">
          <dl className="kv" style={{ maxWidth: 340 }}>
            <dt>ผู้ใช้</dt><dd>Admin</dd>
            <dt>รูปแบบการเข้าสู่ระบบ</dt><dd>รหัสคงที่</dd>
            <dt>จำนวนการชาร์จที่บันทึก</dt><dd>{sessions.length}</dd>
          </dl>
          <p className="sm faint mt">
            การเข้าสู่ระบบนี้ตรวจสอบฝั่งเบราว์เซอร์เท่านั้น เป็นการล็อกหน้าจอเบื้องต้น ไม่ใช่การป้องกันข้อมูลจริง —
            ใครที่เปิดเบราว์เซอร์เครื่องนี้ได้ก็เข้าถึงข้อมูลได้
          </p>
          <div className="mt">
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
