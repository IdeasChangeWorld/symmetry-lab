'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const M = require('../math.js');
const P = require('../point-group-math.js');
const Learning = require('../learning-data.js');
const EPS = 1e-7;
const nearMatrix = (a, b) => assert.ok(M.matrixError(a, b) < EPS);
const near = (a, b) => assert.ok(Math.abs(a - b) < EPS, `${a} != ${b}`);
const matrixKey = m => m.flat().map(value => Math.round(value * 1e7)).join(',');
let checks = 0;
function test(name, fn) { fn(); checks++; process.stdout.write('✓ ' + name + '\n'); }

test('all 32 HM keys, expected orders, handedness, and inversion match content', () => {
  assert.equal(P.groups.length, 32);
  assert.deepEqual(P.groups.map(group => group.hm), Learning.pointGroups.map(group => group.hm));
  assert.equal(P.getGroup('unknown'), null);
  for (const content of Learning.pointGroups) {
    const group = P.getGroup(content.hm);
    assert.equal(group.operations.length, content.order, content.hm);
    assert.equal(group.expectedOrder, content.order);
    assert.equal(group.elements.inversion, content.centrosymmetric, content.hm);
    assert.equal(group.operations.every(operation => M.determinant(operation.matrix) > 0), content.chiral, content.hm);
    assert.equal(group.operations[0].type, 'E');
    assert.equal(new Set(group.operations.map(operation => operation.id)).size, content.order);
    assert.equal(new Set(group.operations.map(operation => matrixKey(operation.matrix))).size, content.order);
  }
});

test('every complete operation set is an orthogonal finite group with inverses', () => {
  for (const group of P.groups) {
    const contains = matrix => group.operations.some(operation => M.matrixError(operation.matrix, matrix) < EPS);
    for (const a of group.operations) {
      nearMatrix(M.multiplyMatrices(M.transpose(a.matrix), a.matrix), M.identityMatrix());
      near(Math.abs(M.determinant(a.matrix)), 1);
      assert.equal(contains(M.transpose(a.matrix)), true, group.hm + ' inverse');
      assert.equal(M.operationOrder(a.matrix), a.order);
      for (const b of group.operations) assert.equal(contains(M.multiplyMatrices(a.matrix, b.matrix)), true, group.hm + ' closure');
    }
  }
});

test('listed generator IDs generate the entire declared group', () => {
  for (const group of P.groups) {
    const generators = group.generators.map(id => {
      const operation = group.operations.find(item => item.id === id); assert.ok(operation); return operation.matrix;
    });
    const seen = [M.identityMatrix()];
    for (let index = 0; index < seen.length; index++) for (const generator of generators) {
      const product = M.multiplyMatrices(generator, seen[index]);
      if (!seen.some(matrix => M.matrixError(matrix, product) < EPS)) seen.push(product);
      assert.ok(seen.length <= group.expectedOrder, group.hm);
    }
    assert.equal(seen.length, group.expectedOrder, group.hm);
  }
});

test('canonical executable specs reconstruct every actual operation', () => {
  for (const group of P.groups) for (const operation of group.operations) {
    let reconstructed;
    if (operation.type === 'E') reconstructed = M.identityMatrix();
    if (operation.type === 'rotation') reconstructed = M.rotationMatrix(operation.axis, operation.angle);
    if (operation.type === 'reflection') reconstructed = M.reflectionMatrix(operation.normal);
    if (operation.type === 'inversion') reconstructed = M.inversionMatrix();
    if (operation.type === 'rotoinversion') reconstructed = M.multiplyMatrices(M.inversionMatrix(), M.rotationMatrix(operation.axis, operation.angle));
    assert.ok(reconstructed, operation.label);
    nearMatrix(reconstructed, operation.matrix);
    assert.ok(operation.label.length > 1);
    nearMatrix(P.animateOperation(operation, 0), M.identityMatrix());
    nearMatrix(P.animateOperation(operation, 1), operation.matrix);
    nearMatrix(P.animateOperation(operation, -3), M.identityMatrix());
    nearMatrix(P.animateOperation(operation, 9), operation.matrix);
    if (operation.type === 'rotoinversion') {
      nearMatrix(P.animateOperation(operation, 0.5), M.rotationMatrix(operation.axis, operation.angle));
      assert.equal(P.phaseOperation(operation, 0.25).index, 0);
      assert.equal(P.phaseOperation(operation, 0.75).index, 1);
      near(P.phaseOperation(operation, 0.75).localT, 0.5);
    }
  }
});

