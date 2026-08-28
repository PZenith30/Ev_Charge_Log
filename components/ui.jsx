'use client';
/** ชิ้นส่วน UI ที่ใช้ซ้ำทั้งแอป — การ์ดสถิติ, modal, toast, ฟิลด์ฟอร์ม ฯลฯ */
import { useEffect, useState } from 'react';
import Icon from './Icon';
import { useStore } from './store';

export function Stat({ icon, label, value, unit, detail }) {
  return (
    <div className="stat">
      <div className="k">
        <Icon name={icon} />
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
