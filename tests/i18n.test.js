'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const I = require('../i18n.js');
const root = path.resolve(__dirname, '..');
const sandbox = { window: { SymmetryI18n: I } };
for (const name of ['static', 'core', 'crystal', 'course']) vm.runInNewContext(fs.readFileSync(path.join(root, 'i18n-' + name + '.js'), 'utf8'), sandbox);
const L = require('../learning-data.js'), M = require('../math.js'), C = require('../crystal-math.js'), S = require('../course-math.js');
const P = require('../point-group-math.js');
const han = /[\u3400-\u9fff]/;
let count = 0;
function test(name, fn) { fn(); count++; console.log('✓ ' + name); }
function translated(value, context) { assert.ok(!han.test(I.t(value, 'en')), context + ': ' + I.t(value, 'en')); }
function strings(object, context) {
  if (typeof object === 'string') { if (han.test(object)) translated(object, context); }
  else if (Array.isArray(object)) object.forEach((v, i) => strings(v, context + '[' + i + ']'));
  else if (object && typeof object === 'object') Object.entries(object).forEach(([k, v]) => strings(v, context + '.' + k));
}
test('all four catalogues are registered and switching is reversible', () => {
  assert.equal(I.stats().catalogs, 4);
  I.setLanguage('en'); assert.equal(I.t('点群实验室'), 'Symmetry Lab');
  I.setLanguage('zh'); assert.equal(I.t('点群实验室'), '点群实验室');
  assert.equal(I.setLanguage('de'), false); assert.equal(I.getLanguage(), 'zh');
});
test('all 20 exercises, 16 glossary entries and 32 group descriptions have English text', () => {
  strings(L.quiz, 'quiz'); strings(L.glossary, 'glossary'); strings(L.pointGroups, 'pointGroups');
});
test('molecular names, model descriptions and operation stages have English text', () => {
  M.models.forEach(m => { translated(m.name, m.id); translated(m.description, m.id); });
  for (const type of ['E', 'rotation', 'reflection', 'inversion', 'rotoinversion', 'improper']) strings(M.makeOperation({ type, n: 3, axis: [0, 0, 1], normal: [0, 0, 1] }).stageNames, type);
});
test('all Bravais and crystal prototype descriptions have English text', () => {
  C.bravais.forEach(b => { translated(b.name, b.id); translated(b.system, b.id); });
  C.structures.forEach(s => { translated(s.name, s.id); translated(s.description, s.id); translated(s.idealization, s.id); });
});
test('all 32 complete operation menus and affine operation descriptions translate', () => {
  L.pointGroups.forEach(g => P.getGroup(g.hm).operations.forEach(op => translated(op.label, g.hm + '/' + op.id)));
  S.operations.forEach(op => { translated(op.label || op.name, op.id); translated(op.description, op.id); });
});
test('international symbols and numerical coordinates survive translation', () => {
  for (const s of ['4/mmm', '3̄m', 'S₄', 'P6₃/mmc', '(0.68, 0.22, 1.32)', 'tr R = 1 + 2cos(360°/n)']) assert.equal(I.t(s, 'en'), s);
});
test('lecture page separators adapt to English and remain reversible', () => {
  assert.equal(I.t('9–17、20、23', 'en'), '9–17, 20, 23');
  assert.equal(I.t('9–17、20、23', 'zh'), '9–17、20、23');
  assert.equal(I.t('L04 · PDF 第 18–19 页', 'en'), 'L04 · PDF pp. 18–19');
});
test('render-time numerical values are captured rather than baked into English', () => {
  for (const n of [2, 17, 48]) {
    const s = I.t('操作的阶：' + n, 'en'); translated('操作的阶：' + n, 'order'); assert.ok(s.includes(String(n)));
  }
});
test('registering one catalogue twice does not duplicate translations or patterns', () => {
  const before = I.stats(); I.register('core', { messages: { '点群实验室': 'Wrong duplicate' }, patterns: [] });
  assert.deepEqual(I.stats(), before); assert.equal(I.t('点群实验室', 'en'), 'Symmetry Lab');
});
console.log('\n' + count + ' localization checks passed.');
