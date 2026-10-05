'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const C = require('../crystal-math.js');
const M = require('../math.js');
let checks = 0;
function test(name, fn) { fn(); checks++; process.stdout.write('✓ ' + name + '\n'); }
const near = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) <= tolerance, `${a} differs from ${b}`);
const nearVector = (a, b, tolerance = 1e-8) => { assert.equal(a.length, b.length); a.forEach((value, i) => near(value, b[i], tolerance)); };
const wrap = x => ((x % 1) + 1) % 1;
const equalPeriodic = (a, b, tolerance = 1e-7) => a.every((value, i) => Math.abs(value - b[i] - Math.round(value - b[i])) < tolerance);
const expected = {
  sc: [1, 1, { Po: 1 }, { Po: 6 }],
  bcc: [2, 1, { Fe: 2 }, { Fe: 8 }],
  fcc: [4, 1, { Cu: 4 }, { Cu: 12 }],
  hcp: [2, 2, { Mg: 2 }, { Mg: 12 }],
  diamond: [8, 2, { C: 8 }, { C: 4 }],
  graphite: [4, 4, { C: 4 }, { C: 3 }],
  nacl: [8, 2, { Na: 4, Cl: 4 }, { Na: 6, Cl: 6 }],
  cscl: [2, 2, { Cs: 1, Cl: 1 }, { Cs: 8, Cl: 8 }],
  nias: [4, 4, { Ni: 2, As: 2 }, { Ni: 6, As: 6 }],
  zincblende: [8, 2, { Zn: 4, S: 4 }, { Zn: 4, S: 4 }],
  wurtzite: [4, 4, { Zn: 2, S: 2 }, { Zn: 4, S: 4 }],
  cdi2: [3, 3, { Cd: 1, I: 2 }, { Cd: 6, I: 3 }],
  cdcl2: [9, 3, { Cd: 3, Cl: 6 }, { Cd: 6, Cl: 3 }],
  rutile: [6, 6, { Ti: 2, O: 4 }, { Ti: 6, O: 3 }],
  anatase: [12, 6, { Ti: 4, O: 8 }, { Ti: 6, O: 3 }],
  fluorite: [12, 3, { Ca: 4, F: 8 }, { Ca: 8, F: 4 }],
  antifluorite: [12, 3, { O: 4, Li: 8 }, { O: 8, Li: 4 }]
};

test('ideal prototypes have explicit species, half-open motifs, stoichiometry and cell counts', () => {
  assert.equal(C.structures.length, Object.keys(expected).length);
  assert.equal(new Set(C.structures.map(s => s.id)).size, C.structures.length);
  for (const s of C.structures) {
    const [conventional, primitive, counts] = expected[s.id];
    assert.equal(s.atoms.length, conventional, s.id);
    assert.equal(s.cellAtomCount, conventional, s.id);
    assert.equal(s.primitiveAtomCount, primitive, s.id);
    assert.deepEqual(s.speciesCounts, counts, s.id);
    assert.equal(s.parameters.a, 1);
    assert.match(s.units, /不是实验测量/);
    assert.ok(s.idealization.length > 5);
    assert.ok(s.spaceGroup && s.pointGroup && Number.isInteger(s.spaceGroupNumber));
    assert.ok(s.lecturePages.length && s.lecturePages.every(p => Number.isInteger(p) && p >= 1 && p <= 67));
    assert.equal(new Set(s.atoms.map(a => a.id)).size, conventional);
    for (const atom of s.atoms) {
      assert.ok(atom.frac.every(x => x >= 0 && x < 1), s.id + ' ' + atom.id);
      assert.ok(!s.atoms.some(other => other !== atom && M.distance(other.frac, atom.frac) < 1e-8), s.id + ' has coincident atoms');
    }
  }
});

test('all 14 Bravais cells are independent and 3D coordinate transforms round-trip', () => {
  assert.deepEqual(C.bravais.map(b => b.id), ['aP', 'mP', 'mC', 'oP', 'oC', 'oI', 'oF', 'tP', 'tI', 'hP', 'hR', 'cP', 'cI', 'cF']);
  for (const def of C.bravais.concat(C.structures)) {
    assert.ok(C.cellVolume(def) > 0);
    for (const frac of [[0, 0, 0], [1, -2, 3], [-0.3, 1.25, 2.8]]) {
      nearVector(C.toFractional(def, C.toCartesian(def, frac)), frac);
      nearVector(C.toCartesian(def.basis, frac), C.toCartesian(def, frac));
    }
    near(C.cellVolume(def.basis) / C.cellVolume(def.primitiveBasis), def.centeringMultiplicity);
  }
  const rhombohedral = C.bravais.find(b => b.id === 'hR');
  const lengths = rhombohedral.primitiveBasis.map(M.norm);
  near(lengths[0], lengths[1]); near(lengths[1], lengths[2]);
  const cosines = [[0, 1], [1, 2], [2, 0]].map(([i, j]) => M.dot(rhombohedral.primitiveBasis[i], rhombohedral.primitiveBasis[j]) / lengths[i] / lengths[j]);
  near(cosines[0], cosines[1]); near(cosines[1], cosines[2]);
});

