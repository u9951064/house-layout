// 櫃體圖面：平面圖例、立面（關門／開門內部）、側剖面、尺寸線
import { t } from "../core/i18n.js";
import { el } from "../core/dom.js";
import { getMat } from "../materials/index.js";
import { itemElev } from "../ext/heights.js";
import { cabFronts, cabHandles, cabLayout, cabParts, cfg } from "./model.js";

const STROKE = "#1f2328";
const st = (w = 1, extra = {}) => ({
  stroke: STROKE,
  "stroke-width": w,
  "vector-effect": "non-scaling-stroke",
  fill: "none",
  ...extra,
});
const DASH = { "stroke-dasharray": "5 3" };
export const rect = (g, x, y, w, h, a = {}) =>
  el(
    "rect",
    { x: Math.min(x, x + w), y: Math.min(y, y + h), width: Math.abs(w), height: Math.abs(h), ...st(1), ...a },
    g,
  );
export const line = (g, x1, y1, x2, y2, a = {}) => el("line", { x1, y1, x2, y2, ...st(0.8), ...a }, g);
export const text = (g, x, y, s, fs, a = {}) => {
  const e = el("text", { x, y, "font-size": fs, "text-anchor": "middle", fill: STROKE, stroke: "none", ...a }, g);
  e.textContent = s;
  return e;
};

/** 開關比例：物件 it.cab.open 優先，其次 ctx.doors（"open" | "closed" | 0..1） */
export function openRatio(it, ctx = {}) {
  const c = it.cab || {};
  if (c.open != null && c.open !== "") return Math.max(0, Math.min(1, +c.open));
  if (ctx.doors === "open") return 1;
  if (typeof ctx.doors === "number") return Math.max(0, Math.min(1, ctx.doors));
  return 0;
}

// ───────── 平面圖例（EXT.draw2d，局部 x∈[0,w]、y∈[0,d]，正面在 y=d）─────────
export function drawPlan(g, w, d, it) {
  const L = cabLayout(it),
    { c, cd, ov, xs } = L;
  const upper = it.type === "cabWall" || itemElev(it) >= 120;
  const cls = upper ? "d" : "s";
  if (c.top && L.topT > 0) {
    el("rect", { x: 0, y: 0, width: w, height: d, class: cls }, g);
    el("rect", { x: L.x0, y: 0, width: L.W, height: cd + L.front, class: upper ? "d" : "t" }, g);
  } else el("rect", { x: 0, y: 0, width: w, height: d, class: cls }, g);
  for (let i = 1; i < xs.length - 1; i++) el("line", { x1: xs[i], y1: 0, x2: xs[i], y2: cd, class: "t" }, g);
  el("line", { x1: L.x0, y1: cd, x2: L.x0 + L.W, y2: cd, class: "t" }, g);
  if (upper) {
    el("line", { x1: 0, y1: 0, x2: w, y2: d, class: "d" }, g);
    el("line", { x1: w, y1: 0, x2: 0, y2: d, class: "d" }, g);
  } else if (L.h > 150)
    for (let i = 0; i < xs.length - 1; i++) el("line", { x1: xs[i], y1: cd, x2: xs[i + 1], y2: 0, class: "t" }, g);
  const { doors, drawers } = cabFronts(it);
  const fy = d - ov;
  for (const o of doors) {
    const dw = o.x2 - o.x1;
    if (o.hinge === "L" || o.hinge === "R") {
      const r = Math.min(dw, 60),
        hx = o.hinge === "L" ? o.x1 : o.x2,
        sx = o.hinge === "L" ? 1 : -1;
      el("line", { x1: hx, y1: fy, x2: hx, y2: fy + r, class: "t" }, g);
      el("path", { d: `M${hx} ${fy + r} A ${r} ${r} 0 0 ${sx > 0 ? 0 : 1} ${hx + sx * r} ${fy}`, class: "d" }, g);
    } else if (o.hinge === "S") {
      const y = fy - (o.z2 > L.cd + L.dt + 0.5 ? 0 : L.dt);
      el("line", { x1: o.x1, y1: y, x2: o.x2, y2: y, class: "t" }, g);
      const m = (o.x1 + o.x2) / 2,
        a = Math.min(8, dw / 4);
      el(
        "path",
        {
          d: `M${m - a} ${y - 3} L${m + a} ${y - 3} M${m + a - 2} ${y - 4.5} L${m + a} ${y - 3} L${m + a - 2} ${y - 1.5}`,
          class: "t",
        },
        g,
      );
    }
  }
  for (const o of drawers.filter((x, i, a) => a.findIndex(y => y.sec === x.sec) === i)) {
    const m = (o.x1 + o.x2) / 2;
    el("path", { d: `M${m - 4} ${fy + 2} L${m} ${fy + 6} L${m + 4} ${fy + 2}`, class: "t" }, g);
  }
}

