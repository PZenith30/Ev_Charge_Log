'use client';
/** ประวัติการชาร์จ — ค้นหา กรอง เรียงลำดับ ดูรายละเอียด แก้ไข และส่งออก CSV */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useStore } from '@/components/store';
import { EmptyState, Field, TypePill } from '@/components/ui';
import { SessionDetail } from '@/components/SessionViews';
import Icon from '@/components/Icon';
import { sBahtKm, sDist, sEff, sPricePerKwh, sSoc, sTotal, summarize } from '@/lib/calc';
import { fmt, fmt0, fmt1, fmtDist, isNum, money0, n, thDate, todayISO } from '@/lib/format';
import { download, sessionsToCsv } from '@/lib/exporters';
import { rangeText } from '@/lib/period';

const EMPTY_FILTERS = { q: '', type: '', cmin: '', cmax: '', sort: 'date-desc' };

const SORTERS = {
  'date-desc': (a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')),
  'date-asc': (a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')),
  'cost-desc': (a, b) => sTotal(b) - sTotal(a),
  'kwh-desc': (a, b) => n(b.kwh) - n(a.kwh),
  'eff-desc': (a, b) => (sEff(b) ?? -1) - (sEff(a) ?? -1),
};

export default function HistoryPage() {
  // ใช้ periodSessions ไม่ใช่ sessions — ช่วงเวลามาจากตัวเลือกบนแถบบนที่เดียว
  const { periodSessions, carName, setEditingId, toast, t, period, range } = useStore();
  const [f, setF] = useState(EMPTY_FILTERS);
  const [detail, setDetail] = useState(null);
  const router = useRouter();
  const set = (k, v) => setF((prev) => ({ ...prev, [k]: v }));

  const list = useMemo(() => {
    let out = periodSessions;
    const q = f.q.trim().toLowerCase();
    if (q) {
      out = out.filter((s) =>
        [s.station, s.note, s.date, thDate(s.date, 'long'), s.type]
          .filter(Boolean).join(' ').toLowerCase().includes(q)
      );
    }
    if (f.type) out = out.filter((s) => (s.type || 'AC') === f.type);
    if (isNum(f.cmin)) out = out.filter((s) => sTotal(s) >= Number(f.cmin));
    if (isNum(f.cmax)) out = out.filter((s) => sTotal(s) <= Number(f.cmax));
    return out.slice().sort(SORTERS[f.sort]);
  }, [periodSessions, f]);

  const sum = useMemo(() => summarize(list), [list]);

  function exportCsv() {
    if (!list.length) return toast('ไม่มีรายการให้ส่งออก', true);
    download(`ev-charge-history-${todayISO()}.csv`, sessionsToCsv(list, carName), 'text/csv;charset=utf-8');
    toast(`ส่งออก ${list.length} รายการแล้ว`);
  }

  function edit(id) {
    setEditingId(id);
    router.push('/add');
  }

  return (
    <>
      <div className="card">
        <div className="filters">
          <Field label={t('ค้นหา')} style={{ gridColumn: 'span 2' }}>
            <input type="text" placeholder={t('สถานี, หมายเหตุ, วันที่…')} spellCheck={false}
              value={f.q} onChange={(e) => set('q', e.target.value)} />
          </Field>
          <Field label={t('ประเภท')}>
            <select value={f.type} onChange={(e) => set('type', e.target.value)}>
              <option value="">{t('ทั้งหมด')}</option>
              <option value="AC">AC</option>
              <option value="DC">DC</option>
            </select>
          </Field>
          <Field label={t('ค่าใช้จ่ายต่ำสุด')}>
            <input type="number" min="0" step="any" inputMode="decimal" placeholder="0"
              value={f.cmin} onChange={(e) => set('cmin', e.target.value)} />
          </Field>
          <Field label={t('ค่าใช้จ่ายสูงสุด')}>
            <input type="number" min="0" step="any" inputMode="decimal" placeholder={t('ไม่จำกัด')}
              value={f.cmax} onChange={(e) => set('cmax', e.target.value)} />
          </Field>
          <Field label={t('เรียงตาม')}>
            <select value={f.sort} onChange={(e) => set('sort', e.target.value)}>
              <option value="date-desc">{t('วันที่ ล่าสุด → เก่า')}</option>
              <option value="date-asc">{t('วันที่ เก่า → ล่าสุด')}</option>
              <option value="cost-desc">{t('ค่าใช้จ่าย มาก → น้อย')}</option>
              <option value="kwh-desc">{t('พลังงาน มาก → น้อย')}</option>
              <option value="eff-desc">{t('Efficiency ดี → แย่')}</option>
            </select>
          </Field>
        </div>

        <div className="card-head">
          <h3>
            {fmt0(list.length)} {t('รายการ')}
            <span className="hint">
              {t('ช่วง{range} — เปลี่ยนได้ที่แถบด้านบน', { range: rangeText(period.key, range) })} · 
              {fmt1(sum.kwh)} kWh · {money0(sum.cost)} · {fmtDist(sum.dist)} km
            </span>
          </h3>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setF(EMPTY_FILTERS)}>
            {t('ล้างตัวกรอง')}
          </button>
          <button type="button" className="btn btn-sm" onClick={exportCsv}>
            <Icon name="download" />CSV
          </button>
        </div>

        {list.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('วันที่ / เวลา')}</th>
                  <th>{t('ประเภท')}</th>
                  <th>{t('สถานี')}</th>
                  <th className="num">kWh</th>
                  <th className="num">{t('฿/kWh')}</th>
                  <th className="num">{t('รวม (฿)')}</th>
                  <th className="num">{t('ระยะทาง')}</th>
                  <th className="num">SOC</th>
                  <th className="num">km/kWh</th>
                  <th className="num">{t('฿/km')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((s) => {
                  const dist = sDist(s);
                  const eff = sEff(s);
                  const bk = sBahtKm(s);
                  const pk = sPricePerKwh(s);
                  const soc = sSoc(s);
                  return (
                    <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => setDetail(s)}>
                      <td>{thDate(s.date)} {s.time ? <span className="faint">{s.time}</span> : null}</td>
                      <td><TypePill type={s.type} /></td>
                      <td>
                        {s.station || '—'}
                        {s.images?.length ? <span className="faint" title={t('มีรูปแนบ')}> 🖼</span> : null}
                      </td>
                      <td className="num">{fmt(n(s.kwh), 2)}</td>
                      <td className="num">{pk !== null ? fmt(pk, 2) : '—'}</td>
                      <td className="num"><b>{fmt(sTotal(s), 2)}</b></td>
                      <td className="num">{dist !== null ? fmtDist(dist) : '—'}</td>
                      <td className="num">{soc !== null ? `${n(s.socBefore)}→${n(s.socAfter)}%` : '—'}</td>
                      <td className="num">{eff !== null ? fmt(eff, 2) : '—'}</td>
                      <td className="num">{bk !== null ? fmt(bk, 2) : '—'}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-icon btn-ghost btn-sm"
                          title={t('แก้ไข')}
                          onClick={(e) => { e.stopPropagation(); edit(s.id); }}
                        >
                          <Icon name="edit" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>รวม {list.length} รายการ</td>
                  <td className="num">{fmt(sum.kwh, 2)}</td>
                  <td className="num">{sum.avgPrice !== null ? fmt(sum.avgPrice, 2) : '—'}</td>
                  <td className="num">{fmt(sum.cost, 2)}</td>
                  <td className="num">{fmtDist(sum.dist)}</td>
                  <td />
                  <td className="num">{sum.eff !== null ? fmt(sum.eff, 2) : '—'}</td>
                  <td className="num">{sum.bahtKm !== null ? fmt(sum.bahtKm, 2) : '—'}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <EmptyState
            message={sessions.length ? 'ไม่พบรายการที่ตรงกับตัวกรอง' : 'ยังไม่มีประวัติการชาร์จ'}
            action={
              sessions.length ? null : (
                <Link href="/add" className="btn btn-primary btn-sm">{t('บันทึกการชาร์จครั้งแรก')}</Link>
              )
            }
          />
        )}
      </div>

      {detail ? (
        <SessionDetail
          session={detail}
          onClose={() => setDetail(null)}
          onEdit={() => { const id = detail.id; setDetail(null); edit(id); }}
        />
      ) : null}
    </>
  );
}
