(function () {
  'use strict';
  const L = window.CrystallographicLattice;
  const $ = id => document.getElementById(id);
  const canvas = $('lattice-canvas');
  if (!L || !canvas) return;
  const ctx = canvas.getContext('2d');
  const state = { n: 5, choice: 'auto', progress: 1, playing: false, camera: { yaw: -.52, pitch: .48, zoom: 1 }, view: 'perspective' };
  const colors = { ink: '#17384b', teal: '#217b78', orange: '#b16a23', original: '#889eab', moving: '#3262a6' };
  let frame = 0, lastTime = 0, drag = null, points = [], analysis = null;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const kind = () => state.choice === 'auto' ? L.recommendedKind(state.n) : state.choice;
  const angle = () => 2 * Math.PI / state.n;
  const pretty = x => Math.abs(x - Math.round(x)) < 1e-8 ? String(Math.round(x)) : x.toFixed(3);

  function stop() { state.playing = false; cancelAnimationFrame(frame); frame = 0; lastTime = 0; }
  function refresh() {
    stop();
    const type = kind();
    points = L.samplePoints(type);
    const matrix = L.rotationInBasis(type, state.n);
    const matches = points.filter(p => L.isLatticePoint(type, L.rotate(p.position, angle()))).length;
    analysis = { allowed: L.isAllowedOrder(state.n), supported: L.supportsRotation(type, state.n), trace: L.traceForOrder(state.n), matrix, matches };
    document.querySelectorAll('[data-lattice-n]').forEach(button => {
      const n = Number(button.dataset.latticeN);
      button.classList.toggle('allowed', L.isAllowedOrder(n));
      button.classList.toggle('forbidden', !L.isAllowedOrder(n));
      button.setAttribute('aria-pressed', String(n === state.n));
    });
    $('lattice-kind-label').textContent = type === 'square' ? '方格层 · 三维重复' : '三角网格层 · 三维重复';
    $('lattice-scene-title').textContent = state.n + ' 重旋转 · 绕 z 轴 ' + pretty(360 / state.n) + '°';
    $('lattice-theory').classList.toggle('negative', !analysis.allowed);
    $('lattice-theory-title').textContent = analysis.allowed ? state.n + ' 重：周期晶格允许' : state.n + ' 重：周期晶格不允许';
    $('lattice-theory-note').textContent = analysis.allowed ? '可以存在具有这种旋转的三维周期晶格；是否适合当前点阵，还要看下面的基矢检验。' : state.n === 5 ? '五重旋转的迹不是整数，因此任何三维周期晶格都不能保持这种旋转。' : '当 n ≥ 7，迹严格处于 2 与 3 之间，没有整数可取；7、8、9 及更高折数都被排除。';
    $('lattice-trace-value').textContent = pretty(analysis.trace);
    $('lattice-example').classList.toggle('negative', !analysis.supported);
    $('lattice-example-title').textContent = analysis.supported ? '终态：所有格点重合' : '终态：有格点错位';
    $('lattice-example-note').textContent = analysis.supported ? '旋转后的三根基矢都能用整数步平移表示。显示的 ' + points.length + ' 个点全部落回格点。' : '显示的 ' + points.length + ' 个点中，' + (points.length - matches) + ' 个终点不在原晶格上。' + (analysis.allowed ? '这只是当前示例绕 z 轴不支持；切换“自动选择合适示例”试试。' : '轴上的点仍不动，不能据此说整个晶格保持对称。');
    $('lattice-basis-coordinates').textContent = 'a′ = ' + pretty(matrix[0][0]) + ' a + ' + pretty(matrix[1][0]) + ' b + ' + pretty(matrix[2][0]) + ' c';
    $('lattice-basis-note').textContent = analysis.supported ? '整数步能到达原晶格中的位置。' : '有非整数步：旋转后的基矢落在格点之间。';
    update();
  }
  function update() {
    const ended = state.progress >= 1 - 1e-9;
    $('lattice-play').textContent = state.playing ? '暂停旋转' : ended ? '重播旋转' : '播放旋转';
    $('lattice-progress').value = Math.round(state.progress * 1000);
    $('lattice-progress-label').textContent = Math.round(state.progress * 100) + '%';
    $('lattice-phase').textContent = ended ? '旋转后的终态' : state.progress === 0 ? '旋转前的起点' : '中间角度 · 暂不判定';
    document.querySelectorAll('[data-lattice-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.latticeView === state.view)));
    draw();
  }
  function play() {
    if (state.playing) { stop(); update(); return; }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { state.progress = 1; update(); return; }
    if (state.progress >= 1) state.progress = 0;
    state.playing = true; lastTime = 0;
    function tick(time) {
      if (!state.playing) return;
      if (lastTime) state.progress = Math.min(1, state.progress + Math.min(time - lastTime, 80) / 2400);
      lastTime = time;
      if (state.progress >= 1) stop();
      update();
      if (state.playing) frame = requestAnimationFrame(tick);
    }
    update(); frame = requestAnimationFrame(tick);
  }
  function draw() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h || !ctx || !analysis) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(w * ratio) || canvas.height !== Math.round(h * ratio)) { canvas.width = Math.round(w * ratio); canvas.height = Math.round(h * ratio); }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, w, h);
    const cam = state.camera, scale = Math.min(w / 6.2, h / (state.view === 'top' ? 6.2 : 5.1)) * cam.zoom;
    const project = p => {
      const x = Math.cos(cam.yaw) * p[0] - Math.sin(cam.yaw) * p[1];
      const y = Math.sin(cam.yaw) * p[0] + Math.cos(cam.yaw) * p[1];
      return { x: w * .52 + x * scale, y: h * .55 - (Math.cos(cam.pitch) * p[2] + Math.sin(cam.pitch) * y) * scale, depth: -Math.cos(cam.pitch) * y + Math.sin(cam.pitch) * p[2] };
    };
    const line = (a, b, color, width = 1, dashed = false) => {
      const p = project(a), q = project(b); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dashed ? [4, 4] : []); ctx.stroke(); ctx.setLineDash([]);
    };
    const arrow = (p, color, label) => {
      const a = project([0, 0, 0]), b = project(p);
      if (Math.hypot(b.x - a.x, b.y - a.y) < 2) { ctx.fillStyle = color; ctx.font = '600 12px system-ui'; ctx.fillText(label + ' ⊙', b.x + 8, b.y - 6); return; }
      line([0, 0, 0], p, color, 2);
      const phi = Math.atan2(b.y - a.y, b.x - a.x); ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - 7 * Math.cos(phi - .45), b.y - 7 * Math.sin(phi - .45)); ctx.lineTo(b.x - 7 * Math.cos(phi + .45), b.y - 7 * Math.sin(phi + .45)); ctx.closePath(); ctx.fillStyle = color; ctx.fill(); ctx.font = '600 12px system-ui'; ctx.fillText(label, b.x + 8, b.y - 6);
    };
    // All three layers repeat along c. Grid lines show complete nearest-neighbour directions.
    const directions = kind() === 'square' ? [[1, 0, 0], [0, 1, 0]] : [[1, 0, 0], [0, 1, 0], [-1, 1, 0]];
    const keys = new Map(points.map(p => [p.indices.join(','), p]));
    points.forEach(p => {
      directions.concat([[0, 0, 1]]).forEach(d => {
        const neighbour = keys.get(p.indices.map((v, i) => v + d[i]).join(','));
        if (neighbour) line(p.position, neighbour.position, '#b7cbd34c', .7);
      });
    });
    line([0, 0, -1.4], [0, 0, 1.8], '#217b7880', 1.3, true);
    const axisTip = project([0, 0, 1.9]); ctx.fillStyle = colors.teal; ctx.font = '11px system-ui';
    if (state.view === 'top') {
      ctx.textAlign = 'right';
      ctx.fillText(window.SymmetryI18n ? window.SymmetryI18n.t('沿 z 轴看 · c 垂直屏幕 ⊙') : '沿 z 轴看 · c 垂直屏幕 ⊙', w - 18, 68);
      ctx.textAlign = 'start';
    } else ctx.fillText(window.SymmetryI18n ? window.SymmetryI18n.t('z · 旋转轴') : 'z · 旋转轴', axisTip.x + 8, axisTip.y);
    const theta = angle() * state.progress, ended = state.progress >= 1 - 1e-9;
    const dots = [];
    points.forEach(p => {
      dots.push({ p: p.position, original: true, color: colors.original });
      const q = L.rotate(p.position, theta);
      dots.push({ p: q, original: false, color: ended ? L.isLatticePoint(kind(), q) ? colors.teal : colors.orange : colors.moving });
    });
    dots.sort((a, b) => project(a.p).depth - project(b.p).depth || Number(b.original) - Number(a.original));
    dots.forEach(dot => {
      const p = project(dot.p); ctx.beginPath(); ctx.arc(p.x, p.y, dot.original ? 5.3 : 3.8, 0, Math.PI * 2);
      if (dot.original) { ctx.strokeStyle = '#889eab9c'; ctx.lineWidth = 1.1; ctx.stroke(); }
      else { ctx.fillStyle = dot.color; ctx.fill(); }
    });
    const basis = L.basis(kind()), movedBasis = L.rotate(basis[0], theta);
    const sameBasis = basis.findIndex(v => Math.hypot(...v.map((value, i) => value - movedBasis[i])) < 1e-8);
    basis.forEach((v, i) => { if (i === 2 && state.view === 'top') return; arrow(v, '#637b9a', ['a', 'b', 'c'][i] + (i === sameBasis ? ' = a′' : '')); });
    // a′ is a representative translated point; testing the whole basis determines the lattice symmetry.
    if (sameBasis < 0) arrow(movedBasis, ended && !analysis.supported ? colors.orange : colors.teal, 'a′');
    const arcSteps = Math.max(6, Math.round(theta / .08));
    for (let i = 1; i <= arcSteps; i++) { const t0 = theta * (i - 1) / arcSteps, t1 = theta * i / arcSteps; line([Math.cos(t0), Math.sin(t0), 0], [Math.cos(t1), Math.sin(t1), 0], '#b16a2380', 1, true); }
    const origin = project([0, 0, 0]); ctx.fillStyle = colors.ink; ctx.font = '10px system-ui'; ctx.fillText('O', origin.x - 13, origin.y + 14);
  }

  document.querySelectorAll('[data-lattice-n]').forEach(button => button.addEventListener('click', () => { state.n = Number(button.dataset.latticeN); state.progress = 1; refresh(); }));
  $('lattice-jump').addEventListener('click', () => $('why-rotation').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }));
  $('lattice-kind').addEventListener('change', e => { state.choice = e.target.value; state.progress = 1; refresh(); });
  $('lattice-play').addEventListener('click', play);
  $('lattice-end').addEventListener('click', () => { stop(); state.progress = 1; update(); });
  $('lattice-reset').addEventListener('click', () => { stop(); state.progress = 0; update(); });
  $('lattice-progress').addEventListener('input', e => { stop(); state.progress = Number(e.target.value) / 1000; update(); });
  document.querySelectorAll('[data-lattice-view]').forEach(button => button.addEventListener('click', () => {
    state.view = button.dataset.latticeView === 'top' ? 'top' : 'perspective';
    Object.assign(state.camera, state.view === 'top' ? { yaw: 0, pitch: Math.PI / 2, zoom: 1 } : { yaw: -.52, pitch: .48, zoom: 1 }); update();
  }));
  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => { if (!drag) return; state.camera.yaw += (e.clientX - drag.x) * .007; state.camera.pitch = clamp(state.camera.pitch + (e.clientY - drag.y) * .007, -1.5, 1.5); drag = { x: e.clientX, y: e.clientY }; state.view = 'free'; update(); });
  canvas.addEventListener('pointerup', () => { drag = null; }); canvas.addEventListener('pointercancel', () => { drag = null; });
  canvas.addEventListener('wheel', e => { e.preventDefault(); state.camera.zoom = clamp(state.camera.zoom * Math.exp(-e.deltaY * .001), .65, 1.6); draw(); }, { passive: false });
  canvas.addEventListener('keydown', e => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-'].includes(e.key)) {
      e.preventDefault(); if (e.key === 'ArrowLeft') state.camera.yaw -= .12; if (e.key === 'ArrowRight') state.camera.yaw += .12;
      if (e.key === 'ArrowUp') state.camera.pitch = clamp(state.camera.pitch + .12, -1.5, 1.5); if (e.key === 'ArrowDown') state.camera.pitch = clamp(state.camera.pitch - .12, -1.5, 1.5);
      if (e.key === '+' || e.key === '=') state.camera.zoom = clamp(state.camera.zoom * 1.1, .65, 1.6); if (e.key === '-') state.camera.zoom = clamp(state.camera.zoom / 1.1, .65, 1.6); state.view = 'free'; update();
    } else if (e.key === ' ') { e.preventDefault(); play(); }
  });
  new ResizeObserver(() => requestAnimationFrame(draw)).observe(canvas);
  document.addEventListener('symmetry-language-change', draw);
  new MutationObserver(() => { if ($('page-atlas').hidden) { stop(); update(); } else draw(); }).observe($('page-atlas'), { attributes: true, attributeFilter: ['hidden'] });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { stop(); update(); } });
  refresh();
})();
