// 櫃體參數模型：分格版面、板件清單（cabParts）、門抽、裁切清單、五金、板材統計
// 局部座標（cm）：x 沿櫃寬 0..w（面對正面左→右）、y 自櫃底往上（3D 再加 elev）、z 深度 0＝背面..d＝正面
import { t } from "../core/i18n.js";
import { DEFAULTS } from "../shapes/library.js";
import { allMats, getMat } from "../materials/index.js";
import { itemH } from "../ext/heights.js";
import { CAB_DEFAULTS } from "./catalog.js";

export const CAB_TYPES = new Set([
  "cabBase",
  "cabWall",
  "cabTall",
  "cabWardrobe",
  "cabTV",
  "cabShoe",
  "cabBook",
  "cabIsland",
  "cabVanity",
  "cabDesk",
  "cabBench",
  "cabFull",
]);
export const isCab = it => !!it && CAB_TYPES.has(it.type);

/** 材質欄位對應的材質分類（找不到指定 id 時，用同分類的第一個材質） */
export const MAT_CATS = {
  carcassMat: ["laminate", "wood"],
  doorMat: ["laminate", "wood", "paint"],
  interiorMat: ["laminate", "wood"],
  handleMat: ["metal"],
  glassMat: ["glass"],
  top: ["countertop", "stone"],
};
export function resolveMat(id, cats) {
  const all = allMats();
  if (all.some(m => m.id === id)) return id;
  const c = all.find(m => cats.includes(m.cat));
  return c ? c.id : id;
}
const clone = o => JSON.parse(JSON.stringify(o));

/** 取得（必要時建立）物件的櫃體參數 it.cab */
export function ensureCab(it) {
  if (it.cab && Array.isArray(it.cab.sections) && it.cab.sections.length) return it.cab;
  const def = DEFAULTS[it.type] || {};
  const c = clone(def.cab || CAB_DEFAULTS);
  for (const k of ["carcassMat", "doorMat", "interiorMat", "handleMat", "glassMat"])
    c[k] = resolveMat(c[k], MAT_CATS[k]);
  if (c.top) c.top.mat = resolveMat(c.top.mat, MAT_CATS.top);
  it.cab = c;
  return c;
}
export function cfg(it) {
  return { ...CAB_DEFAULTS, ...ensureCab(it) };
}

/** 分格類型 */
export const KINDS = [
  ["door2", "雙開門"],
  ["door1L", "單開門（左鉸）"],
  ["door1R", "單開門（右鉸）"],
  ["drawer", "抽屜"],
  ["open", "開放層架"],
  ["glass", "玻璃門"],
  ["slide", "拉門"],
  ["hang", "吊衣區"],
  ["lift", "上掀門"],
  ["appliance", "電器櫃位"],
  ["niche", "開放凹槽"],
  ["knee", "腳下空間（無底板）"],
];
export const kindName = k => t((KINDS.find(x => x[0] === k) || KINDS[0])[1]);
const DOORISH = new Set(["door2", "door1L", "door1R", "glass", "slide", "lift"]);

/** 版面：分格位置、櫃身尺寸 */
export function cabLayout(it) {
  const c = cfg(it);
  const w = it.w,
    d = it.d,
    h = itemH(it);
  const T = c.thk,
    bt = c.backThk,
    dt = c.doorThk ?? T;
  const topT = c.top ? +c.top.thk || 0 : 0,
    ov = c.top ? Math.max(0, +c.top.overhang || 0) : 0;
  const ch = Math.max(10, h - topT);
  const inset = c.overlay === "inset";
  const anySlide = c.sections.some(s => s.kind === "slide" || s.front === "slide");
  const front = anySlide ? 2 * dt + 1 : inset ? 0 : dt;
  const cd = Math.max(10, d - ov - front);
  const x0 = Math.max(0, +c.fillerL || 0),
    W = Math.max(10, w - x0 - Math.max(0, +c.fillerR || 0));
  const toe = Math.max(0, Math.min(+c.toe || 0, ch / 3));
  // 分格寬度：w>0 為指定寬（中心到中心），0 平分剩餘
  const fixed = c.sections.map(s => (+s.w > 0 ? +s.w : 0)),
    nFree = fixed.filter(v => !v).length;
  let fsum = fixed.reduce((a, b) => a + b, 0);
  const minFree = nFree * 15;
  const k = fsum > 0 && fsum > W - minFree ? Math.max(0.05, (W - minFree) / fsum) : nFree ? 1 : W / (fsum || 1);
  const ws = fixed.map(v => v * k);
  fsum = ws.reduce((a, b) => a + b, 0);
  const free = nFree ? Math.max(0, W - fsum) / nFree : 0;
  const widths = ws.map(v => v || free);
  const xs = [x0];
  widths.forEach(v => xs.push(xs[xs.length - 1] + v));
  xs[xs.length - 1] = x0 + W;
  return { c, w, d, h, T, bt, dt, topT, ov, ch, cd, front, inset, x0, W, toe, xs, widths, yb: toe + T, yt: ch - T };
}
/** 第 i 格的內部開口 x 範圍 */
function opening(L, i) {
  const n = L.c.sections.length;
  return [L.xs[i] + (i === 0 ? L.T : L.T / 2), L.xs[i + 1] - (i === n - 1 ? L.T : L.T / 2)];
}
const slideLen = depth => [55, 50, 45, 40, 35, 30, 25].find(v => v <= depth) || Math.max(15, Math.floor(depth));

