// Banner designs, painted with the 2D canvas API. Used for the cloth texture on the ship (rendering/banner.js) and for
// the previews in the Ships tab. The canvas top is the edge pinned to the ship; transparent pixels cut the cloth's shape.

/** The cloth outline for a shape, on a w×h canvas. */
function cut(ctx, shape, w, h) {
  ctx.beginPath();
  if (shape === 'pennant') { ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.lineTo(w / 2, h); }
  else if (shape === 'swallow') { ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.lineTo(w, h); ctx.lineTo(w / 2, h * 0.78); ctx.lineTo(0, h); }
  else if (shape === 'streamer') { const a = w * 0.26; ctx.moveTo(a, 0); ctx.lineTo(w - a, 0); ctx.lineTo(w * 0.6, h * 0.8); ctx.lineTo(w / 2, h); ctx.lineTo(w * 0.4, h * 0.8); }
  else ctx.rect(0, 0, w, h);
  ctx.closePath();
}

function star(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill();
}
function skull(ctx, x, y, r, bg) {
  ctx.beginPath(); ctx.arc(x, y, r, Math.PI * 0.85, Math.PI * 0.15); ctx.lineTo(x + r * 0.55, y + r * 1.05); ctx.lineTo(x - r * 0.55, y + r * 1.05); ctx.closePath(); ctx.fill();
  ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(x - r * 0.42, y + r * 0.05, r * 0.3, 0, 7); ctx.arc(x + r * 0.42, y + r * 0.05, r * 0.3, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x, y + r * 0.35); ctx.lineTo(x - r * 0.13, y + r * 0.62); ctx.lineTo(x + r * 0.13, y + r * 0.62); ctx.fill();
}
function laurel(ctx, x, y, r) {
  for (const s of [-1, 1]) for (let i = 0; i < 6; i++) {
    const a = Math.PI / 2 + s * (0.35 + i * 0.36), lx = x + Math.cos(a) * r, ly = y - Math.sin(a) * r + r * 0.1;
    ctx.save(); ctx.translate(lx, ly); ctx.rotate(-a + (s > 0 ? 0.5 : -0.5)); ctx.beginPath(); ctx.ellipse(0, 0, r * 0.28, r * 0.12, 0, 0, 7); ctx.fill(); ctx.restore();
  }
  star(ctx, x, y + r * 0.05, r * 0.42);
}

/** Small emblems for the legendary stat trackers, drawn in the current fill style. */
function emblem(ctx, kind, x, y, r, bg) {
  ctx.beginPath();
  if (kind === 'skull') return skull(ctx, x, y, r, bg);
  if (kind === 'star') return star(ctx, x, y, r * 1.1);
  if (kind === 'crown') { ctx.moveTo(x - r, y + r * 0.6); ctx.lineTo(x - r, y - r * 0.5); ctx.lineTo(x - r * 0.45, y); ctx.lineTo(x, y - r * 0.8); ctx.lineTo(x + r * 0.45, y); ctx.lineTo(x + r, y - r * 0.5); ctx.lineTo(x + r, y + r * 0.6); }
  else if (kind === 'chevron') { for (const dy of [-0.55, 0.15]) { ctx.moveTo(x - r, y + (dy - 0.25) * r); ctx.lineTo(x, y + (dy + 0.35) * r); ctx.lineTo(x + r, y + (dy - 0.25) * r); ctx.lineTo(x + r, y + (dy + 0.1) * r); ctx.lineTo(x, y + (dy + 0.7) * r); ctx.lineTo(x - r, y + (dy + 0.1) * r); ctx.closePath(); } }
  else if (kind === 'hex') { for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(x, y, r * 0.38, 0, 7); }
  else if (kind === 'shield') { ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.85, y - r * 0.6); ctx.lineTo(x + r * 0.7, y + r * 0.4); ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.7, y + r * 0.4); ctx.lineTo(x - r * 0.85, y - r * 0.6); }
  else if (kind === 'wings') { for (const s of [-1, 1]) { ctx.moveTo(x, y); ctx.lineTo(x + s * r * 1.1, y - r * 0.6); ctx.lineTo(x + s * r * 0.9, y - r * 0.1); ctx.lineTo(x + s * r * 1.0, y + r * 0.05); ctx.lineTo(x + s * r * 0.7, y + r * 0.35); ctx.closePath(); } ctx.moveTo(x + r * 0.28, y); ctx.arc(x, y, r * 0.28, 0, 7); }
  ctx.fill();
}

