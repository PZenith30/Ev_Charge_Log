'use client';
/** แดชบอร์ด — ภาพรวมการชาร์จ ค่าใช้จ่าย และประสิทธิภาพทั้งหมด */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useStore } from '@/components/store';
import { Stat, EmptyState } from '@/components/ui';
import { BarChart, DonutChart, LineChart } from '@/components/Charts';
import { AlertBanner, BudgetBanner, SessionDetail, SessionRow } from '@/components/SessionViews';
import { monthlyTotals, sDist, sEff, sKwh100, sTotal, summarize } from '@/lib/calc';
import { fmt, fmt0, fmt1, isNum, money, money0, n, thDate, thMonth, thMonthLong } from '@/lib/format';

export default function DashboardPage() {
  const { sessions, costs, due, budgetOver, setEditingId } = useStore();
  const [detail, setDetail] = useState(null);
  const router = useRouter();

  const sum = useMemo(() => summarize(sessions), [sessions]);
  const otherCost = useMemo(() => costs.reduce((a, c) => a + n(c.amount), 0), [costs]);
  const months = useMemo(() => monthlyTotals(sessions, costs), [sessions, costs]);
  const monthCount = months.length || 1;

  const recentAsc = useMemo(() => sessions.slice(0, 24).reverse(), [sessions]);
  const effPoints = useMemo(
    () => sessions.filter((s) => sEff(s) !== null).slice(0, 30).reverse(),
    [sessions]
  );
  const effAvg = effPoints.length
    ? effPoints.reduce((a, s) => a + sEff(s), 0) / effPoints.length
    : NaN;

  const monthsShown = months.slice(-12);
  const activeDue = due.filter((a) => a.level !== 'ok').slice(0, 3);

  const chargeTip = (list) => (i) => {
    const s = list[i];
    if (!s) return null;
    return (
      <>
        <b>{thDate(s.date, 'long')}</b>
        <br />
        {s.type === 'DC' ? 'DC' : 'AC'} · {fmt1(n(s.kwh))} kWh · {money(sTotal(s))}
        {sDist(s) !== null ? (<><br />{fmt0(sDist(s))} km · {fmt(sEff(s), 2)} km/kWh</>) : null}
        {s.station ? (<><br />{s.station}</>) : null}
      </>
    );
  };

  if (!sessions.length && !costs.length) {
    return (
      <div className="card">
        <EmptyState
          message="ยังไม่มีข้อมูล — เริ่มจากเพิ่มรถของคุณ แล้วบันทึกการชาร์จครั้งแรก"
          action={
            <div className="rowflex" style={{ justifyContent: 'center' }}>
              <Link href="/account" className="btn btn-sm">เพิ่มรถ</Link>
              <Link href="/add" className="btn btn-primary btn-sm">บันทึกการชาร์จ</Link>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <>
      {budgetOver || activeDue.length ? (
        <div className="stack" style={{ marginBottom: 14 }}>
          {budgetOver ? <BudgetBanner over budget={budgetOver.budget} avg={budgetOver.avg} /> : null}
          {activeDue.map((a) => <AlertBanner key={a.id} item={a} />)}
        </div>
      ) : null}

      <div className="stats">
        <Stat icon="bolt" label="จำนวนครั้งที่ชาร์จ" value={fmt0(sum.count)} unit="ครั้ง"
          detail={sum.count ? `AC ${sum.ac} · DC ${sum.dc}` : null} />
        <Stat icon="battery" label="พลังงานสะสม" value={fmt1(sum.kwh)} unit="kWh"
          detail={sum.count ? `เฉลี่ย ${fmt1(sum.kwh / sum.count)} kWh/ครั้ง` : null} />
        <Stat icon="road" label="ระยะทางสะสม" value={fmt0(sum.dist)} unit="km"
          detail={sum.count ? `เฉลี่ย ${fmt0(sum.dist / sum.count)} km/ครั้ง` : null} />
        <Stat icon="coin" label="ค่าชาร์จสะสม" value={money0(sum.cost)}
          detail={`+ ต้นทุนอื่น ${money0(otherCost)} = ${money0(sum.cost + otherCost)}`} />
        <Stat icon="gauge" label="Efficiency เฉลี่ย"
          value={sum.eff !== null ? fmt(sum.eff, 2) : '—'} unit="km/kWh"
          detail={sum.eff !== null
            ? `${fmt0(sum.eff100)} km/100kWh · ${fmt(sum.kwh100, 1)} kWh/100km`
            : 'ต้องกรอกเลขไมล์ก่อน/หลังชาร์จ'} />
        <Stat icon="road" label="ค่าใช้จ่ายต่อระยะทาง"
          value={sum.bahtKm !== null ? fmt(sum.bahtKm, 2) : '—'} unit="฿/km"
          detail={sum.dist > 0 ? `รวมต้นทุนอื่น ${fmt((sum.cost + otherCost) / sum.dist, 2)} ฿/km` : null} />
        <Stat icon="wallet" label="ค่าใช้จ่ายเฉลี่ย/เดือน"
          value={money0((sum.cost + otherCost) / monthCount)}
          detail={`จากข้อมูล ${monthCount} เดือน`} />
        <Stat icon="coin" label="ราคาเฉลี่ย"
          value={sum.avgPrice !== null ? fmt(sum.avgPrice, 2) : '—'} unit="฿/kWh"
          detail={[
            sum.acPrice !== null ? `AC ${fmt(sum.acPrice, 2)}` : null,
            sum.dcPrice !== null ? `DC ${fmt(sum.dcPrice, 2)}` : null,
          ].filter(Boolean).join(' · ')} />
      </div>

      <div className="charts">
        <div className="card">
          <div className="card-head">
            <h3>พลังงานที่ชาร์จแต่ละครั้ง<span className="hint">หน่วย kWh · แยกสี AC / DC</span></h3>
          </div>
          <div className="card-body">
            <BarChart
              stacked
              labels={recentAsc.map((s) => thDate(s.date))}
              series={[
                { name: 'AC', color: 'var(--ac)', values: recentAsc.map((s) => (s.type === 'DC' ? 0 : n(s.kwh))) },
                { name: 'DC', color: 'var(--dc)', values: recentAsc.map((s) => (s.type === 'DC' ? n(s.kwh) : 0)) },
              ]}
              tip={chargeTip(recentAsc)}
              empty="ยังไม่มีการชาร์จที่บันทึกไว้"
            />
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>ค่าใช้จ่ายต่อครั้ง<span className="hint">รวมค่าบริการเพิ่มเติมแล้ว</span></h3>
          </div>
          <div className="card-body">
            <BarChart
              stacked
              labels={recentAsc.map((s) => thDate(s.date))}
              series={[
                { name: 'AC', color: 'var(--ac)', values: recentAsc.map((s) => (s.type === 'DC' ? 0 : sTotal(s))) },
                { name: 'DC', color: 'var(--dc)', values: recentAsc.map((s) => (s.type === 'DC' ? sTotal(s) : 0)) },
              ]}
              tip={chargeTip(recentAsc)}
              empty="ยังไม่มีการชาร์จที่บันทึกไว้"
            />
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h3>เปรียบเทียบ AC / DC</h3></div>
          <div className="card-body">
            <DonutChart
              center={fmt0(sum.kwh)}
              sub="kWh รวม"
              slices={[
                { label: 'AC', value: sum.acKwh, color: 'var(--ac)' },
                { label: 'DC', value: sum.dcKwh, color: 'var(--dc)' },
              ]}
              empty="ยังไม่มีการชาร์จที่บันทึกไว้"
            />
            {sum.count ? (
              <table className="compact" style={{ marginTop: 14 }}>
                <thead>
                  <tr>
                    <th />
                    <th className="num" style={{ color: 'var(--ac)' }}>AC</th>
                    <th className="num" style={{ color: 'var(--dc)' }}>DC</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td className="muted">จำนวนครั้ง</td><td className="num">{sum.ac} ครั้ง</td><td className="num">{sum.dc} ครั้ง</td></tr>
                  <tr><td className="muted">พลังงาน</td><td className="num">{fmt1(sum.acKwh)} kWh</td><td className="num">{fmt1(sum.dcKwh)} kWh</td></tr>
                  <tr><td className="muted">ค่าใช้จ่าย</td><td className="num">{money0(sum.acCost)}</td><td className="num">{money0(sum.dcCost)}</td></tr>
                  <tr>
                    <td className="muted">ราคาเฉลี่ย</td>
                    <td className="num">{sum.acPrice !== null ? `${fmt(sum.acPrice, 2)} ฿/kWh` : '—'}</td>
                    <td className="num">{sum.dcPrice !== null ? `${fmt(sum.dcPrice, 2)} ฿/kWh` : '—'}</td>
                  </tr>
                </tbody>
              </table>
            ) : null}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>ค่าใช้จ่ายรายเดือน<span className="hint">ค่าชาร์จ + ต้นทุนอื่นของรถ</span></h3>
          </div>
          <div className="card-body">
            <BarChart
              stacked
              labels={monthsShown.map(([k]) => thMonth(k))}
              series={[
                { name: 'ค่าชาร์จ', color: 'var(--accent)', values: monthsShown.map(([, v]) => v.charge) },
                { name: 'ต้นทุนอื่น', color: 'var(--dc)', values: monthsShown.map(([, v]) => v.other) },
              ]}
              tip={(i) => {
                const [k, v] = monthsShown[i];
                return (
                  <>
                    <b>{thMonthLong(k)}</b><br />
                    ค่าชาร์จ {money(v.charge)}<br />
                    ต้นทุนอื่น {money(v.other)}<br />
                    รวม {money(v.charge + v.other)}<br />
                    {v.count} ครั้ง · {fmt1(v.kwh)} kWh
                  </>
                );
              }}
              empty="ยังไม่มีข้อมูลรายเดือน"
            />
          </div>
        </div>

        <div className="card span2">
          <div className="card-head">
            <h3>แนวโน้มอัตราสิ้นเปลือง<span className="hint">คำนวณจากระยะทาง ÷ พลังงานที่ชาร์จ (km/kWh)</span></h3>
          </div>
          <div className="card-body">
            <LineChart
              labels={effPoints.map((s) => thDate(s.date))}
              values={effPoints.map((s) => sEff(s))}
              color="var(--accent)"
              avg={effAvg}
              avgLabel={effPoints.length ? `ค่าเฉลี่ย ${fmt(effAvg, 2)} km/kWh` : null}
              legend="km/kWh ต่อครั้ง"
              empty="ต้องมีเลขไมล์ก่อน/หลังชาร์จอย่างน้อย 2 ครั้ง จึงจะคำนวณแนวโน้มได้"
              tip={(i) => {
                const s = effPoints[i];
                return (
                  <>
                    <b>{thDate(s.date, 'long')}</b><br />
                    {fmt(sEff(s), 2)} km/kWh · {fmt(sKwh100(s), 1)} kWh/100km<br />
                    {fmt0(sDist(s))} km / {fmt1(n(s.kwh))} kWh
                    {isNum(s.dashEff) ? (<><br />หน้าปัด {fmt(Number(s.dashEff), 2)} km/kWh</>) : null}
                  </>
                );
              }}
            />
          </div>
        </div>
      </div>

      <div className="card mt">
        <div className="card-head">
          <h3>การชาร์จล่าสุด</h3>
          <Link href="/history" className="btn btn-sm btn-ghost">ดูทั้งหมด</Link>
        </div>
        <div className="rows">
          {sessions.slice(0, 6).map((s) => (
            <SessionRow key={s.id} session={s} onClick={() => setDetail(s)} />
          ))}
          {!sessions.length ? (
            <EmptyState
              message="ยังไม่มีการชาร์จที่บันทึกไว้"
              action={<Link href="/add" className="btn btn-primary btn-sm">บันทึกการชาร์จครั้งแรก</Link>}
            />
          ) : null}
        </div>
      </div>

      {detail ? (
        <SessionDetail
          session={detail}
          onClose={() => setDetail(null)}
          onEdit={() => {
            setEditingId(detail.id);
            setDetail(null);
            router.push('/add');
          }}
        />
      ) : null}
    </>
  );
}
