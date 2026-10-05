// 水電空調 3D 模型與立面圖（局部座標：原點＝物件平面左上角、地面 y=0；elev 在這裡自行套用）
import { el } from "../core/dom.js";
import { itemElev, itemH, spec } from "../ext/heights.js";
import { DUCT_TYPES, LIGHT_TYPES, POWER_TYPES, SWITCH_TYPES, isCeilDev } from "./catalog.js";
import { DUCT_COLOR, ptsOf, val } from "./util.js";

const cctColor = k =>
  k <= 2700
    ? "#ffd09a"
    : k <= 3000
      ? "#ffdcae"
      : k <= 3500
        ? "#ffe6c4"
        : k <= 4000
          ? "#fff1dc"
          : k <= 5000
            ? "#fff8ef"
            : "#eef4ff";

function kit(THREE) {
  const mats = new Map();
  const std = (color, o = {}) => {
    const k = color + JSON.stringify(o);
    if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, ...o }));
    return mats.get(k);
  };
  const glow = color => std("#ffffff", { emissive: color, emissiveIntensity: 1.2, roughness: 0.3 });
  const box = (g, x, y, z, sx, sy, sz, m) => {
    const me = new THREE.Mesh(new THREE.BoxGeometry(Math.max(sx, 0.1), Math.max(sy, 0.1), Math.max(sz, 0.1)), m);
    me.position.set(x + sx / 2, y + sy / 2, z + sz / 2);
    me.castShadow = true;
    g.add(me);
    return me;
  };
  const cyl = (g, cx, y, cz, r, h, m, seg = 24) => {
    const me = new THREE.Mesh(new THREE.CylinderGeometry(r, r, Math.max(h, 0.1), seg), m);
    me.position.set(cx, y + h / 2, cz);
    g.add(me);
    return me;
  };
  return { std, glow, box, cyl };
}

let KIT = null;
const getKit = THREE => (KIT && KIT.THREE === THREE ? KIT : (KIT = { ...kit(THREE), THREE }));

