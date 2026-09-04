'use client';
/** แดชบอร์ด — ภาพรวมตามช่วงเวลาที่เลือกบนแถบบน */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useStore } from '@/components/store';
import { Stat, EmptyState, Trend, TypePill } from '@/components/ui';
import { BarChart, DonutChart, LineChart, Sparkline } from '@/components/Charts';
import { AlertBanner, BudgetBanner, IncompleteBanner, SessionDetail } from '@/components/SessionViews';
import CarPhoto from '@/components/CarPhoto';
import Wordmark from '@/components/Wordmark';
import Icon from '@/components/Icon';
import {
  groupStations, monthlyTotals, sDist, sEff, sKwh100, sPricePerKwh, sTotal, summarize,
} from '@/lib/calc';
import { isSessionComplete } from '@/lib/validate';
import { comparisonLabel, pctChange } from '@/lib/period';
import { fmt, fmt0, fmt1, fmtDist, isNum, money, money0, n, thDate, thMonth, thMonthLong } from '@/lib/format';

const STATION_COLORS = ['var(--accent)', 'var(--dc)', 'var(--purple)', 'var(--warn)', 'var(--faint)'];

/**
 * หนึ่งแถวในรายการสถานีที่ใช้บ่อย — กดแล้วกางดูรายละเอียดของสถานีนั้นได้
 *
 * ตอนกาง บรรทัดสรุปสั้นๆ จะหายไป เพราะแผงที่กางออกมามีตัวเลขชุดเดียวกันแบบละเอียดกว่า
 * ถ้าปล่อยไว้ทั้งคู่จะเป็นตัวเลขซ้ำสองที่และแถวสูงเกินจำเป็น
 */
