'use client';
/** ระบบแจ้งเตือน — กำหนดบำรุงรักษา ต่อประกัน ต่อภาษี และงบประมาณต่อเดือน */
import { useMemo, useState } from 'react';
import { useStore } from '@/components/store';
import { EmptyState, Field } from '@/components/ui';
import { AlertBanner, BudgetBanner } from '@/components/SessionViews';
import AlertModal from '@/components/AlertModal';
import Icon from '@/components/Icon';
import { ALERT_TYPES } from '@/lib/data';
import { avgMonthlySpend } from '@/lib/calc';
import { money0, thDate } from '@/lib/format';

export default function AlertsPage() {
  const { due, budgetOver, settings, setSettings, sessions, costs, carName, toast } = useStore();
  const [editing, setEditing] = useState(undefined);
  const [budget, setBudget] = useState(String(settings.budget || ''));
  const [advance, setAdvance] = useState(String(settings.advanceDays ?? 30));

  const avg = useMemo(() => avgMonthlySpend(sessions, costs), [sessions, costs]);
  const active = due.filter((a) => a.level !== 'ok');
  const hasBudget = Number(settings.budget) > 0;

  function saveBudget() {
    setSettings({
      budget: Number(budget) || 0,
      advanceDays: Number(advance) || 0,
    });
    toast('บันทึกการตั้งค่าเรียบร้อย');
  }

  return (
    <>
      <div className="card">
        <div className="card-head"><h3>สถานะการแจ้งเตือน</h3></div>
        <div className="card-body stack">
          {hasBudget ? (
            <BudgetBanner over={!!budgetOver} budget={Number(settings.budget)} avg={avg} />
          ) : null}

          {active.length ? (
            active.map((a) => <AlertBanner key={a.id} item={a} />)
          ) : due.length ? (
            <div className="alert">
              <Icon name="check" style={{ color: 'var(--accent)' }} />
              <div>
                <div className="t1">ยังไม่มีรายการที่ใกล้ครบกำหนด</div>
                <div className="t2">
                  รายการถัดไป: {due[0].title || ALERT_TYPES[due[0].type]?.label} · อีก {due[0].days} วัน
                </div>
              </div>
            </div>
          ) : null}

          {!hasBudget && !due.length ? (
            <p className="sm faint">ยังไม่ได้ตั้งการเตือนและงบประมาณ</p>
          ) : null}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>รายการเตือน<span className="hint">บำรุงรักษา · ประกันภัย · ภาษี</span></h3>
          <button type="button" className="btn btn-sm btn-primary" onClick={() => setEditing(null)}>
            <Icon name="plus" />เพิ่มการเตือน
          </button>
        </div>
        <div className="rows">
          {due.map((a) => {
            const meta = ALERT_TYPES[a.type] || ALERT_TYPES.other;
            const pill =
              a.level === 'overdue' ? <span className="pill pill-danger">เลยกำหนด {Math.abs(a.days)} วัน</span>
              : a.level === 'soon' ? <span className="pill pill-warn">อีก {a.days} วัน</span>
              : <span className="pill pill-ok">อีก {a.days} วัน</span>;
            return (
              <button type="button" className="row-item" key={a.id} onClick={() => setEditing(a)}>
                <div className="ic" style={{ background: 'var(--surface-3)', color: 'var(--muted)' }}>
                  <Icon name={meta.icon} />
                </div>
                <div className="body">
                  <div className="t1">{a.title || meta.label}</div>
                  <div className="t2">
                    {meta.label} · {thDate(a.due, 'long')}
                    {a.carId ? ` · ${carName(a.carId)}` : ''}
                  </div>
                </div>
                <div className="r">{pill}</div>
              </button>
            );
          })}
          {!due.length ? (
            <EmptyState
              message="ยังไม่มีการเตือน — เพิ่มกำหนดบำรุงรักษา ต่อประกัน หรือต่อภาษี"
              action={
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing(null)}>
                  เพิ่มการเตือนแรก
                </button>
              }
            />
          ) : null}
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h3>งบประมาณค่าใช้จ่ายต่อเดือน</h3></div>
        <div className="card-body">
          <div className="form-grid">
            <Field label="งบประมาณ (บาท / เดือน)" help="เตือนเมื่อค่าใช้จ่ายเฉลี่ยต่อเดือนเกินงบนี้ · 0 = ไม่ตั้งงบ">
              <input type="number" min="0" step="any" inputMode="decimal" placeholder="0"
                value={budget} onChange={(e) => setBudget(e.target.value)} />
            </Field>
            <Field label="เตือนล่วงหน้า (วัน)" help="ใช้กับรายการที่ไม่ได้ระบุจำนวนวันเอง">
              <input type="number" min="0" step="any" inputMode="decimal" placeholder="30"
                value={advance} onChange={(e) => setAdvance(e.target.value)} />
            </Field>
          </div>
          <p className="sm faint mt">ค่าใช้จ่ายเฉลี่ยปัจจุบัน {money0(avg)} / เดือน</p>
          <div className="mt">
            <button type="button" className="btn btn-primary" onClick={saveBudget}>
              <Icon name="check" />บันทึกการตั้งค่า
            </button>
          </div>
        </div>
      </div>

      {editing !== undefined ? (
        <AlertModal item={editing} onClose={() => setEditing(undefined)} />
      ) : null}
    </>
  );
}