export function build3d(it, ctx) {
  const THREE = ctx.THREE,
    K = getKit(THREE),
    g = new THREE.Group(),
    S = spec(),
    w = it.w,
    d = it.d,
    e = itemElev(it),
    h = itemH(it),
    type = it.type,
    white = K.std("#f5f5f4"),
    metal = K.std("#b8bcc2", { metalness: 0.6, roughness: 0.35 });
  g.userData.mep = true;
  if (DUCT_TYPES.includes(type)) {
    // 風管：沿節點的圓管
    const pts = ptsOf(it),
      r = (val(it, "dia") || 10) / 2,
      m = K.std(DUCT_COLOR[type] || "#999", { metalness: 0.5, roughness: 0.4 });
    const v = pts.map(([x, z]) => new THREE.Vector3(x, e, z));
    for (let i = 1; i < v.length; i++) {
      const a = v[i - 1],
        b = v[i],
        len = a.distanceTo(b);
      if (len < 0.1) continue;
      const me = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 20, 1, true), m);
      me.position.copy(a).add(b).multiplyScalar(0.5);
      me.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      g.add(me);
    }
    for (const p of v) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), m);
      s.position.copy(p);
      g.add(s);
    }
    return g;
  }
  if (type === "wire" || type === "conduit") return g;
  if (LIGHT_TYPES.has(type)) {
    const lit = K.glow(cctColor(val(it, "cct") || 3000));
    const cx = w / 2,
      cz = d / 2,
      r = Math.min(w, d) / 2;
    switch (type) {
      case "downlight":
      case "sensorLight":
        K.cyl(g, cx, e, cz, r, h, white);
        K.cyl(g, cx, e - 0.2, cz, r * 0.75, 0.3, lit);
        break;
      case "spot":
        K.cyl(g, cx, e, cz, r, h, K.std("#222"));
        K.cyl(g, cx, e - 0.2, cz, r * 0.5, 0.3, lit);
        break;
      case "ceilingLight":
        K.cyl(g, cx, e, cz, r, h, lit, 40);
        break;
      case "pendant": {
        const drop = val(it, "drop") || 60,
          top = S.ceilH;
        K.cyl(g, cx, top - drop, cz, 0.3, drop, K.std("#111"), 6);
        const shade = new THREE.Mesh(
          new THREE.ConeGeometry(r, 22, 32, 1, true),
          K.std("#1f2937", { side: THREE.DoubleSide }),
        );
        shade.position.set(cx, top - drop - 8, cz);
        g.add(shade);
        K.cyl(g, cx, top - drop - 17, cz, r * 0.35, 4, lit);
        K.cyl(g, cx, top - 1, cz, 6, 1, white);
        break;
      }
      case "trackLight": {
        K.box(g, 0, S.ceilH - 3, d / 2 - 1.5, w, 3, 3, K.std("#111"));
        const n = val(it, "heads") || 3;
        for (let i = 0; i < n; i++) {
          K.cyl(g, ((i + 0.5) * w) / n, S.ceilH - 14, d / 2, 3, 11, K.std("#111"));
          K.cyl(g, ((i + 0.5) * w) / n, S.ceilH - 14.2, d / 2, 2.2, 0.3, lit);
        }
        break;
      }
      case "lineLight":
      case "coveStrip":
        K.box(g, 0, e, 0, w, Math.max(h, 1), d, lit);
        break;
      case "wallLight":
        K.box(g, w / 2 - 6, e - 10, 0, 12, 20, 2, white);
        K.box(g, w / 2 - 4, e - 8, 2, 8, 16, Math.min(d, 10) - 2, lit);
        break;
      case "fanLight": {
        K.cyl(g, cx, S.ceilH - 30, cz, 0.8, 30, K.std("#333"));
        K.cyl(g, cx, S.ceilH - 38, cz, 10, 10, K.std("#333"));
        K.cyl(g, cx, S.ceilH - 40, cz, 8, 2, lit);
        for (let k = 0; k < 3; k++) {
          const b = new THREE.Mesh(new THREE.BoxGeometry(r - 10, 0.8, 12), K.std("#7c5a3a"));
          const a = (k * 2 * Math.PI) / 3;
          b.position.set(cx + Math.cos(a) * (r / 2 + 5), S.ceilH - 33, cz + Math.sin(a) * (r / 2 + 5));
          b.rotation.y = -a;
          g.add(b);
        }
        break;
      }
      case "bathFan":
        K.box(g, 0, e, 0, w, h, d, white);
        for (let x = 4; x < w - 2; x += 4) K.box(g, x, e - 0.4, 3, 1, 0.4, d - 6, K.std("#9ca3af"));
        break;
      default:
        K.cyl(g, cx, e, cz, r, h, white);
    }
    return g;
  }
  if (SWITCH_TYPES.has(type) || POWER_TYPES.has(type) || type === "wallCap") {
    if (type === "outletFloor") {
      K.box(g, 0, 0, 0, w, 1.5, d, metal);
      return g;
    }
    // 牆面面板：中心高度 = elev，貼在物件背面（牆側）
    const big = type === "panel" || type === "weakBox" || type === "intercom";
    const pw = big ? w : Math.min(w, type.startsWith("sw") || type === "dimmer" || type === "smartSw" ? 7 : 12),
      ph = big ? h : 12,
      pd = big ? Math.min(d, 12) : 1.2;
    const m = type === "panel" ? K.std("#d4d4d8") : type === "wallCap" ? metal : white;
    K.box(g, w / 2 - pw / 2, e - ph / 2, 0, pw, ph, pd, m);
    if (type === "panel") K.box(g, w / 2 - pw / 2 + 2, e - ph / 2 + 2, pd, pw - 4, ph - 4, 0.4, K.std("#a1a1aa"));
    return g;
  }
  // 空調設備
  if (type === "ervUnit" || type === "acIndoor") {
    K.box(g, 0, e, 0, w, h, d, K.std(type === "ervUnit" ? "#cbd5e1" : "#e5e7eb", { metalness: 0.3 }));
    return g;
  }
  if (type === "diffuser" || type === "grille") {
    const y = isCeilDev(type) ? e : S.ceilH - 3;
    K.box(g, 0, y, 0, w, 2, d, white);
    if (val(it, "style") === "round" && type === "diffuser")
      for (const k of [0.38, 0.24]) K.cyl(g, w / 2, y - 0.3, d / 2, Math.min(w, d) * k, 0.3, K.std("#9ca3af"));
    else for (let x = 3; x < w - 2; x += 3) K.box(g, x, y - 0.4, 2, 0.8, 0.4, d - 4, K.std("#9ca3af"));
    return g;
  }
  K.box(g, 0, e, 0, w, Math.max(h, 1), d, white);
  return g;
}