// ───────── 立面（EXT.elev2d：x∈[0,w]、y＝−高度）─────────
/**
 * 正視圖。ctx.doors："closed"（預設，門板＋把手＋開門方向三角）、"open"（內部＋門扇打開）、
 * ctx.interior＝true 只畫內部（拆門）；ctx.fs 字級（cm）；ctx.dims 是否標尺寸；ctx.labels 是否標材質
 */
export function drawElev(g, it, ctx = {}) {
  const L = cabLayout(it),
    { c, T, ch, toe, xs, x0, W, h, topT } = L;
  const E = itemElev(it),
    Y = y => -(E + y);
  const ratio = ctx.interior ? 1 : openRatio(it, ctx);
  const showDoors = !ctx.interior,
    open = ratio > 0.01;
  const fill = (id, op = 1) => ({ fill: getMat(id).color || "#fff", "fill-opacity": op });
  // 櫃身
  rect(g, x0, Y(0), W, -ch, { ...fill(c.carcassMat, 0.35) });
  if (x0 > 0) rect(g, 0, Y(toe), x0, -(ch - toe), fill(c.doorMat, 0.6));
  if (+c.fillerR > 0) rect(g, x0 + W, Y(toe), +c.fillerR, -(ch - toe), fill(c.doorMat, 0.6));
  if (c.top && topT > 0) rect(g, 0, Y(h - topT), it.w, -topT, { ...fill(c.top.mat, 0.8), "stroke-width": 1.2 });
  if (toe > 0) {
    rect(g, x0 + T, Y(0), W - 2 * T, -toe, { fill: "#d0d4da", "fill-opacity": 0.6, "stroke-width": 0.6 });
  }
  const { doors, drawers } = cabFronts(it);
  const parts = cabParts(it);
  const drawInterior = () => {
    // 內部：側板、中隔、層板、吊衣桿、抽屜盒
    for (const p of parts) {
      if (["side", "divider"].includes(p.role))
        rect(g, p.x, Y(p.y), p.sx, -p.sy, { fill: "#fff", "stroke-width": 0.8 });
      if (["top", "bottom", "shelf"].includes(p.role))
        rect(g, p.x, Y(p.y), p.sx, -p.sy, { fill: p.fixed ? "#9aa1ab" : "#c3c8cf", "stroke-width": 0.6 });
      if (p.role === "rod") {
        line(g, p.x + 1, Y(p.y + 1.25), p.x + p.sx - 1, Y(p.y + 1.25), { "stroke-width": 2 });
        for (let x = p.x + 10; x < p.x + p.sx - 8; x += 12)
          el("path", { d: `M${x} ${Y(p.y)} l-4 6 h8 z`, ...st(0.5, { fill: "none" }) }, g);
      }
    }
    for (const o of drawers) {
      const b = o.box;
      const pull = ratio * 0.6;
      rect(g, b.x1, Y(b.y1), b.x2 - b.x1, -(b.y2 - b.y1), { fill: "#eef0f3", "stroke-width": 0.7 });
      if (pull > 0.01 && showDoors)
        rect(g, o.x1, Y(o.y1) + 1.5, o.x2 - o.x1, -(o.y2 - o.y1), {
          ...fill(c.doorMat, 0.35),
          ...DASH,
          "stroke-width": 0.7,
        });
    }
    const appl = c.sections.map((s, i) => (s.kind === "appliance" ? i : -1)).filter(i => i >= 0);
    for (const i of appl) {
      const ox1 = xs[i] + T,
        ox2 = xs[i + 1] - T;
      const dz = doors.filter(o => o.sec === i)[0];
      const top = dz ? dz.y1 - T : L.yt,
        dzr = drawers.filter(o => o.sec === i);
      const bot = dzr.length ? Math.max(...dzr.map(o => o.y2)) + T : L.yb;
      if (top - bot > 20) {
        rect(g, ox1 + 4, Y(bot + 2), ox2 - ox1 - 8, -(top - bot - 6), { ...DASH, "stroke-width": 0.6 });
        text(g, (ox1 + ox2) / 2, Y((top + bot) / 2), t("電器"), ctx.fs || 4, { fill: "#6b7280" });
      }
    }
  };
  if (open || !showDoors) drawInterior();
  if (!showDoors) return;
  if (!open) {
    for (const p of parts.filter(q => q.role === "shelf" || q.role === "rod")) {
      // 開放格的層板直接看得到
      const sec = c.sections[p.section];
      if (sec && ["open", "niche"].includes(sec.kind) && p.role === "shelf")
        rect(g, p.x, Y(p.y), p.sx, -p.sy, { fill: "#c3c8cf", "stroke-width": 0.6 });
    }
    for (const o of drawers) {
      rect(g, o.x1, Y(o.y1), o.x2 - o.x1, -(o.y2 - o.y1), fill(c.doorMat, 0.85));
    }
    for (const o of doors) {
      const isGlass = o.kind === "glass";
      rect(
        g,
        o.x1,
        Y(o.y1),
        o.x2 - o.x1,
        -(o.y2 - o.y1),
        isGlass ? { fill: "#dbeafe", "fill-opacity": 0.5 } : fill(c.doorMat, 0.85),
      );
      if (isGlass) {
        const w = o.x2 - o.x1,
          hh = o.y2 - o.y1;
        line(g, o.x1 + w * 0.2, Y(o.y1 + hh * 0.55), o.x1 + w * 0.45, Y(o.y1 + hh * 0.8), { "stroke-width": 0.5 });
        line(g, o.x1 + w * 0.3, Y(o.y1 + hh * 0.5), o.x1 + w * 0.55, Y(o.y1 + hh * 0.75), { "stroke-width": 0.5 });
      }
      // 開門方向：虛線三角形，尖端在鉸鏈側
      const mx = (o.x1 + o.x2) / 2,
        my = (o.y1 + o.y2) / 2;
      const tri =
        o.hinge === "L"
          ? `M${o.x2} ${Y(o.y2)} L${o.x1} ${Y(my)} L${o.x2} ${Y(o.y1)}`
          : o.hinge === "R"
            ? `M${o.x1} ${Y(o.y2)} L${o.x2} ${Y(my)} L${o.x1} ${Y(o.y1)}`
            : o.hinge === "T"
              ? `M${o.x1} ${Y(o.y1)} L${mx} ${Y(o.y2)} L${o.x2} ${Y(o.y1)}`
              : null;
      if (tri) el("path", { d: tri, ...st(0.6, DASH) }, g);
      if (o.hinge === "S") {
        const a = Math.min(10, (o.x2 - o.x1) / 4);
        el("path", { d: `M${mx - a} ${Y(my)} H${mx + a} m-3 -2 l3 2 l-3 2`, ...st(0.6) }, g);
      }
    }
  } else {
    // 開門：鉸鏈門畫成打開的門扇（斜投影）＋虛線擺動；拉門推到一側；上掀門翻到上方
    for (const o of doors) {
      const w = o.x2 - o.x1,
        hh = o.y2 - o.y1,
        k = Math.sin((ratio * Math.PI) / 2);
      if (o.hinge === "L" || o.hinge === "R") {
        const s = o.hinge === "L" ? -1 : 1,
          hx = o.hinge === "L" ? o.x1 : o.x2;
        const lw = w * (1 - k) + w * 0.28 * k,
          sk = hh * 0.06 * k;
        const ex = hx + s * lw;
        el(
          "path",
          {
            d: `M${hx} ${Y(o.y1)} L${ex} ${Y(o.y1) + sk} L${ex} ${Y(o.y2) - sk} L${hx} ${Y(o.y2)} Z`,
            ...st(1, { fill: o.kind === "glass" ? "#dbeafe" : getMat(c.doorMat).color, "fill-opacity": 0.55 }),
          },
          g,
        );
        el(
          "path",
          {
            d: `M${hx + s * w} ${Y(o.y1 + hh * 0.5)} Q ${hx + s * w * 0.9} ${Y(o.y1 + hh * 0.5) - hh * 0.04} ${ex} ${Y(o.y1 + hh * 0.5)}`,
            ...st(0.6, DASH),
          },
          g,
        );
      } else if (o.hinge === "T") {
        const lh = hh * (1 - k) + hh * 0.3 * k;
        el(
          "path",
          {
            d: `M${o.x1} ${Y(o.y2)} L${o.x1 + w * 0.04 * k} ${Y(o.y2 + lh)} L${o.x2 - w * 0.04 * k} ${Y(o.y2 + lh)} L${o.x2} ${Y(o.y2)} Z`,
            ...st(1, { fill: getMat(c.doorMat).color, "fill-opacity": 0.55 }),
          },
          g,
        );
      } else if (o.hinge === "S") {
        const back = o.z2 < L.cd + L.dt + 0.5;
        const dx = back ? (o.x2 - o.x1) * ratio * 0.95 : -(o.x2 - o.x1) * ratio * 0.95;
        rect(g, o.x1 + dx, Y(o.y1), w, -hh, { ...fill(c.doorMat, 0.45), ...DASH });
      }
    }
  }
  for (const hd of cabHandles(it)) {
    if (open) break;
    rect(g, hd.x, Y(hd.y), hd.sx, -hd.sy, { fill: getMat(c.handleMat).color || "#333", "stroke-width": 0.4 });
  }
  if (ctx.labels) {
    const fs = ctx.fs || 4;
    text(g, it.w / 2, Y(h) - fs * 0.6, getMat(c.doorMat).name, fs * 0.8, { fill: "#4b5563" });
  }
}

