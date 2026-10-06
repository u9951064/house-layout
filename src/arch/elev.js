// 裝修元件與門的立面正視圖（局部座標：x∈[0,w] 觀看者左→右，y = −高度，地面 y=0）
import { t } from "../core/i18n.js";
import { el } from "../core/dom.js";
import { itemElev, itemH, spec } from "../ext/heights.js";
import { getMat, svgPattern } from "../materials/index.js";
import { P } from "./catalog.js";
import { itemMat } from "./helpers.js";

const fill = (it, ctx, key = "mat") => {
  const id = key === "leafMat" ? it.leafMat || itemMat(it, "leafMat") : itemMat(it, key);
  try {
    return svgPattern((ctx && ctx.svgRoot) || document.getElementById("svg"), id) || getMat(id).color;
  } catch (e) {
    return getMat(id).color;
  }
};
const rect = (g, x, y, w, h, f, extra = {}) =>
  el(
    "rect",
    {
      x,
      y,
      width: Math.max(w, 0.1),
      height: Math.max(h, 0.1),
      fill: f,
      stroke: "#1f2937",
      "stroke-width": 0.8,
      ...extra,
    },
    g,
  );
const line = (g, x1, y1, x2, y2, extra = {}) =>
  el("line", { x1, y1, x2, y2, stroke: "#1f2937", "stroke-width": 0.6, ...extra }, g);
const note = (g, x, y, s) => {
  const tx = el("text", { x, y, "text-anchor": "middle", "font-size": 9, fill: "#334155" }, g);
  tx.textContent = s;
};

