'use client';
/** เปลี่ยนรหัสผ่าน — เรียกได้ทั้งจากเมนูโปรไฟล์และหน้าบัญชี ใช้โค้ดชุดเดียวกัน */
import { useState } from 'react';
import { Field, Modal, PasswordInput } from './ui';
import { useStore } from './store';

export default function ChangePasswordModal({ onClose }) {
  const { changePassword, toast, t } = useStore();
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit() {
    setErr('');
    if (pass.length < 6) return setErr('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
    if (pass !== pass2) return setErr('รหัสผ่านทั้งสองช่องไม่ตรงกัน');

    setBusy(true);
    const error = await changePassword(pass);
    setBusy(false);
    if (error) return setErr(error);
    toast('เปลี่ยนรหัสผ่านเรียบร้อย');
    onClose();
  }

  return (
    <Modal
      title={t('เปลี่ยนรหัสผ่าน')}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>{t('ยกเลิก')}</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'กำลังบันทึก…' : 'บันทึกรหัสผ่านใหม่'}
          </button>
        </>
      }
    >
      <div className="stack">
        <Field label={t('รหัสผ่านใหม่')} help={t('อย่างน้อย 6 ตัวอักษร')}>
          <PasswordInput value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="new-password" />
        </Field>
        <Field label={t('ยืนยันรหัสผ่านใหม่')}>
          <PasswordInput value={pass2} onChange={(e) => setPass2(e.target.value)} autoComplete="new-password" />
        </Field>
      </div>
      {err ? <div className="login-err">{err}</div> : null}
      <p className="sm faint mt">
        {t('เปลี่ยนแล้วยังใช้งานต่อได้ทันทีในเครื่องนี้ · เครื่องอื่นที่ล็อกอินค้างไว้จะยังใช้ได้จนกว่าเซสชันจะหมดอายุ')}
      </p>
    </Modal>
  );
}
