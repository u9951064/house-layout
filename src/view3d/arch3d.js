// 建築外殼 3D：牆（每一面可不同材質、門窗開口挖空）、窗型、門片、地板、天花、踢腳板、柱子、雨遮、不在範圍區、房間名稱
import { S } from "../core/store.js";

/** 牆的範圍（以牆中心線端點計），用來判斷牆面朝室內或室外 */
export function wallRect(B) {
  const xs = [],
    ys = [];
  for (const w of B.walls || []) (xs.push(w[0], w[2]), ys.push(w[1], w[3]));
  if (!xs.length) return { x1: 0, y1: 0, x2: 100, y2: 100 };
  return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
}
const inside = (r, x, y) => x > r.x1 + 0.5 && x < r.x2 - 0.5 && y > r.y1 + 0.5 && y < r.y2 - 0.5;

/** 開口沿牆距離（由起點量起）與高度 */
export function openingsOf(wall, sp) {
  const [x1, y1, x2, y2, , ops = []] = wall;
  const L = Math.hypot(x2 - x1, y2 - y1);
  const hz = Math.abs(y1 - y2) < 0.01,
    vt = Math.abs(x1 - x2) < 0.01;
  if (!(hz || vt)) return [];
  const sOf = a => (hz ? (a - x1) * Math.sign(x2 - x1 || 1) : (a - y1) * Math.sign(y2 - y1 || 1));
  return ops
    .map(([a, b, kind, o = {}]) => {
      let s0 = sOf(a),
        s1 = sOf(b);
      if (s0 > s1) [s0, s1] = [s1, s0];
      s0 = Math.max(0, s0);
      s1 = Math.min(L, s1);
      const sill = kind === "win" ? (o.sill ?? sp.winSill) : 0;
      const head = kind === "win" ? (o.head ?? sp.winHead) : (o.head ?? sp.doorH);
      // 鉸鏈端：a 端＝沿軸座標較小的一端
      const hingeS = sOf(o.hinge === "b" ? b : a);
      return { s0, s1, kind, o, sill, head, hingeS, a, b };
    })
    .filter(p => p.s1 - p.s0 > 1)
    .sort((p, q) => p.s0 - q.s0);
}

/**
 * 建立建築外殼。ctx：{ THREE, K, M, mat(id), spec }；opts：{ wallTop, doors, labels }
 * 回傳 { group, walls: [{ group, p1, p2, i }], floor, ceiling, rect }
 */
