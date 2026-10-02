'use strict';
const assert = require('node:assert/strict');
const M = require('../math.js');
const model = id => M.models.find(item => item.id === id);
const nearPoint = (actual, expected, eps = 1e-8) => assert.ok(M.distance(actual, expected) < eps, `${actual} differs from ${expected}`);
const nearMatrix = (actual, expected, eps = 1e-8) => assert.ok(M.matrixError(actual, expected) < eps);
const op = (type, n, axis = [0, 0, 1], normal = [0, 0, 1]) => M.makeOperation({ type, n, axis, normal });
let checks = 0;
function test(name, fn) { fn(); checks++; process.stdout.write('✓ ' + name + '\n'); }

test('right-hand positive rotations and normalized arbitrary axes', () => {
  nearPoint(M.applyMatrix(op('rotation', 4).matrix, [1, 0, 0]), [0, 1, 0]);
  const r = op('rotation', 3, [2, 2, 2]);
  nearPoint(M.applyMatrix(r.matrix, [1, 0, 0]), [0, 1, 0]);
  nearPoint(M.applyMatrix(r.matrix, [1, 1, 1]), [1, 1, 1]);
});

test('reflection flips the plane normal and fixes in-plane points', () => {
  const r = op('reflection', 2, undefined, [1, 1, 0]);
  nearPoint(M.applyMatrix(r.matrix, [1, 1, 0]), [-1, -1, 0]);
  nearPoint(M.applyMatrix(r.matrix, [1, -1, 2]), [1, -1, 2]);
  nearPoint(M.applyMatrix(op('inversion').matrix, [1, -2, 3]), [-1, 2, -3]);
});

test('S_n and crystallographic bar n have different coordinate maps', () => {
  nearPoint(M.applyMatrix(op('improper', 4).matrix, [1, 0, 2]), [0, 1, -2]);
  nearPoint(M.applyMatrix(op('rotoinversion', 4).matrix, [1, 0, 2]), [0, -1, -2]);
  nearMatrix(op('rotoinversion', 1).matrix, op('inversion').matrix);
  nearMatrix(op('rotoinversion', 2).matrix, op('reflection').matrix);
  nearMatrix(op('improper', 1).matrix, op('reflection').matrix);
  nearMatrix(op('improper', 2).matrix, op('inversion').matrix);
});

test('operation orders distinguish odd and even composite operations', () => {
  assert.equal(M.operationOrder(op('E').matrix), 1);
  assert.equal(M.operationOrder(op('rotation', 6).matrix), 6);
  assert.equal(M.operationOrder(op('reflection').matrix), 2);
  assert.equal(M.operationOrder(op('inversion').matrix), 2);
  for (const type of ['improper', 'rotoinversion']) {
    assert.equal(M.operationOrder(op(type, 3).matrix), 6);
    assert.equal(M.operationOrder(op(type, 4).matrix), 4);
  }
  assert.equal(M.operationOrder(op('rotation', 29).matrix), null);
});

test('composition A*B applies B first and can be noncommutative', () => {
  const r = op('rotation', 4).matrix, s = op('reflection', 2, undefined, [1, 0, 0]).matrix;
  const p = [0.7, -0.9, 0.4];
  nearPoint(M.applyMatrix(M.multiplyMatrices(r, s), p), M.applyMatrix(r, M.applyMatrix(s, p)));
  assert.ok(M.distance(M.applyMatrix(M.multiplyMatrices(r, s), p), M.applyMatrix(M.multiplyMatrices(s, r), p)) > 1);
});

test('operation endpoints preserve distances and determinant parity', () => {
  const a = [0.25, -0.5, 1.25], b = [-1, 2, 0.75];
  for (const type of ['E', 'rotation', 'reflection', 'inversion', 'improper', 'rotoinversion']) {
    const r = op(type, 3, [1, 2, 3], [2, 1, -1]);
    assert.ok(Math.abs(M.distance(M.applyMatrix(r.matrix, a), M.applyMatrix(r.matrix, b)) - M.distance(a, b)) < 1e-8);
    assert.ok(Math.abs(M.determinant(r.matrix) - (['E', 'rotation'].includes(type) ? 1 : -1)) < 1e-8);
  }
});

test('animations begin at identity, finish exactly, and expose both composite stages', () => {
  for (const type of ['E', 'rotation', 'reflection', 'inversion', 'improper', 'rotoinversion']) {
    const r = op(type, 4);
    nearMatrix(r.animate(0), M.identityMatrix());
    nearMatrix(r.animate(1), r.matrix);
    nearMatrix(r.animate(-5), M.identityMatrix());
    nearMatrix(r.animate(9), r.matrix);
    if (r.stageNames.length === 2) {
      nearMatrix(r.animate(0.5), op('rotation', 4).matrix);
      assert.equal(r.phase(0.25).index, 0);
      assert.equal(r.phase(0.75).index, 1);
      assert.equal(r.phase(0.75).localT, 0.5);
    }
  }
  nearPoint(M.applyMatrix(op('reflection').animate(0.5), [1, 2, 3]), [1, 2, 0]);
  nearPoint(M.applyMatrix(op('inversion').animate(0.5), [1, 2, 3]), [0, 0, 0]);
});

