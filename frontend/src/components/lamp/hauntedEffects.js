/**
 * Haunted season — horror route transitions.
 *
 * Same contract as transitionEffects.js: `effect(stage) => cleanup`,
 * cover the screen while the old page leaves, uncover it as the new one
 * arrives, leave nothing behind. Colours come from the Haunted palette
 * (stage.c), plus blood red.
 */
import gsap from "@/lib/gsap-setup";
import { canvasLoop, coverCurve, domRun, easeInOut, el } from "./transitionEffects";

const EMOJI_FONT = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
const BLOOD = "150,8,22";
const rand = (a, b) => a + Math.random() * (b - a);

// Emoji are rasterised once into small canvases and stamped with
// drawImage: re-shaping text dozens of times a frame starved the main
// thread enough to stall the page's own entrance animation.
const SPRITE = 128;
const sprites = new Map();
function sprite(ch) {
  let c = sprites.get(ch);
  if (!c) {
    c = document.createElement("canvas");
    c.width = c.height = SPRITE * 1.25;
    const g = c.getContext("2d");
    g.font = `${SPRITE}px ${EMOJI_FONT}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(ch, c.width / 2, c.height / 2);
    sprites.set(ch, c);
  }
  return c;
}

function emoji(ctx, ch, x, y, size, { alpha = 1, rot = 0, sx = 1, sy = 1 } = {}) {
  const img = sprite(ch);
  const d = size * 1.25;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);
  ctx.drawImage(img, -d / 2, -d / 2, d, d);
  ctx.restore();
}

/* ── Bat swarm ────────────────────────────────────────────────────── */
function bats(stage) {
  const { ctx, w, h, c } = stage;
  const swarm = Array.from({ length: 80 }, () => ({
    x0: rand(-0.4, 0.3) * w, y0: h + rand(0, 0.6) * h,
    x1: w + rand(0, 0.5) * w, y1: -rand(0.1, 0.6) * h,
    s: rand(26, 74), d: rand(0, 0.25), ph: rand(0, 6), wob: rand(20, 80),
  }));
  return canvasLoop(stage, 1450, (t) => {
    ctx.fillStyle = `rgba(${c.fog},${0.95 * coverCurve(t, 0.4, 0.62)})`;
    ctx.fillRect(0, 0, w, h);
    for (const b of swarm) {
      const p = Math.min(1, Math.max(0, (t - b.d) / 0.75));
      if (p <= 0 || p >= 1) continue;
      const e = easeInOut(p);
      const x = b.x0 + (b.x1 - b.x0) * e + Math.sin(p * 9 + b.ph) * b.wob;
      const y = b.y0 + (b.y1 - b.y0) * e + Math.cos(p * 7 + b.ph) * b.wob * 0.5;
      const flap = 0.55 + Math.abs(Math.sin(t * 40 + b.ph)) * 0.6;
      emoji(ctx, "🦇", x, y, b.s, { sy: flap, rot: Math.sin(p * 6 + b.ph) * 0.3 });
    }
  });
}

/* ── Blood drips down the screen ──────────────────────────────────── */
function blood(stage) {
  const { ctx, w, h } = stage;
  const cols = Math.ceil(w / 26);
  const drips = Array.from({ length: cols }, (_, i) => ({ x: i * 26 + rand(-6, 6), r: rand(10, 20), v: rand(0.7, 1.35), delay: rand(0, 0.12) }));
  return canvasLoop(stage, 1450, (t) => {
    const fall = t > 0.6 ? easeInOut((t - 0.6) / 0.4) * h * 1.3 : 0;
    ctx.save();
    ctx.translate(0, fall);
    for (const d of drips) {
      const p = Math.min(1, Math.max(0, (t - d.delay) / 0.45));
      const len = easeInOut(p) * h * 1.25 * d.v;
      const g = ctx.createLinearGradient(0, 0, 0, len + d.r);
      g.addColorStop(0, `rgb(${BLOOD})`);
      g.addColorStop(1, "rgb(90,0,12)");
      ctx.fillStyle = g;
      ctx.fillRect(d.x - d.r, -10, d.r * 2 + 2, len);
      ctx.beginPath();
      ctx.arc(d.x + 1, len, d.r * 1.05, 0, Math.PI * 2);
      ctx.fill();
      // a glossy highlight running down the drip
      ctx.fillStyle = "rgba(255,120,120,0.18)";
      ctx.fillRect(d.x - d.r * 0.45, -10, d.r * 0.25, len);
    }
    ctx.restore();
  });
}

/* ── A ghost swoops at you ────────────────────────────────────────── */
function ghost(stage) {
  const { ctx, w, h, c } = stage;
  const wisps = Array.from({ length: 6 }, () => ({ x: rand(0, w), y: rand(0, h), r: rand(160, 380), dx: rand(-2, 2) }));
  return canvasLoop(stage, 1500, (t) => {
    const cover = coverCurve(t, 0.38, 0.66);
    ctx.fillStyle = `rgba(${c.fog},${0.93 * cover})`;
    ctx.fillRect(0, 0, w, h);
    for (const f of wisps) {
      f.x += f.dx * 3;
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
      g.addColorStop(0, `rgba(220,230,255,${0.08 * cover})`);
      g.addColorStop(1, "rgba(220,230,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(f.x - f.r, f.y - f.r, f.r * 2, f.r * 2);
    }
    // swoop: far and small, rushes past the camera around t≈0.5
    const p = Math.min(1, t / 0.62);
    const size = 40 + Math.pow(p, 3) * Math.max(w, h) * 1.6;
    const alpha = p < 0.85 ? 0.85 : Math.max(0, 0.85 - (p - 0.85) * 5.6);
    emoji(ctx, "👻", w / 2 + Math.sin(t * 9) * 60 * (1 - p), h / 2 + Math.cos(t * 7) * 30, size, { alpha, rot: Math.sin(t * 6) * 0.15 });
    const flash = 1 - Math.min(1, Math.abs(t - 0.6) / 0.06);
    if (flash > 0) { ctx.fillStyle = `rgba(235,240,255,${0.5 * flash})`; ctx.fillRect(0, 0, w, h); }
  });
}

/* ── Eyes open in the dark ────────────────────────────────────────── */
function eyes(stage) {
  const { ctx, w, h, c } = stage;
  const pairs = Array.from({ length: 28 }, () => ({
    x: rand(0.06, 0.94) * w, y: rand(0.08, 0.92) * h, s: rand(6, 22),
    open: rand(0.18, 0.45), close: rand(0.6, 0.72), blink: rand(0.48, 0.56),
    col: Math.random() < 0.55 ? c.accent : c.accent2,
  }));
  return canvasLoop(stage, 1450, (t) => {
    ctx.fillStyle = `rgba(${c.fog},${0.97 * coverCurve(t, 0.3, 0.72)})`;
    ctx.fillRect(0, 0, w, h);
    for (const e of pairs) {
      let lid = 0;
      if (t > e.open && t < e.close) lid = Math.min(1, (t - e.open) / 0.06) * Math.min(1, (e.close - t) / 0.05);
      if (Math.abs(t - e.blink) < 0.02) lid *= 0.1;
      if (lid <= 0) continue;
      ctx.save();
      ctx.shadowColor = `rgb(${e.col})`;
      ctx.shadowBlur = e.s * 1.4;
      ctx.fillStyle = `rgb(${e.col})`;
      for (const dx of [-e.s * 1.3, e.s * 1.3]) {
        ctx.beginPath();
        ctx.ellipse(e.x + dx, e.y, e.s, e.s * 0.55 * lid, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgb(0,0,0)";
      for (const dx of [-e.s * 1.3, e.s * 1.3]) {
        ctx.beginPath();
        ctx.ellipse(e.x + dx, e.y, e.s * 0.18, e.s * 0.5 * lid, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  });
}

/* ── Claws tear the screen ────────────────────────────────────────── */
function claws(stage) {
  const { layer, c } = stage;
  return domRun(stage, () => {
    const cut = 52;
    const top = el(layer, `position:absolute;inset:0;background:rgb(${c.fog});clip-path:polygon(0 0,100% 0,100% ${cut - 12}%,0 ${cut + 12}%);`);
    const bottom = el(layer, `position:absolute;inset:0;background:rgb(${c.fog});clip-path:polygon(0 ${cut + 12}%,100% ${cut - 12}%,100% 100%,0 100%);`);
    const svg = el(layer, "position:absolute;inset:0;",
      `<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%;height:100%;overflow:visible">
        ${[-9, 0, 9].map((o) => `<path d="M ${18 + o} ${8} C ${40 + o} ${30}, ${60 + o} ${62}, ${82 + o} ${92}" stroke="rgb(${BLOOD})" stroke-width="2.6" fill="none" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" style="filter:drop-shadow(0 0 6px rgb(${BLOOD}))"/>`).join("")}
      </svg>`);
    const paths = svg.querySelectorAll("path");
    const tl = gsap.timeline();
    tl.fromTo([top, bottom], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.28, ease: "power2.in" })
      .to(paths, { strokeDashoffset: 0, duration: 0.18, ease: "power4.in", stagger: 0.06 }, 0.12)
      .to(layer, { x: 10, duration: 0.04, repeat: 5, yoyo: true, ease: "steps(1)" }, 0.32)
      .set(layer, { x: 0 })
      .to(paths, { autoAlpha: 0, duration: 0.2 }, 0.72)
      .to(top, { yPercent: -110, rotate: -4, duration: 0.6, ease: "power3.in" }, 0.74)
      .to(bottom, { yPercent: 110, rotate: 3, duration: 0.6, ease: "power3.in" }, 0.74);
    return tl;
  });
}

/* ── A candle is blown out, then relit ────────────────────────────── */
function candle(stage) {
  const { ctx, w, h, c } = stage;
  const cx = w / 2, cy = h * 0.55;
  const maxR = Math.hypot(w, h);
  const smoke = Array.from({ length: 14 }, (_, i) => ({ ph: i * 0.7, off: rand(-6, 6) }));
  return canvasLoop(stage, 1600, (t) => {
    const close = t < 0.42 ? easeInOut(t / 0.42) : t < 0.66 ? 1 : 1 - easeInOut((t - 0.66) / 0.34);
    const lit = t < 0.42 || t > 0.6;
    const flick = 0.85 + Math.random() * 0.3;
    const r = Math.max(70, maxR * (1 - close));
    ctx.fillStyle = `rgb(${c.fog})`;
    ctx.fillRect(0, 0, w, h);
    if (lit) {
      ctx.globalCompositeOperation = "destination-out";
      const hole = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * flick);
      hole.addColorStop(0, "rgba(0,0,0,1)");
      hole.addColorStop(0.55, "rgba(0,0,0,0.85)");
      hole.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = hole;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "source-over";
      const glow = ctx.createRadialGradient(cx, cy - 30, 0, cx, cy - 30, 220 * flick);
      glow.addColorStop(0, `rgba(${c.accent},0.35)`);
      glow.addColorStop(1, `rgba(${c.accent},0)`);
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
    }
    // the candle
    ctx.fillStyle = "rgb(236,224,200)";
    ctx.fillRect(cx - 16, cy, 32, 120);
    ctx.fillStyle = "rgb(30,20,20)";
    ctx.fillRect(cx - 1.5, cy - 12, 3, 12);
    if (lit) {
      ctx.save();
      ctx.translate(cx + Math.sin(t * 50) * 2, cy - 14);
      const fg = ctx.createRadialGradient(0, -18, 2, 0, -14, 30);
      fg.addColorStop(0, "rgba(255,250,220,1)");
      fg.addColorStop(0.4, `rgba(${c.accent},0.95)`);
      fg.addColorStop(1, `rgba(${c.accent},0)`);
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.moveTo(0, -48 * flick);
      ctx.quadraticCurveTo(16, -14, 0, 0);
      ctx.quadraticCurveTo(-16, -14, 0, -48 * flick);
      ctx.fill();
      ctx.restore();
    } else {
      // smoke curling up from the snuffed wick
      ctx.strokeStyle = "rgba(200,200,210,0.35)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      smoke.forEach((s, i) => {
        const y = cy - 14 - i * 14;
        const x = cx + Math.sin(t * 20 + s.ph) * (4 + i * 2.2) + s.off;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
  });
}

/* ── A jack-o'-lantern lunges at you ──────────────────────────────── */
function pumpkin(stage) {
  const { ctx, w, h, c } = stage;
  return canvasLoop(stage, 1400, (t) => {
    const cover = coverCurve(t, 0.35, 0.68);
    ctx.fillStyle = `rgba(${c.fog},${0.96 * cover})`;
    ctx.fillRect(0, 0, w, h);
    const p = Math.min(1, t / 0.6);
    const size = 30 + Math.pow(p, 2.6) * Math.min(w, h) * 1.25;
    const pulse = 0.7 + Math.sin(t * 40) * 0.3;
    const glow = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, size * 0.9);
    glow.addColorStop(0, `rgba(${c.accent},${0.5 * pulse * cover})`);
    glow.addColorStop(1, `rgba(${c.accent},0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    const alpha = t < 0.62 ? 1 : Math.max(0, 1 - (t - 0.62) / 0.18);
    emoji(ctx, "🎃", w / 2, h / 2, size, { alpha, rot: Math.sin(t * 22) * 0.06 * p });
    const flash = 1 - Math.min(1, Math.abs(t - 0.6) / 0.05);
    if (flash > 0) { ctx.fillStyle = `rgba(${c.accent},${0.45 * flash})`; ctx.fillRect(0, 0, w, h); }
  });
}

