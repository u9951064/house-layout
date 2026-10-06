// 裝修元件與門的 3D 模型（局部座標：原點＝物件左上角、地面 y=0、x∈[0,w]、z∈[0,d]，單位 cm）
import { curveGeom, doorPath, pathLen, pleatPath, subPath } from "../shapes/curve.js";
import { P } from "./catalog.js";
import { itemMat } from "./helpers.js";

/** UV 以 cm 為單位的方塊（材質內部用 repeat = 1/size 換算） */
export function cmBox(THREE, sx, sy, sz) {
  const g = new THREE.BoxGeometry(Math.max(sx, 0.1), Math.max(sy, 0.1), Math.max(sz, 0.1));
  const uv = g.attributes.uv;
  // 面順序：+x −x +y −y +z −z，每面 4 個頂點
  const dims = [
    [sz, sy],
    [sz, sy],
    [sx, sz],
    [sx, sz],
    [sx, sy],
    [sx, sy],
  ];
  for (let f = 0; f < 6; f++)
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, uv.getX(i) * dims[f][0], uv.getY(i) * dims[f][1]);
    }
  uv.needsUpdate = true;
  return g;
}
/** 以最小角（x, y, z）放一個方塊 */
export function box(THREE, parent, x, y, z, sx, sy, sz, material) {
  const m = new THREE.Mesh(cmBox(THREE, sx, sy, sz), material);
  m.position.set(x + sx / 2, y + sy / 2, z + sz / 2);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
const dbl = new WeakMap();
/** 雙面版本的材質（窗簾、薄片用） */
function twoSided(THREE, m) {
  if (!dbl.has(m)) {
    const c = m.clone();
    c.side = THREE.DoubleSide;
    dbl.set(m, c);
  }
  return dbl.get(m);
}
function basic(THREE, color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, ...extra });
}
/** 沿折線（平面局部座標）的一片板：高度 y0..y0+h、厚度 thk */
export function ribbon(THREE, parent, pts, y0, h, thk, material) {
  for (let i = 1; i < pts.length; i++) {
    const [x1, z1] = pts[i - 1],
      [x2, z2] = pts[i],
      L = Math.hypot(x2 - x1, z2 - z1);
    if (L < 0.01) continue;
    const m = new THREE.Mesh(cmBox(THREE, L + 0.6, h, thk), material);
    m.position.set((x1 + x2) / 2, y0 + h / 2, (z1 + z2) / 2);
    m.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
    m.castShadow = true;
    parent.add(m);
  }
}
/** 布簾：沿 x 的波浪薄片 */
function drape(THREE, parent, x0, x1, z, y0, h, amp, material, folds = 10) {
  const w = Math.max(1, x1 - x0),
    n = Math.max(8, Math.round((w / folds) * 4)),
    pos = [],
    uv = [],
    idx = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n,
      x = x0 + u * w,
      dz = Math.sin(u * (w / folds) * Math.PI * 2) * amp;
    pos.push(x, y0, z + dz, x, y0 + h, z + dz);
    uv.push(u * w, 0, u * w, h);
    if (i) {
      const a = (i - 1) * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, twoSided(THREE, material));
  m.castShadow = true;
  parent.add(m);
}