/** Paint banner design b onto a w×h canvas context. value: the live stat for banners that display one. */
export function paintBanner(ctx, b, w, h, value = 0) {
  ctx.clearRect(0, 0, w, h); if (!b || !b.shape) return;
  const [c0, c1, c2] = b.colors;
  ctx.save(); cut(ctx, b.shape, w, h); ctx.clip();
  switch (b.pattern) {
    case 'bands': ctx.fillStyle = c0; ctx.fillRect(0, 0, w, h); ctx.fillStyle = c1; ctx.fillRect(w * 0.36, 0, w * 0.28, h); break;
    case 'stripes': for (let i = 0; i * h / 9 < h; i++) { ctx.fillStyle = i % 2 ? c1 : c0; ctx.fillRect(0, i * h / 9, w, h / 9 + 1); } break;
    case 'checker': { const n = 4, s = w / n; for (let y = 0; y * s < h; y++) for (let x = 0; x < n; x++) { ctx.fillStyle = (x + y) % 2 ? c1 : c0; ctx.fillRect(x * s, y * s, s + 0.5, s + 0.5); } break; }
    case 'diagonal': { ctx.fillStyle = c0; ctx.fillRect(0, 0, w, h); ctx.fillStyle = c1; const s = w * 0.5; for (let y = -w; y < h + w; y += s * 2) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y + w); ctx.lineTo(w, y + w + s); ctx.lineTo(0, y + s); ctx.fill(); } break; }
    case 'gradient': { const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, c0); g.addColorStop(0.5, c1); g.addColorStop(1, c2 || c1); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); break; }
    case 'rainbow': { const g = ctx.createLinearGradient(0, 0, 0, h); ['#ff4d7a', '#ffb547', '#ffe066', '#6dff8e', '#5ee6ff', '#7a8bff', '#c77dff'].forEach((c, i, a) => g.addColorStop(i / (a.length - 1), c)); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); break; }
    case 'stars': { ctx.fillStyle = c0; ctx.fillRect(0, 0, w, h); ctx.fillStyle = c1; let s = 7; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647); for (let i = 0; i < 26; i++) { ctx.globalAlpha = 0.4 + r() * 0.6; ctx.beginPath(); ctx.arc(r() * w, r() * h, w * (0.015 + r() * 0.035), 0, 7); ctx.fill(); } ctx.globalAlpha = 1; star(ctx, w / 2, h * 0.22, w * 0.2); break; }
    case 'emblem': {
      ctx.fillStyle = c0; ctx.fillRect(0, 0, w, h); ctx.fillStyle = c1;
      const x = w / 2, y = h * 0.24, r = w * 0.26;
      if (b.emblem === 'skull') skull(ctx, x, y, r, c0); else if (b.emblem === 'laurel') laurel(ctx, x, y, r * 1.1); else star(ctx, x, y, r);
      break;
    }
    case 'tally': {
      // A stat tracker: emblem at the pinned edge, then the live count glowing down the cloth's length.
      const g = ctx.createLinearGradient(0, 0, w, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, c1); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = c0; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 0.14; ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1;
      ctx.fillStyle = c1; ctx.fillRect(0, 0, w * 0.06, h); ctx.fillRect(w * 0.94, 0, w * 0.06, h); ctx.fillRect(w * 0.12, 0, w * 0.02, h); ctx.fillRect(w * 0.86, 0, w * 0.02, h);
      emblem(ctx, b.emblem || 'skull', w / 2, h * 0.1, w * 0.2, c0); ctx.fillStyle = c1;
      const text = Math.floor(value).toLocaleString('en-GB'), lead = w * 0.16 * 0.62 * (b.label || 'KILLS').length + w * 0.12, room = h * (b.shape === 'swallow' ? 0.75 : 0.94) - h * 0.21 - lead, size = Math.min(w * 0.6, room / (text.length * 0.6));
      ctx.save(); ctx.translate(w / 2, h * 0.21); ctx.rotate(Math.PI / 2);
      ctx.font = `700 ${w * 0.16}px "Chakra Petch", monospace`; ctx.textBaseline = 'middle'; ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillText(b.label || 'KILLS', 0, 0);
      ctx.font = `700 ${size}px "Chakra Petch", monospace`; ctx.shadowColor = c1; ctx.shadowBlur = w * 0.12; ctx.fillStyle = c2 || '#fff'; ctx.fillText(text, lead, 0);
      ctx.restore(); break;
    }
    default: ctx.fillStyle = c0; ctx.fillRect(0, 0, w, h);
  }
  // Trim along the cut edges and a darker hem at the pinned edge, so every design reads as cloth.
  ctx.restore(); ctx.save(); cut(ctx, b.shape, w, h); ctx.clip();
  ctx.lineWidth = Math.max(2, w * 0.07); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, 0, w, Math.max(3, h * 0.04));
  ctx.restore();
}
