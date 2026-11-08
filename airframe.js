/*
 * Spinning ASCII quadplane, in the spirit of donut.c.
 *
 * Airframe dimensions are in meters (x aft, y right, z up). Each surface is sampled into points with normals; every
 * frame the points are tumbled about two axes, projected with a z-buffer and
 * shaded with the classic ".,-~:;=!*#$@" luminance ramp. The four lift
 * rotors and the pusher prop spin while the airframe rotates.
 */
(() => {
  "use strict";

  const pre = document.getElementById("airframe-ascii");
  if (!pre) return;

  const COLS = 100;
  const ROWS = 40;
  const SHADES = ".,-~:;=!*#$@";
  const CENTER = [0.62, 0.0, 0.06]; // tumble about the middle of the airframe
  const RADIUS = 1.2;               // farthest geometry from CENTER (wingtip)
  const K2 = 4.0;                   // camera distance
  const LIGHT = [0, Math.SQRT1_2, -Math.SQRT1_2]; // above + behind viewer

  // ------------------------------------------------------------- geometry --
  const unit = (x, y, z) => {
    const m = Math.hypot(x, y, z) || 1;
    return [x / m, y / m, z / m];
  };

  // Symmetric NACA 4-digit half-thickness (per unit chord) and its slope.
  const naca = (u, t) => {
    u = Math.max(u, 1e-3);
    const f = 5 * t * (0.2969 * Math.sqrt(u) - 0.126 * u - 0.3516 * u ** 2 +
                       0.2843 * u ** 3 - 0.1036 * u ** 4);
    const df = 5 * t * (0.14845 / Math.sqrt(u) - 0.126 - 0.7032 * u +
                        0.8529 * u ** 2 - 0.4144 * u ** 3);
    return [f, df];
  };

  // Airfoil-section panel: chord along +x, thickness along `up`.
  function liftingSurface(out, root, span, up, length, leOf, chordOf, t, ds) {
    const ns = Math.max(2, Math.floor(length / ds));
    for (let i = 0; i <= ns; i++) {
      const s = (length * i) / ns;
      const le = leOf(s), c = chordOf(s);
      const nc = Math.max(6, Math.floor(c / ds));
      const bx = root[0] + le, by = root[1] + span[1] * s, bz = root[2] + span[2] * s;
      for (let k = 0; k <= nc; k++) {
        const u = (1 - Math.cos((Math.PI * k) / nc)) / 2; // cluster at LE/TE
        const [f, df] = naca(u, t);
        for (const side of [1, -1]) {
          const h = side * f * c;
          const n = unit(-df, side * up[1], side * up[2]);
          out.push(bx + u * c, by + up[1] * h, bz + up[2] * h, n[0], n[1], n[2]);
        }
      }
    }
  }

  // Body of revolution along x, optionally with a flat aft cap.
  function bodyX(out, x0, x1, rOf, yc, zc, ds, capAft) {
    const nx = Math.max(2, Math.floor((x1 - x0) / ds));
    const h = (x1 - x0) / nx;
    for (let i = 0; i <= nx; i++) {
      const x = x0 + h * i;
      const r = rOf(x);
      const dr = (rOf(Math.min(x + h, x1)) - rOf(Math.max(x - h, x0))) / (2 * h);
      const nt = Math.max(8, Math.floor((2 * Math.PI * r) / ds));
      for (let k = 0; k < nt; k++) {
        const a = (2 * Math.PI * k) / nt, ca = Math.cos(a), sa = Math.sin(a);
        const n = unit(-dr, ca, sa);
        out.push(x, yc + r * ca, zc + r * sa, n[0], n[1], n[2]);
      }
    }
    if (capAft) {
      const r = rOf(x1), nr = Math.max(2, Math.floor(r / ds));
      for (let j = 1; j <= nr; j++) {
        const rr = (r * j) / nr, nt = Math.max(6, Math.floor((2 * Math.PI * rr) / ds));
        for (let k = 0; k < nt; k++) {
          const a = (2 * Math.PI * k) / nt;
          out.push(x1, yc + rr * Math.cos(a), zc + rr * Math.sin(a), 1, 0, 0);
        }
      }
    }
  }

  // Vertical cylinder with a top cap (lift motors).
  function cylZ(out, xc, yc, z0, z1, r, ds) {
    const nz = Math.max(2, Math.floor((z1 - z0) / ds));
    const nt = Math.max(8, Math.floor((2 * Math.PI * r) / ds));
    for (let k = 0; k < nt; k++) {
      const a = (2 * Math.PI * k) / nt, ca = Math.cos(a), sa = Math.sin(a);
      for (let i = 0; i <= nz; i++) {
        out.push(xc + r * ca, yc + r * sa, z0 + ((z1 - z0) * i) / nz, ca, sa, 0);
      }
      for (const rr of [r * 0.33, r * 0.66]) {
        out.push(xc + rr * ca, yc + rr * sa, z1, 0, 0, 1);
      }
    }
  }

  const piecewise = (table) => (x) => {
    for (let i = 0; i < table.length - 1; i++) {
      const [x0, r0] = table[i], [x1, r1] = table[i + 1];
      if (x >= x0 && x <= x1) return r0 + ((r1 - r0) * (x - x0)) / (x1 - x0);
    }
    return table[table.length - 1][1];
  };

  function staticAirframe(ds) {
    const p = [];
    // Main wing: LE x=.25, z=.03; .28 m chord out to the booms, then tapers
    // to .20 m over .795 m with -0.865 deg LE sweep. Span 2.29 m.
    const tanSweep = Math.tan((-0.865 * Math.PI) / 180);
    const wLe = (s) => (s <= 0.35 ? 0 : (s - 0.35) * tanSweep);
    const wCh = (s) => (s <= 0.35 ? 0.28 : 0.28 - (0.08 * (s - 0.35)) / 0.795);
    for (const sg of [1, -1]) {
      liftingSurface(p, [0.25, 0, 0.03], [0, sg, 0], [0, 0, 1], 1.145, wLe, wCh, 0.12, ds);
    }
    // Inverted-V tail: root at (1.0, 0, .298); tips land on the boom ends.
    for (const sg of [1, -1]) {
      const span = unit(0, sg * 0.35, -0.298);
      const up = span[1] > 0 ? [0, -span[2], span[1]] : [0, span[2], -span[1]];
      liftingSurface(p, [1.0, 0, 0.298], span, up, 0.46, () => 0, () => 0.151, 0.09, ds);
    }
    // Fuselage: 0.6 m long, 80 mm max diameter.
    bodyX(p, 0, 0.6, piecewise([[0, 0], [0.0333, 0.0267], [0.1, 0.04],
                                [0.48, 0.04], [0.6, 0.0267]]), 0, 0, ds, true);
    // Pusher motor (AT2814).
    bodyX(p, 0.5735, 0.6275, () => 0.0176, 0, 0, ds, true);
    // Twin 16 mm booms with fore/aft lift motors.
    for (const y of [0.35, -0.35]) {
      bodyX(p, 0.0416, 1.2416, () => 0.008, y, 0, ds, false);
      for (const x of [0.0416, 0.6824]) cylZ(p, x, y, 0.008, 0.048, 0.014, ds);
    }
    return Float32Array.from(p);
  }

  // Flat, pitched blades rotating in the plane normal to `axis`.
  function blades(out, hub, axis, ref, nBlade, radius, phase, ds) {
    const [ax, ay, az] = axis, [rx, ry, rz] = ref;
    const sx = ay * rz - az * ry, sy = az * rx - ax * rz, sz = ax * ry - ay * rx;
    const nr = Math.max(4, Math.floor(radius / ds));
    const cp = Math.cos(0.25), sp = Math.sin(0.25); // blade pitch
    for (let b = 0; b < nBlade; b++) {
      const a = phase + (2 * Math.PI * b) / nBlade, ca = Math.cos(a), sa = Math.sin(a);
      const d = [rx * ca + sx * sa, ry * ca + sy * sa, rz * ca + sz * sa]; // radial
      const c = [sx * ca - rx * sa, sy * ca - ry * sa, sz * ca - rz * sa]; // chord
      const n = unit(ax * cp + c[0] * sp, ay * cp + c[1] * sp, az * cp + c[2] * sp);
      for (let i = 1; i <= nr; i++) {
        const r = (radius * i) / nr;
        const chord = 0.012 + 0.03 * Math.sin(Math.PI * Math.min(1, (r / radius) * 1.1));
        const nch = Math.max(2, Math.floor(chord / ds));
        for (let k = 0; k <= nch; k++) {
          const w = chord * (k / nch - 0.5);
          const px = hub[0] + d[0] * r + c[0] * w;
          const py = hub[1] + d[1] * r + c[1] * w;
          const pz = hub[2] + d[2] * r + c[2] * w;
          out.push(px, py, pz, n[0], n[1], n[2], px, py, pz, -n[0], -n[1], -n[2]);
        }
      }
    }
  }

  function rotors(t, ds) {
    const p = [];
    const spin = 13.5 * t; // rad/s
    for (const [x, y, dir] of [[0.0416, 0.35, 1], [0.0416, -0.35, -1],
                               [0.6824, 0.35, -1], [0.6824, -0.35, 1]]) {
      blades(p, [x, y, 0.052], [0, 0, dir], [1, 0, 0], 2, 0.1525, dir * spin + x, ds);
    }
    blades(p, [0.64, 0, 0], [1, 0, 0], [0, 1, 0], 3, 0.1395, -18 * t, ds);
    return p;
  }

  // --------------------------------------------------------------- render --
  const zbuf = new Float32Array(COLS * ROWS);
  const chars = new Array(COLS * ROWS);
  let K1 = 1, ds = 0.02, yScale = 0.5, airframe = new Float32Array(0);

  // yScale = character width / line height, so the model isn't squashed.
  function setup(aspect) {
    yScale = aspect;
    K1 = Math.min(COLS / 2 - 1, (ROWS / 2 - 1) / yScale) *
         (K2 - RADIUS * 0.6) / RADIUS;
    ds = (0.45 * (K2 - RADIUS)) / K1; // ~2 samples per cell up close
    airframe = staticAirframe(ds);
  }

  function draw(pts, m, L, cx, cy, cz) {
    const [a, b, c, d, e, f, g, h, i] = m;
    const hw = COLS / 2, hh = ROWS / 2, ky = yScale * K1;
    for (let j = 0; j < pts.length; j += 6) {
      const x = pts[j] - cx, y = pts[j + 1] - cy, z = pts[j + 2] - cz;
      const ooz = 1 / (g * x + h * y + i * z + K2);
      const xp = (hw + K1 * ooz * (a * x + b * y + c * z)) | 0;
      const yp = (hh - ky * ooz * (d * x + e * y + f * z)) | 0;
      if (xp < 0 || xp >= COLS || yp < 0 || yp >= ROWS) continue;
      const o = xp + COLS * yp;
      if (ooz > zbuf[o]) {
        zbuf[o] = ooz;
        const lum = pts[j + 3] * L[0] + pts[j + 4] * L[1] + pts[j + 5] * L[2];
        chars[o] = lum > 0 ? SHADES[(lum * 11.99) | 0] : ".";
      }
    }
  }

  function frame(A, B, t) {
    const cA = Math.cos(A), sA = Math.sin(A), cB = Math.cos(B), sB = Math.sin(B);
    // Model (x aft, y right, z up) -> view (X right, Y up, Z into screen):
    // start nose-on (X=y, Y=z, Z=x), yaw by B about Y, then tilt by A about X.
    const r0 = [sB, cB, 0], r1 = [0, 0, 1], r2 = [cB, -sB, 0];
    const m = [
      r0[0], r0[1], r0[2],
      r1[0] * cA - r2[0] * sA, r1[1] * cA - r2[1] * sA, r1[2] * cA - r2[2] * sA,
      r1[0] * sA + r2[0] * cA, r1[1] * sA + r2[1] * cA, r1[2] * sA + r2[2] * cA,
    ];
    // Light pulled back into model space, so normals need no rotation.
    const L = [0, 1, 2].map((k) =>
      m[k] * LIGHT[0] + m[3 + k] * LIGHT[1] + m[6 + k] * LIGHT[2]);
    zbuf.fill(0);
    chars.fill(" ");
    const [cx, cy, cz] = CENTER;
    draw(airframe, m, L, cx, cy, cz);
    draw(rotors(t, ds), m, L, cx, cy, cz);
    let s = "";
    for (let r = 0; r < ROWS; r++) {
      s += chars.slice(r * COLS, (r + 1) * COLS).join("") + (r < ROWS - 1 ? "\n" : "");
    }
    pre.textContent = s;
  }

  // ------------------------------------------------------------------ DOM --
  // Size the font so COLS characters exactly fill the container, and read the
  // real glyph aspect ratio so the projection matches the rendered font.
  function fit() {
    const probe = document.createElement("span");
    probe.textContent = "M".repeat(50);
    probe.style.cssText = "position:absolute;visibility:hidden;font-size:100px;white-space:pre";
    pre.appendChild(probe);
    const charW = probe.getBoundingClientRect().width / 50 / 100; // em per char
    pre.removeChild(probe);
    const lineH = parseFloat(getComputedStyle(pre).lineHeight) /
                  parseFloat(getComputedStyle(pre).fontSize) || 1.2;
    const width = pre.parentElement.clientWidth;
    pre.style.fontSize = `${width / (COLS * charW)}px`;
    const aspect = charW / lineH;
    if (Math.abs(aspect - yScale) > 1e-3 || airframe.length === 0) setup(aspect);
  }

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let visible = true, rafId = 0, t0 = 0, clock = 0;

  function tick(now) {
    const dt = t0 ? Math.min(0.1, (now - t0) / 1000) : 0;
    t0 = now;
    clock += dt;
    frame(-0.6 + 0.7 * clock, 0.6 + 0.4 * clock, clock);
    rafId = requestAnimationFrame(tick);
  }

  function update() {
    cancelAnimationFrame(rafId);
    rafId = 0;
    t0 = 0;
    if (reduceMotion.matches) frame(-0.6, 0.6, 0.2); // single still frame
    else if (visible) rafId = requestAnimationFrame(tick);
  }

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    update();
  }).observe(pre);
  reduceMotion.addEventListener("change", update);
  window.addEventListener("resize", () => { fit(); if (!rafId) update(); });

  fit();
  update();
  // Re-measure once the web font arrives (it changes the glyph width).
  if (document.fonts) document.fonts.ready.then(() => { fit(); if (!rafId) update(); });
})();