export function buildArch(ctx, opts) {
  const { THREE, K, M, mat } = ctx;
  const sp = ctx.spec;
  const B = S.BASE;
  const root = new THREE.Group();
  const walls = [];
  if (!B) return { group: root, walls, rect: { x1: 0, y1: 0, x2: 100, y2: 100 } };
  const r = wallRect(B);
  const H = opts.wallTop === "slab" ? sp.slabH : sp.ceilH;
  const fin = sp.wallFin || {};
  const wallTop = M.wallTop;

  (B.walls || []).forEach((w, i) => {
    const [x1, y1, x2, y2, t0] = w;
    const t = t0 || 12;
    const L = Math.hypot(x2 - x1, y2 - y1);
    if (L < 1) return;
    const ux = (x2 - x1) / L,
      uz = (y2 - y1) / L,
      nx = -uz,
      nz = ux;
    // 面 1（+z）/ 面 -1（-z）是否朝室內
    const midX = (x1 + x2) / 2,
      midZ = (y1 + y2) / 2;
    const in1 = inside(r, midX + nx * (t / 2 + 4), midZ + nz * (t / 2 + 4));
    const inM = inside(r, midX - nx * (t / 2 + 4), midZ - nz * (t / 2 + 4));
    const m1 = mat(fin[`${i}:1`] || sp.wallMat),
      m2 = mat(fin[`${i}:-1`] || sp.wallMat);
    const g = new THREE.Group();
    g.position.set(x1, 0, y1);
    g.rotation.y = Math.atan2(-uz, ux);
    g.userData.pick = { kind: "wall", i, nx, nz };
    const ext = t / 2 - 0.1;
    // BoxGeometry 材質順序：+x, -x, +y, -y, +z（面 1）, -z（面 -1）
    const mats = [wallTop, wallTop, wallTop, wallTop, m1, m2];
    const piece = (s0, s1, y0, y1) => {
      if (s1 - s0 < 0.2 || y1 - y0 < 0.2) return;
      const geo = new THREE.BoxGeometry(s1 - s0, y1 - y0, t);
      geo.translate((s0 + s1) / 2, (y0 + y1) / 2, 0);
      K.setUV(geo);
      g.add(K.shadow(new THREE.Mesh(geo, mats)));
    };
    const ops = openingsOf(w, sp);
    let cur = -ext;
    for (const op of ops) {
      piece(cur, op.s0, 0, H);
      if (op.sill > 0) piece(op.s0, op.s1, 0, op.sill);
      if (op.head < H) piece(op.s0, op.s1, op.head, H);
      if (op.kind === "win") windowAt(ctx, g, op, t, in1 && !inM ? -1 : inM && !in1 ? 1 : -1);
      else if (op.kind === "door") doorAt(ctx, g, op, t, w, opts.doors ?? 0);
      cur = op.s1;
    }
    piece(cur, L + ext, 0, H);
    // 踢腳板：室內面、避開落地開口
    if (sp.skirtH > 0) {
      const sm = mat(sp.skirtMat);
      for (const [face, ok] of [
        [1, in1],
        [-1, inM],
      ]) {
        if (!ok) continue;
        let c0 = -ext;
        const runs = [];
        for (const op of ops) {
          if (op.sill <= 0) {
            runs.push([c0, op.s0]);
            c0 = op.s1;
          }
        }
        runs.push([c0, L + ext]);
        for (const [a, b] of runs)
          if (b - a > 1) K.boxAt(g, a, 0, face > 0 ? t / 2 : -t / 2 - 1.2, b - a, sp.skirtH, 1.2, sm);
      }
    }
    root.add(g);
    walls.push({ group: g, p1: [x1, y1], p2: [x2, y2], i, t });
  });

  // 地板
  const fw = r.x2 - r.x1,
    fd = r.y2 - r.y1;
  const floorGeo = new THREE.PlaneGeometry(fw, fd);
  floorGeo.rotateX(-Math.PI / 2);
  floorGeo.translate(r.x1 + fw / 2, 0, r.y1 + fd / 2);
  K.setUV(floorGeo);
  const floor = new THREE.Mesh(floorGeo, mat(sp.floorMat));
  floor.receiveShadow = true;
  floor.userData.pick = { kind: "floor" };
  root.add(floor);
  for (const o of B.outOfScope || []) {
    const [a, b, c, d] = o.r;
    const m = K.boxAt(root, a, 0, b, c - a, 0.6, d - b, M.oos);
    m.userData.pick = { kind: "floor" };
  }
  // 天花板（朝下的面）
  // 窗簾盒等內凹處（opts.ceilHoles：平面多邊形 [[x,y],…]）在天花面挖開口
  let ceilGeo;
  const holes = opts.ceilHoles || [];
  if (holes.length) {
    const shape = new THREE.Shape();
    shape.moveTo(r.x1, r.y1);
    shape.lineTo(r.x2, r.y1);
    shape.lineTo(r.x2, r.y2);
    shape.lineTo(r.x1, r.y2);
    shape.closePath();
    for (const poly of holes) shape.holes.push(new THREE.Path(poly.map(([x, y]) => new THREE.Vector2(x, y))));
    ceilGeo = new THREE.ShapeGeometry(shape);
    // 形狀在 XY 平面 → 轉到 XZ（y→z），法向量朝下
    ceilGeo.rotateX(Math.PI / 2);
    ceilGeo.translate(0, sp.ceilH, 0);
  } else {
    ceilGeo = new THREE.PlaneGeometry(fw, fd);
    ceilGeo.rotateX(Math.PI / 2);
    ceilGeo.translate(r.x1 + fw / 2, sp.ceilH, r.y1 + fd / 2);
  }
  K.setUV(ceilGeo);
  const ceiling = new THREE.Mesh(ceilGeo, mat(sp.ceilMat));
  ceiling.userData.pick = { kind: "ceiling" };
  ceiling.userData.isCeiling = true;
  root.add(ceiling);
  // 柱子、雨遮
  for (const [a, b, c, d] of B.columns || []) K.boxAt(root, a, 0, b, c - a, H, d - b, M.column);
  for (const [a, b, c, d] of B.canopies || []) K.boxAt(root, a, sp.winHead + 10, b, c - a, 8, d - b, M.canopy);
  return { group: root, walls, floor, ceiling, rect: r };
}

