'use client';
/**
 * กราฟ SVG เขียนเอง — ไม่มี dependency ภายนอก
 * สีทุกจุดอ้างอิง CSS variable ผ่าน style={{fill:...}} กราฟจึงเปลี่ยนตาม Dark/Light เองโดยไม่ต้องวาดใหม่
 * ความกว้างวัดจาก container จริง (ResizeObserver) เพื่อให้ตัวอักษรบนแกนคมและอ่านออกบนมือถือ
 */
import { useEffect, useRef, useState } from 'react';
import { shortNum } from '@/lib/format';
import { EmptyState } from './ui';

/** วัดความกว้างของ container */
function useMeasure() {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = () => setW(el.clientWidth);
    set();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', set);
      return () => window.removeEventListener('resize', set);
    }
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function useTip() {
  const [tip, setTip] = useState(null);
  useEffect(() => {
    const hide = () => setTip(null);
    window.addEventListener('scroll', hide, true);
    return () => window.removeEventListener('scroll', hide, true);
  }, []);
  const bind = (content) => ({
    onPointerEnter: (e) => setTip({ x: e.clientX, y: e.clientY, content }),
    onPointerDown: (e) => setTip({ x: e.clientX, y: e.clientY, content }),
    onPointerMove: (e) => setTip((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : t)),
    onPointerLeave: () => setTip(null),
  });
  return [tip, bind];
}

function TipBox({ tip }) {
  if (!tip) return null;
  const vw = typeof window === 'undefined' ? 1024 : window.innerWidth;
  const left = Math.min(tip.x + 14, Math.max(8, vw - 210));
  return (
    <div className="tip" style={{ left, top: tip.y - 12, transform: 'translateY(-100%)' }}>
      {tip.content}
    </div>
  );
}

/** หาสเกลแกน Y ที่ลงตัว เช่น 0 / 25 / 50 / 75 / 100 */
function niceScale(max, ticks = 4) {
  if (!(max > 0)) return { max: 1, step: 1 / ticks, ticks };
  const raw = max / ticks;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const r = raw / p;
  const m = r <= 1 ? 1 : r <= 2 ? 2 : r <= 2.5 ? 2.5 : r <= 5 ? 5 : 10;
  const step = m * p;
  return { max: step * ticks, step, ticks };
}

function Legend({ items, center }) {
  const shown = items.filter((i) => i.name);
  if (!shown.length) return null;
  return (
    <div className="legend" style={center ? { justifyContent: 'center' } : undefined}>
      {shown.map((s) => (
        <span key={s.name}>
          <i style={{ background: s.color }} />
          {s.name}
        </span>
      ))}
    </div>
  );
}

/* ------------------------------- กราฟแท่ง ------------------------------- */
export function BarChart({ labels, series, stacked, height = 232, tip: tipFor, empty }) {
  const [ref, W] = useMeasure();
  const [tip, bind] = useTip();

  const body = (() => {
    if (!labels.length) return <EmptyState message={empty || 'ยังไม่มีข้อมูลพอที่จะแสดงกราฟ'} />;
    if (W < 40) return <div style={{ height }} />;

    const PL = 46;
    const PR = 10;
    const PT = 12;
    const PB = 26;
    const pw = W - PL - PR;
    const ph = height - PT - PB;

    let peak = 0;
    labels.forEach((_, i) => {
      if (stacked) peak = Math.max(peak, series.reduce((a, s) => a + Math.max(0, s.values[i] || 0), 0));
      else series.forEach((s) => { peak = Math.max(peak, s.values[i] || 0); });
    });
    const sc = niceScale(peak);
    const y = (v) => PT + ph - (v / sc.max) * ph;
    const gw = pw / labels.length;
    const bw = Math.max(3, Math.min(46, gw * 0.62));
    const skip = Math.ceil(labels.length / Math.max(1, Math.floor(pw / 46)));

    const gridlines = [];
    for (let t = 0; t <= sc.ticks; t++) {
      const v = sc.step * t;
      const yy = y(v);
      gridlines.push(
        <g key={`g${t}`}>
          <line className="gridline" x1={PL} y1={yy} x2={W - PR} y2={yy} />
          <text className="axis" x={PL - 7} y={yy + 3.5} textAnchor="end">{shortNum(v)}</text>
        </g>
      );
    }

    return (
      <>
        <div className="chart">
          <svg viewBox={`0 0 ${W} ${height}`} style={{ height }}>
            {gridlines}
            {labels.map((lab, i) => {
              const cx = PL + gw * i + gw / 2;
              const content = tipFor ? tipFor(i) : null;
              const bars = [];
              if (stacked) {
                let acc = 0;
                series.forEach((s, k) => {
                  const v = Math.max(0, s.values[i] || 0);
                  if (!v) return;
                  const top = y(acc + v);
                  const h = (v / sc.max) * ph;
                  bars.push(
                    <rect key={k} className="bar" x={cx - bw / 2} y={top} width={bw}
                      height={Math.max(1, h)} rx={2} style={{ fill: s.color }} {...bind(content)} />
                  );
                  acc += v;
                });
              } else {
                const sub = bw / series.length;
                series.forEach((s, k) => {
                  const v = Math.max(0, s.values[i] || 0);
                  const h = (v / sc.max) * ph;
                  bars.push(
                    <rect key={k} className="bar" x={cx - bw / 2 + sub * k} y={y(v)}
                      width={Math.max(1, sub - (series.length > 1 ? 1.5 : 0))}
                      height={Math.max(1, h)} rx={2} style={{ fill: s.color }} {...bind(content)} />
                  );
                });
              }
              return (
                <g key={i}>
                  {bars}
                  {i % skip === 0 ? (
                    <text className="axis" x={cx} y={height - PB + 15} textAnchor="middle">{lab}</text>
                  ) : null}
                </g>
              );
            })}
            <line className="axisline" x1={PL} y1={PT + ph} x2={W - PR} y2={PT + ph} />
          </svg>
        </div>
        <Legend items={series} />
      </>
    );
  })();

  return (
    <div ref={ref}>
      {body}
      <TipBox tip={tip} />
    </div>
  );
}

