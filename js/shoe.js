/* OVRA Vela 2 — procedural shoe model (three.js r128, no model files).
   Axes: x = heel(-) → toe(+), y = up, z = width. */
(function () {
  const COLORWAYS = {
    cobalt:  { name: 'Cobalt',  upper: '#2B44E0', mid: '#EEF0F4', out: '#16181D', trim: '#B9E3FF', lace: '#F2F4F7', collar: '#1B2A8F' },
    glacier: { name: 'Glacier', upper: '#DDE2EA', mid: '#FAFAFB', out: '#2A2E36', trim: '#2B44E0', lace: '#8E9AB0', collar: '#A9B2C2' },
    basalt:  { name: 'Basalt',  upper: '#2B2E35', mid: '#4A505B', out: '#111216', trim: '#E3E6EB', lace: '#1C1E23', collar: '#17191D' },
    sundial: { name: 'Sundial', upper: '#F0B92B', mid: '#FFFFFF', out: '#23252B', trim: '#1B2A8F', lace: '#FFFFFF', collar: '#C98A12' },
    moss:    { name: 'Moss',    upper: '#5E6B4E', mid: '#D8D4C6', out: '#24261F', trim: '#E8A33D', lace: '#24261F', collar: '#3E4733' }
  };

  /* ---------- profile curves ---------- */
  function curve(t, x) {
    if (x <= t[0][0]) return t[0][1];
    for (let i = 1; i < t.length; i++) {
      if (x <= t[i][0]) {
        const a = t[i - 1], b = t[i];
        let k = (x - a[0]) / (b[0] - a[0]);
        k = k * k * (3 - 2 * k);
        return a[1] + (b[1] - a[1]) * k;
      }
    }
    return t[t.length - 1][1];
  }
  // upper height above the sole, plan-view width, sole stack
  const H_T = [[-2.0, 0.96], [-1.6, 1.08], [-1.0, 1.02], [-0.3, 0.8], [0.6, 0.58], [1.4, 0.42], [2.0, 0.32]];
  const W_T = [[-2.14, 0.55], [-1.9, 0.86], [-1.4, 0.96], [-0.5, 0.98], [0.6, 1.22], [1.45, 1.14], [1.95, 0.84], [2.16, 0.48]];
  const T_T = [[-2.1, 0.48], [-1.2, 0.47], [0.4, 0.36], [1.4, 0.28], [2.1, 0.25]];
  const Hf = x => curve(H_T, x), Wf = x => curve(W_T, x), thick = x => curve(T_T, x);
  // rocker: toe spring at the front, bevel at the heel
  function bottom(x) {
    let y = 0;
    if (x > 0.85) { const t = (x - 0.85) / 1.25; y += t * t * 0.34; }
    if (x < -1.7) { const t = (-1.7 - x) / 0.4; y += t * t * 0.08; }
    return y;
  }
  const sp = (v, p) => Math.sign(v) * Math.pow(Math.abs(v), p);
  function taper(s, kh, kt) { const u = 2 * s - 1, k = u < 0 ? kh : kt; return Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u), k)), 1 / k); }

  /* ---------- geometry helpers ---------- */
  function grid(nu, nv, fn, closeV) {
    const n = (nu + 1) * (nv + 1), pos = new Float32Array(n * 3), col = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    let k = 0;
    for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
      const r = fn(i / nu, j / nv);
      pos[k * 3] = r[0]; pos[k * 3 + 1] = r[1]; pos[k * 3 + 2] = r[2];
      const c = r[3] == null ? 1 : r[3];
      col[k * 3] = col[k * 3 + 1] = col[k * 3 + 2] = c;
      uv[k * 2] = j / nv; uv[k * 2 + 1] = i / nu;
      k++;
    }
    const idx = [];
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const a = i * (nv + 1) + j, b = a + nv + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setIndex(idx);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.computeVertexNormals();
    if (closeV) { // average normals across the seam of a closed loop
      const nr = g.attributes.normal.array;
      for (let i = 0; i <= nu; i++) {
        const a = i * (nv + 1) * 3, b = (i * (nv + 1) + nv) * 3;
        for (let c = 0; c < 3; c++) { const m = (nr[a + c] + nr[b + c]) / 2; nr[a + c] = nr[b + c] = m; }
      }
    }
    return g;
  }
  // loft along x with cosine spacing so the rounded ends get more rings
  function loft(x0, x1, nx, nt, fn) {
    return grid(nx, nt, (s, v) => {
      const x = x0 + (x1 - x0) * (0.5 - 0.5 * Math.cos(Math.PI * s));
      const r = fn(x, s, v * Math.PI * 2);
      return [x, r[0], r[1], r[2]];
    }, true);
  }

  /* ---------- upper ---------- */
  const UX0 = -2.02, UX1 = 2.08;
  const sOf = x => Math.acos(1 - 2 * (x - UX0) / (UX1 - UX0)) / Math.PI;
  function uFrame(x) {
    const s = sOf(Math.min(UX1, Math.max(UX0, x)));
    const e = taper(s, 3.2, 2.3), Ht = Hf(x), hLow = 0.26 * Ht;
    return { e, yb: bottom(x) + thick(x) - 0.07, Ht, hLow, hw: Wf(x) * 0.49 * e };
  }
  // th: 0 = bottom centre, PI/2 = outer side (z+), PI = top ridge
  function uPoint(x, th) {
    const f = uFrame(x), c = Math.cos(th), sn = Math.sin(th);
    const y = c >= 0
      ? f.yb + f.hLow - sp(c, 0.55) * (f.hLow + 0.05) * f.e
      : f.yb + f.hLow + Math.pow(-c, 0.75) * (f.Ht - f.hLow) * f.e;
    return [x, y, f.hw * sp(sn, 0.6)];
  }
  // point pushed out along the cross-section normal
  function uOffset(x, th, d) {
    const p = uPoint(x, th), f = uFrame(x);
    const ny = p[1] - (f.yb + f.hLow), nz = p[2], l = Math.hypot(ny, nz) || 1;
    return [x, p[1] + ny / l * d, p[2] + nz / l * d];
  }
  const ridge = x => uPoint(x, Math.PI)[1];
  // ankle opening
  const CX0 = -1.86, CX1 = -0.5;
  function collarTop(x) {
    if (x <= CX0 || x >= CX1) return Infinity;
    const q = (x - CX0) / (CX1 - CX0);
    return ridge(x) - 0.4 * Math.pow(Math.sin(Math.PI * q), 0.6);
  }
  // th on the outer side where the uncut upper reaches the collar line
  function collarTh(x) {
    const top = collarTop(x);
    if (!isFinite(top)) return Math.PI;
    let a = Math.PI / 2, b = Math.PI;
    for (let i = 0; i < 30; i++) { const m = (a + b) / 2; if (uPoint(x, m)[1] < top) a = m; else b = m; }
    return (a + b) / 2;
  }
  const THROAT_X0 = -0.52, THROAT_X1 = 0.98;
  function upperFn(x, s, th) {
    const p = uPoint(x, th);
    let y = p[1], shade = 1;
    const top = collarTop(x);
    if (y > top) { y = top; shade = 0.12; } // inside of the shoe
    else if (y > top - 0.04) shade = 0.6 + 0.4 * (top - y) / 0.04;
    // tongue showing between the eyestays
    if (x > THROAT_X0 && x < THROAT_X1 && Math.abs(th - Math.PI) < 0.5) shade = Math.min(shade, 0.84);
    return [y, p[2], shade];
  }

  /* ---------- sole ---------- */
  function soleFn(y0f, y1f, wS, k, groove) {
    return (x, s, th) => {
      const e = taper(s, k, k), y0 = y0f(x), y1 = y1f(x), yc = (y0 + y1) / 2, hh = (y1 - y0) / 2;
      const c = Math.cos(th), sn = Math.sin(th);
      // flared sidewall: a touch wider at the top edge, sculpt line along the side
      const flare = 1 + 0.06 * Math.max(0, -c);
      const shade = groove ? 1 - 0.18 * Math.exp(-(c + 0.12) * (c + 0.12) / 0.003) : 1;
      return [yc - sp(c, 0.32) * hh * (0.35 + 0.65 * e), Wf(x) * wS * 0.5 * e * flare * sp(sn, 0.32), shade];
    };
  }

  /* ---------- textures ---------- */
  function knitTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#808080'; g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 8) for (let x = 0; x < 256; x += 8) {
      g.fillStyle = '#d4d4d4';
      g.beginPath(); g.ellipse(x + 2, y + 4, 2, 3.6, 0.5, 0, 7); g.fill();
      g.beginPath(); g.ellipse(x + 6, y + 4, 2, 3.6, -0.5, 0, 7); g.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(16, 30);
    return t;
  }
  function shadowTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    const r = g.createRadialGradient(128, 128, 8, 128, 128, 128);
    r.addColorStop(0, 'rgba(0,0,0,.5)'); r.addColorStop(.5, 'rgba(0,0,0,.18)'); r.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = r; g.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }
  let KNIT, SHADOW;

  /* ---------- the shoe ---------- */
  function createShoe() {
    KNIT = KNIT || knitTexture(); SHADOW = SHADOW || shadowTexture();
    const M = (o) => new THREE.MeshStandardMaterial(Object.assign({ side: THREE.DoubleSide }, o));
    const mats = {
      upper: M({ roughness: .85, bumpMap: KNIT, bumpScale: .014, vertexColors: true }),
      mid: M({ roughness: .55, vertexColors: true }),
      out: M({ roughness: .92 }),
      trim: M({ roughness: .38, metalness: .05 }),
      lace: M({ roughness: .75 }),
      collar: M({ roughness: .9 })
    };
    const root = new THREE.Group(), shoe = new THREE.Group(); root.add(shoe);
    const upper = new THREE.Group(), midG = new THREE.Group(), outG = new THREE.Group();
    shoe.add(upper, midG, outG);

    // knit body
    upper.add(new THREE.Mesh(loft(UX0, UX1, 120, 80, upperFn), mats.upper));

    // padded collar rim around the ankle opening
    const rim = [];
    for (let i = 0; i <= 40; i++) { const x = CX1 - (CX1 - CX0) * i / 40, th = collarTh(x); rim.push(new THREE.Vector3(...uOffset(x, th, -0.01))); }
    for (let i = 1; i < 40; i++) { const x = CX0 + (CX1 - CX0) * i / 40, th = 2 * Math.PI - collarTh(x); rim.push(new THREE.Vector3(...uOffset(x, th, -0.01))); }
    upper.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rim, true), 160, 0.05, 12, true), mats.collar));

    // tongue: rises out of the throat and stands up in front of the ankle
    const TX0 = -0.3, TX1 = -0.95;
    upper.add(new THREE.Mesh(grid(30, 24, (u, v) => {
      const x = TX0 + (TX1 - TX0) * u;
      const w = 0.62 * Math.pow(Math.max(0, 1 - Math.pow(u, 6)), 0.35);
      const th = Math.PI + (v * 2 - 1) * w;
      const lift = 0.02 + Math.pow(Math.max(0, (-0.5 - x) / 0.58), 2) * 0.05;
      const p = uOffset(x, th, lift);
      p[0] -= Math.pow(u, 2) * 0.02; // lean back
      if (isFinite(collarTop(x))) p[1] -= 0.55 * (ridge(x) - collarTop(x)); // sit down inside the opening
      return [p[0], p[1], p[2], 0.78];
    }), mats.upper));

    // eyestays, one per side
    [1, -1].forEach(side => {
      upper.add(new THREE.Mesh(grid(40, 4, (u, v) => {
        const x = THROAT_X0 + (THROAT_X1 + 0.05 - THROAT_X0) * u;
        const th = Math.PI - side * (0.5 + 0.24 * v + 0.05 * u);
        return uOffset(x, th, 0.012);
      }), mats.trim));
    });

    // side stripe sweeping from the toe up towards the heel, stopping below the collar
    [1, -1].forEach(side => {
      upper.add(new THREE.Mesh(grid(50, 3, (u, v) => {
        const x = 1.0 + (-1.3 - 1.0) * u;
        const w = (0.04 + 0.08 * u) * Math.sqrt(Math.max(0, 1 - Math.pow(u, 6)));
        const thc = 1.62 + (1.86 - 1.62) * Math.pow(u, 1.3);
        const th = thc + (v * 2 - 1) * w;
        return uOffset(x, side > 0 ? th : 2 * Math.PI - th, 0.01);
      }), mats.trim));
    });

    // heel counter: wraps the back below the collar
    [1, -1].forEach(side => {
      upper.add(new THREE.Mesh(grid(24, 16, (u, v) => {
        const x = UX0 + 0.01 + (-1.25 - 0.4 * v - UX0) * u;
        const thMax = Math.min(Math.PI, collarTh(x) - 0.12);
        const th = 1.25 + (thMax - 1.25) * v;
        return uOffset(x, side > 0 ? th : 2 * Math.PI - th, 0.008);
      }), mats.collar));
    });

    // laces: criss-cross, each strand hugging the throat
    const laceGeo = [];
    for (let i = 0; i < 6; i++) {
      const xa = -0.36 + i * 0.24, xb = xa + 0.24;
      [[1, 0.03], [-1, 0.045]].forEach(([dir, off]) => {
        const pts = [];
        for (let k = 0; k <= 12; k++) {
          const t = k / 12, x = xa + (xb - xa) * t, th = Math.PI + dir * (0.6 - 1.2 * t);
          pts.push(new THREE.Vector3(...uOffset(x, th, off + 0.03 * Math.sin(Math.PI * t))));
        }
        laceGeo.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.024, 8, false));
      });
    }
    laceGeo.forEach(g => upper.add(new THREE.Mesh(g, mats.lace)));
    // loose bow ends at the top eyelet
    [[1, 0.5], [-1, -0.3]].forEach(([side, swing]) => {
      const p0 = uOffset(-0.36, Math.PI, 0.06), pts = [new THREE.Vector3(...p0)];
      for (let k = 1; k <= 6; k++) pts.push(new THREE.Vector3(p0[0] - 0.05 * k + swing * 0.02 * k, p0[1] + 0.03 * k - 0.012 * k * k, p0[2] + side * 0.07 * k));
      upper.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.022, 8, false), mats.lace));
    });

    // heel pull tab
    const tab = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.16), mats.trim);
    tab.position.set(-1.97, ridge(-1.86) - 0.02, 0); tab.rotation.z = -0.3; upper.add(tab);

    // midsole + outsole
    midG.add(new THREE.Mesh(loft(-2.14, 2.16, 130, 56, soleFn(x => bottom(x) + 0.06, x => bottom(x) + thick(x), 1.02, 5, true)), mats.mid));
    outG.add(new THREE.Mesh(loft(-2.12, 2.14, 130, 40, soleFn(x => bottom(x), x => bottom(x) + 0.08, 1.04, 5, false)), mats.out));
    // rubber pods where the foot lands; foam left bare under the arch
    const podGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.035, 14), pods = [];
    for (let x = -1.85; x <= 1.6; x += 0.24) {
      if (x > -0.9 && x < 0.2) continue;
      const w = Wf(x) * 0.42;
      for (let z = -w; z <= w + 1e-3; z += w / 1.5) pods.push([x, z]);
    }
    const inst = new THREE.InstancedMesh(podGeo, mats.out, pods.length), d = new THREE.Object3D();
    pods.forEach((p, i) => {
      const sl = (bottom(p[0] + 0.01) - bottom(p[0] - 0.01)) / 0.02;
      d.position.set(p[0], bottom(p[0]) - 0.008, p[1]); d.rotation.set(0, 0, Math.atan(sl)); d.updateMatrix();
      inst.setMatrixAt(i, d.matrix);
    });
    outG.add(inst);

    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(5.8, 2.6), new THREE.MeshBasicMaterial({ map: SHADOW, transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; root.add(shadow);
    shoe.position.y = -0.72; shadow.position.y = -0.8;

    const lin = hex => new THREE.Color(hex).convertSRGBToLinear();
    return {
      root, shoe, shadow, mats, parts: { upper, mid: midG, out: outG },
      setColorway(cw) {
        mats.upper.color.copy(lin(cw.upper)); mats.mid.color.copy(lin(cw.mid)); mats.out.color.copy(lin(cw.out));
        mats.trim.color.copy(lin(cw.trim)); mats.lace.color.copy(lin(cw.lace)); mats.collar.color.copy(lin(cw.collar));
      }
    };
  }

  /* ---------- scene / view ---------- */
  function makeScene() {
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x5d626c, 0.75));
    const key = new THREE.DirectionalLight(0xffffff, 1.15); key.position.set(3, 5, 4); scene.add(key);
    const rim = new THREE.DirectionalLight(0xdfe6ff, 0.6); rim.position.set(-4, 2.5, -3); scene.add(rim);
    const fill = new THREE.DirectionalLight(0xffffff, 0.35); fill.position.set(-1, -2, 4); scene.add(fill);
    return scene;
  }
  function makeRenderer(canvas, extra) {
    const r = new THREE.WebGLRenderer(Object.assign({ canvas, antialias: true, alpha: true }, extra));
    r.setClearColor(0x000000, 0);
    r.outputEncoding = THREE.sRGBEncoding;
    r.toneMapping = THREE.NoToneMapping;
    return r;
  }
  function makeView(canvas) {
    const renderer = makeRenderer(canvas);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    const scene = makeScene(), shoe = createShoe(); scene.add(shoe.root);
    const v = { renderer, camera, scene, shoe, visible: true, aspect: 1 };
    const resize = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
      renderer.setSize(w, h, false); camera.aspect = v.aspect = w / h; camera.updateProjectionMatrix();
    };
    new ResizeObserver(resize).observe(canvas); resize();
    new IntersectionObserver(es => { v.visible = es[0].isIntersecting; }).observe(canvas);
    return v;
  }
  // fit a shoe of half-length ~2.5 inside the frustum whatever the aspect
  function frame(v, halfH) {
    const t = Math.tan(THREE.MathUtils.degToRad(15));
    const dist = Math.max(halfH / t, 2.6 / (t * v.aspect));
    v.camera.position.set(0, dist * 0.12, dist); v.camera.lookAt(0, 0, 0);
  }

  window.OVRA = { COLORWAYS, createShoe, makeScene, makeRenderer, makeView, frame };
})();
