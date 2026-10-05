// 水電空調平面圖例（參考 CNS／台灣水電配置圖常用符號）
import { C, L, PATH, R, el } from "../core/dom.js";
import { DUCT_CODE, DUCT_COLOR, circuitColor, ptsOf, val } from "./util.js";

const TX = (g, x, y, s, size = 7, fill = "#111") => {
  const t = el("text", { x, y, class: "mep-tx" }, g);
  t.textContent = s;
  t.style.fontSize = size + "px";
  t.style.fill = fill;
  return t;
};
const line = (g, x1, y1, x2, y2, stroke, w = 1, dash) =>
  el("line", { x1, y1, x2, y2, stroke, "stroke-width": w, ...(dash ? { "stroke-dasharray": dash } : {}) }, g);

/** 迴路編號小標 */
function tag(g, it, x, y) {
  if (it.circuit) TX(g, x, y, it.circuit, 6, circuitColor(it.circuit));
}

function lampCircle(g, w, d) {
  const r = Math.min(w, d) / 2;
  C(g, w / 2, d / 2, r, "s");
  return r;
}
const cross = (g, cx, cy, r) => {
  L(g, cx - r, cy, cx + r, cy);
  L(g, cx, cy - r, cx, cy + r);
};
const xMark = (g, cx, cy, r) => {
  const k = r * 0.7071;
  L(g, cx - k, cy - k, cx + k, cy + k);
  L(g, cx - k, cy + k, cx + k, cy - k);
};

function switchSym(code) {
  return (g, w, d, it) => {
    R(g, 0, 0, w, d, "s", 2);
    el("circle", { cx: 4, cy: d / 2, r: 2.2, class: "f" }, g);
    L(g, 4, d / 2, w * 0.55, 1.5);
    TX(g, w * 0.68, d / 2 + 0.5, code, 6);
    tag(g, it, w / 2, d + 5);
  };
}
function outletSym(code, opts = {}) {
  return (g, w, d, it) => {
    const r = Math.min(d * 0.45, w * 0.3),
      cx = w / 2,
      cy = d / 2;
    L(g, 0, 0.5, w, 0.5); // 牆面側
    C(g, cx, cy, r, "s");
    if (opts.half) PATH(g, `M${cx - r} ${cy} A ${r} ${r} 0 0 0 ${cx + r} ${cy} Z`, "f");
    else if (!opts.single) {
      L(g, cx - r * 0.35, cy - r * 0.55, cx - r * 0.35, cy + r * 0.55);
      L(g, cx + r * 0.35, cy - r * 0.55, cx + r * 0.35, cy + r * 0.55);
    }
    if (code) TX(g, cx + r + 4.5, cy + 0.5, code, 5.5);
    tag(g, it, cx, d + 4);
  };
}
function dataSym(code) {
  return (g, w, d, it) => {
    L(g, 0, 0.5, w, 0.5);
    PATH(g, `M${w / 2 - 6} ${d - 1} L${w / 2 + 6} ${d - 1} L${w / 2} 1.5 Z`, "s");
    TX(g, w / 2, d * 0.62, code, 4.5);
    tag(g, it, w / 2, d + 4);
  };
}
function hatchRect(g, w, d, step = 5) {
  R(g, 0, 0, w, d, "s");
  for (let k = step; k < w + d; k += step) {
    const x1 = Math.max(0, k - d),
      y1 = Math.min(d, k),
      x2 = Math.min(w, k),
      y2 = Math.max(0, k - w);
    L(g, x1, y1, x2, y2);
  }
}