test('recommended molecular and polygon operations reproduce same-element sites', () => {
  for (const item of M.models.filter(item => !['asymmetric', 'probe'].includes(item.id))) {
    const result = M.matchModel(item, M.makeOperation(item.recommended).matrix);
    assert.equal(result.isSymmetry, true, item.id);
    assert.ok(result.maxError < 1e-8);
    assert.equal(new Set(result.mapping).size, item.atoms.length);
  }
  assert.equal(M.matchModel(model('water'), op('inversion').matrix).isSymmetry, false);
  assert.equal(M.matchModel(model('ammonia'), op('reflection').matrix).isSymmetry, false);
  assert.equal(M.matchModel(model('xef4'), op('inversion').matrix).isSymmetry, true);
  assert.equal(M.matchModel(model('methane'), op('improper', 4).matrix).isSymmetry, true);
  assert.equal(M.matchModel(model('methane'), op('rotoinversion', 4).matrix).isSymmetry, true);
  assert.equal(M.matchModel(model('methane'), op('inversion').matrix).isSymmetry, false);
});

test('equivalent atoms may exchange IDs, different labels may not exchange', () => {
  const result = M.matchModel(model('water'), op('rotation', 2).matrix);
  assert.deepEqual(result.mapping, [0, 2, 1]);
  assert.equal(M.matchModel(model('asymmetric'), M.makeOperation(model('asymmetric').recommended).matrix).isSymmetry, false);
  assert.equal(M.matchModel(model('asymmetric'), M.identityMatrix()).isSymmetry, true);
});

test('matching is bijective and uses augmenting paths instead of greedy matching', () => {
  const fixture = { atoms: [{ element: 'X', position: [0, 0, 0] }, { element: 'X', position: [0.08, 0, 0] }] };
  // The first source can match either target. The second has only target 0.
  const reflected = [[-1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const result = M.matchModel(fixture, reflected, 0.1);
  assert.equal(result.isSymmetry, true);
  assert.deepEqual(result.mapping, [1, 0]);
  const compressed = [[0, 0, 0], [0, 1, 0], [0, 0, 1]];
  assert.equal(M.matchModel(fixture, compressed, 0.01).isSymmetry, false);
  assert.equal(M.matchModel(fixture, compressed, 0.01).unmatched.length, 1);
});

test('intermediate teaching maps are rejected as physical symmetry transformations', () => {
  assert.equal(M.matchModel(model('hexagon'), op('reflection').animate(0.5)).isSymmetry, false);
  assert.equal(M.matchModel(model('hexagon'), op('reflection').animate(0.5)).orthogonal, false);
});

test('a species-preserving spatial match must also preserve represented bonds', () => {
  const triangle = {
    atoms: Array.from({ length: 3 }, (_, i) => ({ element: 'X', position: [Math.cos(i * 2 * Math.PI / 3), Math.sin(i * 2 * Math.PI / 3), 0] })),
    bonds: [[0, 1]]
  };
  const result = M.matchModel(triangle, op('rotation', 3).matrix);
  assert.equal(result.unmatched.length, 0);
  assert.equal(result.orthogonal, true);
  assert.equal(result.bondsPreserved, false);
  assert.equal(result.isSymmetry, false);
  assert.equal(M.matchModel(triangle, M.identityMatrix()).bondsPreserved, true);
  assert.equal(M.matchModel(model('water'), op('rotation', 2).matrix).bondsPreserved, true);
});

test('ambiguous spatial matches search for a bond-preserving bijection', () => {
  const coincident = {
    atoms: Array.from({ length: 4 }, () => ({ element: 'X', position: [0, 0, 0] })),
    bonds: [[0, 1], [1, 2]]
  };
  const result = M.matchModel(coincident, M.identityMatrix());
  assert.equal(result.isSymmetry, true);
  assert.equal(result.bondsPreserved, true);
  assert.equal(result.mapping[1], 1);
  assert.equal(result.mapping[3], 3);
});

test('invalid operation specifications and vectors are rejected', () => {
  assert.throws(() => op('rotation', 0), RangeError);
  assert.throws(() => op('rotation', 2.5), RangeError);
  assert.throws(() => op('rotation', 3, [0, 0, 0]), RangeError);
  assert.throws(() => M.makeOperation({ type: 'translation' }), RangeError);
  assert.throws(() => M.normalize([1, 2, NaN]), TypeError);
});

process.stdout.write(`${checks} meaningful symmetry tests passed.\n`);
