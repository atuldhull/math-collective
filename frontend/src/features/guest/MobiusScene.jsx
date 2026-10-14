import { useEffect, useRef, useState } from "react";
import { journeyState, paintJourney } from "./journey";
import { PUBLIC_THEMES, usePublicTheme } from "./PublicTheme";

// Shared vertices preserve the original Möbius geometry and its seam.
function makeStrip(segments, rows) {
  const vertices = [],
    faces = [];
  for (let i = 0; i <= segments; i++) {
    const u = (i / segments) * Math.PI * 2;
    for (let j = 0; j <= rows; j++) {
      const v = -0.43 + (j / rows) * 0.86;
      const x = (1 + v * Math.cos(u / 2)) * Math.cos(u);
      const y = (1 + v * Math.cos(u / 2)) * Math.sin(u);
      const z = v * Math.sin(u / 2);
      vertices.push([x, y, z, Math.atan2(y, x) * 4]);
    }
  }
  for (let i = 0; i < segments; i++)
    for (let j = 0; j < rows; j++) {
      const a = i * (rows + 1) + j,
        b = a + rows + 1;
      faces.push({ indices: [a, b, b + 1, a + 1], edge: j === 0 || j === rows - 1 });
    }
  return { vertices, faces };
}
const full = makeStrip(96, 8),
  compact = makeStrip(56, 6);
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const approach = (current, target, speed, dt) => current + (target - current) * (1 - Math.exp(-speed * dt));
function initialPose() {
  return {
    yaw: 0,
    pitch: 0,
    yawTarget: 0,
    pitchTarget: 0,
    vy: 0,
    vp: 0,
    inertiaYaw: 0,
    inertiaPitch: 0,
    idleAngle: 0,
    phase: 0,
    idleWeight: 1,
    hover: 0,
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    scroll: 0,
    pulseAge: 10,
    releaseAge: 10,
    selected: false,
  };
}

