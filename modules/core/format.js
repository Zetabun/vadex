import { Big } from '@last-orbit/core/big.js';
const SUF = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc', 'SxDc', 'SpDc', 'OcDc', 'NoDc', 'Vg'];
let notation = 'suffix';
export const setNotation = (n) => { notation = n; };
/** Format a Big or number: 1,250 → 12.5K → 3.2M … → 1.23e90 */
export function fmt(x, dp = 1) {
  const b = Big.from(x);
  if (b.m === 0) return '0';
  const neg = b.m < 0 ? '-' : '';
  const e = b.e, m = Math.abs(b.m);
  if (e < 3) { const n = m * Math.pow(10, e); const r = Math.round(n * 100) / 100; return neg + (r % 1 === 0 ? String(r) : r < 10 ? r.toFixed(Math.min(2, dp + 1)) : r.toFixed(dp)); }
  if (e < 4) return neg + fmtInt(m * Math.pow(10, e));
  const g = Math.floor(e / 3);
  if (notation === 'sci' || g >= SUF.length) return neg + m.toFixed(2) + 'e' + e;
  const v = m * Math.pow(10, e - g * 3);
  return neg + (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)) + SUF[g];
}
/** 1234567 → '1,234,567' (as toLocaleString('en-GB') writes it, several times faster: the HUD formats every frame). */
export const fmtInt = (n) => { const r = Math.round(n); return Math.abs(r) < 1e21 ? String(r).replace(/\B(?=(\d{3})+(?!\d))/g, ',') : r.toLocaleString('en-GB'); };
export const pct = (x, dp = 0) => (x * 100).toFixed(dp) + '%';
export const mult = (x) => '×' + (x >= 1000 ? fmt(x) : x >= 10 ? x.toFixed(1) : x.toFixed(2));
export function fmtTime(s) {
  s = Math.max(0, Math.floor(s));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m) return `${m}m ${String(ss).padStart(2, '0')}s`;
  return `${ss}s`;
}
