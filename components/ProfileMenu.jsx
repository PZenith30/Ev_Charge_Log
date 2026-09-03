'use client';
/** ปุ่มโปรไฟล์บนแถบบน — กดแล้วมีเมนูลัด เปลี่ยนรหัสผ่าน สลับธีม สลับภาษา และออกจากระบบ */
import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LANGS } from '@/lib/i18n';
import Icon from './Icon';
import { useDismiss } from './ui';
import { useStore } from './store';

export default function ProfileMenu({ onChangePassword }) {
  const {
    user, dark, toggleTheme, logout, alertCount, confirm, setQuickOpen, setChatOpen, lang, setLang, t,
  } = useStore();
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, useCallback(() => setOpen(false), []));
  const router = useRouter();

  const initials = (user?.email || '?').trim().charAt(0).toUpperCase();
  // ปุ่มสลับภาษาแสดง "ภาษาที่จะเปลี่ยนไป" แบบเดียวกับปุ่มสลับธีม
  const other = LANGS.find((l) => l.code !== lang) || LANGS[0];

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
        <span
          className="hide-mobile"
          style={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {user?.email}
        </span>
        <Icon name="chevron-down" style={{ width: 14, height: 14, opacity: 0.5 }} />
      </button>

      {open ? (
        <div className="menu" role="menu">
          <div className="menu-head">
            <b>{user?.email}</b>
            <span>{t('เข้าสู่ระบบด้วย Supabase Auth')}</span>
          </div>

          <div className="menu-label">{t('เมนูลัด')}</div>
          <button type="button" className="menu-item" role="menuitem" onClick={run(() => setChatOpen(true))}>
            <Icon name="sparkle" />{t('ถามผู้ช่วย AI')}
          </button>
          <button type="button" className="menu-item" role="menuitem" onClick={run(() => setQuickOpen(true))}>
            <Icon name="plus" />{t('บันทึกการชาร์จด่วน')}
          </button>
          <button type="button" className="menu-item" role="menuitem" onClick={go('/stations')}>
            <Icon name="map-pin" />{t('สถานีชาร์จใกล้ฉัน')}
          </button>
          <button type="button" className="menu-item" role="menuitem" onClick={go('/account')}>
            <Icon name="car" />{t('บัญชีและรถของฉัน')}
          </button>
          <button type="button" className="menu-item" role="menuitem" onClick={go('/alerts')}>
            <Icon name="bell" />{t('แจ้งเตือน')}
            {alertCount > 0 ? <span className="badge">{alertCount}</span> : null}
          </button>
          <button type="button" className="menu-item" role="menuitem" onClick={go('/report')}>
            <Icon name="file" />{t('รายงาน')}
          </button>

          <div className="menu-sep" />

          <button type="button" className="menu-item" role="menuitem" onClick={run(onChangePassword)}>
            <Icon name="settings" />{t('เปลี่ยนรหัสผ่าน')}
          </button>
          <button type="button" className="menu-item" role="menuitem" onClick={run(toggleTheme)}>
            <Icon name={dark ? 'sun' : 'moon'} />
            {dark ? t('สลับเป็นโหมดสว่าง') : t('สลับเป็นโหมดมืด')}
          </button>
          <button type="button" className="menu-item" role="menuitem" onClick={run(() => setLang(other.code))}>
            <Icon name="globe" />{t('เปลี่ยนเป็น {lang}', { lang: other.label })}
          </button>

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
