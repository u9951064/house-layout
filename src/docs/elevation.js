// 立面圖繪製：牆面裝修、門窗開口、端部剖面、靠牆物件正視、尺寸鏈、高程標記、材質引出線
import { t } from "../core/i18n.js";
import { S, state } from "../core/store.js";
import { el } from "../core/dom.js";
import { DEFAULTS } from "../shapes/library.js";
import { EXT } from "../ext/registry.js";
import { itemElev, itemH, spec } from "../ext/heights.js";
import { layerOf } from "../ext/plans.js";
import { getMat, svgPattern } from "../materials/index.js";
import { endWalls, faceInfo, faceKey, opRange, project } from "./walls.js";

let clipSeq = 0;

const SKIP = new Set(["text", "dimension"]);

function txt(g, x, y, s, cls, size, anchor = "middle") {
  const e = el("text", { x, y, class: cls, "font-size": size, "text-anchor": anchor }, g);
  e.textContent = s;
  return e;
}
/** 建築尺寸線（斜線端點） */
export function dimH(g, s1, s2, y, fs, label) {
  if (Math.abs(s2 - s1) < 0.5) return;
  const k = fs * 0.35;
  el("line", { x1: s1, y1: y, x2: s2, y2: y, class: "ev-dim" }, g);
  for (const s of [s1, s2]) {
    el("line", { x1: s, y1: y - fs * 0.6, x2: s, y2: y + fs * 0.3, class: "ev-dim" }, g);
    el("line", { x1: s - k, y1: y + k, x2: s + k, y2: y - k, class: "ev-tick" }, g);
  }
  txt(g, (s1 + s2) / 2, y - fs * 0.3, label ?? String(Math.round(s2 - s1)), "ev-dimtext", fs * 0.8);
}
export function dimV(g, x, h1, h2, fs, label) {
  if (Math.abs(h2 - h1) < 0.5) return;
  const k = fs * 0.35,
    y1 = -h1,
    y2 = -h2;
  el("line", { x1: x, y1, x2: x, y2, class: "ev-dim" }, g);
  for (const y of [y1, y2]) {
    el("line", { x1: x - fs * 0.3, y1: y, x2: x + fs * 0.6, y2: y, class: "ev-dim" }, g);
    el("line", { x1: x - k, y1: y + k, x2: x + k, y2: y - k, class: "ev-tick" }, g);
  }
  const e = txt(g, x - fs * 0.3, (y1 + y2) / 2, label ?? String(Math.round(Math.abs(h2 - h1))), "ev-dimtext", fs * 0.8);
  e.setAttribute("transform", `rotate(-90 ${x - fs * 0.3} ${(y1 + y2) / 2})`);
}
function level(g, x, h, fs, label) {
  const y = -h,
    k = fs * 0.45;
  el("path", { d: `M${x} ${y} l${-k} ${-k} h${2 * k} z`, class: "ev-level" }, g);
  el("line", { x1: x - fs * 2.2, y1: y, x2: x + fs * 0.6, y2: y, class: "ev-thin" }, g);
  txt(g, x - fs * 0.2, y - k - fs * 0.25, label, "ev-text", fs * 0.75, "end");
}
function hatchRect(g, root, x, y, w, h) {
  if (w <= 0 || h <= 0) return;
  el("rect", { x, y, width: w, height: h, class: "ev-cut", fill: hatchFill(root) }, g);
}
function hatchFill(root) {
  let defs = root.querySelector("defs");
  if (!defs) defs = el("defs", {}, root);
  if (!root.querySelector("#ev-hatch")) {
    const p = el(
      "pattern",
      { id: "ev-hatch", patternUnits: "userSpaceOnUse", width: 8, height: 8, patternTransform: "rotate(45)" },
      defs,
    );
    el("rect", { width: 8, height: 8, fill: "#fff" }, p);
    el("line", { x1: 0, y1: 0, x2: 0, y2: 8, stroke: "#555", "stroke-width": 0.9 }, p);
  }
  return "url(#ev-hatch)";
}
function matFill(root, id) {
  try {
    return svgPattern(root, id) || getMat(id).color;
  } catch (e) {
    return "#eee";
  }
}
/** 傳給 EXT.elev2d 的 ctx（欄位說明見 src/docs/index.js） */
function elevCtx({ root, fs, den, i, face, mirror, sp, it, doors }) {
  const pat = id => matFill(root, id);
  return {
    doors: doors === "open" ? "open" : "closed",
    scale: den,
    den,
    fs,
    svgRoot: root,
    root,
    svgPattern: pat,
    mat: pat,
    face,
    wallIndex: i,
    view: "front",
    mirror,
    spec: sp,
    h: itemH(it),
    elev: itemElev(it),
  };
}
/** 物件四角（平面世界座標） */
function corners(it) {
  const a = ((it.rot || 0) * Math.PI) / 180,
    cx = it.x + it.w / 2,
    cy = it.y + it.d / 2;
  return [
    [-it.w / 2, -it.d / 2],
    [it.w / 2, -it.d / 2],
    [it.w / 2, it.d / 2],
    [-it.w / 2, it.d / 2],
  ].map(([px, py]) => ({ x: cx + px * Math.cos(a) - py * Math.sin(a), y: cy + px * Math.sin(a) + py * Math.cos(a) }));
}

