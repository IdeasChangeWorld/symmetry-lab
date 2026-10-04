'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const L = require('../lattice-math.js');
const kinds = ['square', 'hexagonal'];
const near = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a - b) <= tolerance, `${a} differs from ${b}`);
const nearVector = (a, b, tolerance = 1e-9) => a.forEach((value, index) => near(value, b[index], tolerance));
const apply = (matrix, point) => matrix.map(row => row.reduce((sum, value, index) => sum + value * point[index], 0));
const determinant = m => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
let checks = 0;
function test(name, fn) { fn(); checks++; process.stdout.write('✓ ' + name + '\n'); }

test('3D bases contain independent vectors and return fresh arrays', () => {
  assert.deepEqual(L.basis('square'), [[1, 0, 0], [0, 1, 0], [0, 0, 0.9]]);
  nearVector(L.basis('hexagonal')[1], [0.5, Math.sqrt(3) / 2, 0]);
  for (const kind of kinds) {
    assert.ok(Math.abs(determinant(L.basis(kind))) > 0.5);
    const copy = L.basis(kind); copy[0][0] = 100;
    assert.equal(L.basis(kind)[0][0], 1);
  }
});

test('Cartesian and lattice coordinates round-trip in all three dimensions', () => {
  for (const kind of kinds) {
    for (const coefficients of [[0, 0, 0], [2, -3, 4], [-1.25, 2.5, -0.75]]) {
      nearVector(L.toLatticeCoordinates(kind, L.toCartesian(kind, coefficients)), coefficients);
    }
    for (const point of [[1.7, -0.8, 2.4], [-2, 1, -0.9]]) {
      nearVector(L.toCartesian(kind, L.toLatticeCoordinates(kind, point)), point);
    }
  }
  nearVector(L.toCartesian('hexagonal', [2, -3, 4]), [0.5, -3 * Math.sqrt(3) / 2, 3.6]);
});

test('z rotation is right-handed and preserves the axial coordinate', () => {
  nearVector(L.rotate([1, 0, 0.9], Math.PI / 2), [0, 1, 0.9]);
  nearVector(L.rotate([1, 0, -0.9], -Math.PI / 2), [0, -1, -0.9]);
  nearVector(L.rotate([0, 0, 2.7], 1.2), [0, 0, 2.7]);
  const input = [1, 2, 3]; L.rotate(input, 0.5); assert.deepEqual(input, [1, 2, 3]);
});

test('lattice-basis matrices have the documented row-major action', () => {
  const square90 = L.rotationInBasis('square', 4);
  const hex60 = L.rotationInBasis('hexagonal', 6);
  [[0, -1, 0], [1, 0, 0], [0, 0, 1]].forEach((row, i) => nearVector(square90[i], row));
  [[0, -1, 0], [1, 1, 0], [0, 0, 1]].forEach((row, i) => nearVector(hex60[i], row));
  for (const kind of kinds) {
    for (const n of [1, 2, 3, 4, 5, 6, 8]) {
      const matrix = L.rotationInBasis(kind, n), coefficients = [2, -1, 3];
      nearVector(L.toCartesian(kind, apply(matrix, coefficients)), L.rotate(L.toCartesian(kind, coefficients), 2 * Math.PI / n));
      near(determinant(matrix), 1);
      near(matrix[0][0] + matrix[1][1] + matrix[2][2], L.traceForOrder(n));
    }
  }
});

test('square supports 1, 2, 4 and hexagonal supports 1, 2, 3, 6', () => {
  for (const n of [1, 2, 4]) assert.equal(L.supportsRotation('square', n), true);
  for (const n of [1, 2, 3, 6]) assert.equal(L.supportsRotation('hexagonal', n), true);
  for (const kind of kinds) {
    for (const n of kind === 'square' ? [1, 2, 4] : [1, 2, 3, 6]) {
      for (const indices of [[1, 0, 1], [-2, 1, -3], [2, 2, 0]]) {
        assert.equal(L.isLatticePoint(kind, L.rotate(L.toCartesian(kind, indices), 2 * Math.PI / n)), true);
      }
    }
  }
});

test('an allowed order need not work for a particular chosen lattice', () => {
  assert.equal(L.isAllowedOrder(3), true);
  assert.equal(L.supportsRotation('square', 3), false);
  assert.equal(L.isLatticePoint('square', L.rotate([1, 0, 0.9], 2 * Math.PI / 3)), false);
  assert.equal(L.isAllowedOrder(4), true);
  assert.equal(L.supportsRotation('hexagonal', 4), false);
  assert.equal(L.isLatticePoint('hexagonal', L.rotate([1, 0, 0.9], Math.PI / 2)), false);
});

test('3D integer-trace restriction rejects 5 and every tested n above 6', () => {
  const expectedTrace = new Map([[1, 3], [2, -1], [3, 0], [4, 1], [6, 2]]);
  for (const [n, trace] of expectedTrace) { assert.equal(L.isAllowedOrder(n), true); near(L.traceForOrder(n), trace); }
  near(L.traceForOrder(5), 1.618033988749895);
  for (const n of [5, 7, 8, 9, 10, 12, 100]) {
    assert.equal(L.isAllowedOrder(n), false);
    const trace = L.traceForOrder(n);
    assert.ok(Math.abs(trace - Math.round(trace)) > 1e-5);
    for (const kind of kinds) assert.equal(L.supportsRotation(kind, n), false);
    if (n >= 7) assert.ok(trace > 2 && trace < 3);
  }
  // Very large orders can numerically look like identity; they stay forbidden.
  assert.equal(L.isAllowedOrder(1000000000000), false);
  assert.equal(L.supportsRotation('square', 1000000000000), false);
});