function StationRow({ station: g, index, color, open, onToggle, onEdit }) {
  const { t } = useStore();
  const panelId = `station-panel-${index}`;
  const avgPrice = g.kwh > 0 ? g.cost / g.kwh : null;

  return (
    <div className={`station-row${open ? ' open' : ''}`}>
      {/* ทั้งแถวเป็นปุ่มเดียว จะได้กดตรงไหนก็กางได้ ไม่ต้องเล็งเฉพาะตัวหนังสือ
          และได้การใช้คีย์บอร์ดกับ aria-expanded มาในตัวโดยไม่ต้องเขียนเอง */}
      <button
        type="button"
        className="station-main"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
      >
        <span className="station-pin" style={{ background: color }}>{index + 1}</span>
        <div className="body">
          <div className="t1">{g.name}</div>
          {open ? null : (
            <>
              <div className="t2">{g.count} {t('ครั้ง')} · {fmt1(g.kwh)} kWh · {money0(g.cost)}</div>
              <div className="t3">
                <Icon name="bolt" viewBox="0 0 32 32" style={{ fill: 'currentColor', stroke: 'none' }} />
                {g.ac ? `AC ${g.ac}` : ''}{g.ac && g.dc ? ' · ' : ''}{g.dc ? `DC ${g.dc}` : ''}
                {avgPrice !== null ? ` · ${t('เฉลี่ย')} ${fmt(avgPrice, 2)} ฿/kWh` : ''}
              </div>
            </>
          )}
        </div>
        <Icon name="chevron-down" className="chev" />
      </button>

      {open ? (
        <div className="station-panel" id={panelId}>
          <div className="st-mini">
            <div><span>{t('จำนวนครั้ง')}</span><b>{g.count}</b></div>
            <div><span>{t('พลังงานรวม')}</span><b>{fmt1(g.kwh)} kWh</b></div>
            <div><span>{t('ค่าใช้จ่ายรวม')}</span><b>{money0(g.cost)}</b></div>
            <div><span>{t('เฉลี่ยต่อครั้ง')}</span><b>{money0(g.cost / g.count)}</b></div>
            <div><span>{t('ราคาเฉลี่ย')}</span><b>{avgPrice !== null ? `${fmt(avgPrice, 2)} ฿/kWh` : '—'}</b></div>
            <div><span>AC / DC</span><b>{g.ac} / {g.dc}</b></div>
          </div>

          <div className="st-sess-head">
            <span>{t('รายการชาร์จที่นี่')}</span>
            <span>{t('แตะเพื่อแก้ไข')}</span>
          </div>
          {/* รายการยาวได้ไม่จำกัด จึงให้เลื่อนในกรอบตัวเองแทนที่จะดันการ์ดยาวลงไปเรื่อยๆ */}
          <div className="st-sess">
            {g.items.map((s) => (
              <button type="button" key={s.id} onClick={() => onEdit(s.id)} title={t('แก้ไขรายการนี้')}>
                <span className="d">{thDate(s.date)}</span>
                <TypePill type={s.type} />
                <span className="k">{fmt(n(s.kwh), 2)} kWh</span>
                <span className="c">{money0(sTotal(s))}</span>
                <Icon name="edit" />
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** รวมพลังงาน/ค่าใช้จ่ายเป็นรายวัน สำหรับกราฟช่วงสั้น */
function dailyTotals(list) {
  const map = new Map();
  for (const s of list) {
    if (!s.date) continue;
    if (!map.has(s.date)) map.set(s.date, { kwh: 0, cost: 0, count: 0 });
    const d = map.get(s.date);
    d.kwh += n(s.kwh);
    d.cost += sTotal(s);
    d.count += 1;
  }
  return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

export default function DashboardPage() {
  const {
    sessions, costs, periodSessions, periodCosts, prevSessions, prevCosts,
    period, activeCar, due, budgetOver, setEditingId, incomplete, t
  } = useStore();
  const [detail, setDetail] = useState(null);
  const [grain, setGrain] = useState('day');
  // ชื่อสถานีที่กางรายละเอียดอยู่ (null = ไม่ได้กางอันไหน)
  const [openStation, setOpenStation] = useState(null);
  const router = useRouter();

  const sum = useMemo(() => summarize(periodSessions), [periodSessions]);
  const prev = useMemo(() => summarize(prevSessions), [prevSessions]);
  const otherCost = useMemo(() => periodCosts.reduce((a, c) => a + n(c.amount), 0), [periodCosts]);
  const prevOtherCost = useMemo(() => prevCosts.reduce((a, c) => a + n(c.amount), 0), [prevCosts]);

  const asc = useMemo(() => periodSessions.slice().reverse(), [periodSessions]);
  const days = useMemo(() => dailyTotals(periodSessions), [periodSessions]);
  const months = useMemo(() => monthlyTotals(periodSessions, periodCosts), [periodSessions, periodCosts]);
  const stations = useMemo(() => groupStations(periodSessions), [periodSessions]);
  const cmpLabel = comparisonLabel(period.key);

  /**
   * ช่วง "ทั้งหมด" ไม่มีช่วงก่อนหน้าให้เทียบตามนิยาม
   * ถ้าปล่อยให้ <Trend> ทำงานตามปกติ การ์ดสรุปทั้งสี่ใบจะขึ้น "เทียบไม่ได้" พร้อมกัน
   * ซึ่งเป็นค่าเริ่มต้นที่ทุกคนเห็นตอนเปิดแดชบอร์ด จึงบอกขอบเขตข้อมูลแทนว่าย้อนไปถึงเมื่อไหร่
   */
  const allTime = period.key === 'all';
  const firstDate = useMemo(() => {
    const dates = [...sessions, ...costs].map((x) => x.date).filter(Boolean);
    return dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : null;
  }, [sessions, costs]);
  const trend = (current, previous, invert = false) =>
    allTime ? (
      <span className="faint">
        {firstDate ? t('ตั้งแต่ {d}', { d: thDate(firstDate) }) : t('ข้อมูลทั้งหมด')}
      </span>
    ) : (
      <Trend pct={pctChange(current, previous)} label={cmpLabel} invert={invert} />
    );

  const effPoints = useMemo(() => asc.filter((s) => sEff(s) !== null), [asc]);
  const priceTrend = useMemo(
    () => asc.map((s) => sPricePerKwh(s)).filter((v) => v !== null),
    [asc]
  );

  const activeDue = due.filter((a) => a.level !== 'ok').slice(0, 3);
  const latestSoc = periodSessions.find((s) => isNum(s.socAfter))
    ?? sessions.find((s) => isNum(s.socAfter));
  const soc = latestSoc ? Number(latestSoc.socAfter) : null;
  const estRange = activeCar && isNum(activeCar.range) && soc !== null ? (n(activeCar.range) * soc) / 100 : null;
  const lastOdoValue = sessions.find((s) => isNum(s.odoAfter));

  if (!sessions.length && !costs.length) {
    return (
      <div className="card">
        <EmptyState
          message={t('ยังไม่มีข้อมูล — เริ่มจากเพิ่มรถของคุณ แล้วบันทึกการชาร์จครั้งแรก')}
          action={
            <div className="rowflex" style={{ justifyContent: 'center' }}>
              <Link href="/account" className="btn btn-sm">{t('เพิ่มรถ')}</Link>
              <Link href="/add" className="btn btn-primary btn-sm">{t('บันทึกการชาร์จ')}</Link>
            </div>
          }
        />
      </div>
    );
  }

  const chartRows = grain === 'day' ? days : months;
  const chartLabels = chartRows.map(([k]) => (grain === 'day' ? thDate(k) : thMonth(k)));
  const chartTip = (i) => {
    const [k, v] = chartRows[i];
    return (
      <>
        <b>{grain === 'day' ? thDate(k, 'long') : thMonthLong(k)}</b>
        <br />
        {fmt1(v.kwh)} kWh · {money(v.cost ?? v.charge ?? 0)}
        <br />
        {v.count} ครั้ง
      </>
    );
  };

  return (
    <>
      {/* ชื่อแบรนด์บนสุดของแดชบอร์ด — ไม่ใส่สโลแกน สโลแกนใช้เฉพาะหน้าล็อกอิน */}
      <div className="dash-brand">
        <Wordmark height={40} />
      </div>

      {/* งานค้างขึ้นก่อนเรื่องอื่น เพราะเป็นสิ่งเดียวในนี้ที่ผู้ใช้ต้องลงมือทำต่อจริงๆ */}
      {incomplete.length || budgetOver || activeDue.length ? (
        <div className="stack" style={{ marginBottom: 16 }}>
          <IncompleteBanner items={incomplete} />
          {budgetOver ? <BudgetBanner over budget={budgetOver.budget} avg={budgetOver.avg} /> : null}
          {activeDue.map((a) => <AlertBanner key={a.id} item={a} />)}
        </div>
      ) : null}

      {/* ---------------- Summary cards ---------------- */}
      <div className="stats">
        <Stat
          tone="accent" icon="battery" label={t('การชาร์จทั้งหมด')}
          value={fmt0(sum.count)} unit={t('ครั้ง')}
          detail={trend(sum.count, prev.count)}
        />
        <Stat
          tone="dc" icon="bolt" label={t('พลังงานรวม')}
          value={fmt(sum.kwh, 2)} unit="kWh"
          detail={trend(sum.kwh, prev.kwh)}
        />
        <Stat
          tone="purple" icon="coin" label={t('ค่าใช้จ่ายรวม')}
          value={money0(sum.cost + otherCost)}
          detail={trend(sum.cost + otherCost, prev.cost + prevOtherCost, true)}
        />
        <Stat
          tone="warn" icon="road" label={t('ระยะทางรวม')}
          value={fmtDist(sum.dist)} unit="km"
          detail={trend(sum.dist, prev.dist)}
        />
      </div>

      {/* ---------------- กราฟพลังงาน + สัดส่วนสถานี ---------------- */}
      <div className="charts split">
        <div className="card">
          <div className="card-head">
            <h3>พลังงานที่ชาร์จ<span className="hint">{t('หน่วย kWh')}</span></h3>
            <select
              value={grain}
              onChange={(e) => setGrain(e.target.value)}
              style={{ width: 'auto', fontSize: 13, padding: '6px 30px 6px 10px' }}
            >
              <option value="day">{t('รายวัน')}</option>
              <option value="month">{t('รายเดือน')}</option>
            </select>
          </div>
          <div className="card-body">
            <LineChart
              labels={chartLabels}
              values={chartRows.map(([, v]) => v.kwh)}
              color="var(--accent)"
              height={250}
              tip={chartTip}
              empty={t('ยังไม่มีการชาร์จในช่วงเวลานี้')}
            />
          </div>
        </div>

        <div className="stack-col">
          <div className="card">
            <div className="card-head"><h3>{t('สัดส่วนสถานีชาร์จ')}</h3></div>
            <div className="card-body">
              <DonutChart
                center={fmt0(sum.count)}
                sub={t('ครั้ง')}
                unit=""
                slices={stations.slice(0, 5).map((s, i) => ({
                  label: s.name, value: s.count, color: STATION_COLORS[i % STATION_COLORS.length],
                }))}
                empty={t('ยังไม่มีข้อมูลสถานี')}
              />
            </div>
          </div>

          <div className="card">
            <div className="card-head plain"><h3>{t('ค่าใช้จ่ายเฉลี่ย')}</h3></div>
            <div className="card-body" style={{ paddingTop: 10 }}>
              <div style={{ fontSize: 28, fontWeight: 690, letterSpacing: '-.025em' }}>
                {sum.avgPrice !== null ? money(sum.avgPrice) : '—'}
                <small style={{ fontSize: 14, fontWeight: 500, color: 'var(--muted)', marginLeft: 4 }}>/ kWh</small>
              </div>
              <div className="sm" style={{ marginTop: 6 }}>
                {trend(sum.avgPrice, prev.avgPrice, true)}
              </div>
              <div style={{ marginTop: 10 }}>
                <Sparkline values={priceTrend} color="var(--dc)" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------- สถานะรถ + สถานีที่ใช้บ่อย ---------------- */}
      <div className="charts half">
        <div className="card">
          <div className="card-head"><h3>{t('สถานะรถปัจจุบัน')}</h3></div>
          <div className="card-body">
            {activeCar ? (
              <>
                <div className="vstat">
                  <div className="soc">
                    <div className="big">
                      {soc !== null ? fmt0(soc) : '—'}<small> %</small>
                    </div>
                    <div className="km">{estRange !== null ? `${fmt0(estRange)} km` : '—'}</div>
                    <div className="cap">{t('ระยะทางที่วิ่งได้')}</div>
                  </div>
                  <div className="art"><CarPhoto car={activeCar} soc={soc} rounded={14} showCredit /></div>
                </div>
                <div className="vmini">
                  <div>
                    <div className="k">{t('แบตเตอรี่')}</div>
                    <div className="v">
                      {isNum(activeCar.batt) ? fmt1(Number(activeCar.batt)) : '—'}<small>kWh</small>
                    </div>
                  </div>
                  <div>
                    <div className="k">{t('การใช้พลังงานเฉลี่ย')}</div>
                    <div className="v">
                      {sum.kwh100 !== null ? fmt1(sum.kwh100) : '—'}<small>kWh/100km</small>
                    </div>
                  </div>
                  <div>
                    <div className="k">ODO</div>
                    <div className="v">
                      {lastOdoValue ? fmtDist(Number(lastOdoValue.odoAfter)) : '—'}<small>km</small>
                    </div>
                  </div>
                </div>
                <p className="sm faint" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="refresh" style={{ width: 13, height: 13, stroke: 'currentColor', fill: 'none', strokeWidth: 2 }} />
                  {latestSoc ? `อัปเดตล่าสุด ${thDate(latestSoc.date, 'long')}` : 'ยังไม่เคยกรอก SOC'}
                </p>
              </>
            ) : (
              <EmptyState
                message={t('ยังไม่ได้เลือกรถ')}
                action={<Link href="/account" className="btn btn-primary btn-sm">{t('เพิ่มรถ')}</Link>}
              />
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>{t('สถานีที่ใช้บ่อย')}</h3>
            <Link href="/history" className="btn btn-sm btn-ghost">{t('ดูทั้งหมด')}</Link>
          </div>
          <div className="card-body">
            {stations.length ? (
              <div className="station-list">
                {stations.slice(0, 5).map((s, i) => (
                  <StationRow
                    key={s.name}
                    station={s}
                    index={i}
                    color={STATION_COLORS[i % STATION_COLORS.length]}
                    open={openStation === s.name}
                    // กดอันที่กางอยู่ = ปิด · กดอันอื่น = ย้ายไปกางอันนั้น
                    // เปิดได้ทีละอันเพราะการ์ดนี้กว้างครึ่งเดียว ถ้ากางพร้อมกันหลายอันจะยาวเกินไป
                    onToggle={() => setOpenStation((cur) => (cur === s.name ? null : s.name))}
                    onEdit={(id) => { setEditingId(id); router.push('/add'); }}
                  />
                ))}
              </div>
            ) : (
              <EmptyState message={t('ยังไม่มีข้อมูลสถานีในช่วงเวลานี้')} />
            )}
          </div>
        </div>
      </div>

      {/* ---------------- แนวโน้มอัตราสิ้นเปลือง ---------------- */}
      <div className="card mt">
        <div className="card-head">
          <h3>แนวโน้มอัตราสิ้นเปลือง<span className="hint">{t('คำนวณจากระยะทาง ÷ พลังงานที่ชาร์จ')}</span></h3>
        </div>
        <div className="card-body">
          <BarChart
            labels={effPoints.map((s) => thDate(s.date))}
            series={[{ name: 'kWh/100km', color: 'var(--purple)', values: effPoints.map((s) => sKwh100(s)) }]}
            height={200}
            tip={(i) => {
              const s = effPoints[i];
              return (
                <>
                  <b>{thDate(s.date, 'long')}</b><br />
                  {fmt(sKwh100(s), 1)} kWh/100km · {fmt(sEff(s), 2)} km/kWh<br />
                  {fmtDist(sDist(s))} km / {fmt1(n(s.kwh))} kWh
                </>
              );
            }}
            empty={t('ต้องกรอกเลขไมล์ครั้งก่อนและปัจจุบันจึงจะคำนวณได้')}
          />
        </div>
      </div>

      {/* ---------------- ประวัติการชาร์จล่าสุด ---------------- */}
      <div className="card mt">
        <div className="card-head">
          <h3>{t('ประวัติการชาร์จล่าสุด')}</h3>
          <Link href="/history" className="btn btn-sm btn-ghost">{t('ดูทั้งหมด')}</Link>
        </div>
        {periodSessions.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('วันที่')}</th>
                  <th>{t('สถานีชาร์จ')}</th>
                  <th>{t('ประเภท')}</th>
                  <th className="num">{t('% เริ่มต้น')}</th>
                  <th className="num">{t('% สิ้นสุด')}</th>
                  <th className="num">{t('พลังงาน (kWh)')}</th>
                  <th className="num">{t('ค่าใช้จ่าย (฿)')}</th>
                  <th className="num">{t('ระยะทาง (km)')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {periodSessions.slice(0, 6).map((s) => (
                  <tr
                    key={s.id}
                    // ใช้เครื่องหมายชุดเดียวกับหน้าประวัติ จะได้จำได้ว่าสีนี้แปลว่าอะไร
                    className={isSessionComplete(s) ? undefined : 'row-incomplete'}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setDetail(s)}
                  >
                    <td>{thDate(s.date)}</td>
                    <td>
                      {s.station || '—'}
                      {isSessionComplete(s) ? null : (
                        <span className="pill pill-warn" style={{ marginLeft: 6 }}>{t('ยังไม่ครบ')}</span>
                      )}
                    </td>
                    <td><TypePill type={s.type} /></td>
                    <td className="num">{isNum(s.socBefore) ? `${fmt0(n(s.socBefore))}%` : '—'}</td>
                    <td className="num">{isNum(s.socAfter) ? `${fmt0(n(s.socAfter))}%` : '—'}</td>
                    <td className="num">{fmt(n(s.kwh), 2)}</td>
                    <td className="num"><b>{fmt(sTotal(s), 2)}</b></td>
                    <td className="num">{sDist(s) !== null ? fmtDist(sDist(s)) : '—'}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-icon btn-ghost btn-sm"
                        title={t('แก้ไข')}
                        onClick={(e) => { e.stopPropagation(); setEditingId(s.id); router.push('/add'); }}
                      >
                        <Icon name="edit" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            message={t('ไม่มีการชาร์จในช่วงเวลาที่เลือก')}
            action={<Link href="/add" className="btn btn-primary btn-sm">{t('บันทึกการชาร์จ')}</Link>}
          />
        )}
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
