// 底圖繪製：格線、牆、門窗、柱、雨遮、固定設備、比例尺
import { t } from "../core/i18n.js";
import { S, opt, view } from "../core/store.js";
import { L, PATH, R, TXT, baseLayer, el, gridLayer, svg } from "../core/dom.js";
import { DRAW } from "../shapes/draw.js";
import { toWorld } from "./view.js";

export function drawGrid() {
  gridLayer.innerHTML = "";
  if (!opt.grid || !S.BASE) return;
  const b = S.BASE.bounds;
  if (view.s >= 2.5) {
    // 放大時加畫 1 cm 細格（只畫可見範圍）
    const r = svg.getBoundingClientRect(),
      p0 = toWorld(r.left, r.top),
      p1 = toWorld(r.right, r.bottom);
    const fine = el("g", { stroke: "#f0f1f3", "stroke-width": 0.25 }, gridLayer);
    for (let x = Math.ceil(Math.max(b.x, p0.x)); x <= Math.min(b.x + b.w, p1.x); x++)
      if (x % 10) el("line", { x1: x, y1: Math.max(b.y, p0.y), x2: x, y2: Math.min(b.y + b.h, p1.y) }, fine);
    for (let y = Math.ceil(Math.max(b.y, p0.y)); y <= Math.min(b.y + b.h, p1.y); y++)
      if (y % 10) el("line", { x1: Math.max(b.x, p0.x), y1: y, x2: Math.min(b.x + b.w, p1.x), y2: y }, fine);
  }
  for (let x = Math.ceil(b.x / 10) * 10; x <= b.x + b.w; x += 10)
    el(
      "line",
      { x1: x, y1: b.y, x2: x, y2: b.y + b.h, class: "gridline" + (x % 100 === 0 ? " major" : "") },
      gridLayer,
    );
  for (let y = Math.ceil(b.y / 10) * 10; y <= b.y + b.h; y += 10)
    el(
      "line",
      { x1: b.x, y1: y, x2: b.x + b.w, y2: y, class: "gridline" + (y % 100 === 0 ? " major" : "") },
      gridLayer,
    );
}
export function computeBounds(B) {
  const xs = [],
    ys = [],
    add = (x, y) => {
      if (isFinite(x) && isFinite(y)) {
        xs.push(x);
        ys.push(y);
      }
    };
  (B.walls || []).forEach(w => {
    add(w[0], w[1]);
    add(w[2], w[3]);
  });
  [...(B.columns || []), ...(B.canopies || [])].forEach(r => {
    add(r[0], r[1]);
    add(r[2], r[3]);
  });
  (B.outOfScope || []).forEach(o => {
    add(o.r[0], o.r[1]);
    add(o.r[2], o.r[3]);
  });
  if (B.image) {
    add(B.image.x, B.image.y);
    add(B.image.x + B.image.w, B.image.y + B.image.h);
  }
  if (!xs.length) return { x: -100, y: -100, w: 1000, h: 800 };
  const x1 = Math.min(...xs) - 70,
    y1 = Math.min(...ys) - 70,
    x2 = Math.max(...xs) + 70,
    y2 = Math.max(...ys) + 110;
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}
export function drawBase() {
  baseLayer.innerHTML = "";
  if (!S.BASE) return;
  const B = S.BASE,
    bb = B.bounds;
  if (B.image)
    el(
      "image",
      {
        href: B.image.src,
        x: B.image.x,
        y: B.image.y,
        width: B.image.w,
        height: B.image.h,
        opacity: B.image.opacity ?? 0.6,
        preserveAspectRatio: "none",
      },
      baseLayer,
    );
  (B.canopies || []).forEach(([x1, y1, x2, y2]) => R(baseLayer, x1, y1, x2 - x1, y2 - y1, "hatch"));
  if (B.canopies && B.canopies.length && B.canopyLabel) {
    const c = B.canopies[0];
    TXT(baseLayer, (c[0] + c[2]) / 2, (c[1] + c[3]) / 2, B.canopyLabel, "roomsub");
  }
  (B.outOfScope || []).forEach(o => {
    const [x1, y1, x2, y2] = o.r;
    R(baseLayer, x1, y1, x2 - x1, y2 - y1, "oos");
    TXT(baseLayer, (x1 + x2) / 2, (y1 + y2) / 2 - 6, o.name || "", "roomlabel");
    TXT(baseLayer, (x1 + x2) / 2, (y1 + y2) / 2 + 16, t("不在設計範圍"), "roomsub");
  });
  if (B.decor) {
    const dg = el("g", { opacity: 0.45 }, baseLayer);
    B.decor.forEach(d =>
      d.t === "ellipse"
        ? el("ellipse", { cx: d.cx, cy: d.cy, rx: d.rx, ry: d.ry, class: "base-fix" }, dg)
        : R(dg, d.x, d.y, d.w, d.h, "base-fix", d.rx || 0),
    );
  }
  (B.rooms || []).forEach(r => {
    TXT(baseLayer, r.x, r.y, r.n, "roomlabel");
    if (r.s) TXT(baseLayer, r.x, r.y + 20, r.s, "roomsub");
  });
  for (const [x1, y1, x2, y2, th, ops = []] of B.walls || []) {
    const hz = Math.abs(y1 - y2) < Math.abs(x1 - x2),
      h = th / 2;
    if (hz ? Math.abs(y1 - y2) > 0.01 : Math.abs(x1 - x2) > 0.01) {
      // 斜牆：直接畫粗線
      el("line", { x1, y1, x2, y2, stroke: "#262626", "stroke-width": th }, baseLayer);
      continue;
    }
    const a0 = Math.min(hz ? x1 : y1, hz ? x2 : y2) - h,
      a1 = Math.max(hz ? x1 : y1, hz ? x2 : y2) + h;
    const seg = (a, b, cls) =>
      b > a && (hz ? R(baseLayer, a, y1 - h, b - a, th, cls) : R(baseLayer, x1 - h, a, th, b - a, cls));
    let cur = a0;
    for (const [a, b, k, o] of ops.slice().sort((p, q) => p[0] - q[0])) {
      seg(cur, a, "wall");
      if (k === "win") {
        seg(a, b, "win");
        if (hz) L(baseLayer, a, y1, b, y1, "winline");
        else L(baseLayer, x1, a, x1, b, "winline");
      }
      if (k === "door" && o) {
        // 門：鉸鏈端與開向
        const len = b - a,
          hA = o.hinge === "b" ? b : a,
          oA = o.hinge === "b" ? a : b,
          sd = o.side || 1;
        const H = hz ? [hA, y1] : [x1, hA],
          O = hz ? [hA, y1 + sd * len] : [x1 + sd * len, hA],
          Cc = hz ? [oA, y1] : [x1, oA];
        L(baseLayer, H[0], H[1], O[0], O[1], "door-leaf");
        const sweep = (O[0] - H[0]) * (Cc[1] - H[1]) - (O[1] - H[1]) * (Cc[0] - H[0]) > 0 ? 1 : 0;
        PATH(baseLayer, `M${O[0]} ${O[1]} A ${len} ${len} 0 0 ${sweep} ${Cc[0]} ${Cc[1]}`, "door-arc");
      }
      cur = b;
    }
    seg(cur, a1, "wall");
  }
  (B.columns || []).forEach(([x1, y1, x2, y2]) => R(baseLayer, x1, y1, x2 - x1, y2 - y1, "wall"));
  for (const d of B.doors || []) {
    const [hx, hy] = d.h,
      [ox, oy] = d.o,
      [cx, cy] = d.c,
      r = Math.hypot(ox - hx, oy - hy);
    L(baseLayer, hx, hy, ox, oy, "door-leaf");
    const sweep = (ox - hx) * (cy - hy) - (oy - hy) * (cx - hx) > 0 ? 1 : 0;
    PATH(baseLayer, `M${ox} ${oy} A ${r} ${r} 0 0 ${sweep} ${cx} ${cy}`, "door-arc");
  }
  for (const f of B.fixtures || []) {
    // 固定設備（例如既有流理台），鎖定不可移動
    if (!DRAW[f.type]) continue;
    const g = el(
      "g",
      {
        class: "item locked",
        style: "pointer-events:none",
        transform:
          `translate(${f.x} ${f.y}) rotate(${f.rot || 0} ${f.w / 2} ${f.d / 2})` +
          (f.flip ? ` translate(${f.w} 0) scale(-1 1)` : ""),
      },
      baseLayer,
    );
    DRAW[f.type](g, f.w, f.d, f);
    if (f.label) {
      const tg = el(
        "g",
        {
          transform:
            (f.flip ? `translate(${f.w} 0) scale(-1 1) ` : "") + `rotate(${-(f.rot || 0)} ${f.w / 2} ${f.d / 2})`,
        },
        g,
      );
      const t = TXT(tg, f.w / 2, f.d / 2, f.label);
      t.style.fontSize = "11px";
      t.style.fill = "#6b7280";
    }
  }
  // 比例尺 0–3 m（與家具同一比例，會跟著縮放與匯出）
  const sb = el("g", {}, baseLayer),
    sx = bb.x + 50,
    sy = bb.y + bb.h - 45;
  for (let i = 0; i < 6; i++)
    el(
      "rect",
      { x: sx + i * 50, y: sy, width: 50, height: 8, fill: i % 2 ? "#fff" : "#222", stroke: "#222", "stroke-width": 1 },
      sb,
    );
  for (let i = 0; i <= 3; i++) {
    const t = TXT(sb, sx + i * 100, sy + 24, i + " m", "roomsub");
    t.style.fill = "#222";
  }
  const st = TXT(sb, sx + 150, sy - 10, t("比例尺（家具與牆面同一比例，單位 cm）"), "roomsub");
  st.style.fill = "#444";
  if (opt.dims) drawDims();
}
export function dimLine(x1, y1, x2, y2, label, off) {
  const g = el("g", {}, baseLayer),
    hz = Math.abs(y1 - y2) < Math.abs(x1 - x2);
  L(g, x1, y1, x2, y2, "dim");
  for (const [x, y] of [
    [x1, y1],
    [x2, y2],
  ])
    L(g, x - 4, y + 4, x + 4, y - 4, "dim");
  const mx = (x1 + x2) / 2 + (hz ? 0 : -6),
    my = (y1 + y2) / 2 + (hz ? -6 : 0);
  const t = TXT(g, mx, my, label, "dimtext");
  if (!hz) t.setAttribute("transform", `rotate(-90 ${mx} ${my})`);
}
export function drawDims() {
  (S.BASE.dims || []).forEach(([x1, y1, x2, y2]) => dimLine(x1, y1, x2, y2, Math.round(Math.hypot(x2 - x1, y2 - y1))));
}
