'use client';
/** ชิ้นส่วนที่ใช้ร่วมกันระหว่างแดชบอร์ดกับหน้าประวัติ — แถวรายการชาร์จ, รายละเอียด, แถบแจ้งเตือน */
import { useEffect, useState } from 'react';
import { ALERT_TYPES } from '@/lib/data';
import { fmt, fmt0, fmt1, fmtDist, fmtDuration, money0, money, thDate, n, isNum } from '@/lib/format';
import { sBahtKm, sDashReading, sDist, sEff, sEff100, sKwh100, sPricePerKwh, sSoc, sTotal } from '@/lib/calc';
import { imgMany } from '@/lib/storage';
import Icon from './Icon';
import { Modal } from './ui';
import { useStore } from './store';

export function SessionRow({ session: s, onClick }) {
  const dist = sDist(s);
  const eff = sEff(s);
  const col = s.type === 'DC' ? 'dc' : 'ac';
  const detail = [
    thDate(s.date) + (s.time ? ` · ${s.time} น.` : ''),
    `${fmt1(n(s.kwh))} kWh`,
    dist !== null ? `${fmtDist(dist)} km` : null,
    eff !== null ? `${fmt(eff, 2)} km/kWh` : null,
  ].filter(Boolean).join(' · ');

  return (
    <button type="button" className="row-item" onClick={onClick}>
      <div className="ic" style={{ background: `var(--${col}-soft)`, color: `var(--${col})` }}>
        {s.type === 'DC' ? 'DC' : 'AC'}
      </div>
      <div className="body">
        <div className="t1">{s.station || (s.type === 'DC' ? 'ชาร์จเร็ว DC' : 'ชาร์จ AC')}</div>
        <div className="t2">{detail}</div>
      </div>
      <div className="r">
        <div className="a">{money0(sTotal(s))}</div>
        <div className="b">{sPricePerKwh(s) !== null ? `${fmt(sPricePerKwh(s), 2)} ฿/kWh` : '—'}</div>
      </div>
    </button>
  );
}

export function AlertBanner({ item }) {
  const meta = ALERT_TYPES[item.type] || ALERT_TYPES.other;
  const cls = item.level === 'overdue' ? 'danger' : item.level === 'soon' ? 'warn' : '';
  const when =
    item.days < 0 ? `เลยกำหนดมาแล้ว ${Math.abs(item.days)} วัน`
    : item.days === 0 ? 'ครบกำหนดวันนี้'
    : `อีก ${item.days} วัน`;
  return (
    <div className={`alert ${cls}`.trim()}>
      <Icon name={item.level === 'ok' ? 'check' : 'alert'} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="t1">{item.title || meta.label} — {meta.label}</div>
        <div className="t2">{thDate(item.due, 'long')} · {when}</div>
      </div>
    </div>
  );
}

