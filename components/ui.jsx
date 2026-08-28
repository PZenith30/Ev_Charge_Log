'use client';
/** ชิ้นส่วน UI ที่ใช้ซ้ำทั้งแอป — การ์ดสถิติ, modal, toast, ฟิลด์ฟอร์ม ฯลฯ */
import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { useStore } from './store';

/** ปิดเมนู/ป็อปอัปเมื่อคลิกนอกกรอบหรือกด Escape */
export function useDismiss(open, onClose) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
  return ref;
}

const COLLAPSE_KEY = 'evlog.collapsed';
const readCollapsed = () => {
  try {
    return JSON.parse(localStorage.getItem(COLLAPSE_KEY) || '{}');
  } catch {
    return {};
  }
};

/**
 * การ์ดที่หด/ขยายได้ — จำสถานะไว้ในเครื่องด้วย id ที่ส่งมา
 * ปุ่มด้านขวาของหัวข้อ (actions) กดได้โดยไม่พับการ์ด
 */
export function CollapsibleCard({ id, title, hint, actions, defaultOpen = true, children, className = '' }) {
  const [open, setOpen] = useState(defaultOpen);

  // อ่านค่าใน useEffect เพื่อไม่ให้ HTML ฝั่งเซิร์ฟเวอร์กับฝั่งเบราว์เซอร์ไม่ตรงกัน
  useEffect(() => {
    const saved = readCollapsed();
    if (id && typeof saved[id] === 'boolean') setOpen(saved[id]);
  }, [id]);

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      if (id) {
        try {
          localStorage.setItem(COLLAPSE_KEY, JSON.stringify({ ...readCollapsed(), [id]: next }));
        } catch { /* โหมดส่วนตัวเขียนไม่ได้ ก็ไม่ต้องจำ */ }
      }
      return next;
    });
  }, [id]);

  return (
    <div className={`card${className ? ' ' + className : ''}`}>
      <div className={`card-head${open ? '' : ' closed'}`}>
        <button type="button" className="card-toggle" onClick={toggle} aria-expanded={open}>
          <Icon name="chevron-down" className="chev" />
          <h3>
            {title}
            {hint ? <span className="hint">{hint}</span> : null}
          </h3>
        </button>
        {actions}
      </div>
      {/* ซ่อนด้วย hidden แทนการถอดออกจาก DOM เพื่อไม่ให้ค่าที่กรอกค้างไว้ในฟอร์มหาย */}
      <div hidden={!open}>{children}</div>
    </div>
  );
}

/**
 * การ์ดสถิติ — ไอคอนในกล่องสีอ่อน, ตัวเลขเด่น, บรรทัดล่างเป็นรายละเอียดหรือแนวโน้ม
 * `tone` คุมสีไอคอน: accent (เขียว) · dc (น้ำเงิน) · purple (ม่วง) · warn · danger
 */
export function Stat({ icon, label, value, unit, detail, tone = 'accent' }) {
  return (
    <div className="stat">
      <div className="k">
        <span className="ic" style={{ background: `var(--${tone}-soft)`, color: `var(--${tone})` }}>
          <Icon name={icon} />
        </span>
        {label}
      </div>
      <div className="v">
        {value}
        {unit ? <small>{unit}</small> : null}
      </div>
      {detail ? <div className="d">{detail}</div> : null}
    </div>
  );
}

/** ป้ายแนวโน้ม "↑ 20% จากเดือนที่แล้ว" — pct เป็น null เมื่อเทียบไม่ได้ */
export function Trend({ pct, label, invert = false }) {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) {
    return <span className="faint">{label ? `เทียบ${label}ไม่ได้` : 'ไม่มีข้อมูลเทียบ'}</span>;
  }
  const flat = Math.abs(pct) < 0.5;
  // invert = ตัวเลขน้อยลงถือว่าดี (เช่น ค่าใช้จ่าย, kWh/100km)
  const good = flat ? false : invert ? pct < 0 : pct > 0;
  const cls = flat ? 'flat' : good ? 'up' : 'down';
  const arrow = flat ? '→' : pct > 0 ? '↑' : '↓';
  return (
    <>
      <span className={`trend ${cls}`}>
        {arrow} {Math.abs(pct).toFixed(0)}%
      </span>
      {label ? <span className="tx">{label}</span> : null}
    </>
  );
}

