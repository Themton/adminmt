import React, { useState, useMemo } from "react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell
} from "recharts";

// ═══════════════════════════════════════════
//  Theme — matching BossDashboard
// ═══════════════════════════════════════════
const C = {
  font: "'Sarabun', 'Noto Sans Thai', sans-serif",
  fontSans: "'Sarabun', 'Noto Sans Thai', sans-serif",
  bg: '#f4f1ec',
  surface: '#ffffff',
  surfaceAlt: '#faf8f5',
  surfaceHover: '#f0ede6',
  border: '#e0ddd5',
  borderDark: '#c9c4b8',
  text: '#2c2c2c',
  textDim: '#6b6560',
  textMuted: '#a09890',
  accent: '#8b4513',
  accentDark: '#6b3410',
  accentLight: '#a0612b',
  success: '#2e7d32',
  successLight: '#4caf50',
  danger: '#c62828',
  dangerLight: '#ef5350',
  gold: '#b8860b',
  navy: '#1a1a2e',
  navyLight: '#2d2d44',
  cream: '#fdfbf7',
  shadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
  shadowMd: '0 4px 12px rgba(0,0,0,0.08)',
  shadowLg: '0 10px 30px rgba(0,0,0,0.1)',
};

const fmt = (n) => new Intl.NumberFormat('th-TH').format(Math.round(n));
const fmtDateFull = (d) => new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
const fmtMonth = (d) => new Date(d).toLocaleDateString('th-TH', { month: 'short', year: '2-digit' });

const card = {
  background: C.surface,
  borderRadius: 2,
  boxShadow: C.shadow,
  border: `1px solid ${C.border}`,
};

const th = {
  padding: '10px 14px',
  borderBottom: `2px solid ${C.borderDark}`,
  fontSize: 11,
  fontWeight: 700,
  color: C.textDim,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  fontFamily: C.fontSans,
  textAlign: 'left',
};
const td = {
  padding: '10px 14px',
  borderBottom: `1px solid ${C.border}`,
  fontSize: 13,
  fontFamily: C.fontSans,
};

// ═══════════════════════════════════════════
//  Custom Tooltip
// ═══════════════════════════════════════════
function ClassicTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const isMoney = (name) => !name?.includes('ออเดอร์') && !name?.includes('จำนวน') && !name?.includes('count');
  return (
    <div style={{ background: C.navy, padding: '10px 14px', borderRadius: 2, boxShadow: C.shadowMd }}>
      {label && <div style={{ fontSize: 11, color: '#a0a0b0', marginBottom: 4, fontFamily: C.fontSans }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ fontSize: 13, color: '#fff', fontWeight: 600, fontFamily: C.fontSans }}>
          {p.name}: {typeof p.value === 'number' ? (isMoney(p.name) ? `฿${fmt(p.value)}` : fmt(p.value)) : p.value}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════
//  Growth Badge
// ═══════════════════════════════════════════
function GrowthBadge({ cur, prev }) {
  const g = prev > 0 ? ((cur - prev) / prev * 100) : cur > 0 ? 100 : 0;
  const up = g >= 0;
  return (
    <span style={{
      fontSize: 11, fontWeight: 700,
      color: up ? C.success : C.danger,
      background: up ? '#e8f5e9' : '#fef2f2',
      padding: '2px 8px', borderRadius: 2,
    }}>
      {up ? '▲' : '▼'} {Math.abs(g).toFixed(1)}%
    </span>
  );
}

// ═══════════════════════════════════════════
//  DEMO DATA GENERATOR
//  (ลบส่วนนี้ออกตอนใช้จริง — ใช้ orders จาก props แทน)
// ═══════════════════════════════════════════
function generateDemoOrders() {
  const employees = ['สมชาย', 'สมหญิง', 'วิชัย', 'พิมพ์', 'อานนท์', 'กรรณิกา'];
  const products = ['ครีมบำรุง', 'เซรั่ม', 'โลชั่น', 'สบู่', 'แชมพู', 'ครีมกันแดด'];
  const channels = ['LINE', 'Facebook', 'TikTok', 'Shopee'];
  const provinces = ['กรุงเทพ', 'เชียงใหม่', 'ชลบุรี', 'นครราชสีมา', 'ขอนแก่น', 'สงขลา', 'ภูเก็ต'];
  const orders = [];
  // Generate 4 months of data
  for (let m = 0; m < 4; m++) {
    const baseDate = new Date();
    baseDate.setMonth(baseDate.getMonth() - m);
    const daysInMonth = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0).getDate();
    const ordersThisMonth = 120 + Math.floor(Math.random() * 80) - m * 15;
    for (let i = 0; i < ordersThisMonth; i++) {
      const day = Math.ceil(Math.random() * Math.min(daysInMonth, baseDate.getMonth() === new Date().getMonth() ? new Date().getDate() : daysInMonth));
      const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), day);
      const price = 300 + Math.floor(Math.random() * 2500);
      const isTrans = Math.random() > 0.55;
      orders.push({
        id: `demo-${m}-${i}`,
        order_date: d.toISOString().split('T')[0],
        employee_name: employees[Math.floor(Math.random() * employees.length)],
        sale_price: price,
        cod_amount: isTrans ? 0 : price,
        payment_type: isTrans ? 'transfer' : 'cod',
        remark: products[Math.floor(Math.random() * products.length)],
        sales_channel: channels[Math.floor(Math.random() * channels.length)],
        province: provinces[Math.floor(Math.random() * provinces.length)],
        created_at: d.toISOString(),
      });
    }
  }
  return orders;
}