test('recommended examples cover allowed orders and expose forbidden ones', () => {
  for (const n of [1, 2, 4]) assert.equal(L.recommendedKind(n), 'square');
  for (const n of [3, 5, 6, 7, 8, 9, 12]) assert.equal(L.recommendedKind(n), 'hexagonal');
  for (const n of [1, 2, 3, 4, 6]) assert.equal(L.supportsRotation(L.recommendedKind(n), n), true);
});

test('infinite lattice membership checks fractional z as well as x and y', () => {
  for (const kind of kinds) {
    assert.equal(L.isLatticePoint(kind, L.toCartesian(kind, [120, -70, 25])), true);
    assert.equal(L.isLatticePoint(kind, L.toCartesian(kind, [1, 0, 0.5])), false);
    assert.equal(L.isLatticePoint(kind, L.toCartesian(kind, [1 + 5e-9, 0, 1])), true);
    assert.equal(L.isLatticePoint(kind, L.toCartesian(kind, [1 + 5e-9, 0, 1]), 1e-10), false);
  }
});

test('cylindrical samples preserve allowed rotations without crop-boundary errors', () => {
  for (const kind of kinds) {
    const points = L.samplePoints(kind), keys = new Set(points.map(point => point.indices.join(',')));
    assert.equal(keys.size, points.length);
    assert.deepEqual(Array.from(new Set(points.map(point => point.indices[2]))).sort(), [-1, 0, 1]);
    for (const point of points) {
      assert.ok(point.position[0] ** 2 + point.position[1] ** 2 <= 2.25 ** 2 + 1e-10);
      nearVector(L.toCartesian(kind, point.indices), point.position);
      for (const n of kind === 'square' ? [1, 2, 4] : [1, 2, 3, 6]) {
        const target = L.rotate(point.position, 2 * Math.PI / n);
        assert.equal(L.isLatticePoint(kind, target), true);
        const targetIndices = L.toLatticeCoordinates(kind, target).map(Math.round);
        assert.equal(keys.has(targetIndices.join(',')), true, `${kind}, n=${n}, ${point.indices}`);
      }
    }
  }
  // In a rectangular index crop [-1,1]^2, this valid 60° target is missing.
  const target = L.rotate(L.toCartesian('hexagonal', [1, 1, 1]), Math.PI / 3);
  nearVector(L.toLatticeCoordinates('hexagonal', target), [-1, 2, 1]);
  assert.equal(L.isLatticePoint('hexagonal', target), true);
  assert.ok(L.samplePoints('hexagonal').some(point => point.indices.join(',') === '-1,2,1'));
});

test('exact radius boundaries, axial samples, and duplicate layers are handled', () => {
  assert.equal(L.samplePoints('square', Math.sqrt(2), [0]).length, 9);
  assert.equal(L.samplePoints('hexagonal', Math.sqrt(3), [0]).length, 13);
  assert.deepEqual(L.samplePoints('square', 0, [0, 0, 2]), [
    { indices: [0, 0, 0], position: [0, 0, 0] },
    { indices: [0, 0, 2], position: [0, 0, 1.8] }
  ]);
  assert.deepEqual(L.samplePoints('square', 2, []), []);
});

test('illegal orders, coordinates, lattices, radii, and layers are rejected', () => {
  for (const n of [0, -1, 2.5, NaN, Infinity, '3', Number.MAX_SAFE_INTEGER + 1]) {
    for (const fn of [L.traceForOrder, L.isAllowedOrder, L.recommendedKind]) assert.throws(() => fn(n), RangeError);
    assert.throws(() => L.rotationInBasis('square', n), RangeError);
    assert.throws(() => L.supportsRotation('square', n), RangeError);
  }
  assert.throws(() => L.basis('triangle'), RangeError);
  assert.throws(() => L.toCartesian('square', [1, 2]), TypeError);
  assert.throws(() => L.toLatticeCoordinates('square', [1, NaN, 0]), TypeError);
  assert.throws(() => L.rotate([1, 0, 0], Infinity), TypeError);
  assert.throws(() => L.isLatticePoint('square', [0, 0, 0], -1), RangeError);
  for (const radius of [-1, Infinity, NaN]) assert.throws(() => L.samplePoints('square', radius), RangeError);
  assert.throws(() => L.samplePoints('square', 2, [0.5]), TypeError);
  assert.throws(() => L.samplePoints('square', 2, 'all'), TypeError);
});

test('the same dependency-free module is available as a browser global', () => {
  const context = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../lattice-math.js'), 'utf8'), context);
  assert.equal(typeof context.CrystallographicLattice.rotate, 'function');
  assert.equal(context.CrystallographicLattice.supportsRotation('hexagonal', 6), true);
});

process.stdout.write(`${checks} meaningful 3D lattice tests passed.\n`);
