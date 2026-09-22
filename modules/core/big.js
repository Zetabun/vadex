// Big: immutable mantissa/exponent number. Survives far beyond 1e308.
// value = m * 10^e, with 1 <= |m| < 10 (or m === 0).
const LOG10 = Math.log10;
export class Big {
  constructor(m = 0, e = 0) { this.m = m; this.e = e; }
  static norm(m, e) {
    if (!m || !isFinite(m)) return new Big(0, 0);
    const a = Math.abs(m);
    if (a >= 1 && a < 10) return new Big(m, e);
    const sh = Math.floor(LOG10(a));
    return new Big(m / Math.pow(10, sh), e + sh);
  }
  static from(x) {
    if (x instanceof Big) return x;
    if (typeof x === 'number') return Big.norm(x, 0);
    if (typeof x === 'string') {
      const s = x.startsWith('B:') ? x.slice(2) : x;
      const i = s.indexOf('e');
      if (i < 0) return Big.norm(parseFloat(s) || 0, 0);
      return Big.norm(parseFloat(s.slice(0, i)) || 0, parseInt(s.slice(i + 1), 10) || 0);
    }
    if (x && typeof x === 'object' && 'm' in x) return Big.norm(+x.m || 0, +x.e || 0);
    return new Big(0, 0);
  }
  add(o) {
    o = Big.from(o);
    if (this.m === 0) return o;
    if (o.m === 0) return this;
    const d = this.e - o.e;
    if (d > 17) return this;
    if (d < -17) return o;
    return d >= 0 ? Big.norm(this.m + o.m / Math.pow(10, d), this.e) : Big.norm(this.m / Math.pow(10, -d) + o.m, o.e);
  }
  neg() { return new Big(-this.m, this.e); }
  sub(o) { return this.add(Big.from(o).neg()); }
  mul(o) { o = Big.from(o); return Big.norm(this.m * o.m, this.e + o.e); }
  div(o) { o = Big.from(o); return o.m === 0 ? new Big(0, 0) : Big.norm(this.m / o.m, this.e - o.e); }
  pow(p) {
    if (this.m <= 0) return new Big(0, 0);
    const l = (LOG10(this.m) + this.e) * p;
    const e = Math.floor(l);
    return Big.norm(Math.pow(10, l - e), e);
  }
  /** number^number -> Big, safe past 1e308 */
  static pow(base, p) {
    if (base <= 0) return new Big(0, 0);
    const l = LOG10(base) * p, e = Math.floor(l);
    return Big.norm(Math.pow(10, l - e), e);
  }
  cmp(o) {
    o = Big.from(o);
    if (this.m === 0 || o.m === 0 || (this.m < 0) !== (o.m < 0)) return Math.sign(this.m - o.m) || 0;
    if (this.e !== o.e) return (this.e > o.e ? 1 : -1) * (this.m < 0 ? -1 : 1);
    return Math.sign(this.m - o.m);
  }
  gte(o) { return this.cmp(o) >= 0; }
  gt(o) { return this.cmp(o) > 0; }
  lt(o) { return this.cmp(o) < 0; }
  lte(o) { return this.cmp(o) <= 0; }
  eq(o) { return this.cmp(o) === 0; }
  isZero() { return this.m === 0; }
  max(o) { o = Big.from(o); return this.gte(o) ? this : o; }
  min(o) { o = Big.from(o); return this.lte(o) ? this : o; }
  floor() { return this.e >= 15 ? this : Big.norm(Math.floor(this.toNumber() + 1e-9), 0); }
  log10() { return this.m <= 0 ? -Infinity : LOG10(this.m) + this.e; }
  toNumber() { return this.e > 307 ? (this.m < 0 ? -Infinity : Infinity) : this.e < -320 ? 0 : this.m * Math.pow(10, this.e); }
  /** this / o as a plain number (for bars and ratios) */
  ratio(o) {
    o = Big.from(o); if (o.m === 0) return 0;
    const d = this.e - o.e; if (d > 300) return Infinity; if (d < -300) return 0;
    return (this.m / o.m) * Math.pow(10, d);
  }
  toJSON() { return 'B:' + this.m + 'e' + this.e; }
  toString() { return this.m + 'e' + this.e; }
}
export const B = (x) => Big.from(x);
Big.ZERO = new Big(0, 0);
Big.ONE = new Big(1, 0);
/** JSON reviver turning "B:1.2e34" strings back into Big. */
export const bigReviver = (k, v) => (typeof v === 'string' && v.startsWith('B:') ? Big.from(v) : v);
