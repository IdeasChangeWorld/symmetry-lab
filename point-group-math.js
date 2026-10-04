/* Cartesian representatives of the 32 crystallographic point groups.
 * Conventional generators and operation classification follow IUCr:
 * https://www.iucr.org/what-we-do/education/pamphlets/metric-tensor-and-symmetry-operations-in-crystallography
 * The axis convention is unique b=y for monoclinic groups, principal z for
 * axial groups, and Cartesian cubic axes plus the [111] threefold axis.
 */
(function (root, factory) {
  'use strict';
  const math = typeof module === 'object' && module.exports ? require('./math.js') : root.SymmetryMath;
  const api = factory(math);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SymmetryPointGroups = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (M) {
  'use strict';
  if (!M) throw new Error('SymmetryPointGroups requires SymmetryMath.');
  const EPS = 1e-8;
  const x = [1, 0, 0], y = [0, 1, 0], z = [0, 0, 1];
  const I = M.identityMatrix(), inversion = M.inversionMatrix();
  const negative = matrix => matrix.map(row => row.map(value => -value));
  const clean = value => Math.abs(value) < 1e-12 ? 0 : Math.abs(value - Math.round(value)) < 1e-12 ? Math.round(value) : value;
  const cleanMatrix = matrix => matrix.map(row => row.map(clean));
  const matrixKey = matrix => matrix.flat().map(value => Math.round(value * 1e8)).join(',');
  const lineKey = line => line.map(value => Math.round(value * 1e8)).join(',');
  const rot = (n, axis = z) => cleanMatrix(M.rotationMatrix(axis, 2 * Math.PI / n));
  const mirror = normal => cleanMatrix(M.reflectionMatrix(normal));
  const bar = (n, axis = z) => negative(rot(n, axis));
  const C2x = rot(2, x), C2y = rot(2, y), C3z = rot(3), C4z = rot(4), C6z = rot(6);
  const mx = mirror(x), my = mirror(y), mz = mirror(z);
  const cubic3 = rot(3, [1, 1, 1]);
  const definitions = [
    ['1', 1, []], ['-1', 2, [inversion]], ['2', 2, [C2y]], ['m', 2, [my]], ['2/m', 4, [C2y, my]],
    ['222', 4, [C2x, C2y]], ['mm2', 4, [mx, my]], ['mmm', 8, [mx, my, mz]],
    ['4', 4, [C4z]], ['-4', 4, [bar(4)]], ['4/m', 8, [C4z, mz]],
    ['422', 8, [C4z, C2x]], ['4mm', 8, [C4z, my]], ['-42m', 8, [bar(4), C2x]], ['4/mmm', 16, [C4z, C2x, mz]],
    ['3', 3, [C3z]], ['-3', 6, [bar(3)]], ['32', 6, [C3z, C2x]], ['3m', 6, [C3z, my]], ['-3m', 12, [bar(3), C2x]],
    ['6', 6, [C6z]], ['-6', 6, [bar(6)]], ['6/m', 12, [C6z, mz]],
    ['622', 12, [C6z, C2x]], ['6mm', 12, [C6z, my]], ['-62m', 12, [bar(6), C2x]], ['6/mmm', 24, [C6z, C2x, mz]],
    ['23', 12, [cubic3, C2x]], ['m-3', 24, [cubic3, C2x, inversion]],
    ['432', 24, [C4z, cubic3]], ['-43m', 24, [cubic3, C2x, mirror([1, -1, 0])]], ['m-3m', 48, [C4z, cubic3, inversion]]
  ];

  function closure(generators, expectedOrder) {
    const matrices = [I.map(row => row.slice())], keys = new Set([matrixKey(I)]);
    for (let index = 0; index < matrices.length; index++) {
      for (const generator of generators) {
        const product = cleanMatrix(M.multiplyMatrices(generator, matrices[index]));
        const key = matrixKey(product);
        if (!keys.has(key)) {
          keys.add(key); matrices.push(product);
          if (matrices.length > 48) throw new Error('Point-group generators did not close within 48 operations.');
        }
      }
    }
    if (matrices.length !== expectedOrder) throw new Error('Incorrect generated point-group order: ' + matrices.length + ' instead of ' + expectedOrder);
    return matrices;
  }

  function canonicalLine(vector) {
    const unit = M.normalize(vector).map(clean);
    const leading = unit.find(value => Math.abs(value) > EPS);
    return (leading < 0 ? M.scale(unit, -1) : unit).map(clean);
  }

  function lineFromSymmetricOuter(matrix) {
    // matrix = u u^T. Choosing the largest diagonal avoids a zero division.
    let index = 0;
    for (let i = 1; i < 3; i++) if (matrix[i][i] > matrix[index][index]) index = i;
    const component = Math.sqrt(Math.max(0, matrix[index][index]));
    return canonicalLine(matrix.map(row => row[index] / component));
  }

  function directionLabel(direction) {
    const nonzero = direction.filter(value => Math.abs(value) > EPS);
    const smallest = Math.min(...nonzero.map(Math.abs));
    const ratios = direction.map(value => value / smallest);
    if (ratios.every(value => Math.abs(value - Math.round(value)) < EPS)) return '[' + ratios.map(value => Math.round(value)).join(',') + ']';
    return '[' + direction.map(value => Math.abs(value) < EPS ? '0' : value.toFixed(3)).join(',') + ']';
  }

  function rotationInfo(matrix) {
    const cosine = M.clamp((matrix[0][0] + matrix[1][1] + matrix[2][2] - 1) / 2, -1, 1);
    let axis;
    if (cosine < -1 + EPS) {
      axis = lineFromSymmetricOuter(matrix.map((row, i) => row.map((value, j) => (value + I[i][j]) / 2)));
    } else {
      axis = canonicalLine([matrix[2][1] - matrix[1][2], matrix[0][2] - matrix[2][0], matrix[1][0] - matrix[0][1]]);
    }
    const skew = [matrix[2][1] - matrix[1][2], matrix[0][2] - matrix[2][0], matrix[1][0] - matrix[0][1]];
    let angle = Math.atan2(M.dot(skew, axis) / 2, cosine);
    if (angle < -EPS) angle += 2 * Math.PI;
    if (Math.abs(angle) < EPS && cosine < 0) angle = Math.PI;
    const n = M.operationOrder(matrix, 12, EPS);
    if (!n) throw new Error('Non-crystallographic proper rotation in a point group.');
    return { axis, angle, n };
  }

  const subscript = number => String(number).replace(/\d/g, digit => '₀₁₂₃₄₅₆₇₈₉'[Number(digit)]);
  function classify(matrix) {
    const order = M.operationOrder(matrix, 12, EPS);
    let operation;
    if (M.matrixError(matrix, I) < EPS) {
      operation = { type: 'E', n: 1, angle: 0, label: 'E · 恒等操作', stageNames: ['保持原位'] };
    } else if (M.matrixError(matrix, inversion) < EPS) {
      operation = { type: 'inversion', n: 1, angle: 0, label: 'i · 中心反演', stageNames: ['反演'] };
    } else if (M.determinant(matrix) > 0) {
      const info = rotationInfo(matrix);
      operation = { ...info, type: 'rotation', label: 'C' + subscript(info.n) + ' · 绕 ' + directionLabel(info.axis) + ' ' + Math.round(info.angle * 180 / Math.PI) + '°', stageNames: ['旋转'] };
    } else if (Math.abs(matrix[0][0] + matrix[1][1] + matrix[2][2] - 1) < EPS) {
      const normal = lineFromSymmetricOuter(matrix.map((row, i) => row.map((value, j) => (I[i][j] - value) / 2)));
      operation = { type: 'reflection', n: 2, angle: 0, normal, label: 'm · 法向 ' + directionLabel(normal) + ' 的镜面', stageNames: ['镜映'] };
    } else {
      const info = rotationInfo(negative(matrix));
      operation = { ...info, type: 'rotoinversion', label: info.n + '\u0305 · 绕 ' + directionLabel(info.axis) + ' ' + Math.round(info.angle * 180 / Math.PI) + '° 后中心反演', stageNames: ['旋转', '中心反演'] };
    }
    return { ...operation, matrix: cleanMatrix(matrix), order };
  }

  function elementsFromOperations(operations) {
    const axes = new Map(), mirrors = new Map();
    let hasInversion = false;
    for (const operation of operations) {
      if (operation.type === 'inversion') hasInversion = true;
      if (operation.type === 'reflection') mirrors.set(lineKey(operation.normal), { normal: operation.normal.slice() });
      if (operation.type === 'rotation' || operation.type === 'rotoinversion') {
        const direction = canonicalLine(operation.axis), key = lineKey(direction);
        if (!axes.has(key)) axes.set(key, { direction, fold: 1 });
        const axis = axes.get(key);
        if (operation.type === 'rotation') axis.fold = Math.max(axis.fold, operation.n);
        else axis.improperFold = Math.max(axis.improperFold || 1, operation.n);
      }
    }
    return {
      axes: Array.from(axes.values()).sort((a, b) => b.fold - a.fold || lineKey(a.direction).localeCompare(lineKey(b.direction))),
      mirrors: Array.from(mirrors.values()).sort((a, b) => lineKey(a.normal).localeCompare(lineKey(b.normal))),
      inversion: hasInversion
    };
  }

  // Three independent, distinctly typed generic orbits eliminate extra O(3)
  // symmetries. The exhaustive test verifies their full stabilizer for all 32.
  const seedPoints = [[0.713, 0.241, 0.487], [-0.319, 1.037, 0.563], [0.271, -0.683, 1.429]];
  const orbitColors = ['#217b78', '#3262a6', '#b16a23'];
  function orbitModel(hm, operations) {
    const atoms = [], seedIndices = [];
    seedPoints.forEach((seed, orbit) => {
      const element = 'ABC'[orbit];
      seedIndices.push(atoms.length);
      operations.forEach((operation, index) => {
        atoms.push({ id: element + (index + 1), element, position: M.applyMatrix(operation.matrix, seed).map(clean), color: orbitColors[orbit], radius: 0.065 });
      });
    });
    const centroid = M.scale(atoms.reduce((sum, atom) => M.add(sum, atom.position), [0, 0, 0]), 1 / atoms.length);
    let centerFixedBy = 'centroid';
    if (M.norm(centroid) > EPS) {
      // A uniquely typed origin point anchors polar models. This also prevents
      // the offset plane through the three C1 seed points being an extra mirror.
      atoms.push({ id: 'O', element: 'O', position: [0, 0, 0], color: '#6a7c87', radius: 0.045 });
      centerFixedBy = 'origin-marker';
    }
    return { id: 'point-group-' + hm, name: hm + ' 点群的三色轨道模型', formula: 'A · B · C', pointGroup: hm, atoms, bonds: [], seedIndices, centerFixedBy };
  }

  function makeGroup(definition) {
    const [hm, expectedOrder, generatingMatrices] = definition;
    const typeOrder = { E: 0, rotation: 1, reflection: 2, inversion: 3, rotoinversion: 4 };
    const operations = closure(generatingMatrices, expectedOrder).map(classify).sort((a, b) => typeOrder[a.type] - typeOrder[b.type] || b.n - a.n || lineKey(a.axis || a.normal || z).localeCompare(lineKey(b.axis || b.normal || z)) || a.angle - b.angle);
    operations.forEach((operation, index) => { operation.id = 'op-' + String(index).padStart(2, '0'); });
    const generators = generatingMatrices.map(matrix => operations.find(operation => M.matrixError(matrix, operation.matrix) < EPS).id);
    const model = orbitModel(hm, operations);
    return { hm, operations, model, elements: elementsFromOperations(operations), generators, expectedOrder, centerFixedBy: model.centerFixedBy };
  }

  function animateOperation(operation, t) {
    t = M.clamp(Number(t) || 0, 0, 1);
    if (t === 0 || operation.type === 'E') return M.identityMatrix();
    if (t === 1) return operation.matrix.map(row => row.slice());
    if (operation.type === 'rotation') return M.rotationMatrix(operation.axis, operation.angle * t);
    if (operation.type === 'reflection' || operation.type === 'inversion') return I.map((row, i) => row.map((value, j) => value + t * (operation.matrix[i][j] - value)));
    if (operation.type === 'rotoinversion' || operation.type === 'improper') {
      if (t <= 0.5) return M.rotationMatrix(operation.axis, operation.angle * t * 2);
      const rotation = M.rotationMatrix(operation.axis, operation.angle);
      const second = operation.type === 'rotoinversion' ? inversion : M.reflectionMatrix(operation.axis);
      const u = 2 * t - 1;
      const intermediate = I.map((row, i) => row.map((value, j) => value + u * (second[i][j] - value)));
      return M.multiplyMatrices(intermediate, rotation);
    }
    throw new RangeError('Unknown operation animation type: ' + operation.type);
  }

  function phaseOperation(operation, t) {
    t = M.clamp(Number(t) || 0, 0, 1);
    const names = operation.stageNames;
    const count = names.length, index = count === 2 && t >= 0.5 ? 1 : 0;
    return { name: names[index], index, count, localT: count === 2 ? index === 0 ? 2 * t : 2 * t - 1 : t };
  }

  const groups = definitions.map(makeGroup);
  const getGroup = hm => groups.find(group => group.hm === hm) || null;
  return { groups, getGroup, animateOperation, phaseOperation };
});
