/* Ideal periodic teaching prototypes. All lengths use arbitrary units, a=1.
 * The supplied L05 lecture supplies the structural descriptions and page map.
 * Fractional coordinates of less elementary prototypes were checked against
 * the AFLOW primary prototype library; each definition includes its source.
 * These are geometric examples, not measured CIFs or stability predictions.
 */
(function (root, factory) {
  'use strict';
  const math = typeof module === 'object' && module.exports ? require('./math.js') : root.SymmetryMath;
  const api = factory(math);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SymmetryCrystals = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (M) {
  'use strict';
  if (!M) throw new Error('SymmetryCrystals requires SymmetryMath.');
  const EPS = 1e-9, SQRT3 = Math.sqrt(3), IDEAL_HCP = Math.sqrt(8 / 3);
  const identityCenter = [[0, 0, 0]];
  const centeringCoordinates = {
    P: identityCenter,
    I: [[0, 0, 0], [0.5, 0.5, 0.5]],
    F: [[0, 0, 0], [0, 0.5, 0.5], [0.5, 0, 0.5], [0.5, 0.5, 0]],
    C: [[0, 0, 0], [0.5, 0.5, 0]],
    // Obverse R centering in hexagonal axes (a,b angle 120 degrees).
    R: [[0, 0, 0], [2 / 3, 1 / 3, 1 / 3], [1 / 3, 2 / 3, 2 / 3]]
  };
  const cubic = () => [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const tetragonal = c => [[1, 0, 0], [0, 1, 0], [0, 0, c]];
  const hexagonal = c => [[1, 0, 0], [-0.5, SQRT3 / 2, 0], [0, 0, c]];
  const wrap = value => { const result = ((value % 1) + 1) % 1; return result < EPS || result > 1 - EPS ? 0 : result; };
  const wrapFrac = frac => frac.map(wrap);
  const fracKey = (species, frac) => species + ':' + wrapFrac(frac).map(value => Math.round(value * 1e8)).join(',');
  const colors = { Po: '#6a7c87', Fe: '#b16a23', Cu: '#3262a6', Mg: '#217b78', C: '#6a7c87', Na: '#3262a6', Cl: '#217b78', Cs: '#b16a23', Ni: '#3262a6', As: '#217b78', Zn: '#3262a6', S: '#b16a23', Cd: '#3262a6', I: '#b16a23', Ti: '#3262a6', O: '#c7615c', Ca: '#3262a6', F: '#217b78', Li: '#3262a6', Cr: '#3262a6', X: '#217b78' };

  function validateVector(vector) {
    if (!Array.isArray(vector) || vector.length !== 3 || !vector.every(Number.isFinite)) throw new TypeError('A vector must contain three finite coordinates.');
  }
  function basisOf(value) {
    const vectors = Array.isArray(value) ? value : value && value.basis;
    if (!Array.isArray(vectors) || vectors.length !== 3) throw new TypeError('Three independent lattice vectors are required.');
    vectors.forEach(validateVector);
    if (Math.abs(M.dot(vectors[0], M.cross(vectors[1], vectors[2]))) < EPS) throw new RangeError('Lattice basis must be independent.');
    return vectors;
  }
  function toCartesian(value, frac) {
    const vectors = basisOf(value); validateVector(frac);
    return [0, 1, 2].map(row => vectors.reduce((sum, vector, index) => sum + frac[index] * vector[row], 0));
  }
  function inverseRows(value) {
    const [a, b, c] = basisOf(value), volume = M.dot(a, M.cross(b, c));
    return [M.cross(b, c), M.cross(c, a), M.cross(a, b)].map(row => M.scale(row, 1 / volume));
  }
  function toFractional(value, point) { validateVector(point); return inverseRows(value).map(row => M.dot(row, point)); }
  function cellVolume(value) { const [a, b, c] = basisOf(value); return Math.abs(M.dot(a, M.cross(b, c))); }
  function getCenterings(symbol) {
    if (!centeringCoordinates[symbol]) throw new RangeError('Unsupported centering: ' + symbol);
    return centeringCoordinates[symbol].map(frac => frac.slice());
  }
  function primitiveBasis(value, centering) {
    const vectors = basisOf(value);
    const coefficients = {
      P: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
      I: [[-0.5, 0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, -0.5]],
      F: [[0, 0.5, 0.5], [0.5, 0, 0.5], [0.5, 0.5, 0]],
      C: [[0.5, 0.5, 0], [-0.5, 0.5, 0], [0, 0, 1]],
      R: [[2 / 3, 1 / 3, 1 / 3], [-1 / 3, 1 / 3, 1 / 3], [-1 / 3, -2 / 3, 1 / 3]]
    }[centering];
    if (!coefficients) throw new RangeError('Unsupported centering: ' + centering);
    return coefficients.map(frac => toCartesian(vectors, frac));
  }

  function expandMotif(motif, centerings) {
    const atoms = [], seen = new Set(), counts = {};
    for (const [species, frac] of motif) for (const translation of centerings) {
      const position = wrapFrac(M.add(frac, translation)), key = fracKey(species, position);
      if (seen.has(key)) continue;
      seen.add(key); counts[species] = (counts[species] || 0) + 1;
      atoms.push({ id: species + counts[species], species, frac: position, color: colors[species] || '#6a7c87', radius: 0.1 });
    }
    return atoms;
  }
  function countSpecies(atoms) { return atoms.reduce((counts, atom) => { counts[atom.species] = (counts[atom.species] || 0) + 1; return counts; }, {}); }
  function define(spec) {
    const centering = spec.centering || 'P', centerings = getCenterings(centering);
    const atoms = expandMotif(spec.motif, centerings);
    const result = { ...spec, centering, centerings, centeringMultiplicity: centerings.length, atoms, primitiveBasis: primitiveBasis(spec.basis, centering), cellAtomCount: atoms.length, primitiveAtomCount: atoms.length / centerings.length, speciesCounts: countSpecies(atoms), parameters: { a: 1, ...(spec.parameters || {}) }, units: '任意单位；不是实验测量', shellRatio: spec.shellRatio || 1.12 };
    delete result.motif;
    if (!Number.isInteger(result.primitiveAtomCount)) throw new Error('Atom count is incompatible with cell centering: ' + spec.id);
    return result;
  }

  const u = 0.305, anataseZ = 0.083, anataseC = 2.515;
  const structureSpecs = [
    { id: 'sc', name: '简单立方 SC', formula: 'Po', basis: cubic(), centering: 'P', motif: [['Po', [0, 0, 0]]], spaceGroup: 'Pm3̄m', spaceGroupNumber: 221, pointGroup: 'm-3m', description: '每个原胞一个原子，六个最近邻；立方边方向接触。', lecturePages: [12, 13, 14, 35], packingFactor: Math.PI / 6, hardSphereRadius: 0.5, idealization: 'a=1 的等径硬球示意；不是 α-Po 的测量值。' },
    { id: 'bcc', name: '体心立方 BCC', formula: 'Fe', basis: cubic(), centering: 'I', motif: [['Fe', [0, 0, 0]]], spaceGroup: 'Im3̄m', spaceGroupNumber: 229, pointGroup: 'm-3m', description: '传统立方胞含两个原子，原胞一个；最近邻八个，沿体对角线接触。BCC不是密堆积。', lecturePages: [12, 35], packingFactor: SQRT3 * Math.PI / 8, hardSphereRadius: SQRT3 / 4, idealization: '理想 BCC 几何，a=1；不是 α-Fe 实验结构。' },
    { id: 'fcc', name: '面心立方 FCC / CCP', formula: 'Cu', basis: cubic(), centering: 'F', motif: [['Cu', [0, 0, 0]]], spaceGroup: 'Fm3̄m', spaceGroupNumber: 225, pointGroup: 'm-3m', description: '传统立方胞四原子，原胞一个；十二配位，沿面对角线接触；[111] 方向 ABC 堆垛。', lecturePages: [12, 15, 16, 35], packingFactor: Math.PI / (3 * Math.sqrt(2)), hardSphereRadius: Math.sqrt(2) / 4, idealization: 'a=1 等径密堆积示意；FCC 点阵不等于所有采用 FCC 点阵的晶体结构。' },
    { id: 'hcp', name: '六方密堆积 HCP', formula: 'Mg', basis: hexagonal(IDEAL_HCP), motif: [['Mg', [1 / 3, 2 / 3, 0.25]], ['Mg', [2 / 3, 1 / 3, 0.75]]], spaceGroup: 'P6₃/mmc', spaceGroupNumber: 194, pointGroup: '6/mmm', description: 'ABAB 堆垛，理想十二配位。P 型平行六面体原胞含两个原子；常见六棱柱示意覆盖三个原胞，含六个原子。', lecturePages: [12, 17, 18, 19, 36], parameters: { cOverA: IDEAL_HCP }, hexPrismAtomCount: 6, packingFactor: Math.PI / (3 * Math.sqrt(2)), hardSphereRadius: 0.5, idealization: '理想 c/a=√(8/3)，a=1；真实 HCP 材料可以偏离此比值。' },
    { id: 'diamond', name: '金刚石结构', formula: 'C', basis: cubic(), centering: 'F', motif: [['C', [0, 0, 0]], ['C', [0.25, 0.25, 0.25]]], spaceGroup: 'Fd3̄m', spaceGroupNumber: 227, pointGroup: 'm-3m', description: 'FCC 点阵加两个同类型原子的基元；传统胞八原子、原胞两个；四面体配位。', lecturePages: [36, 37], idealization: '理想金刚石几何，a=1；C、Si、Ge 等可共享结构类型，但电子性质不同。' },
    { id: 'graphite', name: '石墨 AB 层状结构', formula: 'C', basis: hexagonal(2.72), motif: [['C', [0, 0, 0.25]], ['C', [0, 0, 0.75]], ['C', [1 / 3, 2 / 3, 0.25]], ['C', [2 / 3, 1 / 3, 0.75]]], spaceGroup: 'P6₃/mmc', spaceGroupNumber: 194, pointGroup: '6/mmm', description: '每个碳有三个同层近邻，组成蜂窝网；两层基元形成 AB 堆垛。与同空间群 HCP 的基元不同。', lecturePages: [37], parameters: { cOverA: 2.72 }, idealization: 'a=1、c/a=2.72 的示意；最近配位是平面三配位，不计远处层间原子。' },
    { id: 'nacl', name: '岩盐 NaCl', formula: 'NaCl', basis: cubic(), centering: 'F', motif: [['Na', [0, 0, 0]], ['Cl', [0.5, 0, 0]]], spaceGroup: 'Fm3̄m', spaceGroupNumber: 225, pointGroup: 'm-3m', description: '两个互相穿插的 FCC 子结构；阴离子 CCP 的八面体位全部占据；Na 和 Cl 均为六配位。', lecturePages: [33, 39, 53], idealization: 'a=1 的理想岩盐原型；球的显示大小不代表测得离子半径。' },
    { id: 'cscl', name: 'CsCl 原型', formula: 'CsCl', basis: cubic(), motif: [['Cs', [0, 0, 0]], ['Cl', [0.5, 0.5, 0.5]]], spaceGroup: 'Pm3̄m', spaceGroupNumber: 221, pointGroup: 'm-3m', description: '两种不同离子占立方角与体心位置，八配位；Bravais 点阵是 P，不是 I，因为体心平移会交换种类。', lecturePages: [33], idealization: 'a=1 理想八配位原型，不是 BCC 单质点阵。' },
    { id: 'nias', name: 'NiAs 原型', formula: 'NiAs', basis: hexagonal(IDEAL_HCP), motif: [['Ni', [0, 0, 0]], ['Ni', [0, 0, 0.5]], ['As', [1 / 3, 2 / 3, 0.25]], ['As', [2 / 3, 1 / 3, 0.75]]], spaceGroup: 'P6₃/mmc', spaceGroupNumber: 194, pointGroup: '6/mmm', description: 'As 呈 HCP 型排列，全部八面体位由 Ni 占据；Ni 的六邻域是八面体，As 的六邻域是三角棱柱。', lecturePages: [40, 53, 60], parameters: { cOverA: IDEAL_HCP }, idealization: 'a=1、理想 HCP 轴比；NiAs 中不同中心的六配位多面体不同。', source: 'https://aflow.org/p/AB_hP4_194_c_a-001/' },
    { id: 'zincblende', name: '闪锌矿 Zinc blende', formula: 'ZnS', basis: cubic(), centering: 'F', motif: [['Zn', [0.25, 0.25, 0.25]], ['S', [0, 0, 0]]], spaceGroup: 'F4̄3m', spaceGroupNumber: 216, pointGroup: '-43m', description: 'S 的 CCP 型排列，半数四面体位由 Zn 占据；两种离子均四配位。几何位置与金刚石相似，种类区分降低对称性。', lecturePages: [33, 41, 42, 53], idealization: 'a=1 理想原型；不同原子类型不可作为同类点互换。' },
    { id: 'wurtzite', name: '纤锌矿 Wurtzite', formula: 'ZnS', basis: hexagonal(IDEAL_HCP), motif: [['Zn', [1 / 3, 2 / 3, 0]], ['Zn', [2 / 3, 1 / 3, 0.5]], ['S', [1 / 3, 2 / 3, 0.375]], ['S', [2 / 3, 1 / 3, 0.875]]], spaceGroup: 'P6₃mc', spaceGroupNumber: 186, pointGroup: '6mm', description: 'HCP 型阴离子排列，半数四面体位占据；ZnS 双层 ABAB。无反演中心但有镜面，因此非中心对称、非手性。', lecturePages: [43, 47, 48, 49, 53], parameters: { cOverA: IDEAL_HCP, u: 3 / 8 }, idealization: '理想 c/a=√(8/3)、u=3/8，a=1；不是实验坐标。', source: 'https://aflow.org/p/AB_hP4_186_b_b-001/' },
    { id: 'cdi2', name: 'CdI₂ 2H 型', formula: 'CdI₂', basis: hexagonal(1.62), motif: [['Cd', [0, 0, 0]], ['I', [1 / 3, 2 / 3, 0.25]], ['I', [2 / 3, 1 / 3, 0.75]]], spaceGroup: 'P3̄m1', spaceGroupNumber: 164, pointGroup: '-3m', description: '一半八面体位占据，形成边共享 CdI₆ 层；间隔的空位层产生层间间隙。此处只展示一种 2H 多型。', lecturePages: [54, 56], parameters: { cOverA: 1.62, z: 0.25 }, idealization: 'a=1、c/a=1.62、z=1/4 的原型示意；不复现材料的全部多型。', source: 'https://aflow.org/p/AB2_hP3_164_a_d-001/' },
    { id: 'cdcl2', name: 'CdCl₂ 3R 型', formula: 'CdCl₂', basis: hexagonal(4.5), centering: 'R', motif: [['Cd', [0, 0, 0]], ['Cl', [0, 0, 0.25]], ['Cl', [0, 0, 0.75]]], spaceGroup: 'R3̄m', spaceGroupNumber: 166, pointGroup: '-3m', description: 'CCP 型卤素排列，半数八面体位占据；CdCl₆ 层形成 3R 堆垛。六方轴传统 R 胞九原子，菱方原胞三个。', lecturePages: [55, 56], parameters: { cOverA: 4.5, z: 0.25 }, idealization: 'a=1、c/a=4.5、z=1/4 的示意；R 中心化与真实原胞明确区分。', source: 'https://aflow.org/p/AB2_hR3_166_a_c-004/' },
    { id: 'rutile', name: '金红石 Rutile', formula: 'TiO₂', basis: tetragonal(0.645), motif: [['Ti', [0, 0, 0]], ['Ti', [0.5, 0.5, 0.5]], ['O', [u, u, 0]], ['O', [-u, -u, 0]], ['O', [0.5 + u, 0.5 - u, 0.5]], ['O', [0.5 - u, 0.5 + u, 0.5]]], spaceGroup: 'P4₂/mnm', spaceGroupNumber: 136, pointGroup: '4/mmm', description: '畸变 TiO₆ 八面体形成边共享直链；Ti 六配位，O 三配位。最短四根与稍长两根共同构成第一配位壳。', lecturePages: [57, 58, 59, 60], parameters: { cOverA: 0.645, u }, idealization: 'a=1、c/a=0.645、u=0.305 示意；氧网为 eutactic 型，不能当作严格等径 HCP 硬球。', source: 'https://aflow.org/p/A2B_tP6_136_f_a-001/' },
    { id: 'anatase', name: '锐钛矿 Anatase', formula: 'TiO₂', basis: tetragonal(anataseC), centering: 'I', motif: [['Ti', [0, 0.75, 0.125]], ['Ti', [0.5, 0.75, 0.375]], ['O', [0, 0.25, anataseZ]], ['O', [0.5, 0.25, anataseZ - 0.25]], ['O', [0, 0.75, -anataseZ]], ['O', [0.5, 0.75, 0.25 - anataseZ]]], spaceGroup: 'I4₁/amd', spaceGroupNumber: 141, pointGroup: '4/mmm', description: '同为 TiO₂，TiO₆ 形成不同的边共享/锯齿连接；传统 I 胞十二原子，原胞六个。', lecturePages: [61], parameters: { cOverA: anataseC, z: anataseZ }, idealization: 'a=1、c/a=2.515、z=0.083 示意；使用 AFLOW 已纠正的 origin choice 2 坐标关系，非测量 CIF。', source: 'https://aflow.org/p/A2B_tI12_141_e_a-001/' },
    { id: 'fluorite', name: '萤石 Fluorite', formula: 'CaF₂', basis: cubic(), centering: 'F', motif: [['Ca', [0, 0, 0]], ['F', [0.25, 0.25, 0.25]], ['F', [0.75, 0.75, 0.75]]], spaceGroup: 'Fm3̄m', spaceGroupNumber: 225, pointGroup: 'm-3m', description: '这里是 Ca 阳离子构成 FCC 型阵列，全部四面体位由 F 占据；Ca 八配位，F 四配位。', lecturePages: [63], idealization: 'a=1 理想几何；不能把所有离子结构都称为阴离子密堆积。' },
    { id: 'antifluorite', name: '反萤石 Antifluorite', formula: 'Li₂O', basis: cubic(), centering: 'F', motif: [['O', [0, 0, 0]], ['Li', [0.25, 0.25, 0.25]], ['Li', [0.75, 0.75, 0.75]]], spaceGroup: 'Fm3̄m', spaceGroupNumber: 225, pointGroup: 'm-3m', description: '与萤石的阳/阴离子位置角色反转；O 八配位，Li 四配位。anti 在此指种类位置交换，不表示反演或另一种手性。', lecturePages: [64], idealization: 'a=1 理想反萤石原型；只比较几何占位，不模拟化学变换。' }
  ];

  const structures = structureSpecs.map(define);
  const getStructure = id => structures.find(structure => structure.id === id) || null;
  function resolve(value) {
    const structure = typeof value === 'string' ? getStructure(value) : value;
    if (!structure || !Array.isArray(structure.atoms)) throw new RangeError('Unknown crystal structure.');
    basisOf(structure); return structure;
  }
  function primitiveStructure(value) {
    const structure = resolve(value), vectors = structure.primitiveBasis || primitiveBasis(structure.basis, structure.centering);
    const seen = new Set(), atoms = [];
    for (const atom of structure.atoms) {
      const frac = wrapFrac(toFractional(vectors, toCartesian(structure, atom.frac))), key = fracKey(atom.species, frac);
      if (seen.has(key)) continue;
      seen.add(key); atoms.push({ ...atom, frac });
    }
    return { ...structure, name: structure.name + ' · 原胞', basis: vectors.map(vector => vector.slice()), primitiveBasis: vectors.map(vector => vector.slice()), atoms, centering: 'P', sourceCentering: structure.sourceCentering || structure.centering, centerings: getCenterings('P'), centeringMultiplicity: 1, cellAtomCount: atoms.length, primitiveAtomCount: atoms.length, speciesCounts: countSpecies(atoms), cellMode: 'primitive' };
  }
  function sampleStructure(value, repeats = [1, 1, 1]) {
    const structure = resolve(value);
    if (!Array.isArray(repeats) || repeats.length !== 3 || !repeats.every(number => Number.isSafeInteger(number) && number > 0)) throw new RangeError('Repeat counts must be three positive integers.');
    const atoms = [];
    for (let i = 0; i < repeats[0]; i++) for (let j = 0; j < repeats[1]; j++) for (let k = 0; k < repeats[2]; k++) {
      structure.atoms.forEach((atom, atomIndex) => {
        const translation = [i, j, k], frac = M.add(atom.frac, translation);
        atoms.push({ ...atom, id: atom.id + '@' + translation.join(','), atomIndex, translation, frac, position: toCartesian(structure, frac) });
      });
    }
    return { atoms, cellVectors: structure.basis.map((vector, index) => M.scale(vector, repeats[index])), repeats: repeats.slice(), structure };
  }

  function neighborsAt(value, centerFrac, cutoff, options = {}) {
    const structure = resolve(value); validateVector(centerFrac);
    if (!Number.isFinite(cutoff) || cutoff <= 0) throw new RangeError('Neighbor cutoff must be finite and positive.');
    const inverse = inverseRows(structure), center = toCartesian(structure, centerFrac), result = [];
    structure.atoms.forEach((atom, atomIndex) => {
      if (options.species && atom.species !== options.species) return;
      const delta = M.subtract(atom.frac, centerFrac);
      // ||B delta||<=r implies |delta_i|<=r||row_i(B^-1)||. These
      // bounds cover every periodic image in the sphere, even in skew cells.
      const bounds = inverse.map((row, index) => {
        const span = cutoff * M.norm(row);
        return [Math.ceil(-span - delta[index] - EPS), Math.floor(span - delta[index] + EPS)];
      });
      for (let i = bounds[0][0]; i <= bounds[0][1]; i++) for (let j = bounds[1][0]; j <= bounds[1][1]; j++) for (let k = bounds[2][0]; k <= bounds[2][1]; k++) {
        const translation = [i || 0, j || 0, k || 0], frac = M.add(atom.frac, translation), position = toCartesian(structure, frac), distance = M.distance(position, center);
        if (distance > EPS && distance <= cutoff + EPS) result.push({ atomIndex, species: atom.species, id: atom.id + '@' + translation.join(','), translation, frac, position, distance, color: atom.color, radius: atom.radius });
      }
    });
    return result.sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id));
  }
  function neighborsWithin(value, atomIndex, cutoff, options = {}) {
    const structure = resolve(value);
    if (!Number.isInteger(atomIndex) || atomIndex < 0 || atomIndex >= structure.atoms.length) throw new RangeError('Invalid center atom index.');
    return neighborsAt(structure, structure.atoms[atomIndex].frac, cutoff, options);
  }

  function polyhedronFor(vertices) {
    const points = vertices.map(point => point.slice()), faces = [], planes = new Set(), edges = new Set();
    if (points.length < 4) {
      const simpleEdges = points.length === 3 ? [[0, 1], [1, 2], [2, 0]] : points.length === 2 ? [[0, 1]] : [];
      return { vertices: points, faces: [], edges: simpleEdges };
    }
    for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) for (let k = j + 1; k < points.length; k++) {
      let normal = M.cross(M.subtract(points[j], points[i]), M.subtract(points[k], points[i]));
      if (M.norm(normal) < EPS) continue;
      normal = M.normalize(normal); let offset = M.dot(normal, points[i]);
      const deviations = points.map(point => M.dot(normal, point) - offset);
      if (deviations.some(value => value > 1e-7) && deviations.some(value => value < -1e-7)) continue;
      if (deviations.some(value => value > 1e-7)) { normal = M.scale(normal, -1); offset *= -1; }
      const key = normal.concat(offset).map(value => Math.round(value * 1e7)).join(',');
      if (planes.has(key)) continue;
      planes.add(key);
      const face = points.map((point, index) => Math.abs(M.dot(normal, point) - offset) < 1e-7 ? index : -1).filter(index => index !== -1);
      const centroid = M.scale(face.reduce((sum, index) => M.add(sum, points[index]), [0, 0, 0]), 1 / face.length);
      const u = M.normalize(M.subtract(points[face[0]], centroid)), v = M.cross(normal, u);
      face.sort((a, b) => Math.atan2(M.dot(M.subtract(points[a], centroid), v), M.dot(M.subtract(points[a], centroid), u)) - Math.atan2(M.dot(M.subtract(points[b], centroid), v), M.dot(M.subtract(points[b], centroid), u)));
      faces.push(face);
      face.forEach((index, n) => { const other = face[(n + 1) % face.length]; edges.add([Math.min(index, other), Math.max(index, other)].join(',')); });
    }
    return { vertices: points, faces, edges: Array.from(edges).map(key => key.split(',').map(Number)) };
  }
  function coordinationAt(value, frac, options = {}) {
    const structure = resolve(value); validateVector(frac);
    const shellRatio = options.shellRatio == null ? structure.shellRatio : options.shellRatio;
    if (!Number.isFinite(shellRatio) || shellRatio < 1) throw new RangeError('Shell ratio must be finite and at least one.');
    const center = { position: toCartesian(structure, frac), frac: frac.slice() };
    if (options.species && !structure.atoms.some(atom => atom.species === options.species)) return { center, distance: null, nearestDistance: null, distanceRange: [], count: 0, bySpecies: {}, neighbors: [], polyhedron: polyhedronFor([]), shellRatio };
    let cutoff = Math.min(...structure.basis.map(M.norm)) * 1.1, candidates = [];
    for (let attempt = 0; attempt < 8 && !candidates.length; attempt++) { candidates = neighborsAt(structure, frac, cutoff, options); if (!candidates.length) cutoff *= 2; }
    if (!candidates.length) throw new Error('Could not locate a periodic coordination shell.');
    const distance = candidates[0].distance;
    const neighbors = neighborsAt(structure, frac, distance * shellRatio + EPS, options);
    return { center, distance, nearestDistance: distance, distanceRange: [distance, neighbors[neighbors.length - 1].distance], count: neighbors.length, bySpecies: countSpecies(neighbors), neighbors, polyhedron: polyhedronFor(neighbors.map(neighbor => neighbor.position)), shellRatio, shellNote: '此理想模型的第一配位壳：距离不超过最短键长的 ' + shellRatio + ' 倍；用于包含畸变产生的分裂键长。' };
  }
  function coordination(value, atomIndex = 0, options = {}) {
    const structure = resolve(value);
    if (!Number.isInteger(atomIndex) || atomIndex < 0 || atomIndex >= structure.atoms.length) throw new RangeError('Invalid center atom index.');
    const result = coordinationAt(structure, structure.atoms[atomIndex].frac, options);
    result.center = { ...result.center, species: structure.atoms[atomIndex].species, atomIndex };
    return result;
  }

  const bravaisSpecs = [
    ['aP', '三斜', 'P', [[1, 0, 0], [0.23, 1.3, 0], [0.31, 0.41, 1.6]]],
    ['mP', '单斜', 'P', [[1, 0, 0], [0, 1.3, 0], [0.4, 0, 1.6]]],
    ['mC', '单斜', 'C', [[1, 0, 0], [0, 1.3, 0], [0.4, 0, 1.6]]],
    ['oP', '正交', 'P', [[1, 0, 0], [0, 1.3, 0], [0, 0, 1.6]]],
    ['oC', '正交', 'C', [[1, 0, 0], [0, 1.3, 0], [0, 0, 1.6]]],
    ['oI', '正交', 'I', [[1, 0, 0], [0, 1.3, 0], [0, 0, 1.6]]],
    ['oF', '正交', 'F', [[1, 0, 0], [0, 1.3, 0], [0, 0, 1.6]]],
    ['tP', '四方', 'P', tetragonal(1.6)], ['tI', '四方', 'I', tetragonal(1.6)],
    ['hP', '六方', 'P', hexagonal(1.6)], ['hR', '三方', 'R', hexagonal(2.2)],
    ['cP', '立方', 'P', cubic()], ['cI', '立方', 'I', cubic()], ['cF', '立方', 'F', cubic()]
  ];
  const centeringNames = { P: '简单', I: '体心', F: '面心', C: '底心', R: '菱方' };
  const bravais = bravaisSpecs.map(([id, system, centering, basis]) => ({ id, name: system + ' · ' + centeringNames[centering] + ' (' + id + ')', system, centering, basis, centerings: getCenterings(centering), primitiveBasis: primitiveBasis(basis, centering), centeringMultiplicity: getCenterings(centering).length, description: centering === 'R' ? '菱方点阵以六方轴 R 传统胞显示；包含三个原胞。' : centering === 'P' ? '简单传统胞本身是原胞。' : '传统胞便于表示对称性；实际原胞体积为传统胞的 1/' + getCenterings(centering).length + '。' }));

  const tetrahedral = [];
  for (const a of [0.25, 0.75]) for (const b of [0.25, 0.75]) for (const c of [0.25, 0.75]) tetrahedral.push([a, b, c]);
  const fccInterstitialSites = { tetrahedral, octahedral: [[0.5, 0.5, 0.5], [0.5, 0, 0], [0, 0.5, 0], [0, 0, 0.5]] };
  const tetraShell = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map(point => M.scale(point, 1 / Math.sqrt(2)));
  const octaShell = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map(point => M.scale(point, Math.sqrt(2)));
  const cubicShell = [];
  for (const a of [-1, 1]) for (const b of [-1, 1]) for (const c of [-1, 1]) cubicShell.push([a, b, c]);
  const radiusSites = [
    { id: 'tetrahedral', name: '四面体孔隙', coordination: 4, criticalRatio: Math.sqrt(3 / 2) - 1, formula: '√(3/2) − 1', shell: tetraShell },
    { id: 'octahedral', name: '八面体孔隙', coordination: 6, criticalRatio: Math.sqrt(2) - 1, formula: '√2 − 1', shell: octaShell },
    { id: 'cubic', name: '立方八配位孔隙', coordination: 8, criticalRatio: SQRT3 - 1, formula: '√3 − 1', shell: cubicShell }
  ].map(site => ({ ...site, sphereRadius: 1, polyhedron: polyhedronFor(site.shell), lecturePages: [20, 33], note: '等径、刚性、接触球的几何极限；不是实际化合物稳定性的充分条件。' }));

  function closePackedLayers(options = {}) {
    const sequence = options.sequence || 'ABCABC', count = options.layers == null ? 6 : options.layers, extent = options.extent == null ? 2 : options.extent, radius = options.radius == null ? 1 : options.radius;
    if (typeof sequence !== 'string' || sequence.length < 2 || !/^[ABC]+$/.test(sequence) || Array.from(sequence).some((label, i) => label === sequence[(i + 1) % sequence.length])) throw new RangeError('A periodic close-packed sequence must use A/B/C without adjacent identical layers.');
    if (!Number.isSafeInteger(count) || count < 1 || !Number.isSafeInteger(extent) || extent < 0) throw new RangeError('Layer count must be positive and extent nonnegative integers.');
    if (!Number.isFinite(radius) || radius <= 0) throw new RangeError('Sphere radius must be finite and positive.');
    const a = [2 * radius, 0, 0], b = [radius, SQRT3 * radius, 0], height = IDEAL_HCP * radius;
    const offsets = { A: [0, 0, 0], B: M.scale(M.add(a, b), 1 / 3), C: M.scale(M.add(a, b), 2 / 3) };
    const layerColors = { A: '#217b78', B: '#3262a6', C: '#b16a23' }, layers = [], atoms = [];
    for (let layer = 0; layer < count; layer++) {
      const label = sequence[layer % sequence.length], offset = offsets[label];
      layers.push({ index: layer, label, z: layer * height, offset: offset.slice() });
      for (let i = -extent; i <= extent; i++) for (let j = -extent; j <= extent; j++) {
        const position = M.add(M.add(M.scale(a, i), M.scale(b, j)), M.add(offset, [0, 0, layer * height]));
        atoms.push({ id: label + layer + ':' + i + ',' + j, species: 'X', position, radius, color: layerColors[label], layer, label, indices: [i, j] });
      }
    }
    return { atoms, layers, a, b, height, sequence, radius, packingFactor: Math.PI / (3 * Math.sqrt(2)), lecturePages: [16, 17, 18] };
  }

  return { structures, getStructure, primitiveStructure, sampleStructure, toCartesian, toFractional, cellVolume, getCenterings, primitiveBasis, neighborsWithin, coordination, coordinationAt, polyhedronFor, bravais, fccInterstitialSites, radiusSites, closePackedLayers };
});
