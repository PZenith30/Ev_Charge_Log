import './globals.css';
import { StoreProvider } from '@/components/store';
import AppShell from '@/components/AppShell';

export const metadata = {
  title: 'EV Charge Log — บันทึกการชาร์จรถไฟฟ้า',
  description:
    'บันทึกการชาร์จรถ EV แต่ละครั้ง คำนวณระยะทาง ค่าใช้จ่าย และอัตราสิ้นเปลืองอัตโนมัติ พร้อมแดชบอร์ดและรายงานสรุป',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0f9f6e',
};

/**
 * ตั้งธีมก่อนเบราว์เซอร์วาดหน้าแรก เพื่อไม่ให้เห็นจอขาววาบตอนใช้ Dark mode
 * อ่านค่าจาก localStorage คีย์เดียวกับที่แอปใช้
 */
const themeBoot = `(function(){try{
var t='auto',raw=localStorage.getItem('evlog.v1');
if(raw){var s=(JSON.parse(raw)||{}).settings;if(s&&s.theme)t=s.theme;}
var d=t==='dark'||(t==='auto'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
document.documentElement.setAttribute('data-theme',d?'dark':'light');
}catch(e){}})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="th" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body>
        <StoreProvider>
          <AppShell>{children}</AppShell>
        </StoreProvider>
      </body>
    </html>
  );
}
