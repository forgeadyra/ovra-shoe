(function () {
  const { COLORWAYS, createShoe, makeScene, makeRenderer, makeView, frame } = window.OVRA;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);

  const HERO_CW = ['cobalt', 'glacier', 'basalt', 'sundial', 'moss'];
  const SIZES = [
    { eu: 39, uk: '6', us: '6.5', cm: '24.5' }, { eu: 40, uk: '6.5', us: '7', cm: '25' }, { eu: 41, uk: '7.5', us: '8', cm: '26' },
    { eu: 42, uk: '8', us: '8.5', cm: '26.5' }, { eu: 43, uk: '9', us: '9.5', cm: '27.5' }, { eu: 44, uk: '9.5', us: '10', cm: '28' },
    { eu: 45, uk: '10.5', us: '11', cm: '29' }, { eu: 46, uk: '11', us: '11.5', cm: '29.5', out: true }
  ];
  const MODELS = [
    { id: 'vela2', name: 'Vela 2', price: 160, cw: 'cobalt', ry: -0.55, use: 'Daily miles, easy days, long runs', specs: ['248 g', '8 mm', '38/30'], status: 'In stock' },
    { id: 'velapro', name: 'Vela Pro', price: 240, cw: 'sundial', ry: -0.75, use: 'Race day, tempo, carbon plate', specs: ['196 g', '6 mm', '40/34'], status: 'Ships 14 Oct', warn: true },
    { id: 'velatrail', name: 'Vela Trail', price: 175, cw: 'moss', ry: -0.45, use: 'Gravel, fire roads, 4.5 mm lugs', specs: ['290 g', '5 mm', '32/27'], status: 'In stock' }
  ];
  const eur = n => '€' + n.toLocaleString('en-IE');

  /* ---------- still renders for cards + bag (one offscreen renderer) ---------- */
  const snap = (() => {
    const c = document.createElement('canvas'); c.width = 720; c.height = 480;
    let r, scene, shoe, cam; const cache = {};
    return (cwKey, ry) => {
      const key = cwKey + ry;
      if (cache[key]) return cache[key];
      if (!r) {
        r = makeRenderer(c, { preserveDrawingBuffer: true });
        scene = makeScene(); shoe = createShoe(); scene.add(shoe.root);
        cam = new THREE.PerspectiveCamera(30, 1.5, 0.1, 50); frame({ camera: cam, aspect: 1.5 }, 1.4);
      }
      shoe.setColorway(COLORWAYS[cwKey]); shoe.shoe.rotation.set(0.18, ry, 0);
      r.render(scene, cam);
      return (cache[key] = c.toDataURL('image/png'));
    };
  })();

  /* ---------- 3D views ---------- */
  const hero = makeView($('#heroCanvas'));
  const story = makeView($('#storyCanvas'));

  let cwKey = 'cobalt';
  function applyCw(key) {
    cwKey = key;
    hero.shoe.setColorway(COLORWAYS[key]); story.shoe.setColorway(COLORWAYS[key]);
    $('#cwName').textContent = COLORWAYS[key].name;
    document.querySelectorAll('.sw').forEach(b => b.setAttribute('aria-pressed', b.dataset.key === key));
  }
  HERO_CW.forEach(k => {
    const c = COLORWAYS[k], b = document.createElement('button');
    b.type = 'button'; b.className = 'sw'; b.dataset.key = k; b.title = c.name; b.setAttribute('aria-label', c.name);
    b.style.background = `linear-gradient(180deg, ${c.upper} 0 58%, ${c.mid} 58% 82%, ${c.out} 82%)`;
    b.addEventListener('click', () => applyCw(k));
    $('#swatches').appendChild(b);
  });
  applyCw('cobalt');

  /* ---------- sizes + table ---------- */
  let size = null;
  const sizesEl = $('#sizes'), msg = $('#sizeMsg');
  SIZES.forEach(s => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'size'; b.textContent = s.eu; b.setAttribute('aria-pressed', 'false');
    if (s.out) { b.disabled = true; b.title = 'Sold out'; b.setAttribute('aria-label', 'EU ' + s.eu + ', sold out'); }
    b.addEventListener('click', () => {
      size = s.eu; msg.textContent = '';
      sizesEl.querySelectorAll('.size').forEach(x => x.setAttribute('aria-pressed', x === b));
      markTable();
    });
    sizesEl.appendChild(b);
  });
  const rows = document.querySelectorAll('#sizeTable tr');
  SIZES.forEach(s => [s.eu, s.uk, s.us, s.cm].forEach((v, i) => {
    const td = document.createElement('td'); td.textContent = v; td.dataset.eu = s.eu; rows[i].appendChild(td);
  }));
  function markTable() { document.querySelectorAll('#sizeTable td').forEach(td => td.classList.toggle('sel', +td.dataset.eu === size)); }

  /* ---------- bag ---------- */
  const FREE_SHIP = 150;
  let bag = [];
  try { bag = JSON.parse(localStorage.getItem('ovra-bag')) || []; } catch (e) { bag = []; }
  const save = () => { try { localStorage.setItem('ovra-bag', JSON.stringify(bag)); } catch (e) { } };
  const drawer = $('#drawer'), scrim = $('#scrim'), bagBtn = $('#bagBtn');

  function addToBag(model, cw, eu) {
    const id = `${model.id}-${cw}-${eu}`, line = bag.find(l => l.id === id);
    if (line) line.qty++;
    else bag.push({ id, model: model.id, name: model.name, cw, size: eu, price: model.price, ry: model.ry, qty: 1 });
    save(); renderBag();
    const cnt = $('#bagCount'); cnt.classList.remove('bump'); void cnt.offsetWidth; cnt.classList.add('bump');
    toast(`Added ${model.name} · ${COLORWAYS[cw].name} · EU ${eu}`);
  }
  function renderBag() {
    const n = bag.reduce((a, l) => a + l.qty, 0), sub = bag.reduce((a, l) => a + l.qty * l.price, 0);
    $('#bagCount').textContent = n;
    $('#subtotal').textContent = eur(sub);
    $('#empty').hidden = n > 0;
    $('#checkout').disabled = n === 0;
    const left = FREE_SHIP - sub;
    $('#shipMsg').textContent = left > 0 ? `${eur(left)} away from free shipping` : 'Free shipping unlocked';
    $('#shipFill').style.width = Math.min(100, sub / FREE_SHIP * 100) + '%';
    const ul = $('#lines'); ul.innerHTML = '';
    bag.forEach(l => {
      const li = document.createElement('li'); li.className = 'line';
      li.innerHTML = `<div class="sw-big"><img alt=""></div>
        <div><b></b><small></small>
          <div class="qty"><button type="button" data-d="-1"></button><span></span><button type="button" data-d="1" aria-label="Add one">+</button></div>
        </div>
        <span class="lp"></span>`;
      li.querySelector('img').src = snap(l.cw, l.ry);
      li.querySelector('b').textContent = l.name;
      li.querySelector('small').textContent = `${COLORWAYS[l.cw].name} · EU ${l.size}`;
      li.querySelector('.qty span').textContent = l.qty;
      const minus = li.querySelector('[data-d="-1"]');
      minus.textContent = l.qty > 1 ? '−' : '✕';
      minus.setAttribute('aria-label', l.qty > 1 ? 'Remove one' : 'Remove from bag');
      li.querySelector('.lp').textContent = eur(l.price * l.qty);
      li.querySelectorAll('.qty button').forEach(btn => btn.addEventListener('click', () => {
        l.qty += +btn.dataset.d;
        if (l.qty <= 0) bag = bag.filter(x => x !== l);
        save(); renderBag();
      }));
      ul.appendChild(li);
    });
  }
  function openBag(open) {
    drawer.classList.toggle('open', open);
    drawer.setAttribute('aria-hidden', !open);
    bagBtn.setAttribute('aria-expanded', open);
    document.body.classList.toggle('locked', open);
    if (open) { scrim.hidden = false; requestAnimationFrame(() => scrim.classList.add('show')); $('#closeBag').focus(); }
    else { scrim.classList.remove('show'); setTimeout(() => { if (!drawer.classList.contains('open')) scrim.hidden = true; }, 250); bagBtn.focus(); }
  }
  bagBtn.addEventListener('click', () => openBag(true));
  $('#closeBag').addEventListener('click', () => openBag(false));
  scrim.addEventListener('click', () => openBag(false));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && drawer.classList.contains('open')) openBag(false); });
  $('#checkout').addEventListener('click', () => toast('Checkout isn’t part of this concept storefront'));

  $('#addBtn').addEventListener('click', () => {
    if (!size) { msg.textContent = 'Pick a size first.'; sizesEl.querySelector('.size:not(:disabled)').focus(); return; }
    addToBag(MODELS[0], cwKey, size);
  });

  let tt;
  function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => el.classList.remove('show'), 2600); }

  /* ---------- lineup ---------- */
  MODELS.forEach(m => {
    const a = document.createElement('article'); a.className = 'card';
    a.innerHTML = `<div class="thumb"><img alt=""></div>
      <div class="card-top"><h3></h3><span class="p"></span></div>
      <p class="use"></p>
      <dl class="specs"><div><dt>Weight</dt><dd></dd></div><div><dt>Drop</dt><dd></dd></div><div><dt>Stack</dt><dd></dd></div></dl>
      <div class="card-foot"><span class="status"></span><button class="ghost-btn" type="button"></button></div>`;
    a.querySelector('img').src = snap(m.cw, m.ry);
    a.querySelector('img').alt = `${m.name} in ${COLORWAYS[m.cw].name}`;
    a.querySelector('h3').textContent = m.name;
    a.querySelector('.p').textContent = eur(m.price);
    a.querySelector('.use').textContent = m.use;
    a.querySelectorAll('dd').forEach((dd, i) => { dd.textContent = m.specs[i]; });
    const st = a.querySelector('.status'); st.textContent = m.status; if (m.warn) st.style.setProperty('--dot', 'var(--warn)');
    const btn = a.querySelector('button');
    btn.textContent = size ? `Add · EU ${size}` : 'Add to bag';
    btn.addEventListener('click', () => {
      if (!size) { toast('Pick your size up top first'); $('#top').scrollIntoView(); setTimeout(() => sizesEl.querySelector('.size:not(:disabled)').focus({ preventScroll: true }), 500); return; }
      addToBag(m, m.cw, size);
    });
    m.btn = btn;
    $('#cards').appendChild(a);
  });
  sizesEl.addEventListener('click', () => MODELS.forEach(m => { m.btn.textContent = size ? `Add · EU ${size}` : 'Add to bag'; }));
  renderBag();

  /* ---------- hero: drag to turn ---------- */
  const hc = hero.renderer.domElement;
  let rotY = -0.65, rotX = 0.2, vel = 0, drag = false, lx = 0, ly = 0;
  hc.addEventListener('pointerdown', e => { drag = true; lx = e.clientX; ly = e.clientY; vel = 0; hc.setPointerCapture(e.pointerId); });
  hc.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY;
    vel = dx * 0.008; rotY += vel; rotX = Math.max(-0.7, Math.min(0.9, rotX + dy * 0.005));
  });
  ['pointerup', 'pointercancel'].forEach(t => hc.addEventListener(t, () => { drag = false; }));
  hc.addEventListener('keydown', e => {
    const k = { ArrowLeft: [-0.25, 0], ArrowRight: [0.25, 0], ArrowUp: [0, -0.15], ArrowDown: [0, 0.15] }[e.key];
    if (!k) return;
    rotY += k[0]; rotX = Math.max(-0.7, Math.min(0.9, rotX + k[1])); e.preventDefault();
  });

  /* ---------- anatomy story ---------- */
  const STEPS = [
    { label: 'Assembled', ry: -0.6, rx: 0.2, spread: 0, hi: null },
    { label: 'Layer 1 · Upper', ry: -0.95, rx: 0.5, spread: 1, hi: 'upper' },
    { label: 'Layer 2 · Midsole', ry: -0.08, rx: 0.1, spread: 1, hi: 'mid' },
    { label: 'Layer 3 · Outsole', ry: -0.5, rx: -1.05, spread: 1, hi: 'out' }
  ];
  let step = 0;
  const sc = { ry: STEPS[0].ry, rx: STEPS[0].rx, spread: 0, glow: { upper: 0, mid: 0, out: 0 } };
  const stepEls = document.querySelectorAll('.step'), pips = document.querySelectorAll('.pips li');
  function setStep(i) {
    step = i;
    stepEls.forEach(s => s.classList.toggle('on', +s.dataset.step === i));
    pips.forEach((p, j) => p.classList.toggle('on', j <= i));
    $('#stageLabel').innerHTML = '<b>' + STEPS[i].label + '</b>';
  }
  const stepIO = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) setStep(+e.target.dataset.step); }),
    { rootMargin: '-45% 0px -45% 0px' });
  stepEls.forEach(el => stepIO.observe(el));
  setStep(0);
  const GLOW = new THREE.Color('#4f6bff');
  Object.values(story.shoe.mats).forEach(m => { m.emissive.copy(GLOW); m.emissiveIntensity = 0; });
  const GROUP_MATS = { upper: ['upper', 'trim', 'lace', 'collar'], mid: ['mid'], out: ['out'] };

  /* ---------- loop ---------- */
  const clock = new THREE.Clock();
  const lerp = (a, b, k) => a + (b - a) * k;
  function tick() {
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    if (hero.visible) {
      if (!drag) { rotY += vel; vel *= 0.94; if (!reduce && Math.abs(vel) < 0.002) rotY += 0.25 * dt; }
      const s = hero.shoe;
      s.shoe.rotation.set(rotX, rotY, 0);
      s.shoe.position.y = -0.72 + (reduce ? 0 : Math.sin(t * 1.4) * 0.04);
      s.shadow.scale.setScalar(reduce ? 1 : 1 - Math.sin(t * 1.4) * 0.04);
      frame(hero, 1.55); hero.renderer.render(hero.scene, hero.camera);
    }
    if (story.visible) {
      const tg = STEPS[step], k = reduce ? 1 : 1 - Math.pow(0.0025, dt);
      sc.ry = lerp(sc.ry, tg.ry, k); sc.rx = lerp(sc.rx, tg.rx, k); sc.spread = lerp(sc.spread, tg.spread, k);
      const s = story.shoe;
      s.shoe.rotation.set(sc.rx, sc.ry, 0);
      s.parts.upper.position.y = sc.spread * 0.62; s.parts.out.position.y = -sc.spread * 0.42;
      s.shadow.material.opacity = 1 - sc.spread * 0.6;
      Object.keys(GROUP_MATS).forEach(p => {
        sc.glow[p] = lerp(sc.glow[p], tg.hi === p ? 1 : 0, k);
        const g = sc.glow[p] * (0.2 + (reduce ? 0 : 0.08 * Math.sin(t * 3)));
        GROUP_MATS[p].forEach(m => { s.mats[m].emissiveIntensity = g; });
      });
      frame(story, 1.55 + sc.spread * 0.6); story.renderer.render(story.scene, story.camera);
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
