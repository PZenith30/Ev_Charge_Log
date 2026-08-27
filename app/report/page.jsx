'use client';
/** รายงานสรุปรายเดือน / รายปี — ดูบนหน้าจอ ส่งออก CSV หรือสั่งพิมพ์เป็น PDF */
import { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/components/store';
import { EmptyState, Stat, TypePill } from '@/components/ui';
import { BarChart, DonutChart } from '@/components/Charts';
import Icon from '@/components/Icon';
import { COST_CATS } from '@/lib/data';
import { monthlyTotals, sBahtKm, sDist, sEff, sPricePerKwh, sTotal, sMonth, sYear, summarize } from '@/lib/calc';
import { fmt, fmt0, fmt1, fmtDist, fmtDuration, money, money0, n, shortNum, thDate, thMonthLong, thYear, todayISO } from '@/lib/format';
import { download, sessionsToCsv } from '@/lib/exporters';

export default function ReportPage() {
  const { sessions, costs, activeCar, showAllCars, carName, toast } = useStore();
  const [mode, setMode] = useState('month');
  const [period, setPeriod] = useState('');

  const periods = useMemo(() => {
    const set = new Set();
    sessions.forEach((s) => set.add(mode === 'year' ? sYear(s) : sMonth(s)));
    costs.forEach((c) => set.add((c.date || '').slice(0, mode === 'year' ? 4 : 7)));
    return Array.from(set).filter(Boolean).sort().reverse();
  }, [sessions, costs, mode]);

  useEffect(() => {
    if (!periods.includes(period)) setPeriod(periods[0] || '');
  }, [periods, period]);

  const inPeriod = (d) => (d || '').startsWith(period);
  const sList = useMemo(
    () => sessions.filter((s) => inPeriod(s.date)).slice().sort((a, b) => a.date.localeCompare(b.date)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessions, period]
  );
  const cList = useMemo(
    () => costs.filter((c) => inPeriod(c.date)).slice().sort((a, b) => a.date.localeCompare(b.date)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [costs, period]
  );

  const sum = useMemo(() => summarize(sList), [sList]);
  const otherTotal = cList.reduce((a, c) => a + n(c.amount), 0);
  const byCat = useMemo(() => {
    const m = {};
    cList.forEach((c) => { m[c.cat] = (m[c.cat] || 0) + n(c.amount); });
    return m;
  }, [cList]);
  const monthRows = useMemo(
    () => (mode === 'year' ? monthlyTotals(sList, cList) : []),
    [mode, sList, cList]
  );

  function exportCsv() {
    if (!sList.length) return toast('ไม่มีรายการชาร์จในงวดนี้', true);
    download(`ev-report-${period}.csv`, sessionsToCsv(sList, carName), 'text/csv;charset=utf-8');
    toast('ส่งออกรายงานเป็น CSV แล้ว');
  }

  const controls = (
    <div className="card no-print">
      <div className="card-head">
        <h3>สร้างรายงาน</h3>
        <select value={mode} onChange={(e) => setMode(e.target.value)}
          style={{ width: 'auto', fontSize: 13.5, padding: '6px 30px 6px 10px' }}>
          <option value="month">รายเดือน</option>
          <option value="year">รายปี</option>
        </select>
        <select value={period} onChange={(e) => setPeriod(e.target.value)}
          style={{ width: 'auto', fontSize: 13.5, padding: '6px 30px 6px 10px' }}>
          {periods.length ? (
            periods.map((p) => (
              <option key={p} value={p}>{mode === 'year' ? `ปี ${thYear(p)}` : thMonthLong(p)}</option>
            ))
          ) : (
            <option value="">— ไม่มีข้อมูล —</option>
          )}
        </select>
        <button type="button" className="btn btn-sm" onClick={exportCsv}>
          <Icon name="download" />CSV
        </button>
        <button type="button" className="btn btn-sm btn-primary" onClick={() => window.print()}>
          <Icon name="print" />พิมพ์ / บันทึก PDF
        </button>
      </div>
    </div>
  );

  if (!period) {
    return (
      <>
        {controls}
        <div className="card mt">
          <EmptyState message="ยังไม่มีข้อมูลสำหรับสร้างรายงาน" />
        </div>
      </>
    );
  }

  const title = mode === 'year' ? `รายงานประจำปี ${thYear(period)}` : `รายงานประจำเดือน ${thMonthLong(period)}`;
  const carLabel = showAllCars || !activeCar
    ? 'รถทุกคัน'
    : `${activeCar.name}${activeCar.brand ? ` · ${activeCar.brand} ${activeCar.model || ''}` : ''}`;

  return (
    <>
      {controls}

      <div className="card mt">
        <div className="card-body">
          <div className="report-head">
            <div style={{ flex: 1, minWidth: 200 }}>
              <h3 style={{ fontSize: 18 }}>EV Charge Log — {title}</h3>
              <p className="sm faint" style={{ marginTop: 4 }}>
                {carLabel} · ออกรายงานเมื่อ {thDate(todayISO(), 'long')}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="faint sm">ต้นทุนรวมในงวด</div>
              <div style={{ fontSize: 24, fontWeight: 680, letterSpacing: '-.02em' }}>
                {money0(sum.cost + otherTotal)}
              </div>
            </div>
          </div>

          <div className="stats">
            <Stat icon="bolt" label="จำนวนครั้ง" value={fmt0(sum.count)} unit="ครั้ง"
              detail={`AC ${sum.ac} · DC ${sum.dc}`} />
            <Stat icon="battery" label="พลังงาน" value={fmt1(sum.kwh)} unit="kWh"
              detail={sum.avgPrice !== null ? `เฉลี่ย ${fmt(sum.avgPrice, 2)} ฿/kWh` : null} />
            <Stat icon="road" label="ระยะทาง" value={fmtDist(sum.dist)} unit="km"
              detail={sum.eff !== null ? `${fmt(sum.eff, 2)} km/kWh · ${fmt0(sum.eff100)} km/100kWh` : null} />
            <Stat icon="coin" label="ค่าชาร์จ" value={money0(sum.cost)}
              detail={sum.bahtKm !== null ? `${fmt(sum.bahtKm, 2)} ฿/km` : null} />
            <Stat icon="wallet" label="ต้นทุนอื่น" value={money0(otherTotal)} detail={`${cList.length} รายการ`} />
            <Stat icon="clock" label="เวลาชาร์จรวม" value={fmt1(sum.seconds / 3600)} unit="ชม."
              detail={sum.seconds > 0 ? fmtDuration(sum.seconds) : 'ยังไม่ได้กรอกเวลาที่ใช้ชาร์จ'} />
          </div>
        </div>
      </div>

      {mode === 'year' && monthRows.length ? (
        <div className="card mt">
          <div className="card-head"><h3>สรุปรายเดือน</h3></div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>เดือน</th><th className="num">ครั้ง</th><th className="num">kWh</th>
                  <th className="num">ระยะทาง (km)</th><th className="num">km/kWh</th>
                  <th className="num">ค่าชาร์จ</th><th className="num">ต้นทุนอื่น</th><th className="num">รวม</th>
                </tr>
              </thead>
              <tbody>
                {monthRows.map(([k, v]) => (
                  <tr key={k}>
                    <td>{thMonthLong(k)}</td>
                    <td className="num">{v.count}</td>
                    <td className="num">{fmt1(v.kwh)}</td>
                    <td className="num">{fmtDist(v.dist)}</td>
                    <td className="num">{v.kwh > 0 && v.dist > 0 ? fmt(v.dist / v.kwh, 2) : '—'}</td>
                    <td className="num">{fmt(v.charge, 2)}</td>
                    <td className="num">{fmt(v.other, 2)}</td>
                    <td className="num"><b>{fmt(v.charge + v.other, 2)}</b></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>รวมทั้งปี</td>
                  <td className="num">{sum.count}</td>
                  <td className="num">{fmt1(sum.kwh)}</td>
                  <td className="num">{fmtDist(sum.dist)}</td>
                  <td className="num">{sum.eff !== null ? fmt(sum.eff, 2) : '—'}</td>
                  <td className="num">{fmt(sum.cost, 2)}</td>
                  <td className="num">{fmt(otherTotal, 2)}</td>
                  <td className="num">{fmt(sum.cost + otherTotal, 2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : null}

      <div className="card mt">
        <div className="card-head">
          <h3>รายการชาร์จในงวด<span className="hint">{sList.length} รายการ</span></h3>
        </div>
        {sList.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>วันที่</th><th>ประเภท</th><th>สถานี</th>
                  <th className="num">kWh</th><th className="num">฿/kWh</th><th className="num">ระยะทาง</th>
                  <th className="num">km/kWh</th><th className="num">฿/km</th><th className="num">รวม (฿)</th>
                </tr>
              </thead>
              <tbody>
                {sList.map((s) => (
                  <tr key={s.id}>
                    <td>{thDate(s.date)}</td>
                    <td><TypePill type={s.type} /></td>
                    <td>{s.station || '—'}</td>
                    <td className="num">{fmt(n(s.kwh), 2)}</td>
                    <td className="num">{sPricePerKwh(s) !== null ? fmt(sPricePerKwh(s), 2) : '—'}</td>
                    <td className="num">{sDist(s) !== null ? fmtDist(sDist(s)) : '—'}</td>
                    <td className="num">{sEff(s) !== null ? fmt(sEff(s), 2) : '—'}</td>
                    <td className="num">{sBahtKm(s) !== null ? fmt(sBahtKm(s), 2) : '—'}</td>
                    <td className="num"><b>{fmt(sTotal(s), 2)}</b></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>รวม</td>
                  <td className="num">{fmt(sum.kwh, 2)}</td>
                  <td className="num">{sum.avgPrice !== null ? fmt(sum.avgPrice, 2) : '—'}</td>
                  <td className="num">{fmtDist(sum.dist)}</td>
                  <td className="num">{sum.eff !== null ? fmt(sum.eff, 2) : '—'}</td>
                  <td className="num">{sum.bahtKm !== null ? fmt(sum.bahtKm, 2) : '—'}</td>
                  <td className="num">{fmt(sum.cost, 2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="card-body"><p className="sm faint">ไม่มีการชาร์จในงวดนี้</p></div>
        )}
      </div>

      <div className="card mt">
        <div className="card-head"><h3>ต้นทุนอื่นในงวด</h3></div>
        {cList.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>วันที่</th><th>ประเภท</th><th>รายละเอียด</th><th className="num">จำนวนเงิน (฿)</th></tr>
              </thead>
              <tbody>
                {cList.map((c) => (
                  <tr key={c.id}>
                    <td>{thDate(c.date)}</td>
                    <td>{(COST_CATS[c.cat] || COST_CATS.other).label}</td>
                    <td>{c.note || '—'}</td>
                    <td className="num">{fmt(n(c.amount), 2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={3}>รวม</td><td className="num">{fmt(otherTotal, 2)}</td></tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="card-body"><p className="sm faint">ไม่มีต้นทุนอื่นในงวดนี้</p></div>
        )}
      </div>

      <div className="charts">
        <div className="card">
          <div className="card-head"><h3>พลังงานที่ชาร์จในงวด</h3></div>
          <div className="card-body">
            <BarChart
              stacked
              labels={sList.map((s) => thDate(s.date))}
              series={[
                { name: 'AC', color: 'var(--ac)', values: sList.map((s) => (s.type === 'DC' ? 0 : n(s.kwh))) },
                { name: 'DC', color: 'var(--dc)', values: sList.map((s) => (s.type === 'DC' ? n(s.kwh) : 0)) },
              ]}
              tip={(i) => (
                <>
                  <b>{thDate(sList[i].date, 'long')}</b><br />
                  {fmt1(n(sList[i].kwh))} kWh · {money(sTotal(sList[i]))}
                </>
              )}
              empty="ไม่มีการชาร์จในงวดนี้"
            />
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h3>สัดส่วนต้นทุน</h3></div>
          <div className="card-body">
            <DonutChart
              unit="฿"
              center={shortNum(sum.cost + otherTotal)}
              sub="บาทรวม"
              slices={[
                { label: 'ค่าชาร์จ', value: sum.cost, color: 'var(--accent)' },
                ...Object.entries(COST_CATS).map(([k, v]) => ({
                  label: v.label, value: byCat[k] || 0, color: v.color,
                })),
              ]}
              empty="ไม่มีค่าใช้จ่ายในงวดนี้"
            />
          </div>
        </div>
      </div>
    </>
  );
}