test('240 and 270 degree powers keep their own angles and trajectory', () => {
  const r240 = P.getGroup('3').operations.find(operation => Math.abs(operation.angle - 4 * Math.PI / 3) < EPS);
  const r270 = P.getGroup('4').operations.find(operation => Math.abs(operation.angle - 3 * Math.PI / 2) < EPS);
  assert.ok(r240); assert.ok(r270);
  nearMatrix(P.animateOperation(r240, 0.5), M.rotationMatrix([0, 0, 1], 2 * Math.PI / 3));
  nearMatrix(P.animateOperation(r270, 0.5), M.rotationMatrix([0, 0, 1], 3 * Math.PI / 4));
  assert.ok(r240.label.includes('240°')); assert.ok(r270.label.includes('270°'));
  const group = P.getGroup('-4');
  assert.equal(group.operations.filter(operation => operation.type === 'rotoinversion').length, 2);
  assert.equal(new Set(group.operations.map(operation => matrixKey(operation.matrix))).size, 4);
});

test('unique symmetry elements have correct conventional counts', () => {
  const expected = {
    '1': [0, 0], '-1': [0, 0], '2': [1, 0], 'm': [0, 1], '2/m': [1, 1],
    '222': [3, 0], 'mm2': [1, 2], 'mmm': [3, 3], '4': [1, 0], '-4': [1, 0],
    '4/m': [1, 1], '422': [5, 0], '4mm': [1, 4], '-42m': [3, 2], '4/mmm': [5, 5],
    '3': [1, 0], '-3': [1, 0], '32': [4, 0], '3m': [1, 3], '-3m': [4, 3],
    '6': [1, 0], '-6': [1, 1], '6/m': [1, 1], '622': [7, 0], '6mm': [1, 6], '-62m': [4, 4], '6/mmm': [7, 7],
    '23': [7, 0], 'm-3': [7, 3], '432': [13, 0], '-43m': [7, 6], 'm-3m': [13, 9]
  };
  const folds = {
    '1': [], '-1': [], '2': [2], 'm': [], '2/m': [2], '222': [2, 2, 2], 'mm2': [2], 'mmm': [2, 2, 2],
    '4': [4], '-4': [2], '4/m': [4], '422': [4, 2, 2, 2, 2], '4mm': [4], '-42m': [2, 2, 2], '4/mmm': [4, 2, 2, 2, 2],
    '3': [3], '-3': [3], '32': [3, 2, 2, 2], '3m': [3], '-3m': [3, 2, 2, 2],
    '6': [6], '-6': [3], '6/m': [6], '622': [6, 2, 2, 2, 2, 2, 2], '6mm': [6], '-62m': [3, 2, 2, 2], '6/mmm': [6, 2, 2, 2, 2, 2, 2],
    '23': [3, 3, 3, 3, 2, 2, 2], 'm-3': [3, 3, 3, 3, 2, 2, 2],
    '432': [4, 4, 4, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2], '-43m': [3, 3, 3, 3, 2, 2, 2],
    'm-3m': [4, 4, 4, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2]
  };
  for (const group of P.groups) {
    assert.deepEqual([group.elements.axes.length, group.elements.mirrors.length], expected[group.hm], group.hm);
    assert.deepEqual(group.elements.axes.map(axis => axis.fold), folds[group.hm], group.hm + ' maximal proper folds');
    for (const axis of group.elements.axes) {
      near(M.norm(axis.direction), 1);
      assert.ok(axis.fold >= 2);
      assert.ok(group.operations.some(operation => operation.type === 'rotation' && operation.n === axis.fold && Math.abs(M.dot(operation.axis, axis.direction)) > 1 - EPS));
      if (axis.improperFold) assert.ok(group.operations.some(operation => operation.type === 'rotoinversion' && operation.n === axis.improperFold && Math.abs(M.dot(operation.axis, axis.direction)) > 1 - EPS));
    }
    for (const plane of group.elements.mirrors) assert.ok(group.operations.some(operation => M.matrixError(operation.matrix, M.reflectionMatrix(plane.normal)) < EPS));
  }
  for (const hm of ['23', 'm-3', '-43m']) {
    assert.equal(P.getGroup(hm).elements.axes.filter(axis => axis.fold === 3).length, 4);
    assert.equal(P.getGroup(hm).elements.axes.filter(axis => axis.fold === 2).length, 3);
  }
  for (const hm of ['432', 'm-3m']) {
    assert.equal(P.getGroup(hm).elements.axes.filter(axis => axis.fold === 4).length, 3);
    assert.equal(P.getGroup(hm).elements.axes.filter(axis => axis.fold === 3).length, 4);
    assert.equal(P.getGroup(hm).elements.axes.filter(axis => axis.fold === 2).length, 6);
  }
  assert.equal(P.getGroup('-43m').elements.axes.filter(axis => axis.improperFold === 4).length, 3);
});

