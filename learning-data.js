/* Offline teaching content. ASCII '-' before a digit means a crystallographic overbar. */
(function (root, factory) {
  'use strict';
  var data = factory();
  if (typeof module === 'object' && module.exports) module.exports = data;
  root.SymmetryLearning = data;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var pointGroups = [
    { hm: '1', schoenflies: 'C1', system: '三斜', order: 1, centrosymmetric: false, chiral: true, note: '只包含恒等操作 E。' },
    { hm: '-1', schoenflies: 'Ci', system: '三斜', order: 2, centrosymmetric: true, chiral: false, note: 'E 与中心反演 i；也可写 S2。' },
    { hm: '2', schoenflies: 'C2', system: '单斜', order: 2, centrosymmetric: false, chiral: true, note: '一个二重旋转轴，基本旋转角为 180°。' },
    { hm: 'm', schoenflies: 'Cs', system: '单斜', order: 2, centrosymmetric: false, chiral: false, note: 'E 与一个镜面反射 σ；m 等价于二重旋转反演。' },
    { hm: '2/m', schoenflies: 'C2h', system: '单斜', order: 4, centrosymmetric: true, chiral: false, note: '二重轴与垂直于轴的镜面组合，自动产生反演。' },
    { hm: '222', schoenflies: 'D2', system: '正交', order: 4, centrosymmetric: false, chiral: true, note: '三条互相垂直的二重轴。' },
    { hm: 'mm2', schoenflies: 'C2v', system: '正交', order: 4, centrosymmetric: false, chiral: false, note: '两个互相垂直的镜面相交于二重轴。' },
    { hm: 'mmm', schoenflies: 'D2h', system: '正交', order: 8, centrosymmetric: true, chiral: false, note: '三个互相垂直的镜面，并包含三个二重轴及反演。' },
    { hm: '4', schoenflies: 'C4', system: '四方', order: 4, centrosymmetric: false, chiral: true, note: '四重轴产生 E、C4、C4²、C4³。' },
    { hm: '-4', schoenflies: 'S4', system: '四方', order: 4, centrosymmetric: false, chiral: false, note: '四重旋转反演；单独没有中心反演或镜面。与 S4 生成同一点群，单次操作的旋转方向需留意。' },
    { hm: '4/m', schoenflies: 'C4h', system: '四方', order: 8, centrosymmetric: true, chiral: false, note: '四重轴与垂直于主轴的镜面；包含中心反演。' },
    { hm: '422', schoenflies: 'D4', system: '四方', order: 8, centrosymmetric: false, chiral: true, note: '四重主轴及四条与主轴垂直的二重轴。' },
    { hm: '4mm', schoenflies: 'C4v', system: '四方', order: 8, centrosymmetric: false, chiral: false, note: '四重主轴与四个包含主轴的镜面。' },
    { hm: '-42m', schoenflies: 'D2d', system: '四方', order: 8, centrosymmetric: false, chiral: false, note: '四重旋转反演、横向二重轴与对角镜面；另有 -4m2 方位写法。' },
    { hm: '4/mmm', schoenflies: 'D4h', system: '四方', order: 16, centrosymmetric: true, chiral: false, note: '四方晶系的最高点群对称性，共 16 个操作。' },
    { hm: '3', schoenflies: 'C3', system: '三方', order: 3, centrosymmetric: false, chiral: true, note: '三重轴，基本旋转角为 120°。' },
    { hm: '-3', schoenflies: 'C3i', system: '三方', order: 6, centrosymmetric: true, chiral: false, note: '三重旋转反演重复三次得到 i；此点群也写 S6。' },
    { hm: '32', schoenflies: 'D3', system: '三方', order: 6, centrosymmetric: false, chiral: true, note: '三重主轴及三条垂直二重轴；α-石英所属的晶体点群。' },
    { hm: '3m', schoenflies: 'C3v', system: '三方', order: 6, centrosymmetric: false, chiral: false, note: '三重主轴与三个包含主轴的镜面。' },
    { hm: '-3m', schoenflies: 'D3d', system: '三方', order: 12, centrosymmetric: true, chiral: false, note: '三重旋转反演、横向二重轴与镜面；含中心反演。' },
    { hm: '6', schoenflies: 'C6', system: '六方', order: 6, centrosymmetric: false, chiral: true, note: '六重轴，基本旋转角为 60°，也包含三重与二重旋转。' },
    { hm: '-6', schoenflies: 'C3h', system: '六方', order: 6, centrosymmetric: false, chiral: false, note: '六重旋转反演生成三重旋转及垂直于主轴的镜面，但不含 i。' },
    { hm: '6/m', schoenflies: 'C6h', system: '六方', order: 12, centrosymmetric: true, chiral: false, note: '六重轴与垂直于主轴的镜面；包含中心反演。' },
    { hm: '622', schoenflies: 'D6', system: '六方', order: 12, centrosymmetric: false, chiral: true, note: '六重主轴及六条与主轴垂直的二重轴。' },
    { hm: '6mm', schoenflies: 'C6v', system: '六方', order: 12, centrosymmetric: false, chiral: false, note: '六重主轴与六个包含主轴的镜面。' },
    { hm: '-62m', schoenflies: 'D3h', system: '六方', order: 12, centrosymmetric: false, chiral: false, note: '含三重旋转、横向二重轴，以及包含主轴和垂直于主轴的镜面；另有 -6m2 方位写法。' },
    { hm: '6/mmm', schoenflies: 'D6h', system: '六方', order: 24, centrosymmetric: true, chiral: false, note: '六方晶系的最高点群对称性，共 24 个操作。' },
    { hm: '23', schoenflies: 'T', system: '立方', order: 12, centrosymmetric: false, chiral: true, note: '正四面体的纯旋转群：三个二重轴及四个三重轴。' },
    { hm: 'm-3', schoenflies: 'Th', system: '立方', order: 24, centrosymmetric: true, chiral: false, note: '在 T 的纯旋转操作上加入反演及其复合操作。' },
    { hm: '432', schoenflies: 'O', system: '立方', order: 24, centrosymmetric: false, chiral: true, note: '立方体或正八面体的纯旋转群。' },
    { hm: '-43m', schoenflies: 'Td', system: '立方', order: 24, centrosymmetric: false, chiral: false, note: '正四面体的完整对称群；包含镜面及旋转反演，不含 i。' },
    { hm: 'm-3m', schoenflies: 'Oh', system: '立方', order: 48, centrosymmetric: true, chiral: false, note: '立方体或正八面体的完整对称群，共 48 个操作。' }
  ];

  var quiz = [
    {
      id: 'identity', question: '恒等操作 E 的作用是什么？',
      options: ['所有坐标保持不变', '每个原子移动到对面的原子位置', '绕任意轴旋转 180°', '只让原点保持不变'], answer: 0,
      explanation: 'E 把每个点映射到自身。任何点群都包含 E；绕同一轴旋转完整的 360° 也得到 E。'
    },
    {
      id: 'rotation', question: '一次 C₄ 操作的基本旋转角是多少？',
      options: ['45°', '90°', '120°', '180°'], answer: 1,
      explanation: 'Cₙ 的基本角为 360°/n，因此 C₄ 为 90°。轴上所有点不动，轴外的点沿圆周移动。'
    },
    {
      id: 'mirror', question: '点 (1, 2, 3) 关于 yz 镜面反射后在哪里？',
      options: ['(−1, −2, −3)', '(1, −2, 3)', '(−1, 2, 3)', '(1, 2, −3)'], answer: 2,
      explanation: 'yz 镜面是 x = 0 的平面，反射只改变垂直于镜面的 x 分量：σyz(x,y,z) = (−x,y,z)。'
    },
    {
      id: 'inversion', question: '以原点为中心，点 (1, 2, 3) 经反演 i 后在哪里？',
      options: ['(−1, −2, −3)', '(−1, 2, 3)', '(1, −2, −3)', '(3, 2, 1)'], answer: 0,
      explanation: '反演使相对于反演中心的三个坐标全部变号。它等价于沿穿过中心的直线移到另一侧等距处。'
    },
    {
      id: 'improper-notation', question: '分子对称性 Sₙ 与晶体学 n̄ 的定义，哪项正确？',
      options: ['二者都是旋转后再中心反演', 'Sₙ 是旋转后再关于垂直于轴的镜面反射；n̄ 是旋转后再中心反演', 'Sₙ 是单独旋转，n̄ 是单独镜面反射', '下标相同，两个单次操作就必然相同'], answer: 1,
      explanation: '两种记号描述不同的复合方式。S₁ = σ，S₂ = i；1̄ = i，2̄ = m。3̄ 点群与 S₆ 点群对应，但不能把所有同下标操作直接等同。'
    },
    {
      id: 'fixed-point', question: '“点群的所有操作有一个共同固定点”意味着什么？',
      options: ['每个原子都必须原地不动', '至少有一个空间位置在所有操作下不变，其他点可以互换', '整个物体只能有一个点不动', '原子不能交换位置'], answer: 1,
      explanation: '共同固定点可选作坐标原点，但不一定有原子占据它。点群可以固定更多点：Cₙ 固定整条轴，Cₛ 固定整个镜面。'
    },
    {
      id: 'endpoint', question: '动画旋转到一半时模型没有重合，但完成 C₃ 后同类原子全部重合。C₃ 是该模型的对称操作吗？',
      options: ['不是，中途必须始终重合', '是，判断完整操作后的结构是否与初始结构不可区分', '只有所有原子回到自己的编号位置才算', '任何旋转都算'], answer: 1,
      explanation: '判断离散对称操作只看完整操作的结果。原子编号与跟踪高亮用于教学；物理对称性要求同类原子、键与所表示的结构等价。动画中间状态用于解释运动。'
    },
    {
      id: 'crystallographic-restriction', question: '为什么可以演示分子或有限几何模型的 C₅，却不能把它列入普通三维周期晶体的 32 点群？',
      options: ['C₅ 在数学上不存在', '有限模型允许五重旋转，而周期晶格的旋转重数限制为 1、2、3、4、6', '五重旋转只适用于镜面', '32 点群遗漏了 C₅'], answer: 1,
      explanation: '晶体学限制适用于三维平移周期晶格。有限分子或几何模型可有五重对称；准晶涉及不同的结构框架，不在这张周期晶体点群表内。'
    },
    {
      id: 'group-order', question: '纯旋转点群 C₄ = {E, C₄, C₄², C₄³} 的群阶是多少？',
      options: ['1，因为只有一根轴', '3，因为 E 不计入', '4，因为有四个不同操作', '90，因为旋转角为 90°'], answer: 2,
      explanation: '群阶 |G| 统计群中不同操作的数目，包含 E。轴数、旋转角和群阶是不同概念。C₄⁴ = E，不是第五个操作。'
    },
    {
      id: 'composition', question: '本项目使用列向量 r′ = AB r。操作 AB 按什么顺序执行？',
      options: ['先 A，再 B', '先 B，再 A', '把 A 与 B 的矩阵逐项相加', '任何顺序都相同'], answer: 1,
      explanation: '矩阵最右边先作用于列向量，因此 AB r = A(B r)。一般 AB ≠ BA；同轴旋转等特殊情况可以交换，不能推广到所有操作。'
    }
  ];

  var glossary = [
    { term: '对称操作', definition: '使所表示的物体在操作完成后与初始结构不可区分的变换；同类原子可以相互交换。' },
    { term: '对称元素', definition: '描述操作所依托的几何位置，如旋转轴、镜面或反演中心；应与实际执行的操作区分。' },
    { term: '点群', definition: '在复合运算下构成群、并具有至少一个共同固定点的对称操作集合；此处将该点选为原点。' },
    { term: '群阶 |G|', definition: '群中不同对称操作的总数，包括恒等操作 E；不等于对称轴的数目。' },
    { term: '生成元', definition: '通过反复复合和取逆，就能得到群中所有操作的一组操作；同一点群可选不同的生成元。' },
    { term: '复合 AB', definition: '采用列向量约定时，先执行 B，再执行 A。操作满足结合律，但不一定满足交换律。' },
    { term: '正操作与非正操作', definition: '正操作保持空间手性，三维正交矩阵的行列式为 +1；非正操作改变空间手性，行列式为 −1。' },
    { term: '中心对称', definition: '群中包含单独的中心反演 i。旋转反演使用某个反演点，不代表 i 本身也属于该群。' }
  ];

  var cautions = [
    '对称性检查比较完整结构的最终状态。同类原子的编号可以交换；不同元素、键关系或人为赋予的物理标记不能任意交换。',
    '动画是坐标映射的教学过程。镜面反射、反演或其插值不是分子的真实刚体运动；中间形状不必保持键长或具有对称性。',
    '点群要求至少一个共同固定点，并非所有原子固定，也不要求恰好只有一个点固定。共同固定点可能不被原子占据。',
    '教材中“n-fold axis has n symmetry elements”宜理解为它生成 n 个不同旋转操作；同一根轴不是 n 根几何轴。',
    'Sₙ：旋转 360°/n 后关于垂直于轴的平面反射。n̄：旋转 360°/n 后关于轴上的点反演。两个分步骤不一定各自是模型的对称操作。',
    'n̄ 中的反演点不自动成为模型的反演中心。例如 4̄ 点群不含 i，而 3̄ 点群包含 i。4̄ 与 S₄ 生成相同点群，但采用同向 90° 旋转时它们是互逆操作。',
    '表中 HM 用 ASCII 前缀 - 代替紧随其后数字的上横线；它不是负数。-42m 与 -4m2、-62m 与 -6m2 表示不同轴方位下同类点群。',
    '32 项是三维周期晶体的点群类型。一般有限分子点群还包含 C₅、D₅h、Ih 以及线性分子的无限点群等。',
    'chiral = true 表示该点群只含正旋转，可作为手性物体的完整点群；不能据此断言组成晶体的每个分子本身一定手性。',
    '晶体点群、位置的位点对称群与晶格点群有区别。物体放进晶胞后的结构可能比晶格本身的对称性低。'
  ];

  var sources = [
    { title: 'IUCr：How to read Volume A of International Tables for Crystallography（2010），Table 2：32 点群及两套记号', url: 'https://journals.iucr.org/j/issues/2010/05/02/kk5061/index.html' },
    { title: 'IUCr：Fundamental motifs and parity within the crystallographic point groups（2025），Tables 2、5：群阶', url: 'https://journals.iucr.org/j/issues/2025/04/00/dv5024/' },
    { title: 'IUCr 在线晶体学词典：Point group（共同固定点与晶体学限制）', url: 'https://dictionary.iucr.org/Point_group' },
    { title: 'IUCr：Symmetry（旋转反演与 Schoenflies 旋转反射的区别）', url: 'https://www.iucr.org/what-we-do/education/pamphlets/symmetry' },
    { title: 'IUCr：Matrices, mappings, and crystallographic symmetry（反演、反射与矩阵映射）', url: 'https://www.iucr.org/what-we-do/education/pamphlets/matrices-mappings-and-crystallographic-symmetry' },
    { title: 'IUCr International Tables for Crystallography, Volume A（11 个中心对称点群）', url: 'https://it.iucr.org/Ac/itac.pdf' }
  ];

  return {
    pointGroups: pointGroups,
    crystalSystems: ['三斜', '单斜', '正交', '四方', '三方', '六方', '立方'],
    quiz: quiz,
    glossary: glossary,
    cautions: cautions,
    teachingCautions: cautions,
    sources: sources,
    notation: { hm: 'Hermann–Mauguin（晶体学）', schoenflies: 'Schoenflies（常用于分子对称性）', overbar: 'HM 中 -n 表示 n̄', composition: '列向量：AB 表示先 B 后 A' },
    lectureReference: { title: 'L03_SymmetryOperations-Groups-Lattices.pdf', relevantTopics: '点对称、晶体学限制、镜面、反演、旋转反演、群公理、32 点群', note: '依据用户提供的讲义安排内容；定义采用至少一个共同固定点。' }
  };
});
