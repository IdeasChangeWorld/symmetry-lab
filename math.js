(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SymmetryMath = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const EPSILON = 1e-10;
  const identityMatrix = () => [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const add = (a, b) => a.map((v, i) => v + b[i]);
  const subtract = (a, b) => a.map((v, i) => v - b[i]);
  const scale = (a, s) => a.map(v => v * s);
  const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = a => Math.sqrt(dot(a, a));
  const distance = (a, b) => norm(subtract(a, b));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function normalize(a) {
    if (!Array.isArray(a) || a.length !== 3 || !a.every(Number.isFinite)) throw new TypeError('A vector must contain three finite numbers.');
    const length = norm(a);
    if (length < EPSILON) throw new RangeError('An axis or normal must be nonzero.');
    return scale(a, 1 / length);
  }

  const transpose = m => m[0].map((_, j) => m.map(row => row[j]));
  const applyMatrix = (m, p) => m.map(row => dot(row, p));
  const multiplyMatrices = (a, b) => a.map(row => transpose(b).map(column => dot(row, column)));
  const transformPoints = (points, matrix) => points.map(p => applyMatrix(matrix, p));
  const interpolateMatrices = (a, b, t) => a.map((row, i) => row.map((v, j) => v + (b[i][j] - v) * t));
  const matrixError = (a, b) => Math.max(...a.flatMap((row, i) => row.map((v, j) => Math.abs(v - b[i][j]))));

  function determinant(m) {
    return m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
      - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
      + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  }

  function rotationMatrix(axis, angle) {
    const [x, y, z] = normalize(axis);
    const c = Math.cos(angle), s = Math.sin(angle), d = 1 - c;
    return [
      [c + x * x * d, x * y * d - z * s, x * z * d + y * s],
      [y * x * d + z * s, c + y * y * d, y * z * d - x * s],
      [z * x * d - y * s, z * y * d + x * s, c + z * z * d]
    ];
  }

  function reflectionMatrix(normal) {
    const n = normalize(normal);
    return identityMatrix().map((row, i) => row.map((v, j) => v - 2 * n[i] * n[j]));
  }

  const inversionMatrix = () => [[-1, 0, 0], [0, -1, 0], [0, 0, -1]];

  function makeOperation(options) {
    const spec = options || {};
    const type = spec.type || 'E';
    if (!['E', 'rotation', 'reflection', 'inversion', 'improper', 'rotoinversion'].includes(type)) throw new RangeError('Unknown symmetry operation: ' + type);
    const rotational = ['rotation', 'improper', 'rotoinversion'].includes(type);
    const n = spec.n == null ? 2 : Number(spec.n);
    if (rotational && (!Number.isInteger(n) || n < 1)) throw new RangeError('Rotation order n must be a positive integer.');
    const axis = normalize(spec.axis || [0, 0, 1]);
    const normal = normalize(type === 'improper' ? axis : (spec.normal || [0, 0, 1]));
    const angle = rotational ? 2 * Math.PI / n : 0;
    const rotation = rotationMatrix(axis, angle);
    const identity = identityMatrix();
    let matrix, stageNames, label, second;
    if (type === 'E') { matrix = identity; stageNames = ['保持原位']; label = 'E'; }
    if (type === 'rotation') { matrix = rotation; stageNames = ['旋转']; label = 'C' + n; }
    if (type === 'reflection') { matrix = reflectionMatrix(normal); stageNames = ['镜映']; label = 'σ'; }
    if (type === 'inversion') { matrix = inversionMatrix(); stageNames = ['反演']; label = 'i'; }
    if (type === 'improper') {
      second = reflectionMatrix(axis);
      matrix = multiplyMatrices(second, rotation);
      stageNames = ['旋转', '垂直于轴的平面镜映'];
      label = 'S' + n;
    }
    if (type === 'rotoinversion') {
      second = inversionMatrix();
      matrix = multiplyMatrices(second, rotation);
      stageNames = ['旋转', '中心反演'];
      label = n + '\u0305';
    }

    function phase(t) {
      t = clamp(Number(t) || 0, 0, 1);
      const count = stageNames.length;
      const index = count === 2 && t >= 0.5 ? 1 : 0;
      const localT = count === 2 ? (index === 0 ? 2 * t : 2 * t - 1) : t;
      return { index, count, name: stageNames[index], localT };
    }

    function animate(t) {
      t = clamp(Number(t) || 0, 0, 1);
      if (t === 0) return identityMatrix();
      if (t === 1) return matrix.map(row => row.slice());
      if (type === 'E') return identityMatrix();
      if (type === 'rotation') return rotationMatrix(axis, angle * t);
      // Mirror and inversion animations interpolate coordinates. Their intermediate
      // states are teaching aids; only the endpoint is a distance-preserving operation.
      if (type === 'reflection' || type === 'inversion') return interpolateMatrices(identity, matrix, t);
      if (t <= 0.5) return rotationMatrix(axis, angle * t * 2);
      return multiplyMatrices(interpolateMatrices(identity, second, 2 * t - 1), rotation);
    }

    return { type, n, axis, normal, angle, label, matrix, stageNames, animate, phase };
  }

  function operationOrder(matrix, maxOrder = 24, tolerance = 1e-7) {
    const identity = identityMatrix();
    let result = identity;
    for (let order = 1; order <= maxOrder; order++) {
      result = multiplyMatrices(matrix, result);
      if (matrixError(result, identity) <= tolerance) return order;
    }
    return null;
  }

  function matchModel(model, matrix, tolerance = 1e-5) {
    if (!Number.isFinite(tolerance) || tolerance < 0) throw new RangeError('Matching tolerance must be a finite nonnegative number.');
    const atoms = model.atoms;
    const transformed = atoms.map(atom => applyMatrix(matrix, atom.position));
    const candidates = atoms.map((atom, i) => atoms.map((other, j) => ({ index: j, error: distance(transformed[i], other.position) }))
      .filter(candidate => atoms[candidate.index].element === atom.element && candidate.error <= tolerance)
      .sort((a, b) => a.error - b.error));
    // Augmenting paths enforce a one-to-one match, including repeated elements.
    // Atom IDs label trajectories but do not determine symmetry equivalence.
    const owner = Array(atoms.length).fill(-1);
    function assign(source, seen) {
      for (const candidate of candidates[source]) {
        const target = candidate.index;
        if (seen[target]) continue;
        seen[target] = true;
        if (owner[target] === -1 || assign(owner[target], seen)) {
          owner[target] = source;
          return true;
        }
      }
      return false;
    }
    const processingOrder = atoms.map((_, i) => i).sort((a, b) => candidates[a].length - candidates[b].length);
    for (const source of processingOrder) assign(source, Array(atoms.length).fill(false));
    const mapping = Array(atoms.length).fill(-1);
    owner.forEach((source, target) => { if (source !== -1) mapping[source] = target; });
    const unmatched = mapping.map((target, source) => target === -1 ? source : -1).filter(source => source !== -1);
    const fullMatch = unmatched.length === 0;
    const adjacency = atoms.map(() => Array(atoms.length).fill(false));
    for (const [a, b] of model.bonds || []) adjacency[a][b] = adjacency[b][a] = true;
    const preservesBonds = permutation => fullMatch && adjacency.every((row, source) => row.every((edge, other) => edge === adjacency[permutation[source]][permutation[other]]));
    let bondsPreserved = preservesBonds(mapping);
    // Coincident sites or a large tolerance can allow several spatial bijections.
    // Search those alternatives before rejecting a bond-preserving structure.
    if (fullMatch && !bondsPreserved) {
      const degree = adjacency.map(row => row.filter(Boolean).length);
      const graphCandidates = candidates.map((list, source) => list.filter(candidate => degree[source] === degree[candidate.index]));
      const graphOrder = atoms.map((_, i) => i).sort((a, b) => graphCandidates[a].length - graphCandidates[b].length || degree[b] - degree[a]);
      const alternate = Array(atoms.length).fill(-1);
      const used = Array(atoms.length).fill(false);
      function assignGraph(depth) {
        if (depth === atoms.length) return true;
        const source = graphOrder[depth];
        for (const { index: target } of graphCandidates[source]) {
          if (used[target] || adjacency[source][source] !== adjacency[target][target]) continue;
          if (alternate.some((mapped, other) => mapped !== -1 && adjacency[source][other] !== adjacency[target][mapped])) continue;
          alternate[source] = target;
          used[target] = true;
          if (assignGraph(depth + 1)) return true;
          alternate[source] = -1;
          used[target] = false;
        }
        return false;
      }
      if (assignGraph(0)) {
        alternate.forEach((target, source) => { mapping[source] = target; });
        bondsPreserved = true;
      }
    }
    const errors = mapping.map((target, source) => target === -1 ? null : distance(transformed[source], atoms[target].position));
    const matchedErrors = errors.filter(error => error !== null);
    const nearestErrors = atoms.map((atom, source) => {
      const sameElements = atoms.filter(other => other.element === atom.element);
      return Math.min(...sameElements.map(other => distance(transformed[source], other.position)));
    });
    const orthogonal = matrixError(multiplyMatrices(transpose(matrix), matrix), identityMatrix()) <= 1e-7;
    return {
      isSymmetry: fullMatch && orthogonal && bondsPreserved,
      mapping,
      maxError: matchedErrors.length ? Math.max(...matchedErrors) : null,
      rmsError: matchedErrors.length ? Math.sqrt(matchedErrors.reduce((s, error) => s + error * error, 0) / matchedErrors.length) : null,
      bestMaxError: nearestErrors.length ? Math.max(...nearestErrors) : 0,
      unmatched,
      errors,
      orthogonal,
      bondsPreserved
    };
  }

  const colors = { H: '#e3ebf8', O: '#f36d79', N: '#8398ff', C: '#8da5c4', F: '#69ddae', Xe: '#ba9cff', S: '#f4c55e', A: '#f36d79', B: '#6fc9ff', D: '#f4c55e', P: '#ffa365' };
  const radii = { H: 0.13, O: 0.22, N: 0.22, C: 0.22, F: 0.19, Xe: 0.29, S: 0.27, A: 0.2, B: 0.2, D: 0.2, P: 0.18 };
  const atom = (id, element, position) => ({ id, element, position, color: colors[element] || '#69ddae', radius: radii[element] || 0.2 });
  const tetrahedron = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map(p => scale(p, 1 / Math.sqrt(3)));
  const ring = Array.from({ length: 6 }, (_, i) => [1.5 * Math.cos(i * Math.PI / 3), 1.5 * Math.sin(i * Math.PI / 3), 0]);
  const models = [
    {
      id: 'water', name: '水分子', formula: 'H₂O', pointGroup: 'C₂v',
      description: '两个氢原子位于 xz 平面；z 轴是二重轴。绕 z 轴旋转 180° 后两个氢互换。',
      atoms: [atom('O', 'O', [0, 0, 0]), atom('H1', 'H', [0.92, 0, 0.6]), atom('H2', 'H', [-0.92, 0, 0.6])],
      bonds: [[0, 1], [0, 2]], recommended: { type: 'rotation', n: 2, axis: [0, 0, 1] }
    },
    {
      id: 'ammonia', name: '氨分子', formula: 'NH₃', pointGroup: 'C₃v',
      description: '三个氢构成三角形，氮位于三角形上方；绕 z 轴旋转 120° 后三个氢循环互换。',
      atoms: [atom('N', 'N', [0, 0, 0.35]), ...Array.from({ length: 3 }, (_, i) => atom('H' + (i + 1), 'H', [Math.cos(i * 2 * Math.PI / 3), Math.sin(i * 2 * Math.PI / 3), -0.4]))],
      bonds: [[0, 1], [0, 2], [0, 3]], recommended: { type: 'rotation', n: 3, axis: [0, 0, 1] }
    },
    {
      id: 'xef4', name: '四氟化氙', formula: 'XeF₄', pointGroup: 'D₄h',
      description: '四个氟位于 xy 平面的正方形顶点；具有四重轴、反演中心与水平镜面。',
      atoms: [atom('Xe', 'Xe', [0, 0, 0]), ...[[1.5, 0, 0], [0, 1.5, 0], [-1.5, 0, 0], [0, -1.5, 0]].map((p, i) => atom('F' + (i + 1), 'F', p))],
      bonds: [[0, 1], [0, 2], [0, 3], [0, 4]], recommended: { type: 'rotation', n: 4, axis: [0, 0, 1] }
    },
    {
      id: 'methane', name: '甲烷', formula: 'CH₄', pointGroup: 'T_d',
      description: '四个氢占据正四面体顶点；沿顶点方向有三重轴，并有四重旋转反演 4̄，也具有旋转镜映 S₄。',
      atoms: [atom('C', 'C', [0, 0, 0]), ...tetrahedron.map((p, i) => atom('H' + (i + 1), 'H', scale(p, 1.4)))],
      bonds: [[0, 1], [0, 2], [0, 3], [0, 4]], recommended: { type: 'rotation', n: 3, axis: [1, 1, 1] }
    },
    {
      id: 'sf6', name: '六氟化硫', formula: 'SF₆', pointGroup: 'O_h',
      description: '六个氟占据正八面体顶点；x、y、z 方向均为四重轴，并有反演中心。',
      atoms: [atom('S', 'S', [0, 0, 0]), ...[[1.5, 0, 0], [-1.5, 0, 0], [0, 1.5, 0], [0, -1.5, 0], [0, 0, 1.5], [0, 0, -1.5]].map((p, i) => atom('F' + (i + 1), 'F', p))],
      bonds: [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6]], recommended: { type: 'rotation', n: 4, axis: [0, 0, 1] }
    },
    {
      id: 'hexagon', name: '正六边形', formula: '六个等价点', pointGroup: 'D₆h',
      description: 'xy 平面中的六个等价顶点；绕 z 轴旋转 60° 后顶点循环互换。',
      atoms: ring.map((p, i) => atom('C' + (i + 1), 'C', p)),
      bonds: ring.map((_, i) => [i, (i + 1) % 6]), recommended: { type: 'rotation', n: 6, axis: [0, 0, 1] }
    },
    {
      id: 'asymmetric', name: '四种点的四面体', formula: 'A · B · C · D', pointGroup: 'C₁',
      description: 'A、B、C、D 代表四种不同的点类型，并非用于追踪的编号；即使轮廓重合，交换不同类型也不构成此模型的对称操作。',
      atoms: tetrahedron.map((p, i) => atom(['A', 'B', 'C', 'D'][i], ['A', 'B', 'C', 'D'][i], scale(p, 1.4))),
      bonds: [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]], recommended: { type: 'rotation', n: 3, axis: [1, 1, 1] }
    },
    {
      id: 'probe', name: '单个示踪点', formula: 'P', pointGroup: '示踪模型',
      description: '一般位置上的示踪点用于观察坐标变化；判断整体对称性时请切换到分子或多点模型。',
      atoms: [atom('P', 'P', [1.15, 0.45, 0.75])], bonds: [],
      recommended: { type: 'rotoinversion', n: 4, axis: [0, 0, 1] }
    }
  ];

  return {
    EPSILON, identityMatrix, add, subtract, scale, dot, cross, norm, normalize, distance, clamp,
    transpose, applyMatrix, multiplyMatrices, transformPoints, determinant, matrixError,
    rotationMatrix, reflectionMatrix, inversionMatrix, makeOperation, operationOrder, matchModel, models
  };
});
