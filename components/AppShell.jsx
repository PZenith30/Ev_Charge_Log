'use client';
/** โครงหน้าจอหลัก — จัดการสถานะการเข้าสู่ระบบ การโหลดข้อมูล และเมนูทั้งหมด */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV } from '@/lib/data';
import Icon, { IconSprite } from './Icon';
import Login from './Login';
import QuickAdd from './QuickAdd';
import { ConfirmDialog, Lightbox, Toasts } from './ui';
import { useStore } from './store';

const isActive = (pathname, href) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

/** ยังไม่ได้ตั้งค่า env — บอกวิธีแก้แทนที่จะพังเงียบๆ */
function SetupNotice() {
  return (
    <div className="login-wrap">
      <div className="login-card" style={{ maxWidth: 520 }}>
        <div className="login-mark" style={{ background: 'var(--danger)' }}>
          <Icon name="alert" style={{ stroke: '#fff', fill: 'none', strokeWidth: 2 }} />
        </div>
        <h1>ยังไม่ได้เชื่อมต่อ Supabase</h1>
        <p className="sub">แอปต้องใช้ค่าสองตัวนี้จึงจะทำงานได้</p>
        <pre
          style={{
            background: 'var(--surface-3)', padding: 12, borderRadius: 'var(--r-sm)',
            fontSize: 12, overflowX: 'auto', margin: 0,
          }}
        >{`NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...`}</pre>
        <div className="sm muted" style={{ marginTop: 16, lineHeight: 1.7 }}>
          <b>รันในเครื่อง:</b> คัดลอก <code>.env.local.example</code> เป็น <code>.env.local</code> แล้วใส่ค่าจริง
          <br />
          <b>บน Vercel:</b> Project Settings → Environment Variables แล้ว Redeploy
          <br />
          หาค่าได้ที่ Supabase Dashboard → Project Settings → Data API
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
  const {
    phase, user, dataLoading, loadError, reload,
    cars, settings, viewAllCars, setActiveCar,
    dark, toggleTheme, logout, alertCount, quickOpen, setQuickOpen,
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
        <div style={{ padding: '4px 11px 8px', fontSize: 11.5, color: 'var(--faint)', wordBreak: 'break-all' }}>
          {user?.email}
        </div>
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
              value={carValue}
              onChange={(e) => setActiveCar(e.target.value)}
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

        <div className="views">
          {loadError ? (
            <div className="alert danger" style={{ marginBottom: 14 }}>
              <Icon name="alert" />
              <div style={{ flex: 1 }}>
                <div className="t1">โหลดข้อมูลไม่สำเร็จ</div>
                <div className="t2">{loadError}</div>
              </div>
              <button type="button" className="btn btn-sm" onClick={() => reload(user.id)}>ลองใหม่</button>
            </div>
          ) : null}

          {dataLoading && !loadError ? (
            <FullScreenMessage>กำลังโหลดข้อมูลจาก Supabase…</FullScreenMessage>
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
