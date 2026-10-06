(function () {
  'use strict';
  const C = window.SymmetryCrystals;
  const root = document.getElementById('crystal-root');
  if (!root) return;
  if (!C) { root.innerHTML = '<p class="cx-waiting">晶体结构模块尚未载入，请重新打开页面。</p>'; return; }
  const $ = id => document.getElementById(id);
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const add = (a, b) => a.map((v, i) => v + b[i]);
  const sub = (a, b) => a.map((v, i) => v - b[i]);
  const times = (a, t) => a.map(v => v * t);
  const norm = a => Math.hypot(...a);
  const pretty = x => Math.abs(x - Math.round(x)) < 1e-7 ? String(Math.round(x)) : Number(x).toFixed(3);
  const coord = a => '(' + a.map(pretty).join(', ') + ')';
  const palette = ['#217b78', '#3262a6', '#b16a23', '#935f98'];
  const tabs = [
    { id: 'lattice', title: '晶格 ＋ 基元', sub: '14 种点阵 · 原胞与传统胞', heading: '先分清重复方式，再放入原子', intro: '晶格记录平移重复的位置；基元是在每个格点上复制的一组原子。晶格加上基元，才得到晶体结构。', source: 'L04 · PDF 2、30 页 / L05 · 4–9 页', task: '先选择 FCC 点阵，再把“晶格”切换为“结构”。同一个平移点阵可以承载不同的原子排列。', next: '下一步：看结构与配位 →' },
    { id: 'structures', title: '结构 ＋ 配位', sub: '金属 · AB / AB₂ 原型', heading: '从一个原子出发，读懂整个结构', intro: '选择结构，再选一种原子。配位数来自无限周期结构中的最近邻，不受当前显示几个晶胞影响。多面体将近邻围成的空间显示出来。', source: 'L05 · PDF 12–64 页', task: '切换 NaCl、CsCl 与 ZnS，观察同为 AB 化学计量的结构，配位数如何从 6、8 变为 4。', next: '下一步：追踪堆积与孔隙 →' },
    { id: 'packing', title: '堆积 ＋ 孔隙', sub: 'ABAB / ABC · 四面体与八面体空隙', heading: '逐层堆起来，再看看空隙在哪里', intro: 'A、B、C 表示密排层在平面内的三种错位位置。HCP 采用 ABAB…，FCC 采用 ABCABC…；每个密排球对应 2 个四面体空隙和 1 个八面体空隙。', source: 'L05 · PDF 15–27、38–65 页', task: '从两层开始逐层增加：第三层回到 A 是 HCP，第三层到 C 是 FCC。再切换孔隙视图，比较占据一半与全部的化学计量。', next: '下一步：尝试硬球半径比 →' },
    { id: 'radius', title: '半径比 ＋ 几何', sub: '局部 CN 4 / 6 / 8 · 临界接触', heading: '用硬球看懂半径比的几何来源', intro: '选定一种局部配位壳，保持周围大球彼此接触，改变中心小球的半径。临界值由这个理想几何决定；实际材料还受到成键、价态和结构畸变影响。', source: 'L05 · PDF 20、28–33 页', task: '在四面体壳中把 r/R 调到约 0.225：中心球恰好接触四个大球。切换八面体与立方壳，比较相应临界值。', next: '回到晶格与基元 ↻' }
  ];
  const state = {
    tab: 'lattice', bravais: 'cF', structure: C.structures[0].id, mode: 'lattice', cellMode: 'conventional', repeats: 1,
    radiusScale: .52, frame: true, selected: 0, neighbors: true, polyhedron: true, packingMode: 'layers', sequence: 'ABC', layers: 3,
    holeKind: 'tetrahedral', holeIndex: 0, occupancy: 'empty', role: 'anion', ratio: .225, cn: 4,
    camera: { yaw: -.55, pitch: .48, zoom: 1 }, view: 'perspective'
  };
  let scene = null, hits = [], drag = null, redrawFrame = 0;
  const selectedOptions = (options, value) => options.map(o => '<option value="' + esc(o.value) + '"' + (o.value === String(value) ? ' selected' : '') + '>' + esc(o.label) + '</option>').join('');
  const selectControl = (id, label, options, value) => '<label class="cx-control"><span>' + label + '</span><select id="' + id + '">' + selectedOptions(options, value) + '</select></label>';
  const buttonRow = (key, items, value) => '<div class="cx-radio-row">' + items.map(item => '<button type="button" data-cx-set="' + key + '" data-value="' + esc(item[0]) + '" aria-label="' + esc(item[1]) + '" aria-pressed="' + (String(value) === String(item[0])) + '">' + esc(item[1]) + '</button>').join('') + '</div>';
  const toggle = (key, label, checked) => '<label class="cx-check"><input type="checkbox" data-cx-check="' + key + '"' + (checked ? ' checked' : '') + '>' + label + '</label>';
  const commonControls = () => '<label class="cx-control"><span>显示范围</span>' + buttonRow('repeats', [['1', '1 个晶胞'], ['2', '2 × 2 × 2']], state.repeats) + '</label><label class="cx-control"><span>球半径显示 · <output id="cx-radius-value">' + Math.round(state.radiusScale * 100) + '%</output></span><input id="cx-radius-scale" type="range" min="15" max="100" step="1" value="' + Math.round(state.radiusScale * 100) + '"></label>' + toggle('frame', '显示晶胞边框', state.frame);
  const cellControls = () => '<label class="cx-control"><span>选择晶胞</span>' + buttonRow('cellMode', [['conventional', '传统晶胞'], ['primitive', '原胞']], state.cellMode) + '</label>';
  function structureSelector() {
    const categories = [
      ['单质与共价结构', s => new Set(s.atoms.map(a => a.species)).size === 1],
      ['AB · 两种粒子数量相等', s => { const counts = Object.values(s.speciesCounts); return counts.length === 2 && counts[0] === counts[1]; }],
      ['AB₂ / A₂B · 数量比 1:2', s => { const counts = Object.values(s.speciesCounts); return counts.length === 2 && Math.max(...counts) === 2 * Math.min(...counts); }],
      ['AB₃ / A₃B · 数量比 1:3', s => { const counts = Object.values(s.speciesCounts); return counts.length === 2 && Math.max(...counts) === 3 * Math.min(...counts); }]
    ];
    const seen = new Set();
    const groups = categories.map(([label, test]) => { const structures = C.structures.filter(s => !seen.has(s.id) && test(s)); structures.forEach(s => seen.add(s.id)); return { label, structures }; });
    const remaining = C.structures.filter(s => !seen.has(s.id)); if (remaining.length) groups.push({ label: '其他结构', structures: remaining });
    return '<label class="cx-control"><span>选择结构原型</span><select id="cx-structure">' + groups.filter(g => g.structures.length).map(g => '<optgroup label="' + g.label + '">' + selectedOptions(g.structures.map(s => ({ value: s.id, label: s.name + ' · ' + s.formula })), state.structure) + '</optgroup>').join('') + '</select></label>';
  }
  function packingSites() {
    const cells = state.holeKind === 'octahedral' && state.occupancy === 'third' ? 3 : 1;
    return Array.from({ length: cells }, (_, k) => C.fccInterstitialSites[state.holeKind].map(frac => add(frac, [0, 0, k]))).flat();
  }
  function sources(pages, lecture = 'L05') {
    if (!pages) return '';
    if (typeof pages === 'string') return pages;
    if (Array.isArray(pages)) return lecture + ' · PDF ' + pages.join('、') + ' 页';
    return Object.entries(pages).map(([k, v]) => k.toUpperCase() + ' · PDF ' + (Array.isArray(v) ? v.join('、') : v) + ' 页').join(' / ');
  }
  function latticeDefinition() {
    const b = C.bravais.find(item => item.id === state.bravais) || C.bravais[0];
    return { ...b, atoms: b.centerings.map((frac, i) => ({ id: 'L' + (i + 1), species: '格点', frac, color: '#6e8796', radius: .13 })), cellAtomCount: b.centeringMultiplicity, primitiveAtomCount: 1 };
  }
  function controlsHTML() {
    if (state.tab === 'lattice') return selectControl('cx-bravais', '14 种 Bravais 点阵', C.bravais.map(b => ({ value: b.id, label: b.name })), state.bravais) + '<label class="cx-control"><span>分开看三个概念</span>' + buttonRow('mode', [['lattice', '晶格'], ['basis', '基元'], ['structure', '结构']], state.mode) + '</label>' + cellControls() + commonControls() + '<p class="cx-control-note"><strong>双原子基元是教学示例。</strong><br>绿色与蓝色分别代表不同类型。它们在每个格点上以相同方向、相同相对位置重复；这个基元可以降低点阵原有的点对称性。</p>';
    if (state.tab === 'structures') {
      const s = C.getStructure(state.structure);
      return structureSelector() + cellControls() + commonControls() + selectControl('cx-atom', '选择配位中心', s.atoms.map((a, i) => ({ value: String(i), label: a.species + ' · ' + a.id + ' · ' + coord(a.frac) })), String(state.selected)) + toggle('neighbors', '高亮完整周期近邻', state.neighbors) + toggle('polyhedron', '显示配位多面体', state.polyhedron) + '<p class="cx-control-note">球大小只控制显示，不改变原子坐标或配位数。近邻可跨过晶胞边界；浅色点是上下文或共享边界的原子，实色点是当前配位壳。</p><button type="button" class="primary-button" id="cx-point-group">看对应点群 ' + esc(s.pointGroup || '') + ' →</button>';
    }
    if (state.tab === 'packing') {
      let html = '<label class="cx-control"><span>观察对象</span>' + buttonRow('packingMode', [['layers', '逐层密堆积'], ['holes', 'FCC 孔隙']], state.packingMode) + '</label>';
      if (state.packingMode === 'layers') html += '<label class="cx-control"><span>堆积顺序</span>' + buttonRow('sequence', [['AB', 'ABAB · HCP'], ['ABC', 'ABC · FCC']], state.sequence) + '</label><label class="cx-control"><span>显示层数 · <output id="cx-layer-value">' + state.layers + '</output></span><input id="cx-layers" type="range" min="1" max="6" step="1" value="' + state.layers + '"></label>';
      else html += selectControl('cx-hole-kind', '选择孔隙种类', [{ value: 'tetrahedral', label: '四面体孔隙 · 每胞 8 个' }, { value: 'octahedral', label: '八面体孔隙 · 每胞 4 个' }], state.holeKind) + selectControl('cx-hole-site', '选中一个孔隙看配位', packingSites().map((frac, i) => ({ value: String(i), label: '孔隙 ' + (i + 1) + ' · ' + coord(frac) })), String(state.holeIndex)) + selectControl('cx-occupancy', '孔隙占据', [{ value: 'empty', label: '空：只标出孔隙' }].concat(state.holeKind === 'octahedral' ? [{ value: 'third', label: '填 1/3 · 三胞计数示意' }] : []).concat([{ value: 'half', label: '填一半' }, { value: 'full', label: '全部填满' }]), state.occupancy) + selectControl('cx-host-role', 'FCC 骨架离子', [{ value: 'anion', label: '大阴离子 X · 填小阳离子 M' }, { value: 'cation', label: '阳离子 M · 填阴离子 X' }], state.role) + toggle('polyhedron', '显示所选孔隙配位壳', state.polyhedron);
      return html + '<label class="cx-control"><span>球半径显示 · <output id="cx-radius-value">' + Math.round(state.radiusScale * 100) + '%</output></span><input id="cx-radius-scale" type="range" min="15" max="100" step="1" value="' + Math.round(state.radiusScale * 100) + '"></label>' + toggle('frame', '显示晶胞 / 层参考框', state.frame) + '<p class="cx-control-note">密排层字母只表示位置，不代表元素。孔隙占据的有序示例用于理解数量关系；不能只凭填充比例判定任意材料的真实结构。</p>';
    }
    return '<label class="cx-control"><span>固定一种局部配位壳</span>' + buttonRow('cn', [['4', 'CN 4'], ['6', 'CN 6'], ['8', 'CN 8']], state.cn) + '</label><label class="cx-control"><span>中心球 / 外围球 · r/R = <output id="cx-ratio-value">' + state.ratio.toFixed(3) + '</output></span><input id="cx-ratio" type="range" min="100" max="1000" step="1" value="' + Math.round(state.ratio * 1000) + '"></label><button type="button" class="primary-button" id="cx-critical">调到几何临界值</button>' + toggle('polyhedron', '显示局部配位多面体', state.polyhedron) + '<p class="cx-control-note"><strong>这里只改变中心球大小。</strong><br>外围大球相互接触，坐标固定。临界值以下中心球与外围球间有空隙；临界值以上在这组固定坐标中会发生重叠，需要结构松弛。</p>';
  }
  function render() {
    const tab = tabs.find(t => t.id === state.tab);
    root.innerHTML = '<div class="cx-route" role="tablist" aria-label="晶体结构学习步骤">' + tabs.map((t, i) => '<button type="button" role="tab" id="cx-tab-' + t.id + '" data-cx-tab="' + t.id + '" aria-selected="' + (t.id === state.tab) + '" aria-controls="cx-panel"><span class="cx-number">STEP 0' + (i + 1) + '</span><strong>' + t.title + '</strong><small>' + t.sub + '</small></button>').join('') + '</div><section id="cx-panel" class="panel cx-workbench" role="tabpanel" aria-labelledby="cx-tab-' + state.tab + '"><div class="cx-intro"><div><h2>' + tab.heading + '</h2><p>' + tab.intro + '</p></div><span class="cx-source">' + tab.source + '</span></div><div class="cx-layout"><aside class="cx-controls">' + controlsHTML() + '</aside><div class="cx-scene"><div class="cx-viewport"><canvas id="cx-canvas" tabindex="0" aria-label="可拖动、缩放的晶体结构三维示意图。方向键转动，加减键缩放，点击原子选择配位中心。"></canvas><div class="cx-scene-heading"><strong id="cx-scene-title"></strong><span id="cx-scene-meta"></span></div><div class="cx-camera">' + [['perspective', '三维'], ['top', '俯视'], ['front', '正视'], ['reset', '重置视角']].map(([id, label]) => '<button type="button" data-cx-view="' + id + '" aria-pressed="' + (id === state.view) + '">' + label + '</button>').join('') + '</div><span class="cx-camera-hint">拖动转动 · 滚轮缩放 · 点击原子</span><div class="cx-legend" id="cx-legend"></div></div><div class="cx-observe"><span>试着观察</span><p>' + tab.task + '</p></div><div class="cx-result-grid" id="cx-results" aria-live="polite"></div></div></div><div id="cx-details"></div><div class="cx-next"><p id="cx-next-note">每一步都可独立尝试；按这个顺序连接点群、晶格与真实结构。</p><button type="button" class="secondary-button" data-cx-next>' + tab.next + '</button></div></section>';
    attachCanvas(); updateScene();
  }
  function cellFrame(basis, repeats = [1, 1, 1], offset = [0, 0, 0]) {
    const edges = [];
    for (let i = 0; i < repeats[0]; i++) for (let j = 0; j < repeats[1]; j++) for (let k = 0; k < repeats[2]; k++) {
      const corners = [];
      for (let a = 0; a <= 1; a++) for (let b = 0; b <= 1; b++) for (let c = 0; c <= 1; c++) corners.push(add(C.toCartesian(basis, [i + a, j + b, k + c]), offset));
      for (let m = 0; m < 8; m++) [1, 2, 4].forEach(bit => { const n = m ^ bit; if (m < n) edges.push([corners[m], corners[n]]); });
    }
    return edges;
  }
  function withBoundaryAtoms(atoms, definition, repeats) {
    const result = atoms.slice();
    atoms.forEach(atom => {
      const axes = [0, 1, 2].filter(i => Math.abs(atom.frac[i]) < 1e-8);
      for (let mask = 1; mask < 2 ** axes.length; mask++) {
        const frac = atom.frac.slice(); axes.forEach((axis, bit) => { if (mask & (1 << bit)) frac[axis] = repeats[axis]; });
        result.push({ ...atom, id: atom.id + '#boundary-' + mask, frac, position: C.toCartesian(definition, frac), boundary: true });
      }
    });
    return result;
  }
  function buildLattice() {
    const source = latticeDefinition();
    const def = state.cellMode === 'primitive' ? C.primitiveStructure(source) : source;
    const repeats = [state.repeats, state.repeats, state.repeats];
    const sample = C.sampleStructure(def, repeats);
    const b = C.bravais.find(item => item.id === state.bravais);
    const motif = [{ species: '基元 A', color: palette[0], frac: [0, 0, 0], radius: .15 }, { species: '基元 B', color: palette[1], frac: [.22, .13, .14], radius: .13 }];
    const latticeAtoms = withBoundaryAtoms(sample.atoms, def, repeats);
    const atoms = state.mode === 'lattice' ? latticeAtoms.map(atom => ({ ...atom, lattice: true })) : state.mode === 'basis' ? motif.map((a, i) => ({ ...a, id: 'basis-' + i, position: C.toCartesian(source.basis, a.frac) })) : latticeAtoms.flatMap((atom, j) => motif.map((a, i) => ({ ...a, id: 'motif-' + j + '-' + i, boundary: atom.boundary, position: add(atom.position, C.toCartesian(source.basis, a.frac)), atomIndex: i })));
    return { atoms, equivalentCount: state.mode === 'basis' ? 2 : sample.atoms.length * (state.mode === 'structure' ? 2 : 1), frames: state.frame ? cellFrame(def.basis, state.mode === 'basis' ? [1, 1, 1] : repeats) : [], axes: def.basis, title: b.name + ' · ' + { lattice: '只看平移格点', basis: '一个格点携带的基元', structure: '每个格点复制相同基元' }[state.mode], meta: state.cellMode === 'primitive' ? '原胞 · 1 个等效格点' : b.centering + ' 传统胞 · ' + b.centeringMultiplicity + ' 个等效格点', lattice: b, definition: def, species: state.mode === 'lattice' ? [{ name: '格点', color: '#6e8796' }] : motif.map(a => ({ name: a.species, color: a.color })) };
  }
  function buildStructure() {
    const original = C.getStructure(state.structure);
    const def = state.cellMode === 'primitive' ? C.primitiveStructure(original) : original;
    const repeats = [state.repeats, state.repeats, state.repeats];
    const sample = C.sampleStructure(def, repeats);
    state.selected = clamp(state.selected, 0, original.atoms.length - 1);
    const coordination = C.coordination(original, state.selected);
    const originalPosition = coordination.center.position;
    const wrappedFrac = C.toFractional(def, originalPosition).map(x => ((x % 1) + 1) % 1).map(x => x > 1 - 1e-8 || x < 1e-8 ? 0 : x);
    const shift = sub(C.toCartesian(def, wrappedFrac), originalPosition);
    const center = add(coordination.center.position, shift);
    const shell = coordination.neighbors.map((a, i) => ({ ...a, id: 'shell-' + i, position: add(a.position, shift), color: original.atoms[a.atomIndex].color, radius: original.hardSphereRadius || original.atoms[a.atomIndex].radius, shell: true }));
    const atoms = withBoundaryAtoms(sample.atoms.map(a => ({ ...a, atomIndex: original.atoms.findIndex(x => x.id === a.id.split('@')[0]), radius: original.hardSphereRadius || a.radius, context: state.neighbors, selected: norm(sub(a.position, center)) < 1e-7 && a.species === coordination.center.species })), def, repeats).map(a => ({ ...a, selected: norm(sub(a.position, center)) < 1e-7 && a.species === coordination.center.species }));
    if (state.neighbors) shell.forEach(a => { const existing = atoms.find(x => x.species === a.species && norm(sub(x.position, a.position)) < 1e-7); if (existing) { existing.shell = true; existing.context = false; } else atoms.push(a); });
    const selectedAtom = atoms.find(a => a.selected);
    if (selectedAtom) selectedAtom.context = false;
    else atoms.push({ ...original.atoms[state.selected], id: 'center', position: center, radius: original.hardSphereRadius || original.atoms[state.selected].radius, selected: true, context: false, atomIndex: state.selected });
    const vertices = (coordination.polyhedron?.vertices || coordination.neighbors.map(a => a.position)).map(p => add(p, shift));
    return { atoms, frames: state.frame ? cellFrame(def.basis, repeats) : [], axes: def.basis, title: original.name + ' · ' + original.formula, meta: original.spaceGroup || '', definition: original, renderedDefinition: def, coordination, center, shell, polyhedron: state.neighbors && state.polyhedron ? { ...coordination.polyhedron, vertices } : null, shellLines: state.neighbors ? shell.map(a => [center, a.position]) : [], species: [...new Map(original.atoms.map(a => [a.species, { name: a.species, color: a.color }])).values()] };
  }
  function buildPacking() {
    // The mathematical module supplies the ideal periodic layer and interstitial coordinates.
    if (state.packingMode === 'layers') {
      const data = C.closePackedLayers({ sequence: state.sequence === 'AB' ? 'ABAB' : 'ABCABC', layers: state.layers, extent: 2, radius: 1 });
      const atoms = data.atoms.map(a => ({ ...a, color: palette['ABC'.indexOf(a.label)] }));
      const a = times(data.a, 4), b = times(data.b, 4), c = [0, 0, Math.max(1, state.layers - 1) * data.height];
      const frameOffset = times(add(a, b), -.5);
      return { atoms, title: (state.sequence === 'AB' ? 'HCP · ABAB…' : 'FCC · ABCABC…') + ' · ' + state.layers + ' 层', meta: '理想密排层', species: [{ name: 'A 层', color: palette[0] }, { name: 'B 层', color: palette[1] }].concat(state.sequence === 'ABC' ? [{ name: 'C 层', color: palette[2] }] : []), frames: state.frame ? cellFrame([a, b, c], [1, 1, 1], frameOffset) : [], packing: data };
    }
    const fcc = C.getStructure('fcc'), host = state.role === 'anion' ? 'X' : 'M', filler = state.role === 'anion' ? 'M' : 'X';
    const sites = packingSites(), repeats = [1, 1, state.occupancy === 'third' ? 3 : 1];
    state.holeIndex = clamp(state.holeIndex, 0, sites.length - 1);
    const occupiedIndices = state.occupancy === 'empty' ? [] : state.occupancy === 'full' ? sites.map((_, i) => i) : state.occupancy === 'third' ? [0, 3, 6, 9] : state.holeKind === 'tetrahedral' ? sites.map((s, i) => Math.round(s.filter(v => v > .5).length) % 2 === 0 ? i : -1).filter(i => i >= 0) : [0, 1];
    const hostRadius = fcc.hardSphereRadius || fcc.atoms[0].radius, smallRadius = hostRadius * C.radiusSites.find(r => r.id === state.holeKind).criticalRatio;
    const hostCount = 4 * repeats[2];
    const atoms = withBoundaryAtoms(C.sampleStructure(fcc, repeats).atoms.map(a => ({ ...a, species: host, radius: hostRadius, color: palette[0], context: true })), fcc, repeats);
    sites.forEach((frac, i) => atoms.push({ id: 'hole-' + i, species: filler, position: C.toCartesian(fcc, frac), radius: smallRadius, color: palette[1], empty: !occupiedIndices.includes(i), selected: i === state.holeIndex }));
    const coordination = C.coordinationAt(fcc, sites[state.holeIndex]);
    coordination.neighbors.forEach((a, i) => { const existing = atoms.find(x => !x.empty && x.species === host && norm(sub(x.position, a.position)) < 1e-7); if (existing) { existing.context = false; existing.shell = true; } else atoms.push({ ...a, id: 'host-shell-' + i, species: host, color: palette[0], radius: hostRadius, shell: true }); });
    const total = occupiedIndices.length;
    const gcd = (a, b) => b ? gcd(b, a % b) : a;
    const divisor = total ? gcd(total, hostCount) : 1;
    const subscript = n => n === 1 ? '' : String(n).replace(/\d/g, x => '₀₁₂₃₄₅₆₇₈₉'[Number(x)]);
    const formula = !total ? host + ' 骨架' : 'M' + subscript((state.role === 'anion' ? total : hostCount) / divisor) + 'X' + subscript((state.role === 'anion' ? hostCount : total) / divisor);
    const data = { formula, coordination, occupied: total, siteCount: sites.length, hostCount, cells: repeats[2] };
    return { atoms, title: 'FCC · ' + (state.holeKind === 'tetrahedral' ? '四面体' : '八面体') + '孔隙 ' + (state.holeIndex + 1), meta: state.occupancy === 'third' ? '三胞计数示意 · CN ' + coordination.count : 'CN ' + coordination.count, species: [{ name: state.role === 'anion' ? '阴离子 X 骨架' : '阳离子 M 骨架', color: palette[0] }, { name: state.role === 'anion' ? '阳离子 M 填充' : '阴离子 X 填充', color: palette[1] }], frames: state.frame ? cellFrame(fcc.basis, repeats) : [], polyhedron: state.polyhedron ? coordination.polyhedron : null, packing: data };
  }
  function buildRadius() {
    const data = C.radiusSites.find(r => r.coordination === state.cn);
    const atoms = data.shell.map((position, i) => ({ id: 'shell-' + i, species: 'X', position, radius: 1, color: palette[0] })).concat([{ id: 'center', species: 'M', position: [0, 0, 0], radius: state.ratio, color: palette[2], selected: true }]);
    return { atoms, title: { 4: '四面体', 6: '八面体', 8: '立方' }[state.cn] + '局部壳 · CN ' + state.cn, meta: 'r/R = ' + state.ratio.toFixed(3), frames: [], polyhedron: state.polyhedron ? data.polyhedron : null, species: [{ name: '外围球 R = 1 · 半透明', color: palette[0] }, { name: '中心小球 r', color: palette[2] }], radius: data };
  }
  function updateScene() {
    scene = state.tab === 'lattice' ? buildLattice() : state.tab === 'structures' ? buildStructure() : state.tab === 'packing' ? buildPacking() : buildRadius();
    $('cx-scene-title').textContent = scene.title;
    $('cx-scene-meta').textContent = scene.meta;
    $('cx-legend').innerHTML = scene.species.map(s => '<span><i class="cx-dot" style="background:' + esc(s.color) + '"></i>' + esc(s.name) + '</span>').join('') + (state.tab === 'structures' ? '<span><i class="cx-dot selected"></i>配位中心</span>' : state.tab === 'packing' && state.packingMode === 'holes' ? '<span><i class="cx-dot hole"></i>空孔隙</span>' : '');
    renderResults(); draw();
  }
  const result = (label, heading, text, negative = false) => '<article class="cx-result' + (negative ? ' negative' : '') + '"><span class="mini-label">' + label + '</span><h3>' + heading + '</h3><p>' + text + '</p></article>';
  function renderResults() {
    let results = '', detail = '';
    if (state.tab === 'lattice') {
      const b = scene.lattice;
      results = result('点阵与晶胞', esc(b.system) + ' · ' + esc(b.centering), '传统胞含 <b>' + b.centeringMultiplicity + '</b> 个等效格点，原胞含 <b>1</b> 个。选择原胞改变的是重复区域与基矢，同一无限点阵没有改变。') + result('晶格 + 基元 = 结构', state.mode === 'lattice' ? '只标重复位置' : state.mode === 'basis' ? '每个格点附带 2 个原子' : '重复基元得到结构', '晶格点是数学位置。这里的双原子基元示例固定绿色 A 与蓝色 B 的相对位置；结构中的原子数 = 格点数 × 基元原子数。');
      detail = '<div class="cx-facts"><span>传统胞基矢长度 <b>' + b.basis.map(a => pretty(norm(a))).join(' / ') + '</b></span><span>原胞/传统胞体积 <b>1/' + b.centeringMultiplicity + '</b></span><span>半开区域含 <b>' + scene.equivalentCount + '</b> 个' + (state.mode === 'lattice' ? '格点' : '原子') + '</span></div><details class="cx-definition"><summary>为什么 7 个晶系对应 14 种 Bravais 点阵？</summary><p>晶系依据点对称性分类，Bravais 点阵进一步区分平移格点的排列。并非每个晶系都能独立采用所有 P、I、F、C、R 中心化；有些看似不同的晶胞可通过换基矢描述为同一类点阵。</p><p>P：简单；I：体心；F：面心；C：底心；R：菱方点阵的六方轴传统胞。三方晶系中的菱方 Bravais 点阵常以六方轴表示，此时传统胞含 3 个格点，真正菱方原胞仍只含 1 个。</p><p>' + esc(b.description || '') + ' 当前基矢和球大小用于几何示意，长度采用任意单位。为显示完整边框，浅色高边界位置也画出周期等价的共享球；它们不额外计入半开区域。</p></details>';
    } else if (state.tab === 'structures') {
      const s = scene.definition, q = scene.coordination;
      const shellSpecies = Object.entries(q.bySpecies || {}).map(([name, n]) => esc(name) + ' × ' + n).join('，');
      const range = q.distanceRange || [q.distance, q.distance];
      results = result('无限周期近邻', esc(q.center.species) + ' · CN ' + q.count, '第一配位壳：' + shellSpecies + '。距离 <code>' + pretty(range[0]) + (Math.abs(range[1] - range[0]) > 1e-6 ? '–' + pretty(range[1]) : '') + '</code>（模型单位）。跨边界的近邻也计入，所以切换 1 个胞与复胞不会改变此结果。') + result('原胞 / 传统胞中的原子数', s.primitiveAtomCount + ' / ' + s.cellAtomCount + ' 个原子', '当前使用' + (state.cellMode === 'primitive' ? '原胞' : '传统胞') + '。按半开区间计数，浅色边界共享球不重复算入。' + (s.id === 'hcp' ? 'HCP 六棱柱图常用的 6 原子计数，与此处 2 原子的平行六面体原胞不同。' : '晶胞选择改变重复区域，不改变无限结构的化学计量。'));
      detail = '<div class="cx-facts"><span>空间群 <b>' + esc(s.spaceGroup) + '</b></span><span>晶体点群 <b>' + esc(s.pointGroup) + '</b></span><span>配位中心分数坐标 <b>' + esc(coord(s.atoms[state.selected].frac)) + '</b></span></div><details class="cx-definition"><summary>阅读这个模型：周期结构、配位与理想化</summary><p>' + esc(s.description) + '</p><p>' + esc(s.idealization || '这是理想结构原型；实际晶格参数和内部坐标可能随材料、温度与压力变化。') + '</p><p>实线晶胞边框只定义重复区域。中心到近邻的连线帮助读出配位；它们不自动代表化学键。配位多面体是近邻位置的凸包，配位数相同也可能具有不同形状，例如 NiAs 中两种原子的六配位壳并不相同。</p><p>畸变结构的第一配位壳可有不同键长，例如金红石的 4 + 2 个近邻。这里把最短距离的 1.12 倍内的一组几何近邻作为配位示意，避免把分裂壳误数成 4 配位；具体配位定义仍依结构环境而定。</p><p>坐标为模型中的笛卡尔 / 分数坐标。三维图当前只绘制有限区域，数学计算使用无限周期重复；不能把可见原子数当作化学计量或配位数。</p></details><p class="cx-source-note">课程对应：' + esc(sources(s.lecturePages)) + '</p>';
    } else if (state.tab === 'packing') {
      const p = scene.packing;
      if (state.packingMode === 'layers') {
        const sequence = Array.from({ length: state.layers }, (_, i) => state.sequence[i % state.sequence.length]);
        results = result('同样密排，不同层序', state.sequence === 'AB' ? 'ABAB… → HCP' : 'ABCABC… → FCC / CCP', '两个理想结构均为 CN 12，堆积率约 74%。A、B、C 是层的横向位置；第二层球落入第一层的三角凹处。<span class="cx-layer-sequence">' + sequence.map(s => '<span class="' + s.toLowerCase() + '">' + s + '</span>').join('') + '</span>') + result('从三维看，再从顶部看', state.layers < 3 ? '加到第 3 层再比较' : state.sequence === 'AB' ? '第三层回到 A' : '第三层来到 C', '点击“俯视”，比较第三层与第一层是否重合。显示的是有限层片；边缘球可见邻居较少，不改变无限理想结构的 CN 12。');
      } else {
        const host = state.role === 'anion' ? 'X' : 'M', filler = state.role === 'anion' ? 'M' : 'X';
        const total = p.siteCount, occupied = p.occupied;
        const formula = p.formula || (occupied ? (state.holeKind === 'tetrahedral' && occupied === 8 ? state.role === 'anion' ? 'M₂X' : 'MX₂' : occupied === 2 ? state.role === 'anion' ? 'MX₂' : 'M₂X' : 'MX') : host + ' 骨架');
        let connection = state.holeKind === 'tetrahedral' ? state.occupancy === 'half' ? '四面体孔隙占据一半，数量上得到 1:1。这里采用有序半占据示例，对应闪锌矿型排列。' : state.occupancy === 'full' ? state.role === 'cation' ? '阳离子 FCC 骨架 + 全部四面体孔隙中的阴离子，是 CaF₂ 萤石的描述方式。' : '阴离子 FCC 骨架 + 全部四面体孔隙中的阳离子，是 Li₂O 反萤石的描述方式。' : '先看 8 个四面体空隙，每个空隙由 4 个骨架球围成。' : state.occupancy === 'third' ? '每个密排阴离子对应 1 个八面体孔隙，占据 1/3 后阳离子:阴离子 = 1:3，这正是课件 CrCl₃ 的 AB₃ 占位原则。这里显示三胞中的一个任意有序计数示例，不是 CrCl₃ 的真实多型坐标。' : state.occupancy === 'full' ? 'FCC 阴离子骨架的八面体孔隙全部填阳离子，对应 NaCl 型 MX；互换两种离子只改变描述的起点。' : '占据比例先确定数量关系；一半八面体孔隙的有序排布并不唯一，不能据此自动命名实际结构。';
        if (state.occupancy === 'third' && state.role === 'cation') connection = '这里交换骨架与填充粒子的角色，得到 M₃X。课件 CrCl₃ 的 AB₃ 描述应选择阴离子 X 骨架。占位比例不唯一决定有序排列或多型。';
        results = result('按周期区域计数 · ' + p.cells + ' 个传统胞', host + '：' + p.hostCount + ' · ' + filler + '：' + occupied, '每个 FCC 传统胞内有 4 个等效骨架球、8 个四面体孔隙、4 个八面体孔隙。当前区域占据 ' + occupied + '/' + total + ' 个所选孔隙；八面体边界空隙按周期共享计数。') + result('化学计量与结构联系', esc(formula), connection);
      }
      detail = '<details class="cx-definition"><summary>孔隙、占据比例与真实结构的关系</summary><p>四面体空隙 CN 4，八面体空隙 CN 6。在含 N 个球的理想密排结构中，四面体空隙总数为 2N，八面体空隙总数为 N。FCC 与 HCP 都有这个数量关系，空隙在空间中的连接方式却不同。</p><p>改变孔隙占据可把堆积模型连接到 ZnS、NaCl、NiAs、CaF₂ 与 Li₂O 等结构；还需要指定哪些位置被占据。萤石以阳离子 Ca 的 FCC 骨架起步，F 阴离子填满四面体孔隙；反萤石交换了骨架与填充离子的角色。</p><p>课件 L05 PDF 65 页以 CrCl₃ 的 CCP 阴离子骨架、BiI₃ 的 HCP 阴离子骨架介绍 AB₃：每个阴离子有一个八面体孔隙，占据 1/3 得到 1:3 化学计量。这里的三胞示意只验证数量关系；占位比例不唯一决定有序排列、多型或真实结构。</p><p>孔隙标记是理想球模型中的中心位置；实际离子半径、畸变与成键可能使“密排”成为近似描述。这里的空心圈表示未占据位置，不是原子。</p></details>';
    } else {
      const r = scene.radius, critical = r.criticalRatio;
      const delta = state.ratio - critical, equal = Math.abs(delta) < .0011;
      const status = equal ? '恰好接触 ' + state.cn + ' 个大球' : delta < 0 ? '中心球与外围球之间有间隙' : '固定坐标中，中心球发生重叠';
      results = result('理想硬球临界值', 'r/R = ' + Number(critical).toFixed(3), { 4: '√(3/2) − 1 ≈ 0.225', 6: '√2 − 1 ≈ 0.414', 8: '√3 − 1 ≈ 0.732' }[state.cn] + '。由外围大球彼此接触时，中心到壳顶点的距离求得。') + result('当前固定几何', status, equal ? '中心球半径与这个局部空隙相匹配。球的接触是几何条件，不能单独确定一种材料的真实结构。' : delta < 0 ? '在这个固定配位壳中，中心球还没有接触外围大球。真实结构能否采用这个配位，需要进一步考虑能量和成键。' : '这不表示模型自动变成更高配位。它表示当前固定壳容不下这么大的中心球；需要移动外围原子或选择其他几何。', delta > .0011);
      detail = '<details class="cx-definition"><summary>课件半径比规则：把范围作为几何参照</summary><table><thead><tr><th>局部配位</th><th>几何临界 r/R</th><th>传统理想硬球规则中的区间</th></tr></thead><tbody><tr><td>CN 4 · 四面体</td><td>0.225</td><td>约 0.225–0.414</td></tr><tr><td>CN 6 · 八面体</td><td>0.414</td><td>约 0.414–0.732</td></tr><tr><td>CN 8 · 立方</td><td>0.732</td><td>约 0.732–1</td></tr></tbody></table><p>这个滑块不会根据半径比“预测”晶体结构。所选 CN 始终固定，只显示硬球在相同局部坐标中是否接触、留空或重叠。传统区间忽略了离子可极化性、共价成键、价态、压力以及结构畸变，实际材料可能不遵循简单规则。</p></details>';
    }
    $('cx-results').innerHTML = results; $('cx-details').innerHTML = detail;
  }
  function draw() {
    const canvas = $('cx-canvas');
    if (!canvas || !scene) return;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    const ctx = canvas.getContext('2d'), dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    const allPoints = scene.atoms.map(a => a.position).concat((scene.frames || []).flat());
    if (!allPoints.length) return;
    const bounds = [0, 1, 2].map(i => [Math.min(...allPoints.map(p => p[i])), Math.max(...allPoints.map(p => p[i]))]);
    const origin = bounds.map(([a, b]) => (a + b) / 2);
    const extent = Math.max(.7, ...allPoints.map(p => norm(sub(p, origin)))) + (state.tab === 'radius' ? 1 : .13);
    const scale = Math.min(w / 2.65, (h - 135) / 2.25) / extent * state.camera.zoom;
    const cam = state.camera;
    const project = point => {
      const p = sub(point, origin), x = Math.cos(cam.yaw) * p[0] - Math.sin(cam.yaw) * p[1], y = Math.sin(cam.yaw) * p[0] + Math.cos(cam.yaw) * p[1];
      return { x: w * .51 + x * scale, y: h * .56 - (Math.cos(cam.pitch) * p[2] + Math.sin(cam.pitch) * y) * scale, depth: -Math.cos(cam.pitch) * y + Math.sin(cam.pitch) * p[2] };
    };
    const line = (a, b, color, width = 1, dash = false) => {
      const p = project(a), q = project(b); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash ? [4, 4] : []); ctx.stroke(); ctx.setLineDash([]);
    };
    (scene.frames || []).forEach(edge => line(edge[0], edge[1], '#829ca879', 1));
    if (scene.polyhedron?.vertices?.length) {
      const poly = scene.polyhedron;
      (poly.faces || []).slice().sort((a, b) => a.reduce((s, i) => s + project(poly.vertices[i]).depth, 0) / a.length - b.reduce((s, i) => s + project(poly.vertices[i]).depth, 0) / b.length).forEach(face => {
        const pts = face.map(i => project(poly.vertices[i])); if (!pts.length) return;
        ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y)); ctx.closePath(); ctx.fillStyle = '#217b7819'; ctx.fill(); ctx.strokeStyle = '#217b7859'; ctx.lineWidth = .8; ctx.stroke();
      });
      (poly.edges || []).forEach(([i, j]) => line(poly.vertices[i], poly.vertices[j], '#217b788c', 1.2));
    }
    (scene.shellLines || []).forEach(edge => line(edge[0], edge[1], '#b16a2369', .8, true));
    const atoms = scene.atoms.slice().sort((a, b) => state.tab === 'radius' && Boolean(a.selected) !== Boolean(b.selected) ? Number(Boolean(a.selected)) - Number(Boolean(b.selected)) : project(a.position).depth - project(b.position).depth);
    hits = [];
    atoms.forEach(atom => {
      const p = project(atom.position), baseRadius = Number(atom.radius) || .12;
      const r = state.tab === 'radius' ? Math.max(2, baseRadius * scale) : atom.empty ? 5 : atom.lattice ? 4.1 : Math.max(3.2, baseRadius * scale * state.radiusScale);
      ctx.globalAlpha = state.tab === 'radius' && !atom.selected ? .48 : atom.context ? .24 : atom.boundary && !atom.shell ? .55 : 1;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      if (atom.empty) { ctx.setLineDash([2, 2]); ctx.strokeStyle = '#b16a23'; ctx.lineWidth = 1.3; ctx.stroke(); ctx.setLineDash([]); }
      else {
        const color = atom.color || palette[0];
        if (r > 5) { const gradient = ctx.createRadialGradient(p.x - r * .28, p.y - r * .35, r * .04, p.x, p.y, r); gradient.addColorStop(0, '#f4ffff'); gradient.addColorStop(.3, color); gradient.addColorStop(1, color); ctx.fillStyle = gradient; } else ctx.fillStyle = color;
        ctx.fill(); ctx.strokeStyle = '#17384b26'; ctx.lineWidth = .65; ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (atom.selected) { ctx.beginPath(); ctx.arc(p.x, p.y, r + 4, 0, Math.PI * 2); ctx.strokeStyle = '#b16a23'; ctx.lineWidth = 2; ctx.stroke(); }
      if (state.tab === 'structures' && atom.atomIndex != null && !atom.empty) hits.push({ x: p.x, y: p.y, r, index: atom.atomIndex });
    });
    if (scene.axes && state.frame) {
      const start = [0, 0, 0];
      scene.axes.forEach((v, i) => { const end = times(v, 1.06), a = project(start), b = project(end); line(start, end, '#637b9a', 1.4); const theta = Math.atan2(b.y - a.y, b.x - a.x); ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - 6 * Math.cos(theta - .4), b.y - 6 * Math.sin(theta - .4)); ctx.lineTo(b.x - 6 * Math.cos(theta + .4), b.y - 6 * Math.sin(theta + .4)); ctx.closePath(); ctx.fillStyle = '#637b9a'; ctx.fill(); ctx.font = '11px system-ui'; ctx.fillText(['a', 'b', 'c'][i], b.x + 6, b.y - 4); });
    }
  }
  function scheduleDraw() { if (!redrawFrame) redrawFrame = requestAnimationFrame(() => { redrawFrame = 0; draw(); }); }
  function attachCanvas() {
    const canvas = $('cx-canvas');
    canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY }; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', e => { if (!drag) return; state.camera.yaw += (e.clientX - drag.x) * .007; state.camera.pitch = clamp(state.camera.pitch + (e.clientY - drag.y) * .007, -1.5, 1.5); drag.x = e.clientX; drag.y = e.clientY; state.view = 'free'; setViewButtons(); scheduleDraw(); });
    canvas.addEventListener('pointerup', e => {
      if (drag && state.tab === 'structures' && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 5) {
        const rect = canvas.getBoundingClientRect(), x = e.clientX - rect.left, y = e.clientY - rect.top;
        const hit = hits.slice().reverse().find(h => Math.hypot(x - h.x, y - h.y) <= h.r + 5);
        if (hit) { state.selected = hit.index; $('cx-atom').value = String(state.selected); updateScene(); }
      }
      drag = null;
    });
    canvas.addEventListener('pointercancel', () => { drag = null; });
    canvas.addEventListener('wheel', e => { e.preventDefault(); state.camera.zoom = clamp(state.camera.zoom * Math.exp(-e.deltaY * .001), .55, 2); scheduleDraw(); }, { passive: false });
    canvas.addEventListener('keydown', e => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-'].includes(e.key)) return;
      e.preventDefault(); if (e.key === 'ArrowLeft') state.camera.yaw -= .12; if (e.key === 'ArrowRight') state.camera.yaw += .12;
      if (e.key === 'ArrowUp') state.camera.pitch = clamp(state.camera.pitch + .12, -1.5, 1.5); if (e.key === 'ArrowDown') state.camera.pitch = clamp(state.camera.pitch - .12, -1.5, 1.5);
      if (e.key === '+' || e.key === '=') state.camera.zoom = clamp(state.camera.zoom * 1.1, .55, 2); if (e.key === '-') state.camera.zoom = clamp(state.camera.zoom / 1.1, .55, 2); state.view = 'free'; setViewButtons(); scheduleDraw();
    });
  }
  function setViewButtons() { root.querySelectorAll('[data-cx-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.cxView === state.view))); }
  function setTab(id, structure) {
    if (!tabs.some(t => t.id === id)) return;
    state.tab = id;
    if (structure && C.getStructure(structure)) { state.structure = structure; state.selected = 0; }
    state.camera = { yaw: -.55, pitch: .48, zoom: 1 }; state.view = 'perspective'; render();
  }
  root.addEventListener('click', e => {
    const button = e.target.closest('button'); if (!button) return;
    if (button.dataset.cxTab) { setTab(button.dataset.cxTab); $('cx-tab-' + state.tab).focus({ preventScroll: true }); }
    else if (button.hasAttribute('data-cx-next')) { const next = tabs[(tabs.findIndex(t => t.id === state.tab) + 1) % tabs.length]; setTab(next.id); root.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); }
    else if (button.dataset.cxSet) { const key = button.dataset.cxSet; state[key] = ['repeats', 'cn'].includes(key) ? Number(button.dataset.value) : button.dataset.value; if (key === 'cn') state.ratio = C.radiusSites.find(r => r.coordination === state.cn).criticalRatio; render(); }
    else if (button.dataset.cxView) { state.view = button.dataset.cxView === 'reset' ? 'perspective' : button.dataset.cxView; state.camera = state.view === 'top' ? { yaw: 0, pitch: Math.PI / 2, zoom: 1 } : state.view === 'front' ? { yaw: 0, pitch: 0, zoom: 1 } : { yaw: -.55, pitch: .48, zoom: 1 }; setViewButtons(); draw(); }
    else if (button.id === 'cx-critical') { state.ratio = C.radiusSites.find(r => r.coordination === state.cn).criticalRatio; $('cx-ratio').value = Math.round(state.ratio * 1000); $('cx-ratio-value').textContent = state.ratio.toFixed(3); updateScene(); }
    else if (button.id === 'cx-point-group') { const s = C.getStructure(state.structure); document.dispatchEvent(new CustomEvent('symmetry-atlas-select', { detail: { hm: s.pointGroup } })); location.hash = 'atlas'; }
  });
  root.addEventListener('change', e => {
    const input = e.target;
    if (input.dataset.cxCheck) { state[input.dataset.cxCheck] = input.checked; updateScene(); return; }
    const ids = { 'cx-bravais': 'bravais', 'cx-structure': 'structure', 'cx-atom': 'selected', 'cx-hole-kind': 'holeKind', 'cx-hole-site': 'holeIndex', 'cx-occupancy': 'occupancy', 'cx-host-role': 'role' };
    if (!ids[input.id]) return;
    state[ids[input.id]] = ['cx-atom', 'cx-hole-site'].includes(input.id) ? Number(input.value) : input.value;
    if (input.id === 'cx-structure') { state.selected = 0; state.camera.zoom = 1; render(); }
    else if (input.id === 'cx-hole-kind') { state.holeIndex = 0; if (state.holeKind === 'tetrahedral' && state.occupancy === 'third') state.occupancy = 'empty'; render(); }
    else if (input.id === 'cx-occupancy') { state.holeIndex = 0; render(); }
    else updateScene();
  });
  root.addEventListener('input', e => {
    if (e.target.id === 'cx-radius-scale') { state.radiusScale = Number(e.target.value) / 100; $('cx-radius-value').textContent = e.target.value + '%'; draw(); }
    else if (e.target.id === 'cx-layers') { state.layers = Number(e.target.value); $('cx-layer-value').textContent = state.layers; updateScene(); }
    else if (e.target.id === 'cx-ratio') { state.ratio = Number(e.target.value) / 1000; $('cx-ratio-value').textContent = state.ratio.toFixed(3); updateScene(); }
  });
  root.addEventListener('keydown', e => {
    const button = e.target.closest('[role=tab]'); if (!button || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault(); const i = tabs.findIndex(t => t.id === state.tab), next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length; setTab(tabs[next].id); $('cx-tab-' + state.tab).focus({ preventScroll: true });
  });
  document.addEventListener('symmetry-crystal-open', e => setTab(e.detail?.tab || 'structures', e.detail?.structure));
  new ResizeObserver(scheduleDraw).observe(root);
  const page = $('page-crystal');
  if (page) new MutationObserver(() => { if (page.hidden) { cancelAnimationFrame(redrawFrame); redrawFrame = 0; } else scheduleDraw(); }).observe(page, { attributes: true, attributeFilter: ['hidden'] });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(redrawFrame); redrawFrame = 0; } else scheduleDraw(); });
  document.addEventListener('symmetry-language-change', scheduleDraw);
  render();
})();
