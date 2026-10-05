'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const M = require('../math.js');
const P = require('../point-group-math.js');
const A = require('../advanced-math.js');
const EPS = 1e-7;
const near = (a, b) => assert.ok(Math.abs(a - b) < EPS, `${a} != ${b}`);
const nearMatrix = (a, b) => assert.ok(M.matrixError(a, b) < EPS);
let count = 0;
function test(name, fn) { fn(); count++; console.log('✓ ' + name); }

test('stereographic poles use the named opposite pole and retain hemisphere', () => {
  for (const z of [1, -1]) {
    const pole = A.projectPole([0, 0, z]); near(pole.x, 0); near(pole.y, 0);
    assert.equal(pole.hemisphere, z > 0 ? 'upper' : 'lower');
  }
  const p = A.direction([2, -1, 3]), upper = A.projectPole(p), lower = A.projectPole([p[0], p[1], -p[2]]);
  near(upper.x, lower.x); near(upper.y, lower.y);
  assert.equal(upper.hemisphere, 'upper'); assert.equal(lower.hemisphere, 'lower');
  for (const q of [p, [p[0], p[1], -p[2]], A.direction([1, -2, 0])]) {
    const projected = A.projectPole(q), recovered = A.unprojectPole(projected.x, projected.y, projected.hemisphere);
    near(M.distance(q, recovered), 0);
    near(Math.hypot(projected.x, projected.y), Math.sqrt((1 - Math.abs(q[2])) / (1 + Math.abs(q[2]))));
    if (projected.hemisphere !== 'equator') {
      // Ray from opposite pole through q intersects z=0 at the returned xy.
      const poleZ = q[2] > 0 ? -1 : 1, t = -poleZ / (q[2] - poleZ);
      near(t * q[0], projected.x); near(t * q[1], projected.y);
    }
  }
  assert.equal(A.projectPole([2, -3, 0]).hemisphere, 'equator');
  assert.throws(() => A.projectPole([0, 0, 0])); assert.throws(() => A.projectPole([NaN, 0, 1]));
  assert.throws(() => A.unprojectPole(2, 0)); assert.throws(() => A.unprojectPole(0, 0, 'equator'));
});

test('all 32 direction orbits are closed and distinguish special positions', () => {
  const seed = A.directionFromAngles(53, 19);
  for (const group of P.groups) {
    const orbit = A.poleOrbit(group.hm, seed);
    assert.equal(orbit.length, group.operations.length, group.hm);
    assert.equal(orbit.reduce((total, point) => total + point.operationIndices.length, 0), group.operations.length);
    for (const point of orbit) {
      near(M.norm(point.direction), 1); assert.ok(Math.hypot(point.projection.x, point.projection.y) <= 1 + EPS);
      for (const operation of group.operations) assert.ok(orbit.some(other => M.distance(other.direction, M.applyMatrix(operation.matrix, point.direction)) < EPS), group.hm);
    }
  }
  assert.equal(A.poleOrbit('4', [0, 0, 1]).length, 1);
  assert.equal(A.poleOrbit('4/mmm', [0, 0, 1]).length, 2);
  assert.equal(A.poleOrbit('m-3m', [1, 0, 0]).length, 6);
  assert.throws(() => A.poleOrbit('unknown', seed));
});

test('projected mirror curves come only from the actual plane great circle', () => {
  for (const normal of [[0, 0, 1], [1, 0, 0], [1, 2, 3]]) {
    const circle = A.mirrorGreatCircle(normal), n = A.direction(normal);
    for (const item of circle.points) { near(M.dot(n, item.direction), 0); near(M.norm(item.direction), 1); }
    for (const segment of circle.paths) for (let i = 0; i < segment.points.length; i++) {
      const point = segment.points[i]; near(M.dot(n, point.direction), 0);
      assert.ok(point.projection.hemisphere === 'equator' || point.projection.hemisphere === segment.hemisphere);
      if (i) assert.ok(Math.hypot(point.projection.x - segment.points[i - 1].projection.x, point.projection.y - segment.points[i - 1].projection.y) < .05);
    }
  }
  const equator = A.mirrorGreatCircle([0, 0, 1]); assert.equal(equator.paths.length, 1); assert.equal(equator.paths[0].hemisphere, 'equator');
  equator.points.forEach(item => near(Math.hypot(item.projection.x, item.projection.y), 1));
  A.mirrorGreatCircle([1, 0, 0]).points.forEach(item => near(item.projection.x, 0));
  assert.throws(() => A.mirrorGreatCircle([0, 0, 0])); assert.throws(() => A.mirrorGreatCircle([1, 0, 0], 3));
});