function band(g, it, ctx) {
  const y = itemElev(it),
    h = Math.max(1, itemH(it));
  rect(g, 0, -(y + h), it.w, h, fill(it, ctx));
}
function ceil(g, it, ctx) {
  const y = itemElev(it),
    top = it.type === "ceilBeam" ? spec().slabH : spec().ceilH;
  rect(g, 0, -Math.max(top, y + 2), it.w, Math.max(2, top - y), fill(it, ctx), {
    "stroke-dasharray": it.type === "ceilBeam" ? "6 3" : "",
  });
  if (it.type === "ceilCove")
    line(g, 0, -y + 1, it.w, -y + 1, { stroke: "#f59e0b", "stroke-width": 1.2, "stroke-dasharray": "6 3" });
  note(g, it.w / 2, -y + 11, `CH ${Math.round(y)}`);
}
function wallFin(g, it, ctx) {
  const y = itemElev(it),
    h = itemH(it),
    st = P(it, "style");
  rect(g, 0, -(y + h), it.w, h, fill(it, ctx));
  if (st === "slat") for (let x = 6; x < it.w; x += 6) line(g, x, -(y + h), x, -y, { "stroke-width": 0.3 });
  if (st === "panel") {
    const n = Math.max(1, Math.round(it.w / 60)),
      pw = it.w / n;
    for (let i = 0; i < n; i++) rect(g, i * pw + 6, -(y + h) + 6, pw - 12, h - 12, "none", { "stroke-width": 0.4 });
  }
  if (st === "groove") for (let x = 60; x < it.w; x += 60) line(g, x, -(y + h), x, -y, { "stroke-width": 0.6 });
  if (it.type === "mirrorWall") line(g, it.w * 0.2, -(y + h * 0.3), it.w * 0.4, -(y + h * 0.6), { stroke: "#94a3b8" });
}
function curtain(g, it, ctx) {
  const y = itemElev(it),
    h = itemH(it),
    open = Math.max(0, Math.min(1, P(it, "open") ?? 0)),
    w = it.w;
  line(g, 0, -(y + h), w, -(y + h), { "stroke-width": 1.4 });
  const folds = (x0, x1, top, hh) => {
    rect(g, x0, top, x1 - x0, hh, fill(it, ctx), { opacity: 0.85 });
    for (let x = x0 + 8; x < x1; x += 8) line(g, x, top, x, top + hh, { "stroke-width": 0.3 });
  };
  if (["curtainDouble", "curtainBlackout"].includes(it.type)) {
    if (it.type === "curtainDouble") rect(g, 0, -(y + h), w, h, fill(it, ctx, "mat2"), { opacity: 0.35 });
    const half = (w * (1 - open)) / 2 + (w * open) / 6;
    folds(0, half, -(y + h), h);
    folds(w - half, w, -(y + h), h);
  } else if (it.type === "curtainSheer") rect(g, 0, -(y + h), w, h, fill(it, ctx), { opacity: 0.4 });
  else {
    const down = h * (1 - open);
    rect(g, 0, -(y + h), w, down, fill(it, ctx));
    if (it.type === "blindsVenetian")
      for (let yy = 4; yy < down; yy += 4) line(g, 0, -(y + h) + yy, w, -(y + h) + yy, { "stroke-width": 0.3 });
    if (it.type === "curtainRoman")
      for (let yy = 25; yy < down; yy += 25) line(g, 0, -(y + h) + yy, w, -(y + h) + yy, { "stroke-width": 0.5 });
  }
}
function door(g, it, ctx) {
  const y = itemElev(it),
    h = itemH(it),
    w = it.w,
    st = P(it, "leafStyle") || "flat",
    leaves = it.type === "doubleDoor" ? 2 : ["slideDoor"].includes(it.type) ? 2 : it.type === "foldDoor" ? 4 : 1;
  rect(g, -4, -(y + h + 4), w + 8, h + 4, "#e5e7eb");
  const lw = w / leaves;
  for (let i = 0; i < leaves; i++) {
    const x = i * lw;
    rect(g, x + 0.5, -(y + h), lw - 1, h, fill(it, ctx, "leafMat"));
    if (st === "panel")
      for (const [a, b] of [
        [0.08, 0.38],
        [0.54, 0.38],
      ])
        rect(g, x + lw * 0.15, -(y + h) + h * (1 - a - b), lw * 0.7, h * b, "none", { "stroke-width": 0.5 });
    if (st === "glass") rect(g, x + 8, -(y + h) + 8, lw - 16, h - 26, "#dbeafe", { opacity: 0.8 });
    if (st === "groove")
      for (let k = 1; k < 5; k++)
        line(g, x + 2, -(y + h) + (h * k) / 5, x + lw - 2, -(y + h) + (h * k) / 5, { "stroke-width": 0.4 });
    if (st === "accordion")
      for (let xx = x + 3; xx < x + lw - 2; xx += 5) line(g, xx, -(y + h) + 2, xx, -y - 2, { "stroke-width": 0.35 });
    if (st === "louver")
      for (let yy = 14; yy < h - 12; yy += 5) line(g, x + 8, -(y + yy), x + lw - 8, -(y + yy), { "stroke-width": 0.3 });
    if ((P(it, "handle") || "lever") !== "none") {
      const hx = leaves === 1 ? x + lw - 8 : i % 2 ? x + 6 : x + lw - 6;
      el("circle", { cx: hx, cy: -(y + h * 0.47), r: 2, fill: "#6b7280" }, g);
    }
  }
  note(g, w / 2, -(y + h) - 7, `${t("門")} ${Math.round(w)}×${Math.round(h)}`);
}

export const ELEV2D = {
  floorZone: band,
  floorRaised: band,
  threshold: band,
  ceilFlat: ceil,
  ceilDrop: ceil,
  ceilCove: ceil,
  ceilBeam: ceil,
  curtainBox: ceil,
  ceilGrille: ceil,
  wallPanel: wallFin,
  wallStone: wallFin,
  wallpaper: wallFin,
  wainscot: wallFin,
  mirrorWall: wallFin,
  curtainDouble: curtain,
  curtainSheer: curtain,
  curtainBlackout: curtain,
  curtainRoman: curtain,
  curtainRoller: curtain,
  blindsVenetian: curtain,
  swingDoor: door,
  doubleDoor: door,
  slideDoor: door,
  pocketDoor: door,
  foldDoor: door,
  slideDoorArc: door,
  curveSlide: door,
};
