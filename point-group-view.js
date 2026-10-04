(function () {
  'use strict';
  const P = window.SymmetryPointGroups, M = window.SymmetryMath, L = window.SymmetryLearning;
  const $ = id => document.getElementById(id), canvas = $('pg-canvas'), section = $('point-group-viewer');
  if (!P || !M || !L || !canvas) return;
  const ctx = canvas.getContext('2d');
  const state = { group: null, op: null, selected: 0, progress: 0, playing: false, view: 'perspective', camera: { yaw: -.5, pitch: .45, zoom: 1 }, elementPreferences: { axes: true, mirrors: false, inversion: true } };
  let frame = 0, lastTime = 0, drag = null, hits = [], edges = [], result = null, radius = 1.8;
  const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hmHTML = value => esc(value).replace(/-(\d)/g, '<span class="overbar">$1</span>');
  const fmt = value => (Math.abs(value) < .0005 ? 0 : value).toFixed(2);
  const xyz = point => '(' + point.map(fmt).join(', ') + ')';
  const direction = vector => xyz(M.normalize(vector));
  const sameLine = (a, b) => Math.abs(M.dot(M.normalize(a), M.normalize(b))) > 1 - 1e-7;
  const stages = op => op.stageNames || (op.type === 'rotoinversion' || op.type === 'improper' ? ['旋转', op.type === 'rotoinversion' ? '反演' : '镜映'] : ['操作']);
  const typeNames = { E: '恒等', rotation: '旋转', reflection: '镜映', inversion: '反演', rotoinversion: '旋转反演', improper: '旋转镜映' };
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function stop() { state.playing = false; cancelAnimationFrame(frame); frame = 0; lastTime = 0; }
  function jump() { section.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }); }

  function referenceEdges(model) {
    const list = [];
    model.atoms.forEach((atom, i) => {
      const candidates = model.atoms.map((b, j) => ({ j, d: M.distance(atom.position, b.position) })).filter(item => item.j !== i && model.atoms[item.j].element === atom.element && item.d > 1e-6);
      if (!candidates.length) return;
      const shortest = Math.min(...candidates.map(item => item.d));
      candidates.forEach(item => { if (item.j > i && item.d <= shortest * 1.025) list.push([i, item.j]); });
    });
    return list;
  }
  function setGroup(hm) {
    const group = P.getGroup(hm), info = L.pointGroups.find(item => item.hm === hm);
    if (!group || !info) return;
    stop(); state.group = group; state.selected = 0;
    $('pg-group-select').value = hm;
    $('pg-heading').innerHTML = hmHTML(hm) + ' / ' + esc(info.schoenflies) + ' · 三维对称模型';
    $('pg-heading').setAttribute('aria-label', hm.replace(/-(\d)/g, '$1\u0305') + ' / ' + info.schoenflies + ' · 三维对称模型');
    $('pg-group-note').textContent = info.system + '晶系 · ' + info.note;
    $('pg-order-badge').textContent = '|G| = ' + group.operations.length;
    $('pg-operation-select').innerHTML = group.operations.map((op, i) => '<option value="' + esc(op.id) + '">' + String(i + 1).padStart(2, '0') + ' · ' + esc(op.label) + '</option>').join('');
    $('pg-point-select').innerHTML = group.model.atoms.map((atom, i) => '<option value="' + i + '">' + esc(atom.id) + ' · ' + esc(atom.element) + ' 型</option>').join('');
    $('pg-point-select').value = '0';
    edges = referenceEdges(group.model);
    radius = Math.max(...group.model.atoms.map(atom => M.norm(atom.position)), 1);
    renderElements();
    const first = group.operations.find(op => (group.generators || []).includes(op.id)) || group.operations.find(op => op.type !== 'E') || group.operations[0];
    setOperation(first.id);
  }
  function setOperation(id) {
    const op = state.group.operations.find(item => item.id === id); if (!op) return;
    stop(); state.op = op; state.progress = 0;
    result = M.matchModel(state.group.model, op.matrix, 1e-6);
    $('pg-operation-select').value = op.id;
    const degrees = Math.round((op.angle || 0) * 180 / Math.PI);
    const explanation = {
      E: '所有点保持原位。恒等操作属于每个点群。',
      rotation: '绕单位方向 ' + (op.axis ? direction(op.axis) : '') + ' 按右手规则旋转 ' + degrees + '°；轴上的点保持不动。',
      reflection: '镜面通过 O，法向为 ' + (op.normal ? direction(op.normal) : '') + '。垂直镜面的坐标分量变号。',
      inversion: '以 O 为中心，将 (x, y, z) 变为 (−x, −y, −z)。',
      rotoinversion: '先绕方向 ' + (op.axis ? direction(op.axis) : '') + ' 旋转 ' + degrees + '°，再关于 O 反演。两个分步骤不一定单独属于这个点群。',
      improper: '先绕轴旋转，再关于垂直于轴的镜面反射。'
    }[op.type];
    $('pg-operation-description').textContent = explanation;
    $('pg-operation-order').textContent = '操作的阶：' + (op.order || M.operationOrder(op.matrix));
    $('pg-operation-parity').textContent = M.determinant(op.matrix) > 0 ? 'det M = +1' : 'det M = −1';
    $('pg-matrix').innerHTML = op.matrix.flat().map(value => '<span>' + fmt(value) + '</span>').join('');
    const composite = stages(op).length === 2;
    $('pg-stage-track').innerHTML = (composite ? [[0, '起始'], [.5, '① 旋转结束'], [1, '② ' + (op.type === 'improper' ? '镜映' : '反演') + '结束']] : [[0, '起始'], [1, typeNames[op.type] + '结束']]).map(([t, label]) => '<button type="button" data-pg-progress="' + t + '">' + label + '</button>').join('');
    $('pg-animation-note').textContent = ['reflection', 'inversion', 'rotoinversion', 'improper'].includes(op.type) ? '镜映与反演的中间形变只作教学示意；完整操作的终态才用于判断。' : '只看完整操作的终态；中间角度不必属于这个点群。';
    $('pg-operations-summary').textContent = '查看完整操作列表 · ' + state.group.operations.length + ' 个';
    $('pg-operation-list').innerHTML = state.group.operations.map(item => '<button type="button" data-pg-operation="' + esc(item.id) + '" aria-pressed="' + (item.id === op.id) + '"><span>' + esc(item.label) + '</span><small>阶 ' + item.order + '</small></button>').join('');
    update();
  }
  function renderElements() {
    const elements = state.group.elements;
    const axes = elements.axes.filter(axis => axis.fold > 1), improper = elements.axes.filter(axis => axis.improperFold > 2);
    Object.entries({ axes: elements.axes.length > 0, mirrors: elements.mirrors.length > 0, inversion: elements.inversion }).forEach(([name, available]) => {
      const input = $('pg-' + name); input.disabled = !available; input.checked = available && state.elementPreferences[name]; input.closest('label').classList.toggle('unavailable', !available);
    });
    $('pg-origin-legend').hidden = state.group.model.centerFixedBy !== 'origin-marker';
    $('pg-elements-summary').innerHTML = '<span>正旋转轴 <b>' + axes.length + ' 条</b></span><span>旋转反演轴 <b>' + improper.length + ' 条</b></span><span>镜面 <b>' + elements.mirrors.length + ' 个</b></span><span>反演中心 <b>' + (elements.inversion ? '有' : '无') + '</b></span>';
    const buttons = [];
    elements.axes.forEach((axis, i) => {
      if (axis.fold > 1) buttons.push('<button type="button" data-pg-element="axis:' + i + '">' + axis.fold + ' 重轴 <small>' + direction(axis.direction) + '</small></button>');
      if (axis.improperFold > 2) buttons.push('<button type="button" data-pg-element="improper:' + i + '">' + hmHTML('-' + axis.improperFold) + ' 轴 <small>' + direction(axis.direction) + '</small></button>');
    });
    elements.mirrors.forEach((plane, i) => buttons.push('<button type="button" data-pg-element="mirror:' + i + '">镜面 <small>法向 ' + direction(plane.normal) + '</small></button>'));
    if (elements.inversion) buttons.push('<button type="button" data-pg-element="inversion:0">反演中心 O</button>');
    $('pg-element-list').innerHTML = buttons.join('') || '<p>这个点群只有 E，没有非平凡的对称轴、镜面或反演中心。</p>';
  }
  function update() {
    if (!state.group || !state.op) return;
    const ended = state.progress >= 1 - 1e-9, composite = stages(state.op).length === 2;
    $('pg-progress').value = Math.round(state.progress * 1000);
    $('pg-progress-label').textContent = Math.round(state.progress * 100) + '%';
    $('pg-play').textContent = state.playing ? '暂停' : ended ? '重播操作' : composite && state.progress === .5 ? '继续第二步' : '播放操作';
    $('pg-step').disabled = ended;
    $('pg-phase').textContent = ended ? '完整操作结束' : state.progress === 0 ? '起始状态' : composite && state.progress === .5 ? '旋转结束 · 中间态' : composite ? (state.progress < .5 ? '① 旋转中' : '② ' + (state.op.type === 'improper' ? '镜映中' : '反演中')) : '操作进行中';
    $('pg-scene-title').textContent = state.op.label;
    $('pg-match-result').textContent = ended ? result.isSymmetry ? '✓ 全部同类点重合' : '模型验证异常' : '所选操作属于这个点群';
    $('pg-match-note').textContent = ended ? state.group.model.atoms.length + ' 个点均能找到同类型的原始位置；同类点的编号可以交换。' : '完整操作后，所有同类型点将重合。可点“看终态”直接比较。';
    const atom = state.group.model.atoms[state.selected], current = M.applyMatrix(P.animateOperation(state.op, state.progress), atom.position);
    $('pg-point-coordinates').textContent = xyz(atom.position) + ' → ' + xyz(current);
    $('pg-point-mapping').textContent = ended && result.mapping ? '终态：' + atom.id + ' → ' + state.group.model.atoms[result.mapping[state.selected]].id : atom.id + ' · 颜色代表类型，编号用于追踪';
    document.querySelectorAll('[data-pg-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.pgView === state.view)));
    document.querySelectorAll('[data-pg-progress]').forEach(button => button.classList.toggle('active', Math.abs(Number(button.dataset.pgProgress) - state.progress) < .001));
    draw();
  }
  function play() {
    if (state.playing) { stop(); update(); return; }
    if (reduced()) { state.progress = 1; update(); return; }
    if (state.progress >= 1) state.progress = 0;
    state.playing = true; lastTime = 0;
    function tick(time) {
      if (!state.playing) return;
      const previous = state.progress, duration = stages(state.op).length === 2 ? 4200 : 2600;
      if (lastTime) state.progress = Math.min(1, state.progress + Math.min(time - lastTime, 80) / duration);
      lastTime = time;
      if (stages(state.op).length === 2 && previous < .5 && state.progress >= .5) { state.progress = .5; stop(); }
      if (state.progress >= 1) stop();
      update(); if (state.playing) frame = requestAnimationFrame(tick);
    }
    update(); frame = requestAnimationFrame(tick);
  }
  function draw() {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h || !ctx || !state.group) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    const cam = state.camera, scale = Math.min(w / (radius * 3.1), h / (radius * 3.15)) * cam.zoom;
    const project = p => {
      const x = Math.cos(cam.yaw) * p[0] - Math.sin(cam.yaw) * p[1], y = Math.sin(cam.yaw) * p[0] + Math.cos(cam.yaw) * p[1];
      return { x: w * .53 + x * scale, y: h * .57 - (Math.cos(cam.pitch) * p[2] + Math.sin(cam.pitch) * y) * scale, depth: -Math.cos(cam.pitch) * y + Math.sin(cam.pitch) * p[2] };
    };
    const line = (points, color, width = 1, dash = []) => {
      if (!points.length) return; ctx.beginPath(); points.forEach((point, i) => { const p = project(point); if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash); ctx.stroke(); ctx.setLineDash([]);
    };
    const plane = (normal, selected = false) => {
      const n = M.normalize(normal), u = M.normalize(M.cross(n, Math.abs(n[2]) < .9 ? [0, 0, 1] : [0, 1, 0])), v = M.cross(n, u), size = radius * 1.02;
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => project(M.add(M.scale(u, a * size), M.scale(v, b * size))));
      ctx.beginPath(); corners.forEach((p, i) => { if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }); ctx.closePath(); ctx.fillStyle = selected ? '#e9b45723' : '#e9b4570b'; ctx.strokeStyle = selected ? '#b16a2399' : '#b16a2335'; ctx.lineWidth = selected ? 1.4 : .7; ctx.fill(); ctx.stroke();
    };
    const elements = state.group.elements, op = state.op;
    if ($('pg-mirrors').checked) elements.mirrors.forEach(item => plane(item.normal));
    if (op.type === 'reflection') plane(op.normal, true);
    if (op.type === 'improper') plane(op.axis, true);
    if ($('pg-axes').checked) elements.axes.forEach(axis => line([M.scale(axis.direction, -radius * 1.25), M.scale(axis.direction, radius * 1.25)], axis.improperFold > 2 ? '#977ca455' : '#217b7860', .9, [4, 5]));
    if (op.axis && ['rotation', 'rotoinversion', 'improper'].includes(op.type)) {
      const length = radius * 1.3;
      line([M.scale(op.axis, -length), M.scale(op.axis, length)], '#217b78c0', 2, [6, 4]);
      const q = project(M.scale(op.axis, length)); ctx.font = '11px system-ui'; ctx.fillStyle = '#217b78'; ctx.fillText('所选轴', q.x + 7, q.y + 3);
    }
    // Coordinate guides and camera are references; neither contributes to model symmetry.
    [[1, 0, 0], [0, 1, 0], [0, 0, 1]].forEach((v, i) => { line([[0, 0, 0], M.scale(v, radius * 1.15)], '#7f96a247', .7); const q = project(M.scale(v, radius * 1.17)); ctx.font = '10px system-ui'; ctx.fillStyle = '#718692'; ctx.fillText(['x', 'y', 'z'][i], q.x + 5, q.y); });
    const matrix = P.animateOperation(op, state.progress), model = state.group.model, points = model.atoms.map(atom => M.applyMatrix(matrix, atom.position));
    if ($('pg-links').checked) edges.forEach(([a, b]) => line([points[a], points[b]], model.atoms[a].color + '50', .85));
    if ($('pg-ghost').checked) model.atoms.forEach(atom => { const q = project(atom.position); ctx.beginPath(); ctx.arc(q.x, q.y, 5.5, 0, Math.PI * 2); ctx.strokeStyle = '#7a929b60'; ctx.lineWidth = 1; ctx.stroke(); });
    const atom = model.atoms[state.selected];
    const path = Array.from({ length: 65 }, (_, i) => M.applyMatrix(P.animateOperation(op, i / 64), atom.position)); line(path, '#b16a2377', 1, [3, 4]);
    hits = [];
    points.map((p, i) => ({ p, i, projected: project(p) })).sort((a, b) => a.projected.depth - b.projected.depth).forEach(item => {
      const point = model.atoms[item.i], q = item.projected, r = model.atoms.length > 75 ? 3.6 : model.atoms.length > 30 ? 4.4 : 5.6;
      ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, Math.PI * 2); ctx.fillStyle = point.color; ctx.fill(); ctx.strokeStyle = '#ffffffa8'; ctx.lineWidth = .7; ctx.stroke();
      if (item.i === state.selected) { ctx.beginPath(); ctx.arc(q.x, q.y, r + 3.5, 0, Math.PI * 2); ctx.strokeStyle = '#17384b'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.font = '600 10px system-ui'; ctx.fillStyle = '#17384b'; ctx.fillText(point.id, q.x + r + 5, q.y - 4); }
      else if ($('pg-labels').checked) { ctx.font = '9px system-ui'; ctx.fillStyle = '#17384b'; ctx.fillText(point.id, q.x + r + 3, q.y - 3); }
      hits.push({ x: q.x, y: q.y, r, index: item.i });
    });
    const origin = project([0, 0, 0]); ctx.fillStyle = '#617a89'; ctx.font = '10px system-ui'; ctx.fillText('O', origin.x + 8, origin.y + 14);
    if (elements.inversion && $('pg-inversion').checked || op.type === 'inversion') { ctx.beginPath(); ctx.arc(origin.x, origin.y, 8, 0, Math.PI * 2); ctx.strokeStyle = '#995c98'; ctx.lineWidth = 1.5; ctx.stroke(); }
  }

  $('pg-group-select').innerHTML = L.crystalSystems.map(system => '<optgroup label="' + esc(system) + '晶系">' + L.pointGroups.filter(group => group.system === system).map(group => '<option value="' + esc(group.hm) + '">' + esc(group.hm.replace(/-(\d)/g, '$1\u0305') + ' / ' + group.schoenflies + ' · ' + group.order + ' 个操作') + '</option>').join('') + '</optgroup>').join('');
  $('pg-group-select').addEventListener('change', e => { setGroup(e.target.value); document.dispatchEvent(new CustomEvent('symmetry-atlas-select', { detail: { hm: e.target.value } })); });
  $('pg-operation-select').addEventListener('change', e => setOperation(e.target.value));
  $('pg-point-select').addEventListener('change', e => { state.selected = Number(e.target.value); update(); });
  $('pg-play').addEventListener('click', play);
  $('pg-step').addEventListener('click', () => { stop(); state.progress = stages(state.op).length === 2 && state.progress < .5 ? .5 : 1; update(); });
  $('pg-end').addEventListener('click', () => { stop(); state.progress = 1; update(); });
  $('pg-reset').addEventListener('click', () => { stop(); state.progress = 0; update(); });
  $('pg-progress').addEventListener('input', e => { stop(); state.progress = Number(e.target.value) / 1000; update(); });
  $('pg-stage-track').addEventListener('click', e => { const button = e.target.closest('[data-pg-progress]'); if (button) { stop(); state.progress = Number(button.dataset.pgProgress); update(); } });
  $('pg-operation-list').addEventListener('click', e => { const button = e.target.closest('[data-pg-operation]'); if (button) setOperation(button.dataset.pgOperation); });
  $('pg-element-list').addEventListener('click', e => {
    const button = e.target.closest('[data-pg-element]'); if (!button) return;
    const [type, textIndex] = button.dataset.pgElement.split(':'), i = Number(textIndex), elements = state.group.elements;
    let choices = state.group.operations.filter(op => type === 'inversion' ? op.type === 'inversion' : type === 'mirror' ? op.type === 'reflection' && sameLine(op.normal, elements.mirrors[i].normal) : op.type === (type === 'axis' ? 'rotation' : 'rotoinversion') && sameLine(op.axis, elements.axes[i].direction) && op.n === (type === 'axis' ? elements.axes[i].fold : elements.axes[i].improperFold));
    choices.sort((a, b) => a.angle - b.angle); if (choices.length) setOperation(choices[0].id);
  });
  document.querySelectorAll('.pg-toggles input').forEach(input => input.addEventListener('change', () => { const name = input.id.replace('pg-', ''); if (name in state.elementPreferences) state.elementPreferences[name] = input.checked; draw(); }));
  document.querySelectorAll('[data-pg-view]').forEach(button => button.addEventListener('click', () => {
    state.view = button.dataset.pgView === 'reset' ? 'perspective' : button.dataset.pgView;
    Object.assign(state.camera, state.view === 'top' ? { yaw: 0, pitch: Math.PI / 2, zoom: 1 } : state.view === 'front' ? { yaw: 0, pitch: 0, zoom: 1 } : { yaw: -.5, pitch: .45, zoom: 1 }); update();
  }));
  $('atlas-detail').addEventListener('click', e => { if (e.target.closest('[data-atlas-group]')) jump(); });
  $('pg-jump').addEventListener('click', jump);
  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => { if (!drag) return; state.camera.yaw += (e.clientX - drag.x) * .007; state.camera.pitch = M.clamp(state.camera.pitch + (e.clientY - drag.y) * .007, -1.5, 1.5); drag.x = e.clientX; drag.y = e.clientY; state.view = 'free'; update(); });
  canvas.addEventListener('pointerup', e => {
    if (drag && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 5) { const rect = canvas.getBoundingClientRect(), hit = hits.slice().reverse().find(item => Math.hypot(e.clientX - rect.left - item.x, e.clientY - rect.top - item.y) < item.r + 6); if (hit) { state.selected = hit.index; $('pg-point-select').value = hit.index; update(); } }
    drag = null;
  });
  canvas.addEventListener('pointercancel', () => { drag = null; });
  canvas.addEventListener('wheel', e => { e.preventDefault(); state.camera.zoom = M.clamp(state.camera.zoom * Math.exp(-e.deltaY * .001), .55, 1.7); draw(); }, { passive: false });
  canvas.addEventListener('keydown', e => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-'].includes(e.key)) {
      e.preventDefault(); if (e.key === 'ArrowLeft') state.camera.yaw -= .12; if (e.key === 'ArrowRight') state.camera.yaw += .12;
      if (e.key === 'ArrowUp') state.camera.pitch = M.clamp(state.camera.pitch + .12, -1.5, 1.5); if (e.key === 'ArrowDown') state.camera.pitch = M.clamp(state.camera.pitch - .12, -1.5, 1.5);
      if (e.key === '+' || e.key === '=') state.camera.zoom = M.clamp(state.camera.zoom * 1.1, .55, 1.7); if (e.key === '-') state.camera.zoom = M.clamp(state.camera.zoom / 1.1, .55, 1.7); state.view = 'free'; update();
    } else if (e.key === ' ') { e.preventDefault(); play(); }
  });
  function observeAtlas() {
    const active = document.querySelector('.atlas-tile[aria-pressed="true"]'); section.hidden = !active;
    if (active && (!state.group || state.group.hm !== active.dataset.hm)) setGroup(active.dataset.hm);
  }
  new MutationObserver(observeAtlas).observe($('atlas-detail'), { childList: true, attributes: true, attributeFilter: ['hidden'] });
  new MutationObserver(() => { if ($('page-atlas').hidden) { stop(); update(); } else draw(); }).observe($('page-atlas'), { attributes: true, attributeFilter: ['hidden'] });
  new ResizeObserver(() => requestAnimationFrame(draw)).observe(canvas);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { stop(); update(); } });
  observeAtlas();
})();
