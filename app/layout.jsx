import './globals.css';
import { StoreProvider } from '@/components/store';
import AppShell from '@/components/AppShell';

const DESCRIPTION =
  'บันทึกการชาร์จรถ EV แต่ละครั้ง คำนวณระยะทาง ค่าใช้จ่าย และอัตราสิ้นเปลืองอัตโนมัติ พร้อมแดชบอร์ดและรายงานสรุป';

/**
 * โดเมนของเว็ป จำเป็นสำหรับ og:image เพราะ LINE และ Facebook รับเฉพาะ URL เต็ม
 * Vercel ตั้ง VERCEL_PROJECT_PRODUCTION_URL ให้เองตอน build จึงไม่ต้องมากรอกมือ
 * แต่ถ้าต่อโดเมนของตัวเองแล้ว ให้ตั้ง NEXT_PUBLIC_SITE_URL ทับ ไม่งั้นรูปจะชี้ไปโดเมน .vercel.app
 */
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
  (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ||
  'http://localhost:3000';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'EV Charge Log — บันทึกการชาร์จรถไฟฟ้า',
  applicationName: 'EV Charge Log',
  // iOS ไม่อ่าน manifest จึงต้องบอกผ่าน meta ของตัวเองว่าเปิดแบบเต็มจอได้
  appleWebApp: { capable: true, title: 'EV Charge', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
  icons: { apple: '/apple-touch-icon.png' },
  description: DESCRIPTION,

  // การ์ดตัวอย่างตอนแชร์ลิงก์ใน LINE / Facebook / Messenger
  openGraph: {
    type: 'website',
    siteName: 'KiloEV',
    title: 'KiloEV — บันทึกการชาร์จรถไฟฟ้า',
    description: DESCRIPTION,
    url: '/',
    locale: 'th_TH',
    // รูปนิ่งที่สร้างไว้ล่วงหน้าด้วย doc/make-og.js ไม่ได้เรนเดอร์ตอน runtime
    // จะได้ไม่ต้องพึ่ง edge function และตรวจไฟล์จริงด้วยตาได้ก่อน deploy
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'KiloEV' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'KiloEV — บันทึกการชาร์จรถไฟฟ้า',
    description: DESCRIPTION,
    images: ['/og.png'],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#22c55e',
};

/**
 * ตั้งธีมก่อนเบราว์เซอร์วาดหน้าแรก เพื่อไม่ให้เห็นจอขาววาบตอนใช้ Dark mode
 * ธีมจริงเก็บใน Supabase แต่มิเรอร์ไว้ใน localStorage เพราะสคริปต์นี้ต้องทำงานก่อนโหลดข้อมูล
 * ('evlog.v1' คือคีย์ของแอปรุ่นก่อน เผื่อผู้ใช้ที่ยังไม่ได้ย้ายข้อมูล)
 */
const themeBoot = `(function(){try{
var t=localStorage.getItem('evlog.theme');
if(!t){var raw=localStorage.getItem('evlog.v1');
  if(raw){var s=(JSON.parse(raw)||{}).settings;if(s&&s.theme)t=s.theme;}}
var d=t==='dark'||((!t||t==='auto')&&window.matchMedia('(prefers-color-scheme: dark)').matches);
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
