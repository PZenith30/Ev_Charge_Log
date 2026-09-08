'use client';
/** ปุ่มโปรไฟล์บนแถบบน — เรื่องบัญชีล้วนๆ: บัญชีและรถ ตั้งชื่อผู้ใช้ เปลี่ยนรหัสผ่าน ภาษา ออกจากระบบ */
import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from './Icon';
import { LangToggle, useDismiss } from './ui';
import { useStore } from './store';

export default function ProfileMenu({ onChangePassword }) {
  const { user, displayName, logout, confirm, setNameOpen, t } = useStore();
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, useCallback(() => setOpen(false), []));
  const router = useRouter();

  const initials = (displayName || '?').trim().charAt(0).toUpperCase();

  /** ปิดเมนูก่อนแล้วค่อยทำงาน เพื่อไม่ให้เมนูค้างทับ modal */
  const run = (fn) => () => {
    setOpen(false);
    fn();
  };
  const go = (href) => run(() => router.push(href));

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className="tb-profile"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={t('บัญชีผู้ใช้')}
      >
        <span className="tb-avatar">{initials}</span>
        {/* แสดงชื่อผู้ใช้ ไม่ใช่อีเมล — อีเมลไปอยู่ใต้ชื่อในเมนูที่กดเปิดแทน */}
        <span
          className="hide-mobile"
          style={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {displayName}
        </span>
        <Icon name="chevron-down" style={{ width: 14, height: 14, opacity: 0.5 }} />
      </button>

      {open ? (
        <div className="menu" role="menu">
          {/* ชื่อผู้ใช้เป็นบรรทัดหลัก อีเมลอยู่ใต้ชื่อ — ยังต้องเห็นได้ว่าล็อกอินด้วยบัญชีไหน */}
          <div className="menu-head">
            <b>{displayName}</b>
            <span>{user?.email}</span>
          </div>

          {/* เมนูนี้เหลือเฉพาะเรื่องบัญชี ทางลัดไปหน้าอื่นถูกถอดออกแล้ว
              เพราะทุกหน้าที่เคยอยู่ในนี้ไปถึงได้จากแถบเมนูซ้ายและแถบแท็บล่างอยู่แล้ว
              ส่วนบันทึกด่วนกับผู้ช่วย AI มีปุ่มลอยของตัวเองที่มุมขวาล่างทุกหน้า */}
          <button type="button" className="menu-item" role="menuitem" onClick={go('/account')}>
            <Icon name="car" />{t('บัญชีและรถของฉัน')}
          </button>

          <div className="menu-sep" />

          <button type="button" className="menu-item" role="menuitem" onClick={run(() => setNameOpen(true))}>
            <Icon name="user" />{t('ตั้งชื่อผู้ใช้')}
          </button>
          <button type="button" className="menu-item" role="menuitem" onClick={run(onChangePassword)}>
            <Icon name="settings" />{t('เปลี่ยนรหัสผ่าน')}
          </button>
          {/* ไม่ปิดเมนูหลังกด เพราะผู้ใช้ควรเห็นเมนูเปลี่ยนภาษาทันทีว่ากดถูกตัวแล้ว */}
          <div className="menu-lang">
            <span><Icon name="globe" />{t('ภาษา')}</span>
            <LangToggle compact />
          </div>

          <div className="menu-sep" />

          <button
            type="button"
            className="menu-item danger"
            role="menuitem"
            onClick={run(() =>
              confirm(
                t('ออกจากระบบ'),
                t('ต้องออกจากระบบตอนนี้เลยไหม ข้อมูลถูกบันทึกไว้บน Supabase แล้ว'),
                logout
              )
            )}
          >
            <Icon name="logout" />{t('ออกจากระบบ')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