export function EmptyState({ message, action }) {
  return (
    <div className="empty">
      <Icon name="inbox" />
      <p>{message}</p>
      {action}
    </div>
  );
}

export function Field({ label, help, children, style }) {
  return (
    <div className="field" style={style}>
      {label ? <label>{label}</label> : null}
      {children}
      {help ? <span className="help">{help}</span> : null}
    </div>
  );
}

/**
 * ช่องรหัสผ่านพร้อมปุ่มดู/ซ่อน
 * ปุ่มตั้ง tabIndex=-1 เพื่อไม่ให้ขวางลำดับ Tab จากช่องกรอกไปยังปุ่มยืนยัน
 */
export function PasswordInput({ value, onChange, autoComplete, placeholder = '••••••' }) {
  const [show, setShow] = useState(false);
  const label = show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน';
  return (
    <div className="pw-wrap">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        placeholder={placeholder}
        spellCheck={false}
        autoCapitalize="none"
        autoCorrect="off"
      />
      <button
        type="button"
        className="pw-toggle"
        onClick={() => setShow((s) => !s)}
        title={label}
        aria-label={label}
        aria-pressed={show}
        tabIndex={-1}
      >
        <Icon name={show ? 'eye-off' : 'eye'} />
      </button>
    </div>
  );
}

export function TypePill({ type }) {
  const t = type === 'DC' ? 'DC' : 'AC';
  return <span className={`pill pill-${t}`}>{t}</span>;
}

/** ปุ่มสลับ AC / DC */
export function TypeToggle({ value, onChange }) {
  return (
    <div className="seg">
      {['AC', 'DC'].map((t) => (
        <button
          key={t}
          type="button"
          className={value === t ? `on ${t.toLowerCase()}` : ''}
          onClick={() => onChange(t)}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

/**
 * Modal มาตรฐาน — ถ้าส่ง onSubmit มา การ์ดจะเป็น <form> ให้ปุ่ม submit ทำงานได้
 */
export function Modal({ title, onClose, onSubmit, footer, wide, children }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const Card = onSubmit ? 'form' : 'div';
  const cardProps = onSubmit
    ? {
        onSubmit: (e) => {
          e.preventDefault();
          onSubmit(e);
        },
      }
    : {};

  return (
    <div className="modal">
      <button type="button" className="modal-bg" onClick={onClose} aria-label="ปิดหน้าต่าง" />
      <Card className={`modal-card${wide ? ' wide' : ''}`} {...cardProps}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button type="button" className="btn btn-icon btn-ghost" onClick={onClose} aria-label="ปิด">
            <Icon name="x" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </Card>
    </div>
  );
}

export function Toasts() {
  const { toasts } = useStore();
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast${t.isErr ? ' err' : ''}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}

export function ConfirmDialog() {
  const { confirmState, setConfirmState } = useStore();
  if (!confirmState) return null;
  const close = () => setConfirmState(null);
  return (
    <Modal
      title={confirmState.title}
      onClose={close}
      footer={
        <>
          <button type="button" className="btn" onClick={close}>
            ยกเลิก
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              close();
              confirmState.onConfirm();
            }}
          >
            ยืนยัน
          </button>
        </>
      }
    >
      <p className="sm muted">{confirmState.message}</p>
    </Modal>
  );
}

export function Lightbox() {
  const { lightbox, setLightbox } = useStore();
  if (!lightbox) return null;
  return (
    <div
      className="lightbox"
      onClick={() => setLightbox(null)}
      role="button"
      tabIndex={-1}
      aria-label="ปิดรูป"
    >
      {/* รูปมาจาก data: URL ใน IndexedDB จึงใช้ <img> ตรงๆ แทน next/image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={lightbox} alt="รูปแนบ" />
    </div>
  );
}
