'use client';
/** โครงหน้าจอหลัก — sidebar (จอใหญ่), tab bar + ปุ่มลอย (มือถือ), แถบบน และ modal ระดับแอป */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV } from '@/lib/data';
import Icon, { IconSprite } from './Icon';
import Login from './Login';
import QuickAdd from './QuickAdd';
import { ConfirmDialog, Lightbox, Toasts } from './ui';
import { useStore } from './store';

const isActive = (pathname, href) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

export default function AppShell({ children }) {
  const {
    ready, authed, logout, cars, settings, setSettings,
    dark, toggleTheme, alertCount, quickOpen, setQuickOpen,
  } = useStore();
  const pathname = usePathname();

  if (!ready) {
    return (
      <>
        <IconSprite />
        <div style={{ minHeight: '100dvh' }} />
      </>
    );
  }

  if (!authed) {
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

  return (
    <>
      <IconSprite />

      <aside className="sidebar">
        <div className="brand">
          <div className="mark"><Icon name="bolt" viewBox="0 0 32 32" /></div>
          <div>
            <b>EV Charge Log</b>
            <span>บันทึกการชาร์จรถไฟฟ้า</span>
          </div>
        </div>

        {NAV.map((item, i) => (
          <div key={item.href}>
            {i === NAV.length - 1 ? <div className="nav-sep" /> : null}
            <Link href={item.href} className={`navlink${isActive(pathname, item.href) ? ' active' : ''}`}>
              <Icon name={item.icon} />
              {item.label}
              {item.href === '/alerts' && alertCount > 0 ? <span className="badge">{alertCount}</span> : null}
            </Link>
          </div>
        ))}

        <div className="nav-spacer" />
        <div className="nav-sep" />
        <button type="button" className="navlink" onClick={toggleTheme}>
          <Icon name={dark ? 'sun' : 'moon'} />
          {dark ? 'โหมดสว่าง' : 'โหมดมืด'}
        </button>
        <button type="button" className="navlink" onClick={logout}>
          <Icon name="logout" />
          ออกจากระบบ
        </button>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="tb-title">
            <h2>{current.label}</h2>
            <div className="sub hide-mobile">{current.sub}</div>
          </div>

          {cars.length > 0 ? (
            <select
              value={settings.activeCar || ''}
              onChange={(e) => setSettings({ activeCar: e.target.value })}
              style={{ width: 'auto', maxWidth: 190, fontSize: 13.5, padding: '7px 30px 7px 10px' }}
              title="เลือกรถที่ต้องการดูข้อมูล"
            >
              {cars.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
              {cars.length > 1 ? <option value="__all__">รถทุกคัน</option> : null}
            </select>
          ) : null}

          <Link href="/alerts" className="btn btn-icon" title="แจ้งเตือน" style={{ position: 'relative' }}>
            <Icon name="bell" />
            {alertCount > 0 ? (
              <span
                style={{
                  position: 'absolute', top: -3, right: -3, background: 'var(--danger)', color: '#fff',
                  fontSize: 9.5, fontWeight: 700, borderRadius: 99, padding: '0 4px', minWidth: 15,
                }}
              >
                {alertCount}
              </span>
            ) : null}
          </Link>

          <button type="button" className="btn btn-icon" onClick={toggleTheme} title="สลับธีม">
            <Icon name={dark ? 'sun' : 'moon'} />
          </button>

          <button type="button" className="btn btn-primary no-print hide-mobile" onClick={() => setQuickOpen(true)}>
            <Icon name="plus" />
            Quick Add
          </button>
        </header>

        <div className="views">{children}</div>
      </main>

      <nav className="tabbar">
        {tabs.map((item) => (
          <Link key={item.href} href={item.href} className={isActive(pathname, item.href) ? 'active' : ''}>
            <Icon name={item.icon} />
            {item.short}
          </Link>
        ))}
      </nav>

      <button type="button" className="fab" onClick={() => setQuickOpen(true)} title="Quick Add">
        <Icon name="plus" />
      </button>

      {quickOpen ? <QuickAdd /> : null}
      <ConfirmDialog />
      <Lightbox />
      <Toasts />
    </>
  );
}