/** 窗：外框＋依窗型的窗扇與玻璃；out = 室外那一面的符號（局部 z） */
function windowAt(ctx, g, op, t, out) {
  const { K, M, THREE } = ctx;
  const o = op.o || {};
  const W = op.s1 - op.s0,
    Hh = op.head - op.sill,
    x0 = op.s0,
    y0 = op.sill;
  const fm = o.frameMat ? ctx.mat(o.frameMat) : M.frame;
  const gm = { frosted: M.glassFrosted, reeded: M.glassReeded, lowe: M.glassLowe }[o.glass] || M.glassClear;
  const style = o.style || "slide2";
  const fd = 8,
    fb = 5;
  const frame = (P, x, y, w, h, depth, z) => K.boxAt(P, x, y, z - depth / 2, w, h, depth, fm);
  const pane = (P, x, y, w, h, z) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(w, 0.1), Math.max(h, 0.1)), gm);
    m.position.set(x + w / 2, y + h / 2, z);
    P.add(m);
  };
  const sash = (P, x, y, w, h, z, bar = 4) => {
    frame(P, x, y, w, bar, 3, z);
    frame(P, x, y + h - bar, w, bar, 3, z);
    frame(P, x, y, bar, h, 3, z);
    frame(P, x + w - bar, y, bar, h, 3, z);
    pane(P, x + bar, y + bar, w - 2 * bar, h - 2 * bar, z);
  };
  if (style === "bay") {
    // 凸窗：往室外凸出 45 cm，底板（窗台）、頂板、三面玻璃
    const P = 45 * out,
      zf = (t / 2) * out + P;
    K.boxAt(g, x0, y0 - 6, Math.min(-out * t * 0.5, zf), W, 6, Math.abs(zf) + t * 0.5, M.offwhite);
    K.boxAt(g, x0, op.head, Math.min(0, zf), W, 8, Math.abs(zf), M.offwhite);
    sash(g, x0, y0, W, Hh, zf, 5);
    for (const x of [x0 + 2, x0 + W - 2]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(Math.abs(P), Hh), gm);
      m.rotation.y = Math.PI / 2;
      m.position.set(x, y0 + Hh / 2, (t / 2) * out + P / 2);
      g.add(m);
      K.boxAt(g, x - 2, y0, (t / 2) * out + P / 2 - 2, 4, Hh, 4, fm);
    }
    return;
  }
  frame(g, x0, y0, W, fb, fd, 0);
  frame(g, x0, y0 + Hh - fb, W, fb, fd, 0);
  frame(g, x0, y0, fb, Hh, fd, 0);
  frame(g, x0 + W - fb, y0, fb, Hh, fd, 0);
  const ix = x0 + fb,
    iy = y0 + fb,
    iw = W - 2 * fb,
    ih = Hh - 2 * fb;
  if (style === "fixed") pane(g, ix, iy, iw, ih, 0);
  else if (style === "slide3") {
    const sw = iw / 3 + 2;
    for (let k = 0; k < 3; k++) sash(g, Math.min(ix + (k * iw) / 3 - 1, ix + iw - sw), iy, sw, ih, k % 2 ? 1.6 : -1.6);
  } else if (style === "casement") {
    // 推射窗：兩扇往室外推開（開啟程度跟隨門片設定）
    const ang = 0.6 * Math.max(0, Math.min(1, ctx.doors || 0));
    for (const k of [0, 1]) {
      const P = new THREE.Group();
      P.position.set(k ? ix + iw : ix, 0, 0);
      P.rotation.y = (k ? -1 : 1) * ang * out;
      sash(P, k ? -iw / 2 : 0, iy, iw / 2, ih, 0);
      g.add(P);
    }
  } else if (style === "awning") {
    frame(g, ix, iy + ih * 0.62, iw, 4, 5, 0);
    pane(g, ix, iy, iw, ih * 0.62, 0);
    sash(g, ix, iy + ih * 0.62 + 4, iw, ih * 0.38 - 4, 0);
  } else {
    // slide2（預設）：兩扇橫拉，前後錯開
    const sw = iw / 2 + 3;
    sash(g, ix, iy, sw, ih, -1.6);
    sash(g, ix + iw - sw, iy, sw, ih, 1.6);
  }
}