/* ------------------------------- กราฟเส้น ------------------------------- */
export function LineChart({ labels, values, color, height = 232, tip: tipFor, avg, avgLabel, legend, empty }) {
  const [ref, W] = useMeasure();
  const [tip, bind] = useTip();

  const points = values.map((v, i) => ({ v, i })).filter((d) => Number.isFinite(d.v));

  const body = (() => {
    if (points.length < 2) return <EmptyState message={empty || 'ต้องมีข้อมูลอย่างน้อย 2 จุดจึงจะแสดงแนวโน้มได้'} />;
    if (W < 40) return <div style={{ height }} />;

    const PL = 46;
    const PR = 12;
    const PT = 12;
    const PB = 26;
    const pw = W - PL - PR;
    const ph = height - PT - PB;
    const sc = niceScale(Math.max(...points.map((d) => d.v)));
    const y = (v) => PT + ph - (v / sc.max) * ph;
    const x = (i) => PL + (labels.length > 1 ? (pw * i) / (labels.length - 1) : pw / 2);
    const d = points.map((p, k) => `${k ? 'L' : 'M'}${x(p.i)} ${y(p.v)}`).join(' ');
    const area = `${d} L${x(points[points.length - 1].i)} ${PT + ph} L${x(points[0].i)} ${PT + ph} Z`;
    const skip = Math.ceil(labels.length / Math.max(1, Math.floor(pw / 46)));

    const gridlines = [];
    for (let t = 0; t <= sc.ticks; t++) {
      const v = sc.step * t;
      const yy = y(v);
      gridlines.push(
        <g key={`g${t}`}>
          <line className="gridline" x1={PL} y1={yy} x2={W - PR} y2={yy} />
          <text className="axis" x={PL - 7} y={yy + 3.5} textAnchor="end">{shortNum(v)}</text>
        </g>
      );
    }

    return (
      <>
        <div className="chart">
          <svg viewBox={`0 0 ${W} ${height}`} style={{ height }}>
            {gridlines}
            <path d={area} style={{ fill: color, opacity: 0.1 }} />
            <path d={d} fill="none" style={{ stroke: color }} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {Number.isFinite(avg) ? (
              <line x1={PL} y1={y(avg)} x2={W - PR} y2={y(avg)} style={{ stroke: 'var(--faint)' }}
                strokeWidth="1.2" strokeDasharray="4 4" />
            ) : null}
            {labels.map((lab, i) =>
              i % skip === 0 ? (
                <text key={i} className="axis" x={x(i)} y={height - PB + 15} textAnchor="middle">{lab}</text>
              ) : null
            )}
            {points.map((p) => (
              <g key={p.i}>
                <circle cx={x(p.i)} cy={y(p.v)} r="3" style={{ fill: 'var(--surface)', stroke: color }} strokeWidth="2" />
                <circle cx={x(p.i)} cy={y(p.v)} r="11" fill="transparent" {...bind(tipFor ? tipFor(p.i) : null)} />
              </g>
            ))}
            <line className="axisline" x1={PL} y1={PT + ph} x2={W - PR} y2={PT + ph} />
          </svg>
        </div>
        {legend || avgLabel ? (
          <div className="legend">
            {legend ? (<span><i style={{ background: color }} />{legend}</span>) : null}
            {avgLabel ? (
              <span style={{ borderTop: '1.5px dashed var(--faint)', paddingTop: 2 }}>{avgLabel}</span>
            ) : null}
          </div>
        ) : null}
      </>
    );
  })();

  return (
    <div ref={ref}>
      {body}
      <TipBox tip={tip} />
    </div>
  );
}