const EDGE = {
  side: [1, 0],
  top: [1, 0],
  bottom: [1, 0],
  shelf: [1, 0],
  divider: [1, 0],
  toe: [1, 0],
  back: [0, 0],
  door: [2, 2],
  drawerFront: [2, 2],
  filler: [2, 2],
  drawerSide: [1, 0],
  drawerBottom: [0, 0],
};

/**
 * 門與抽屜（正面元素）：doors [{ x1,x2,y1,y2,z1,z2, hinge: L|R|T|S, kind: door|glass|lift|slide, sec }]、
 * drawers [{ x1,x2,y1,y2,z1,z2, sec, box: { x1,x2,y1,y2,z1,z2 } }]
 */
export function cabFronts(it) {
  const L = cabLayout(it),
    { c, toe, ch, cd, dt, inset } = L,
    g = +c.gap || 0.3;
  const doors = [],
    drawers = [],
    zones = [];
  const zF = inset ? [cd - dt, cd] : [cd, cd + dt];
  c.sections.forEach((s, i) => {
    const [ox1, ox2] = opening(L, i);
    const fx1 = inset ? ox1 + g : L.xs[i] + g / 2,
      fx2 = inset ? ox2 - g : L.xs[i + 1] - g / 2;
    const fy1 = inset ? L.yb + g : (toe > 0 ? toe : 0) + g / 2,
      fy2 = inset ? L.yt - g : ch - g / 2;
    const kind = s.kind;
    const frontKind = kind === "hang" ? s.front || (ox2 - ox1 >= 70 ? "door2" : "door1L") : kind;
    const upperKind = kind === "appliance" ? s.upper || null : null;
    let ySplit = fy1;
    const dr = kind === "drawer" ? 0 : Math.max(0, Math.round(+s.dr || 0));
    const addDrawers = (y1, y2, n) => {
      const fh = (y2 - y1) / n;
      for (let j = 0; j < n; j++) {
        const a = y1 + j * fh + g / 2,
          b = y1 + (j + 1) * fh - g / 2;
        const depth = cd - L.bt - (inset ? dt : 0) - 1;
        const len = slideLen(depth),
          bz2 = cd - (inset ? dt : 0) - 0.5;
        drawers.push({
          x1: fx1,
          x2: fx2,
          y1: a,
          y2: b,
          z1: zF[0],
          z2: zF[1],
          sec: i,
          box: {
            x1: ox1 + 1.3,
            x2: ox2 - 1.3,
            y1: a + 1.5,
            y2: Math.max(a + 6, b - 4),
            z1: bz2 - len,
            z2: bz2,
          },
          len,
        });
      }
    };
    if (kind === "drawer") addDrawers(fy1, fy2, Math.max(1, Math.round(+s.n || 1)));
    if (dr) {
      ySplit = fy1 + dr * 20;
      addDrawers(fy1, ySplit, dr);
      ySplit += g / 2;
    }
    zones.push({ sec: i, ox1, ox2, y1: dr ? ySplit + L.T : L.yb, y2: L.yt, split: dr ? ySplit : null });
    let df = DOORISH.has(frontKind) ? frontKind : null;
    if (upperKind && DOORISH.has(upperKind)) df = upperKind;
    if (kind === "appliance" && !upperKind) df = null;
    let dy1 = dr ? ySplit + g / 2 : fy1,
      dy2 = fy2;
    const D = (x1, x2, hinge, k = "door", z = zF) =>
      doors.push({ x1, x2, y1: dy1, y2: dy2, z1: z[0], z2: z[1], hinge, kind: k, sec: i });
    const put = df => {
      if (df === "door1L") D(fx1, fx2, "L");
      else if (df === "door1R") D(fx1, fx2, "R");
      else if (df === "door2") {
        const m = (fx1 + fx2) / 2;
        D(fx1, m - g / 2, "L");
        D(m + g / 2, fx2, "R");
      }
    };
    // 電器櫃：下方（抽屜或下櫃門），中段開放放電器，上方門
    if (kind === "appliance") {
      const lowK = DOORISH.has(s.lower) && ["door1L", "door1R", "door2"].includes(s.lower) ? s.lower : null;
      if (lowK) {
        const lh = Math.max(20, Math.min(+s.lowerH || 80, fy2 - dy1 - 40));
        dy2 = dy1 + lh - g / 2;
        put(lowK);
        zones[zones.length - 1].lowTop = dy2 + g / 2;
        dy1 = dy2 + g;
        dy2 = fy2;
      }
      dy1 = Math.max(dy1, fy2 - Math.max(20, +s.upperH || Math.max(35, (fy2 - fy1) * 0.3)));
    }
    if (!df) return;
    if (dy1 >= fy2 - 5) return;
    if (df === "door1L") D(fx1, fx2, "L");
    else if (df === "door1R") D(fx1, fx2, "R");
    else if (df === "door2") {
      const m = (fx1 + fx2) / 2;
      D(fx1, m - g / 2, "L");
      D(m + g / 2, fx2, "R");
    } else if (df === "glass") {
      if (fx2 - fx1 > 65) {
        const m = (fx1 + fx2) / 2;
        D(fx1, m - g / 2, "L", "glass");
        D(m + g / 2, fx2, "R", "glass");
      } else D(fx1, fx2, "L", "glass");
    } else if (df === "lift") D(fx1, fx2, "T", "lift");
    else if (df === "slide") {
      const m = (fx1 + fx2) / 2,
        lap = 1.5;
      D(fx1, m + lap, "S", "slide", [cd, cd + dt]);
      D(m - lap, fx2, "S", "slide", [cd + dt + 1, cd + 2 * dt + 1]);
    }
  });
  return { L, doors, drawers, zones };
}