export function BudgetBanner({ over, budget, avg }) {
  const { t } = useStore();
  if (over) {
    return (
      <div className="alert danger">
        <Icon name="alert" />
        <div>
          <div className="t1">{t('ค่าใช้จ่ายเฉลี่ยต่อเดือนเกินงบประมาณ')}</div>
          <div className="t2">
            เฉลี่ย {money0(avg)} / เดือน · งบที่ตั้งไว้ {money0(budget)} · เกิน {money0(avg - budget)}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="alert">
      <Icon name="check" style={{ color: 'var(--accent)' }} />
      <div>
        <div className="t1">{t('ค่าใช้จ่ายอยู่ในงบประมาณ')}</div>
        <div className="t2">เฉลี่ย {money0(avg)} / เดือน · งบ {money0(budget)}</div>
      </div>
    </div>
  );
}

const Row = ({ k, children }) => (
  <>
    <dt>{k}</dt>
    <dd>{children}</dd>
  </>
);

export function SessionDetail({ session: s, onClose, onEdit }) {
  const { carName, confirm, deleteSession, setLightbox, toast, t } = useStore();
  const [imgs, setImgs] = useState([]);
  const ids = (s.images || []).join(',');

  useEffect(() => {
    let alive = true;
    imgMany(s.images || []).then((r) => { if (alive) setImgs(r); }).catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

  const dist = sDist(s);
  const soc = sSoc(s);
  const dash = sDashReading(s);

  return (
    <Modal
      wide
      title={`การชาร์จ ${thDate(s.date, 'long')}`}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="btn btn-danger left"
            onClick={() =>
              confirm('ลบรายการนี้', 'ลบการชาร์จรายการนี้ออกจากประวัติถาวร รวมถึงรูปที่แนบไว้', () => {
                deleteSession(s.id);
                toast('ลบรายการแล้ว');
                onClose();
              })
            }
          >
            <Icon name="trash" />{t('ลบ')}
          </button>
          <button type="button" className="btn" onClick={onClose}>{t('ปิด')}</button>
          <button type="button" className="btn btn-primary" onClick={onEdit}>
            <Icon name="edit" />{t('แก้ไข')}
          </button>
        </>
      }
    >
      <div className="form-grid" style={{ gap: 22 }}>
        <dl className="kv">
          <Row k="รถ">{carName(s.carId)}</Row>
          <Row k="วันที่ / เวลา">{thDate(s.date, 'long')}{s.time ? ` · ${s.time} น.` : ''}</Row>
          <Row k="ประเภท">{s.type === 'DC' ? 'DC (ชาร์จเร็ว)' : 'AC (ชาร์จปกติ)'}</Row>
          <Row k="สถานี / สถานที่">{s.station || '—'}</Row>
          <Row k="เวลาที่ใช้ในการชาร์จ">{fmtDuration(Number(s.durationSec))}</Row>
          <Row k="เลขไมล์ก่อน → หลัง">
            {isNum(s.odoBefore) && isNum(s.odoAfter)
              ? `${fmtDist(n(s.odoBefore))} → ${fmtDist(n(s.odoAfter))} km`
              : '—'}
          </Row>
          <Row k="ระยะทางที่วิ่งได้">{dist !== null ? `${fmtDist(dist)} km` : '—'}</Row>
          <Row k="SOC ก่อน → หลัง">
            {soc !== null ? `${n(s.socBefore)}% → ${n(s.socAfter)}% (+${soc}%)` : '—'}
          </Row>
        </dl>

        <dl className="kv">
          <Row k="พลังงานที่ชาร์จ">{fmt(n(s.kwh), 2)} kWh</Row>
          <Row k="ราคา / kWh ที่กรอก">{isNum(s.price) ? money(Number(s.price)) : '—'}</Row>
          <Row k="ค่าบริการเพิ่มเติม">{money(n(s.fee))}</Row>
          <Row k="ค่าใช้จ่ายรวม">{money(sTotal(s))}</Row>
          <Row k="ราคาจริงต่อ kWh">
            {sPricePerKwh(s) !== null ? `${fmt(sPricePerKwh(s), 2)} ฿/kWh` : '—'}
          </Row>
          <Row k="Efficiency">
            {sEff(s) !== null ? `${fmt(sEff(s), 2)} km/kWh · ${fmt0(sEff100(s))} km/100kWh` : '—'}
          </Row>
          <Row k="อัตราสิ้นเปลือง">{sKwh100(s) !== null ? `${fmt(sKwh100(s), 2)} kWh/100km` : '—'}</Row>
          <Row k="ค่าใช้จ่ายต่อระยะทาง">{sBahtKm(s) !== null ? `${fmt(sBahtKm(s), 2)} ฿/km` : '—'}</Row>
          <Row k="อ่านจากหน้าปัด">
            {dash
              ? `${fmt(dash.value, dash.unit === 'km/kWh' ? 2 : 0)} ${dash.unit}` +
                (dash.unit === 'km/kWh' ? '' : ` (${fmt(dash.base, 2)} km/kWh)`)
              : '—'}
          </Row>
        </dl>
      </div>

      {s.note ? (
        <div className="mt">
          <div className="sm faint" style={{ marginBottom: 4 }}>{t('หมายเหตุ')}</div>
          <p className="sm">{s.note}</p>
        </div>
      ) : null}

      {imgs.length ? (
        <div className="mt">
          <div className="sm faint" style={{ marginBottom: 8 }}>{t('รูปแนบ')}</div>
          <div className="thumbs">
            {imgs.map((r) => (
              <div className="thumb" key={r.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.dataUrl} alt={r.name || 'รูปแนบ'} onClick={() => setLightbox(r.dataUrl)} />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