/** เส้นแนวโน้มขนาดเล็ก ไม่มีแกน ใช้ประกอบตัวเลขในการ์ด */
export function Sparkline({ values, color = 'var(--dc)', height = 46 }) {
  const [ref, W] = useMeasure();
  const pts = values.filter((v) => Number.isFinite(v));
  if (pts.length < 2) return <div ref={ref} style={{ height }} />;

  const w = Math.max(60, W || 120);
  const max = Math.max(...pts);
  const min = Math.min(...pts);
  const span = max - min || 1;
  const pad = 4;
  const x = (i) => (w * i) / (pts.length - 1);
  const y = (v) => pad + (height - pad * 2) * (1 - (v - min) / span);
  const d = pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');

  return (
    <div ref={ref}>
      <svg viewBox={`0 0 ${w} ${height}`} style={{ height, width: '100%', display: 'block' }} aria-hidden="true">
        <path d={`${d} L${w} ${height} L0 ${height} Z`} style={{ fill: color, opacity: 0.12 }} />
        <path d={d} fill="none" style={{ stroke: color }} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/* -------------------------------- โดนัท -------------------------------- */
export function DonutChart({ slices, center, sub, unit = '', empty }) {
  const [tip, bind] = useTip();
  const shown = slices.filter((s) => s.value > 0);
  const total = shown.reduce((a, s) => a + s.value, 0);
  if (!total) return <EmptyState message={empty || 'ยังไม่มีข้อมูลพอที่จะแสดงกราฟ'} />;

  const S = 176;
  const R = 76;
  const r = 49;
  const C = S / 2;
  const pt = (rad, ang) => `${(C + rad * Math.cos(ang)).toFixed(2)} ${(C + rad * Math.sin(ang)).toFixed(2)}`;

  let a0 = -Math.PI / 2;
  const paths = shown.map((s, i) => {
    const frac = s.value / total;
    const a1 = a0 + frac * Math.PI * 2;
    const big = frac > 0.5 ? 1 : 0;
    const d =
      frac >= 0.9999
        ? `M ${pt(R, 0)} A ${R} ${R} 0 1 1 ${pt(R, Math.PI)} A ${R} ${R} 0 1 1 ${pt(R, 0)} M ${pt(r, 0)} A ${r} ${r} 0 1 0 ${pt(r, Math.PI)} A ${r} ${r} 0 1 0 ${pt(r, 0)} Z`
        : `M ${pt(R, a0)} A ${R} ${R} 0 ${big} 1 ${pt(R, a1)} L ${pt(r, a1)} A ${r} ${r} 0 ${big} 0 ${pt(r, a0)} Z`;
    const node = (
      <path key={i} d={d} className="bar" fillRule="evenodd" style={{ fill: s.color }}
        {...bind(<><b>{s.label}</b><br />{unit}{shortNum(s.value)} · {(frac * 100).toFixed(1)}%</>)} />
    );
    a0 = a1;
    return node;
  });

  return (
    <div>
      <div className="chart" style={{ display: 'flex', justifyContent: 'center' }}>
        <svg viewBox={`0 0 ${S} ${S}`} style={{ width: S, height: S }}>
          {paths}
          <text x={C} y={C - 2} textAnchor="middle" style={{ fontSize: 19, fontWeight: 680, fill: 'var(--text)' }}>{center}</text>
          <text x={C} y={C + 15} textAnchor="middle" style={{ fontSize: 10.5, fill: 'var(--faint)' }}>{sub}</text>
        </svg>
      </div>
      <Legend center items={shown.map((s) => ({ name: `${s.label} · ${unit}${shortNum(s.value)}`, color: s.color }))} />
      <TipBox tip={tip} />
    </div>
  );
}