/** 板件清單（含檯面、吊衣桿、玻璃）——3D、裁切清單、工程圖共用 */
export function cabParts(it) {
  const { L, doors, drawers, zones } = cabFronts(it);
  const { c, T, bt, ch, cd, toe, x0, W, xs, h, topT, w, d } = L;
  const parts = [];
  const P = (name, role, x, y, z, sx, sy, sz, mat, extra = {}) => {
    if (sx <= 0.05 || sy <= 0.05 || sz <= 0.05) return;
    const e = EDGE[role] || [0, 0];
    parts.push({
      name,
      role,
      x,
      y,
      z,
      sx,
      sy,
      sz,
      mat,
      edge: { L: e[0], S: e[1] },
      grain: ["side", "divider", "door", "filler", "back"].includes(role) ? "V" : "H",
      ...extra,
    });
  };
  const cm = c.carcassMat,
    im = c.interiorMat || cm;
  if (x0 > 0) P(t("封板"), "filler", 0, toe, cd, x0, ch - toe, T, c.doorMat);
  if (+c.fillerR > 0) P(t("封板"), "filler", x0 + W, toe, cd, +c.fillerR, ch - toe, T, c.doorMat);
  P(t("側板"), "side", x0, 0, 0, T, ch, cd, cm);
  P(t("側板"), "side", x0 + W - T, 0, 0, T, ch, cd, cm);
  P(t("頂板"), "top", x0 + T, ch - T, bt, W - 2 * T, T, cd - bt, cm);
  P(t("背板"), "back", x0 + T, toe, 0, W - 2 * T, ch - T - toe, bt, im);
  const n = c.sections.length;
  for (let i = 1; i < n; i++) P(t("中隔板"), "divider", xs[i] - T / 2, 0, bt, T, ch - T, cd - bt, cm, { section: i });
  c.sections.forEach((s, i) => {
    const [ox1, ox2] = [xs[i] + (i === 0 ? T : T / 2), xs[i + 1] - (i === n - 1 ? T : T / 2)];
    const ow = ox2 - ox1;
    if (s.kind !== "knee") {
      P(t("底板"), "bottom", ox1, toe, bt, ow, T, cd - bt, cm, { section: i });
      if (toe > 0) P(t("櫃體踢腳"), "toe", ox1, 0, cd - (+c.toeSet || 0) - T, ow, toe, T, c.doorMat, { section: i });
    }
    const z = zones[i];
    const sz = cd - bt - (L.inset ? L.dt : 0) - 2;
    if (z.split != null) P(t("固定層板"), "shelf", ox1, z.split, bt, ow, T, sz + 2, im, { section: i, fixed: true });
    const shelves = (y1, y2, m) => {
      if (m <= 0) return;
      const sp = (y2 - y1 - m * T) / (m + 1);
      if (sp < 8) return;
      // 層板深度：c.shelfD（由背板往前量，0＝滿深），例如儲藏室只做靠牆的淺層板
      const sd = +c.shelfD > 0 ? Math.min(+c.shelfD, sz) : sz;
      for (let j = 0; j < m; j++)
        P(t("層板"), "shelf", ox1 + 0.1, y1 + sp * (j + 1) + T * j, bt, ow - 0.2, T, sd, im, { section: i });
    };
    if (s.kind === "hang") {
      const hat = z.y2 - 32 - T;
      P(t("層板"), "shelf", ox1 + 0.1, hat, bt, ow - 0.2, T, sz, im, { section: i, fixed: true });
      const rz = bt + sz / 2 - 1.25;
      P(t("吊衣桿"), "rod", ox1, hat - 6, rz, ow, 2.5, 2.5, c.handleMat, { section: i });
      if ((+s.n || 1) >= 2) {
        const mid = (z.y1 + hat) / 2;
        P(t("層板"), "shelf", ox1 + 0.1, mid, bt, ow - 0.2, T, sz, im, { section: i, fixed: true });
        P(t("吊衣桿"), "rod", ox1, mid - 6, rz, ow, 2.5, 2.5, c.handleMat, { section: i });
      }
    } else if (s.kind === "appliance") {
      // 電器空間：下櫃門之上、上門之下各一片固定層板，中段可再加層板
      const dz = doors.filter(o => o.sec === i).sort((p, q) => p.y1 - q.y1);
      const up = dz.find(o => !z.lowTop || o.y1 > z.lowTop);
      const top = up ? up.y1 - T : z.y2;
      if (up) P(t("固定層板"), "shelf", ox1, top, bt, ow, T, sz + 2, im, { section: i, fixed: true });
      if (z.lowTop) P(t("固定層板"), "shelf", ox1, z.lowTop, bt, ow, T, sz + 2, im, { section: i, fixed: true });
      shelves(z.lowTop ? z.lowTop + T : z.y1, top, Math.round(+s.n || 0));
    } else if (!["drawer", "niche", "knee"].includes(s.kind)) shelves(z.y1, z.y2, Math.round(+s.n || 0));
  });
  for (const o of doors) {
    if (o.kind === "glass")
      P(t("玻璃門"), "glass", o.x1, o.y1, o.z1, o.x2 - o.x1, o.y2 - o.y1, 0.5, c.glassMat, { hinge: o.hinge });
    else
      P(
        o.kind === "lift" ? t("上掀門") : t("門板"),
        "door",
        o.x1,
        o.y1,
        o.z1,
        o.x2 - o.x1,
        o.y2 - o.y1,
        o.z2 - o.z1,
        c.doorMat,
        {
          hinge: o.hinge,
          section: o.sec,
        },
      );
  }
  for (const o of drawers) {
    P(t("抽屜面板"), "drawerFront", o.x1, o.y1, o.z1, o.x2 - o.x1, o.y2 - o.y1, o.z2 - o.z1, c.doorMat, {
      section: o.sec,
    });
    const b = o.box,
      bh = b.y2 - b.y1,
      bw = b.x2 - b.x1,
      st = 1.5;
    P(t("抽屜側板"), "drawerSide", b.x1, b.y1, b.z1, st, bh, b.z2 - b.z1, im, { section: o.sec });
    P(t("抽屜側板"), "drawerSide", b.x2 - st, b.y1, b.z1, st, bh, b.z2 - b.z1, im, { section: o.sec });
    P(t("抽屜前後板"), "drawerSide", b.x1 + st, b.y1, b.z1, bw - 2 * st, bh, st, im, { section: o.sec });
    P(t("抽屜前後板"), "drawerSide", b.x1 + st, b.y1, b.z2 - st, bw - 2 * st, bh, st, im, { section: o.sec });
    P(t("抽屜底板"), "drawerBottom", b.x1 + st, b.y1, b.z1 + st, bw - 2 * st, 0.8, b.z2 - b.z1 - 2 * st, im, {
      section: o.sec,
    });
  }
  if (c.top && topT > 0) P(t("檯面"), "countertop", 0, h - topT, 0, w, topT, d, c.top.mat);
  return parts;
}