/** 這面牆前方（depth cm 內）的物件與其立面投影 */
export function itemsInFront(F, depth = 70) {
  const out = [];
  // 底圖固定設備（既有流理台、吊櫃…）也畫進立面，id 以 fx 開頭（不可在立面拖曳）
  const fixtures = ((S.BASE && S.BASE.fixtures) || []).map((f, k) => ({
    ...f,
    rot: f.rot || 0,
    id: "fx" + k,
    locked: true,
  }));
  for (const it of [...state.items, ...fixtures]) {
    if (SKIP.has(it.type) || layerOf(it) === "floor") continue;
    const ps = corners(it).map(p => project(F, p));
    const smin = Math.min(...ps.map(p => p.s)),
      smax = Math.max(...ps.map(p => p.s)),
      dmin = Math.min(...ps.map(p => p.dn)),
      dmax = Math.max(...ps.map(p => p.dn));
    if (smax <= 0 || smin >= F.len || dmax < -2 || dmin > depth) continue;
    const a = ((it.rot || 0) * Math.PI) / 180;
    const front = { x: -Math.sin(a), y: Math.cos(a) },
      lx = { x: Math.cos(a), y: Math.sin(a) };
    const fn = front.x * F.n.x + front.y * F.n.y;
    const mirror = lx.x * F.r.x + lx.y * F.r.y < 0 !== !!it.flip;
    out.push({ it, smin, smax, dmin, dmax, fn, mirror });
  }
  return out.sort((p, q) => q.dmin - p.dmin);
}

/**
 * 在 g 裡畫出牆 i 的 face 面立面圖（單位 cm，y 向上為負）。
 * opts: { depth: 物件納入深度, den: 比例分母（決定字級）, root: 放 defs 的 <svg>, doors: "closed" | "open" }
 * 回傳 { bbox: { x, y, w, h }, F, items }
 */
