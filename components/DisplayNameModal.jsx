'use client';
/** ตั้งชื่อผู้ใช้ที่แสดงบนแถบบน — เรียกได้ทั้งจากเมนูโปรไฟล์และหน้าบัญชี ใช้โค้ดชุดเดียวกัน */
import { useState } from 'react';
import { displayNameOf } from '@/lib/format';
import { Field, Modal } from './ui';
import { NAME_MAX, useStore } from './store';

export default function DisplayNameModal({ onClose }) {
  const { user, savedName, saveDisplayName, toast, t } = useStore();
  // เริ่มจากชื่อที่ตั้งไว้จริง ไม่ใช่ displayName ที่เดาจากอีเมล
  // ไม่งั้นแค่เปิดหน้าต่างแล้วกดบันทึก ชื่อที่เดาไว้จะกลายเป็นชื่อจริงไปเลย
  const [name, setName] = useState(savedName);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const trimmed = name.trim();
  // ใช้ตัวเดียวกับที่แถบบนใช้ จะได้เห็นค่าสำรองจริงตอนลบชื่อจนว่าง
  const preview = displayNameOf({ ...user, user_metadata: { display_name: trimmed } });

  async function submit() {
    setErr('');
    if (trimmed === savedName) return onClose();   // ไม่ได้แก้อะไร ไม่ต้องยิงไปที่เซิร์ฟเวอร์
    setBusy(true);
    const error = await saveDisplayName(trimmed);
    setBusy(false);
    if (error) return setErr(error);
    toast(trimmed ? t('บันทึกชื่อผู้ใช้แล้ว') : t('ล้างชื่อผู้ใช้แล้ว'));
    onClose();
  }

  return (
    <Modal
      title={t('ตั้งชื่อผู้ใช้')}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>{t('ยกเลิก')}</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? t('กำลังบันทึก…') : t('บันทึกชื่อ')}
          </button>
        </>
      }
    >
      <div className="stack">
        <Field
          label={t('ชื่อที่ให้แสดง')}
          help={t('เว้นว่างไว้ก็ได้ ระบบจะใช้ชื่อหน้า @ ของอีเมลแทน')}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={NAME_MAX}
            placeholder={t('เช่น สมชาย')}
            autoComplete="nickname"
            autoFocus
          />
        </Field>

        {/* ให้เห็นผลลัพธ์จริงก่อนกดบันทึก เพราะชื่อไปโผล่ที่มุมขวาบนซึ่งตอนนี้ถูกหน้าต่างนี้บังอยู่ */}
        <div className="name-preview">
          <span className="tb-avatar">{preview.trim().charAt(0).toUpperCase()}</span>
          <div>
            <b>{preview}</b>
            <span>{user?.email}</span>
          </div>
        </div>
      </div>

      {err ? <div className="login-err">{err}</div> : null}
      <p className="sm faint mt">
        {t('ชื่อนี้เก็บอยู่กับบัญชีของคุณ จึงเห็นเหมือนกันทุกเครื่องที่ล็อกอิน · อีเมลยังใช้เข้าสู่ระบบเหมือนเดิม')}
      </p>
    </Modal>
  );
}
