'use strict';
const assert = require('node:assert/strict');
const L = require('../learning-data.js');
const M = require('../math.js');
let checks = 0;
function test(name, fn) { fn(); checks++; process.stdout.write('✓ ' + name + '\n'); }

test('32 distinct crystal classes agree with the seven crystal-system counts', () => {
  assert.equal(L.pointGroups.length, 32);
  assert.equal(new Set(L.pointGroups.map(g => g.hm)).size, 32);
  assert.equal(new Set(L.pointGroups.map(g => g.schoenflies)).size, 32);
  const actual = Object.fromEntries(L.crystalSystems.map(s => [s, L.pointGroups.filter(g => g.system === s).length]));
  assert.deepEqual(actual, { 三斜: 2, 单斜: 3, 正交: 3, 四方: 7, 三方: 5, 六方: 7, 立方: 5 });
  for (const g of L.pointGroups) {
    assert.ok(L.crystalSystems.includes(g.system));
    assert.ok(Number.isInteger(g.order) && g.order > 0);
    assert.equal(typeof g.centrosymmetric, 'boolean');
    assert.equal(typeof g.chiral, 'boolean');
    assert.ok(g.note || g.example);
  }
});

test('centrosymmetric and proper-only classes are exactly the expected eleven each', () => {
  const centro = ['-1', '2/m', 'mmm', '4/m', '4/mmm', '-3', '-3m', '6/m', '6/mmm', 'm-3', 'm-3m'];
  const proper = ['1', '2', '222', '4', '422', '3', '32', '6', '622', '23', '432'];
  assert.deepEqual(L.pointGroups.filter(g => g.centrosymmetric).map(g => g.hm), centro);
  assert.deepEqual(L.pointGroups.filter(g => g.chiral).map(g => g.hm), proper);
  assert.ok(L.pointGroups.every(g => !(g.chiral && g.centrosymmetric)));
  assert.equal(L.pointGroups.filter(g => !g.chiral && !g.centrosymmetric).length, 10);
});

test('group orders and notation match the crystallographic reference table', () => {
  const expected = {
    '1': ['C1', 1], '-1': ['Ci', 2], '2': ['C2', 2], 'm': ['Cs', 2], '2/m': ['C2h', 4],
    '222': ['D2', 4], 'mm2': ['C2v', 4], 'mmm': ['D2h', 8],
    '4': ['C4', 4], '-4': ['S4', 4], '4/m': ['C4h', 8], '422': ['D4', 8],
    '4mm': ['C4v', 8], '-42m': ['D2d', 8], '4/mmm': ['D4h', 16],
    '3': ['C3', 3], '-3': ['C3i', 6], '32': ['D3', 6], '3m': ['C3v', 6], '-3m': ['D3d', 12],
    '6': ['C6', 6], '-6': ['C3h', 6], '6/m': ['C6h', 12], '622': ['D6', 12],
    '6mm': ['C6v', 12], '-62m': ['D3h', 12], '6/mmm': ['D6h', 24],
    '23': ['T', 12], 'm-3': ['Th', 24], '432': ['O', 24], '-43m': ['Td', 24], 'm-3m': ['Oh', 48]
  };
  for (const g of L.pointGroups) assert.deepEqual([g.schoenflies, g.order], expected[g.hm], g.hm);
});

test('quiz answers are valid and glossary and primary-source links are present', () => {
  assert.equal(L.quiz.length, 10);
  assert.equal(new Set(L.quiz.map(q => q.id)).size, 10);
  for (const q of L.quiz) {
    assert.ok(q.question && q.explanation);
    assert.ok(Array.isArray(q.options) && q.options.length >= 2);
    assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length);
    assert.ok(q.options.every(option => typeof option === 'string' && option.length > 0));
    assert.equal(new Set(q.options).size, q.options.length);
  }
  assert.ok(L.glossary.length > 0 && L.glossary.length <= 8);
  assert.ok(L.glossary.every(item => item.term && item.definition));
  assert.ok(L.sources.every(source => source.title && new URL(source.url).hostname.endsWith('iucr.org')));
});

test('the eight ideal models have atlas correspondences except the explanatory probe', () => {
  const normalize = text => text.replace(/_/g, '').replace(/[₁₂₃₄₅₆]/g, digit => '₁₂₃₄₅₆'.indexOf(digit) + 1);
  assert.equal(M.models.length, 8);
  for (const model of M.models.filter(model => model.id !== 'probe')) {
    assert.ok(L.pointGroups.some(group => group.schoenflies === normalize(model.pointGroup)), model.id);
  }
});

test('bar 3/S6, bar 4/S4 and bar 6/S3 generate equal cyclic point groups', () => {
  const powers = matrix => {
    const order = M.operationOrder(matrix);
    assert.ok(order);
    const result = [M.identityMatrix()];
    for (let i = 1; i < order; i++) result.push(M.multiplyMatrices(matrix, result[i - 1]));
    return result;
  };
  for (const [nbar, ns] of [[3, 6], [4, 4], [6, 3]]) {
    const a = M.makeOperation({ type: 'rotoinversion', n: nbar, axis: [0, 0, 1] }).matrix;
    const b = M.makeOperation({ type: 'improper', n: ns, axis: [0, 0, 1] }).matrix;
    const left = powers(a), right = powers(b);
    assert.equal(left.length, right.length);
    assert.ok(left.every(matrix => right.some(other => M.matrixError(matrix, other) < 1e-8)));
  }
  const b4 = M.makeOperation({ type: 'rotoinversion', n: 4, axis: [0, 0, 1] }).matrix;
  const s4 = M.makeOperation({ type: 'improper', n: 4, axis: [0, 0, 1] }).matrix;
  assert.ok(M.matrixError(b4, s4) > 1);
  assert.ok(M.matrixError(M.multiplyMatrices(b4, s4), M.identityMatrix()) < 1e-8);
});

process.stdout.write(`${checks} educational content tests passed.\n`);