export default function MobiusScene() {
  const canvasRef = useRef(null),
    figureRef = useRef(null);
  // The pose survives pause and palette changes. Input never triggers React renders.
  const poseRef = useRef(initialPose());
  const { theme } = usePublicTheme();
  const [paused, setPaused] = useState(false),
    [ready, setReady] = useState(false),
    [reduced, setReduced] = useState(false);
  useEffect(() => {
    const canvas = canvasRef.current,
      ctx = canvas?.getContext("2d", { alpha: true });
    if (!ctx || !window.ResizeObserver || !window.IntersectionObserver) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const mesh = coarse ? compact : full;
    const hue = PUBLIC_THEMES.find((item) => item.id === theme).hue;
    const s = poseRef.current;
    const figure = figureRef.current,
      hero = figure.closest(".mc-hero");
    const journey = hero.closest(".mc-journey");
    if (journey) journey.dataset.cinematic = "ready";
    let journeyTop = 0,
      journeyTravel = 1,
      pinTop = 0,
      painted = -1,
      wide = false;
    const projected = mesh.vertices.map(() => [0, 0, 0]);
    const faces = mesh.faces.map((face) => {
      const section = Math.floor(Math.floor(face.indices[0] / (coarse ? 7 : 9)) / (coarse ? 3 : 4));
      const angle = (section / (coarse ? 19 : 24)) * Math.PI * 2;
      return {
        ...face,
        depth: 0,
        dx: Math.cos(angle) * 1.25,
        dy: Math.sin(angle) * 0.95,
        dz: Math.sin(angle * 2) * 0.3,
      };
    });
    let visible = false,
      frame = 0,
      last = 0,
      width = 0,
      height = 0,
      announced = false;
    let heroTop = 0,
      heroHeight = 1,
      hovered = false,
      gesture = null,
      dirty = true;
    let canvasOffset = 0;
    let bounds = { left: 0, top: 0 },
      measuredScrollX = 0,
      measuredScrollY = 0;
    const automatic = () => !paused && !media.matches;
    const setInteraction = (value) => {
      if (figure.dataset.interaction !== value) figure.dataset.interaction = value;
    };
    function measure() {
      const rect = hero.getBoundingClientRect();
      heroTop = rect.top + window.scrollY;
      heroHeight = Math.max(rect.height, 1);
      wide = window.innerWidth > 760;
      if (journey) {
        journeyTop = journey.getBoundingClientRect().top + window.scrollY;
        pinTop = Math.min(0, window.innerHeight - heroHeight);
        hero.style.setProperty("--mc-pin-top", pinTop + "px");
        journey.style.setProperty("--mc-hero-height", heroHeight + "px");
        journeyTravel = Math.max(1, journey.offsetHeight - heroHeight);
      }
      bounds = canvas.getBoundingClientRect();
      canvasOffset = bounds.top - rect.top;
      measuredScrollX = window.scrollX;
      measuredScrollY = window.scrollY;
    }
    function schedule() {
      if (!frame && visible && !document.hidden) frame = requestAnimationFrame(tick);
    }
    function requestDraw() {
      dirty = true;
      schedule();
    }
    function update(dt) {
      const dragging = gesture?.dragging;
      s.releaseAge += dt;
      s.phase += dt * 0.55;
      s.idleWeight = approach(s.idleWeight, dragging ? 0 : hovered ? 0.22 : 1, dragging ? 18 : 2.2, dt);
      s.idleAngle += dt * 0.055 * s.idleWeight;
      s.hover = approach(s.hover, hovered || dragging ? 1 : 0, 7, dt);
      s.x = approach(s.x, s.targetX, 8, dt);
      s.y = approach(s.y, s.targetY, 8, dt);
      s.scroll = approach(s.scroll, clamp((window.scrollY - heroTop) / heroHeight, 0, 1), 5, dt);
      if (!dragging) {
        s.yawTarget += s.inertiaYaw * dt;
        s.pitchTarget = clamp(s.pitchTarget + s.inertiaPitch * dt, -1.15, 1.15);
        s.inertiaYaw *= Math.exp(-3.8 * dt);
        s.inertiaPitch *= Math.exp(-3.8 * dt);
      }
      // A critically damped spring follows drag targets. Substeps keep it
      // stable on the lower mobile frame budget and after dropped frames.
      const steps = Math.ceil(dt / 0.008),
        h = dt / steps,
        frequency = 20;
      for (let i = 0; i < steps; i++) {
        s.vy += ((s.yawTarget - s.yaw) * frequency * frequency - 2 * frequency * s.vy) * h;
        s.vp += ((s.pitchTarget - s.pitch) * frequency * frequency - 2 * frequency * s.vp) * h;
        s.yaw += s.vy * h;
        s.pitch += s.vp * h;
      }
      s.pulseAge = Math.min(10, s.pulseAge + dt);
      if (!gesture && s.releaseAge > 1.2) setInteraction(hovered ? "hover" : "idle");
    }
    function draw() {
      if (!width || !height || !visible || document.hidden) return;
      ctx.clearRect(0, 0, width, height);
      // Pausing freezes the current visual pose, including the camera and
      // lighting. Reduced motion omits ambient transforms entirely.
      const motion = !media.matches;
      const progress = journey && motion ? clamp((window.scrollY - journeyTop + pinTop) / journeyTravel, 0, 1) : 0;
      const story = journeyState(progress);
      if (journey && progress !== painted) {
        paintJourney(journey, story);
        painted = progress;
      }
      const cinematic = Boolean(journey) && motion;
      const centerX = width * (cinematic && wide ? 0.75 - story.center * 0.23 - story.exit * 0.15 : 0.5);
      const centerY = height * 0.5 + (cinematic && !wide ? (height * 0.5 - 170) * story.hero : 0);
      const spread = story.separate;
      figure.dataset.separation = spread.toFixed(3);
      const proximity = clamp(1 - Math.hypot(s.x, s.y) * 0.65, 0, 1) * s.hover;
      const pulse =
        motion && s.pulseAge < 2 ? Math.sin(Math.min(s.pulseAge * 9, Math.PI / 2)) * Math.exp(-s.pulseAge * 3) : 0;
      const breathe = motion ? Math.sin(s.phase * 1.2) * 0.006 * s.idleWeight : 0;
      const a =
        -0.38 + s.idleAngle + s.yaw + (motion ? s.x * 0.24 * s.hover + (journey ? story.turn : s.scroll * 1.15) : 0);
      const b =
        0.94 +
        s.pitch +
        (motion
          ? s.y * 0.18 * s.hover +
            (journey ? story.unfold * 2 : s.scroll * 0.25) +
            Math.sin(s.phase) * 0.025 * s.idleWeight
          : 0);
      const roll = motion ? s.x * 0.055 * s.hover : 0;
      const ca = Math.cos(a),
        sa = Math.sin(a),
        cb = Math.cos(b),
        sb = Math.sin(b),
        cr = Math.cos(roll),
        sr = Math.sin(roll);
      const scale =
        Math.min(width / (cinematic ? (wide ? 7.2 : 3.6 + story.hero * 0.55) : 3.6), height / 3.1) *
        (1 + breathe) *
        story.zoom *
        (1 - spread * 0.3) *
        (1 - story.exit * 0.24);
      const magnetX = motion ? s.x * proximity * 15 : 0,
        magnetY = motion ? s.y * proximity * 10 : 0;
      const lightX = -0.35 + s.x * s.hover * 0.22,
        lightY = -0.6 + s.y * s.hover * 0.16;
      const lightLength = Math.hypot(lightX, lightY, 0.72);
      if (s.hover > 0.01 || pulse > 0.01 || s.selected) {
        const glow = ctx.createRadialGradient(
          centerX + magnetX,
          centerY + magnetY,
          0,
          width / 2,
          height / 2,
          Math.min(width, height) * 0.48,
        );
        glow.addColorStop(
          0,
          `hsla(${hue},75%,65%,${0.025 + s.hover * 0.065 + pulse * 0.1 + (s.selected ? 0.035 : 0)})`,
        );
        glow.addColorStop(1, `hsla(${hue},75%,65%,0)`);
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, width, height);
      }
      mesh.vertices.forEach(([baseX, baseY, baseZ, wavePhase], i) => {
        const radial = 1 + story.unfold * Math.cos(wavePhase / 2);
        const x = baseX * radial + (motion ? s.x * proximity * 0.035 * (baseZ + 0.5) : 0),
          y = baseY * radial,
          z = baseZ * (1 - story.unfold);
        // A periodic spatial wave is equal at both copies of the seam.
        // It expands each vertex by at most 4%, leaving the topology intact.
        const wave = 1 + 0.04 * pulse * Math.sin(wavePhase - s.pulseAge * 10);
        const xx = (x * ca + z * sa) * wave,
          zz = (-x * sa + z * ca) * wave;
        const yy = y * wave * cb - zz * sb;
        projected[i][0] = xx * cr - yy * sr;
        projected[i][1] = xx * sr + yy * cr;
        projected[i][2] = y * wave * sb + zz * cb;
      });
      faces.forEach((face) => {
        face.depth = face.indices.reduce((sum, i) => sum + projected[i][2], 0) / 4 + face.dz * spread;
      });
      faces.sort((a, b) => a.depth - b.depth);
      for (const face of faces) {
        const p = face.indices.map((i) => projected[i]);
        const ux = p[1][0] - p[0][0],
          uy = p[1][1] - p[0][1],
          uz = p[1][2] - p[0][2];
        const vx = p[3][0] - p[0][0],
          vy = p[3][1] - p[0][1],
          vz = p[3][2] - p[0][2];
        const nx = uy * vz - uz * vy,
          ny = uz * vx - ux * vz,
          nz = ux * vy - uy * vx;
        const light = Math.abs((nx * lightX + ny * lightY + nz * 0.72) / ((Math.hypot(nx, ny, nz) || 1) * lightLength));
        const lum = (theme === "arctic" ? 22 : 24) + light * 61 + s.hover * 3 + pulse * 4;
        ctx.beginPath();
        // Coherent cross-sections follow deterministic radial trajectories.
        p.forEach(([x, y, z], i) => {
          x += face.dx * spread;
          y += face.dy * spread;
          z += face.dz * spread;
          const perspective = 5.4 / (5.4 - z);
          // Perspective makes closer parts respond more strongly to the
          // small magnetic camera translation than farther parts.
          const px = centerX + (x * scale + magnetX) * perspective,
            py = centerY + (y * scale + magnetY) * perspective;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.closePath();
        ctx.fillStyle = `hsl(${hue},${face.edge ? 68 + s.hover * 9 : 16 + (1 - light) * 22 + s.hover * 6}%,${face.edge ? lum * 0.87 : lum}%)`;
        ctx.globalAlpha = 1 - story.wire * 0.78;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = `hsla(${hue},32%,${lum + 8}%,${0.32 + s.hover * 0.06 + story.wire * 0.32})`;
        ctx.lineWidth = 0.45;
        ctx.stroke();
      }
      if (story.grid > 0.001) {
        ctx.strokeStyle = `hsla(${hue},42%,${theme === "arctic" ? 35 : 72}%,${story.grid * 0.27})`;
        ctx.lineWidth = 0.65;
        for (let k = 0; k < 12; k++) {
          const angle = (k / 12) * Math.PI * 2 + story.turn * 0.15;
          ctx.beginPath();
          ctx.moveTo(centerX + Math.cos(angle) * scale * 0.65, centerY + Math.sin(angle) * scale * 0.4);
          ctx.bezierCurveTo(
            centerX + Math.cos(angle + 0.4) * scale * 1.4,
            centerY + Math.sin(angle + 0.4) * scale,
            centerX + Math.cos(angle - 0.3) * width * 0.45,
            centerY + Math.sin(angle - 0.3) * height * 0.8,
            centerX + Math.cos(angle) * width,
            centerY + Math.sin(angle) * height,
          );
          ctx.stroke();
        }
      }
      if (!announced) {
        announced = true;
        setReady(true);
      }
    }
    function tick(time) {
      frame = 0;
      if (!visible || document.hidden) return;
      const elapsed = time - last;
      const interval = coarse ? (gesture?.dragging ? 33 : 65) : 33;
      if (dirty || elapsed >= interval) {
        if (automatic()) update(Math.min(elapsed / 1000, 0.06));
        last = time;
        draw();
        dirty = false;
      }
      if (automatic()) schedule();
    }
    function canvasTop() {
      if (!journey || media.matches) return bounds.top - window.scrollY + measuredScrollY;
      const stickyTop = Math.min(
        Math.max(journeyTop - window.scrollY, pinTop),
        journeyTop + journeyTravel - window.scrollY,
      );
      return stickyTop + canvasOffset;
    }
    function position(event) {
      s.targetX = clamp(((event.clientX - bounds.left + window.scrollX - measuredScrollX) / width - 0.5) * 2, -1, 1);
      s.targetY = clamp(((event.clientY - canvasTop()) / height - 0.5) * 2, -1, 1);
    }
    function manualDraw() {
      if (!automatic()) {
        s.yaw = s.yawTarget;
        s.pitch = s.pitchTarget;
        s.vy = s.vp = 0;
        requestDraw();
      } else schedule();
    }
    function enter(event) {
      if (event.pointerType === "touch") return;
      measure();
      hovered = true;
      position(event);
      setInteraction("hover");
      if (automatic()) schedule();
    }
    function down(event) {
      if (!event.isPrimary || event.button !== 0 || gesture) return;
      measure();
      position(event);
      s.inertiaYaw = s.inertiaPitch = 0;
      gesture = {
        id: event.pointerId,
        type: event.pointerType,
        startX: event.clientX,
        startY: event.clientY,
        x: event.clientX,
        y: event.clientY,
        time: event.timeStamp,
        dragging: false,
        scrolling: false,
      };
      hovered = true;
      if (event.pointerType !== "touch") canvas.setPointerCapture(event.pointerId);
      setInteraction("pressed");
    }
    function move(event) {
      if (!gesture) {
        if (event.pointerType !== "touch") {
          position(event);
          if (automatic()) schedule();
        }
        return;
      }
      if (event.pointerId !== gesture.id) return;
      const dx = event.clientX - gesture.x,
        dy = event.clientY - gesture.y;
      const totalX = event.clientX - gesture.startX,
        totalY = event.clientY - gesture.startY;
      if (!gesture.dragging && !gesture.scrolling) {
        if (gesture.type === "touch" && Math.abs(totalY) > 6 && Math.abs(totalY) > Math.abs(totalX))
          gesture.scrolling = true;
        else if (
          Math.hypot(totalX, totalY) > 5 &&
          (gesture.type !== "touch" || Math.abs(totalX) > Math.abs(totalY) * 1.15)
        ) {
          gesture.dragging = true;
          canvas.setPointerCapture(event.pointerId);
          setInteraction("dragging");
        }
      }
      if (gesture.dragging) {
        const gain = (Math.PI * 1.7) / Math.max(width, 280),
          dt = clamp((event.timeStamp - gesture.time) / 1000, 0.008, 0.1);
        s.yawTarget += dx * gain;
        s.pitchTarget = clamp(s.pitchTarget + dy * gain, -1.15, 1.15);
        s.inertiaYaw = clamp(s.inertiaYaw * 0.4 + ((dx * gain) / dt) * 0.6, -3, 3);
        s.inertiaPitch = clamp(s.inertiaPitch * 0.4 + ((dy * gain) / dt) * 0.6, -2, 2);
        manualDraw();
      }
      position(event);
      gesture.x = event.clientX;
      gesture.y = event.clientY;
      gesture.time = event.timeStamp;
    }
    function pulse() {
      if (automatic()) {
        s.pulseAge = 0;
        s.releaseAge = 0;
        setInteraction("pulse");
        schedule();
      } else {
        s.selected = !s.selected;
        requestDraw();
      }
    }
    function finish(event, cancelled = false) {
      if (!gesture || event.pointerId !== gesture.id) return;
      const current = gesture;
      gesture = null;
      if (cancelled || current.scrolling || !automatic()) {
        s.inertiaYaw = s.inertiaPitch = 0;
      }
      // A held pose has no release velocity; don't fling from a stale move.
      if (event.timeStamp - current.time > 100) {
        s.inertiaYaw = s.inertiaPitch = 0;
      }
      if (canvas.hasPointerCapture(current.id)) canvas.releasePointerCapture(current.id);
      const top = canvasTop();
      const left = bounds.left - window.scrollX + measuredScrollX;
      hovered =
        current.type !== "touch" &&
        event.clientX >= left &&
        event.clientX <= left + width &&
        event.clientY >= top &&
        event.clientY <= top + height;
      if (!hovered) {
        s.targetX = s.targetY = 0;
      }
      s.releaseAge = 0;
      if (
        !cancelled &&
        !current.dragging &&
        !current.scrolling &&
        Math.hypot(event.clientX - current.startX, event.clientY - current.startY) < 6
      )
        pulse();
      else setInteraction(current.dragging && automatic() && !cancelled ? "settling" : hovered ? "hover" : "idle");
      if (automatic()) schedule();
    }
    const up = (event) => finish(event),
      cancel = (event) => finish(event, true);
    const accessibleClick = (event) => {
      if (event.detail === 0) pulse();
    };
    function leave() {
      if (gesture) return;
      hovered = false;
      s.targetX = s.targetY = 0;
      if (s.releaseAge > 1.2) setInteraction("idle");
      if (automatic()) schedule();
    }
    function key(event) {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        if (event.key === "Enter" || event.key === " ") {
          if (!event.repeat) pulse();
          return;
        }
        s.inertiaYaw = s.inertiaPitch = 0;
        if (event.key === "ArrowLeft") s.yawTarget -= 0.18;
        if (event.key === "ArrowRight") s.yawTarget += 0.18;
        if (event.key === "ArrowUp") s.pitchTarget = clamp(s.pitchTarget - 0.14, -1.15, 1.15);
        if (event.key === "ArrowDown") s.pitchTarget = clamp(s.pitchTarget + 0.14, -1.15, 1.15);
        manualDraw();
      }
    }
    function abandon() {
      if (gesture) {
        const id = gesture.id;
        gesture = null;
        if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
      }
      hovered = false;
      s.targetX = s.targetY = 0;
      s.inertiaYaw = s.inertiaPitch = 0;
      setInteraction("idle");
    }
    function sync() {
      cancelAnimationFrame(frame);
      frame = 0;
      last = performance.now();
      setReduced(media.matches);
      if (media.matches) {
        if (journey) paintJourney(journey, journeyState(0));
        s.scroll = s.x = s.y = s.hover = 0;
        s.pulseAge = 10;
        s.vy = s.vp = 0;
        s.yawTarget = s.yaw;
        s.pitchTarget = s.pitch;
      }
      if (document.hidden || !visible) abandon();
      painted = -1;
      figure.dataset.motion = !visible || document.hidden ? "suspended" : automatic() ? "running" : "still";
      dirty = true;
      schedule();
    }
    const resize = new window.ResizeObserver(([entry]) => {
      width = entry.contentRect.width;
      height = entry.contentRect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1 : 1.5);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      measure();
      sync();
    });
    resize.observe(canvas);
    const observer = new window.IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    observer.observe(canvas);
    canvas.addEventListener("pointerenter", enter, { passive: true });
    canvas.addEventListener("pointerdown", down, { passive: true });
    canvas.addEventListener("pointermove", move, { passive: true });
    canvas.addEventListener("pointerup", up, { passive: true });
    canvas.addEventListener("pointercancel", cancel, { passive: true });
    canvas.addEventListener("lostpointercapture", cancel, { passive: true });
    canvas.addEventListener("pointerleave", leave, { passive: true });
    canvas.addEventListener("keydown", key);
    canvas.addEventListener("click", accessibleClick);
    const journeyResize = new window.ResizeObserver(measure);
    journeyResize.observe(hero);
    if (journey) journeyResize.observe(journey);
    const onScroll = () => {
      if (!media.matches) requestDraw();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure, { passive: true });
    window.addEventListener("blur", abandon);
    media.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      journeyResize.disconnect();
      window.removeEventListener("scroll", onScroll);
      observer.disconnect();
      abandon();
      canvas.removeEventListener("pointerenter", enter);
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", cancel);
      canvas.removeEventListener("lostpointercapture", cancel);
      canvas.removeEventListener("pointerleave", leave);
      canvas.removeEventListener("keydown", key);
      canvas.removeEventListener("click", accessibleClick);
      window.removeEventListener("resize", measure);
      window.removeEventListener("blur", abandon);
      media.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [paused, theme]);
  return (
    <figure className="mc-sculpture" ref={figureRef}>
      <div className="mc-sculpture-stage">
        <div className="mc-orbit mc-orbit-one" aria-hidden="true" />
        <div className="mc-orbit mc-orbit-two" aria-hidden="true" />
        <span className="mc-axis-label" aria-hidden="true">
          u ∈ [0, 2π] · v ∈ [−0.43, 0.43]
        </span>
        {!ready && (
          <svg className="mc-sculpture-fallback" viewBox="0 0 600 500" aria-hidden="true">
            <path
              d="M140 310C-10 100 450 20 490 200S230 420 150 300S360 95 430 190S310 450 140 310Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="42"
            />
          </svg>
        )}
        <canvas
          ref={canvasRef}
          role="button"
          tabIndex={0}
          aria-label="Interactive Möbius sculpture"
          aria-describedby="mc-sculpture-help"
          aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Enter Space"
        />
        {!reduced && ready && (
          <button
            className="mc-motion-toggle"
            onClick={() => setPaused(!paused)}
            aria-label={paused ? "Play sculpture animation" : "Pause sculpture animation"}
          >
            {paused ? "Play ↻" : "Pause Ⅱ"}
          </button>
        )}
      </div>
      <figcaption>
        <span>
          <span className="mc-dot" /> FIG. 01 — THE MÖBIUS STRIP
        </span>
        <span>One surface. One boundary.</span>
        <span id="mc-sculpture-help" className="mc-sculpture-help">
          Drag to turn · Tap to resonate
          <span className="mc-keyboard-hint"> · Arrow keys to rotate, Enter to pulse</span>
          <span className="mc-touch-hint"> · Swipe vertically to scroll</span>
        </span>
      </figcaption>
    </figure>
  );
}
