/**
 * Route transition effects for the member app.
 *
 * Every effect has the same shape: `effect(stage) => cleanup`. It must
 * cover the screen during roughly the first ~45% of its run (while the
 * old page leaves), then uncover it (while the new page arrives), and
 * leave nothing behind. `stage` gives it a full-screen canvas + 2D
 * context, an empty DOM layer, the viewport size, the theme colours as
 * "r,g,b" strings, the pointer position of the click that navigated,
 * and the destination's name.
 *
 * Canvas effects run their own rAF loop; DOM effects build elements in
 * the layer and drive them with a GSAP timeline.
 */
import gsap from "@/lib/gsap-setup";

const GLYPHS = "∑∫π∞∂√λφΔ∇θεμσΩαβγ01234567891/xyz≈≠≤≥∈∀∃ℝℕ".split("");
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
export const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const easeOut = (x) => 1 - Math.pow(1 - x, 3);

/* Cover amount over normalised time t: in, hold, out. */
export function coverCurve(t, inEnd = 0.42, outStart = 0.58) {
  if (t < inEnd) return easeInOut(t / inEnd);
  if (t < outStart) return 1;
  return 1 - easeInOut((t - outStart) / (1 - outStart));
}

export function canvasLoop(stage, duration, draw) {
  const { ctx, w, h } = stage;
  let raf = 0;
  const start = performance.now();
  const frame = (now) => {
    const t = Math.min(1, (now - start) / duration);
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, w, h);
    draw(t);
    if (t < 1) raf = requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, w, h);
  };
  raf = requestAnimationFrame(frame);
  return () => {
    cancelAnimationFrame(raf);
    ctx.clearRect(0, 0, w, h);
  };
}

export function el(layer, css, html = "") {
  const node = document.createElement("div");
  node.style.cssText = css;
  if (html) node.innerHTML = html;
  layer.appendChild(node);
  return node;
}

export function domRun(stage, build) {
  const tl = build();
  return () => {
    tl.kill();
    stage.layer.replaceChildren();
  };
}

const labelCss = (c) =>
  `font-family:Outfit,system-ui,sans-serif;font-weight:500;letter-spacing:-0.04em;color:rgb(${c.ink});white-space:nowrap;`;