/** 把手位置（3D 與立面用）：[{ x, y, z, sx, sy, sz, kind }] */
export function cabHandles(it) {
  const { L, doors, drawers } = cabFronts(it);
  const hk = L.c.handle;
  if (!["bar", "knob"].includes(hk)) return [];
  const out = [];
  const tall = L.h > 150,
    high = (it.elev ?? 0) > 100 || it.type === "cabWall";
  for (const o of doors) {
    if (o.kind === "slide") {
      const x = o.hinge === "S" && o.x1 < (L.x0 + L.x0 + L.W) / 2 ? o.x2 - 4 : o.x1 + 3;
      out.push({ x, y: (o.y1 + o.y2) / 2 - 10, z: o.z2, sx: 1.2, sy: 20, sz: 2, kind: hk });
      continue;
    }
    const hy =
      o.hinge === "T" ? o.y1 + 3 : high ? o.y1 + 6 : tall ? Math.min(o.y2 - 10, 100 - (it.elev ?? 0)) : o.y2 - 8;
    const hx = o.hinge === "L" ? o.x2 - 4 : o.hinge === "R" ? o.x1 + 3 : (o.x1 + o.x2) / 2;
    if (hk === "knob") out.push({ x: hx - 1, y: hy - 1, z: o.z2, sx: 2.5, sy: 2.5, sz: 2.5, kind: hk });
    else if (o.hinge === "T") out.push({ x: hx - 8, y: hy - 0.6, z: o.z2, sx: 16, sy: 1.2, sz: 2, kind: hk });
    else out.push({ x: hx - 0.6, y: hy - 8, z: o.z2, sx: 1.2, sy: 16, sz: 2, kind: hk });
  }
  for (const o of drawers) {
    const cx = (o.x1 + o.x2) / 2,
      cy = o.y2 - Math.min(5, (o.y2 - o.y1) / 3);
    if (hk === "knob") out.push({ x: cx - 1.25, y: cy - 1.25, z: o.z2, sx: 2.5, sy: 2.5, sz: 2.5, kind: hk });
    else {
      const l = Math.min(30, (o.x2 - o.x1) * 0.4);
      out.push({ x: cx - l / 2, y: cy - 0.6, z: o.z2, sx: l, sy: 1.2, sz: 2, kind: hk });
    }
  }
  return out;
}