test('unusual axial and cubic groups have the correct operation distributions', () => {
  const expected = {
    '-4': { E: 1, rotation: 1, rotoinversion: 2 },
    '-3': { E: 1, rotation: 2, inversion: 1, rotoinversion: 2 },
    '-6': { E: 1, rotation: 2, reflection: 1, rotoinversion: 2 },
    '-42m': { E: 1, rotation: 3, reflection: 2, rotoinversion: 2 },
    '-3m': { E: 1, rotation: 5, reflection: 3, inversion: 1, rotoinversion: 2 },
    '-62m': { E: 1, rotation: 5, reflection: 4, rotoinversion: 2 },
    '23': { E: 1, rotation: 11 }, 'm-3': { E: 1, rotation: 11, inversion: 1, reflection: 3, rotoinversion: 8 },
    '432': { E: 1, rotation: 23 }, '-43m': { E: 1, rotation: 11, reflection: 6, rotoinversion: 6 },
    'm-3m': { E: 1, rotation: 23, inversion: 1, reflection: 9, rotoinversion: 14 }
  };
  for (const [hm, counts] of Object.entries(expected)) {
    const actual = P.getGroup(hm).operations.reduce((result, operation) => { result[operation.type] = (result[operation.type] || 0) + 1; return result; }, {});
    assert.deepEqual(actual, counts, hm);
  }
});

test('models have three typed general orbits and all group actions preserve them', () => {
  for (const group of P.groups) {
    const model = group.model;
    assert.ok(model.atoms.length <= 144);
    assert.deepEqual(model.bonds, []);
    assert.equal(new Set(model.atoms.map(atom => atom.id)).size, model.atoms.length);
    for (const element of ['A', 'B', 'C']) assert.equal(model.atoms.filter(atom => atom.element === element).length, group.expectedOrder);
    for (const operation of group.operations) assert.equal(M.matchModel(model, operation.matrix, EPS).isSymmetry, true, group.hm + ': ' + operation.label);
    if (model.centerFixedBy === 'origin-marker') {
      assert.equal(model.atoms.filter(atom => atom.element === 'O').length, 1);
      assert.deepEqual(model.atoms.find(atom => atom.element === 'O').position, [0, 0, 0]);
    } else {
      const centroid = M.scale(model.atoms.reduce((sum, atom) => M.add(sum, atom.position), [0, 0, 0]), 1 / model.atoms.length);
      assert.ok(M.norm(centroid) < EPS);
    }
  }
});

function inverse(matrix) {
  const determinant = M.determinant(matrix);
  assert.ok(Math.abs(determinant) > 0.1, 'seed vectors must be independent');
  return M.transpose([
    M.cross(matrix[1], matrix[2]), M.cross(matrix[2], matrix[0]), M.cross(matrix[0], matrix[1])
  ]).map(row => row.map(value => value / determinant));
}
const asColumns = points => [0, 1, 2].map(row => points.map(point => point[row]));

test('exhaustive O(3) stabilizer has no accidental extra spatial symmetries', () => {
  // A unique O marker or centroid forces every Euclidean symmetry to fix zero.
  // Every O(3) map is determined by its action on these three independent seed
  // vectors. Enumerating same-color target triples with equal Gram matrices
  // therefore covers all possible spatial symmetries, including improper ones.
  for (const group of P.groups) {
    const model = group.model;
    const seeds = model.seedIndices.map(index => model.atoms[index].position);
    const targetOrbits = ['A', 'B', 'C'].map(element => model.atoms.filter(atom => atom.element === element).map(atom => atom.position));
    const seedInverse = inverse(asColumns(seeds));
    const gram = [[M.dot(seeds[0], seeds[1]), M.dot(seeds[0], seeds[2])], [M.dot(seeds[1], seeds[2])]];
    const stabilizer = [];
    for (const a of targetOrbits[0]) for (const b of targetOrbits[1]) {
      if (Math.abs(M.dot(a, b) - gram[0][0]) > EPS) continue;
      for (const c of targetOrbits[2]) {
        if (Math.abs(M.dot(a, c) - gram[0][1]) > EPS || Math.abs(M.dot(b, c) - gram[1][0]) > EPS) continue;
        const candidate = M.multiplyMatrices(asColumns([a, b, c]), seedInverse);
        if (!M.matchModel(model, candidate, EPS).isSymmetry) continue;
        if (!stabilizer.some(matrix => M.matrixError(matrix, candidate) < EPS)) stabilizer.push(candidate);
      }
    }
    assert.equal(stabilizer.length, group.expectedOrder, group.hm + ' exact full stabilizer');
    for (const candidate of stabilizer) assert.ok(group.operations.some(operation => M.matrixError(operation.matrix, candidate) < EPS), group.hm + ' undeclared spatial symmetry');
  }
});

test('browser UMD uses SymmetryMath and exports the same complete API', () => {
  const context = { SymmetryMath: M };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../point-group-math.js'), 'utf8'), context);
  assert.equal(context.SymmetryPointGroups.groups.length, 32);
  assert.equal(context.SymmetryPointGroups.getGroup('m-3m').operations.length, 48);
  assert.equal(typeof context.SymmetryPointGroups.animateOperation, 'function');
});

process.stdout.write(`${checks} meaningful point-group tests passed.\n`);