/* ── 1. Fog iris (spooky) ─────────────────────────────────────────── */
function iris(stage) {
  const { ctx, w, h, c } = stage;
  const cx = w / 2, cy = h * 0.45;
  const maxR = Math.hypot(w, h) * 0.62;
  const focal = Math.min(w, h) * 0.9;
  const stars = Array.from({ length: 120 }, () => ({
    x: (Math.random() - 0.5) * w * 1.6, y: (Math.random() - 0.5) * h * 1.6,
    z: 400 + Math.random() * 1400, g: pick(GLYPHS), two: Math.random() < 0.3,
  }));
  const puffs = Array.from({ length: 7 }, (_, i) => ({ x: Math.random() * w, y: Math.random() * h, r: 160 + Math.random() * 260, dx: (Math.random() - 0.5) * 3.6, a: 0.05 + (i % 3) * 0.03 }));
  return canvasLoop(stage, 1300, (t) => {
    const r = maxR * (1 - coverCurve(t, 0.4, 0.6));
    ctx.fillStyle = `rgba(${c.fog},0.97)`;
    ctx.fillRect(0, 0, w, h);
    for (const p of puffs) {
      p.x += p.dx;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      g.addColorStop(0, `rgba(${c.ink},${p.a})`);
      g.addColorStop(1, `rgba(${c.ink},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
    }
    const dark = 1 - Math.min(1, Math.abs(t - 0.5) / 0.22);
    if (dark > 0) {
      const fl = ctx.createRadialGradient(w * 0.72, h * 0.08, 0, w * 0.72, h * 0.08, maxR);
      fl.addColorStop(0, `rgba(${c.accent},${0.28 * dark * (Math.random() < 0.25 ? 0.4 : 1)})`);
      fl.addColorStop(1, `rgba(${c.accent},0)`);
      ctx.fillStyle = fl;
      ctx.fillRect(0, 0, w, h);
    }
    const speed = 2400 * (1 - t * 0.5);
    const ga = Math.sin(Math.min(1, t * 1.15) * Math.PI);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const s of stars) {
      const pz = s.z; s.z -= speed / 60;
      if (s.z < 20) continue;
      const k = focal / s.z, pk = focal / pz;
      const col = `rgba(${s.two ? c.accent2 : c.accent},${Math.min(1, (1 - s.z / 1800) * 1.4) * ga})`;
      ctx.strokeStyle = col; ctx.lineWidth = Math.max(0.6, k * 1.3);
      ctx.beginPath(); ctx.moveTo(cx + s.x * pk, cy + s.y * pk); ctx.lineTo(cx + s.x * k, cy + s.y * k); ctx.stroke();
      const size = Math.min(64, 10 * k);
      if (size > 7) { ctx.fillStyle = col; ctx.font = `500 ${size}px Outfit, system-ui, sans-serif`; ctx.fillText(s.g, cx + s.x * k, cy + s.y * k); }
    }
    if (r > 0) {
      ctx.globalCompositeOperation = "destination-out";
      const hole = ctx.createRadialGradient(cx, cy, r * 0.82, cx, cy, r);
      hole.addColorStop(0, "rgba(0,0,0,1)"); hole.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = hole; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    }
  });
}

/* ── 2. Glitch slices (spooky) ────────────────────────────────────── */
function glitch(stage) {
  const { layer, c, label } = stage;
  return domRun(stage, () => {
    const n = 14;
    const slices = Array.from({ length: n }, (_, i) => el(layer,
      `position:absolute;left:0;right:0;top:${(i / n) * 100}%;height:${100 / n + 0.2}%;background:rgb(${c.fog});border-top:1px solid rgba(${i % 3 ? c.accent : c.accent2},0.35);`));
    const text = el(layer, `position:absolute;inset:0;display:grid;place-items:center;`,
      `<div style="position:relative;${labelCss(c)}font-size:clamp(3rem,12vw,10rem);text-transform:lowercase">
        <span data-a style="position:absolute;inset:0;color:rgb(${c.accent});mix-blend-mode:screen">${label}</span>
        <span data-b style="position:absolute;inset:0;color:rgb(${c.accent2});mix-blend-mode:screen">${label}</span>
        <span style="position:relative">${label}</span></div>`);
    const a = text.querySelector("[data-a]"), b = text.querySelector("[data-b]");
    const tl = gsap.timeline();
    tl.fromTo(slices, { xPercent: () => gsap.utils.random([-110, 110]) }, { xPercent: 0, duration: 0.32, ease: "steps(5)", stagger: { each: 0.018, from: "random" } })
      .fromTo(text, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.05 }, 0.22)
      .to([a, b], { x: (i) => (i ? 9 : -9), y: (i) => (i ? -3 : 3), duration: 0.06, repeat: 7, yoyo: true, ease: "steps(1)" }, 0.24)
      .to(slices, { x: () => gsap.utils.random(-40, 40), duration: 0.05, repeat: 3, yoyo: true, ease: "steps(1)", stagger: { each: 0.01, from: "random" } }, 0.3)
      .to(text, { autoAlpha: 0, duration: 0.05, repeat: 2, yoyo: true, ease: "steps(1)" }, 0.62)
      .to(text, { autoAlpha: 0, duration: 0.05 }, 0.76)
      .to(slices, { xPercent: () => gsap.utils.random([-110, 110]), duration: 0.34, ease: "steps(6)", stagger: { each: 0.018, from: "random" } }, 0.72);
    return tl;
  });
}

/* ── 3. Digit rain ────────────────────────────────────────────────── */
function matrix(stage) {
  const { ctx, w, h, c } = stage;
  const size = 18;
  const cols = Math.ceil(w / size);
  const drops = Array.from({ length: cols }, () => ({ y: -Math.random() * h * 0.8, v: 14 + Math.random() * 22 }));
  return canvasLoop(stage, 1250, (t) => {
    const cover = coverCurve(t, 0.45, 0.6);
    ctx.fillStyle = `rgba(${c.fog},${0.94 * cover})`;
    ctx.fillRect(0, 0, w, h);
    ctx.font = `500 ${size}px "IBM Plex Mono", monospace`;
    ctx.textAlign = "center";
    for (let i = 0; i < cols; i++) {
      const d = drops[i];
      d.y += d.v;
      const x = i * size + size / 2;
      for (let k = 0; k < 14; k++) {
        const y = d.y - k * size;
        if (y < -size || y > h + size) continue;
        const a = (1 - k / 14) * (t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4);
        ctx.fillStyle = k === 0 ? `rgba(${c.ink},${a})` : `rgba(${i % 4 ? c.accent : c.accent2},${a * 0.85})`;
        ctx.fillText(pick(GLYPHS), x, y);
      }
      if (d.y - 14 * size > h) d.y = -Math.random() * 200;
    }
  });
}

/* ── 4. Doors ─────────────────────────────────────────────────────── */
function doors(stage) {
  const { layer, c, label } = stage;
  return domRun(stage, () => {
    const panel = (side) => el(layer,
      `position:absolute;top:0;bottom:0;${side}:0;width:50.5%;background:linear-gradient(${side === "left" ? 90 : 270}deg,rgb(${c.fog}),rgb(${c.paper}));border-${side === "left" ? "right" : "left"}:1px solid rgba(${c.accent},0.6);box-shadow:0 0 60px rgba(${c.accent},0.25);`);
    const L = panel("left"), R = panel("right");
    const seam = el(layer, `position:absolute;top:0;bottom:0;left:50%;width:2px;margin-left:-1px;background:rgb(${c.accent});box-shadow:0 0 30px 6px rgba(${c.accent},0.7);`);
    const word = el(layer, `position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);${labelCss(c)}font-size:clamp(1rem,2.4vw,1.6rem);padding:.4rem 1rem;border:1px solid rgba(${c.accent},.5);border-radius:999px;background:rgb(${c.fog});`, label);
    const tl = gsap.timeline();
    tl.fromTo(L, { xPercent: -101 }, { xPercent: 0, duration: 0.42, ease: "power4.in" })
      .fromTo(R, { xPercent: 101 }, { xPercent: 0, duration: 0.42, ease: "power4.in" }, 0)
      .fromTo(seam, { scaleY: 0, autoAlpha: 0 }, { scaleY: 1, autoAlpha: 1, duration: 0.2 }, 0.38)
      .fromTo(word, { autoAlpha: 0, scale: 0.8 }, { autoAlpha: 1, scale: 1, duration: 0.2, ease: "back.out(2)" }, 0.42)
      .to([word, seam], { autoAlpha: 0, duration: 0.15 }, 0.72)
      .to(L, { xPercent: -101, duration: 0.55, ease: "power3.inOut" }, 0.78)
      .to(R, { xPercent: 101, duration: 0.55, ease: "power3.inOut" }, 0.78);
    return tl;
  });
}

/* ── 5. Venetian blinds ───────────────────────────────────────────── */
function blinds(stage) {
  const { layer, c } = stage;
  return domRun(stage, () => {
    const n = 10;
    layer.style.perspective = "1200px";
    const slats = Array.from({ length: n }, (_, i) => el(layer,
      `position:absolute;top:0;bottom:0;left:${(i / n) * 100}%;width:${100 / n + 0.15}%;background:linear-gradient(90deg,rgb(${c.fog}),rgb(${c.paper}) 60%,rgb(${c.fog}));border-right:1px solid rgba(${c.accent},0.25);transform-origin:50% 50%;`));
    const tl = gsap.timeline({ onComplete: () => { layer.style.perspective = ""; } });
    tl.fromTo(slats, { rotateY: 90, autoAlpha: 0 }, { rotateY: 0, autoAlpha: 1, duration: 0.42, ease: "power3.in", stagger: 0.03 })
      .to(slats, { rotateY: -90, autoAlpha: 0, duration: 0.5, ease: "power3.out", stagger: 0.035 }, 0.72);
    return tl;
  });
}

/* ── 6. Letterbox shutters ────────────────────────────────────────── */
function letterbox(stage) {
  const { layer, c, label } = stage;
  return domRun(stage, () => {
    const bar = (pos) => el(layer, `position:absolute;left:0;right:0;${pos}:0;height:50.5%;background:rgb(${c.fog});border-${pos === "top" ? "bottom" : "top"}:1px solid rgba(${c.accent},.6);`);
    const T = bar("top"), B = bar("bottom");
    const flash = el(layer, `position:absolute;inset:0;background:rgba(${c.accent},.55);mix-blend-mode:screen;opacity:0;`);
    const word = el(layer, `position:absolute;inset:0;display:grid;place-items:center;${labelCss(c)}font-size:clamp(2.5rem,8vw,6rem);opacity:0;`, label);
    const tl = gsap.timeline();
    tl.fromTo(T, { yPercent: -101 }, { yPercent: 0, duration: 0.4, ease: "expo.in" })
      .fromTo(B, { yPercent: 101 }, { yPercent: 0, duration: 0.4, ease: "expo.in" }, 0)
      .to(flash, { opacity: 1, duration: 0.05 }, 0.4).to(flash, { opacity: 0, duration: 0.3 }, 0.45)
      .fromTo(word, { opacity: 0, letterSpacing: "0.4em" }, { opacity: 1, letterSpacing: "-0.04em", duration: 0.35, ease: "expo.out" }, 0.42)
      .to(word, { opacity: 0, duration: 0.12 }, 0.74)
      .to(T, { yPercent: -101, duration: 0.5, ease: "expo.out" }, 0.8)
      .to(B, { yPercent: 101, duration: 0.5, ease: "expo.out" }, 0.8);
    return tl;
  });
}

/* ── 7. Glyph vortex ──────────────────────────────────────────────── */
function vortex(stage) {
  const { ctx, w, h, c } = stage;
  const cx = w / 2, cy = h / 2;
  const R = Math.hypot(w, h) * 0.6;
  const parts = Array.from({ length: 220 }, () => ({ a: Math.random() * Math.PI * 2, r: Math.random(), g: pick(GLYPHS), two: Math.random() < 0.35 }));
  return canvasLoop(stage, 1350, (t) => {
    const cover = coverCurve(t, 0.45, 0.6);
    ctx.fillStyle = `rgba(${c.fog},${0.95 * cover})`;
    ctx.beginPath(); ctx.arc(cx, cy, R * (0.15 + 0.85 * cover), 0, Math.PI * 2); ctx.fill();
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const spin = t * Math.PI * 5;
    for (const p of parts) {
      const pull = t < 0.5 ? 1 - easeInOut(t / 0.5) * 0.85 : 0.15 + easeOut((t - 0.5) / 0.5) * 1.3;
      const rr = p.r * R * pull;
      const ang = p.a + spin * (1.4 - p.r);
      const x = cx + Math.cos(ang) * rr, y = cy + Math.sin(ang) * rr * 0.8;
      const alpha = Math.sin(t * Math.PI) * (0.4 + p.r * 0.6);
      ctx.fillStyle = `rgba(${p.two ? c.accent2 : c.accent},${alpha})`;
      ctx.font = `500 ${10 + p.r * 30}px Outfit, system-ui, sans-serif`;
      ctx.fillText(p.g, x, y);
    }
  });
}

/* ── 8. 3D tile flip ──────────────────────────────────────────────── */
function tiles(stage) {
  const { layer, c, w, h } = stage;
  return domRun(stage, () => {
    const cols = w < 640 ? 4 : 8, rows = w < 640 ? 7 : 5;
    layer.style.perspective = "1400px";
    const cells = [];
    for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
      cells.push(el(layer, `position:absolute;left:${(q / cols) * 100}%;top:${(r / rows) * 100}%;width:${100 / cols + 0.1}%;height:${100 / rows + 0.1}%;background:rgb(${(r + q) % 2 ? c.fog : c.paper});border:1px solid rgba(${c.accent},.18);display:grid;place-items:center;color:rgba(${c.accent},.5);font:500 ${Math.min(w / cols, h / rows) * 0.35}px Outfit,system-ui,sans-serif;`, pick(GLYPHS)));
    }
    const tl = gsap.timeline({ onComplete: () => { layer.style.perspective = ""; } });
    tl.fromTo(cells, { rotateX: -90, autoAlpha: 0 }, { rotateX: 0, autoAlpha: 1, duration: 0.36, ease: "back.out(1.4)", stagger: { each: 0.012, grid: [rows, cols], from: "random" } })
      .to(cells, { rotateY: 90, autoAlpha: 0, duration: 0.36, ease: "power2.in", stagger: { each: 0.01, grid: [rows, cols], from: "center" } }, 0.78);
    return tl;
  });
}

/* ── 9. Lightning strike (spooky) ─────────────────────────────────── */
function lightning(stage) {
  const { ctx, w, h, c } = stage;
  const bolt = (x0) => {
    const pts = [[x0, 0]];
    let x = x0, y = 0;
    while (y < h) { y += 30 + Math.random() * 60; x += (Math.random() - 0.5) * 120; pts.push([x, y]); }
    return pts;
  };
  const bolts = [bolt(w * (0.35 + Math.random() * 0.3)), bolt(w * (0.2 + Math.random() * 0.6))];
  return canvasLoop(stage, 1250, (t) => {
    const cover = coverCurve(t, 0.3, 0.62);
    ctx.fillStyle = `rgba(${c.fog},${0.96 * cover})`;
    ctx.fillRect(0, 0, w, h);
    const strikes = [[0.22, 0.3], [0.36, 0.42], [0.5, 0.58]];
    strikes.forEach(([a, b], i) => {
      if (t < a || t > b) return;
      const k = 1 - (t - a) / (b - a);
      ctx.fillStyle = `rgba(${c.accent},${0.35 * k})`;
      ctx.fillRect(0, 0, w, h);
      const pts = bolts[i % 2];
      ctx.strokeStyle = `rgba(${c.ink},${k})`;
      ctx.shadowColor = `rgb(${c.accent})`; ctx.shadowBlur = 30;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (const [x, y] of pts) ctx.lineTo(x, y);
      ctx.stroke();
      ctx.shadowBlur = 0;
    });
  });
}

/* ── 10. Portal from the click ────────────────────────────────────── */
function portal(stage) {
  const { ctx, w, h, c, origin } = stage;
  const ox = origin?.x ?? w / 2, oy = origin?.y ?? h / 2;
  const R = Math.hypot(Math.max(ox, w - ox), Math.max(oy, h - oy)) * 1.05;
  return canvasLoop(stage, 1250, (t) => {
    if (t < 0.45) {
      const r = R * easeInOut(t / 0.45);
      ctx.fillStyle = `rgb(${c.fog})`;
      ctx.beginPath(); ctx.arc(ox, oy, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `rgba(${c.accent},.9)`; ctx.lineWidth = 3;
      ctx.shadowColor = `rgb(${c.accent})`; ctx.shadowBlur = 24;
      ctx.beginPath(); ctx.arc(ox, oy, r, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = `rgb(${c.fog})`;
      ctx.fillRect(0, 0, w, h);
      const k = t < 0.58 ? 0 : easeInOut((t - 0.58) / 0.42);
      const r = R * k;
      // rings ripple inside the dark before it opens
      for (let i = 0; i < 4; i++) {
        const rr = ((t * 900 + i * 120) % 480);
        ctx.strokeStyle = `rgba(${i % 2 ? c.accent2 : c.accent},${0.5 * (1 - rr / 480) * (1 - k)})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(w / 2, h / 2, rr, 0, Math.PI * 2); ctx.stroke();
      }
      if (r > 0) {
        ctx.globalCompositeOperation = "destination-out";
        ctx.beginPath(); ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = `rgba(${c.accent},.8)`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2); ctx.stroke();
      }
    }
  });
}

