// 立面註記：尺寸標註、文字引出、材質標示、矩形／線條（造型線、線板、腰帶）、開孔／插座位置記號
// 存在 state.spec.elevNotes["牆索引:面"] = [{ kind, pts: [[u, h], …], text, mat }]（u 沿牆 cm、h 高度 cm）
import { t } from "../core/i18n.js";
import { state } from "../core/store.js";
import { el } from "../core/dom.js";
import { getMat, svgPattern } from "../materials/index.js";
import { dimH, dimV } from "./elevation.js";
import { faceKey } from "./walls.js";

export const NOTE_KINDS = [
  ["dim", "尺寸標註", 2],
  ["text", "文字註記", 2],
  ["mat", "材質標示", 2],
  ["rect", "矩形", 2],
  ["line", "線條", 2],
  ["mark", "開孔／插座位置", 1],
];
export function notesOf(i, face) {
  return ((state.spec && state.spec.elevNotes) || {})[faceKey(i, face)] || [];
}
/** 取得（必要時建立）這面牆的註記陣列，直接修改 state.spec */
export function notesRef(i, face) {
  state.spec ||= {};
  const all = (state.spec.elevNotes ||= {});
  return (all[faceKey(i, face)] ||= []);
}
function txt(g, x, y, s, size, anchor = "start", cls = "ev-note-text") {
  const e = el("text", { x, y, class: cls, "font-size": size, "text-anchor": anchor }, g);
  e.textContent = s;
  return e;
}
/** 畫出一筆註記；回傳群組 */
export function drawNote(g, n, k, fs, root, selected) {
  const ng = el("g", { class: "ev-note" + (selected ? " sel" : ""), "data-note": k }, g);
  const P = (n.pts || []).map(([u, h]) => [u, -h]);
  if (!P.length) return ng;
  const [a, b = a] = P;
  if (n.kind === "dim") {
    const du = b[0] - a[0],
      dh = b[1] - a[1];
    if (Math.abs(dh) < Math.abs(du) * 0.2)
      dimH(ng, Math.min(a[0], b[0]), Math.max(a[0], b[0]), a[1], fs, n.text || undefined);
    else if (Math.abs(du) < Math.abs(dh) * 0.2)
      dimV(ng, a[0], -Math.max(a[1], b[1]), -Math.min(a[1], b[1]), fs, n.text || undefined);
    else {
      el("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: "ev-dim" }, ng);
      const L = Math.round(Math.hypot(du, dh)),
        mx = (a[0] + b[0]) / 2,
        my = (a[1] + b[1]) / 2,
        ang = (Math.atan2(dh, du) * 180) / Math.PI;
      const tx = txt(ng, mx, my - fs * 0.3, n.text || String(L), fs * 0.8, "middle", "ev-dimtext");
      tx.setAttribute("transform", `rotate(${ang > 90 || ang < -90 ? ang + 180 : ang} ${mx} ${my})`);
    }
  } else if (n.kind === "text" || n.kind === "mat") {
    const label =
      n.kind === "mat" && n.mat
        ? `${getMat(n.mat).name}${getMat(n.mat).code ? "（" + getMat(n.mat).code + "）" : ""}${n.text ? " " + n.text : ""}`
        : n.text || t("註記");
    if (P.length > 1) {
      el("polyline", { points: `${a[0]},${a[1]} ${b[0]},${b[1]}`, class: "ev-leader" }, ng);
      el("circle", { cx: a[0], cy: a[1], r: fs * 0.2, class: "ev-dot" }, ng);
    }
    const right = b[0] >= a[0];
    let x = b[0] + (right ? fs * 0.3 : -fs * 0.3);
    if (n.kind === "mat" && n.mat) {
      let fill = getMat(n.mat).color;
      try {
        fill = svgPattern(root, n.mat) || fill;
      } catch (e) {}
      el("rect", { x: right ? x : x - fs, y: b[1] - fs * 0.5, width: fs, height: fs, fill, class: "ev-swatch" }, ng);
      x += right ? fs * 1.3 : -fs * 1.3;
    }
    txt(ng, x, b[1] + fs * 0.3, label, fs * 0.8, right ? "start" : "end");
  } else if (n.kind === "rect") {
    const x = Math.min(a[0], b[0]),
      y = Math.min(a[1], b[1]);
    let fill = "none";
    if (n.mat)
      try {
        fill = svgPattern(root, n.mat) || getMat(n.mat).color;
      } catch (e) {}
    el("rect", { x, y, width: Math.abs(b[0] - a[0]), height: Math.abs(b[1] - a[1]), class: "ev-note-shape", fill }, ng);
    if (n.text)
      txt(ng, x + Math.abs(b[0] - a[0]) / 2, y + Math.abs(b[1] - a[1]) / 2 + fs * 0.3, n.text, fs * 0.75, "middle");
  } else if (n.kind === "line") {
    el("polyline", { points: P.map(p => p.join(",")).join(" "), class: "ev-note-shape", fill: "none" }, ng);
    if (n.text) txt(ng, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - fs * 0.3, n.text, fs * 0.75, "middle");
  } else if (n.kind === "mark") {
    const r = fs * 0.6;
    el("circle", { cx: a[0], cy: a[1], r, class: "ev-mark" }, ng);
    el("line", { x1: a[0] - r, y1: a[1], x2: a[0] + r, y2: a[1], class: "ev-mark" }, ng);
    el("line", { x1: a[0], y1: a[1] - r, x2: a[0], y2: a[1] + r, class: "ev-mark" }, ng);
    txt(ng, a[0] + r * 1.4, a[1] - r * 0.3, `${n.text || ""} H${Math.round(-a[1])}`.trim(), fs * 0.75);
  }
  // 點擊範圍
  const xs = P.map(p => p[0]),
    ys = P.map(p => p[1]);
  el(
    "rect",
    {
      x: Math.min(...xs) - fs * 0.5,
      y: Math.min(...ys) - fs * 0.8,
      width: Math.max(...xs) - Math.min(...xs) + fs,
      height: Math.max(...ys) - Math.min(...ys) + fs * 1.6,
      class: "ev-note-hit",
    },
    ng,
  );
  return ng;
}
export function drawNotes(g, i, face, fs, root, selK = -1) {
  notesOf(i, face).forEach((n, k) => drawNote(g, n, k, fs, root, k === selK));
}
