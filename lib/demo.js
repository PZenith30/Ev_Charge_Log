/** สร้างข้อมูลตัวอย่าง เพื่อให้เห็นหน้าตาแดชบอร์ด/รายงานได้ทันทีโดยไม่ต้องกรอกเอง */
import { uid, todayISO, shiftDays } from './format';
import { DEFAULT_SETTINGS } from './storage';

export function buildDemoState(settings = {}) {
  const carId = uid();
  const car = {
    id: carId, name: 'BYD คันหลัก', brand: 'BYD', model: 'Atto 3',
    batt: 60.5, range: 480, odo: 12000, plate: '',
  };

  const stations = [
    ['บ้าน', 'AC'], ['บ้าน', 'AC'], ['PTT Station', 'DC'], ['บ้าน', 'AC'],
    ['EA Anywhere', 'DC'], ['บ้าน', 'AC'], ['Sharge · เซ็นทรัล', 'DC'], ['บ้าน', 'AC'],
  ];
  const sessions = [];
  const cursor = new Date();
  cursor.setMonth(cursor.getMonth() - 5);
  let odo = car.odo;

  for (let i = 0; i < 26; i++) {
    cursor.setDate(cursor.getDate() + 5 + Math.floor(Math.random() * 3));
    if (cursor > new Date()) break;
    const [station, type] = stations[i % stations.length];
    const kwh = type === 'DC' ? 28 + Math.random() * 22 : 16 + Math.random() * 14;
    const realEff = 5.0 + Math.random() * 1.5;            // km/kWh
    const dist = Math.round(kwh * realEff);
    const price = type === 'DC' ? 7.0 + Math.random() * 1.5 : 4.2 + Math.random() * 0.6;
    const fee = type === 'DC' && Math.random() < 0.4 ? 20 : 0;
    const socBefore = 15 + Math.floor(Math.random() * 25);
    const before = odo;
    odo += dist;
    sessions.push({
      id: uid(),
      carId,
      date: todayISO(cursor),
      time: ['08:30', '19:45', '12:10', '22:05'][i % 4],
      type,
      // DC ราว 25–45 นาที · AC ชาร์จค้างไว้ 3–7 ชม. (เก็บเป็นวินาที)
      durationSec: type === 'DC'
        ? (25 + Math.floor(Math.random() * 20)) * 60 + Math.floor(Math.random() * 60)
        : (180 + Math.floor(Math.random() * 240)) * 60 + Math.floor(Math.random() * 60),
      station,
      odoBefore: before,
      odoAfter: odo,
      socBefore,
      socAfter: Math.min(100, socBefore + Math.round((kwh / car.batt) * 100)),
      kwh: Number(kwh.toFixed(2)),
      price: Number(price.toFixed(2)),
      fee,
      total: Number((kwh * price + fee).toFixed(2)),
      dashEff: Number((realEff + (Math.random() - 0.5) * 0.3).toFixed(2)),
      dashEffUnit: 'km/kWh',
      note: '',
      images: [],
      created: Date.now() + i,
    });
  }
  car.odo = odo;

  const y = new Date().getFullYear();
  const costs = [
    { id: uid(), carId, cat: 'insurance', date: `${y}-01-15`, amount: 18500, note: 'ประกันชั้น 1 รายปี', images: [] },
    { id: uid(), carId, cat: 'tax', date: `${y}-02-08`, amount: 1350, note: 'ต่อภาษีประจำปี', images: [] },
    { id: uid(), carId, cat: 'maintenance', date: `${y}-03-22`, amount: 2800, note: 'เช็คระยะ 20,000 km', images: [] },
    { id: uid(), carId, cat: 'electric', date: `${y}-04-05`, amount: 1420, note: 'ค่าไฟบ้าน (ส่วนที่ใช้ชาร์จรถ)', images: [] },
    { id: uid(), carId, cat: 'other', date: `${y}-05-11`, amount: 990, note: 'ติดฟิล์มกรองแสงเพิ่ม', images: [] },
  ];

  const alerts = [
    { id: uid(), carId, type: 'maintenance', title: 'เช็คระยะ 40,000 km', due: shiftDays(21), advance: 30 },
    { id: uid(), carId, type: 'insurance', title: 'ต่อประกันชั้น 1', due: shiftDays(95), advance: 45 },
    { id: uid(), carId, type: 'tax', title: 'ต่อภาษีรถยนต์', due: shiftDays(-4), advance: 30 },
  ];

  return {
    cars: [car],
    sessions,
    costs,
    alerts,
    settings: { ...DEFAULT_SETTINGS, ...settings, activeCar: carId, budget: 6000 },
  };
}
