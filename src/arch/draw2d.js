// 裝修元件的平面圖例（地坪材質填色、天花高度 CH、間照虛線、包樑、牆面裝修、窗簾）
import { t } from "../core/i18n.js";
import { L, R, TXT, el } from "../core/dom.js";
import { itemElev, itemH, spec } from "../ext/heights.js";
import { getMat, svgPattern } from "../materials/index.js";
import { P } from "./catalog.js";
import { itemMat } from "./helpers.js";

const svgRoot = () => document.getElementById("svg");
const fillOf = (it, key = "mat") => {
  try {
    return svgPattern(svgRoot(), itemMat(it, key), { angle: it.angle || 0 }) || getMat(itemMat(it, key)).color;
  } catch (e) {
    return getMat(itemMat(it, key)).color;
  }
};
const small = (g, x, y, s, size = 9, fill = "#475569") => {
  const tx = TXT(g, x, y, s);
  tx.style.fontSize = size + "px";
  tx.style.fill = fill;
  tx.style.pointerEvents = "none";
  return tx;
};
const area = it => Math.round(((it.w * it.d) / 1e4) * 100) / 100;

function floorDraw(g, w, d, it) {
  el(
    "rect",
    {
      x: 0,
      y: 0,
      width: w,
      height: d,
      fill: fillOf(it),
      opacity: 0.85,
      stroke: "#64748b",
      "stroke-width": 1,
      "stroke-dasharray": "6 3",
    },
    g,
  );
  const raise = itemH(it);
  const name = getMat(itemMat(it)).name;
  if (w > 50 && d > 40) {
    small(g, w / 2, d - 16, name, 9);
    small(g, w / 2, d - 6, `${area(it)} m²${raise >= 5 ? ` ・ +${Math.round(raise)}` : ""}`, 9);
  }
  if (raise >= 5) L(g, 4, 4, Math.min(w, d) * 0.3, 4, "t");
}
function ceilDraw(kind) {
  return (g, w, d, it) => {
    const ch = Math.round(itemElev(it));
    el(
      "rect",
      { x: 0, y: 0, width: w, height: d, fill: fillOf(it), opacity: 0.35, stroke: "#334155", "stroke-width": 1.2 },
      g,
    );
    if (kind === "cove") {
      const c = Math.min(P(it, "cove") || 20, w / 3, d / 3);
      el(
        "rect",
        {
          x: c,
          y: c,
          width: w - 2 * c,
          height: d - 2 * c,
          fill: "none",
          stroke: "#f59e0b",
          "stroke-width": 1.4,
          "stroke-dasharray": "8 4",
        },
        g,
      );
    }
    if (kind === "grille") {
      const gap = Math.max(4, P(it, "gap") || 10);
      for (let x = gap; x < w; x += gap) L(g, x, 0, x, d, "t");
    }
    if (kind === "drop")
      el("rect", { x: 3, y: 3, width: w - 6, height: d - 6, fill: "none", stroke: "#334155", "stroke-width": 0.6 }, g);
    if (w > 40 && d > 24) small(g, w / 2, d / 2 + 14, `CH ${ch}`, 10, "#0f172a");
  };
}
function beamDraw(g, w, d, it) {
  el(
    "rect",
    {
      x: 0,
      y: 0,
      width: w,
      height: d,
      fill: "rgba(148,163,184,.25)",
      stroke: "#334155",
      "stroke-width": 1.2,
      "stroke-dasharray": "10 4",
    },
    g,
  );
  L(g, 0, 0, w, d, "d");
  L(g, 0, d, w, 0, "d");
  const drop = Math.round(spec().ceilH - itemElev(it));
  if (w > 60) small(g, w / 2, d / 2 + 3, t("包樑 H-{n}", { n: drop }), 9, "#0f172a");
}
function curtainBoxDraw(g, w, d) {
  el(
    "rect",
    { x: 0, y: 0, width: w, height: d, fill: "#fff", stroke: "#334155", "stroke-width": 1, "stroke-dasharray": "5 3" },
    g,
  );
  if (w > 60) small(g, w / 2, d / 2 + 3, t("窗簾盒"), 8);
}
function wallFinDraw(style) {
  return (g, w, d, it) => {
    el(
      "rect",
      { x: 0, y: 0, width: w, height: Math.max(d, 2), fill: fillOf(it), stroke: "#1e293b", "stroke-width": 0.8 },
      g,
    );
    const st = style || P(it, "style");
    if (st === "slat") for (let x = 6; x < w; x += 6) L(g, x, 0, x, Math.max(d, 2), "t");
    if (st === "mirror") L(g, 0, Math.max(d, 2) / 2, w, Math.max(d, 2) / 2, "t");
    // 引線標示
    L(g, w / 2, Math.max(d, 2), w / 2, Math.max(d, 2) + 10, "t");
  };
}
function wave(w, y, amp, step = 8) {
  let p = `M0 ${y}`;
  for (let x = 0; x < w; x += step)
    p += ` Q${x + step / 2} ${y + (Math.round(x / step) % 2 ? amp : -amp)} ${Math.min(w, x + step)} ${y}`;
  return p;
}
function curtainDraw(kind) {
  return (g, w, d, it) => {
    el("rect", { x: 0, y: 0, width: w, height: d, fill: "transparent", stroke: "none" }, g);
    L(g, 0, 1, w, 1, "t"); // 軌道
    const open = Math.max(0, Math.min(1, P(it, "open") ?? 0));
    if (kind === "drape" || kind === "double") {
      const half = (w * (1 - open)) / 2 + (w * open) / 4;
      for (const [x0, x1] of [
        [0, half],
        [w - half, w],
      ]) {
        const gw = el("g", { transform: `translate(${x0} 0)` }, g);
        el("path", { d: wave(x1 - x0, d * 0.65, d * 0.25), fill: "none", stroke: fillOf(it), "stroke-width": 2.2 }, gw);
      }
      if (kind === "double")
        el(
          "path",
          {
            d: wave(w, d * 0.3, d * 0.15, 6),
            fill: "none",
            stroke: "#94a3b8",
            "stroke-width": 1,
            "stroke-dasharray": "2 1.5",
          },
          g,
        );
    } else if (kind === "sheer")
      el(
        "path",
        {
          d: wave(w, d * 0.55, d * 0.3, 6),
          fill: "none",
          stroke: "#94a3b8",
          "stroke-width": 1.2,
          "stroke-dasharray": "2 1.5",
        },
        g,
      );
    else if (kind === "roller") {
      el(
        "rect",
        {
          x: 0,
          y: d * 0.3,
          width: w,
          height: d * 0.4,
          rx: d * 0.2,
          fill: fillOf(it),
          stroke: "#334155",
          "stroke-width": 0.8,
        },
        g,
      );
    } else if (kind === "roman") {
      R(g, 0, d * 0.2, w, d * 0.6, "g");
      for (let x = w / 4; x < w; x += w / 4) L(g, x, d * 0.2, x, d * 0.8, "t");
    } else if (kind === "venetian") {
      R(g, 0, d * 0.25, w, d * 0.5, "g");
      for (let x = 4; x < w; x += 4) L(g, x, d * 0.25, x - 2, d * 0.75, "t");
    }
  };
}

export const DRAW2D = {
  floorZone: floorDraw,
  floorRaised: floorDraw,
  threshold(g, w, d, it) {
    el("rect", { x: 0, y: 0, width: w, height: d, fill: fillOf(it), stroke: "#334155", "stroke-width": 1 }, g);
  },
  ceilFlat: ceilDraw("flat"),
  ceilDrop: ceilDraw("drop"),
  ceilCove: ceilDraw("cove"),
  ceilGrille: ceilDraw("grille"),
  ceilBeam: beamDraw,
  curtainBox: curtainBoxDraw,
  wallPanel: wallFinDraw(),
  wallStone: wallFinDraw("stone"),
  wallpaper: wallFinDraw("paper"),
  wainscot: wallFinDraw(),
  mirrorWall: wallFinDraw("mirror"),
  curtainDouble: curtainDraw("double"),
  curtainSheer: curtainDraw("sheer"),
  curtainBlackout: curtainDraw("drape"),
  curtainRoman: curtainDraw("roman"),
  curtainRoller: curtainDraw("roller"),
  blindsVenetian: curtainDraw("venetian"),
};