test('F/I/R/C centerings are actual type-preserving translations, and primitive volumes and counts agree', () => {
  for (const [centering, count] of Object.entries({ P: 1, I: 2, F: 4, C: 2, R: 3 })) {
    assert.equal(C.getCenterings(centering).length, count);
    const copy = C.getCenterings(centering); copy[0][0] = 99;
    assert.equal(C.getCenterings(centering)[0][0], 0);
  }
  for (const s of C.structures) {
    for (const translation of s.centerings) for (const atom of s.atoms) {
      const target = M.add(atom.frac, translation);
      assert.ok(s.atoms.some(other => other.species === atom.species && equalPeriodic(target, other.frac)), s.id);
    }
    const primitive = C.primitiveStructure(s);
    assert.equal(primitive.atoms.length, s.primitiveAtomCount, s.id);
    assert.equal(primitive.centering, 'P');
    assert.equal(primitive.centeringMultiplicity, 1);
    assert.equal(primitive.sourceCentering, s.centering);
    near(C.cellVolume(s) / C.cellVolume(primitive), s.centeringMultiplicity);
    for (const [species, count] of Object.entries(s.speciesCounts)) assert.equal(primitive.speciesCounts[species], count / s.centeringMultiplicity);
    for (const atom of primitive.atoms) {
      assert.ok(atom.frac.every(x => x >= 0 && x < 1));
      const oldFrac = C.toFractional(s, C.toCartesian(primitive, atom.frac));
      assert.ok(s.atoms.some(other => other.species === atom.species && equalPeriodic(oldFrac, other.frac)), s.id);
    }
    assert.equal(C.primitiveStructure(primitive).atoms.length, primitive.atoms.length);
  }
});

test('CsCl is primitive; HCP is a two-atom primitive cell; species distinguish diamond and zincblende', () => {
  const cscl = C.getStructure('cscl');
  assert.equal(cscl.centering, 'P');
  const shiftedCs = M.add(cscl.atoms[0].frac, [0.5, 0.5, 0.5]);
  assert.ok(cscl.atoms.some(a => a.species === 'Cl' && equalPeriodic(a.frac, shiftedCs)));
  assert.ok(!cscl.atoms.some(a => a.species === 'Cs' && equalPeriodic(a.frac, shiftedCs)));
  const hcp = C.getStructure('hcp');
  assert.equal(hcp.primitiveAtomCount, 2);
  assert.equal(hcp.hexPrismAtomCount, 3 * hcp.primitiveAtomCount);
  assert.equal(hcp.centering, 'P');
  assert.equal(C.getStructure('diamond').pointGroup, 'm-3m');
  assert.equal(C.getStructure('zincblende').pointGroup, '-43m');
  const d = C.getStructure('diamond'), z = C.getStructure('zincblende');
  assert.ok(d.atoms.every(a => z.atoms.some(b => equalPeriodic(a.frac, b.frac))));
  assert.equal(new Set(d.atoms.map(a => a.species)).size, 1);
  assert.equal(new Set(z.atoms.map(a => a.species)).size, 2);
});

test('periodic coordination gives the chemical first shell for every motif atom', () => {
  for (const s of C.structures) for (let index = 0; index < s.atoms.length; index++) {
    const atom = s.atoms[index], result = C.coordination(s, index);
    assert.equal(result.count, expected[s.id][3][atom.species], s.id + ':' + atom.id);
    assert.equal(Object.values(result.bySpecies).reduce((sum, n) => sum + n, 0), result.count);
    assert.equal(result.center.species, atom.species);
    assert.equal(result.center.atomIndex, index);
    nearVector(result.center.position, C.toCartesian(s, atom.frac));
    for (const neighbor of result.neighbors) {
      nearVector(neighbor.position, C.toCartesian(s, neighbor.frac));
      near(neighbor.distance, M.distance(neighbor.position, result.center.position));
      assert.ok(neighbor.distance > 0 && neighbor.distance <= result.nearestDistance * result.shellRatio + 1e-8);
      if (s.speciesCounts && Object.keys(s.speciesCounts).length === 2) assert.notEqual(neighbor.species, atom.species, s.id);
    }
  }
});