const r1 = v => Math.round(v * 10) / 10;
/** 板件的長、寬、厚（cm） */
export function partDims(p) {
  const a = [p.sx, p.sy, p.sz].sort((x, y) => y - x);
  return { L: r1(a[0]), W: r1(a[1]), T: r1(a[2]) };
}
export const edgeText = e => (e.L || e.S ? t("長{l}短{s}", { l: e.L, s: e.S }) : "—");
const CUT_ROLES = new Set([
  "side",
  "top",
  "bottom",
  "back",
  "shelf",
  "divider",
  "door",
  "drawerFront",
  "drawerSide",
  "drawerBottom",
  "toe",
  "filler",
]);

/** 裁切清單（同尺寸同材質合併） */
export function cabCutList(it) {
  const rows = new Map();
  for (const p of cabParts(it)) {
    if (!CUT_ROLES.has(p.role)) continue;
    const dm = partDims(p);
    const key = [p.name, dm.L, dm.W, dm.T, p.mat, p.edge.L, p.edge.S].join("|");
    const r = rows.get(key);
    if (r) r.qty++;
    else
      rows.set(key, {
        part: p.name,
        role: p.role,
        qty: 1,
        ...dm,
        mat: p.mat,
        matName: getMat(p.mat).name,
        edge: edgeText(p.edge),
        edgeL: p.edge.L,
        edgeS: p.edge.S,
        grain: p.grain === "V" ? t("直紋") : t("橫紋"),
        note: p.fixed ? t("固定") : p.role === "shelf" ? t("活動層板") : "",
      });
  }
  const order = [...CUT_ROLES];
  return [...rows.values()].sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role) || b.L - a.L);
}

