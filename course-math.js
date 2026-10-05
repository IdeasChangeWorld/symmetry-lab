/* Small, exact affine-operation examples. Cartesian coordinates; the c translation has unit length. */
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./math.js') : root.SymmetryMath);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SymmetryCourse = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (M) {
  'use strict';
  const operations = [
    {id:'translation',label:'t · 沿 c 平移',n:1,step:1,type:'translation',pointLabel:'E',description:'每次沿 c 方向移动一个周期。纯平移的线性部分是恒等操作。'},
    {id:'21',label:'2₁ · 二重螺旋轴',n:2,step:1/2,type:'screw',pointLabel:'2',description:'绕 z 轴旋转 180°，再沿 c 平移 1/2。两次后旋转回原朝向，并移动一个周期。'},
    {id:'31',label:'3₁ · 三重螺旋轴',n:3,step:1/3,type:'screw',pointLabel:'3',description:'每次旋转 120°，沿 c 平移 1/3；三次后移动一个周期。'},
    {id:'32',label:'3₂ · 三重螺旋轴',n:3,step:2/3,type:'screw',pointLabel:'3',description:'每次旋转 120°，沿 c 平移 2/3；三次后移动两个周期。'},
    {id:'41',label:'4₁ · 四重螺旋轴',n:4,step:1/4,type:'screw',pointLabel:'4',description:'每次旋转 90°，沿 c 平移 1/4；四次后移动一个周期。'},
    {id:'63',label:'6₃ · 六重螺旋轴',n:6,step:1/2,type:'screw',pointLabel:'6',description:'每次旋转 60°，沿 c 平移 1/2；六次后移动三个周期。HCP 的空间群符号含 6₃。'},
    {id:'mirror',label:'m · 普通镜映',n:2,step:0,type:'glide',pointLabel:'m',description:'关于 z = 0 镜映，无平移。两次后真正回到原坐标。'},
    {id:'a',label:'a · 滑移面',n:2,step:1/2,type:'glide',pointLabel:'m',description:'先关于 z = 0 镜映，再沿 a 平移 1/2。两次后移动一个 a 周期。'},
    {id:'n',label:'n · 对角滑移面',n:2,step:1/2,type:'glide',pointLabel:'m',description:'先关于 z = 0 镜映，再平行于面移动 (a + b)/2。两次后移动 a + b。'}
  ].map(op => {
    const matrix = op.type === 'screw' ? M.rotationMatrix([0,0,1], 2*Math.PI/op.n) : op.type === 'glide' ? M.reflectionMatrix([0,0,1]) : M.identityMatrix();
    const translation = op.type === 'glide' ? [op.step,op.id === 'n' ? op.step : 0,0] : [0,0,op.step];
    return {...op,matrix,translation};
  });
  function getOperation(id) { const op=operations.find(o=>o.id===id); if(!op) throw new RangeError('Unknown affine example'); return op; }
  function apply(op,p) { return M.add(M.applyMatrix(op.matrix,p),op.translation); }
  function repeat(op,p,count) {
    if(!Number.isInteger(count)||count<0||count>1000) throw new RangeError('Repeat count must be an integer from 0 to 1000');
    let q=p.slice(); for(let i=0;i<count;i++)q=apply(op,q); return q;
  }
  function animate(op,p,t) {
    const u=M.clamp(t,0,1);
    if(op.type==='translation') return M.add(p,M.scale(op.translation,u));
    const half=Math.min(1,u*2);
    const q=op.type==='screw' ? M.applyMatrix(M.rotationMatrix([0,0,1],2*Math.PI/op.n*half),p) : M.add(M.scale(p,1-half),M.scale(M.applyMatrix(op.matrix,p),half));
    return M.add(q,M.scale(op.translation,Math.max(0,u*2-1)));
  }
  const seed=[.68,.22,.32];
  return {operations,getOperation,apply,repeat,animate,seed};
});