/* ── Cobwebs close in from the corners, a spider drops ────────────── */
function web(stage) {
  const { ctx, w, h, c } = stage;
  const corners = [[0, 0], [w, 0], [0, h], [w, h]];
  const R = Math.hypot(w, h) * 0.62;
  return canvasLoop(stage, 1450, (t) => {
    const grow = t < 0.45 ? easeInOut(t / 0.45) : 1;
    const fade = t > 0.62 ? 1 - easeInOut((t - 0.62) / 0.38) : 1;
    ctx.fillStyle = `rgba(${c.fog},${0.92 * grow * fade})`;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = `rgba(230,225,215,${0.55 * fade})`;
    ctx.lineWidth = 1;
    for (const [x0, y0] of corners) {
      const base = Math.atan2(h / 2 - y0, w / 2 - x0);
      const spokes = 9;
      const reach = R * grow;
      for (let i = 0; i < spokes; i++) {
        const a = base + (i / (spokes - 1) - 0.5) * (Math.PI / 2);
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + Math.cos(a) * reach, y0 + Math.sin(a) * reach); ctx.stroke();
      }
      for (let ring = 1; ring <= 12; ring++) {
        const rr = (ring / 12) * reach;
        ctx.beginPath();
        for (let i = 0; i < spokes; i++) {
          const a = base + (i / (spokes - 1) - 0.5) * (Math.PI / 2);
          const sag = i === 0 ? 0 : 0.92;
          const x = x0 + Math.cos(a) * rr * (i % 2 ? sag : 1), y = y0 + Math.sin(a) * rr * (i % 2 ? sag : 1);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
    // the spider on its thread
    const drop = t < 0.5 ? easeInOut(t / 0.5) : t < 0.62 ? 1 : 1 - easeInOut((t - 0.62) / 0.38);
    const sy = drop * h * 0.48 + Math.sin(t * 18) * 6;
    ctx.strokeStyle = `rgba(230,225,215,${0.7 * fade})`;
    ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, sy); ctx.stroke();
    emoji(ctx, "🕷️", w / 2, sy + 22, 54, { alpha: fade, rot: Math.sin(t * 9) * 0.2 });
  });
}

/* ── Thunder over a graveyard ─────────────────────────────────────── */
function thunder(stage) {
  const { ctx, w, h, c } = stage;
  const ground = h * 0.82;
  const stones = Array.from({ length: Math.ceil(w / 140) }, (_, i) => ({ x: i * 140 + rand(10, 80), hh: rand(50, 95), ww: rand(42, 64), tilt: rand(-0.12, 0.12) }));
  const bolt = () => {
    const pts = [[rand(0.25, 0.75) * w, 0]];
    let [x, y] = pts[0];
    while (y < ground) { y += rand(30, 80); x += rand(-70, 70); pts.push([x, y]); }
    return pts;
  };
  const bolts = [bolt(), bolt(), bolt()];
  const drawTree = (x, y, len, ang, depth) => {
    if (depth === 0) return;
    const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
    ctx.lineWidth = depth * 1.6;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
    drawTree(x2, y2, len * 0.72, ang - 0.45, depth - 1);
    drawTree(x2, y2, len * 0.68, ang + 0.38, depth - 1);
  };
  return canvasLoop(stage, 1500, (t) => {
    ctx.fillStyle = `rgba(${c.fog},${0.97 * coverCurve(t, 0.28, 0.68)})`;
    ctx.fillRect(0, 0, w, h);
    const strikes = [[0.2, 0.27], [0.36, 0.41], [0.5, 0.6]];
    let flash = 0;
    strikes.forEach(([a, b], i) => {
      if (t < a || t > b) return;
      const k = 1 - (t - a) / (b - a);
      flash = Math.max(flash, k);
      ctx.strokeStyle = `rgba(245,240,255,${k})`;
      ctx.shadowColor = `rgb(${c.accent2})`; ctx.shadowBlur = 30; ctx.lineWidth = 3;
      ctx.beginPath(); bolts[i].forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
      ctx.shadowBlur = 0;
    });
    if (flash > 0) {
      ctx.fillStyle = `rgba(200,210,255,${0.35 * flash})`;
      ctx.fillRect(0, 0, w, h);
      // silhouettes only show when the lightning lights them
      ctx.fillStyle = `rgba(0,0,0,${0.9 * flash})`;
      ctx.strokeStyle = `rgba(0,0,0,${0.9 * flash})`;
      ctx.fillRect(0, ground, w, h - ground);
      for (const s of stones) {
        ctx.save(); ctx.translate(s.x, ground); ctx.rotate(s.tilt);
        ctx.beginPath(); ctx.moveTo(-s.ww / 2, 0); ctx.lineTo(-s.ww / 2, -s.hh + s.ww / 2);
        ctx.arc(0, -s.hh + s.ww / 2, s.ww / 2, Math.PI, 0); ctx.lineTo(s.ww / 2, 0); ctx.fill();
        ctx.restore();
      }
      drawTree(w * 0.12, ground, 120, -Math.PI / 2 - 0.1, 7);
      drawTree(w * 0.86, ground, 100, -Math.PI / 2 + 0.12, 6);
    }
  });
}

export const HAUNTED_EFFECTS = { bats, blood, ghost, eyes, claws, candle, pumpkin, web, thunder };

const BY_ROUTE = [
  ["/dashboard", "candle"],
  ["/arena", "claws"],
  ["/problems", "web"],
  ["/roadmaps", "ghost"],
  ["/sprints", "thunder"],
  ["/events", "bats"],
  ["/leaderboard", "eyes"],
  ["/live-quiz", "pumpkin"],
  ["/history", "thunder"],
  ["/gallery", "ghost"],
  ["/profile", "blood"],
  ["/notifications", "eyes"],
  ["/projects", "bats"],
  ["/certificates", "pumpkin"],
  ["/saved", "web"],
];
const ROTATION = ["bats", "blood", "ghost", "eyes", "claws", "candle", "pumpkin", "web", "thunder"];

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function hauntedEffectFor(pathname) {
  const hit = BY_ROUTE.find(([p]) => pathname === p || pathname.startsWith(`${p}/`));
  return hit ? hit[1] : ROTATION[hash(pathname) % ROTATION.length];
}
