'use strict';
const assert=require('node:assert/strict');
const C=require('../course-math.js'), M=require('../math.js');
let count=0;
function test(name,fn){fn();count++;console.log('✓ '+name);}
test('screw powers produce the correct whole-cell translation, while the linear part closes',()=>{
  for(const op of C.operations.filter(o=>o.type==='screw')){
    const q=C.repeat(op,C.seed,op.n);
    assert.ok(M.distance(q,M.add(C.seed,[0,0,op.n*op.step]))<1e-8,op.id);
    let power=M.identityMatrix();for(let i=0;i<op.n;i++)power=M.multiplyMatrices(op.matrix,power);
    assert.ok(M.matrixError(power,M.identityMatrix())<1e-8);
    assert.ok(M.distance(q,C.seed)>.9);
  }
});
test('mirror squares to identity and glide squares to its parallel lattice translation',()=>{
  for(const id of ['mirror','a','n']){
    const op=C.getOperation(id),q=C.repeat(op,C.seed,2);
    assert.ok(M.distance(q,M.add(C.seed,M.scale(op.translation,2)))<1e-8);
    assert.equal(M.determinant(op.matrix),-1);
    assert.equal(op.translation[2],0);
  }
});
test('two-stage animation has exact endpoints and an untranslated middle stage',()=>{
  for(const op of C.operations){
    assert.ok(M.distance(C.animate(op,C.seed,0),C.seed)<1e-8);
    assert.ok(M.distance(C.animate(op,C.seed,1),C.apply(op,C.seed))<1e-8);
    if(op.type!=='translation') assert.ok(M.distance(C.animate(op,C.seed,.5),M.applyMatrix(op.matrix,C.seed))<1e-8);
  }
});
test('affine examples reject unknown operations and non-integral repeats',()=>{
  assert.throws(()=>C.getOperation('bad'));assert.throws(()=>C.repeat(C.operations[0],C.seed,.5));
});
console.log(count+' affine operation tests passed.');
