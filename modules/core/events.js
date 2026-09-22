// Minimal synchronous event bus. Systems talk through this instead of importing each other.
const map = new Map();
export const bus = {
  on(ev, fn) { (map.get(ev) || map.set(ev, []).get(ev)).push(fn); return () => bus.off(ev, fn); },
  off(ev, fn) { const l = map.get(ev); if (l) { const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); } },
  emit(ev, a, b, c) { const l = map.get(ev); if (l) for (let i = 0; i < l.length; i++) l[i](a, b, c); },
};