/** 五金清單 */
export function cabHardware(it) {
  const { L, doors, drawers } = cabFronts(it);
  const c = L.c,
    parts = cabParts(it);
  const out = [];
  const add = (item, spec, qty, unit, note = "") => qty > 0 && out.push({ item, spec, qty, unit, note });
  const hingeN = hgt => (hgt <= 100 ? 2 : hgt <= 160 ? 3 : 4);
  const hinged = doors.filter(o => ["L", "R"].includes(o.hinge));
  add(
    t("緩衝鉸鏈"),
    c.overlay === "inset" ? t("內嵌") : t("全蓋"),
    hinged.filter(o => o.kind !== "glass").reduce((a, o) => a + hingeN(o.y2 - o.y1), 0),
    t("個"),
  );
  add(
    t("玻璃門鉸鏈"),
    "",
    hinged.filter(o => o.kind === "glass").reduce((a, o) => a + hingeN(o.y2 - o.y1), 0),
    t("個"),
  );
  const lifts = doors.filter(o => o.hinge === "T");
  add(t("上掀門鉸鏈"), "", lifts.length * 2, t("個"));
  add(t("上掀氣壓棒"), "", lifts.length, t("組"));
  const slides = doors.filter(o => o.kind === "slide");
  add(t("拉門軌道"), "", new Set(slides.map(o => o.sec)).size, t("組"));
  add(t("拉門滑輪"), "", slides.length * 2, t("組"));
  const lens = {};
  for (const o of drawers) lens[o.len] = (lens[o.len] || 0) + 1;
  for (const [len, q] of Object.entries(lens)) add(t("抽屜滑軌（緩衝）"), `${len} cm`, q, t("副"));
  const fronts = doors.length + drawers.length;
  const hk = c.handle;
  if (hk === "bar") add(t("把手"), t("一字把手"), fronts, t("支"));
  if (hk === "knob") add(t("把手"), t("圓頭把手"), fronts, t("個"));
  if (hk === "push") add(t("按壓式反彈器"), "", fronts, t("個"));
  if (hk === "groove") add(t("隱藏式把手"), t("門板開槽"), fronts, t("處"));
  if (hk === "edge") add(t("鋁擠把手"), t("門板上緣"), fronts, t("支"));
  const rods = parts.filter(p => p.role === "rod");
  add(t("吊衣桿"), rods.map(p => `${Math.round(p.sx)} cm`).join("、"), rods.length, t("支"));
  const movable = parts.filter(p => p.role === "shelf" && !p.fixed).length;
  add(t("層板粒"), "", movable * 4, t("個"));
  if (L.toe > 0) add(t("調整腳"), `H${Math.round(L.toe)}`, 2 * (Math.ceil(L.W / 60) + 1), t("個"), t("附踢腳板扣"));
  if (it.type === "cabWall" || (it.elev ?? 0) > 30) add(t("吊櫃掛件"), "", 2, t("組"));
  if (c.lightStrip) add(t("LED 燈條"), t("鋁槽＋霧面罩"), Math.round(L.W), "cm");
  return out;
}

/** 板材統計：各材質／厚度面積、估計 4×8 尺板片數、封邊長度 */
export function boardSummary(its, waste = 1.15) {
  const map = new Map();
  let edge = 0;
  const SHEET = 1.22 * 2.44;
  for (const it of [].concat(its)) {
    for (const r of cabCutList(it)) {
      const key = r.mat + "|" + r.T;
      const area = (r.L * r.W * r.qty) / 10000;
      const m = map.get(key) || { mat: r.mat, matName: r.matName, T: r.T, area: 0 };
      m.area += area;
      map.set(key, m);
      edge += ((r.L * r.edgeL + r.W * r.edgeS) * r.qty) / 100;
    }
  }
  const rows = [...map.values()].map(m => ({
    ...m,
    area: Math.round(m.area * 100) / 100,
    sheets: Math.max(1, Math.ceil((m.area * waste) / SHEET)),
  }));
  return { rows, edge: Math.round(edge * 10) / 10, waste };
}

/** 檯面統計 */
export function countertopOf(it) {
  const c = cfg(it);
  if (!c.top || !(+c.top.thk > 0)) return null;
  return { mat: c.top.mat, matName: getMat(c.top.mat).name, L: it.w, W: it.d, T: +c.top.thk };
}