export function drawElevation(g, i, face, opts = {}) {
  const F = faceInfo(i, face);
  const sp = spec(),
    den = opts.den || 30,
    fs = 0.3 * den, // 紙上約 2.5 mm 的字
    root = opts.root || g.ownerSVGElement;
  const ceilH = sp.ceilH,
    slabH = Math.max(sp.slabH, ceilH);
  const ew = endWalls(F);
  const tS = ew.start || 0,
    tE = ew.end || 0;
  const v0 = tS / 2,
    v1 = F.len - tE / 2; // 可見牆面範圍
  const slabT = 15;

  // 牆面裝修
  const wallMat = sp.wallFin[faceKey(i, face)] || sp.wallMat;
  el(
    "rect",
    { x: v0, y: -ceilH, width: v1 - v0, height: ceilH, class: "ev-wallfill", fill: matFill(root, wallMat) },
    g,
  );
  // 天花內（天花板到樓板）
  el("rect", { x: v0, y: -slabH, width: v1 - v0, height: slabH - ceilH, class: "ev-plenum" }, g);
  // 樓板與端部剖面
  hatchRect(g, root, -tS / 2, 0, F.len + (tS + tE) / 2, slabT);
  hatchRect(g, root, -tS / 2, -slabH - slabT, F.len + (tS + tE) / 2, slabT);
  if (tS) hatchRect(g, root, -tS / 2, -slabH, tS, slabH);
  if (tE) hatchRect(g, root, F.len - tE / 2, -slabH, tE, slabH);

  // 開口
  const opsInfo = (F.ops || []).map(op => {
    const [s1, s2] = opRange(F, op),
      o = op[3] && typeof op[3] === "object" ? op[3] : {},
      kind = op[2];
    const bottom = kind === "win" ? (o.sill ?? sp.winSill) : 0,
      top = kind === "win" ? (o.head ?? sp.winHead) : (o.head ?? sp.doorH);
    return { s1, s2, kind, o, bottom, top: Math.min(top, ceilH) };
  });
  // 踢腳板（門與開口處斷開）
  if (sp.skirtH > 0) {
    let segs = [[v0, v1]];
    for (const p of opsInfo.filter(p => p.kind !== "win"))
      segs = segs.flatMap(([a, b]) =>
        p.s2 <= a || p.s1 >= b
          ? [[a, b]]
          : [
              [a, Math.max(a, p.s1)],
              [Math.min(b, p.s2), b],
            ].filter(([x, y]) => y - x > 1),
      );
    for (const [a, b] of segs)
      el(
        "rect",
        { x: a, y: -sp.skirtH, width: b - a, height: sp.skirtH, class: "ev-skirt", fill: matFill(root, sp.skirtMat) },
        g,
      );
  }
  for (const p of opsInfo) drawOpening(g, p, fs, root);

  // 天花完成面線、樓板線
  el("line", { x1: v0, y1: -ceilH, x2: v1, y2: -ceilH, class: "ev-ceil" }, g);
  el("line", { x1: -tS / 2, y1: 0, x2: F.len + tE / 2, y2: 0, class: "ev-floor" }, g);
  el("line", { x1: v0, y1: -slabH, x2: v1, y2: -slabH, class: "ev-slab" }, g);

  // 物件
  const items = itemsInFront(F, opts.depth ?? 70);
  const nearest = items.length ? Math.min(...items.map(x => x.dmin)) : 0;
  // 物件只畫在這面牆的範圍內（風管、天花等跨出牆端的部分裁掉）
  let defs = root.querySelector("defs");
  if (!defs) defs = el("defs", {}, root);
  const clipId = "evclip" + ++clipSeq;
  const cp = el("clipPath", { id: clipId }, defs);
  el("rect", { x: v0, y: -slabH - 1, width: v1 - v0, height: slabH + 2 }, cp);
  const og = el("g", { "clip-path": `url(#${clipId})` }, g);
  for (const x of items) {
    const { it, smin, smax } = x;
    const ig = el("g", { class: "ev-obj", "data-id": it.id }, og);
    if (x.dmin > nearest + 25) ig.setAttribute("opacity", "0.5");
    if (layerOf(it) === "ceiling") {
      const h = it.ceilH ?? ceilH;
      el("line", { x1: smin, y1: -h, x2: smax, y2: -h, class: "ev-ceilzone" }, ig);
      txt(ig, (smin + smax) / 2, -h + fs, `CH ${Math.round(h)}`, "ev-text", fs * 0.7);
      continue;
    }
    const fnDraw = EXT.elev2d[it.type];
    if (fnDraw && x.fn > 0.7) {
      const w = it.w,
        tg = el(
          "g",
          {
            class: "item",
            transform: x.mirror ? `translate(${smin + w} 0) scale(-1 1)` : `translate(${smin} 0)`,
          },
          ig,
        );
      try {
        fnDraw(tg, it, elevCtx({ root, fs, den, i, face, mirror: x.mirror, sp, it, doors: opts.doors }));
      } catch (e) {
        console.error(e);
      }
    } else {
      const h = itemH(it),
        e0 = itemElev(it);
      if (h <= 1) el("line", { x1: smin, y1: -e0, x2: smax, y2: -e0, class: "ev-objline" }, ig);
      else el("rect", { x: smin, y: -(e0 + h), width: smax - smin, height: h, class: "ev-objbox" }, ig);
      if (h > fs * 1.5 && smax - smin > fs * 2)
        txt(
          ig,
          (smin + smax) / 2,
          -(e0 + h / 2) + fs * 0.3,
          it.label || DEFAULTS[it.type]?.name || it.type,
          "ev-text",
          fs * 0.75,
        );
    }
  }

  // 尺寸鏈（水平）
  const yD1 = slabT + fs * 2.2,
    yD2 = yD1 + fs * 2;
  const pts = [v0, v1];
  for (const p of opsInfo) pts.push(p.s1, p.s2);
  for (const x of items) if (layerOf(x.it) !== "ceiling") pts.push(Math.max(v0, x.smin), Math.min(v1, x.smax));
  const chain = [...new Set(pts.filter(s => s >= v0 - 0.5 && s <= v1 + 0.5).map(s => Math.round(s * 10) / 10))].sort(
    (a, b) => a - b,
  );
  // 太短的分段（字會重疊）併到下一段，頭尾一定保留
  const ch = [chain[0]];
  for (let k = 1; k < chain.length; k++) {
    const last = k === chain.length - 1;
    if (chain[k] - ch[ch.length - 1] >= fs * 1.2 || last) {
      if (last && ch.length > 1 && chain[k] - ch[ch.length - 1] < fs * 1.2) ch.pop();
      ch.push(chain[k]);
    }
  }
  for (let k = 1; k < ch.length; k++) dimH(g, ch[k - 1], ch[k], yD1, fs);
  dimH(g, v0, v1, yD2, fs);
  // 尺寸鏈（垂直）
  const xV = F.len + tE / 2 + fs * 2.5;
  const hs = [0, ceilH];
  for (const p of opsInfo) hs.push(p.bottom, p.top);
  const hv = [...new Set(hs.map(h => Math.round(h)))].sort((a, b) => a - b);
  for (let k = 1; k < hv.length; k++) dimV(g, xV, hv[k - 1], hv[k], fs);
  dimV(g, xV + fs * 2, 0, slabH, fs);
  // 高程
  const xL = -tS / 2 - fs * 0.8;
  level(g, xL, 0, fs, "FL±0");
  level(g, xL, ceilH, fs, `CH ${Math.round(ceilH)}`);
  level(g, xL, slabH, fs, `SL ${Math.round(slabH)}`);

  // 材質引出線
  const yC = -slabH - slabT - fs * 1.4;
  const callout = (sx, sy, label, k) => {
    const tx = v0 + fs + k * (v1 - v0) * 0.45;
    el("polyline", { points: `${sx},${sy} ${sx},${yC + fs * 0.4} ${tx},${yC + fs * 0.4}`, class: "ev-leader" }, g);
    el("circle", { cx: sx, cy: sy, r: fs * 0.18, class: "ev-dot" }, g);
    txt(g, tx, yC, label, "ev-text", fs * 0.75, "start");
  };
  const wm = getMat(wallMat);
  callout(v0 + (v1 - v0) * 0.12, -ceilH * 0.7, `${t("牆面")}：${wm.name}${wm.code ? "（" + wm.code + "）" : ""}`, 0);
  if (sp.skirtH > 0) {
    const sm = getMat(sp.skirtMat);
    callout(v0 + (v1 - v0) * 0.55, -sp.skirtH / 2, `${t("踢腳板")} H${sp.skirtH}：${sm.name}`, 1);
  }

  const x0 = -tS / 2 - fs * 3.5,
    y0 = yC - fs * 1.6;
  return { bbox: { x: x0, y: y0, w: xV + fs * 3.5 - x0, h: yD2 + fs * 1.5 - y0 }, F, items };
}