/** 底圖門：門框飾條＋門片（依 hinge／side 與 doors 開啟程度） */
function doorAt(ctx, g, op, t, wall, doors) {
  const { K, M, THREE } = ctx;
  const o = op.o || {};
  const W = op.s1 - op.s0,
    Hh = op.head;
  const trim = o.frameMat ? ctx.mat(o.frameMat) : M.white;
  for (const z of [t / 2, -t / 2 - 1.5]) {
    K.boxAt(g, op.s0 - 6, 0, z, 6, Hh + 6, 1.5, trim);
    K.boxAt(g, op.s1, 0, z, 6, Hh + 6, 1.5, trim);
    K.boxAt(g, op.s0 - 6, Hh, z, W + 12, 6, 1.5, trim);
  }
  // 開向：side 為平面座標軸方向（水平牆 ±y、垂直牆 ±x），換成牆局部 z（法線 (-uz, ux)）
  const [x1, y1, x2, y2] = wall;
  const L = Math.hypot(x2 - x1, y2 - y1),
    ux = (x2 - x1) / L,
    uz = (y2 - y1) / L;
  const hz = Math.abs(y1 - y2) < 0.01;
  const sd = o.side || 1;
  const dirX = hz ? 0 : sd,
    dirZ = hz ? sd : 0;
  const zSign = Math.sign(dirX * -uz + dirZ * ux) || 1;
  const hingeAtStart = Math.abs(op.hingeS - op.s0) < Math.abs(op.hingeS - op.s1);
  const leafMat = o.leafMat ? ctx.mat(o.leafMat) : M.door;
  const th = 4;
  const p = new THREE.Group();
  p.position.set(hingeAtStart ? op.s0 + 0.5 : op.s1 - 0.5, 0, zSign * (t / 2));
  const open = 0.08 + 0.92 * Math.max(0, Math.min(1, doors));
  // 往 zSign 那側開：鉸鏈在起點時，葉片 +x 方向轉向 zSign
  p.rotation.y = (hingeAtStart ? -1 : 1) * zSign * open * (Math.PI / 2);
  const lw = W - 1;
  const leaf = new THREE.Group();
  leaf.position.set(hingeAtStart ? 0 : -lw, 0, zSign > 0 ? -th : 0);
  leafGeometry(ctx, leaf, lw, Hh - 1, th, o.leafStyle || "flat", leafMat);
  p.add(leaf);
  K.cyl(p, hingeAtStart ? lw - 7 : -lw + 7, 100, -zSign * th * 0.5, 1.1, th + 6, M.handle).rotation.x = Math.PI / 2;
  g.add(p);
}

/** 門片樣式：flat 平板、panel 線板、glass 玻璃、groove 溝縫、louver 百葉（局部範圍 [0,w]×[0,h]×[0,th]） */
export function leafGeometry(ctx, g, w, h, th, style, leafMat) {
  const { K, M } = ctx;
  if (style === "glass") {
    const f = 10;
    K.boxAt(g, 0, 0, 0, f, h, th, leafMat);
    K.boxAt(g, w - f, 0, 0, f, h, th, leafMat);
    K.boxAt(g, 0, 0, 0, w, f + 10, th, leafMat);
    K.boxAt(g, 0, h - f, 0, w, f, th, leafMat);
    K.boxAt(g, f, f + 10, th / 2 - 0.4, w - 2 * f, h - 2 * f - 10, 0.8, M.glassFrosted);
    return;
  }
  if (style === "louver") {
    const f = 8;
    K.boxAt(g, 0, 0, 0, f, h, th, leafMat);
    K.boxAt(g, w - f, 0, 0, f, h, th, leafMat);
    K.boxAt(g, 0, 0, 0, w, f, th, leafMat);
    K.boxAt(g, 0, h - f, 0, w, f, th, leafMat);
    for (let y = f + 4; y < h - f - 3; y += 6) {
      const s = K.box(w - 2 * f, 0.8, th * 0.9, leafMat);
      s.position.set(f, y, th * 0.05);
      s.rotation.x = 0.5;
      g.add(s);
    }
    return;
  }
  K.boxAt(g, 0, 0, 0, w, h, th, leafMat);
  if (style === "panel") {
    for (const [y, hh] of [
      [h * 0.55, h * 0.38],
      [h * 0.08, h * 0.4],
    ])
      for (const z of [-0.6, th]) K.boxAt(g, w * 0.15, y, z, w * 0.7, hh, 0.6, leafMat);
  } else if (style === "groove") {
    for (let x = w / 4; x < w - 1; x += w / 4)
      for (const z of [-0.2, th - 0.1]) K.boxAt(g, x - 0.4, 2, z, 0.8, h - 4, 0.3, M.groove);
  }
}

/** 房間名稱看板（Sprite） */
export function roomLabels(ctx) {
  const { THREE } = ctx;
  const g = new THREE.Group();
  for (const rm of (S.BASE && S.BASE.rooms) || []) {
    const c = document.createElement("canvas");
    const fs = 48;
    const x = c.getContext("2d");
    x.font = `600 ${fs}px -apple-system, "PingFang TC", "Noto Sans TC", sans-serif`;
    const tw = Math.ceil(x.measureText(rm.n || "").width) + 24;
    c.width = tw;
    c.height = fs + 20;
    x.font = `600 ${fs}px -apple-system, "PingFang TC", "Noto Sans TC", sans-serif`;
    x.fillStyle = "rgba(255,255,255,.82)";
    x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = "#374151";
    x.textBaseline = "middle";
    x.fillText(rm.n || "", 12, c.height / 2);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
    sp.userData.ownMat = true;
    const k = 0.5;
    sp.scale.set(c.width * k, c.height * k, 1);
    sp.position.set(rm.x, 140, rm.y);
    sp.renderOrder = 10;
    g.add(sp);
  }
  return g;
}