/** 立面圖：x∈[0,w]、y＝−高度（地面 y=0） */
export function elev2d(g, it, ctx) {
  const S = (ctx && ctx.spec) || spec(),
    w = it.w,
    type = it.type,
    e = itemElev(it),
    h = itemH(it),
    line = { stroke: "#262626", "stroke-width": 0.8, fill: "#fff" };
  const T = (x, y, s, size = 6) => {
    const t = el("text", { x, y, "font-size": size, "text-anchor": "middle", "dominant-baseline": "middle" }, g);
    t.textContent = s;
  };
  if (DUCT_TYPES.includes(type)) {
    const dia = val(it, "dia") || 10;
    el(
      "rect",
      {
        x: 0,
        y: -e - dia / 2,
        width: w,
        height: dia,
        fill: "none",
        stroke: DUCT_COLOR[type],
        "stroke-width": 0.8,
        "stroke-dasharray": "5 2",
      },
      g,
    );
    return;
  }
  if (type === "wire" || type === "conduit") return;
  if (isCeilDev(type) && type !== "pendant") {
    el("rect", { x: 0, y: -(e + h), width: w, height: Math.max(h, 1.5), ...line }, g);
    if (LIGHT_TYPES.has(type))
      el(
        "path",
        {
          d: `M${w * 0.2} ${-e} L${w * 0.05} ${-e + 6} M${w * 0.8} ${-e} L${w * 0.95} ${-e + 6}`,
          stroke: "#ca8a04",
          "stroke-width": 0.6,
          fill: "none",
        },
        g,
      );
    return;
  }
  if (type === "pendant") {
    const drop = val(it, "drop") || 60;
    el(
      "line",
      { x1: w / 2, y1: -S.ceilH, x2: w / 2, y2: -(S.ceilH - drop), stroke: "#262626", "stroke-width": 0.6 },
      g,
    );
    el(
      "path",
      {
        d: `M${w / 2 - 6} ${-(S.ceilH - drop)} L${w / 2 + 6} ${-(S.ceilH - drop)} L${w} ${-(S.ceilH - drop - 22)} L0 ${-(S.ceilH - drop - 22)} Z`,
        ...line,
      },
      g,
    );
    return;
  }
  if (type === "outletFloor") {
    el("rect", { x: 0, y: -1.5, width: w, height: 1.5, ...line }, g);
    return;
  }
  const big = type === "panel" || type === "weakBox" || type === "intercom" || type === "wallLight";
  const pw = big ? w : Math.min(w, SWITCH_TYPES.has(type) ? 7 : 12),
    ph = big ? h : 12;
  el("rect", { x: w / 2 - pw / 2, y: -e - ph / 2, width: pw, height: ph, rx: 0.8, ...line }, g);
  if (SWITCH_TYPES.has(type)) {
    const n = val(it, "gang") || 1;
    for (let i = 0; i < n; i++)
      el(
        "rect",
        {
          x: w / 2 - pw / 2 + 1 + (i * (pw - 2)) / n,
          y: -e - 4,
          width: (pw - 2) / n - 0.6,
          height: 8,
          fill: "none",
          stroke: "#262626",
          "stroke-width": 0.5,
        },
        g,
      );
  } else if (POWER_TYPES.has(type) && !big) {
    el("circle", { cx: w / 2 - 2.5, cy: -e, r: 1.6, fill: "none", stroke: "#262626", "stroke-width": 0.5 }, g);
    el("circle", { cx: w / 2 + 2.5, cy: -e, r: 1.6, fill: "none", stroke: "#262626", "stroke-width": 0.5 }, g);
  } else if (type === "panel") T(w / 2, -e, "P", 8);
  // 中心高度標註
  T(w / 2 + pw / 2 + 7, -e, `${Math.round(e)}`, 5);
}