// ───────── 側剖面（A-A，橫軸 z：背 0 → 正面 d；縱軸 y）─────────
export function drawSection(g, it, ctx = {}) {
  const L = cabLayout(it),
    { c } = L;
  const E = itemElev(it),
    Y = y => -(E + y);
  const sec = ctx.section ?? 0;
  const parts = cabParts(it).filter(
    p => !["side", "filler", "divider"].includes(p.role) && (p.section == null || p.section === sec),
  );
  const cut = { fill: "#9aa1ab", "stroke-width": 0.8 };
  // 側板輪廓（看到的面，細線）
  rect(g, 0, Y(0), L.cd, -L.ch, { "stroke-width": 0.6, fill: "#f8fafc" });
  for (const p of parts) {
    if (p.role === "door" || p.role === "drawerFront" || p.role === "glass")
      rect(g, p.z, Y(p.y), p.sz, -p.sy, p.role === "glass" ? { fill: "#bfdbfe", "stroke-width": 0.8 } : cut);
    else if (p.role === "rod")
      el("circle", { cx: p.z + 1.25, cy: Y(p.y + 1.25), r: 1.25, ...st(0.8, { fill: "#6b7280" }) }, g);
    else if (p.role === "drawerSide" && p.sz < 2) rect(g, p.z, Y(p.y), p.sz, -p.sy, cut);
    else if (p.role === "drawerSide") rect(g, p.z, Y(p.y), p.sz, -p.sy, { "stroke-width": 0.5, fill: "#eef0f3" });
    else if (p.role === "countertop")
      rect(g, p.z, Y(p.y), p.sz, -p.sy, { fill: getMat(c.top.mat).color, "stroke-width": 1 });
    else rect(g, p.z, Y(p.y), p.sz, -p.sy, cut);
  }
}

