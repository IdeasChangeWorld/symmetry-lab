/* Direction stereograms and invariant ordinary polar tensors.
 * Cartesian orthonormal coordinates; this is not a Miller-index conversion.
 * Hemisphere convention: upper poles project from the south pole, lower
 * poles from the north pole. Both are represented inside the equatorial disk.
 */
(function (root, factory) {
  'use strict';
  const common = typeof module === 'object' && module.exports;
  const api = factory(common ? require('./math.js') : root.SymmetryMath,
    common ? require('./point-group-math.js') : root.SymmetryPointGroups);
  if (common) module.exports = api;
  if (root) root.SymmetryAdvanced = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (M, P) {
  'use strict';
  if (!M || !P) throw new Error('SymmetryAdvanced requires SymmetryMath and SymmetryPointGroups.');
  const EPS = 1e-8;
  const clean = v => Math.abs(v) < 1e-12 ? 0 : v;
  const zeroMatrix = () => Array.from({ length: 3 }, () => [0, 0, 0]);
  const group = hm => {
    const value = P.getGroup(hm);
    if (!value) throw new RangeError('Unknown crystallographic point group: ' + hm);
    return value;
  };
  function direction(p) {
    if (!Array.isArray(p) || p.length !== 3 || !p.every(Number.isFinite) || M.norm(p) < 1e-12) throw new RangeError('A direction must be a finite nonzero three-vector.');
    return M.normalize(p).map(clean);
  }
  function projectPole(p) {
    const q = direction(p), denominator = 1 + Math.abs(q[2]);
    return { x: clean(q[0] / denominator), y: clean(q[1] / denominator),
      hemisphere: Math.abs(q[2]) < EPS ? 'equator' : q[2] > 0 ? 'upper' : 'lower' };
  }
  function unprojectPole(x, y, hemisphere = 'upper') {
    if (![x, y].every(Number.isFinite) || x * x + y * y > 1 + EPS || !['upper', 'lower', 'equator'].includes(hemisphere)) throw new RangeError('A pole must be inside the unit disk and have a valid hemisphere.');
    const r2 = x * x + y * y;
    if (hemisphere === 'equator' && Math.abs(r2 - 1) > EPS) throw new RangeError('An equatorial pole must be on the primitive circle.');
    return direction([2 * x / (1 + r2), 2 * y / (1 + r2), (hemisphere === 'lower' ? -1 : 1) * Math.max(0, 1 - r2) / (1 + r2)]);
  }
  function directionFromAngles(polarDegrees, azimuthDegrees) {
    if (![polarDegrees, azimuthDegrees].every(Number.isFinite) || polarDegrees < 0 || polarDegrees > 180) throw new RangeError('Polar angle must be between 0 and 180 degrees.');
    const theta = polarDegrees * Math.PI / 180, phi = azimuthDegrees * Math.PI / 180;
    return direction([Math.sin(theta) * Math.cos(phi), Math.sin(theta) * Math.sin(phi), Math.cos(theta)]);
  }
  function poleOrbit(hm, seed) {
    const p = direction(seed), result = [];
    group(hm).operations.forEach((operation, operationIndex) => {
      const q = direction(M.applyMatrix(operation.matrix, p));
      let item = result.find(point => M.distance(point.direction, q) < EPS);
      if (!item) {
        item = { id: result.length, direction: q, projection: projectPole(q), operationIndices: [] };
        result.push(item);
      }
      item.operationIndices.push(operationIndex);
    });
    return result;
  }
  function mirrorGreatCircle(normal, samples = 240) {
    const n = direction(normal);
    if (!Number.isInteger(samples) || samples < 12 || samples > 4000) throw new RangeError('A great circle needs between 12 and 4000 samples.');
    const helper = Math.abs(n[2]) < .85 ? [0, 0, 1] : [1, 0, 0];
    const u = direction(M.cross(n, helper)), v = direction(M.cross(n, u));
    const points = Array.from({ length: samples + 1 }, (_, i) => {
      const t = 2 * Math.PI * i / samples;
      const q = direction(M.add(M.scale(u, Math.cos(t)), M.scale(v, Math.sin(t))));
      return { direction: q, projection: projectPole(q) };
    });
    if (points.every(p => p.projection.hemisphere === 'equator')) return { normal: n, points, paths: [{ hemisphere: 'equator', points }] };
    const paths = [];
    let current = null;
    for (let i = 0; i < points.length; i++) {
      const item = points[i], previous = points[i - 1];
      let hemisphere = item.projection.hemisphere;
      if (hemisphere === 'equator') hemisphere = current ? current.hemisphere : points.find(p => p.projection.hemisphere !== 'equator').projection.hemisphere;
      if (!current) { current = { hemisphere, points: [item] }; paths.push(current); continue; }
      if (hemisphere !== current.hemisphere) {
        let crossing = previous;
        if (previous.projection.hemisphere !== 'equator') {
          const fraction = previous.direction[2] / (previous.direction[2] - item.direction[2]);
          const q = direction(M.add(M.scale(previous.direction, 1 - fraction), M.scale(item.direction, fraction)));
          crossing = { direction: q, projection: projectPole(q) };
          current.points.push(crossing);
        }
        current = { hemisphere, points: [crossing] }; paths.push(current);
      }
      current.points.push(item);
    }
    if (paths.length > 1 && paths[0].hemisphere === paths[paths.length - 1].hemisphere) {
      const last = paths.pop(); paths[0].points = last.points.concat(paths[0].points.slice(1));
    }
    return { normal: n, points, paths };
  }
  function polarProjector(hm) {
    const operations = group(hm).operations, result = zeroMatrix();
    operations.forEach(op => op.matrix.forEach((row, i) => row.forEach((value, j) => { result[i][j] += value / operations.length; })));
    return result.map(row => row.map(clean));
  }
  function invariantTensor(hm, tensor) {
    if (!Array.isArray(tensor) || tensor.length !== 3 || !tensor.every(row => Array.isArray(row) && row.length === 3 && row.every(Number.isFinite))) throw new RangeError('A tensor must be a finite 3 by 3 matrix.');
    // The UI studies symmetric ordinary rank-two polar tensors. First take the
    // symmetric part, then apply the Reynolds projection over the finite group.
    const symmetric = tensor.map((row, i) => row.map((value, j) => (value + tensor[j][i]) / 2));
    const operations = group(hm).operations, result = zeroMatrix();
    operations.forEach(op => {
      const transformed = M.multiplyMatrices(M.multiplyMatrices(op.matrix, symmetric), M.transpose(op.matrix));
      transformed.forEach((row, i) => row.forEach((value, j) => { result[i][j] += value / operations.length; }));
    });
    return result.map(row => row.map(clean));
  }
  function subgroup(parentHm, childHm, orientation) {
    const parent = group(parentHm), child = group(childHm);
    if (orientation && (orientation.length !== 3 || !orientation.every(row => Array.isArray(row) && row.length === 3 && row.every(Number.isFinite)) || M.matrixError(M.multiplyMatrices(M.transpose(orientation), orientation), M.identityMatrix()) > EPS)) throw new RangeError('The embedding orientation must be an orthogonal matrix.');
    const indices = [], missing = [];
    child.operations.forEach((operation, childIndex) => {
      const matrix = orientation ? M.multiplyMatrices(M.multiplyMatrices(orientation, operation.matrix), M.transpose(orientation)) : operation.matrix;
      const index = parent.operations.findIndex(item => M.matrixError(item.matrix, matrix) < EPS);
      if (index < 0) missing.push(childIndex); else indices.push(index);
    });
    return { isSubgroup: missing.length === 0, indices, missing, index: missing.length ? null : parent.operations.length / child.operations.length };
  }
  return { direction, projectPole, unprojectPole, directionFromAngles, poleOrbit, mirrorGreatCircle, polarProjector, invariantTensor, subgroup };
});
