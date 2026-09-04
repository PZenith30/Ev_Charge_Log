'use client';
/** โครงหน้าจอหลัก — จัดการสถานะการเข้าสู่ระบบ การโหลดข้อมูล และเมนูทั้งหมด */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV } from '@/lib/data';
import { fmt0, isNum, n } from '@/lib/format';
import Icon, { IconSprite } from './Icon';
import Wordmark from './Wordmark';
import Login from './Login';
import QuickAdd from './QuickAdd';
import CarPhoto from './CarPhoto';
import ChangePasswordModal from './ChangePasswordModal';
import DisplayNameModal from './DisplayNameModal';
import ChatWidget from './ChatWidget';
import PWA from './PWA';
import DateRangePicker from './DateRangePicker';
import ProfileMenu from './ProfileMenu';
import { ConfirmDialog, Lightbox, Toasts } from './ui';
import { useStore } from './store';

/** SOC ล่าสุดของรถ = SOC หลังชาร์จของครั้งล่าสุดที่กรอกไว้ */
function latestSoc(sessions) {
  const hit = sessions.find((s) => isNum(s.socAfter));
  return hit ? Number(hit.socAfter) : null;
}

const isActive = (pathname, href) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

/** ยังไม่ได้ตั้งค่า env — บอกวิธีแก้แทนที่จะพังเงียบๆ */
function SetupNotice() {
  const { t } = useStore();
  return (
    <div className="login-wrap">
      <div className="login-card" style={{ maxWidth: 520 }}>
        <div className="login-mark" style={{ background: 'var(--danger)' }}>
          <Icon name="alert" style={{ stroke: '#fff', fill: 'none', strokeWidth: 2 }} />
        </div>
        <h1>{t('ยังไม่ได้เชื่อมต่อ Supabase')}</h1>
        <p className="sub">{t('แอปต้องใช้ค่าสองตัวนี้จึงจะทำงานได้')}</p>
        <pre
          style={{
            background: 'var(--surface-3)', padding: 12, borderRadius: 'var(--r-sm)',
            fontSize: 12, overflowX: 'auto', margin: 0,
          }}
        >{`NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...`}</pre>
        <div className="sm muted" style={{ marginTop: 16, lineHeight: 1.7 }}>
          <b>{t('รันในเครื่อง:')}</b> คัดลอก <code>.env.local.example</code> เป็น <code>.env.local</code> แล้วใส่ค่าจริง
          <br />
          <b>{t('บน Vercel:')}</b> Project Settings → Environment Variables แล้ว Redeploy
          <br />
          {t('หาค่าได้ที่ Supabase Dashboard → Project Settings → Data API')}
          <br />
          <br />
          อย่าลืมรัน <code>supabase/schema.sql</code> ใน SQL Editor เพื่อสร้างตารางด้วย
        </div>
      </div>
    </div>
  );
}

function FullScreenMessage({ children }) {
  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', color: 'var(--muted)' }}>{children}</div>
    </div>
  );
}

