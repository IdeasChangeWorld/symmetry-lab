(function () {
  'use strict';
  const M = window.SymmetryMath;
  const L = window.SymmetryLearning;
  if (!M || !L) { document.body.textContent = '未能载入项目文件。请将 index.html、styles.css、math.js、learning-data.js 和 app.js 保存在同一文件夹后重新打开。'; return; }
  const $ = id => document.getElementById(id);
  const axisVectors = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1], diagonal: [1, 1, 1] };
  const planeNormals = { xy: [0, 0, 1], xz: [0, 1, 0], yz: [1, 0, 0], diagonal: [1, -1, 0] };
  const typeNames = { E: '恒等', rotation: '旋转', reflection: '镜映', inversion: '反演', rotoinversion: '旋转反演', improper: '旋转镜映' };
  const hmByModel = { water: 'mm2', ammonia: '3m', xef4: '4/mmm', methane: '-43m', sf6: 'm-3m', hexagon: '6/mmm', asymmetric: '1' };
  const scenes = [];
  const state = {
    model: M.models[0], type: 'rotation', n: 2, axis: 'z', plane: 'xz', op: null,
    progress: 0, base: M.identityMatrix(), selected: 1, completed: 0, playing: false,
    speed: 1, ghost: true, labels: true, path: true, orbit: false,
    camera: { yaw: -0.48, pitch: 0.43, zoom: 1 }, page: 'lab', quizIndex: 0,
    answers: Array(L.quiz.length).fill(null), atlas: 'mm2', composeA: null, composeB: null
  };
  let lastFrame = 0, animationFrame = 0, toastTimer = 0;
  const format = (n, places = 2) => (Math.abs(n) < Math.pow(10, -places) / 2 ? 0 : n).toFixed(places);
  const coords = p => '(' + p.map(v => format(v)).join(', ') + ')';
  const escapeHTML = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hmHTML = s => escapeHTML(s).replace(/-(\d)/g, '<span class="overbar">$1</span>');
  const sfHTML = s => { const clean = String(s).replace(/[₁₂₃₄₅₆]/g, x => '₁₂₃₄₅₆'.indexOf(x) + 1).replace(/_/g, ''); return escapeHTML(clean[0]) + (clean.length > 1 ? '<sub>' + escapeHTML(clean.slice(1)) + '</sub>' : ''); };
  const matrixHTML = matrix => matrix.flat().map(v => '<span>' + format(v) + '</span>').join('');
  const finalMatrix = () => M.multiplyMatrices(state.op.matrix, state.base);
  const currentMatrix = () => M.multiplyMatrices(state.op.animate(state.progress), state.base);

  function toast(message) { $('toast').textContent = message; $('toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 5500); }
  function selectPage(page, updateHash = true) {
    if (!['lab', 'atlas', 'group', 'quiz'].includes(page)) page = 'lab';
    if (page !== 'lab') stop();
    state.page = page;
    document.querySelectorAll('.page').forEach(el => { el.hidden = el.id !== 'page-' + page; el.classList.toggle('active', !el.hidden); });
    document.querySelectorAll('.nav-item').forEach(el => { const active = el.dataset.page === page; el.classList.toggle('active', active); if (active) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current'); });
    if (updateHash && location.hash !== '#' + page) history.replaceState(null, '', '#' + page);
    updateDynamic();
  }

  function makeOp() { state.op = M.makeOperation({ type: state.type, n: state.n, axis: axisVectors[state.axis], normal: planeNormals[state.plane] }); }
  function opDisplayName() {
    if (state.type === 'rotation') return state.n + ' 重旋转 · C' + state.n;
    if (state.type === 'rotoinversion') return state.n + '\u0305 · 旋转反演';
    if (state.type === 'improper') return 'S' + state.n + ' · 旋转镜映';
    return typeNames[state.type];
  }
  function updateConfig() {
    stop(); state.base = M.identityMatrix(); state.completed = 0; state.progress = 0;
    makeOp(); updateStatic(); updateDynamic();
  }
  function setModel(id, recommendation = true) {
    state.model = M.models.find(m => m.id === id) || M.models[0];
    if (recommendation) {
      const rec = state.model.recommended;
      state.type = rec.type; state.n = rec.n || 2;
      state.axis = Object.keys(axisVectors).find(k => M.distance(M.normalize(axisVectors[k]), M.normalize(rec.axis || [0, 0, 1])) < 1e-6) || 'z';
      state.plane = 'xz';
    }
    state.selected = state.model.atoms.length > 1 ? 1 : 0;
    $('model-select').value = state.model.id;
    $('atom-select').innerHTML = state.model.atoms.map((a, i) => '<option value="' + i + '">' + escapeHTML(a.id) + ' · ' + escapeHTML(a.element) + '</option>').join('');
    $('atom-select').value = state.selected;
    updateConfig();
  }

  function updateStatic() {
    $('n-select').value = state.n; $('axis-select').value = state.axis; $('plane-select').value = state.plane;
    document.querySelectorAll('.op-button').forEach(el => { const selected = el.dataset.type === state.type; el.classList.toggle('selected', selected); el.setAttribute('aria-pressed', selected); });
    const rotating = ['rotation', 'rotoinversion', 'improper'].includes(state.type);
    $('n-row').hidden = !rotating; $('axis-row').hidden = !rotating; $('plane-row').hidden = state.type !== 'reflection';
    $('restriction').hidden = !(rotating && state.n === 5);
    $('model-group').innerHTML = hmByModel[state.model.id] ? '点群 ' + hmHTML(hmByModel[state.model.id]) + ' / ' + sfHTML(state.model.pointGroup) : '一般位置 · 示踪模型';
    $('model-description').textContent = state.model.description;
    $('scene-title').textContent = state.model.name + ' · ' + opDisplayName();
    const axisName = state.axis === 'diagonal' ? '[111] 体对角线' : state.axis + ' 轴';
    const explanation = {
      E: ['所有点保持原位。这是任何点群都包含的操作。', 'p′ = p'],
      rotation: ['围绕 ' + axisName + ' 按右手规则旋转 ' + format(360 / state.n, 0) + '°。轴上的点保持不动。', 'θ = 360° / ' + state.n],
      reflection: ['关于 ' + (state.plane === 'diagonal' ? 'x = y 对角面' : state.plane + ' 平面') + ' 映到另一侧的等距位置。镜面上的点不动。', state.plane === 'xy' ? '(x, y, z) → (x, y, −z)' : state.plane === 'yz' ? '(x, y, z) → (−x, y, z)' : state.plane === 'xz' ? '(x, y, z) → (x, −y, z)' : '(x, y, z) → (y, x, z)'],
      inversion: ['以原点 O 为中心，把每个点送到相反方向的等距位置。三个坐标全部变号。', '(x, y, z) → (−x, −y, −z)'],
      rotoinversion: ['先绕 ' + axisName + ' 旋转 ' + format(360 / state.n, 0) + '°，再通过原点反演。组合成立，不要求两步单独都是该结构的对称操作。', 'M = (−I) R · 先 R 后 i'],
      improper: ['先绕 ' + axisName + ' 旋转 ' + format(360 / state.n, 0) + '°，再关于垂直于该轴、过原点的镜面反射。', 'M = σ⊥ R · 先 R 后 σ⊥']
    }[state.type];
    $('op-explanation').textContent = explanation[0]; $('op-formula').textContent = explanation[1];
    const composite = state.op.stageNames.length === 2;
    const stages = composite ? [[0, '起始'], [.5, '① 旋转结束'], [1, '② ' + (state.type === 'rotoinversion' ? '反演结束' : '镜映结束')]] : [[0, '起始'], [1, typeNames[state.type] + '结束']];
    $('stage-track').innerHTML = stages.map(([t, name]) => '<button data-progress="' + t + '">' + name + '</button>').join('');
    $('animation-note').textContent = ['reflection', 'inversion', 'improper', 'rotoinversion'].includes(state.type) ? '镜映与反演的中间形变仅为过程示意，不是刚体运动；只有完整操作的终态用于检验对称性。' : '终态决定是否对称；中间角度不必属于该结构的对称操作。';
    $('matrix-display').innerHTML = matrixHTML(state.op.matrix);
    const determinant = Math.round(M.determinant(state.op.matrix));
    $('matrix-summary').textContent = 'det M = ' + (determinant > 0 ? '+1 · 保手性' : '−1 · 反转手性');
    $('matrix-note').textContent = '此处显示一次完整操作的矩阵；det M = ' + determinant + '。反转手性描述空间变换，原结构是否手性还取决于它的完整对称群。';
    const order = M.operationOrder(state.op.matrix);
    $('order-note').textContent = '这个操作的阶为 ' + order + '：重复作用 ' + order + ' 次得到 E。操作的阶、n 和完整点群的阶是不同概念。';
  }

  function updateDynamic() {
    $('progress').value = Math.round(state.progress * 1000); $('progress-label').textContent = Math.round(state.progress * 100) + '%';
    const phase = state.op.phase(state.progress);
    $('phase-pill').textContent = state.progress === 0 ? '起始状态' : state.progress === 1 ? '操作完成' : state.op.stageNames.length === 2 && state.progress === .5 ? '旋转结束 · 中间态' : phase.name + '中';
    $('phase-pill').classList.toggle('end', state.progress === 1);
    $('repeat-button').disabled = state.progress !== 1 || state.playing;
    $('step-button').disabled = state.progress === 1;
    $('play-text').textContent = state.playing ? '暂停' : state.progress === 1 ? '重播操作' : '播放操作'; $('play-icon').textContent = state.playing ? 'Ⅱ' : '▶';
    document.querySelectorAll('#stage-track button').forEach(el => el.classList.toggle('active', Math.abs(Number(el.dataset.progress) - state.progress) < .002));
    const total = finalMatrix(); const result = M.matchModel(state.model, total);
    $('symmetry-card').classList.toggle('negative', !result.isSymmetry);
    if (state.model.id === 'probe') {
      $('symmetry-result').textContent = result.isSymmetry ? '示踪点回到原位' : '示踪点移动到新位置';
      $('symmetry-detail').textContent = '此模型用于观察坐标映射，不据此判定分子或晶体的完整点群。';
    } else {
      $('symmetry-result').textContent = result.isSymmetry ? '✓ 终态与原结构重合' : '↗ 终态不能重合';
      $('symmetry-detail').textContent = result.isSymmetry ? '所有同类型点及键关系都可匹配。' + (state.completed ? '这是一共 ' + (state.completed + 1) + ' 次重复操作的累计结果。' : '所选完整操作是该模型的对称操作。') : (result.unmatched.length ? '有 ' + result.unmatched.length + ' 个点找不到原结构中的同类型位置。' : '位置虽能匹配，但连接关系不保持。') + (state.completed ? '这是重复操作的累计结果。' : '所选完整操作不是该模型的对称操作。');
    }
    $('atom-mapping').innerHTML = result.isSymmetry && state.model.id !== 'probe' ? result.mapping.map((target, source) => '<span>' + escapeHTML(state.model.atoms[source].id) + ' → ' + escapeHTML(state.model.atoms[target].id) + '</span>').join('') : '';
    const atom = state.model.atoms[state.selected];
    $('coord-before').textContent = coords(atom.position); $('coord-after').textContent = coords(M.applyMatrix(currentMatrix(), atom.position));
    $('coordinate-note').textContent = state.orbit ? '显示该点在重复操作下的轨道；它不等于完整点群。' : state.completed ? '示意坐标 · 已完成 ' + state.completed + ' 次，正在演示第 ' + (state.completed + 1) + ' 次' : '示意坐标 · 任意单位 · 编号仅用于追踪';
    renderAll();
  }

  function stop() { state.playing = false; cancelAnimationFrame(animationFrame); animationFrame = 0; lastFrame = 0; }
  function play() {
    if (state.playing) { stop(); updateDynamic(); return; }
    if (state.progress >= 1) state.progress = 0;
    state.playing = true; lastFrame = 0;
    const tick = time => {
      if (!state.playing) return;
      if (!lastFrame) lastFrame = time;
      const delta = Math.min(time - lastFrame, 60); lastFrame = time;
      const duration = state.op.stageNames.length === 2 ? 5200 : 3100;
      const previous = state.progress;
      state.progress = Math.min(1, state.progress + delta / duration * state.speed);
      // A short pause makes the two components of a composite visible separately.
      if (state.op.stageNames.length === 2 && previous < .5 && state.progress >= .5) {
        state.progress = .5; stop(); updateDynamic(); toast('第一步结束。此刻只是旋转；点击播放或下一步，继续第二步。'); return;
      }
      if (state.progress === 1) stop();
      updateDynamic();
      if (state.playing) animationFrame = requestAnimationFrame(tick);
    };
    updateDynamic(); animationFrame = requestAnimationFrame(tick);
  }

  class Scene {
    constructor(canvas, getData, main = false) {
      this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.getData = getData; this.main = main; this.hits = [];
      let drag = null;
      canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY }; canvas.setPointerCapture(e.pointerId); });
      canvas.addEventListener('pointermove', e => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; state.camera.yaw += dx * .007; state.camera.pitch = M.clamp(state.camera.pitch + dy * .007, -1.5, 1.5); drag.x = e.clientX; drag.y = e.clientY; markFreeCamera(); renderAll(); });
      canvas.addEventListener('pointerup', e => {
        if (drag && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 5 && main) {
          const rect = canvas.getBoundingClientRect(); const x = e.clientX - rect.left, y = e.clientY - rect.top;
          const hit = this.hits.slice().reverse().find(h => Math.hypot(x - h.x, y - h.y) <= h.r + 8);
          if (hit) { state.selected = hit.index; $('atom-select').value = hit.index; updateDynamic(); }
        }
        drag = null;
      });
      canvas.addEventListener('pointercancel', () => { drag = null; });
      canvas.addEventListener('wheel', e => { e.preventDefault(); state.camera.zoom = M.clamp(state.camera.zoom * Math.exp(-e.deltaY * .0015), .55, 1.8); renderAll(); }, { passive: false });
      canvas.addEventListener('keydown', e => {
        const key = e.key;
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-'].includes(key)) {
          e.preventDefault(); if (key === 'ArrowLeft') state.camera.yaw -= .12; if (key === 'ArrowRight') state.camera.yaw += .12;
          if (key === 'ArrowUp') state.camera.pitch = M.clamp(state.camera.pitch + .1, -1.5, 1.5); if (key === 'ArrowDown') state.camera.pitch = M.clamp(state.camera.pitch - .1, -1.5, 1.5);
          if (key === '+' || key === '=') state.camera.zoom = M.clamp(state.camera.zoom * 1.1, .55, 1.8); if (key === '-') state.camera.zoom = M.clamp(state.camera.zoom / 1.1, .55, 1.8);
          markFreeCamera(); renderAll();
        } else if (key === ' ' && main) { e.preventDefault(); play(); }
      });
      scenes.push(this);
    }
    draw() {
      const canvas = this.canvas; const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h || !this.ctx) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.round(w * ratio) || canvas.height !== Math.round(h * ratio)) { canvas.width = Math.round(w * ratio); canvas.height = Math.round(h * ratio); }
      const ctx = this.ctx; ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, w, h);
      const data = this.getData(); if (!data) return;
      const cam = state.camera; const scale = Math.min(w / 5.0, h / (this.main ? 4.0 : 4.6)) * cam.zoom;
      const cy = this.main ? h * .58 : h * .55, cx = this.main ? w * .55 : w * .5;
      const project = p => { const x = Math.cos(cam.yaw) * p[0] - Math.sin(cam.yaw) * p[1]; const y = Math.sin(cam.yaw) * p[0] + Math.cos(cam.yaw) * p[1]; return { x: cx + x * scale, y: cy - (Math.cos(cam.pitch) * p[2] + Math.sin(cam.pitch) * y) * scale, depth: -Math.cos(cam.pitch) * y + Math.sin(cam.pitch) * p[2] }; };
      const line = (points, color, width = 1, dash = []) => { if (!points.length) return; ctx.beginPath(); const start = project(points[0]); ctx.moveTo(start.x, start.y); points.slice(1).forEach(p => { const q = project(p); ctx.lineTo(q.x, q.y); }); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash); ctx.stroke(); ctx.setLineDash([]); };
      // Faint floor grid provides depth cues without changing the symmetry geometry.
      for (let v = -2; v <= 2.001; v += .5) { line([[v, -2, -1.35], [v, 2, -1.35]], '#d8e2e377', .7); line([[-2, v, -1.35], [2, v, -1.35]], '#d8e2e377', .7); }
      const plane = normal => {
        const n = M.normalize(normal); const u = M.normalize(M.cross(n, Math.abs(n[2]) < .9 ? [0, 0, 1] : [0, 1, 0])); const v = M.cross(n, u);
        const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => project(M.add(M.scale(u, a * 1.8), M.scale(v, b * 1.8))));
        ctx.beginPath(); corners.forEach((q, i) => { if (!i) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y); }); ctx.closePath(); ctx.fillStyle = '#d9a85d16'; ctx.fill(); ctx.strokeStyle = '#b68b4660'; ctx.lineWidth = .8; ctx.stroke();
      };
      const op = data.op;
      if (op && (op.type === 'reflection' || op.type === 'improper')) plane(op.type === 'improper' ? op.axis : op.normal);
      if (op && ['rotation', 'improper', 'rotoinversion'].includes(op.type)) {
        line([M.scale(op.axis, -2.05), M.scale(op.axis, 2.05)], '#087e8277', 1.4, [6, 5]);
        // The arc and arrow show positive rotation using the right-hand convention.
        const u = M.normalize(M.cross(op.axis, Math.abs(op.axis[2]) < .9 ? [0, 0, 1] : [0, 1, 0])); const v = M.cross(op.axis, u);
        const arc = Array.from({ length: 27 }, (_, i) => { const theta = i / 26 * Math.min(op.angle, Math.PI * 1.7); return M.add(M.scale(op.axis, 1.45), M.add(M.scale(u, .4 * Math.cos(theta)), M.scale(v, .4 * Math.sin(theta)))); });
        line(arc, '#087e82aa', 1.3); const a = project(arc[arc.length - 2]), b = project(arc[arc.length - 1]); const phi = Math.atan2(b.y - a.y, b.x - a.x);
        ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - 7 * Math.cos(phi - .45), b.y - 7 * Math.sin(phi - .45)); ctx.lineTo(b.x - 7 * Math.cos(phi + .45), b.y - 7 * Math.sin(phi + .45)); ctx.closePath(); ctx.fillStyle = '#087e82'; ctx.fill();
      }
      const axisColors = ['#7394bc', '#71a48c', '#b58959'];
      [[1, 0, 0], [0, 1, 0], [0, 0, 1]].forEach((v, i) => { line([M.scale(v, -.4), M.scale(v, 2.2)], axisColors[i] + '90', .8); const q = project(M.scale(v, 2.27)); ctx.font = '11px system-ui'; ctx.fillStyle = axisColors[i]; ctx.fillText(['x', 'y', 'z'][i], q.x + 3, q.y + 3); });
      const origin = project([0, 0, 0]); ctx.fillStyle = '#718b98'; ctx.beginPath(); ctx.arc(origin.x, origin.y, 2, 0, Math.PI * 2); ctx.fill(); ctx.font = '10px system-ui'; ctx.fillText('O', origin.x + 7, origin.y + 13);
      if (op && ['inversion', 'rotoinversion'].includes(op.type)) { ctx.strokeStyle = '#b16a23'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(origin.x, origin.y, 6, 0, Math.PI * 2); ctx.stroke(); }
      const model = data.model;
      if (data.ghost) {
        model.bonds.forEach(([a, b]) => line([model.atoms[a].position, model.atoms[b].position], '#92a7b03b', 2, [4, 4]));
        model.atoms.forEach(atom => { const q = project(atom.position); const r = Math.max(8, atom.radius * scale * 1.2); ctx.beginPath(); ctx.arc(q.x, q.y, r + 3, 0, Math.PI * 2); ctx.strokeStyle = '#879daa85'; ctx.lineWidth = 1.1; ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]); });
      }
      if (data.path && data.path.length > 1) line(data.path, '#b16a2399', 1.4, [4, 4]);
      if (data.orbit) data.orbit.forEach((p, i) => { const q = project(p); ctx.beginPath(); ctx.arc(q.x, q.y, 5, 0, Math.PI * 2); ctx.strokeStyle = '#3262a6aa'; ctx.lineWidth = 1.3; ctx.stroke(); ctx.font = '9px system-ui'; ctx.fillStyle = '#3262a6'; ctx.fillText(i, q.x + 7, q.y - 4); });
      const points = model.atoms.map(a => M.applyMatrix(data.matrix, a.position));
      const drawings = [];
      model.bonds.forEach(([a, b]) => { const qa = project(points[a]), qb = project(points[b]); drawings.push({ depth: (qa.depth + qb.depth) / 2 - .01, kind: 'bond', a, b }); });
      points.forEach((p, i) => drawings.push({ depth: project(p).depth, kind: 'atom', index: i }));
      // Bonds are beneath the spheres, so a bond endpoint never overwrites an atom label.
      drawings.sort((a, b) => a.kind !== b.kind ? (a.kind === 'bond' ? -1 : 1) : a.depth - b.depth); this.hits = [];
      drawings.forEach(draw => {
        if (draw.kind === 'bond') { line([points[draw.a], points[draw.b]], '#9db1bc', Math.max(3, scale * .06)); line([points[draw.a], points[draw.b]], '#dbe5e8', Math.max(1, scale * .024)); return; }
        const index = draw.index, atom = model.atoms[index], q = project(points[index]); const r = Math.max(8, atom.radius * scale * 1.2);
        const gradient = ctx.createRadialGradient(q.x - r * .32, q.y - r * .38, 0, q.x, q.y, r * 1.2); gradient.addColorStop(0, '#ffffff'); gradient.addColorStop(.25, atom.color); gradient.addColorStop(1, atom.element === 'H' ? '#a9bdcb' : atom.color);
        ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, Math.PI * 2); ctx.fillStyle = gradient; ctx.fill(); ctx.strokeStyle = '#617e8f70'; ctx.lineWidth = .9; ctx.stroke();
        if (index === data.selected) { ctx.beginPath(); ctx.arc(q.x, q.y, r + 4.5, 0, Math.PI * 2); ctx.strokeStyle = '#b16a23'; ctx.lineWidth = 1.7; ctx.stroke(); }
        if (data.labels) { ctx.font = '500 ' + Math.max(10, Math.min(12, r * .75)) + 'px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#17384b'; ctx.fillText(atom.id, q.x, q.y + .5); ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic'; }
        this.hits.push({ x: q.x, y: q.y, r, index });
      });
      if (data.caption) { ctx.fillStyle = '#637a86'; ctx.font = '10px system-ui'; ctx.textAlign = 'center'; ctx.fillText(data.caption, w / 2, h - 10); ctx.textAlign = 'start'; }
    }
  }
  function markFreeCamera() { document.querySelectorAll('[data-view]').forEach(el => { el.classList.remove('active'); el.setAttribute('aria-pressed', 'false'); }); }
  function renderAll() { scenes.forEach(scene => scene.draw()); }
  function mainSceneData() {
    const atom = state.model.atoms[state.selected]; const path = state.path ? Array.from({ length: 61 }, (_, i) => M.applyMatrix(M.multiplyMatrices(state.op.animate(i / 60), state.base), atom.position)) : null;
    let orbit = null;
    if (state.orbit) { const order = M.operationOrder(state.op.matrix) || 12; let cumulative = M.identityMatrix(); orbit = []; for (let i = 0; i < order; i++) { const p = M.applyMatrix(cumulative, atom.position); if (!orbit.some(q => M.distance(p, q) < 1e-6)) orbit.push(p); cumulative = M.multiplyMatrices(state.op.matrix, cumulative); } }
    return { model: state.model, matrix: currentMatrix(), op: state.op, selected: state.selected, ghost: state.ghost, labels: state.labels, path, orbit };
  }

  function renderAtlas() {
    const system = $('system-filter').value, property = $('property-filter').value;
    const groups = L.pointGroups.filter(g => (system === 'all' || g.system === system) && (property === 'all' || property === 'centro' && g.centrosymmetric || property === 'chiral' && g.chiral || property === 'other' && !g.centrosymmetric && !g.chiral));
    $('atlas-count').textContent = groups.length + ' / 32 个点群';
    $('atlas-grid').innerHTML = groups.map(g => '<button class="atlas-tile' + (g.hm === state.atlas ? ' selected' : '') + '" data-hm="' + escapeHTML(g.hm) + '" aria-pressed="' + (g.hm === state.atlas) + '"><span>' + g.system + '晶系</span><div class="atlas-symbols"><span class="hm-symbol">' + hmHTML(g.hm) + '</span><span class="sf-symbol">' + sfHTML(g.schoenflies) + '</span></div><div class="atlas-properties"><span class="property-tag">|G| = ' + g.order + '</span>' + (g.centrosymmetric ? '<span class="property-tag centro">含 i</span>' : g.chiral ? '<span class="property-tag proper">仅正操作</span>' : '<span class="property-tag">非中心对称</span>') + '</div></button>').join('');
    if (!groups.some(g => g.hm === state.atlas) && groups.length) state.atlas = groups[0].hm;
    if (!groups.length) { $('atlas-detail').hidden = true; return; }
    $('atlas-detail').hidden = false; renderAtlasDetail();
    document.querySelectorAll('.atlas-tile').forEach(el => { const active = el.dataset.hm === state.atlas; el.classList.toggle('selected', active); el.setAttribute('aria-pressed', active); });
  }
  function renderAtlasDetail() {
    const group = L.pointGroups.find(g => g.hm === state.atlas); if (!group) return;
    const model = M.models.find(m => hmByModel[m.id] === group.hm);
    $('atlas-detail').innerHTML = '<div><h2>' + hmHTML(group.hm) + ' / ' + sfHTML(group.schoenflies) + '</h2><p>' + group.note + '</p><p>' + group.system + '晶系 · ' + group.order + ' 个操作 · ' + (group.centrosymmetric ? '具有反演中心' : '无反演中心') + '</p></div><div class="atlas-detail-actions"><button class="primary-button" data-atlas-group="' + escapeHTML(group.hm) + '">查看此点群的 3D 模型 ↓</button>' + (model ? '<button class="secondary-button" data-atlas-model="' + model.id + '">用 ' + model.formula + ' 观察 ↗</button>' : '') + '</div>';
  }

  const compositionOps = [
    { id: 'c4z', name: 'C₄ · z 轴旋转 90°', spec: { type: 'rotation', n: 4, axis: [0, 0, 1] } },
    { id: 'mxz', name: 'mₓ𝓏 · 关于 xz 镜映', spec: { type: 'reflection', normal: [0, 1, 0] } },
    { id: 'c2x', name: 'C₂ · x 轴旋转 180°', spec: { type: 'rotation', n: 2, axis: [1, 0, 0] } },
    { id: 'c3z', name: 'C₃ · z 轴旋转 120°', spec: { type: 'rotation', n: 3, axis: [0, 0, 1] } },
    { id: 'i', name: 'i · 中心反演', spec: { type: 'inversion' } },
    { id: 'E', name: 'E · 恒等操作', spec: { type: 'E' } }
  ];
  const compositionPoint = [1.2, .7, 1];
  const compositionModel = { atoms: [{ id: 'P', element: 'P', position: compositionPoint, color: '#6fc9b1', radius: .17 }], bonds: [] };
  let composed = null;
  function updateComposition() {
    const a = M.makeOperation(compositionOps.find(op => op.id === $('compose-a').value).spec); const b = M.makeOperation(compositionOps.find(op => op.id === $('compose-b').value).spec);
    const ab = M.multiplyMatrices(a.matrix, b.matrix), ba = M.multiplyMatrices(b.matrix, a.matrix);
    composed = { a, b, ab, ba };
    const commute = M.matrixError(ab, ba) < 1e-7;
    $('commute-result').textContent = commute ? '✓ A B = B A · 这两个操作可交换' : 'A B ≠ B A · 顺序改变结果'; $('commute-result').classList.toggle('yes', commute);
    $('ab-coordinate').textContent = 'p → ' + coords(M.applyMatrix(ab, compositionPoint)); $('ba-coordinate').textContent = 'p → ' + coords(M.applyMatrix(ba, compositionPoint));
    $('ab-matrix').innerHTML = matrixHTML(ab); $('ba-matrix').innerHTML = matrixHTML(ba); renderAll();
  }
  function compositionScene(reverse) {
    if (!composed) return null;
    const first = reverse ? composed.a : composed.b;
    const matrix = reverse ? composed.ba : composed.ab;
    return { model: compositionModel, matrix, ghost: true, labels: true, selected: 0, path: [compositionPoint, M.applyMatrix(first.matrix, compositionPoint), M.applyMatrix(matrix, compositionPoint)] };
  }
  const waterGroup = [
    { name: 'E', spec: { type: 'E' } }, { name: 'C₂(z)', spec: { type: 'rotation', n: 2, axis: [0, 0, 1] } },
    { name: 'mₓ𝓏', spec: { type: 'reflection', normal: [0, 1, 0] } }, { name: 'mᵧ𝓏', spec: { type: 'reflection', normal: [1, 0, 0] } }
  ].map(g => ({ ...g, op: M.makeOperation(g.spec) }));
  function renderCayleyTable() {
    $('cayley-table').innerHTML = '<table class="group-table"><caption class="sr-only">mm2 点群乘法表，先做列操作再做行操作</caption><thead><tr><th scope="col">A × B</th>' + waterGroup.map(g => '<th scope="col">' + g.name + '</th>').join('') + '</tr></thead><tbody>' + waterGroup.map(a => '<tr><th scope="row">' + a.name + '</th>' + waterGroup.map(b => { const product = M.multiplyMatrices(a.op.matrix, b.op.matrix); const index = waterGroup.findIndex(g => M.matrixError(g.op.matrix, product) < 1e-7); if (index < 0) throw new Error('C2v table is not closed'); return '<td><button data-group-op="' + index + '" title="查看 ' + waterGroup[index].name + '">' + waterGroup[index].name + '</button></td>'; }).join('') + '</tr>').join('') + '</tbody></table>';
  }

  const quizExperiments = {
    identity: { model: 'water', type: 'E' }, rotation: { model: 'xef4', type: 'rotation', n: 4 }, mirror: { model: 'probe', type: 'reflection', plane: 'yz' },
    inversion: { model: 'probe', type: 'inversion' }, 'improper-notation': { model: 'probe', type: 'rotoinversion', n: 3 },
    'fixed-point': { model: 'ammonia', type: 'rotation', n: 3 }, endpoint: { model: 'ammonia', type: 'rotation', n: 3 },
    'crystallographic-restriction': { model: 'probe', type: 'rotation', n: 5 }, 'group-order': { model: 'xef4', type: 'rotation', n: 4 }
  };
  function renderQuiz() {
    const q = L.quiz[state.quizIndex], answer = state.answers[state.quizIndex];
    const answered = state.answers.filter(a => a !== null).length; const correct = state.answers.reduce((sum, a, i) => sum + (a === L.quiz[i].answer ? 1 : 0), 0);
    $('quiz-score').textContent = '已答 ' + answered + ' / ' + L.quiz.length + ' · 正确 ' + correct;
    $('quiz-position').textContent = 'QUESTION ' + String(state.quizIndex + 1).padStart(2, '0') + ' / ' + L.quiz.length;
    $('quiz-dots').innerHTML = L.quiz.map((item, i) => '<i class="' + (state.answers[i] !== null ? state.answers[i] === item.answer ? 'correct' : 'incorrect' : i === state.quizIndex ? 'current' : '') + '" title="第 ' + (i + 1) + ' 题"></i>').join('');
    $('quiz-question').textContent = q.question;
    $('quiz-options').innerHTML = q.options.map((option, i) => '<button class="quiz-option' + (answer !== null && i === q.answer ? ' correct' : answer === i ? ' incorrect' : '') + '" data-answer="' + i + '"' + (answer !== null ? ' disabled' : '') + '><span>' + String.fromCharCode(65 + i) + '</span><span>' + escapeHTML(option) + '</span></button>').join('');
    $('quiz-feedback').hidden = answer === null;
    if (answer !== null) { $('quiz-feedback').classList.toggle('wrong', answer !== q.answer); $('quiz-feedback').innerHTML = '<strong>' + (answer === q.answer ? '✓ 正确，理解到位。' : '正确答案是 ' + String.fromCharCode(65 + q.answer) + '。再看一下原因：') + '</strong>' + escapeHTML(q.explanation); }
    $('quiz-prev').disabled = state.quizIndex === 0; $('quiz-next').textContent = state.quizIndex === L.quiz.length - 1 ? '重新练习 ↺' : '下一题 →';
  }
  function startExperiment(spec, message) {
    setModel(spec.model); state.type = spec.type; if (spec.n) state.n = spec.n; state.axis = spec.axis || 'z'; state.plane = spec.plane || 'xz';
    updateConfig(); selectPage('lab'); window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    if (message) toast(message);
  }

  $('model-select').innerHTML = M.models.map(m => '<option value="' + m.id + '">' + escapeHTML(m.formula + ' · ' + m.name) + '</option>').join('');
  $('model-select').addEventListener('change', e => setModel(e.target.value));
  $('operation-grid').addEventListener('click', e => { const button = e.target.closest('[data-type]'); if (!button) return; state.type = button.dataset.type; updateConfig(); });
  $('n-select').addEventListener('change', e => { state.n = Number(e.target.value); updateConfig(); });
  $('axis-select').addEventListener('change', e => { state.axis = e.target.value; updateConfig(); });
  $('plane-select').addEventListener('change', e => { state.plane = e.target.value; updateConfig(); });
  $('atom-select').addEventListener('change', e => { state.selected = Number(e.target.value); updateDynamic(); });
  $('play-button').addEventListener('click', play);
  $('step-button').addEventListener('click', () => { stop(); state.progress = state.op.stageNames.length === 2 && state.progress < .5 ? .5 : 1; updateDynamic(); });
  $('repeat-button').addEventListener('click', () => { stop(); state.base = finalMatrix(); state.completed++; state.progress = 0; updateDynamic(); play(); });
  $('reset-button').addEventListener('click', updateConfig);
  $('speed-select').addEventListener('change', e => { state.speed = Number(e.target.value); });
  $('progress').addEventListener('input', e => { stop(); state.progress = Number(e.target.value) / 1000; updateDynamic(); });
  $('stage-track').addEventListener('click', e => { const button = e.target.closest('[data-progress]'); if (!button) return; stop(); state.progress = Number(button.dataset.progress); updateDynamic(); });
  [['ghost-toggle', 'ghost'], ['labels-toggle', 'labels'], ['path-toggle', 'path'], ['orbit-toggle', 'orbit']].forEach(([id, key]) => $(id).addEventListener('change', e => { state[key] = e.target.checked; updateDynamic(); }));
  $('intro-toggle').addEventListener('click', () => { $('intro-panel').hidden = !$('intro-panel').hidden; $('intro-toggle').setAttribute('aria-expanded', !$('intro-panel').hidden); });
  document.querySelectorAll('.nav-item').forEach(el => el.addEventListener('click', () => selectPage(el.dataset.page)));
  document.querySelector('.brand').addEventListener('click', () => selectPage('lab'));
  window.addEventListener('hashchange', () => selectPage(location.hash.slice(1), false));
  function setView(view) {
    Object.assign(state.camera, view === 'top' ? { yaw: 0, pitch: Math.PI / 2, zoom: 1 } : view === 'front' ? { yaw: 0, pitch: 0, zoom: 1 } : { yaw: -.48, pitch: .43, zoom: 1 });
    document.querySelectorAll('[data-view]').forEach(el => { const active = el.dataset.view === view; el.classList.toggle('active', active); el.setAttribute('aria-pressed', active); }); renderAll();
  }
  document.querySelectorAll('[data-view]').forEach(el => el.addEventListener('click', () => setView(el.dataset.view)));
  $('camera-reset').addEventListener('click', () => setView('perspective'));
  document.querySelectorAll('[data-experiment]').forEach(el => el.addEventListener('click', () => {
    const experiments = { 'water-rotation': [{ model: 'water', type: 'rotation', n: 2 }, '点击播放，追踪 H1 与 H2 如何交换位置。'], 'water-inversion': [{ model: 'water', type: 'inversion' }, '观察反演后的氢位置。二重轴并不保证存在反演中心。'], 'methane-roto': [{ model: 'methane', type: 'rotoinversion', n: 4 }, '先点下一步看旋转中间态，再点一次看反演终态。'], 'probe-compare': [{ model: 'probe', type: 'rotoinversion', n: 3 }, '记录 3̄ 的终态坐标，再切换 Sₙ（n = 3）比较。'] };
    startExperiment(...experiments[el.dataset.experiment]);
  }));
  $('system-filter').innerHTML += L.crystalSystems.map(system => '<option value="' + escapeHTML(system) + '">' + escapeHTML(system) + '晶系</option>').join('');
  $('system-filter').addEventListener('change', renderAtlas); $('property-filter').addEventListener('change', renderAtlas);
  $('atlas-grid').addEventListener('click', e => { const button = e.target.closest('[data-hm]'); if (!button) return; state.atlas = button.dataset.hm; renderAtlas(); });
  $('atlas-detail').addEventListener('click', e => { const button = e.target.closest('[data-atlas-model]'); if (button) { setModel(button.dataset.atlasModel); selectPage('lab'); window.scrollTo({ top: 0, behavior: 'auto' }); } });
  document.addEventListener('symmetry-atlas-select', e => {
    const group = L.pointGroups.find(g => g.hm === e.detail.hm); if (!group) return;
    if (!Array.from(document.querySelectorAll('.atlas-tile')).some(button => button.dataset.hm === group.hm)) { $('system-filter').value = 'all'; $('property-filter').value = 'all'; }
    state.atlas = group.hm; renderAtlas();
  });
  const compositionOptions = compositionOps.map(op => '<option value="' + op.id + '">' + op.name + '</option>').join('');
  $('compose-a').innerHTML = compositionOptions; $('compose-b').innerHTML = compositionOptions; $('compose-b').value = 'mxz';
  $('compose-a').addEventListener('change', updateComposition); $('compose-b').addEventListener('change', updateComposition);
  $('cayley-table').addEventListener('click', e => { const button = e.target.closest('[data-group-op]'); if (!button) return; const g = waterGroup[Number(button.dataset.groupOp)]; startExperiment({ model: 'water', type: g.spec.type, n: 2, plane: g.name === 'mᵧ𝓏' ? 'yz' : 'xz' }, 'mm2 组合结果：' + g.name); });
  $('quiz-options').addEventListener('click', e => { const button = e.target.closest('[data-answer]'); if (!button || state.answers[state.quizIndex] !== null) return; state.answers[state.quizIndex] = Number(button.dataset.answer); renderQuiz(); });
  $('quiz-prev').addEventListener('click', () => { if (state.quizIndex > 0) state.quizIndex--; renderQuiz(); });
  $('quiz-next').addEventListener('click', () => { if (state.quizIndex === L.quiz.length - 1) { state.quizIndex = 0; state.answers.fill(null); } else state.quizIndex++; renderQuiz(); });
  $('quiz-lab').addEventListener('click', () => { const id = L.quiz[state.quizIndex].id; if (id === 'composition') { selectPage('group'); window.scrollTo({ top: 0, behavior: 'auto' }); } else startExperiment(quizExperiments[id] || { model: 'water', type: 'rotation', n: 2 }); });
  $('glossary-grid').innerHTML = L.glossary.map(g => '<article class="glossary-card"><h3>' + escapeHTML(g.term) + '</h3><p>' + escapeHTML(g.definition) + '</p></article>').join('');
  $('source-links').innerHTML = L.sources.map(source => '<a href="' + escapeHTML(source.url) + '" target="_blank" rel="noopener noreferrer">' + escapeHTML(source.title) + ' ↗</a>').join('');
  new Scene($('main-canvas'), mainSceneData, true); new Scene($('ab-canvas'), () => compositionScene(false)); new Scene($('ba-canvas'), () => compositionScene(true));
  const observer = new ResizeObserver(() => requestAnimationFrame(renderAll)); scenes.forEach(scene => observer.observe(scene.canvas));
  document.addEventListener('visibilitychange', () => { if (document.hidden) { stop(); updateDynamic(); } });
  setModel('water'); renderAtlas(); updateComposition(); renderCayleyTable(); renderQuiz(); selectPage(location.hash.slice(1) || 'lab', false);
})();