function duct(g, w, d, it) {
  const pts = ptsOf(it),
    dia = val(it, "dia") || 10,
    col = DUCT_COLOR[it.type] || "#2563eb",
    p = pts.map(q => q.join(" ")).join(" L");
  el(
    "path",
    { d: "M" + p, fill: "none", stroke: col, "stroke-width": dia, "stroke-linejoin": "round", class: "mep-hit" },
    g,
  );
  el(
    "path",
    {
      d: "M" + p,
      fill: "none",
      stroke: "#fff",
      "stroke-width": Math.max(dia - 1.6, 0.5),
      "stroke-linejoin": "round",
      "pointer-events": "none",
    },
    g,
  );
  el(
    "path",
    { d: "M" + p, fill: "none", stroke: col, "stroke-width": 0.5, "stroke-dasharray": "6 3", "pointer-events": "none" },
    g,
  );
  // 氣流方向箭頭
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i - 1],
      [x2, y2] = pts[i],
      len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 25) continue;
    const ux = (x2 - x1) / len,
      uy = (y2 - y1) / len,
      mx = (x1 + x2) / 2,
      my = (y1 + y2) / 2,
      a = Math.min(dia * 0.35, 5);
    el(
      "path",
      {
        d: `M${mx + ux * a} ${my + uy * a} L${mx - ux * a - uy * a} ${my - uy * a + ux * a} L${mx - ux * a + uy * a} ${my - uy * a - ux * a} Z`,
        fill: col,
        "pointer-events": "none",
      },
      g,
    );
  }
  // 標示：SA Ø10
  let best = 1,
    bl = 0;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (l > bl) [best, bl] = [i, l];
  }
  const [x1, y1] = pts[best - 1],
    [x2, y2] = pts[best];
  const horiz = Math.abs(x2 - x1) >= Math.abs(y2 - y1);
  TX(
    g,
    x1 + (x2 - x1) * 0.3 + (horiz ? 0 : dia / 2 + 10),
    y1 + (y2 - y1) * 0.3 + (horiz ? -dia / 2 - 5 : 0),
    `${DUCT_CODE[it.type] || ""} Ø${Math.round(dia * 10)}`,
    7,
    col,
  );
}

function wire(g, w, d, it) {
  const pts = ptsOf(it),
    kind = val(it, "kind") || "light",
    col = it.type === "conduit" ? "#6b7280" : circuitColor(it.circuit);
  let p = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i - 1],
      [x2, y2] = pts[i];
    if (it.type === "conduit" || it.straight) p += ` L${x2} ${y2}`;
    else {
      // 配線以弧線表示（開關到燈具的慣用畫法）
      const k = 0.18;
      p += ` Q${(x1 + x2) / 2 - (y2 - y1) * k} ${(y1 + y2) / 2 + (x2 - x1) * k} ${x2} ${y2}`;
    }
  }
  el("path", { d: p, fill: "none", stroke: "transparent", "stroke-width": 8, class: "mep-hit" }, g);
  el(
    "path",
    {
      d: p,
      fill: "none",
      stroke: col,
      "stroke-width": it.type === "conduit" ? 1.2 : 1,
      "stroke-dasharray": it.type === "conduit" ? "8 3 2 3" : kind === "data" ? "4 2" : kind === "power" ? "10 2" : "",
      "pointer-events": "none",
    },
    g,
  );
  if (it.circuit) {
    const m = Math.floor(pts.length / 2),
      [ax, ay] = pts[m - 1] || pts[0],
      [bx, by] = pts[m];
    TX(g, (ax + bx) / 2, (ay + by) / 2 - 4, it.circuit, 6.5, col);
  }
}