export default function AppShell({ children }) {
  /**
   * สถานะหุบ/ขยายแถบข้าง
   * ค่าจริงถูกตั้งที่ <html data-sidebar> โดยสคริปต์ใน layout ตั้งแต่ก่อนหน้าเว็ปวาด
   * ตรงนี้เก็บ state ไว้แค่ให้ปุ่มรู้ว่าตอนนี้หุบอยู่ไหม จะได้สลับข้อความและไอคอนถูก
   */
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  useEffect(() => {
    setSidebarCollapsed(document.documentElement.getAttribute('data-sidebar') === 'collapsed');
  }, []);
  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      const el = document.documentElement;
      if (next) el.setAttribute('data-sidebar', 'collapsed');
      else el.removeAttribute('data-sidebar');
      try {
        localStorage.setItem('evlog.sidebarCollapsed', next ? '1' : '0');
      } catch { /* โหมดส่วนตัวเขียนไม่ได้ ก็ไม่ต้องจำ */ }
      return next;
    });
  }, []);

  const {
    phase, user, dataLoading, loadError, reload,
    cars, settings, viewAllCars, setActiveCar, activeCar, sessions,
    dark, toggleTheme, alertCount, quickOpen, setQuickOpen, pwOpen, setPwOpen, nameOpen, setNameOpen, t,
  } = useStore();
  const pathname = usePathname();

  if (phase === 'unconfigured') {
    return (
      <>
        <IconSprite />
        <SetupNotice />
      </>
    );
  }

  if (phase === 'loading') {
    return (
      <>
        <IconSprite />
        <div style={{ minHeight: '100dvh' }} />
      </>
    );
  }

  if (phase === 'anon') {
    return (
      <>
        <IconSprite />
        <Login />
        <Toasts />
      </>
    );
  }

  const current = NAV.find((item) => isActive(pathname, item.href)) || NAV[0];
  const tabs = NAV.filter((item) => item.tab);
  const carValue = viewAllCars ? '__all__' : settings.activeCar || '';

  const soc = latestSoc(sessions);
  const estRange =
    activeCar && isNum(activeCar.range) && soc !== null ? (n(activeCar.range) * soc) / 100 : null;

  return (
    <>
      <IconSprite />

      <aside className="sidebar">
        {/* แถบข้างเป็นสีเข้มเสมอไม่ว่าธีมไหน จึงระบุรุ่นพื้นเข้มไปตรงๆ ไม่ต้องวาดสองรูป */}
        <div className="brand">
          <Wordmark fixed="dark" height={30} />
          {/* ตอนหุบเหลือแค่โลโก้ย่อ จะได้ยังรู้ว่าเป็นแอปอะไร */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="brand-mini" src="/icon-192.png" alt="KiloEV" width={32} height={32} />
          <button
            type="button"
            className="sb-collapse"
            onClick={toggleSidebar}
            title={sidebarCollapsed ? t('ขยายแถบเมนู') : t('หุบแถบเมนู')}
            aria-label={sidebarCollapsed ? t('ขยายแถบเมนู') : t('หุบแถบเมนู')}
            aria-expanded={!sidebarCollapsed}
          >
            <Icon name="chevron-down" />
          </button>
        </div>

        <div className="sb-scroll">
          {NAV.map((item, i) => (
            <div key={item.href}>
              {i === NAV.length - 1 ? <div className="nav-sep" /> : null}
              {/* ตอนหุบเหลือแค่ไอคอน ใส่ title ไว้ให้ชี้แล้วรู้ว่าเมนูอะไร */}
              <Link
                href={item.href}
                className={`navlink${isActive(pathname, item.href) ? ' active' : ''}`}
                title={t(item.label)}
              >
                <Icon name={item.icon} />
                <span className="nav-label">{t(item.label)}</span>
                {item.href === '/alerts' && alertCount > 0 ? <span className="badge">{alertCount}</span> : null}
              </Link>
            </div>
          ))}
          <div className="nav-spacer" />
        </div>

        {activeCar ? (
          <div className="sb-car">
            <div className="nm">{activeCar.name}</div>
            <div className="st">
              <i />
              {[activeCar.brand, activeCar.model].filter(Boolean).join(' ') || 'ไม่ระบุรุ่น'}
            </div>
            <div className="art"><CarPhoto car={activeCar} soc={soc} rounded={10} /></div>
            <div className="row">
              <span>{soc !== null ? `${fmt0(soc)}%` : 'ยังไม่มีข้อมูล SOC'}</span>
              <b>{estRange !== null ? `${fmt0(estRange)} km` : '—'}</b>
            </div>
            <div className="sb-bar"><span style={{ width: `${soc ?? 0}%` }} /></div>
          </div>
        ) : null}

      </aside>

      <main className="main">
        <header className="topbar">
          <div className="tb-title">
            <h2>{t(current.label)}</h2>
            <div className="sub hide-mobile">{t(current.sub)}</div>
          </div>

          {cars.length > 0 ? (
            <select
              value={carValue}
              onChange={(e) => setActiveCar(e.target.value)}
              className="hide-mobile"
              style={{ width: 'auto', maxWidth: 170, fontSize: 13.5, padding: '8px 30px 8px 12px' }}
              title={t('เลือกรถที่ต้องการดูข้อมูล')}
            >
              {cars.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
              {cars.length > 1 ? <option value="__all__">{t('รถทุกคัน')}</option> : null}
            </select>
          ) : null}

          {/* แสดงตัวเลือกช่วงเวลาเฉพาะหน้าที่ใช้จริง
              หน้ารายงานมีตัวเลือกเดือน/ปีของตัวเองอยู่แล้ว ถ้ามีอีกอันข้างบนจะกลายเป็นสองที่
              ส่วนหน้าอื่นอย่างบันทึก/สถานี/บัญชี ตัวเลือกนี้กดแล้วไม่มีอะไรเปลี่ยน */}
          {current.period ? <DateRangePicker /> : null}

          <Link href="/alerts" className="btn btn-icon" title={t('แจ้งเตือน')} style={{ position: 'relative' }}>
            <Icon name="bell" />
            {alertCount > 0 ? (
              <span
                style={{
                  position: 'absolute', top: -3, right: -3, background: 'var(--danger)', color: 'var(--on-danger)',
                  fontSize: 9.5, fontWeight: 700, borderRadius: 99, padding: '0 4px', minWidth: 15,
                }}
              >
                {alertCount}
              </span>
            ) : null}
          </Link>

          <button type="button" className="btn btn-icon" onClick={toggleTheme} title={t('สลับธีม')}>
            <Icon name={dark ? 'sun' : 'moon'} />
          </button>

          <ProfileMenu onChangePassword={() => setPwOpen(true)} />
        </header>

        <div className="views">
          {loadError ? (
            <div className="alert danger" style={{ marginBottom: 14 }}>
              <Icon name="alert" />
              <div style={{ flex: 1 }}>
                <div className="t1">{t('โหลดข้อมูลไม่สำเร็จ')}</div>
                <div className="t2">{loadError}</div>
              </div>
              <button type="button" className="btn btn-sm" onClick={() => reload(user.id)}>{t('ลองใหม่')}</button>
            </div>
          ) : null}

          {dataLoading && !loadError ? (
            <FullScreenMessage>{t('กำลังโหลดข้อมูลจาก Supabase…')}</FullScreenMessage>
          ) : (
            children
          )}
        </div>
      </main>

      <nav className="tabbar">
        {tabs.map((item) => (
          <Link key={item.href} href={item.href} className={isActive(pathname, item.href) ? 'active' : ''}>
            <Icon name={item.icon} />
            {item.short}
          </Link>
        ))}
      </nav>

      {/* ปุ่มกลมสองอัน วางเรียงกันมุมขวาล่าง — บันทึกด่วนอยู่บน ผู้ช่วย AI อยู่ล่าง
          ข้อความใน span ถูกซ่อนจากสายตาด้วย CSS แต่ยังอยู่ให้โปรแกรมอ่านหน้าจออ่าน
          ส่วนคนที่มองเห็นใช้ tooltip จาก title */}
      <button type="button" className="fab fab-quick" onClick={() => setQuickOpen(true)} title={t('บันทึกด่วน')}>
        <Icon name="plus" />
        <span>{t('บันทึกด่วน')}</span>
      </button>

      <ChatWidget />
      <PWA />

      {quickOpen ? <QuickAdd /> : null}
      {pwOpen ? <ChangePasswordModal onClose={() => setPwOpen(false)} /> : null}
      {nameOpen ? <DisplayNameModal onClose={() => setNameOpen(false)} /> : null}
      <ConfirmDialog />
      <Lightbox />
      <Toasts />
    </>
  );
}