test('polar Reynolds projectors are idempotent with exactly ten polar classes', () => {
  const dimensions = { '1': 3, 'm': 2, '2': 1, 'mm2': 1, '3': 1, '4': 1, '6': 1, '3m': 1, '4mm': 1, '6mm': 1 };
  for (const group of P.groups) {
    const projection = A.polarProjector(group.hm), dimension = projection.reduce((sum, row, i) => sum + row[i], 0);
    near(dimension, dimensions[group.hm] || 0);
    nearMatrix(projection, M.transpose(projection)); nearMatrix(M.multiplyMatrices(projection, projection), projection);
    for (const operation of group.operations) nearMatrix(M.multiplyMatrices(operation.matrix, projection), projection);
  }
  nearMatrix(A.polarProjector('m'), [[1, 0, 0], [0, 0, 0], [0, 0, 1]]);
  nearMatrix(A.polarProjector('2'), [[0, 0, 0], [0, 1, 0], [0, 0, 0]]);
  assert.throws(() => A.polarProjector('unknown'));
});

test('symmetric ordinary rank-two tensors are invariant with the expected independent coefficients', () => {
  const general = [[3, .4, -.7], [.4, 5, 1.2], [-.7, 1.2, 9]];
  const bases = [[[0, 0], [1, 1], [2, 2]], [[0, 1], [0, 2], [1, 2]]].flat();
  for (const group of P.groups) {
    const invariant = A.invariantTensor(group.hm, general);
    nearMatrix(invariant, M.transpose(invariant)); nearMatrix(A.invariantTensor(group.hm, invariant), invariant);
    near(invariant[0][0] + invariant[1][1] + invariant[2][2], 17);
    for (const operation of group.operations) nearMatrix(M.multiplyMatrices(M.multiplyMatrices(operation.matrix, invariant), M.transpose(operation.matrix)), invariant);
    const dimension = bases.reduce((sum, [i, j]) => {
      const basis = Array.from({ length: 3 }, () => [0, 0, 0]); basis[i][j] = basis[j][i] = 1;
      return sum + A.invariantTensor(group.hm, basis)[i][j];
    }, 0);
    const expected = ['1', '-1'].includes(group.hm) ? 6 : ['2', 'm', '2/m'].includes(group.hm) ? 4 : ['222', 'mm2', 'mmm'].includes(group.hm) ? 3 : ['23', 'm-3', '432', '-43m', 'm-3m'].includes(group.hm) ? 1 : 2;
    near(dimension, expected);
  }
  for (const hm of ['32', '-3m']) nearMatrix(A.invariantTensor(hm, general), [[4, 0, 0], [0, 4, 0], [0, 0, 9]]);
  nearMatrix(A.invariantTensor('m-3m', general), [[17 / 3, 0, 0], [0, 17 / 3, 0], [0, 0, 17 / 3]]);
  nearMatrix(A.invariantTensor('1', [[1, 3, 0], [1, 2, 0], [0, 0, 4]]), [[1, 2, 0], [2, 2, 0], [0, 0, 4]]);
  assert.throws(() => A.invariantTensor('1', [[1]]));
});

test('subgroup comparison includes orientation and permits the whole group itself', () => {
  for (const [parent, child] of [['4/mmm', '4mm'], ['4/mmm', '2/m'], ['6/mmm', '6mm'], ['m-3m', '-43m'], ['-1', '1'], ['1', '1']]) {
    const result = A.subgroup(parent, child); assert.equal(result.isSubgroup, true, parent + ' ' + child);
    assert.equal(result.indices.length, P.getGroup(child).operations.length); assert.equal(result.missing.length, 0); near(result.index, P.getGroup(parent).operations.length / P.getGroup(child).operations.length);
  }
  assert.equal(A.subgroup('4', '3').isSubgroup, false);
  // D3d is a subgroup TYPE of Oh, but the default z-oriented representative is not.
  assert.equal(A.subgroup('m-3m', '-3m').isSubgroup, false);
  const x = A.direction([1, -1, 0]), z = A.direction([1, 1, 1]), y = M.cross(z, x), orientation = M.transpose([x, y, z]);
  assert.equal(A.subgroup('m-3m', '-3m', orientation).isSubgroup, true);
  assert.throws(() => A.subgroup('1', '1', [[1, 0, 0], [0, 1, 0], [0, 0, 2]]));
});

test('browser UMD exports the same advanced math contract', () => {
  const context = { SymmetryMath: M, SymmetryPointGroups: P };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../advanced-math.js'), 'utf8'), context);
  near(context.SymmetryAdvanced.projectPole([0, 0, 1]).x, 0);
  nearMatrix(context.SymmetryAdvanced.invariantTensor('432', [[3, 0, 0], [0, 6, 0], [0, 0, 9]]), [[6, 0, 0], [0, 6, 0], [0, 0, 6]]);
});
console.log(count + ' advanced crystallography tests passed.');