function floor3d(it, ctx) {
  const { THREE } = ctx,
    g = new THREE.Group(),
    h = Math.max(0.3, ctx.itemH(it));
  box(THREE, g, 0, ctx.itemElev(it), 0, it.w, h, it.d, ctx.mat(itemMat(it))).castShadow = false;
  return g;
}
function ceil3d(kind) {
  return (it, ctx) => {
    const { THREE } = ctx,
      g = new THREE.Group(),
      sp = ctx.spec,
      y = ctx.itemElev(it),
      m = ctx.mat(itemMat(it)),
      top = Math.max(y + 2, kind === "beam" ? sp.slabH : sp.ceilH);
    if (kind === "flat") box(THREE, g, 0, y, 0, it.w, 2, it.d, m);
    else if (kind === "drop" || kind === "beam") box(THREE, g, 0, y, 0, it.w, top - y, it.d, m);
    else if (kind === "cove") {
      // 中央降板＋四周內凹燈槽（LED 燈條自發光）
      const c = Math.min(P(it, "cove") || 20, it.w / 3, it.d / 3);
      box(THREE, g, c, y, c, it.w - 2 * c, Math.max(2, sp.ceilH - y), it.d - 2 * c, m);
      box(THREE, g, 0, sp.ceilH, 0, it.w, 2, it.d, m);
      const led = basic(THREE, "#fff3c4", { emissive: "#ffd27a", emissiveIntensity: 1.2 });
      for (const [x, z, sx, sz] of [
        [c - 3, c - 3, it.w - 2 * c + 6, 1.5],
        [c - 3, it.d - c + 1.5, it.w - 2 * c + 6, 1.5],
        [c - 3, c - 3, 1.5, it.d - 2 * c + 6],
        [it.w - c + 1.5, c - 3, 1.5, it.d - 2 * c + 6],
      ])
        box(THREE, g, x, y + 2, z, sx, 1.5, sz, led).castShadow = false;
    } else if (kind === "grille") {
      const gap = Math.max(4, P(it, "gap") || 10),
        h = Math.max(2, ctx.itemH(it));
      for (let x = 0; x < it.w; x += gap) box(THREE, g, x, y, 0, Math.min(3, it.w - x), h, it.d, m);
    } else if (kind === "box") {
      // 窗簾盒：天花內凹，兩側擋板
      box(THREE, g, 0, sp.ceilH, 0, it.w, Math.max(2, y - sp.ceilH), 1.2, m);
      box(THREE, g, 0, y, 0, it.w, 1.2, it.d, m);
    }
    return g;
  };
}
function wallFin3d(style) {
  return (it, ctx) => {
    const { THREE } = ctx,
      g = new THREE.Group(),
      y = ctx.itemElev(it),
      h = ctx.itemH(it),
      m = ctx.mat(itemMat(it)),
      t = Math.max(0.5, it.d),
      st = style || P(it, "style");
    if (st === "slat") {
      box(THREE, g, 0, y, 0, it.w, h, Math.min(1.2, t), basic(THREE, "#2b2b2b"));
      for (let x = 0; x < it.w; x += 6) box(THREE, g, x, y, 0, Math.min(3.5, it.w - x), h, t, m);
    } else if (st === "panel") {
      box(THREE, g, 0, y, 0, it.w, h, t * 0.6, m);
      const n = Math.max(1, Math.round(it.w / 60)),
        pw = it.w / n;
      for (let i = 0; i < n; i++) box(THREE, g, i * pw + 6, y + 6, 0, pw - 12, h - 12, t, m);
    } else if (st === "groove") {
      box(THREE, g, 0, y, 0, it.w, h, t, m);
      const dark = basic(THREE, "#3a3a3a");
      for (let x = 60; x < it.w; x += 60) box(THREE, g, x - 0.4, y, t - 0.1, 0.8, h, 0.3, dark);
    } else {
      const mm = st === "mirror" ? basic(THREE, "#dfe7ee", { metalness: 0.9, roughness: 0.05 }) : m;
      box(THREE, g, 0, y, 0, it.w, h, t, mm);
    }
    return g;
  };
}
function curtain3d(kind) {
  return (it, ctx) => {
    const { THREE } = ctx,
      g = new THREE.Group(),
      y = ctx.itemElev(it),
      h = ctx.itemH(it),
      m = ctx.mat(itemMat(it)),
      open = Math.max(0, Math.min(1, P(it, "open") ?? 0)),
      w = it.w,
      d = it.d;
    // 軌道
    box(THREE, g, 0, y + h - 2, 1, w, 2, 2, basic(THREE, "#9ca3af", { metalness: 0.6 })).castShadow = false;
    if (kind === "drape" || kind === "double") {
      const half = (w * (1 - open)) / 2 + (w * open) / 6;
      drape(THREE, g, 0, half, d * 0.65, y, h - 2, d * 0.22, m);
      drape(THREE, g, w - half, w, d * 0.65, y, h - 2, d * 0.22, m);
      if (kind === "double") {
        const sheer = ctx.mat(itemMat(it, "mat2"));
        drape(THREE, g, 0, w, d * 0.3, y, h - 2, d * 0.12, sheer, 7);
      }
    } else if (kind === "sheer") drape(THREE, g, 0, w, d * 0.5, y, h - 2, d * 0.25, m, 7);
    else if (kind === "roller") {
      const down = h * (1 - open);
      const r = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, w, 16), m);
      r.rotation.z = Math.PI / 2;
      r.position.set(w / 2, y + h - 4, d / 2);
      g.add(r);
      box(THREE, g, 0, y + h - 4 - down, d / 2 - 0.3, w, down, 0.6, twoSided(THREE, m));
    } else if (kind === "roman") {
      const down = h * (1 - open * 0.8),
        n = Math.max(2, Math.round(down / 25));
      for (let i = 0; i < n; i++) {
        const fy = y + h - 2 - ((i + 1) * down) / n;
        box(THREE, g, 0, fy, d / 2 - 1 - (i % 2), w, down / n, 1.5, m);
      }
    } else if (kind === "venetian") {
      const down = h * (1 - open),
        tilt = 0.6,
        slat = basic(THREE, "#f3f1ec");
      for (let yy = y + h - 4; yy > y + h - 4 - down; yy -= 4) {
        const s = new THREE.Mesh(cmBox(THREE, w, 0.3, 5), it.mat ? m : slat);
        s.position.set(w / 2, yy, d / 2);
        s.rotation.x = tilt;
        g.add(s);
      }
    }
    return g;
  };
}