test('distorted rutile and anatase shells include both 4 short and 2 longer bonds', () => {
  for (const id of ['rutile', 'anatase']) {
    const s = C.getStructure(id), result = C.coordination(s, 0);
    assert.equal(result.count, 6);
    assert.equal(C.coordination(s, 0, { shellRatio: 1.000001 }).count, 4);
    assert.ok(result.distanceRange[1] > result.distanceRange[0] * 1.01);
    assert.ok(result.distanceRange[1] < result.distanceRange[0] * 1.12);
    assert.deepEqual(result.bySpecies, { O: 6 });
  }
  const graphite = C.coordination('graphite');
  assert.equal(graphite.count, 3);
  assert.ok(graphite.neighbors.every(a => Math.abs(a.position[2] - graphite.center.position[2]) < 1e-8));
});

test('coordination comes from the infinite crystal, independent of a display crop or chosen cell', () => {
  assert.equal(C.sampleStructure('sc').atoms.length, 1);
  const sc = C.coordination('sc');
  assert.equal(sc.count, 6);
  assert.ok(sc.neighbors.some(n => n.translation[0] === -1));
  assert.ok(sc.neighbors.some(n => n.translation[0] === 1));
  for (const id of ['bcc', 'fcc', 'nacl', 'cdcl2', 'anatase', 'fluorite']) {
    const s = C.getStructure(id), p = C.primitiveStructure(s);
    for (let index = 0; index < p.atoms.length; index++) {
      const old = s.atoms.findIndex(a => a.id === p.atoms[index].id);
      const left = C.coordination(s, old), right = C.coordination(p, index);
      assert.equal(left.count, right.count, id);
      assert.deepEqual(left.bySpecies, right.bySpecies, id);
      near(left.nearestDistance, right.nearestDistance);
      near(left.distanceRange[1], right.distanceRange[1]);
    }
  }
  const translated = C.coordinationAt('nacl', [5, -3, 2]);
  assert.equal(translated.count, 6);
  assert.deepEqual(translated.bySpecies, { Cl: 6 });
  assert.deepEqual(C.coordination('nacl', 0, { species: 'Na' }).bySpecies, { Na: 12 });
  assert.equal(C.coordination('nacl', 0, { species: 'missing' }).count, 0);
});

test('reciprocal-coordinate bounds include neighbors in very skew primitive cells', () => {
  const skew = { basis: [[1, 0, 0], [0.999, 0.02, 0], [0, 0, 1.3]], atoms: [{ id: 'X', species: 'X', frac: [0, 0, 0] }], shellRatio: 1.01 };
  const neighbors = C.neighborsWithin(skew, 0, 0.025);
  assert.equal(neighbors.length, 2);
  assert.deepEqual(neighbors.map(n => n.translation.join(',')).sort(), ['-1,1,0', '1,-1,0']);
  neighbors.forEach(n => near(n.distance, Math.sqrt(0.001 ** 2 + 0.02 ** 2)));
});

test('sampling uses half-open conventional or primitive cells without duplicate boundary atoms', () => {
  for (const id of ['sc', 'fcc', 'hcp', 'cdcl2', 'anatase']) for (const primitive of [false, true]) {
    const s = primitive ? C.primitiveStructure(id) : C.getStructure(id);
    const result = C.sampleStructure(s, [2, 3, 2]);
    assert.equal(result.atoms.length, 12 * s.cellAtomCount);
    assert.equal(new Set(result.atoms.map(a => a.id)).size, result.atoms.length);
    for (const atom of result.atoms) {
      atom.frac.forEach((x, i) => assert.ok(x >= 0 && x < result.repeats[i]));
      nearVector(atom.position, C.toCartesian(s, atom.frac));
    }
    result.cellVectors.forEach((v, i) => nearVector(v, M.scale(s.basis[i], result.repeats[i])));
  }
});