/* ── 11. Ink bleed from the click ─────────────────────────────────── */
function ink(stage) {
  const { ctx, w, h, c, origin } = stage;
  const ox = origin?.x ?? w / 2, oy = origin?.y ?? h / 2;
  const R = Math.hypot(w, h);
  const blobs = Array.from({ length: 26 }, () => ({ a: Math.random() * Math.PI * 2, d: Math.random(), s: 0.35 + Math.random() * 0.65 }));
  return canvasLoop(stage, 1300, (t) => {
    const grow = easeInOut(Math.min(1, t / 0.45));
    ctx.fillStyle = `rgb(${c.fog})`;
    for (const b of blobs) {
      const dist = b.d * R * 0.5 * grow;
      const x = ox + Math.cos(b.a) * dist, y = oy + Math.sin(b.a) * dist;
      ctx.beginPath(); ctx.arc(x, y, R * 0.42 * b.s * grow, 0, Math.PI * 2); ctx.fill();
    }
    ctx.beginPath(); ctx.arc(ox, oy, R * grow, 0, Math.PI * 2); ctx.fill();
    if (t > 0.58) {
      const k = easeInOut((t - 0.58) / 0.42);
      ctx.globalCompositeOperation = "destination-out";
      for (const b of blobs) {
        const x = w / 2 + Math.cos(b.a + 1) * b.d * R * 0.4 * k, y = h / 2 + Math.sin(b.a + 1) * b.d * R * 0.4 * k;
        ctx.beginPath(); ctx.arc(x, y, R * 0.45 * b.s * k, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    }
    // a thin accent drip line at the leading edge
    ctx.strokeStyle = `rgba(${c.accent},${0.6 * (1 - Math.abs(t - 0.3) / 0.3)})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(ox, oy, R * grow * 0.5, 0, Math.PI * 2); ctx.stroke();
  });
}

/* ── 12. Eclipse (spooky) ─────────────────────────────────────────── */
function eclipse(stage) {
  const { ctx, w, h, c } = stage;
  const cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.18;
  return canvasLoop(stage, 1400, (t) => {
    const cover = coverCurve(t, 0.3, 0.68);
    ctx.fillStyle = `rgba(${c.fog},${0.97 * cover})`;
    ctx.fillRect(0, 0, w, h);
    if (cover < 0.05) return;
    const glow = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 3.2);
    glow.addColorStop(0, `rgba(${c.accent},${0.7 * cover})`);
    glow.addColorStop(1, `rgba(${c.accent},0)`);
    ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = `rgba(${c.accent},${cover})`;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    const slide = (1 - easeInOut(Math.min(1, Math.max(0, (t - 0.15) / 0.4)))) * r * 2.4;
    ctx.fillStyle = `rgba(${c.fog},${cover})`;
    ctx.beginPath(); ctx.arc(cx - slide, cy - slide * 0.25, r * 0.98, 0, Math.PI * 2); ctx.fill();
    // corona flares at totality
    const tot = 1 - Math.min(1, Math.abs(t - 0.55) / 0.15);
    if (tot > 0) {
      ctx.strokeStyle = `rgba(${c.accent2},${0.6 * tot})`;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2 + t;
        const len = r * (1.15 + Math.random() * 0.5);
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len); ctx.stroke();
      }
    }
  });
}

/* ── 13. Wave curtain ─────────────────────────────────────────────── */
function curtain(stage) {
  const { ctx, w, h, c } = stage;
  return canvasLoop(stage, 1250, (t) => {
    const up = t < 0.45 ? easeInOut(t / 0.45) : 1;
    const away = t > 0.58 ? easeInOut((t - 0.58) / 0.42) : 0;
    const top = h * (1 - up) - h * 0.12;
    const bottom = h * (1 - away) + h * 0.12;
    const wave = (x, base, phase) => base + Math.sin(x / 90 + t * 14 + phase) * 26 + Math.sin(x / 37 - t * 9) * 9;
    ctx.fillStyle = `rgb(${c.fog})`;
    ctx.beginPath();
    ctx.moveTo(0, wave(0, top, 0));
    for (let x = 0; x <= w; x += 12) ctx.lineTo(x, wave(x, top, 0));
    for (let x = w; x >= 0; x -= 12) ctx.lineTo(x, wave(x, bottom, 2));
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = `rgba(${c.accent},.8)`; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 12) (x ? ctx.lineTo : ctx.moveTo).call(ctx, x, wave(x, top, 0));
    ctx.stroke();
  });
}

/* ── 14. Glyph warp (the original jump) ───────────────────────────── */
function warp(stage) {
  const { ctx, w, h, c } = stage;
  const cx = w / 2, cy = h * 0.42, focal = Math.min(w, h) * 0.9;
  const stars = Array.from({ length: 160 }, () => ({ x: (Math.random() - 0.5) * w * 1.6, y: (Math.random() - 0.5) * h * 1.6, z: 400 + Math.random() * 1400, g: pick(GLYPHS), two: Math.random() < 0.3 }));
  return canvasLoop(stage, 1100, (t) => {
    const cover = coverCurve(t, 0.4, 0.6);
    ctx.fillStyle = `rgba(${c.fog},${0.92 * cover})`;
    ctx.fillRect(0, 0, w, h);
    const speed = 2600 * (1 - t * 0.5);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const s of stars) {
      const pz = s.z; s.z -= speed / 60;
      if (s.z < 20) continue;
      const k = focal / s.z, pk = focal / pz;
      const col = `rgba(${s.two ? c.accent2 : c.accent},${Math.min(1, (1 - s.z / 1800) * 1.4) * (1 - t)})`;
      ctx.strokeStyle = col; ctx.lineWidth = Math.max(0.6, k * 1.4);
      ctx.beginPath(); ctx.moveTo(cx + s.x * pk, cy + s.y * pk); ctx.lineTo(cx + s.x * k, cy + s.y * k); ctx.stroke();
      const size = Math.min(64, 10 * k);
      if (size > 7) { ctx.fillStyle = col; ctx.font = `500 ${size}px Outfit, system-ui, sans-serif`; ctx.fillText(s.g, cx + s.x * k, cy + s.y * k); }
    }
  });
}

export const EFFECTS = { iris, glitch, matrix, doors, blinds, letterbox, vortex, tiles, lightning, portal, ink, eclipse, curtain, warp };

/**
 * Which effect and which page motion each destination gets. The first
 * matching prefix wins; anything unlisted is assigned one from the
 * rotation by a stable hash of its path, so it is still consistent.
 */
const BY_ROUTE = [
  ["/dashboard", "iris", "depth", "dashboard"],
  ["/arena", "glitch", "zoom", "arena"],
  ["/problems", "matrix", "drop", "problems"],
  ["/roadmaps", "doors", "swing", "roadmaps"],
  ["/sprints", "letterbox", "rise", "sprints"],
  ["/events", "blinds", "swing", "events"],
  ["/leaderboard", "vortex", "spin", "leaderboard"],
  ["/live-quiz", "tiles", "flip", "live quiz"],
  ["/history", "lightning", "drop", "history"],
  ["/gallery", "portal", "zoom", "gallery"],
  ["/profile", "ink", "rise", "profile"],
  ["/notifications", "eclipse", "depth", "notifications"],
  ["/projects", "curtain", "rise", "projects"],
  ["/certificates", "tiles", "flip", "certificates"],
  ["/saved", "ink", "zoom", "saved"],
];
const ROTATION = ["glitch", "doors", "blinds", "vortex", "letterbox", "lightning", "eclipse", "matrix", "tiles", "warp", "curtain", "iris"];
const MOTIONS = ["depth", "swing", "zoom", "drop", "spin", "rise", "flip"];

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function transitionFor(pathname) {
  const hit = BY_ROUTE.find(([p]) => pathname === p || pathname.startsWith(`${p}/`));
  if (hit) return { effect: hit[1], motion: hit[2], label: hit[3] };
  const hv = hash(pathname);
  const label = pathname.split("/").filter(Boolean).pop()?.replace(/-/g, " ") || "home";
  return { effect: ROTATION[hv % ROTATION.length], motion: MOTIONS[hv % MOTIONS.length], label };
}
