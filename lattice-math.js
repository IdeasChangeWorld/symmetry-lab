(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CrystallographicLattice = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SQRT3 = Math.sqrt(3);
  const HEIGHT = 0.9;
  const MATRIX_TOLERANCE = 1e-8;

  function validateKind(kind) {
    if (kind !== 'square' && kind !== 'hexagonal') throw new RangeError('Lattice kind must be square or hexagonal.');
  }

  function validateOrder(n) {
    if (!Number.isSafeInteger(n) || n < 1) throw new RangeError('Rotation order must be a positive safe integer.');
  }

  function validateVector(p) {
    if (!Array.isArray(p) || p.length !== 3 || !p.every(Number.isFinite)) throw new TypeError('Coordinates must contain three finite numbers.');
  }

  // The returned array contains three basis vectors, not matrix rows.
  // B = [a b c] has these vectors as columns.
  function basis(kind) {
    validateKind(kind);
    return [[1, 0, 0], kind === 'square' ? [0, 1, 0] : [0.5, SQRT3 / 2, 0], [0, 0, HEIGHT]];
  }

  function toCartesian(kind, coefficients) {
    validateKind(kind);
    validateVector(coefficients);
    const [i, j, k] = coefficients;
    return kind === 'square' ? [i, j, HEIGHT * k] : [i + j / 2, SQRT3 * j / 2, HEIGHT * k];
  }

  function toLatticeCoordinates(kind, point) {
    validateKind(kind);
    validateVector(point);
    const [x, y, z] = point;
    return kind === 'square' ? [x, y, z / HEIGHT] : [x - y / SQRT3, 2 * y / SQRT3, z / HEIGHT];
  }

  function rotate(point, angle) {
    validateVector(point);
    if (!Number.isFinite(angle)) throw new TypeError('Rotation angle must be finite and expressed in radians.');
    const c = Math.cos(angle), s = Math.sin(angle);
    return [c * point[0] - s * point[1], s * point[0] + c * point[1], point[2]];
  }

  // A proper rotation in 3D has eigenvalues 1, exp(i theta), exp(-i theta).
  // Thus its trace is 1 + 2 cos(theta), independent of the lattice basis.
  function traceForOrder(n) {
    validateOrder(n);
    return 1 + 2 * Math.cos(2 * Math.PI / n);
  }

  function isAllowedOrder(n) {
    validateOrder(n);
    // An exact set avoids accepting a large n whose computed trace rounds to 3.
    return n === 1 || n === 2 || n === 3 || n === 4 || n === 6;
  }

  function recommendedKind(n) {
    validateOrder(n);
    return n === 1 || n === 2 || n === 4 ? 'square' : 'hexagonal';
  }

  function rotationInBasis(kind, n) {
    validateOrder(n);
    const angle = 2 * Math.PI / n;
    const columns = basis(kind).map(vector => toLatticeCoordinates(kind, rotate(vector, angle)));
    // Row-major representation of B^-1 R B, matching SymmetryMath matrices.
    return [0, 1, 2].map(row => columns.map(column => column[row]));
  }

  function supportsRotation(kind, n) {
    const matrix = rotationInBasis(kind, n);
    // Integral entries and det A = det R = 1 make A a bijection on Z^3.
    // The universal restriction also guards near-identity numerical rounding.
    return isAllowedOrder(n) && matrix.every(row => row.every(value => Math.abs(value - Math.round(value)) <= MATRIX_TOLERANCE));
  }

  function isLatticePoint(kind, point, tolerance = MATRIX_TOLERANCE) {
    if (!Number.isFinite(tolerance) || tolerance < 0) throw new RangeError('Lattice-coordinate tolerance must be finite and nonnegative.');
    return toLatticeCoordinates(kind, point).every(value => Math.abs(value - Math.round(value)) <= tolerance);
  }

  function samplePoints(kind, radius = 2.25, layers = [-1, 0, 1]) {
    validateKind(kind);
    if (!Number.isFinite(radius) || radius < 0) throw new RangeError('Display radius must be finite and nonnegative.');
    if (!Array.isArray(layers) || !layers.every(Number.isSafeInteger)) throw new TypeError('Layers must be an array of integer lattice indices.');
    // For a hexagonal basis, |j| <= 2r/sqrt(3) and |i| <= r+r/sqrt(3).
    // 2r therefore bounds both indices; the radial filter defines the window.
    const bound = Math.ceil(kind === 'square' ? radius : 2 * radius);
    if (!Number.isSafeInteger(bound)) throw new RangeError('Display radius is too large to enumerate integer indices.');
    const radiusSquared = radius * radius;
    const boundaryTolerance = 1e-12 * Math.max(1, radiusSquared);
    const uniqueLayers = Array.from(new Set(layers));
    const points = [];
    for (let i = -bound; i <= bound; i++) {
      for (let j = -bound; j <= bound; j++) {
        const x = kind === 'square' ? i : i + j / 2;
        const y = kind === 'square' ? j : SQRT3 * j / 2;
        if (x * x + y * y > radiusSquared + boundaryTolerance) continue;
        for (const k of uniqueLayers) {
          points.push({ indices: [i || 0, j || 0, k || 0], position: [x || 0, y || 0, HEIGHT * k || 0] });
        }
      }
    }
    return points;
  }

  return { basis, toCartesian, toLatticeCoordinates, rotate, traceForOrder, isAllowedOrder, recommendedKind, rotationInBasis, supportsRotation, isLatticePoint, samplePoints };
});