// ═══════════════════════════════════════════
//  MAIN: SalesCompare Component
// ═══════════════════════════════════════════
export default function SalesCompare({ orders: externalOrders, teams = [], productMap = {} }) {
  // Use external orders or demo data
  const allOrders = useMemo(() => externalOrders || generateDemoOrders(), [externalOrders]);

  // ─── State ───
  const [compareMode, setCompareMode] = useState('custom'); // custom | month | employee | product | channel
  const [chartType, setChartType] = useState('bar'); // bar | line | area

  // Custom date compare
  const todayStr = new Date().toISOString().split('T')[0];
  const thisMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const [dateA_from, setDateA_from] = useState(thisMonthStart);
  const [dateA_to, setDateA_to] = useState(todayStr);
  const lastMonthStart = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().split('T')[0];
  const lastMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString().split('T')[0];
  const [dateB_from, setDateB_from] = useState(lastMonthStart);
  const [dateB_to, setDateB_to] = useState(lastMonthEnd);

  // Month compare
  const [monthA, setMonthA] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });
  const [monthB, setMonthB] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });

  // Dimension compare
  const [dimension, setDimension] = useState('employee'); // for dimension mode
  const [selectedItemsA, setSelectedItemsA] = useState([]);
  const [selectedItemsB, setSelectedItemsB] = useState([]);

  // Quick preset
  const applyPreset = (key) => {
    const now = new Date();
    if (key === 'today_vs_yesterday') {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      setDateA_from(todayStr); setDateA_to(todayStr);
      setDateB_from(y.toISOString().split('T')[0]); setDateB_to(y.toISOString().split('T')[0]);
      setCompareMode('custom');
    } else if (key === 'thisweek_vs_lastweek') {
      const dow = now.getDay() || 7;
      const monThis = new Date(now); monThis.setDate(now.getDate() - dow + 1);
      const sunThis = new Date(monThis); sunThis.setDate(monThis.getDate() + 6);
      const monLast = new Date(monThis); monLast.setDate(monThis.getDate() - 7);
      const sunLast = new Date(monLast); sunLast.setDate(monLast.getDate() + 6);
      setDateA_from(monThis.toISOString().split('T')[0]); setDateA_to(todayStr);
      setDateB_from(monLast.toISOString().split('T')[0]); setDateB_to(sunLast.toISOString().split('T')[0]);
      setCompareMode('custom');
    } else if (key === 'thismonth_vs_lastmonth') {
      setDateA_from(thisMonthStart); setDateA_to(todayStr);
      setDateB_from(lastMonthStart); setDateB_to(lastMonthEnd);
      setCompareMode('custom');
    }
  };

  // ─── Compute stats for a date range ───
  const computeRange = (from, to) => {
    const filtered = allOrders.filter(o => {
      const d = (o.order_date || '').substring(0, 10);
      return d >= from && d <= to;
    });
    let sales = 0, cod = 0, trans = 0, codAmt = 0, transAmt = 0;
    const byEmployee = {}, byProduct = {}, byChannel = {}, byProvince = {}, byDate = {};
    filtered.forEach(o => {
      const amt = parseFloat(o.sale_price) || 0;
      sales += amt;
      if (o.payment_type === 'transfer') { trans++; transAmt += amt; } else { cod++; codAmt += amt; }
      const emp = o.employee_name || '—';
      if (!byEmployee[emp]) byEmployee[emp] = { name: emp, sales: 0, count: 0 };
      byEmployee[emp].sales += amt; byEmployee[emp].count++;

      const prod = productMap[(o.remark || '').trim()] || (o.remark || '').trim() || '—';
      if (!byProduct[prod]) byProduct[prod] = { name: prod, sales: 0, count: 0 };
      byProduct[prod].sales += amt; byProduct[prod].count++;

      const ch = o.sales_channel || '—';
      if (!byChannel[ch]) byChannel[ch] = { name: ch, sales: 0, count: 0 };
      byChannel[ch].sales += amt; byChannel[ch].count++;

      const prov = o.province || '—';
      if (!byProvince[prov]) byProvince[prov] = { name: prov, sales: 0, count: 0 };
      byProvince[prov].sales += amt; byProvince[prov].count++;

      const d = (o.order_date || '').substring(0, 10);
      if (!byDate[d]) byDate[d] = { date: d, sales: 0, count: 0 };
      byDate[d].sales += amt; byDate[d].count++;
    });
    return {
      orders: filtered, sales, count: filtered.length,
      avg: filtered.length > 0 ? sales / filtered.length : 0,
      cod, trans, codAmt, transAmt,
      byEmployee: Object.values(byEmployee).sort((a, b) => b.sales - a.sales),
      byProduct: Object.values(byProduct).sort((a, b) => b.sales - a.sales),
      byChannel: Object.values(byChannel).sort((a, b) => b.sales - a.sales),
      byProvince: Object.values(byProvince).sort((a, b) => b.sales - a.sales),
      byDate: Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date)),
    };
  };

  // ─── Computed data based on mode ───
  const result = useMemo(() => {
    if (compareMode === 'custom') {
      const a = computeRange(dateA_from, dateA_to);
      const b = computeRange(dateB_from, dateB_to);
      return { a, b, labelA: `${fmtDateFull(dateA_from)} – ${fmtDateFull(dateA_to)}`, labelB: `${fmtDateFull(dateB_from)} – ${fmtDateFull(dateB_to)}` };
    }
    if (compareMode === 'month') {
      const [yA, mA] = monthA.split('-').map(Number);
      const [yB, mB] = monthB.split('-').map(Number);
      const fromA = `${yA}-${String(mA).padStart(2, '0')}-01`;
      const toA = new Date(yA, mA, 0).toISOString().split('T')[0];
      const fromB = `${yB}-${String(mB).padStart(2, '0')}-01`;
      const toB = new Date(yB, mB, 0).toISOString().split('T')[0];
      const a = computeRange(fromA, toA);
      const b = computeRange(fromB, toB);
      return { a, b, labelA: fmtMonth(fromA), labelB: fmtMonth(fromB) };
    }
    // For dimension modes, use full dataset
    if (['employee', 'product', 'channel'].includes(compareMode)) {
      const a = computeRange('2000-01-01', '2099-12-31');
      return { a, b: null };
    }
    return { a: computeRange(dateA_from, dateA_to), b: computeRange(dateB_from, dateB_to), labelA: 'ช่วง A', labelB: 'ช่วง B' };
  }, [allOrders, compareMode, dateA_from, dateA_to, dateB_from, dateB_to, monthA, monthB, productMap]);

  // ─── Dimension comparison chart data ───
  const dimensionData = useMemo(() => {
    if (!['employee', 'product', 'channel'].includes(compareMode) || !result.a) return [];
    const map = compareMode === 'employee' ? result.a.byEmployee
      : compareMode === 'product' ? result.a.byProduct
      : result.a.byChannel;
    return map.slice(0, 15);
  }, [result, compareMode]);

  // ─── Period overlay chart (daily aligned) ───
  const overlayChart = useMemo(() => {
    if (!result.a || !result.b) return [];
    const maxLen = Math.max(result.a.byDate.length, result.b.byDate.length);
    const data = [];
    for (let i = 0; i < maxLen; i++) {
      data.push({
        day: `วันที่ ${i + 1}`,
        ชุดA: result.a.byDate[i]?.sales || 0,
        ชุดB: result.b.byDate[i]?.sales || 0,
        'ออเดอร์A': result.a.byDate[i]?.count || 0,
        'ออเดอร์B': result.b.byDate[i]?.count || 0,
      });
    }
    return data;
  }, [result]);

  // ─── Employee/Product/Channel compare data ───
  const dimensionCompare = useMemo(() => {
    if (!result.a || !result.b) return [];
    const dimKey = compareMode === 'month' || compareMode === 'custom' ? 'byEmployee' : null;
    if (!dimKey) return [];
    const mapA = {}, mapB = {};
    result.a[dimKey].forEach(e => { mapA[e.name] = e; });
    result.b[dimKey].forEach(e => { mapB[e.name] = e; });
    const allNames = [...new Set([...Object.keys(mapA), ...Object.keys(mapB)])];
    return allNames.map(n => ({
      name: n,
      curSales: mapA[n]?.sales || 0, prevSales: mapB[n]?.sales || 0,
      curCount: mapA[n]?.count || 0, prevCount: mapB[n]?.count || 0,
    })).sort((a, b) => b.curSales - a.curSales);
  }, [result, compareMode]);

  // ═══════════════════════════════════════════
  //  Styles
  // ═══════════════════════════════════════════
  const modeBtn = (active) => ({
    padding: '8px 16px', border: `1px solid ${active ? C.accent : C.border}`,
    borderRadius: 2, background: active ? C.accent : C.surface,
    color: active ? '#fff' : C.textDim, fontSize: 12, fontWeight: 600,
    cursor: 'pointer', fontFamily: C.fontSans, transition: 'all 0.15s',
  });
  const presetBtn = {
    padding: '6px 12px', border: `1px solid ${C.border}`, borderRadius: 2,
    background: C.surfaceAlt, color: C.textDim, fontSize: 11, fontWeight: 500,
    cursor: 'pointer', fontFamily: C.fontSans,
  };
  const inputStyle = {
    padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 2,
    fontSize: 13, fontFamily: C.fontSans, background: C.surfaceAlt,
    color: C.text, outline: 'none',
  };
  const labelStyle = {
    fontSize: 10, fontWeight: 600, color: C.textMuted,
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4,
  };

  // ═══════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════
  return (
    <div style={{ fontFamily: C.fontSans, color: C.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&family=Noto+Sans+Thai:wght@300;400;500;600;700;800&display=swap');
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: fadeIn 0.3s ease; }
        input[type="date"]::-webkit-calendar-picker-indicator { cursor: pointer; }
        input[type="month"]::-webkit-calendar-picker-indicator { cursor: pointer; }
      `}</style>

      {/* ─── Header ─── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, fontFamily: C.font, color: C.text }}>📊 สถิติยอดขาย แบบเปรียบเทียบ</div>
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>เลือกโหมด และช่วงเวลาที่ต้องการเปรียบเทียบ</div>
        </div>
      </div>

      {/* ─── Mode Selector ─── */}
      <div style={{ ...card, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>โหมดเปรียบเทียบ</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setCompareMode('custom')} style={modeBtn(compareMode === 'custom')}>📅 กำหนดเอง</button>
          <button onClick={() => setCompareMode('month')} style={modeBtn(compareMode === 'month')}>📆 เดือน vs เดือน</button>
          <button onClick={() => setCompareMode('employee')} style={modeBtn(compareMode === 'employee')}>👥 พนักงาน</button>
          <button onClick={() => setCompareMode('product')} style={modeBtn(compareMode === 'product')}>📦 สินค้า</button>
          <button onClick={() => setCompareMode('channel')} style={modeBtn(compareMode === 'channel')}>📢 ช่องทาง</button>
        </div>
      </div>

      {/* ─── Custom Date Selector ─── */}
      {compareMode === 'custom' && (
        <div className="fade-in" style={{ ...card, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, letterSpacing: 1, display: 'flex', alignItems: 'center', marginRight: 8 }}>⚡ ด่วน:</div>
            <button onClick={() => applyPreset('today_vs_yesterday')} style={presetBtn}>วันนี้ vs เมื่อวาน</button>
            <button onClick={() => applyPreset('thisweek_vs_lastweek')} style={presetBtn}>สัปดาห์นี้ vs สัปดาห์ก่อน</button>
            <button onClick={() => applyPreset('thismonth_vs_lastmonth')} style={presetBtn}>เดือนนี้ vs เดือนก่อน</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 16, alignItems: 'end' }}>
            <div style={{ padding: 14, background: '#fef7ed', borderRadius: 2, border: `1px solid ${C.gold}33` }}>
              <div style={{ ...labelStyle, color: C.gold }}>🅰 ช่วง A (ปัจจุบัน)</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <input type="date" value={dateA_from} onChange={e => setDateA_from(e.target.value)} style={inputStyle} />
                <span style={{ alignSelf: 'center', fontSize: 12, color: C.textMuted }}>ถึง</span>
                <input type="date" value={dateA_to} onChange={e => setDateA_to(e.target.value)} style={inputStyle} />
              </div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.textMuted, alignSelf: 'center', padding: '0 8px' }}>VS</div>
            <div style={{ padding: 14, background: '#f0f4ff', borderRadius: 2, border: `1px solid ${C.navy}22` }}>
              <div style={{ ...labelStyle, color: C.navy }}>🅱 ช่วง B (เปรียบเทียบ)</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <input type="date" value={dateB_from} onChange={e => setDateB_from(e.target.value)} style={inputStyle} />
                <span style={{ alignSelf: 'center', fontSize: 12, color: C.textMuted }}>ถึง</span>
                <input type="date" value={dateB_to} onChange={e => setDateB_to(e.target.value)} style={inputStyle} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Month Selector ─── */}
      {compareMode === 'month' && (
        <div className="fade-in" style={{ ...card, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 16, alignItems: 'end' }}>
            <div style={{ padding: 14, background: '#fef7ed', borderRadius: 2, border: `1px solid ${C.gold}33` }}>
              <div style={labelStyle}>🅰 เดือน A</div>
              <input type="month" value={monthA} onChange={e => setMonthA(e.target.value)} style={{ ...inputStyle, width: '100%' }} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.textMuted, alignSelf: 'center', padding: '0 8px' }}>VS</div>
            <div style={{ padding: 14, background: '#f0f4ff', borderRadius: 2, border: `1px solid ${C.navy}22` }}>
              <div style={labelStyle}>🅱 เดือน B</div>
              <input type="month" value={monthB} onChange={e => setMonthB(e.target.value)} style={{ ...inputStyle, width: '100%' }} />
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════ */}
      {/*  PERIOD vs PERIOD RESULTS               */}
      {/* ════════════════════════════════════════ */}
      {(compareMode === 'custom' || compareMode === 'month') && result.a && result.b && (
        <div className="fade-in">
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
            {[
              { label: 'ยอดขาย', curVal: result.a.sales, prevVal: result.b.sales, prefix: '฿', isMoney: true },
              { label: 'ออเดอร์', curVal: result.a.count, prevVal: result.b.count },
              { label: 'เฉลี่ย/ออเดอร์', curVal: result.a.avg, prevVal: result.b.avg, prefix: '฿', isMoney: true },
              { label: 'COD / โอน', curVal: result.a.cod, prevVal: result.b.cod, extra: `โอน: ${result.a.trans} vs ${result.b.trans}` },
            ].map((item, i) => {
              const g = item.prevVal > 0 ? ((item.curVal - item.prevVal) / item.prevVal * 100) : item.curVal > 0 ? 100 : 0;
              const up = g >= 0;
              return (
                <div key={i} style={{ ...card, padding: 18, borderTop: `3px solid ${up ? C.success : C.danger}` }}>
                  <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 500, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>{item.label}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 22, fontWeight: 800, fontFamily: C.font, color: C.text }}>
                      {item.prefix || ''}{item.isMoney ? fmt(item.curVal) : item.curVal}
                    </span>
                    <GrowthBadge cur={item.curVal} prev={item.prevVal} />
                  </div>
                  <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>
                    ก่อนหน้า: {item.prefix || ''}{item.isMoney ? fmt(item.prevVal) : item.prevVal}
                  </div>
                  {item.extra && <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>{item.extra}</div>}
                </div>
              );
            })}
          </div>

          {/* Chart Type Toggle */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, justifyContent: 'flex-end' }}>
            {[
              { key: 'bar', icon: '📊' },
              { key: 'line', icon: '📈' },
              { key: 'area', icon: '📉' },
            ].map(ct => (
              <button key={ct.key} onClick={() => setChartType(ct.key)} style={{
                ...modeBtn(chartType === ct.key),
                padding: '5px 12px', fontSize: 11,
              }}>{ct.icon} {ct.key === 'bar' ? 'แท่ง' : ct.key === 'line' ? 'เส้น' : 'พื้นที่'}</button>
            ))}
          </div>

          {/* Overlay Chart */}
          {overlayChart.length > 0 && (
            <div style={{ ...card, padding: 20, marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4, fontFamily: C.font }}>ยอดขายรายวัน (ซ้อนทับ)</div>
              <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 12 }}>
                <span style={{ color: C.accent }}>■</span> {result.labelA} &nbsp;&nbsp;
                <span style={{ color: C.navy }}>■</span> {result.labelB}
              </div>
              <ResponsiveContainer width="100%" height={280}>
                {chartType === 'bar' ? (
                  <BarChart data={overlayChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: C.textDim }} />
                    <YAxis tick={{ fontSize: 10, fill: C.textDim }} tickFormatter={v => `฿${fmt(v)}`} />
                    <Tooltip content={<ClassicTooltip />} />
                    <Legend />
                    <Bar dataKey="ชุดA" fill={C.accent} radius={[3, 3, 0, 0]} name={`ช่วง A`} />
                    <Bar dataKey="ชุดB" fill={C.navy} radius={[3, 3, 0, 0]} name={`ช่วง B`} opacity={0.6} />
                  </BarChart>
                ) : chartType === 'line' ? (
                  <LineChart data={overlayChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: C.textDim }} />
                    <YAxis tick={{ fontSize: 10, fill: C.textDim }} tickFormatter={v => `฿${fmt(v)}`} />
                    <Tooltip content={<ClassicTooltip />} />
                    <Legend />
                    <Line type="monotone" dataKey="ชุดA" stroke={C.accent} strokeWidth={2.5} dot={{ r: 3 }} name={`ช่วง A`} />
                    <Line type="monotone" dataKey="ชุดB" stroke={C.navy} strokeWidth={2.5} dot={{ r: 3 }} name={`ช่วง B`} strokeDasharray="5 3" />
                  </LineChart>
                ) : (
                  <AreaChart data={overlayChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: C.textDim }} />
                    <YAxis tick={{ fontSize: 10, fill: C.textDim }} tickFormatter={v => `฿${fmt(v)}`} />
                    <Tooltip content={<ClassicTooltip />} />
                    <Legend />
                    <Area type="monotone" dataKey="ชุดA" fill={C.accent} fillOpacity={0.3} stroke={C.accent} strokeWidth={2} name={`ช่วง A`} />
                    <Area type="monotone" dataKey="ชุดB" fill={C.navy} fillOpacity={0.15} stroke={C.navy} strokeWidth={2} name={`ช่วง B`} strokeDasharray="5 3" />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </div>
          )}

          {/* Employee Comparison Table */}
          {dimensionCompare.length > 0 && (
            <div style={{ ...card, padding: 20, marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4, fontFamily: C.font }}>เปรียบเทียบรายพนักงาน</div>
              <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 12 }}>
                <span style={{ color: C.accent }}>■</span> {result.labelA} &nbsp; vs &nbsp;
                <span style={{ color: C.navy }}>■</span> {result.labelB}
              </div>
              <ResponsiveContainer width="100%" height={Math.min(400, Math.max(180, dimensionCompare.length * 32))}>
                <BarChart data={dimensionCompare.slice(0, 12)} layout="vertical" margin={{ left: 80, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: C.textDim }} tickFormatter={v => `฿${fmt(v)}`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: C.text }} width={80} />
                  <Tooltip content={<ClassicTooltip />} />
                  <Bar dataKey="curSales" fill={C.accent} radius={[0, 3, 3, 0]} name="ช่วง A" />
                  <Bar dataKey="prevSales" fill={C.borderDark} radius={[0, 3, 3, 0]} name="ช่วง B" />
                  <Legend />
                </BarChart>
              </ResponsiveContainer>

              {/* Detail Table */}
              <div style={{ overflowX: 'auto', marginTop: 16 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={th}>พนักงาน</th>
                      <th style={{ ...th, textAlign: 'center' }}>ออเดอร์ A</th>
                      <th style={{ ...th, textAlign: 'center' }}>ออเดอร์ B</th>
                      <th style={{ ...th, textAlign: 'right' }}>ยอด A</th>
                      <th style={{ ...th, textAlign: 'right' }}>ยอด B</th>
                      <th style={{ ...th, textAlign: 'center' }}>ผลต่าง</th>
                      <th style={{ ...th, textAlign: 'center' }}>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dimensionCompare.map(e => {
                      const diff = e.curSales - e.prevSales;
                      const g = e.prevSales > 0 ? ((diff) / e.prevSales * 100) : e.curSales > 0 ? 100 : 0;
                      const up = g >= 0;
                      return (
                        <tr key={e.name}>
                          <td style={{ ...td, fontWeight: 600 }}>{e.name}</td>
                          <td style={{ ...td, textAlign: 'center', fontWeight: 700, color: C.accent }}>{e.curCount}</td>
                          <td style={{ ...td, textAlign: 'center', color: C.textDim }}>{e.prevCount}</td>
                          <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: C.accent }}>฿{fmt(e.curSales)}</td>
                          <td style={{ ...td, textAlign: 'right', color: C.textDim }}>฿{fmt(e.prevSales)}</td>
                          <td style={{ ...td, textAlign: 'right', fontWeight: 600, color: up ? C.success : C.danger }}>
                            {up ? '+' : ''}฿{fmt(diff)}
                          </td>
                          <td style={{ ...td, textAlign: 'center' }}>
                            <GrowthBadge cur={e.curSales} prev={e.prevSales} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: C.surfaceAlt }}>
                      <td style={{ ...td, fontWeight: 800 }}>รวม</td>
                      <td style={{ ...td, textAlign: 'center', fontWeight: 700 }}>{result.a.count}</td>
                      <td style={{ ...td, textAlign: 'center', fontWeight: 600, color: C.textDim }}>{result.b.count}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 800, color: C.accent }}>฿{fmt(result.a.sales)}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 600, color: C.textDim }}>฿{fmt(result.b.sales)}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: result.a.sales >= result.b.sales ? C.success : C.danger }}>
                        {result.a.sales >= result.b.sales ? '+' : ''}฿{fmt(result.a.sales - result.b.sales)}
                      </td>
                      <td style={{ ...td, textAlign: 'center' }}>
                        <GrowthBadge cur={result.a.sales} prev={result.b.sales} />
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Product & Channel side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            {/* Product compare */}
            <div style={{ ...card, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12, fontFamily: C.font }}>📦 เปรียบเทียบสินค้า</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    <th style={th}>สินค้า</th>
                    <th style={{ ...th, textAlign: 'right' }}>A</th>
                    <th style={{ ...th, textAlign: 'right' }}>B</th>
                    <th style={{ ...th, textAlign: 'center' }}>%</th>
                  </tr></thead>
                  <tbody>
                    {(() => {
                      const mapA = {}, mapB = {};
                      result.a.byProduct.forEach(p => { mapA[p.name] = p; });
                      result.b.byProduct.forEach(p => { mapB[p.name] = p; });
                      const allP = [...new Set([...Object.keys(mapA), ...Object.keys(mapB)])];
                      return allP.map(n => ({
                        name: n, curSales: mapA[n]?.sales || 0, prevSales: mapB[n]?.sales || 0,
                        curCount: mapA[n]?.count || 0, prevCount: mapB[n]?.count || 0,
                      })).sort((a, b) => b.curSales - a.curSales).slice(0, 10).map(p => (
                        <tr key={p.name}>
                          <td style={{ ...td, fontWeight: 500, fontSize: 12 }}>{p.name}</td>
                          <td style={{ ...td, textAlign: 'right', fontSize: 12, fontWeight: 600 }}>฿{fmt(p.curSales)}</td>
                          <td style={{ ...td, textAlign: 'right', fontSize: 12, color: C.textDim }}>฿{fmt(p.prevSales)}</td>
                          <td style={{ ...td, textAlign: 'center' }}><GrowthBadge cur={p.curSales} prev={p.prevSales} /></td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
            {/* Channel compare */}
            <div style={{ ...card, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12, fontFamily: C.font }}>📢 เปรียบเทียบช่องทาง</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    <th style={th}>ช่องทาง</th>
                    <th style={{ ...th, textAlign: 'right' }}>A</th>
                    <th style={{ ...th, textAlign: 'right' }}>B</th>
                    <th style={{ ...th, textAlign: 'center' }}>%</th>
                  </tr></thead>
                  <tbody>
                    {(() => {
                      const mapA = {}, mapB = {};
                      result.a.byChannel.forEach(c => { mapA[c.name] = c; });
                      result.b.byChannel.forEach(c => { mapB[c.name] = c; });
                      const allC = [...new Set([...Object.keys(mapA), ...Object.keys(mapB)])];
                      return allC.map(n => ({
                        name: n, curSales: mapA[n]?.sales || 0, prevSales: mapB[n]?.sales || 0,
                      })).sort((a, b) => b.curSales - a.curSales).map(ch => (
                        <tr key={ch.name}>
                          <td style={{ ...td, fontWeight: 500, fontSize: 12 }}>{ch.name}</td>
                          <td style={{ ...td, textAlign: 'right', fontSize: 12, fontWeight: 600 }}>฿{fmt(ch.curSales)}</td>
                          <td style={{ ...td, textAlign: 'right', fontSize: 12, color: C.textDim }}>฿{fmt(ch.prevSales)}</td>
                          <td style={{ ...td, textAlign: 'center' }}><GrowthBadge cur={ch.curSales} prev={ch.prevSales} /></td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════ */}
      {/*  DIMENSION MODE (Employee/Product/Channel ranking) */}
      {/* ════════════════════════════════════════ */}
      {['employee', 'product', 'channel'].includes(compareMode) && result.a && (
        <div className="fade-in">
          <div style={{ ...card, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4, fontFamily: C.font }}>
              {compareMode === 'employee' ? '👥 เปรียบเทียบพนักงาน (ทั้งหมด)' :
               compareMode === 'product' ? '📦 เปรียบเทียบสินค้า (ทั้งหมด)' :
               '📢 เปรียบเทียบช่องทาง (ทั้งหมด)'}
            </div>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 14 }}>จัดอันดับจากยอดขายรวมทั้งหมด</div>
            <ResponsiveContainer width="100%" height={Math.min(450, Math.max(200, dimensionData.length * 34))}>
              <BarChart data={dimensionData} layout="vertical" margin={{ left: 100, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis type="number" tick={{ fontSize: 10, fill: C.textDim }} tickFormatter={v => `฿${fmt(v)}`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: C.text }} width={100} />
                <Tooltip content={<ClassicTooltip />} />
                <Bar dataKey="sales" fill={C.accent} radius={[0, 4, 4, 0]} name="ยอดขาย">
                  {dimensionData.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? C.gold : i < 3 ? C.accent : C.accentLight} opacity={i < 3 ? 1 : 0.7} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Detail table */}
          <div style={{ ...card, padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12, fontFamily: C.font }}>
              รายละเอียด ({dimensionData.length} รายการ)
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={{ ...th, width: 40 }}>#</th>
                <th style={th}>
                  {compareMode === 'employee' ? 'พนักงาน' : compareMode === 'product' ? 'สินค้า' : 'ช่องทาง'}
                </th>
                <th style={{ ...th, textAlign: 'center' }}>ออเดอร์</th>
                <th style={{ ...th, textAlign: 'right' }}>ยอดขาย</th>
                <th style={{ ...th, textAlign: 'right' }}>เฉลี่ย/ออเดอร์</th>
                <th style={{ ...th, textAlign: 'right' }}>สัดส่วน</th>
              </tr></thead>
              <tbody>
                {dimensionData.map((item, i) => {
                  const pct = result.a.sales > 0 ? (item.sales / result.a.sales * 100).toFixed(1) : '0.0';
                  const avg = item.count > 0 ? item.sales / item.count : 0;
                  return (
                    <tr key={item.name} style={{ background: i < 3 ? '#fffbf0' : 'transparent' }}>
                      <td style={{ ...td, textAlign: 'center', fontWeight: 800, color: i === 0 ? C.gold : i < 3 ? C.accent : C.textDim }}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                      </td>
                      <td style={{ ...td, fontWeight: 600 }}>{item.name}</td>
                      <td style={{ ...td, textAlign: 'center', fontWeight: 700, color: C.accent }}>{item.count}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: C.success }}>฿{fmt(item.sales)}</td>
                      <td style={{ ...td, textAlign: 'right', color: C.textDim }}>฿{fmt(avg)}</td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                          <div style={{ width: 60, height: 6, background: C.border, borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(100, parseFloat(pct))}%`, height: '100%', background: C.accent, borderRadius: 3 }}></div>
                          </div>
                          <span style={{ fontSize: 11, color: C.textDim, minWidth: 40, textAlign: 'right' }}>{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
