'use client';
/** ระบบแจ้งเตือน — กำหนดบำรุงรักษา ต่อประกัน ต่อภาษี และงบประมาณต่อเดือน */
import { useMemo, useState } from 'react';
import { useStore } from '@/components/store';
import { EmptyState, Field } from '@/components/ui';
import { AlertBanner, BudgetBanner, BudgetTypeBanner } from '@/components/SessionViews';
import AlertModal from '@/components/AlertModal';
import Icon from '@/components/Icon';
import { ALERT_TYPES, BUDGET_TYPES } from '@/lib/data';
import { avgMonthlySpend } from '@/lib/calc';
import { money0, n, thDate } from '@/lib/format';

export default function AlertsPage() {
  const {
    due, budget: budgetState, avgByType, settings, setSettings, sessions, costs, carName, toast, t,
  } = useStore();
  const [editing, setEditing] = useState(undefined);
  const [budget, setBudget] = useState(String(settings.budget || ''));
  const [advance, setAdvance] = useState(String(settings.advanceDays ?? 30));
  // ช่องกรอกงบแยกชนิด — เก็บเป็นข้อความเหมือนช่องกรอกอื่น แล้วค่อยแปลงเป็นตัวเลขตอนบันทึก
  const [budgetInputs, setBudgetInputs] = useState(() => {
    const o = {};
    for (const tp of BUDGET_TYPES) {
      const v = settings.budgets?.[tp.key];
      o[tp.key] = n(v) > 0 ? String(v) : '';
    }
    return o;
  });

  const avg = useMemo(() => avgMonthlySpend(sessions, costs), [sessions, costs]);
  const active = due.filter((a) => a.level !== 'ok');
  const hasBudget = Number(settings.budget) > 0;
  const overRows = budgetState.rows.filter((r) => r.over);

  function saveBudget() {
    // เก็บเฉพาะชนิดที่ตั้งงบไว้จริง ไม่เก็บศูนย์ จะได้แยกออกชัดๆ ว่า "ไม่ได้ตั้งงบ"
    // ต่างจาก "ตั้งงบไว้ที่ 0" ซึ่งจะกลายเป็นเกินงบตลอดเวลา
    const budgets = {};
    for (const tp of BUDGET_TYPES) {
      const v = Number(budgetInputs[tp.key]) || 0;
      if (v > 0) budgets[tp.key] = v;
    }
    setSettings({
      budget: Number(budget) || 0,
      budgets,
      advanceDays: Number(advance) || 0,
    });
    toast('บันทึกการตั้งค่าเรียบร้อย');
  }

  return (
    <>
      <div className="card">
        <div className="card-head"><h3>{t('สถานะการแจ้งเตือน')}</h3></div>
        <div className="card-body stack">
          {/* ชนิดที่เกินงบขึ้นก่อน เพราะบอกได้ตรงกว่าว่าเงินบานที่ตรงไหน */}
          {overRows.map((r) => <BudgetTypeBanner key={r.key} row={r} />)}

          {hasBudget ? (
            <BudgetBanner over={!!budgetState.total?.over} budget={Number(settings.budget)} avg={avg} />
          ) : null}

          {active.length ? (
            active.map((a) => <AlertBanner key={a.id} item={a} />)
          ) : due.length ? (
            <div className="alert">
              <Icon name="check" style={{ color: 'var(--accent)' }} />
              <div>
                <div className="t1">{t('ยังไม่มีรายการที่ใกล้ครบกำหนด')}</div>
                <div className="t2">
                  รายการถัดไป: {due[0].title || ALERT_TYPES[due[0].type]?.label} · อีก {due[0].days} วัน
                </div>
              </div>
            </div>
          ) : null}

          {!hasBudget && !overRows.length && !due.length ? (
            <p className="sm faint">{t('ยังไม่ได้ตั้งการเตือนและงบประมาณ')}</p>
          ) : null}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>รายการเตือน<span className="hint">{t('บำรุงรักษา · ประกันภัย · ภาษี')}</span></h3>
          <button type="button" className="btn btn-sm btn-primary" onClick={() => setEditing(null)}>
            <Icon name="plus" />{t('เพิ่มการเตือน')}
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
              message={t('ยังไม่มีการเตือน — เพิ่มกำหนดบำรุงรักษา ต่อประกัน หรือต่อภาษี')}
              action={
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing(null)}>
                  {t('เพิ่มการเตือนแรก')}
                </button>
              }
            />
          ) : null}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>
            {t('งบประมาณค่าใช้จ่ายต่อเดือน')}
            <span className="hint">{t('ตั้งแยกตามชนิดได้ · เว้นว่างหรือ 0 = ไม่ตั้งงบชนิดนั้น')}</span>
          </h3>
        </div>
        <div className="card-body">
          {/* แยกทีละชนิดเพื่อให้รู้ว่าเงินบานที่ตรงไหน งบรวมก้อนเดียวบอกได้แค่ว่าเกิน แต่ไม่บอกว่าเพราะอะไร */}
          <div className="budget-rows">
            {BUDGET_TYPES.map((tp) => {
              const spent = n(avgByType[tp.key]);
              const set = Number(budgetInputs[tp.key]) || 0;
              const over = set > 0 && spent > set;
              return (
                <div className={`budget-row${over ? ' over' : ''}`} key={tp.key}>
                  <span className="ic" style={{ color: tp.color }}><Icon name={tp.icon} /></span>
                  <div className="nm">
                    <b>{t(tp.label)}</b>
                    <span>{t('ใช้จริงเฉลี่ย')} {money0(spent)} / {t('เดือน')}</span>
                  </div>
                  <input
                    type="number" min="0" step="any" inputMode="decimal" placeholder={t('ไม่ตั้งงบ')}
                    value={budgetInputs[tp.key]}
                    onChange={(e) => setBudgetInputs((b) => ({ ...b, [tp.key]: e.target.value }))}
                    aria-label={`${t('งบต่อเดือนของ')} ${t(tp.label)}`}
                  />
                  {/* แถบขึ้นเฉพาะตอนตั้งงบไว้ — ไม่มีงบก็ไม่มีอะไรให้เทียบ
                      หนีบที่ 100% เพราะแถบที่ยาวเกินกรอบอ่านไม่ออกอยู่ดี ตัวเลขข้างล่างบอกจริงแทน */}
                  {set > 0 ? (
                    <div className="meter">
                      <span style={{ width: `${Math.min(100, (spent / set) * 100)}%`, background: over ? 'var(--danger)' : tp.color }} />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="form-grid mt">
            <Field
              label={t('งบรวมทั้งหมด (บาท / เดือน)')}
              help={t('นับค่าชาร์จและต้นทุนทุกชนิดรวมกัน รวมค่าไฟและค่าใช้จ่ายอื่นๆ ที่ไม่มีงบแยก')}
            >
              <input type="number" min="0" step="any" inputMode="decimal" placeholder="0"
                value={budget} onChange={(e) => setBudget(e.target.value)} />
            </Field>
            <Field label={t('เตือนล่วงหน้า (วัน)')} help={t('ใช้กับรายการที่ไม่ได้ระบุจำนวนวันเอง')}>
              <input type="number" min="0" step="any" inputMode="decimal" placeholder="30"
                value={advance} onChange={(e) => setAdvance(e.target.value)} />
            </Field>
          </div>
          <p className="sm faint mt">
            {t('ค่าใช้จ่ายรวมเฉลี่ยปัจจุบัน')} {money0(avg)} / {t('เดือน')}
            {avgByType.months ? ` · ${t('คิดจากข้อมูล {n} เดือน', { n: avgByType.months })}` : ''}
          </p>
          <div className="mt">
            <button type="button" className="btn btn-primary" onClick={saveBudget}>
              <Icon name="check" />{t('บันทึกการตั้งค่า')}
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