// ───────── 尺寸線 ─────────
export function dimH(g, x1, x2, y, label, fs, off = 0) {
  const a = { stroke: "#2563eb", "stroke-width": 0.6, "vector-effect": "non-scaling-stroke", fill: "none" };
  el("line", { x1, y1: y, x2, y2: y, ...a }, g);
  for (const x of [x1, x2]) {
    el("line", { x1: x, y1: y - fs * 0.5, x2: x, y2: y + fs * 0.5 + off, ...a }, g);
    el("line", { x1: x - fs * 0.3, y1: y + fs * 0.3, x2: x + fs * 0.3, y2: y - fs * 0.3, ...a, "stroke-width": 1 }, g);
  }
  if (Math.abs(x2 - x1) >= fs * 0.8) text(g, (x1 + x2) / 2, y - fs * 0.3, label, fs, { fill: "#1d4ed8" });
}
export function dimV(g, x, y1, y2, label, fs) {
  const a = { stroke: "#2563eb", "stroke-width": 0.6, "vector-effect": "non-scaling-stroke", fill: "none" };
  el("line", { x1: x, y1, x2: x, y2, ...a }, g);
  for (const y of [y1, y2]) {
    el("line", { x1: x - fs * 0.5, y1: y, x2: x + fs * 0.5, y2: y, ...a }, g);
    el("line", { x1: x - fs * 0.3, y1: y + fs * 0.3, x2: x + fs * 0.3, y2: y - fs * 0.3, ...a, "stroke-width": 1 }, g);
  }
  if (Math.abs(y2 - y1) >= fs * 0.8) {
    const tx = text(g, x - fs * 0.35, (y1 + y2) / 2, label, fs, { fill: "#1d4ed8" });
    tx.setAttribute("transform", `rotate(-90 ${x - fs * 0.35} ${(y1 + y2) / 2})`);
  }
}
export const fmt = v => String(Math.round(v * 10) / 10);
export { cfg };
