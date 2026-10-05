// 通用家具 3D 模型：現有元件庫所有類型的簡化模型（局部座標：原點＝平面左上角、x∈[0,w]、z∈[0,d]、正面朝 +z、地面 y=0）
import { curveGeom, subPath } from "../shapes/curve.js";

/**
 * 建立通用模型；回傳 THREE.Group（已套用離地高度 elev），不支援的類型回傳 null。
 * ctx：{ THREE, K（kit）, M（通用材質）, mat(id), spec, itemH, itemElev, doors（0 關～1 全開） }
 */
export function buildGeneric(it, ctx) {
  const { THREE, M } = ctx;
  const f = GEN[it.type];
  const g = new THREE.Group();
  const w = it.w,
    d = it.d,
    h = ctx.itemH(it);
  const main = it.mat ? ctx.mat(it.mat) : null;
  if (f) {
    const r = f(g, w, d, h, it, ctx, main);
    if (r === null) return null;
  } else if (h > 0) ctx.K.boxAt(g, 0, 0, 0, w, h, d, main || M.offwhite);
  else return null;
  g.position.y = ctx.itemElev(it);
  return g;
}

// 共用零件
function legs(g, K, w, d, h, mat, s = 4, inset = 3) {
  for (const [x, z] of [
    [inset, inset],
    [w - inset - s, inset],
    [inset, d - inset - s],
    [w - inset - s, d - inset - s],
  ])
    K.boxAt(g, x, 0, z, s, h, s, mat);
}
function table(g, ctx, w, d, h, main, top = 3) {
  const { K, M } = ctx;
  K.boxAt(g, 0, h - top, 0, w, top, d, main || M.wood);
  legs(g, K, w, d, h - top, M.woodDark, 4.5, 4);
}
/** 櫃體：門片分割線與把手；opts.open 開放層架、opts.glass 玻璃門、opts.drawers 抽屜數、opts.slide 拉門 */
function casework(g, ctx, w, d, h, main, opts = {}) {
  const { K, M } = ctx;
  const body = main || M.white;
  const toe = opts.toe ?? (h > 60 ? 6 : 0);
  if (toe) K.boxAt(g, 2, 0, 2, w - 4, toe, d - 6, M.groove);
  if (opts.open) {
    const t = 1.8;
    K.boxAt(g, 0, toe, 0, t, h - toe, d, body);
    K.boxAt(g, w - t, toe, 0, t, h - toe, d, body);
    K.boxAt(g, 0, toe, 0, w, t, d, body);
    K.boxAt(g, 0, h - t, 0, w, t, d, body);
    K.boxAt(g, 0, toe, 0, w, h - toe, 1, body);
    const n = Math.max(1, Math.round((h - toe) / 35));
    for (let i = 1; i < n; i++) K.boxAt(g, t, toe + ((h - toe) * i) / n, 1, w - 2 * t, t, d - 1, body);
    const cols = Math.max(1, Math.round(w / 80));
    for (let i = 1; i < cols; i++) K.boxAt(g, (w * i) / cols - t / 2, toe, 1, t, h - toe, d - 1, body);
    return;
  }
  K.boxAt(g, 0, toe, 0, w, h - toe, d - 1.8, body);
  const doors = opts.drawers ? 1 : Math.max(1, Math.round(w / (opts.slide ? 90 : 45)));
  const fh = h - toe - 0.6;
  const open = Math.max(0, Math.min(1, ctx.doors || 0));
  if (opts.drawers) {
    const n = opts.drawers;
    for (let i = 0; i < n; i++) {
      const y = toe + (fh * i) / n + 0.3,
        hh = fh / n - 0.6,
        pull = open * Math.min(d * 0.6, 40) * (i === n - 1 ? 1 : 0.5);
      K.boxAt(g, 0.3, y, d - 1.8 + pull, w - 0.6, hh, 1.8, body);
      K.boxAt(g, w / 2 - 8, y + hh - 5, d + pull, 16, 1.4, 1.6, M.handle);
    }
    return;
  }
  const dw = w / doors;
  for (let i = 0; i < doors; i++) {
    const x0 = i * dw + 0.3,
      ww = dw - 0.6;
    const left = i % 2 === 0;
    const leafMat = opts.glass ? M.glassDoor : body;
    if (opts.slide) {
      const sl = (i % 2 ? -1 : 1) * open * ww * 0.5;
      K.boxAt(g, x0 + sl, toe + 0.3, d - (i % 2 ? 1.8 : 3.6), ww, fh, 1.8, leafMat);
      continue;
    }
    // 開門：以外側為鉸鏈
    const pivot = new ctx.THREE.Group();
    pivot.position.set(left ? x0 : x0 + ww, toe + 0.3, d);
    pivot.rotation.y = (left ? -1 : 1) * open * (Math.PI / 2) * 0.95;
    const leaf = K.box(ww, fh, 1.8, leafMat);
    leaf.position.set(left ? 0 : -ww, 0, -1.8);
    pivot.add(leaf);
    if (opts.glass) K.boxAt(pivot, left ? 0 : -ww, 0, -1.9, ww, 3, 2, body);
    K.boxAt(pivot, left ? ww - 4 : -ww + 2.6, fh * (h > 150 ? 0.45 : 0.75), 0, 1.4, 14, 1.6, M.handle);
    g.add(pivot);
  }
}
function bedBase(g, ctx, w, d, h, n, it, main) {
  const { K, M } = ctx;
  const frameH = Math.max(12, h - 22);
  K.boxAt(g, 0, 0, 0, w, frameH, d, main || M.wood);
  K.boxAt(g, 0, 0, 0, w, Math.min(105, h + 50), 7, main || M.woodDark);
  K.boxAt(g, 2, frameH, 7, w - 4, h - frameH, d - 9, M.mattress);
  const pw = n === 2 ? (w - 16) / 2 : Math.min(60, w - 14);
  for (let i = 0; i < n; i++) K.boxAt(g, 6 + i * (pw + 4), h, 10, pw, 11, 34, M.pillow);
  K.boxAt(g, 1, h - 6, d * 0.42, w - 2, 9, d * 0.58 - 1, M.fabricLight);
}
function sofaGen(g, ctx, w, d, h, seats, main) {
  const { K, M } = ctx;
  const fab = main || M.fabric;
  const arm = Math.min(16, w * 0.1),
    back = Math.min(20, d * 0.24),
    seatH = 44;
  legs(g, K, w, d, 8, M.woodDark, 4, 4);
  K.boxAt(g, 0, 8, 0, w, seatH - 18, d, fab);
  K.boxAt(g, arm, 8, 0, w - 2 * arm, h - 8, back, fab);
  K.boxAt(g, 0, 8, 0, arm, 62 - 8, d, fab);
  K.boxAt(g, w - arm, 8, 0, arm, 62 - 8, d, fab);
  const n = seats || Math.max(1, Math.round((w - 2 * arm) / 65));
  const cw = (w - 2 * arm) / n;
  for (let i = 0; i < n; i++) {
    K.boxAt(g, arm + i * cw + 0.8, seatH - 10, back + 1, cw - 1.6, 12, d - back - 3, M.cushion);
    K.boxAt(g, arm + i * cw + 1.5, seatH, back, cw - 3, h - seatH - 6, 14, M.cushion);
  }
}
function chairGen(g, ctx, w, d, h, main, office = false) {
  const { K, M } = ctx;
  const seat = 45;
  if (office) {
    K.cyl(g, w / 2, 0, d / 2, Math.min(w, d) * 0.42, 3, M.black, Math.min(w, d) * 0.42, 5);
    K.cyl(g, w / 2, 3, d / 2, 2.5, seat - 8, M.metal);
    K.boxAt(g, 4, seat - 6, 4, w - 8, 7, d - 8, main || M.black);
    K.boxAt(g, 6, seat, 2, w - 12, h - seat, 5, main || M.black);
    return;
  }
  legs(g, K, w, d, seat - 4, M.woodDark, 3, 2);
  K.boxAt(g, 0, seat - 4, 0, w, 4, d, main || M.wood);
  K.boxAt(g, 1, seat, 1, w - 2, h - seat, 3, main || M.wood);
}
function door3d(g, ctx, w, h, hingeLeft, open, leafMat, th = 4) {
  const { K, M, THREE } = ctx;
  const p = new THREE.Group();
  p.position.set(hingeLeft ? 0 : w, 0, 0);
  // 平面圖的門向 -z（上方）開
  p.rotation.y = (hingeLeft ? 1 : -1) * open * (Math.PI / 2);
  const leaf = K.box(w, h, th, leafMat || M.door);
  leaf.position.set(hingeLeft ? 0 : -w, 0, -th / 2);
  p.add(leaf);
  K.cyl(p, hingeLeft ? w - 7 : -w + 7, 100, th / 2 + 1, 1.2, 2, M.handle).rotation.x = Math.PI / 2;
  g.add(p);
  return p;
}
const quarter = (w, d, n = 24) => {
  const pts = [[0, 0]];
  for (let i = 0; i <= n; i++) {
    const a = ((i / n) * Math.PI) / 2;
    pts.push([w * Math.cos(a), d * Math.sin(a)]);
  }
  return pts;
};
const Lshape = (w, d, dp) => [
  [0, 0],
  [w, 0],
  [w, dp],
  [dp, dp],
  [dp, d],
  [0, d],
];