// ── 門（平面上的門元件）：門框＋門片，依門片樣式 ──
function leaf(THREE, parent, w, h, t, style, m) {
  const g = new THREE.Group();
  parent.add(g);
  const dark = basic(THREE, "#3b3b3b");
  if (style === "glass") {
    const fr = 8;
    box(THREE, g, 0, 0, 0, fr, h, t, m);
    box(THREE, g, w - fr, 0, 0, fr, h, t, m);
    box(THREE, g, 0, 0, 0, w, fr + 10, t, m);
    box(THREE, g, 0, h - fr, 0, w, fr, t, m);
    const glass = basic(THREE, "#cfe3ee", { transparent: true, opacity: 0.35, roughness: 0.05 });
    box(THREE, g, fr, fr + 10, t / 2 - 0.3, w - 2 * fr, h - 2 * fr - 10, 0.6, glass).castShadow = false;
  } else if (style === "louver") {
    box(THREE, g, 0, 0, 0, 8, h, t, m);
    box(THREE, g, w - 8, 0, 0, 8, h, t, m);
    box(THREE, g, 0, 0, 0, w, 10, t, m);
    box(THREE, g, 0, h - 10, 0, w, 10, t, m);
    for (let y = 14; y < h - 12; y += 5) {
      const s = new THREE.Mesh(cmBox(THREE, w - 16, 0.8, t * 0.9), m);
      s.position.set(w / 2, y, t / 2);
      s.rotation.x = 0.7;
      g.add(s);
    }
  } else {
    box(THREE, g, 0, 0, 0, w, h, t, m);
    if (style === "panel")
      for (const [y0, hh] of [
        [h * 0.08, h * 0.38],
        [h * 0.54, h * 0.38],
      ])
        for (const z of [-0.6, t]) box(THREE, g, w * 0.15, y0, z, w * 0.7, hh, 0.6, m);
    if (style === "groove")
      for (let y = h * 0.2; y < h; y += h * 0.2)
        for (const z of [-0.1, t - 0.2]) box(THREE, g, 2, y, z, w - 4, 0.6, 0.3, dark);
  }
  return g;
}
function handle(THREE, parent, x, h, t, kind) {
  if (kind === "none") return;
  const metal = basic(THREE, "#a3a3a3", { metalness: 0.85, roughness: 0.25 });
  for (const z of [-2.5, t + 0.5]) {
    if (kind === "bar") box(THREE, parent, x - 1, h * 0.35, z, 2, h * 0.3, 2, metal);
    else if (kind === "knob") {
      const k = new THREE.Mesh(new THREE.SphereGeometry(2.6, 12, 8), metal);
      k.position.set(x, h * 0.47, z + 1);
      parent.add(k);
    } else box(THREE, parent, x - 6, h * 0.47, z, 12, 1.6, 2, metal);
  }
}
function door3d(it, ctx) {
  const { THREE } = ctx,
    g = new THREE.Group(),
    h = ctx.itemH(it),
    y = ctx.itemElev(it),
    t = 4,
    style = P(it, "leafStyle") || "flat",
    m = ctx.mat(it.leafMat || itemMat(it, "leafMat")),
    fm = ctx.mat(it.frameMat || itemMat(it, "frameMat")),
    hk = P(it, "handle") || "lever",
    w = it.w;
  const frame = (x0, x1, z0, depth) => {
    box(THREE, g, x0 - 4, y, z0, 4, h + 4, depth, fm);
    box(THREE, g, x1, y, z0, 4, h + 4, depth, fm);
    box(THREE, g, x0 - 4, y + h, z0, x1 - x0 + 8, 4, depth, fm);
  };
  const open = Math.max(0, Math.min(90, P(it, "openDeg") ?? 15));
  if (style === "accordion" && it.type !== "swingDoor" && it.type !== "doubleDoor") {
    // 風琴門：沿路徑的折疊門片，打開時往起點收攏
    const p = doorPath(it),
      L = pathLen(p),
      r = typeof ctx.doors === "number" ? ctx.doors : ctx.doors === "open" ? 1 : 0,
      n = Math.max(4, Math.round(L / 10));
    ribbon(THREE, g, p, y + h, 4, 6, fm);
    ribbon(THREE, g, pleatPath(p, 3, n, Math.max(L * 0.15, L * (1 - 0.85 * r))), y, h - 1, 0.8, m);
    return g;
  }
  if (it.type === "swingDoor" || it.type === "doubleDoor") {
    // 門片線在 z=0、x 0..w，往 −z 開
    frame(0, w, -6, 12);
    const leaves =
      it.type === "doubleDoor"
        ? [
            [0, w / 2, 1],
            [w, w / 2, -1],
          ]
        : [[0, w, 1]];
    for (const [hx, lw, dir] of leaves) {
      const piv = new THREE.Group();
      piv.position.set(hx, y, -t / 2);
      piv.rotation.y = dir * ((open * Math.PI) / 180);
      g.add(piv);
      const lg = leaf(THREE, piv, lw - 0.6, h - 0.6, t, style, m);
      lg.position.x = dir > 0 ? 0.3 : -(lw - 0.3);
      handle(THREE, lg, dir > 0 ? lw - 8 : 8, h, t, hk);
    }
  } else if (it.type === "slideDoor") {
    const pw = w / 2 + 6,
      d = it.d;
    box(THREE, g, 0, y + h, 0, w, 4, d, fm);
    const l1 = leaf(THREE, g, pw, h, Math.max(2, d * 0.3), style, m);
    l1.position.set(0, y, d * 0.15);
    const l2 = leaf(THREE, g, pw, h, Math.max(2, d * 0.3), style, m);
    l2.position.set(w - pw, y, d * 0.55);
    handle(THREE, l1, pw - 6, h, d * 0.3, "bar");
    handle(THREE, l2, 6, h, d * 0.3, "bar");
  } else if (it.type === "pocketDoor") {
    const d = it.d;
    frame(0, w, 0, d);
    const l = leaf(THREE, g, w * 0.55, h, Math.max(2, d * 0.35), style, m);
    l.position.set(0, y, d * 0.33);
    handle(THREE, l, w * 0.55 - 6, h, d * 0.35, "bar");
  } else if (it.type === "foldDoor") {
    const n = 4,
      pw = w / n,
      pts = [[0, 0]];
    for (let i = 1; i <= n; i++) pts.push([i * pw, i % 2 ? -it.d : 0]);
    ribbon(THREE, g, pts, y, h, 3, m);
    box(THREE, g, 0, y + h, -it.d, w, 4, it.d + 2, fm);
  } else if (it.type === "curveSlide") {
    const c = curveGeom(it),
      o = c.t * 0.22,
      L = c.len;
    ribbon(THREE, g, c.pts, y + h, 4, c.t, fm);
    ribbon(THREE, g, subPath(c.pts, 0, L * 0.56, o), y, h, 3, m);
    ribbon(THREE, g, subPath(c.pts, L * 0.44, L, -o), y, h, 3, m);
  } else if (it.type === "slideDoorArc") {
    const arc = (u1, u2, k) => {
      const out = [];
      for (let i = 0; i <= 24; i++) {
        const a = ((u1 + ((u2 - u1) * i) / 24) * Math.PI) / 2;
        out.push([(w - k) * Math.sin(a), it.d - (it.d - k) * Math.cos(a)]);
      }
      return out;
    };
    ribbon(THREE, g, arc(0, 1, 6), y + h, 4, 12, fm);
    ribbon(THREE, g, arc(0, 0.56, 3), y, h, 3, m);
    ribbon(THREE, g, arc(0.44, 1, 9), y, h, 3, m);
  }
  return g;
}

export const BUILD3D = {
  floorZone: floor3d,
  floorRaised: floor3d,
  threshold: floor3d,
  ceilFlat: ceil3d("flat"),
  ceilDrop: ceil3d("drop"),
  ceilCove: ceil3d("cove"),
  ceilBeam: ceil3d("beam"),
  curtainBox: ceil3d("box"),
  ceilGrille: ceil3d("grille"),
  wallPanel: wallFin3d(),
  wallStone: wallFin3d("stone"),
  wallpaper: wallFin3d("paper"),
  wainscot: wallFin3d(),
  mirrorWall: wallFin3d("mirror"),
  curtainDouble: curtain3d("double"),
  curtainSheer: curtain3d("sheer"),
  curtainBlackout: curtain3d("drape"),
  curtainRoman: curtain3d("roman"),
  curtainRoller: curtain3d("roller"),
  blindsVenetian: curtain3d("venetian"),
  swingDoor: door3d,
  doubleDoor: door3d,
  slideDoor: door3d,
  pocketDoor: door3d,
  foldDoor: door3d,
  slideDoorArc: door3d,
  curveSlide: door3d,
};