test('same coordination number can give different polyhedra: NiAs octahedron versus trigonal prism', () => {
  const s = C.getStructure('nias');
  const nickel = C.coordination(s, s.atoms.findIndex(a => a.species === 'Ni')).polyhedron;
  const arsenic = C.coordination(s, s.atoms.findIndex(a => a.species === 'As')).polyhedron;
  assert.deepEqual(nickel.faces.map(face => face.length).sort(), [3, 3, 3, 3, 3, 3, 3, 3]);
  assert.equal(nickel.edges.length, 12);
  assert.deepEqual(arsenic.faces.map(face => face.length).sort(), [3, 3, 4, 4, 4]);
  assert.equal(arsenic.edges.length, 9);
  for (const poly of [nickel, arsenic]) assert.equal(poly.vertices.length - poly.edges.length + poly.faces.length, 2);
});

test('convex polyhedra preserve polygonal faces, edges and Euler relation', () => {
  for (const [id, vertices, edges, faces] of [['diamond', 4, 6, 4], ['sc', 6, 12, 8], ['bcc', 8, 12, 6], ['fcc', 12, 24, 14]]) {
    const poly = C.coordination(id).polyhedron;
    assert.equal(poly.vertices.length, vertices);
    assert.equal(poly.edges.length, edges);
    assert.equal(poly.faces.length, faces);
    assert.equal(vertices - edges + faces, 2);
    for (const face of poly.faces) assert.equal(new Set(face).size, face.length);
  }
  const fcc = C.coordination('fcc').polyhedron;
  assert.equal(fcc.faces.filter(f => f.length === 3).length, 8);
  assert.equal(fcc.faces.filter(f => f.length === 4).length, 6);
  assert.deepEqual(C.polyhedronFor([]), { vertices: [], faces: [], edges: [] });
  assert.equal(C.coordination('graphite').polyhedron.edges.length, 3);
});

test('FCC contains eight tetrahedral and four octahedral sites per conventional cell', () => {
  assert.equal(C.fccInterstitialSites.tetrahedral.length, 8);
  assert.equal(C.fccInterstitialSites.octahedral.length, 4);
  const sphereR = C.getStructure('fcc').hardSphereRadius;
  for (const [kind, sites] of Object.entries(C.fccInterstitialSites)) {
    const expectedCount = kind === 'tetrahedral' ? 4 : 6;
    const radiusSite = C.radiusSites.find(site => site.id === kind);
    for (const frac of sites) {
      const result = C.coordinationAt('fcc', frac);
      assert.equal(result.count, expectedCount);
      assert.deepEqual(result.bySpecies, { Cu: expectedCount });
      near(result.nearestDistance / sphereR - 1, radiusSite.criticalRatio);
    }
  }
  const cations = C.getStructure('fluorite').atoms.filter(a => a.species === 'Ca');
  const anions = C.getStructure('fluorite').atoms.filter(a => a.species === 'F');
  assert.equal(cations.length, 4); assert.equal(anions.length, 8);
  assert.ok(anions.every(a => C.fccInterstitialSites.tetrahedral.some(frac => equalPeriodic(a.frac, frac))));
});

test('hard-sphere radius ratios follow simultaneous central and neighboring sphere contact', () => {
  const ratios = { tetrahedral: Math.sqrt(1.5) - 1, octahedral: Math.sqrt(2) - 1, cubic: Math.sqrt(3) - 1 };
  for (const site of C.radiusSites) {
    near(site.criticalRatio, ratios[site.id]);
    assert.equal(site.shell.length, site.coordination);
    const distances = [];
    for (let i = 0; i < site.shell.length; i++) {
      near(M.norm(site.shell[i]), 1 + site.criticalRatio);
      for (let j = i + 1; j < site.shell.length; j++) distances.push(M.distance(site.shell[i], site.shell[j]));
    }
    near(Math.min(...distances), 2);
    assert.ok(distances.every(d => d >= 2 - 1e-8));
    assert.equal(site.polyhedron.vertices.length - site.polyhedron.edges.length + site.polyhedron.faces.length, 2);
  }
  near(C.radiusSites[0].criticalRatio, 0.2247448714);
  near(C.radiusSites[1].criticalRatio, 0.4142135624);
  near(C.radiusSites[2].criticalRatio, 0.7320508076);
});

test('packing fractions use primitive/conventional volume consistently', () => {
  for (const id of ['sc', 'bcc', 'fcc', 'hcp']) {
    const s = C.getStructure(id), p = C.primitiveStructure(s);
    const sphereVolume = 4 * Math.PI * s.hardSphereRadius ** 3 / 3;
    near(s.cellAtomCount * sphereVolume / C.cellVolume(s), s.packingFactor);
    near(p.cellAtomCount * sphereVolume / C.cellVolume(p), s.packingFactor);
  }
  near(C.getStructure('fcc').packingFactor, C.getStructure('hcp').packingFactor);
  assert.ok(C.getStructure('bcc').packingFactor < C.getStructure('fcc').packingFactor);
});

