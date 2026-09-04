'use client';
/** ต้นทุนรถทั้งหมด — ค่าไฟ บำรุงรักษา ประกันภัย ภาษี และค่าใช้จ่ายอื่นๆ */
import { useMemo, useState } from 'react';
import { useStore } from '@/components/store';
import { EmptyState, Stat } from '@/components/ui';
import { BarChart, DonutChart } from '@/components/Charts';
import CostModal from '@/components/CostModal';
import Icon from '@/components/Icon';
import { COST_CATS } from '@/lib/data';
import { monthlyTotals, summarize } from '@/lib/calc';
import { rangeText } from '@/lib/period';
import { money, money0, n, shortNum, thDate, thMonth, thMonthLong, todayISO } from '@/lib/format';
import { costsToCsv, download } from '@/lib/exporters';

export default function CostsPage() {
  // ใช้ periodCosts/periodSessions — ช่วงเวลามาจากตัวเลือกบนแถบบนที่เดียว
  // เดิมหน้านี้มีตัวเลือกปีของตัวเอง ซึ่งซ้ำซ้อนและทำให้ตัวเลขไม่ตรงกับหน้าอื่น
  const { periodCosts, periodSessions, carName, toast, t, period, range } = useStore();
  const [editing, setEditing] = useState(undefined); // undefined = ปิด, null = เพิ่มใหม่, object = แก้ไข

  const list = periodCosts;
  const sessionList = periodSessions;

  const byCat = useMemo(() => {
    const m = {};
    Object.keys(COST_CATS).forEach((k) => { m[k] = 0; });
    list.forEach((c) => { m[c.cat] = (m[c.cat] || 0) + n(c.amount); });
    return m;
  }, [list]);

  const total = list.reduce((a, c) => a + n(c.amount), 0);
  const chargeTotal = summarize(sessionList).cost;

  const months = useMemo(
    () => monthlyTotals(sessionList, list).slice(-12),
    [sessionList, list]
  );

  function exportCsv() {
    if (!list.length) return toast('ไม่มีรายการให้ส่งออก', true);
    download(`ev-costs-${todayISO()}.csv`, costsToCsv(list, carName), 'text/csv;charset=utf-8');
    toast(`ส่งออก ${list.length} รายการแล้ว`);
  }

  return (
    <>
      <div className="stats">
        <Stat icon="wallet" label={t('ต้นทุนอื่นรวม')} value={money0(total)} detail={`${list.length} รายการ`} />
        <Stat icon="bolt" label={t('ค่าชาร์จรวม')} value={money0(chargeTotal)}
          detail={t(rangeText(period.key, range))} />
        <Stat icon="coin" label={t('ต้นทุนรวมทั้งหมด')} value={money0(total + chargeTotal)} detail="ค่าชาร์จ + ต้นทุนอื่น" />
        <Stat icon="car" label={t('ค่าไฟ / บำรุงรักษา')}
          value={`${money0(byCat.electric)} / ${money0(byCat.maintenance)}`}
          detail={`ประกัน ${money0(byCat.insurance)} · ภาษี ${money0(byCat.tax)}`} />
      </div>

      <div className="card mt">
        <div className="card-head">
          <h3>
            {t('ต้นทุนรถทั้งหมด')}
            <span className="hint">{t('ค่าไฟ · บำรุงรักษา · ประกันภัย · ภาษี · อื่นๆ')}</span>
          </h3>
          <button type="button" className="btn btn-sm" onClick={exportCsv}>
            <Icon name="download" />CSV
          </button>
          <button type="button" className="btn btn-sm btn-primary" onClick={() => setEditing(null)}>
            <Icon name="plus" />{t('เพิ่มรายการ')}
          </button>
        </div>

        <div className="rows">
          {list.map((c) => {
            const meta = COST_CATS[c.cat] || COST_CATS.other;
            return (
              <button type="button" className="row-item" key={c.id} onClick={() => setEditing(c)}>
                <div className="ic" style={{ background: `${meta.color}1f`, color: meta.color }}>
                  <Icon name="wallet" />
                </div>
                <div className="body">
                  <div className="t1">{meta.label}{c.note ? ` — ${c.note}` : ''}</div>
                  <div className="t2">
                    {thDate(c.date, 'long')}
                    {c.carId ? ` · ${carName(c.carId)}` : ''}
                    {c.images?.length ? ` · 🖼 ${c.images.length}` : ''}
                  </div>
                </div>
                <div className="r"><div className="a">{money0(n(c.amount))}</div></div>
              </button>
            );
          })}
          {!list.length ? (
            <EmptyState
              message={t('ยังไม่มีรายการต้นทุน — บันทึกค่าไฟ ค่าบำรุงรักษา ประกันภัย หรือภาษีได้ที่นี่')}
              action={
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing(null)}>
                  {t('เพิ่มรายการแรก')}
                </button>
              }
            />
          ) : null}
        </div>
      </div>

      <div className="charts">
        <div className="card">
          <div className="card-head"><h3>{t('สัดส่วนต้นทุนตามประเภท')}</h3></div>
          <div className="card-body">
            <DonutChart
              unit={t('฿')}
              center={shortNum(total)}
              sub={t('บาท')}
              slices={Object.entries(COST_CATS).map(([k, v]) => ({
                label: v.label, value: byCat[k] || 0, color: v.color,
              }))}
              empty={t('ยังไม่มีรายการต้นทุน')}
            />
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>ต้นทุนรวมรายเดือน<span className="hint">{t('ค่าชาร์จ + ต้นทุนอื่น')}</span></h3>
          </div>
          <div className="card-body">
            <BarChart
              stacked
              labels={months.map(([k]) => thMonth(k))}
              series={[
                { name: 'ค่าชาร์จ', color: 'var(--accent)', values: months.map(([, v]) => v.charge) },
                { name: 'ต้นทุนอื่น', color: 'var(--dc)', values: months.map(([, v]) => v.other) },
              ]}
              tip={(i) => {
                const [k, v] = months[i];
                return (
                  <>
                    <b>{thMonthLong(k)}</b><br />
                    ค่าชาร์จ {money(v.charge)}<br />
                    ต้นทุนอื่น {money(v.other)}<br />
                    รวม {money(v.charge + v.other)}
                  </>
                );
              }}
              empty={t('ยังไม่มีข้อมูลรายเดือน')}
            />
          </div>
        </div>
      </div>

      {editing !== undefined ? (
        <CostModal cost={editing} onClose={() => setEditing(undefined)} />
      ) : null}
    </>
  );
}