export const DRAW2D = {
  downlight(g, w, d, it) {
    const r = lampCircle(g, w, d);
    cross(g, w / 2, d / 2, r);
    tag(g, it, w / 2, d + 5);
  },
  spot(g, w, d, it) {
    const r = lampCircle(g, w, d);
    PATH(
      g,
      `M${w / 2} ${d / 2 - r * 0.6} L${w / 2 + r * 0.55} ${d / 2 + r * 0.45} L${w / 2 - r * 0.55} ${d / 2 + r * 0.45} Z`,
      "f",
    );
    tag(g, it, w / 2, d + 5);
  },
  ceilingLight(g, w, d, it) {
    const r = lampCircle(g, w, d);
    C(g, w / 2, d / 2, r * 0.62, "t");
    xMark(g, w / 2, d / 2, r);
    tag(g, it, w / 2, d + 5);
  },
  pendant(g, w, d, it) {
    const r = lampCircle(g, w, d);
    xMark(g, w / 2, d / 2, r);
    el("circle", { cx: w / 2, cy: d / 2, r: Math.max(1.5, r * 0.15), class: "f" }, g);
    tag(g, it, w / 2, d + 5);
  },
  trackLight(g, w, d, it) {
    R(g, 0, d / 2 - 1.5, w, 3, "f");
    const n = val(it, "heads") || Math.max(2, Math.round(w / 40));
    for (let i = 0; i < n; i++) C(g, ((i + 0.5) * w) / n, d / 2, Math.min(4, w / n / 2.5), "s");
    tag(g, it, w / 2, d + 6);
  },
  lineLight(g, w, d, it) {
    el("rect", { x: 0, y: 0, width: w, height: d, fill: "#fef3c7", stroke: "#111", "stroke-width": 0.8 }, g);
    L(g, 0, d / 2, w, d / 2);
    tag(g, it, w / 2, d + 6);
  },
  coveStrip(g, w, d, it) {
    line(g, 0, d / 2, w, d / 2, "#ca8a04", Math.max(1.5, d * 0.6), "6 3");
    tag(g, it, w / 2, d + 6);
  },
  wallLight(g, w, d, it) {
    L(g, 0, 0.5, w, 0.5);
    PATH(g, `M0 0.5 A ${w / 2} ${d} 0 0 0 ${w} 0.5`, "s");
    xMark(g, w / 2, d * 0.4, Math.min(w, d) * 0.3);
    tag(g, it, w / 2, d + 5);
  },
  fanLight(g, w, d, it) {
    const r = Math.min(w, d) / 2;
    C(g, w / 2, d / 2, r, "d");
    for (let k = 0; k < 3; k++) {
      const a = (k * 2 * Math.PI) / 3;
      el(
        "ellipse",
        {
          cx: w / 2 + Math.cos(a) * r * 0.5,
          cy: d / 2 + Math.sin(a) * r * 0.5,
          rx: r * 0.45,
          ry: r * 0.12,
          transform: `rotate(${(a * 180) / Math.PI} ${w / 2 + Math.cos(a) * r * 0.5} ${d / 2 + Math.sin(a) * r * 0.5})`,
          class: "s",
        },
        g,
      );
    }
    C(g, w / 2, d / 2, r * 0.14, "s");
    xMark(g, w / 2, d / 2, r * 0.14);
    tag(g, it, w / 2, d + 6);
  },
  bathFan(g, w, d, it) {
    R(g, 0, 0, w, d, "s");
    C(g, w / 2, d / 2, Math.min(w, d) * 0.36, "t");
    TX(g, w / 2, d / 2 + 0.5, "EF", Math.min(w, d) * 0.28);
    tag(g, it, w / 2, d + 5);
  },
  sensorLight(g, w, d, it) {
    const r = lampCircle(g, w, d);
    cross(g, w / 2, d / 2, r);
    PATH(g, `M${w / 2 + r + 1} ${d / 2 - r * 0.6} A ${r} ${r} 0 0 1 ${w / 2 + r + 1} ${d / 2 + r * 0.6}`, "t");
    tag(g, it, w / 2, d + 5);
  },
  smoke(g, w, d) {
    lampCircle(g, w, d);
    TX(g, w / 2, d / 2 + 0.5, "SD", Math.min(w, d) * 0.36);
  },
  sw1: switchSym("S"),
  sw2: switchSym("S2"),
  sw3: switchSym("S3"),
  sw4: switchSym("S4"),
  sw3way: switchSym("S3W"),
  dimmer: switchSym("D"),
  smartSw: switchSym("SS"),
  outlet2: outletSym(""),
  outlet220: outletSym("220", { half: true }),
  outletGFCI: outletSym("WP"),
  outletUSB: outletSym("U"),
  outletFloor(g, w, d, it) {
    R(g, 0, 0, w, d, "s");
    C(g, w / 2, d / 2, Math.min(w, d) * 0.3, "t");
    L(g, w / 2 - 1.5, d / 2 - 2, w / 2 - 1.5, d / 2 + 2);
    L(g, w / 2 + 1.5, d / 2 - 2, w / 2 + 1.5, d / 2 + 2);
    tag(g, it, w / 2, d + 4);
  },
  outletHigh: outletSym("H"),
  ACoutlet: outletSym("AC", { half: true }),
  dataRJ45: dataSym("D"),
  tvOut: dataSym("TV"),
  phone: dataSym("T"),
  panel(g, w, d, it) {
    hatchRect(g, w, d, 4);
    TX(g, w / 2, d + 6, "P", 7);
    tag(g, it, w / 2 + 8, d + 6);
  },
  weakBox(g, w, d) {
    R(g, 0, 0, w, d, "s");
    xMark(g, w / 2, d / 2, Math.min(w, d) * 0.6);
    TX(g, w / 2, d + 6, "LV", 7);
  },
  doorbell(g, w, d) {
    C(g, w / 2, d / 2, Math.min(w, d) * 0.45, "s");
    TX(g, w / 2, d / 2 + 0.5, "B", Math.min(w, d) * 0.5);
  },
  intercom(g, w, d) {
    R(g, 0, 0, w, d, "s");
    TX(g, w / 2, d / 2 + 0.5, "IC", Math.min(w * 0.38, d * 0.8));
  },
  ervUnit(g, w, d, it) {
    R(g, 0, 0, w, d, "s");
    const m = Math.min(w, d) * 0.28;
    PATH(g, `M${w / 2} ${d / 2 - m} L${w / 2 + m} ${d / 2} L${w / 2} ${d / 2 + m} L${w / 2 - m} ${d / 2} Z`, "t");
    xMark(g, w / 2, d / 2, m * 0.7);
    const f = Math.min(8, d * 0.14);
    TX(g, 9, d * 0.27, "OA", f, DUCT_COLOR.ductFresh);
    TX(g, 9, d * 0.73, "EA", f, DUCT_COLOR.ductExhaust);
    TX(g, w - 9, d * 0.27, "SA", f, DUCT_COLOR.ductSupply);
    TX(g, w - 9, d * 0.73, "RA", f, DUCT_COLOR.ductReturn);
    TX(g, w / 2, d - f, "ERV", f);
  },
  ductSupply: duct,
  ductReturn: duct,
  ductFresh: duct,
  ductExhaust: duct,
  acDuct: duct,
  diffuser(g, w, d, it) {
    const st = val(it, "style") || "round";
    R(g, 0, 0, w, d, "s");
    if (st === "linear") for (let y = d * 0.25; y < d; y += d * 0.25) L(g, 2, y, w - 2, y);
    else if (st === "square") {
      R(g, w * 0.2, d * 0.2, w * 0.6, d * 0.6, "t");
      L(g, 0, 0, w, d);
      L(g, w, 0, 0, d);
    } else {
      C(g, w / 2, d / 2, Math.min(w, d) * 0.38, "t");
      C(g, w / 2, d / 2, Math.min(w, d) * 0.22, "t");
    }
    TX(g, w / 2, d + 6, "S", 6, DUCT_COLOR.ductSupply);
  },
  grille(g, w, d) {
    R(g, 0, 0, w, d, "s");
    for (let x = 4; x < w; x += 4) L(g, x, 1, x, d - 1);
    TX(g, w / 2, d + 6, "R", 6, DUCT_COLOR.ductReturn);
  },
  wallCap(g, w, d) {
    L(g, 0, 0.5, w, 0.5);
    PATH(g, `M0 0.5 L${w * 0.2} ${d} L${w * 0.8} ${d} L${w} 0.5`, "s");
  },
  acIndoor(g, w, d) {
    R(g, 0, 0, w, d, "s");
    for (let y = d * 0.62; y < d - 2; y += 3) L(g, 4, y, w - 4, y);
    TX(g, w / 2, d * 0.35, "AC", Math.min(10, d * 0.3));
  },
  wire,
  conduit: wire,
};