test('ABAB and ABCABC layers have 6 in-plane plus 3 above and 3 below sphere contacts', () => {
  for (const sequence of ['AB', 'ABAB', 'ABC', 'ABCABC']) {
    const result = C.closePackedLayers({ sequence, layers: 7, extent: 3, radius: 0.6 });
    near(result.height, Math.sqrt(8 / 3) * 0.6);
    assert.equal(result.atoms.length, 7 * 49);
    assert.deepEqual(result.layers.map(l => l.label), Array.from({ length: 7 }, (_, i) => sequence[i % sequence.length]));
    for (let layer = 1; layer < 6; layer++) {
      const center = result.atoms.find(atom => atom.layer === layer && atom.indices[0] === 0 && atom.indices[1] === 0);
      const distances = result.atoms.filter(a => a !== center).map(a => ({ atom: a, distance: M.distance(center.position, a.position) }));
      assert.ok(distances.every(d => d.distance >= 1.2 - 1e-8));
      const contacts = distances.filter(d => Math.abs(d.distance - 1.2) < 1e-8);
      assert.equal(contacts.length, 12, sequence + ' layer ' + layer);
      assert.equal(contacts.filter(d => d.atom.layer === layer).length, 6);
      assert.equal(contacts.filter(d => d.atom.layer === layer + 1).length, 3);
      assert.equal(contacts.filter(d => d.atom.layer === layer - 1).length, 3);
    }
    const l0 = result.layers[0], l2 = result.layers[2], l3 = result.layers[3];
    if (sequence.startsWith('ABAB') || sequence === 'AB') nearVector(l0.offset, l2.offset);
    else { nearVector(l0.offset, l3.offset); assert.ok(M.distance(l0.offset, l2.offset) > 0.1); }
  }
});

test('illegal basis vectors, structures, coordinates and neighbor/sampling parameters fail explicitly', () => {
  assert.equal(C.getStructure('unknown'), null);
  for (const fn of [C.primitiveStructure, C.sampleStructure, C.coordination]) assert.throws(() => fn('unknown'), RangeError);
  assert.throws(() => C.toCartesian([[1, 0, 0], [2, 0, 0], [0, 0, 1]], [0, 0, 0]), RangeError);
  assert.throws(() => C.toCartesian(C.getStructure('fcc'), [0, NaN, 0]), TypeError);
  assert.throws(() => C.toFractional(C.getStructure('fcc'), [0, 0]), TypeError);
  for (const symbol of ['A', 'B', 'Z', '']) assert.throws(() => C.getCenterings(symbol), RangeError);
  for (const index of [-1, 1.5, 100, NaN]) assert.throws(() => C.coordination('sc', index), RangeError);
  for (const cutoff of [0, -1, NaN, Infinity]) assert.throws(() => C.neighborsWithin('sc', 0, cutoff), RangeError);
  for (const shellRatio of [0, 0.9, NaN, Infinity]) assert.throws(() => C.coordination('sc', 0, { shellRatio }), RangeError);
  for (const repeats of [[0, 1, 1], [1, 1], [1, 2.5, 1], [1, Infinity, 1], '2']) assert.throws(() => C.sampleStructure('fcc', repeats), RangeError);
  for (const options of [{ sequence: 'AA' }, { sequence: 'ABCA' }, { sequence: 'ABD' }, { sequence: 2 }, { layers: 0 }, { layers: 1.5 }, { extent: -1 }, { radius: 0 }, { radius: Infinity }]) assert.throws(() => C.closePackedLayers(options), RangeError);
});

test('the dependency-free browser UMD exposes the same crystal library', () => {
  const context = vm.createContext({ SymmetryMath: M });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../crystal-math.js'), 'utf8'), context);
  assert.equal(context.SymmetryCrystals.structures.length, C.structures.length);
  assert.equal(context.SymmetryCrystals.coordination('fcc').count, 12);
  assert.equal(context.SymmetryCrystals.primitiveStructure('cdcl2').cellAtomCount, 3);
  assert.throws(() => vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../crystal-math.js'), 'utf8')), /requires SymmetryMath/);
});

process.stdout.write(`\n${checks} crystal tests passed.\n`);