const GEN = {
  bed2: (g, w, d, h, it, c, m) => bedBase(g, c, w, d, h, 2, it, m),
  bed1: (g, w, d, h, it, c, m) => bedBase(g, c, w, d, h, 1, it, m),
  bunk(g, w, d, h, it, c, m) {
    const { K, M } = c;
    for (const [x, z] of [
      [0, 0],
      [w - 5, 0],
      [0, d - 5],
      [w - 5, d - 5],
    ])
      K.boxAt(g, x, 0, z, 5, h, 5, m || M.wood);
    for (const y of [20, 110]) {
      K.boxAt(g, 0, y, 0, w, 6, d, m || M.wood);
      K.boxAt(g, 3, y + 6, 3, w - 6, 16, d - 6, M.mattress);
    }
    K.boxAt(g, 0, 140, 0, w, 14, 3, m || M.wood);
    for (let y = 30; y < 110; y += 25) K.boxAt(g, w - 4, y, d * 0.4, 4, 3, d * 0.3, M.woodDark);
  },
  crib(g, w, d, h, it, c, m) {
    const { K, M } = c;
    K.boxAt(g, 0, 30, 0, w, 4, d, m || M.white);
    K.boxAt(g, 3, 34, 3, w - 6, 10, d - 6, M.mattress);
    for (const [x, z, sx, sz] of [
      [0, 0, w, 3],
      [0, d - 3, w, 3],
      [0, 0, 3, d],
      [w - 3, 0, 3, d],
    ])
      K.boxAt(g, x, h - 4, z, sx, 4, sz, m || M.white);
    for (let x = 6; x < w - 3; x += 9) for (const z of [0.5, d - 2.5]) K.boxAt(g, x, 30, z, 2, h - 30, 2, m || M.white);
    legs(g, K, w, d, 30, m || M.white, 4, 0);
  },
  mattress: (g, w, d, h, it, c, m) => c.K.boxAt(g, 0, 0, 0, w, h, d, m || c.M.mattress),
  tatami(g, w, d, h, it, c, m) {
    const { K, M } = c;
    K.boxAt(g, 0, 0, 0, w, h - 5, d, m || M.woodLight);
    for (let x = 0; x < w - 1; x += 90)
      for (let z = 0; z < d - 1; z += 90)
        K.boxAt(g, x + 0.5, h - 5, z + 0.5, Math.min(90, w - x) - 1, 5, Math.min(90, d - z) - 1, M.tatami);
  },
  nightstand: (g, w, d, h, it, c, m) => casework(g, c, w, d, h, m || c.M.wood, { drawers: 2, toe: 0 }),
  wardrobe: (g, w, d, h, it, c, m) => casework(g, c, w, d, h, m, {}),
  wardrobeSlide: (g, w, d, h, it, c, m) => casework(g, c, w, d, h, m, { slide: true }),
  wardrobeL(g, w, d, h, it, c, m) {
    const dp = Math.min(60, w * 0.45, d * 0.45);
    c.K.extrude(g, Lshape(w, d, dp), h, m || c.M.white);
  },
  rack(g, w, d, h, it, c, m) {
    const { K, M } = c;
    for (const x of [0, w - 3]) {
      K.boxAt(g, x, 0, 0, 3, 3, d, M.metal);
      K.boxAt(g, x, 0, d / 2 - 1.5, 3, h, 3, M.metal);
    }
    K.boxAt(g, 0, h - 4, d / 2 - 1.5, w, 3, 3, m || M.metal);
    for (let x = 10; x < w - 10; x += 14) K.boxAt(g, x, h - 90, d / 2 - 15, 4, 82, 30, M.fabricWarm);
  },
  mirror(g, w, d, h, it, c) {
    c.K.boxAt(g, 0, 0, 0, w, h, d, c.M.frameDark);
    c.K.boxAt(g, 2, 2, d, w - 4, h - 4, 0.4, c.M.mirror);
  },
  vanity(g, w, d, h, it, c, m) {
    const { K, M } = c;
    table(g, c, w, d, h, m || M.white);
    K.boxAt(g, w * 0.2, h, 0, w * 0.6, 60, 2, M.frameDark);
    K.boxAt(g, w * 0.2 + 2, h + 2, 2, w * 0.6 - 4, 56, 0.4, M.mirror);
  },
  vanityArc(g, w, d, h, it, c, m) {
    c.K.extrude(g, quarter(w, d), 4, m || c.M.white, h - 4);
    c.K.extrude(g, quarter(w * 0.9, d * 0.9), h - 4, c.M.offwhite);
  },
  sofa: (g, w, d, h, it, c, m) => sofaGen(g, c, w, d, h, it.seats, m),
  sofabed: (g, w, d, h, it, c, m) => sofaGen(g, c, w, d, h, 3, m),
  armchair: (g, w, d, h, it, c, m) => sofaGen(g, c, w, d, h, 1, m),
  sofaL(g, w, d, h, it, c, m) {
    const { K, M } = c;
    const fab = m || M.fabric;
    const dep = Math.min(90, w * 0.4, d * 0.6),
      arm = 14;
    K.extrude(g, Lshape(w, d, dep), 26, fab, 8);
    K.boxAt(g, 0, 8, 0, w, h - 8, 18, fab);
    K.boxAt(g, 0, 8, 0, 18, h - 8, d, fab);
    K.boxAt(g, w - arm, 8, 0, arm, 54, dep, fab);
    K.boxAt(g, 0, 8, d - arm, dep, 54, arm, fab);
    K.boxAt(g, 18, 34, 18, w - 18 - arm - 1, 10, dep - 20, M.cushion);
    K.boxAt(g, 18, 34, dep - 2, dep - 20, 10, d - dep - arm - 1, M.cushion);
    legs(g, K, w, dep, 8, M.woodDark, 4, 4);
  },
  chaise(g, w, d, h, it, c, m) {
    const { K, M } = c;
    legs(g, K, w, d, 10, M.woodDark, 4, 4);
    K.boxAt(g, 0, 10, 0, w, 30, d, m || M.fabric);
    const b = K.box(w, 50, 12, m || M.fabric);
    b.position.set(0, 35, 6);
    b.rotation.x = -0.45;
    g.add(b);
  },
  beanbag: (g, w, d, h, it, c, m) => c.K.sphere(g, w / 2, h * 0.45, d / 2, w / 2, h * 0.55, d / 2, m || c.M.fabricWarm),
  ottoman: (g, w, d, h, it, c, m) => c.K.cyl(g, w / 2, 0, d / 2, w / 2, h, m || c.M.fabricWarm, d / 2),
  coffee: (g, w, d, h, it, c, m) => table(g, c, w, d, h, m, 4),
  side: (g, w, d, h, it, c, m) => table(g, c, w, d, h, m, 3),
  tv(g, w, d, h, it, c, m) {
    const { K, M } = c;
    casework(g, c, w, d, h, m || M.wood, { drawers: 1, toe: 4 });
    const tw = Math.min(w * 0.85, 125);
    K.boxAt(g, w / 2 - 12, h, d * 0.3, 24, 2, 16, M.black);
    K.boxAt(g, w / 2 - 2, h + 2, d * 0.45, 4, 8, 3, M.black);
    K.boxAt(g, (w - tw) / 2, h + 8, d * 0.45, tw, tw * 0.57, 3, M.screen);
  },
  tvwall: (g, w, d, h, it, c) => c.K.boxAt(g, 0, 0, 0, w, h, d, c.M.screen),
  screen(g, w, d, h, it, c) {
    const { K, M } = c;
    K.boxAt(g, 0, 0, 0, w, Math.max(h, 6), d, M.white);
    K.boxAt(g, 6, -150, d / 2, w - 12, 150, 0.3, M.mattress);
  },
  rug: (g, w, d, h, it, c, m) => c.K.boxAt(g, 0, 0, 0, w, Math.max(h, 0.8), d, m || c.M.rug),
  rugRound: (g, w, d, h, it, c, m) => c.K.cyl(g, w / 2, 0, d / 2, w / 2, Math.max(h, 0.8), m || c.M.rug, d / 2, 40),
  plant(g, w, d, h, it, c, m) {
    const { K, M } = c;
    const r = Math.min(w, d) * 0.32;
    K.cyl(g, w / 2, 0, d / 2, r, 32, m || M.pot, r, 20, 1.15);
    K.sphere(g, w / 2, 32 + (h - 32) * 0.45, d / 2, r * 1.5, (h - 32) * 0.45, r * 1.5, M.plant);
    K.sphere(g, w / 2 + r * 0.4, 32 + (h - 32) * 0.75, d / 2 - r * 0.2, r, (h - 32) * 0.28, r, M.plant2);
  },
  floorLamp(g, w, d, h, it, c) {
    const { K, M } = c;
    K.cyl(g, w / 2, 0, d / 2, Math.min(w, d) * 0.4, 3, M.black);
    K.cyl(g, w / 2, 3, d / 2, 1.2, h - 30, M.metal);
    K.cyl(g, w / 2, h - 30, d / 2, Math.min(w, d) * 0.5, 28, M.lampShade, Math.min(w, d) * 0.5, 24, 0.7);
  },
  fridge(g, w, d, h, it, c, m) {
    const { K, M } = c;
    const mat = m || M.steel;
    K.boxAt(g, 0, 0, 0, w, h, d - 3, mat);
    const sp = h * 0.62;
    const open = Math.max(0, Math.min(1, c.doors || 0));
    const p = new c.THREE.Group();
    p.position.set(w, 0, d - 3);
    p.rotation.y = open * Math.PI * 0.45;
    K.boxAt(p, -w + 0.3, 0.3, 0, w - 0.6, sp - 0.6, 3, mat);
    K.boxAt(p, -w + 0.3, sp + 0.3, 0, w - 0.6, h - sp - 0.6, 3, mat);
    K.boxAt(p, -w + 4, sp - 40, 3, 2, 30, 2, M.handle);
    K.boxAt(p, -w + 4, sp + 6, 3, 2, 22, 2, M.handle);
    g.add(p);
  },
  appliance: (g, w, d, h, it, c, m) => casework(g, c, w, d, h, m, { drawers: 0 }),
  counter(g, w, d, h, it, c, m) {
    const { K, M } = c;
    casework(g, c, w, d - 2, h - 4, m || M.white, {});
    K.boxAt(g, 0, h - 4, 0, w, 4, d, M.offwhite);
    if (w > 150) {
      K.boxAt(g, w * 0.55, h - 3.5, d * 0.2, Math.min(70, w * 0.3), 0.5, d * 0.6, M.steel);
      K.cyl(g, w * 0.55 + Math.min(35, w * 0.15), h, d * 0.12, 1.5, 28, M.steel);
      for (const x of [w * 0.12, w * 0.3]) K.cyl(g, x, h, d * 0.5, 10, 0.6, M.black);
    }
  },
  island(g, w, d, h, it, c, m) {
    const { K, M } = c;
    casework(g, c, w, d - 25, h - 4, m || M.white, {});
    K.boxAt(g, 0, h - 4, 0, w, 4, d, M.offwhite);
  },
  dining(g, w, d, h, it, c, m) {
    table(g, c, w, d, h, m, 3);
    const n = it.chairs ?? 4,
      top = Math.ceil(n / 2),
      bot = n - top;
    const ch = (x, z, rot) => {
      const p = new c.THREE.Group();
      chairGen(p, c, 44, 46, 85);
      const q = new c.THREE.Group();
      p.position.set(-22, 0, -23);
      q.add(p);
      q.position.set(x, 0, z);
      q.rotation.y = rot;
      return c.K.shadow(q);
    };
    for (let i = 0; i < top; i++) g.add(ch(((i + 0.5) * w) / top, -14, 0));
    for (let i = 0; i < bot; i++) g.add(ch(((i + 0.5) * w) / bot, d + 14, Math.PI));
  },
  diningRound(g, w, d, h, it, c, m) {
    const { K, M } = c;
    K.cyl(g, w / 2, h - 3, d / 2, w / 2, 3, m || M.wood, d / 2, 40);
    K.cyl(g, w / 2, 0, d / 2, 4, h - 3, M.woodDark);
    K.cyl(g, w / 2, 0, d / 2, w * 0.25, 2, M.woodDark, d * 0.25);
    const n = it.chairs ?? 4;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const p = new c.THREE.Group();
      chairGen(p, c, 44, 46, 85);
      p.position.set(-22, 0, -23);
      const q = new c.THREE.Group();
      q.add(p);
      q.position.set(w / 2 + Math.sin(a) * (w / 2 + 14), 0, d / 2 + Math.cos(a) * (d / 2 + 14));
      q.rotation.y = a + Math.PI;
      g.add(q);
    }
  },
  dchair: (g, w, d, h, it, c, m) => chairGen(g, c, w, d, h, m),
  chair: (g, w, d, h, it, c, m) => chairGen(g, c, w, d, h, m, true),
  benchSeat: (g, w, d, h, it, c, m) => table(g, c, w, d, h, m, 4),
  bench(g, w, d, h, it, c, m) {
    casework(g, c, w, d, h - 8, m || c.M.white, { drawers: 1, toe: 0 });
    c.K.boxAt(g, 0, h - 8, 0, w, 8, d, c.M.fabricLight);
  },
  stool(g, w, d, h, it, c, m) {
    const { K, M } = c;
    K.cyl(g, w / 2, 0, d / 2, w * 0.4, 2, M.metal, d * 0.4);
    K.cyl(g, w / 2, 2, d / 2, 2, h - 6, M.metal);
    K.cyl(g, w / 2, h - 5, d / 2, w / 2, 5, m || M.wood, d / 2);
  },
  sideboard: (g, w, d, h, it, c, m) => casework(g, c, w, d, h, m || c.M.wood, {}),
  trash: (g, w, d, h, it, c, m) => c.K.cyl(g, w / 2, 0, d / 2, w / 2, h, m || c.M.steel, d / 2),
  desk: (g, w, d, h, it, c, m) => table(g, c, w, d, h, m || c.M.white, 2.5),
  deskFixed: (g, w, d, h, it, c, m) => table(g, c, w, d, h, m || c.M.wood, 3),
  deskLift(g, w, d, h, it, c, m) {
    const { K, M } = c;
    K.boxAt(g, 0, h - 3, 0, w, 3, d, m || M.wood);
    for (const x of [8, w - 14]) {
      K.boxAt(g, x, 0, 4, 6, 3, d - 8, M.black);
      K.boxAt(g, x, 3, d / 2 - 3, 6, h - 6, 6, M.black);
    }
    K.boxAt(g, 8, h - 8, d / 2 - 2, w - 16, 5, 4, M.black);
  },
  deskL(g, w, d, h, it, c, m) {
    const { K, M } = c;
    const dp = Math.min(60, w * 0.45, d * 0.45);
    K.extrude(g, Lshape(w, d, dp), 3, m || M.white, h - 3);
    for (const [x, z] of [
      [2, 2],
      [w - 6, 2],
      [w - 6, dp - 6],
      [2, d - 6],
      [dp - 6, d - 6],
    ])
      K.boxAt(g, x, 0, z, 4, h - 3, 4, M.metal);
  },
  bookshelf: (g, w, d, h, it, c, m) => casework(g, c, w, d, h, m || c.M.wood, { open: true, toe: 0 }),
  openShelf: (g, w, d, h, it, c, m) => casework(g, c, w, d, h, m || c.M.white, { open: true, toe: 0 }),
  drawer: (g, w, d, h, it, c, m) => casework(g, c, w, d, h, m, { drawers: 3, toe: 4 }),
  cabinet: (g, w, d, h, it, c, m) => casework(g, c, w, d, h, m, {}),
  lowcab: (g, w, d, h, it, c, m) => casework(g, c, w, d, h, m, {}),
  upper: (g, w, d, h, it, c, m) => casework(g, c, w, d, h, m, { toe: 0 }),
  shoe: (g, w, d, h, it, c, m) => casework(g, c, w, d, h, m, { toe: 10 }),
  display: (g, w, d, h, it, c, m) => casework(g, c, w, d, h, m, { glass: true }),
  screenCab: (g, w, d, h, it, c, m) => casework(g, c, w, d, h, m || c.M.wood, { open: true, toe: 0 }),
  cabinetArc(g, w, d, h, it, c, m) {
    c.K.extrude(g, quarter(w, d), h, m || c.M.white);
  },
  yogamat: (g, w, d, h, it, c, m) => c.K.boxAt(g, 0, 0, 0, w, Math.max(h, 0.6), d, m || c.M.purple),
  treadmill(g, w, d, h, it, c) {
    const { K, M } = c;
    K.boxAt(g, 0, 0, 0, w, 18, d, M.black);
    K.boxAt(g, 6, 18, 20, w - 12, 1, d - 30, M.frameDark);
    for (const x of [2, w - 6]) K.boxAt(g, x, 18, 4, 4, h - 18, 4, M.metal);
    K.boxAt(g, 0, h - 10, 0, w, 10, 18, M.black);
  },
  bike(g, w, d, h, it, c) {
    const { K, M } = c;
    K.boxAt(g, w / 2 - 20, 0, 4, 40, 4, 8, M.black);
    K.boxAt(g, w / 2 - 20, 0, d - 12, 40, 4, 8, M.black);
    K.boxAt(g, w / 2 - 3, 4, 8, 6, 6, d - 16, M.black);
    const fw = K.cyl(g, w / 2 - 2, 45, 22, 22, 4, M.metal);
    fw.rotation.z = Math.PI / 2;
    K.boxAt(g, w / 2 - 3, 10, d * 0.55, 6, h - 30, 6, M.black);
    K.boxAt(g, w / 2 - 12, h - 22, d * 0.55, 24, 6, 14, M.black);
    K.boxAt(g, w / 2 - 3, 10, 10, 6, h - 10, 6, M.black);
    K.boxAt(g, w / 2 - 22, h - 4, 6, 44, 4, 6, M.black);
  },
  dumbbell(g, w, d, h, it, c) {
    const { K, M } = c;
    K.boxAt(g, 0, 0, 0, w, 4, d, M.black);
    for (const x of [2, w - 6]) K.boxAt(g, x, 0, d / 2 - 2, 4, h, 4, M.black);
    for (const y of [h * 0.45, h * 0.85]) K.boxAt(g, 0, y, 2, w, 3, d - 4, M.black);
  },
  petbed: (g, w, d, h, it, c, m) => c.K.cyl(g, w / 2, 0, d / 2, w / 2, h, m || c.M.fabricWarm, d / 2),
  ac(g, w, d, h, it, c, m) {
    const { K, M } = c;
    K.boxAt(g, 0, 0, 0, w, h, d, m || M.white);
    K.boxAt(g, 4, 3, d, w - 8, 4, 0.5, M.groove);
  },
  curtain(g, w, d, h, it, c, m) {
    const { THREE } = c;
    const seg = Math.max(8, Math.round(w / 6));
    const geo = new THREE.PlaneGeometry(w, h, seg, 1);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin((p.getX(i) / 6) * Math.PI) * Math.min(5, d * 0.35));
    geo.translate(w / 2, h / 2, d / 2);
    geo.computeVertexNormals();
    const mm = (m || c.M.fabricLight).clone();
    mm.side = THREE.DoubleSide;
    const mesh = c.K.shadow(new THREE.Mesh(geo, mm));
    mesh.userData.ownMat = true;
    g.add(mesh);
  },
  swingDoor(g, w, d, h, it, c, m) {
    door3d(g, c, w, h, true, 0.12 + 0.88 * (c.doors || 0), m);
  },
  doubleDoor(g, w, d, h, it, c, m) {
    door3d(g, c, w / 2, h, true, 0.12 + 0.88 * (c.doors || 0), m);
    const r = new c.THREE.Group();
    r.position.x = w / 2;
    door3d(r, c, w / 2, h, false, 0.12 + 0.88 * (c.doors || 0), m);
    g.add(r);
  },
  slideDoor(g, w, d, h, it, c, m) {
    const { K, M } = c;
    const o = (c.doors || 0) * w * 0.45;
    K.boxAt(g, 0, 0, d * 0.3 - 2, w * 0.55, h, 3.5, m || M.door);
    K.boxAt(g, w * 0.45 - o, 0, d * 0.7 - 1.5, w * 0.55, h, 3.5, m || M.door);
    K.boxAt(g, 0, h, 0, w, 4, d, M.frame);
  },
  pocketDoor(g, w, d, h, it, c, m) {
    const { K, M } = c;
    const o = (c.doors || 0) * w * 0.9;
    K.boxAt(g, -o, 0, d * 0.3, w * 0.98, h, d * 0.4, m || M.door);
    K.boxAt(g, -w * 0.5, 0, 0, w * 0.5, h + 20, d, M.offwhite);
  },
  foldDoor(g, w, d, h, it, c, m) {
    const { K, M } = c;
    const n = 4,
      fold = 0.15 + 0.75 * (c.doors || 0),
      pw = w / n;
    let x = 0;
    for (let i = 0; i < n; i++) {
      const a = (i % 2 ? -1 : 1) * fold;
      const p = K.box(pw, h, 2.5, m || M.door);
      p.position.set(x, 0, i % 2 ? -Math.sin(fold) * pw : 0);
      p.rotation.y = a;
      g.add(p);
      x += pw * Math.cos(fold);
    }
  },
  slideDoorArc(g, w, d, h, it, c, m) {
    const pt = (u, k) => {
      const a = (u * Math.PI) / 2;
      return [(w - k) * Math.sin(a), d - (d - k) * Math.cos(a)];
    };
    const arc = (u1, u2, k) => Array.from({ length: 25 }, (_, i) => pt(u1 + ((u2 - u1) * i) / 24, k));
    const s = (c.doors || 0) * 0.4;
    c.K.strip(g, arc(0, 0.56 - s, 3), 3, h, m || c.M.door);
    c.K.strip(g, arc(0.44 + s, 1, 9), 3, h, m || c.M.door);
  },
  curveSlide(g, w, d, h, it, c, m) {
    const cg = curveGeom(it),
      o = cg.t * 0.22,
      L = cg.len,
      s = (c.doors || 0) * 0.4;
    c.K.strip(g, subPath(cg.pts, 0, L * (0.56 - s), o), 3, h, m || c.M.door);
    c.K.strip(g, subPath(cg.pts, L * (0.44 + s), L, -o), 3, h, m || c.M.door);
    c.K.strip(g, cg.pts, cg.t, 4, c.M.frame, h);
  },
  curveWall(g, w, d, h, it, c, m) {
    const cg = curveGeom(it);
    c.K.strip(g, cg.pts, cg.t, h, m || c.mat(c.spec.wallMat));
  },
  curveGlass(g, w, d, h, it, c) {
    const cg = curveGeom(it);
    c.K.strip(g, cg.pts, Math.max(1, cg.t - 4), h - 8, c.M.glassClear, 4);
    c.K.strip(g, cg.pts, cg.t, 4, c.M.frameDark);
    c.K.strip(g, cg.pts, cg.t, 4, c.M.frameDark, h - 4);
  },
  wallArc(g, w, d, h, it, c, m) {
    const t = Math.min(it.thick || 12, w - 1, d - 1),
      n = 32,
      pts = [];
    for (let i = 0; i <= n; i++) {
      const a = ((i / n) * Math.PI) / 2;
      pts.push([w * Math.sin(a), d - d * Math.cos(a)]);
    }
    for (let i = n; i >= 0; i--) {
      const a = ((i / n) * Math.PI) / 2;
      pts.push([(w - t) * Math.sin(a), d - (d - t) * Math.cos(a)]);
    }
    c.K.extrude(g, pts, h, m || c.mat(c.spec.wallMat));
  },
  wall: (g, w, d, h, it, c, m) => c.K.boxAt(g, 0, 0, 0, w, h, d, m || c.mat(c.spec.wallMat)),
  halfWall: (g, w, d, h, it, c, m) => c.K.boxAt(g, 0, 0, 0, w, h, d, m || c.mat(c.spec.wallMat)),
  column: (g, w, d, h, it, c, m) => c.K.boxAt(g, 0, 0, 0, w, h, d, m || c.M.column),
  glassWall(g, w, d, h, it, c) {
    const { K, M } = c;
    K.boxAt(g, 0, 0, 0, w, 4, d, M.frameDark);
    K.boxAt(g, 0, h - 4, 0, w, 4, d, M.frameDark);
    K.boxAt(g, 0, 4, d / 2 - 0.6, w, h - 8, 1.2, M.glassClear);
    const n = Math.max(1, Math.round(w / 100));
    for (let i = 0; i <= n; i++) K.boxAt(g, Math.min(w - 4, (w * i) / n - (i ? 2 : 0)), 4, 0, 4, h - 8, d, M.frameDark);
  },
  dimension: () => null,
  text: () => null,
};
