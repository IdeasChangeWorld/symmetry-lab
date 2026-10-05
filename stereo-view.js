(function () {
  'use strict';
  const A = window.SymmetryAdvanced, P = window.SymmetryPointGroups, M = window.SymmetryMath;
  if (!A || !P || !M) return;
  const root = document.getElementById('stereo-root');
  if (!root) return;
  const labels = (window.SymmetryLearning && window.SymmetryLearning.pointGroups) || [];
  root.innerHTML = `<section class="stereo-module panel" aria-labelledby="stereo-title">
    <div class="stereo-heading"><div><p class="eyebrow">FROM SPHERE TO DISK</p><h2 id="stereo-title">把三维方向放进一张图</h2><p>立体投影记录方向，不记录原子距原点的远近。球面上的一个点代表一个有向单位方向。</p></div><span class="stereo-badge">L04 · 3–8 / 23 页</span></div>
    <div class="stereo-grid"><div class="stereo-controls">
      <label for="stereo-group-select">① 选择点群</label><select id="stereo-group-select" aria-label="立体投影点群（全部32种）"></select>
      <p class="stereo-orientation">沿用 32 点群模型的直角坐标方向：单斜主轴沿 y，其余轴向群主轴沿 z。</p>
      <label for="stereo-polar">② 移动种子方向 · 极角 θ <output id="stereo-polar-value"></output></label><input id="stereo-polar" type="range" min="0" max="180" value="53" aria-label="种子与正z轴的极角，0到180度">
      <label for="stereo-azimuth">方位角 φ <output id="stereo-azimuth-value"></output></label><input id="stereo-azimuth" type="range" min="0" max="360" value="19" aria-label="种子在xy平面的方位角，0到360度">
      <p class="stereo-angle-note">θ 从 +z 轴量起；φ 在 xy 平面从 +x 向 +y 量起。灰色球面点是种子在群内所有操作下得到的方向。</p>
      <div class="stereo-presets"><button type="button" data-stereo-preset="general">一般位置</button><button type="button" data-stereo-preset="pole">+z 轴</button><button type="button" data-stereo-preset="equator">赤道</button></div>
      <fieldset class="stereo-toggles"><legend>③ 读图层次</legend><label><input id="stereo-upper" type="checkbox" checked> 上半球 · 实点</label><label><input id="stereo-lower" type="checkbox" checked> 下半球 · 空心点</label><label><input id="stereo-mirrors" type="checkbox"> 实际镜面的迹线</label><label><input id="stereo-guides" type="checkbox" checked> 坐标辅助线（不是镜面）</label></fieldset>
      <label for="stereo-point-select">④ 追踪一个方向</label><select id="stereo-point-select" aria-label="追踪球面轨道中的一个方向"></select><p id="stereo-point-info" class="stereo-point-info"></p>
    </div><div class="stereo-figures">
      <div class="stereo-figure-row"><figure><figcaption><strong>三维球面与投影射线</strong><span>拖动调整视角 · 点击圆盘中的点追踪</span></figcaption><div class="stereo-sphere-wrap"><canvas id="stereo-sphere" tabindex="0" aria-label="球面方向示意，可拖动旋转视角，方向键也可调整。橙色射线连接投影极、所选方向和赤道平面的投影点。"></canvas></div></figure>
      <figure><figcaption><strong>赤道平面上的单位圆盘</strong><span>+x 向右，+y 向上；赤道在外圆上</span></figcaption><svg id="stereo-disk" viewBox="-1.28 -1.28 2.56 2.56" role="img" aria-label="上下半球方向的立体投影"><title>点群方向的立体投影</title></svg></figure></div>
      <div class="stereo-legend"><span><i class="stereo-solid"></i>上半球 z &gt; 0</span><span><i class="stereo-open"></i>下半球 z &lt; 0</span><span><i class="stereo-equator"></i>赤道 z = 0</span><span><i class="stereo-mirror-line"></i>实际镜面</span><span><i class="stereo-guide-line"></i>辅助线</span></div>
      <div class="stereo-readout" aria-live="polite"><strong id="stereo-orbit-count"></strong><p id="stereo-orbit-note"></p><p id="stereo-mirror-note"></p></div>
      <details class="stereo-explanation" open><summary>为什么上下半球都能放进圆盘？</summary><p>上半球从<strong>南极 S = (0,0,−1)</strong>投到赤道平面；下半球从<strong>北极 N = (0,0,1)</strong>投到同一平面。把两种投影叠在一个圆盘，用实点与空心点保留半球信息。并未把下半球的方向取成反方向。</p><p>归一化方向 p = (x,y,z) 的圆盘坐标是 <code>(x / (1 + |z|), y / (1 + |z|))</code>。赤道直接落在外圆；两极分别落在圆心。一个实点外套一个空心圈表示不同半球的两个方向投影重合。</p><p>镜面与单位球相交成大圆，投影后成为圆弧或直径；赤道镜面投成外圆。此图只画所选群<strong>实际拥有的镜面</strong>，不把参考直径当作镜面。上下半球点可重合，镜面迹线也可重合。</p></details>
    </div></div></section>`;
  const $ = id => root.querySelector('#' + id);
  const state = { hm: '4mm', polar: 53, azimuth: 19, selected: 0, orbit: [], camera: { yaw: -.6, pitch: .5 } };
  const svgNS = 'http://www.w3.org/2000/svg';
  function svgElement(tag, attributes) {
    const e = document.createElementNS(svgNS, tag);
    Object.entries(attributes).forEach(([key, value]) => e.setAttribute(key, value));
    return e;
  }
  const formatted = value => Math.abs(value) < .0005 ? '0' : value.toFixed(3);
  const hemisphereName = { upper: '上半球', lower: '下半球', equator: '赤道' };
  P.groups.forEach(group => {
    const item = labels.find(item => item.hm === group.hm), option = document.createElement('option');
    option.value = group.hm; option.textContent = group.hm.replace(/-(\d)/g, '$1\u0305') + (item ? ' / ' + item.schoenflies + ' · ' + item.system : ''); $('stereo-group-select').append(option);
  });
  function update(newOrbit = true) {
    if (newOrbit) {
      state.orbit = A.poleOrbit(state.hm, A.directionFromAngles(state.polar, state.azimuth));
      state.selected = Math.min(state.selected, state.orbit.length - 1);
      $('stereo-point-select').replaceChildren(...state.orbit.map((point, index) => {
        const option = document.createElement('option'); option.value = index;
        option.textContent = (index === 0 ? 'P₀ · 种子' : 'P' + index) + ' · ' + hemisphereName[point.projection.hemisphere]; return option;
      }));
    }
    $('stereo-group-select').value = state.hm;
    $('stereo-point-select').value = state.selected;
    $('stereo-polar').value = state.polar; $('stereo-azimuth').value = state.azimuth;
    $('stereo-polar-value').textContent = state.polar + '°'; $('stereo-azimuth-value').textContent = state.azimuth + '°';
    const group = P.getGroup(state.hm), point = state.orbit[state.selected];
    $('stereo-orbit-count').textContent = state.hm.replace(/-(\d)/g, '$1\u0305') + '：' + group.operations.length + ' 个操作 → ' + state.orbit.length + ' 个不同方向';
    $('stereo-orbit-note').textContent = state.orbit.length < group.operations.length ? '当前是特殊方向：多个操作得到同一方向，轨道点数小于群阶。种子方向本身不改变点群。' : '当前种子的一般位置轨道含 |G| 个方向。一个方向轨道仅用于学习映射，可能具有更高的偶然对称，不能据此识别完整点群。';
    $('stereo-mirror-note').textContent = group.elements.mirrors.length ? '这个群有 ' + group.elements.mirrors.length + ' 个不同镜面；勾选迹线后可与方向轨道一起读图。' : '这个群没有镜面；坐标辅助线仍可见，不能据此认为存在镜面对称。';
    $('stereo-point-info').textContent = 'p = (' + point.direction.map(formatted).join(', ') + ')；圆盘 (' + formatted(point.projection.x) + ', ' + formatted(point.projection.y) + ') · ' + hemisphereName[point.projection.hemisphere] + '。' + (point.projection.hemisphere === 'equator' ? '方向位于赤道，无需选择投影极。' : '射线从' + (point.projection.hemisphere === 'upper' ? '南极 S' : '北极 N') + '发出。');
    drawDisk(); drawSphere();
  }
  function drawDisk() {
    const svg = $('stereo-disk'); svg.replaceChildren(svgElement('title', {})); svg.firstChild.textContent = '点群 ' + state.hm + ' 的方向立体投影';
    svg.append(svgElement('circle', { cx: 0, cy: 0, r: 1, fill: '#fbfcfa', stroke: '#667d89', 'stroke-width': .009 }));
    if ($('stereo-guides').checked) {
      [[-1, 0, 1, 0], [0, -1, 0, 1]].forEach(v => svg.append(svgElement('line', { x1: v[0], y1: v[1], x2: v[2], y2: v[3], stroke: '#9caab3', 'stroke-width': .004, 'stroke-dasharray': '.025 .025' })));
      [['+x', 1.09, .025], ['+y', 0, -1.09], ['−x', -1.13, .025], ['−y', 0, 1.12]].forEach(([text, x, y]) => {
        const label = svgElement('text', { x, y, fill: '#758895', 'font-size': '.077', 'text-anchor': 'middle' }); label.textContent = text; svg.append(label);
      });
    }
    if ($('stereo-mirrors').checked) P.getGroup(state.hm).elements.mirrors.forEach(mirror => {
      A.mirrorGreatCircle(mirror.normal).paths.forEach(path => {
        const d = path.points.map((p, i) => (i ? 'L' : 'M') + p.projection.x + ' ' + (-p.projection.y)).join(' ');
        svg.append(svgElement('path', { d, fill: 'none', stroke: '#8261a0', 'stroke-width': .012, 'stroke-opacity': .7 }));
      });
    });
    // Lower circles first, so coincident upper and lower points remain legible.
    const ordered = state.orbit.slice().sort((a, b) => (a.projection.hemisphere === 'lower' ? 0 : 1) - (b.projection.hemisphere === 'lower' ? 0 : 1));
    ordered.forEach(point => {
      const p = point.projection;
      if ((p.hemisphere === 'upper' && !$('stereo-upper').checked) || (p.hemisphere === 'lower' && !$('stereo-lower').checked)) return;
      const marker = p.hemisphere === 'equator' ? svgElement('rect', { x: p.x - .016, y: -p.y - .016, width: .032, height: .032, fill: '#217b78', stroke: '#217b78', 'stroke-width': .004 }) : svgElement('circle', { cx: p.x, cy: -p.y, r: p.hemisphere === 'lower' ? .027 : .014, fill: p.hemisphere === 'lower' ? 'none' : '#217b78', stroke: '#217b78', 'stroke-width': .009 });
      const title = svgElement('title', {}); title.textContent = 'P' + point.id + ' · ' + hemisphereName[p.hemisphere]; marker.append(title); svg.append(marker);
      const hit = svgElement('circle', { cx: p.x, cy: -p.y, r: .035, fill: 'transparent', class: 'stereo-hit', role: 'button', tabindex: 0, 'aria-label': '追踪 P' + point.id + '，' + hemisphereName[p.hemisphere] });
      const select = () => { state.selected = point.id; update(false); };
      hit.addEventListener('click', select); hit.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); } }); svg.append(hit);
    });
    const selected = state.orbit[state.selected].projection;
    if (!(selected.hemisphere === 'upper' && !$('stereo-upper').checked) && !(selected.hemisphere === 'lower' && !$('stereo-lower').checked)) svg.append(svgElement('circle', { cx: selected.x, cy: -selected.y, r: .047, fill: 'none', stroke: '#c98a38', 'stroke-width': .006, 'pointer-events': 'none' }));
  }
  function drawSphere() {
    const canvas = $('stereo-sphere'), rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2); canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = rect.width, h = rect.height, r = Math.min(w, h) * .34, center = [w * .5, h * .53];
    const camera = M.multiplyMatrices(M.rotationMatrix([1, 0, 0], state.camera.pitch), M.rotationMatrix([0, 0, 1], state.camera.yaw));
    const project = p => { const q = M.applyMatrix(camera, p); return { x: center[0] + r * q[0], y: center[1] - r * q[2], depth: q[1] }; };
    ctx.clearRect(0, 0, w, h); ctx.beginPath(); ctx.arc(center[0], center[1], r, 0, Math.PI * 2); ctx.fillStyle = '#f4f8f6'; ctx.fill(); ctx.strokeStyle = '#d2dfd8'; ctx.lineWidth = 1; ctx.stroke();
    const line = (points, color, width = 1, dash = []) => {
      ctx.beginPath(); points.forEach((point, i) => { const p = project(point); if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash); ctx.stroke(); ctx.setLineDash([]);
    };
    const circle = (u, v) => Array.from({ length: 121 }, (_, i) => M.add(M.scale(u, Math.cos(i * Math.PI / 60)), M.scale(v, Math.sin(i * Math.PI / 60))));
    const equator = circle([1, 0, 0], [0, 1, 0]);
    // The equatorial plane is the target plane, not a claimed mirror.
    ctx.beginPath(); equator.forEach((p, i) => { const q = project(p); if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); }); ctx.fillStyle = '#ddeeea75'; ctx.fill(); line(equator, '#829f9a', 1.1);
    if ($('stereo-guides').checked) {
      line(circle([1, 0, 0], [0, 0, 1]), '#bdcbd0', .7, [3, 3]); line(circle([0, 1, 0], [0, 0, 1]), '#bdcbd0', .7, [3, 3]);
      [[1, 0, 0], [0, 1, 0], [0, 0, 1]].forEach((p, i) => {
        line([M.scale(p, -1.08), M.scale(p, 1.16)], '#a6b7bd', .6, [3, 3]); const q = project(M.scale(p, 1.24)); ctx.font = '11px system-ui'; ctx.fillStyle = '#728693'; ctx.fillText(['x', 'y', 'z'][i], q.x, q.y);
      });
    }
    if ($('stereo-mirrors').checked) P.getGroup(state.hm).elements.mirrors.forEach(mirror => line(A.mirrorGreatCircle(mirror.normal, 120).points.map(p => p.direction), '#8261a090', 1.1));
    state.orbit.map(item => ({ item, p: project(item.direction) })).sort((a, b) => a.p.depth - b.p.depth).forEach(({ item, p }) => {
      ctx.beginPath(); ctx.arc(p.x, p.y, item.id === state.selected ? 4.5 : 2.5, 0, Math.PI * 2); ctx.fillStyle = item.id === state.selected ? '#c98a38' : p.depth < 0 ? '#839ba680' : '#718b96'; ctx.fill();
    });
    const selected = state.orbit[state.selected], q = selected.projection, target = [q.x, q.y, 0], pole = [0, 0, q.hemisphere === 'lower' ? 1 : -1];
    if (q.hemisphere !== 'equator') line([pole, target], '#c98a38', 1.8);
    const targetP = project(target); ctx.beginPath(); ctx.arc(targetP.x, targetP.y, 4.5, 0, Math.PI * 2); ctx.strokeStyle = '#c98a38'; ctx.lineWidth = 1.5; ctx.stroke();
    [[[0, 0, 1], 'N'], [[0, 0, -1], 'S']].forEach(([p, name]) => { const v = project(p); ctx.font = '12px system-ui'; ctx.fillStyle = '#557080'; ctx.fillText(name, v.x + 8, v.y + 4); });
    const directionP = project(selected.direction); ctx.fillStyle = '#a26b22'; ctx.font = '11px system-ui'; ctx.fillText('P' + selected.id, directionP.x + 8, directionP.y - 7); ctx.fillText('投影点', targetP.x + 8, targetP.y + 13);
  }
  $('stereo-group-select').addEventListener('change', e => { state.hm = e.target.value; state.selected = 0; update(); document.dispatchEvent(new CustomEvent('symmetry-atlas-select', { detail: { hm: state.hm } })); });
  ['stereo-polar', 'stereo-azimuth'].forEach(id => $(id).addEventListener('input', () => { state.polar = Number($('stereo-polar').value); state.azimuth = Number($('stereo-azimuth').value); state.selected = 0; update(); }));
  root.querySelectorAll('[data-stereo-preset]').forEach(button => button.addEventListener('click', () => {
    const preset = button.dataset.stereoPreset; state.polar = preset === 'pole' ? 0 : preset === 'equator' ? 90 : 53; state.azimuth = preset === 'general' ? 19 : 0; state.selected = 0; update();
  }));
  root.querySelectorAll('.stereo-toggles input').forEach(input => input.addEventListener('change', () => update(false)));
  $('stereo-point-select').addEventListener('change', e => { state.selected = Number(e.target.value); update(false); });
  document.addEventListener('symmetry-atlas-select', e => { if (e.detail && P.getGroup(e.detail.hm) && e.detail.hm !== state.hm) { state.hm = e.detail.hm; state.selected = 0; update(); } });
  const sphere = $('stereo-sphere'); let drag = null;
  sphere.addEventListener('pointerdown', e => { drag = [e.clientX, e.clientY]; sphere.setPointerCapture(e.pointerId); });
  sphere.addEventListener('pointermove', e => { if (!drag) return; state.camera.yaw += (e.clientX - drag[0]) * .008; state.camera.pitch = M.clamp(state.camera.pitch + (e.clientY - drag[1]) * .008, -.9, .9); drag = [e.clientX, e.clientY]; drawSphere(); });
  sphere.addEventListener('pointerup', () => { drag = null; }); sphere.addEventListener('pointercancel', () => { drag = null; });
  sphere.addEventListener('keydown', e => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault(); if (e.key === 'ArrowLeft') state.camera.yaw -= .12; if (e.key === 'ArrowRight') state.camera.yaw += .12;
    if (e.key === 'ArrowUp') state.camera.pitch = M.clamp(state.camera.pitch + .1, -.9, .9); if (e.key === 'ArrowDown') state.camera.pitch = M.clamp(state.camera.pitch - .1, -.9, .9); drawSphere();
  });
  new ResizeObserver(() => requestAnimationFrame(drawSphere)).observe(sphere);
  const page = document.getElementById('page-advanced');
  if (page) new MutationObserver(() => { if (!page.hidden) requestAnimationFrame(drawSphere); }).observe(page, { attributes: true, attributeFilter: ['hidden'] });
  update();
  window.SymmetryStereoView = { setGroup(hm) { if (P.getGroup(hm)) { state.hm = hm; state.selected = 0; update(); } }, redraw: drawSphere };
})();