function drawOpening(g, p, fs, root) {
  const { s1, s2, kind, o, bottom, top } = p,
    w = s2 - s1,
    h = top - bottom,
    y = -top;
  if (w <= 0 || h <= 0) return;
  const og = el("g", { class: "ev-op ev-" + kind }, g);
  el("rect", { x: s1, y, width: w, height: h, class: "ev-hole" }, og);
  if (kind === "open") {
    el("rect", { x: s1, y, width: w, height: h, class: "ev-hidden" }, og);
    return;
  }
  const fr = 4;
  if (kind === "win") {
    el("rect", { x: s1 + fr, y: y + fr, width: w - 2 * fr, height: h - 2 * fr, class: "ev-frame" }, og);
    const glass = el("rect", { x: s1 + fr, y: y + fr, width: w - 2 * fr, height: h - 2 * fr, class: "ev-glass" }, og);
    if (o.glass === "frosted") glass.classList.add("frosted");
    if (o.glass === "reeded")
      for (let x = s1 + fr + 4; x < s2 - fr; x += 4)
        el("line", { x1: x, y1: y + fr, x2: x, y2: y + h - fr, class: "ev-thin" }, og);
    const st = o.style || "slide2";
    const mid = (a, b) => (a + b) / 2;
    if (st === "slide2" || st === "slide3") {
      const n = st === "slide3" ? 3 : 2;
      for (let k = 1; k < n; k++) {
        const x = s1 + (k * w) / n;
        el("line", { x1: x, y1: y + fr, x2: x, y2: y + h - fr, class: "ev-frameline" }, og);
      }
      for (let k = 0; k < n; k++) {
        const cx = s1 + ((k + 0.5) * w) / n,
          cy = -mid(bottom, top),
          a = Math.min(w / n / 4, fs),
          dir = k % 2 ? -1 : 1;
        el(
          "path",
          { d: `M${cx - a * dir} ${cy} h${2 * a * dir} l${-a * 0.4 * dir} ${-a * 0.3}`, class: "ev-thin" },
          og,
        );
      }
    } else if (st === "casement") {
      const x = mid(s1, s2);
      el("line", { x1: x, y1: y + fr, x2: x, y2: y + h - fr, class: "ev-frameline" }, og);
      el(
        "polyline",
        { points: `${s1 + fr},${y + fr} ${x - 2},${-mid(bottom, top)} ${s1 + fr},${y + h - fr}`, class: "ev-swing" },
        og,
      );
      el(
        "polyline",
        { points: `${s2 - fr},${y + fr} ${x + 2},${-mid(bottom, top)} ${s2 - fr},${y + h - fr}`, class: "ev-swing" },
        og,
      );
    } else if (st === "awning") {
      el(
        "polyline",
        { points: `${s1 + fr},${y + h - fr} ${mid(s1, s2)},${y + fr} ${s2 - fr},${y + h - fr}`, class: "ev-swing" },
        og,
      );
    } else if (st === "fixed") {
      const tx = el(
        "text",
        { x: mid(s1, s2), y: -mid(bottom, top), class: "ev-text", "font-size": fs * 0.7, "text-anchor": "middle" },
        og,
      );
      tx.textContent = "FIX";
    } else if (st === "bay") {
      el("rect", { x: s1 + fr * 2, y: y + fr * 2, width: w - 4 * fr, height: h - 4 * fr, class: "ev-frameline" }, og);
    }
    return;
  }
  // 門
  const hingeA = o.hinge !== "b",
    hx = hingeA ? s1 : s2,
    ox = hingeA ? s2 : s1,
    lf = 2;
  el("rect", { x: s1 + lf, y: y + lf, width: w - 2 * lf, height: h - lf, class: "ev-leaf" }, og);
  const ls = o.leafStyle || "flat";
  if (ls === "panel") {
    const pw = w - 2 * lf - 16,
      ph = (h - 30) / 2;
    el("rect", { x: s1 + lf + 8, y: y + 10, width: pw, height: ph, class: "ev-thin" }, og);
    el("rect", { x: s1 + lf + 8, y: y + 20 + ph, width: pw, height: ph, class: "ev-thin" }, og);
  } else if (ls === "glass") {
    el("rect", { x: s1 + lf + 10, y: y + 12, width: w - 2 * lf - 20, height: h * 0.6, class: "ev-glass" }, og);
  } else if (ls === "groove") {
    for (let yy = y + 20; yy < -10; yy += 20)
      el("line", { x1: s1 + lf, y1: yy, x2: s2 - lf, y2: yy, class: "ev-thin" }, og);
  } else if (ls === "louver") {
    for (let yy = y + 8; yy < -6; yy += 6)
      el("line", { x1: s1 + lf + 6, y1: yy, x2: s2 - lf - 6, y2: yy, class: "ev-thin" }, og);
  }
  // 開門方向記號：虛線收在鉸鏈側
  el("polyline", { points: `${ox},${y + lf} ${hx},${-h / 2} ${ox},${-lf}`, class: "ev-swing" }, og);
  el("circle", { cx: ox + (hingeA ? -8 : 8), cy: -100, r: 2.2, class: "ev-handle" }, og);
}
