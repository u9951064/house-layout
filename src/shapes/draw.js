// 各元件的平面圖例繪製（建商平面圖風格）
import { C, L, PATH, R, TXT, el } from "../core/dom.js";

export const DRAW = {
  bed2(g, w, d, it) { bedCommon(g, w, d, 2); },
  bed1(g, w, d, it) { bedCommon(g, w, d, 1); },
  nightstand(g, w, d) { R(g, 0, 0, w, d); C(g, w / 2, d / 2, Math.min(w, d) * 0.22, "t"); L(g, w / 2 - Math.min(w, d) * 0.3, d / 2, w / 2 + Math.min(w, d) * 0.3, d / 2); L(g, w / 2, d / 2 - Math.min(w, d) * 0.3, w / 2, d / 2 + Math.min(w, d) * 0.3); },
  wardrobe(g, w, d) {
    R(g, 0, 0, w, d); const rod = d * 0.45; L(g, 6, rod, w - 6, rod, "d");
    for (let x = 14; x < w - 8; x += 11) L(g, x - 4, rod - d * 0.28, x + 4, rod + d * 0.28, "t");
    const n = Math.max(1, Math.round(w / 50)); for (let i = 1; i < n; i++) L(g, i * w / n, d - 4, i * w / n, d, "t");
    for (let i = 0; i < n; i++) { const x = i * w / n; PATH(g, `M${x + 2} ${d} A ${w / n - 4} ${w / n - 4} 0 0 1 ${x + w / n - 2} ${d + Math.min(w / n - 4, 40)}`, "d"); }
  },
  wardrobeSlide(g, w, d) {
    R(g, 0, 0, w, d); const rod = d * 0.42; L(g, 6, rod, w - 6, rod, "d");
    for (let x = 14; x < w - 8; x += 11) L(g, x - 4, rod - d * 0.26, x + 4, rod + d * 0.26, "t");
    const n = Math.max(2, Math.round(w / 90)); const pw = w / n;
    for (let i = 0; i < n; i++) { const y = i % 2 ? d - 9 : d - 4; R(g, i * pw - (i ? 4 : 0), y - 2.5, pw + (i && i < n - 1 ? 8 : 4), 4, "g"); }
  },
  vanity(g, w, d) {
    R(g, 0, 0, w, d); L(g, 8, 4, w - 8, 4, "t"); el("rect", { x: 8, y: 1.5, width: w - 16, height: 3, class: "f" }, g);
    const r = Math.min(18, w * 0.2); C(g, w / 2, d + r + 6, r, "s"); C(g, w / 2, d + r + 6, r * 0.6, "t");
  },
  sofa(g, w, d, it) {
    R(g, 0, 0, w, d, "s", 6); const arm = Math.min(16, w * 0.1), back = Math.min(20, d * 0.24);
    R(g, arm, 0, w - 2 * arm, back, "t", 4); R(g, 0, 0, arm, d, "t", 6); R(g, w - arm, 0, arm, d, "t", 6);
    const n = it.seats || Math.max(1, Math.round((w - 2 * arm) / 65)); const cw = (w - 2 * arm) / n;
    for (let i = 0; i < n; i++) R(g, arm + i * cw + 1.5, back + 1.5, cw - 3, d - back - 4, "t", 4);
  },
  sofaL(g, w, d) {
    const dep = Math.min(90, w * 0.4, d * 0.6), arm = 14;
    PATH(g, `M0 0 H${w} V${dep} H${dep} V${d} H0 Z`, "s");
    L(g, arm, 18, w - arm, 18); L(g, 18, 18, 18, d - arm);
    R(g, w - arm, 0, arm, dep, "t", 4); R(g, 0, d - arm, dep, arm, "t", 4);
    const n = Math.max(1, Math.round((w - dep - arm) / 65)); const cw = (w - dep - arm) / n;
    for (let i = 0; i < n; i++) R(g, dep + i * cw + 1.5, 20, cw - 3, dep - 23, "t", 4);
    R(g, 20, 20, dep - 22, dep - 22, "t", 4);
    const m = Math.max(1, Math.round((d - dep - arm) / 65)); const ch = (d - dep - arm) / m;
    for (let i = 0; i < m; i++) R(g, 20, dep + i * ch + 1.5, dep - 22, ch - 3, "t", 4);
  },
  armchair(g, w, d) { R(g, 0, 0, w, d, "s", 8); R(g, 10, 0, w - 20, d * 0.24, "t", 4); R(g, 0, 0, 10, d, "t", 5); R(g, w - 10, 0, 10, d, "t", 5); R(g, 12, d * 0.27, w - 24, d * 0.68, "t", 5); },
  coffee(g, w, d) { R(g, 0, 0, w, d, "s", 4); R(g, 5, 5, w - 10, d - 10, "t", 3); },
  tv(g, w, d) { R(g, 0, 0, w, d); const tw = Math.min(w - 10, 125); R(g, (w - tw) / 2, 3, tw, 4, "f"); },
  rug(g, w, d) { R(g, 0, 0, w, d, "d"); R(g, 8, 8, w - 16, d - 16, "t"); },
  plant(g, w, d) {
    const cx = w / 2, cy = d / 2, r = Math.min(w, d) / 2; let p = "";
    for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, rr = i % 2 ? r * 0.6 : r; p += (i ? "L" : "M") + (cx + rr * Math.cos(a)).toFixed(1) + " " + (cy + rr * Math.sin(a)).toFixed(1); }
    PATH(g, p + "Z", "s"); for (let i = 0; i < 16; i += 2) L(g, cx, cy, cx + r * 0.85 * Math.cos(i * Math.PI / 8), cy + r * 0.85 * Math.sin(i * Math.PI / 8));
  },
  fridge(g, w, d) { R(g, 0, 0, w, d); L(g, 3, d - 6, w - 3, d - 6); L(g, w / 2, d - 6, w / 2, d); TXT(g, w / 2, d * 0.45, "REF"); },
  appliance(g, w, d) { R(g, 0, 0, w, d); L(g, 0, 0, w, d); L(g, w, 0, 0, d); },
  counter(g, w, d) {
    R(g, 0, 0, w, d); L(g, 0, d - 3, w, d - 3);
    const sw = Math.min(70, w * 0.35); R(g, w * 0.62, 8, sw, d - 18, "t", 6); C(g, w * 0.62 + sw / 2, d / 2 - 2, 2.5, "t");
    const bx = w * 0.12; R(g, bx, 6, 58, d - 14, "t", 4); C(g, bx + 15, d / 2 - 1, 9, "t"); C(g, bx + 43, d / 2 - 1, 9, "t");
  },
  dining(g, w, d, it) {
    const n = it.chairs ?? 4, cw = 42, cd = 40; const per = Math.ceil(n / 2);
    for (let i = 0; i < n; i++) {
      const top = i < per, k = top ? i : i - per, cnt = top ? per : n - per;
      const x = (k + 0.5) * w / cnt - cw / 2;
      chairSym(g, x, top ? -cd + 8 : d - 8, cw, cd, top ? "N" : "S");
    }
    R(g, 0, 0, w, d, "s", 3);
  },
  diningRound(g, w, d, it) {
    const n = it.chairs ?? 4, r = Math.min(w, d) / 2;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + i * 2 * Math.PI / n, cx = w / 2 + (r + 12) * Math.cos(a), cy = d / 2 + (r + 12) * Math.sin(a);
      const cg = el("g", { transform: `translate(${cx} ${cy}) rotate(${a * 180 / Math.PI + 90})` }, g);
      chairSym(cg, -21, -20, 42, 40, "N");
    }
    el("ellipse", { cx: w / 2, cy: d / 2, rx: w / 2, ry: d / 2, class: "s" }, g);
  },
  island(g, w, d) { R(g, 0, 0, w, d, "s", 3); R(g, 4, 4, w - 8, d - 8, "t", 2); },
  stool(g, w, d) { C(g, w / 2, d / 2, Math.min(w, d) / 2); C(g, w / 2, d / 2, Math.min(w, d) * 0.3, "t"); },
  desk(g, w, d) { R(g, 0, 0, w, d); R(g, w / 2 - Math.min(30, w * 0.25), 4, Math.min(60, w * 0.5), 3, "f"); chairSym(g, w / 2 - 26, d - 6, 52, 50, "S"); },
  deskLift(g, w, d) {
    R(g, 0, 0, w, d); L(g, 10, 4, 10, d - 4, "d"); L(g, w - 10, 4, w - 10, d - 4, "d");
    R(g, w / 2 - Math.min(30, w * 0.25), 4, Math.min(60, w * 0.5), 3, "f"); TXT(g, w / 2, d * 0.62, "升降", "sz"); chairSym(g, w / 2 - 26, d - 6, 52, 50, "S");
  },
  deskFixed(g, w, d) {
    R(g, 0, 0, w, d); const cl = el("clipPath", { id: "cp" + Math.random().toString(36).slice(2) }, g); R(cl, 0, 0, w, d, "");
    const hg = el("g", { "clip-path": `url(#${cl.id})` }, g);
    for (let x = -d; x < w; x += 12) L(hg, x, d, x + d, 0, "t");
    R(g, 0, 0, w, d, "t");
  },
  chair(g, w, d) { chairSym(g, 0, 0, w, d, "S"); },
  bookshelf(g, w, d) { R(g, 0, 0, w, d); L(g, 0, d * 0.35, w, d * 0.35, "t"); const n = Math.max(1, Math.round(w / 40)); for (let i = 1; i < n; i++) L(g, i * w / n, 0, i * w / n, d, "t"); },
  cabinet(g, w, d) { R(g, 0, 0, w, d); L(g, 0, 0, w, d); L(g, w, 0, 0, d); },
  lowcab(g, w, d) { R(g, 0, 0, w, d); const n = Math.max(1, Math.round(w / 45)); for (let i = 1; i < n; i++) L(g, i * w / n, 0, i * w / n, d, "t"); L(g, 0, d - 4, w, d - 4, "t"); },
  shoe(g, w, d) { R(g, 0, 0, w, d); L(g, 0, 0, w, d, "d"); L(g, w, 0, 0, d, "d"); const n = Math.max(1, Math.round(w / 45)); for (let i = 1; i < n; i++) L(g, i * w / n, 0, i * w / n, d, "t"); },
  bench(g, w, d) { R(g, 0, 0, w, d); R(g, 4, 4, w - 8, d - 8, "t", 6); const n = Math.max(1, Math.round(w / 60)); for (let i = 1; i < n; i++) L(g, i * w / n, 4, i * w / n, d - 4, "d"); },
  slideDoor(g, w, d) {
    el("rect", { x: 0, y: 0, width: w, height: d, fill: "#fff", stroke: "none" }, g);
    const pw = w / 2 + 6; R(g, 0, d * 0.15, pw, d * 0.3, "g"); R(g, w - pw, d * 0.55, pw, d * 0.3, "g");
    PATH(g, `M${w * 0.18} ${-6} l10 -4 m-10 4 l10 4 M${w * 0.18} -6 H${w * 0.42}`, "t");
  },
  swingDoor(g, w, d, it) {
    el("rect", { x: 0, y: -6, width: w, height: 12, fill: "#fff", stroke: "none" }, g);
    L(g, 0, 0, 0, -0, "t");
    PATH(g, `M0 0 V${-w}`, "door-leaf"); PATH(g, `M0 ${-w} A ${w} ${w} 0 0 1 ${w} 0`, "door-arc");
    L(g, -3, 0, -3, 0, "t");
  },
  vanityArc(g, w, d) {   // 轉角四分之一圓：直角在左上，弧形前緣朝右下
    PATH(g, `M0 0 H${w} A ${w} ${d} 0 0 1 0 ${d} Z`, "s");
    el("rect", { x: 3, y: 1.5, width: w * 0.85, height: 3, class: "f" }, g);
    PATH(g, `M${w * 0.82} 8 A ${w * 0.82} ${d * 0.82} 0 0 1 8 ${d * 0.82}`, "d");
    const r = Math.min(18, w * 0.18); const cx = w * 0.707 + r * 0.9, cy = d * 0.707 + r * 0.9; C(g, cx, cy, r); C(g, cx, cy, r * 0.6, "t");
  },
  cabinetArc(g, w, d) { PATH(g, `M0 0 H${w} A ${w} ${d} 0 0 1 0 ${d} Z`, "s"); L(g, 0, 0, w * 0.707, d * 0.707); PATH(g, `M${w * 0.75} 0 A ${w * 0.75} ${d * 0.75} 0 0 1 0 ${d * 0.75}`, "d"); },
  wallArc(g, w, d, it) {   // 圓心在左下，弧從左上到右下
    const t = Math.min(it.thick || 12, w - 1, d - 1);
    el("path", { d: `M0 0 A ${w} ${d} 0 0 1 ${w} ${d} H${w - t} A ${w - t} ${d - t} 0 0 0 0 ${t} Z`, class: "wall" }, g);
  },
  slideDoorArc(g, w, d) {
    const pt = (u, k) => { const a = u * Math.PI / 2; return [(w - k) * Math.sin(a), d - (d - k) * Math.cos(a)]; };
    const arc = (u1, u2, k) => { let p = ""; for (let i = 0; i <= 24; i++) { const [x, y] = pt(u1 + (u2 - u1) * i / 24, k); p += (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1); } return p; };
    el("path", { d: arc(0, 1, 0) + arc(1, 0, 12).replace("M", "L") + "Z", fill: "#fff", stroke: "none" }, g);
    PATH(g, arc(0, 1, 0), "t"); PATH(g, arc(0, 1, 12), "t");
    el("path", { d: arc(0, 0.56, 3), fill: "none", stroke: "#222", "stroke-width": 3.2 }, g);
    el("path", { d: arc(0.44, 1, 9), fill: "none", stroke: "#222", "stroke-width": 3.2 }, g);
  },
  bunk(g, w, d) { R(g, 0, 0, w, d); R(g, 0, 0, w, 6, "f"); R(g, 8, 10, w - 16, 28, "t", 8); L(g, 0, 0, w, d, "d"); L(g, w, 0, 0, d, "d"); R(g, w - 14, d * 0.35, 10, d * 0.4, "t"); for (let y = d * 0.4; y < d * 0.75; y += 12) L(g, w - 14, y, w - 4, y); TXT(g, w / 2, d * 0.62, "上下舖", "sz"); },
  crib(g, w, d) { R(g, 0, 0, w, d); R(g, 4, 4, w - 8, d - 8, "t"); for (let x = 10; x < w - 4; x += 8) { L(g, x, 0, x, 4); L(g, x, d - 4, x, d); } },
  mattress(g, w, d) { R(g, 0, 0, w, d, "s", 6); R(g, 6, 6, w - 12, d - 12, "t", 4); R(g, 10, 10, w - 20, 26, "t", 8); },
  tatami(g, w, d) { R(g, 0, 0, w, d); const m = 90; for (let x = m; x < w - 5; x += m) L(g, x, 0, x, d); for (let y = m; y < d - 5; y += m) L(g, 0, y, w, y); R(g, 3, 3, w - 6, d - 6, "t"); TXT(g, w / 2, d - 12, "架高 H40", "sz"); },
  wardrobeL(g, w, d) {
    const dp = Math.min(60, w * 0.45, d * 0.45);
    PATH(g, `M0 0 H${w} V${dp} H${dp} V${d} H0 Z`, "s");
    L(g, 8, dp * 0.45, w - 8, dp * 0.45, "d"); L(g, dp * 0.45, dp, dp * 0.45, d - 8, "d");
    for (let x = dp + 8; x < w - 8; x += 11) L(g, x - 4, dp * 0.18, x + 4, dp * 0.72);
    for (let y = dp + 8; y < d - 8; y += 11) L(g, dp * 0.18, y - 4, dp * 0.72, y + 4);
    L(g, 0, 0, dp, dp, "t");
  },
  rack(g, w, d) { R(g, 0, 0, w, d, "d"); L(g, 4, d / 2, w - 4, d / 2); for (let x = 10; x < w - 6; x += 10) L(g, x - 4, d * 0.2, x + 4, d * 0.8); },
  mirror(g, w, d) { R(g, 0, 0, w, d, "g"); L(g, 4, d / 2, w - 4, d / 2); },
  sofabed(g, w, d) { DRAW.sofa(g, w, d, { seats: 3 }); L(g, 0, d + 6, w, d + 6, "d"); L(g, 0, d + 6, 0, d + 100, "d"); L(g, w, d + 6, w, d + 100, "d"); L(g, 0, d + 100, w, d + 100, "d"); },
  chaise(g, w, d) { R(g, 0, 0, w, d, "s", 10); R(g, 4, 0, w - 8, d * 0.22, "t", 6); R(g, 6, d * 0.25, w - 12, d * 0.72, "t", 8); },
  beanbag(g, w, d) { el("ellipse", { cx: w / 2, cy: d / 2, rx: w / 2, ry: d / 2, class: "s" }, g); el("ellipse", { cx: w / 2, cy: d * 0.58, rx: w * 0.3, ry: d * 0.26, class: "t" }, g); },
  ottoman(g, w, d) { R(g, 0, 0, w, d, "s", Math.min(w, d) * 0.2); R(g, 5, 5, w - 10, d - 10, "t", Math.min(w, d) * 0.15); },
  side(g, w, d) { C(g, w / 2, d / 2, Math.min(w, d) / 2); C(g, w / 2, d / 2, Math.min(w, d) * 0.12, "t"); },
  tvwall(g, w, d) { R(g, 0, 0, w, d, "f"); },
  screen(g, w, d) { R(g, 0, 0, w, d, "d"); L(g, 0, d / 2, w, d / 2, "d"); },
  rugRound(g, w, d) { el("ellipse", { cx: w / 2, cy: d / 2, rx: w / 2, ry: d / 2, class: "d" }, g); el("ellipse", { cx: w / 2, cy: d / 2, rx: w / 2 - 8, ry: d / 2 - 8, class: "t" }, g); },
  floorLamp(g, w, d) { C(g, w / 2, d / 2, Math.min(w, d) / 2); L(g, 4, d / 2, w - 4, d / 2); L(g, w / 2, 4, w / 2, d - 4); C(g, w / 2, d / 2, 3, "f"); },
  dchair(g, w, d) { chairSym(g, 0, 0, w, d, "N"); },
  benchSeat(g, w, d) { R(g, 0, 0, w, d, "s", 3); L(g, 6, d / 2, w - 6, d / 2, "d"); },
  sideboard(g, w, d) { R(g, 0, 0, w, d); const n = Math.max(2, Math.round(w / 40)); for (let i = 1; i < n; i++) L(g, i * w / n, 0, i * w / n, d); L(g, 0, d - 4, w, d - 4); },
  trash(g, w, d) { R(g, 0, 0, w, d, "s", 4); L(g, 0, d * 0.3, w, d * 0.3); },
  deskL(g, w, d) {
    const dp = Math.min(60, w * 0.45, d * 0.45);
    PATH(g, `M0 0 H${w} V${dp} H${dp} V${d} H0 Z`, "s");
    R(g, w / 2 - 20, 4, 40, 3, "f"); R(g, 4, d / 2 - 20, 3, 40, "f");
    chairSym(g, dp + 8, dp + 8, 52, 50, "S");
  },
  drawer(g, w, d) { R(g, 0, 0, w, d); for (let i = 1; i < 3; i++) L(g, 0, i * d / 3, w, i * d / 3); },
  upper(g, w, d) { R(g, 0, 0, w, d, "d"); L(g, 0, 0, w, d, "d"); L(g, w, 0, 0, d, "d"); },
  display(g, w, d) { R(g, 0, 0, w, d); L(g, 0, 0, w, d); L(g, w, 0, 0, d); R(g, 3, d - 6, w - 6, 3, "g"); },
  screenCab(g, w, d) { R(g, 0, 0, w, d); L(g, 0, d / 2, w, d / 2); const n = Math.max(2, Math.round(w / 45)); for (let i = 1; i < n; i++) L(g, i * w / n, 0, i * w / n, d, "t"); L(g, 0, 0, w, d / 2, "d"); L(g, 0, d / 2, w, d, "d"); },
  openShelf(g, w, d) { R(g, 0, 0, w, d); const n = Math.max(1, Math.round(w / 30)); for (let i = 1; i < n; i++) L(g, i * w / n, 0, i * w / n, d, "d"); },
  yogamat(g, w, d) { R(g, 0, 0, w, d, "s", 4); const hz = w > d; if (hz) { el("ellipse", { cx: w - 7, cy: d / 2, rx: 7, ry: d / 2 - 1, class: "t" }, g); } else { el("ellipse", { cx: w / 2, cy: d - 7, rx: w / 2 - 1, ry: 7, class: "t" }, g); } },
  treadmill(g, w, d) { R(g, 0, 0, w, d, "s", 4); R(g, 8, d * 0.18, w - 16, d * 0.76, "g", 3); R(g, 2, 0, w - 4, d * 0.15, "t", 3); },
  bike(g, w, d) { R(g, w * 0.3, 0, w * 0.4, d, "s", 6); C(g, w / 2, d * 0.15, Math.min(w, d) * 0.18, "t"); L(g, 0, d * 0.3, w, d * 0.3); el("ellipse", { cx: w / 2, cy: d * 0.75, rx: w * 0.3, ry: d * 0.08, class: "t" }, g); },
  dumbbell(g, w, d) { R(g, 0, 0, w, d); for (let x = 10; x < w - 5; x += 16) { C(g, x, d * 0.35, 5, "t"); C(g, x, d * 0.7, 5, "t"); } },
  petbed(g, w, d) { el("ellipse", { cx: w / 2, cy: d / 2, rx: w / 2, ry: d / 2, class: "s" }, g); el("ellipse", { cx: w / 2, cy: d / 2, rx: w / 2 - 8, ry: d / 2 - 8, class: "t" }, g); },
  ac(g, w, d) {
    el("rect", { x: 0, y: 0, width: w, height: d, rx: 4, class: "d", fill: "#fff5f5", stroke: "#c92a2a" }, g);
    for (const k of [0.25, 0.5, 0.75]) { el("line", { x1: w * k, y1: d + 4, x2: w * k, y2: d + 30, stroke: "#c92a2a", "stroke-width": 1.2 }, g); el("path", { d: `M${w * k - 5} ${d + 24} L${w * k} ${d + 32} L${w * k + 5} ${d + 24}`, fill: "none", stroke: "#c92a2a", "stroke-width": 1.2 }, g); }
  },
  curtain(g, w, d) { let p = ""; for (let i = 0; i <= Math.round(w / 6); i++) { const x = i * 6; p += (i ? "L" : "M") + Math.min(x, w) + " " + (d / 2 + (i % 2 ? -d * 0.35 : d * 0.35)); } PATH(g, p, "t"); },
  doubleDoor(g, w, d) {
    const r = w / 2;
    el("rect", { x: 0, y: -6, width: w, height: 12, fill: "#fff", stroke: "none" }, g);
    PATH(g, `M0 0 V${-r}`, "door-leaf"); PATH(g, `M0 ${-r} A ${r} ${r} 0 0 1 ${r} 0`, "door-arc");
    PATH(g, `M${w} 0 V${-r}`, "door-leaf"); PATH(g, `M${w} ${-r} A ${r} ${r} 0 0 0 ${r} 0`, "door-arc");
  },
  pocketDoor(g, w, d) { el("rect", { x: 0, y: 0, width: w, height: d, fill: "#fff", stroke: "none" }, g); R(g, 0, d * 0.3, w * 0.55, d * 0.4, "g"); L(g, w * 0.55, d / 2, w, d / 2, "d"); el("rect", { x: -w * 0.5, y: 0, width: w * 0.5, height: d, class: "wall" }, g); },
  foldDoor(g, w, d) { el("rect", { x: 0, y: -2, width: w, height: 4, fill: "#fff", stroke: "none" }, g); const n = 4, pw = w / n; let p = "M0 0"; for (let i = 1; i <= n; i++) p += ` L${i * pw} ${i % 2 ? -d : 0}`; el("path", { d: p, fill: "none", stroke: "#222", "stroke-width": 2 }, g); },
  glassWall(g, w, d) { el("rect", { x: 0, y: 0, width: w, height: d, fill: "#e7f1f8", stroke: "#222", "stroke-width": 1 }, g); L(g, 0, d / 2, w, d / 2); },
  halfWall(g, w, d) { el("rect", { x: 0, y: 0, width: w, height: d, fill: "#9ca3af", stroke: "#222", "stroke-width": 1 }, g); TXT(g, w / 2, d + 10, "H110", "sz"); },
  column(g, w, d) { el("rect", { x: 0, y: 0, width: w, height: d, class: "wall" }, g); },
  dimension(g, w, d) {
    el("line", { x1: 0, y1: d / 2, x2: w, y2: d / 2, stroke: "#2563eb", "stroke-width": 1 }, g);
    for (const x of [0, w]) { el("line", { x1: x - 4, y1: d / 2 + 4, x2: x + 4, y2: d / 2 - 4, stroke: "#2563eb", "stroke-width": 1.2 }, g); el("line", { x1: x, y1: 0, x2: x, y2: d, stroke: "#2563eb", "stroke-width": .8 }, g); }
  },
  wall(g, w, d) { el("rect", { x: 0, y: 0, width: w, height: d, class: "wall" }, g); },
  text(g, w, d, it) { /* 只有文字 */ },
};
export function bedCommon(g, w, d, n) {
  R(g, 0, 0, w, d); R(g, 0, 0, w, 7, "f");
  const pw = n === 2 ? (w - 24) / 2 : w - 20;
  for (let i = 0; i < n; i++) R(g, 10 + i * (pw + 4), 12, pw, 32, "t", 8);
  const fy = d * 0.36; L(g, 2, fy, w - 2, fy); PATH(g, `M${w - 2} ${fy} L${w - 34} ${fy + 26} L${w - 2} ${fy + 26}`, "t");
}
export function chairSym(g, x, y, w, h, back) {
  const gg = el("g", { transform: `translate(${x} ${y})` }, g);
  R(gg, 2, 2, w - 4, h - 4, "s", 7);
  if (back === "S") R(gg, 4, h - 9, w - 8, 6, "t", 3); else R(gg, 4, 3, w - 8, 6, "t", 3);
}
