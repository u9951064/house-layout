// 底圖資料：驗證、AI 回覆解析與正規化、套用底圖
import { S, state } from "../core/store.js";
import { updateButtons } from "../core/history.js";
import { distSeg } from "../core/geometry.js";
import { DRAW } from "../shapes/draw.js";
import { fit } from "../canvas/view.js";
import { computeBounds, drawBase, drawGrid } from "../canvas/base-render.js";
import { renderItems } from "../canvas/items.js";
import { autosave } from "../project/project.js";
import { renderProps } from "../ui/props.js";
import { hideGate } from "../ui/gate.js";

export function validBase(b) {
  if (!b || typeof b !== "object") return false;
  const okWalls = Array.isArray(b.walls) && b.walls.every(w => Array.isArray(w) && w.length >= 5 && w.slice(0, 5).every(isFinite));
  const okImg = b.image && typeof b.image.src === "string" && /^data:image\//.test(b.image.src) && [b.image.x, b.image.y, b.image.w, b.image.h].every(isFinite);
  return okWalls || okImg;
}
export function extractJSON(text) {
  let t = String(text || "").trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i); if (fence) t = fence[1].trim();
  const i = t.indexOf("{"), j = t.lastIndexOf("}"); if (i < 0 || j <= i) throw new Error("找不到 JSON（請貼上包含 { … } 的內容）");
  t = t.slice(i, j + 1).replace(/,\s*([}\]])/g, "$1");   // 容忍結尾逗號
  try { return JSON.parse(t); } catch (e) { throw new Error("JSON 格式錯誤：" + e.message); }
}
export function normalizeBase(o) {
  const warn = [], N = v => typeof v === "string" ? parseFloat(v) : v, fin = v => typeof v === "number" && isFinite(v);
  if (o && o.base && typeof o.base === "object" && !o.walls) o = o.base;
  if (!o || typeof o !== "object") throw new Error("內容不是 JSON 物件");
  if (!Array.isArray(o.walls) || !o.walls.length) throw new Error("缺少 walls（牆）資料");
  const rect4 = (r, what) => { if (!Array.isArray(r) || r.length < 4) { warn.push(`略過格式不正確的${what}`); return null; } const v = r.slice(0, 4).map(N); if (!v.every(fin)) { warn.push(`略過格式不正確的${what}`); return null; } return [Math.min(v[0], v[2]), Math.min(v[1], v[3]), Math.max(v[0], v[2]), Math.max(v[1], v[3])]; };
  const typeMap = { win: "win", window: "win", "窗": "win", door: "door", "門": "door", open: "open", opening: "open", "開口": "open" };
  const walls = [];
  o.walls.forEach((w, i) => {
    if (!Array.isArray(w) || w.length < 4) { warn.push(`第 ${i + 1} 面牆格式不正確，已略過`); return; }
    let [x1, y1, x2, y2, th] = w.slice(0, 5).map(N);
    if (![x1, y1, x2, y2].every(fin)) { warn.push(`第 ${i + 1} 面牆座標不是數字，已略過`); return; }
    if (!fin(th) || th <= 0) { th = 12; warn.push(`第 ${i + 1} 面牆沒有厚度，預設 12 cm`); }
    if (Math.hypot(x2 - x1, y2 - y1) < 1) { warn.push(`第 ${i + 1} 面牆長度為 0，已略過`); return; }
    if (Math.abs(y1 - y2) > 0 && Math.abs(y1 - y2) <= 2 && Math.abs(x2 - x1) > 20) { y2 = y1; warn.push(`第 ${i + 1} 面牆稍微歪斜，已拉成水平`); }
    if (Math.abs(x1 - x2) > 0 && Math.abs(x1 - x2) <= 2 && Math.abs(y2 - y1) > 20) { x2 = x1; warn.push(`第 ${i + 1} 面牆稍微歪斜，已拉成垂直`); }
    const hz = Math.abs(y1 - y2) < 0.01, vt = Math.abs(x1 - x2) < 0.01, lo = hz ? Math.min(x1, x2) : Math.min(y1, y2), hi = hz ? Math.max(x1, x2) : Math.max(y1, y2);
    const ops = [];
    (Array.isArray(w[5]) ? w[5] : []).forEach((op, j) => {
      if (!(hz || vt)) { warn.push(`第 ${i + 1} 面牆是斜牆，開口已略過`); return; }
      if (!Array.isArray(op) || op.length < 2) return;
      let a = N(op[0]), b = N(op[1]); if (!fin(a) || !fin(b)) return; if (a > b) [a, b] = [b, a];
      if (a < lo - 0.5 || b > hi + 0.5) { warn.push(`第 ${i + 1} 面牆的開口 ${j + 1} 超出牆的範圍，已裁切`); a = Math.max(lo, a); b = Math.min(hi, b); }
      if (b - a < 5) return;
      const k = typeMap[String(op[2] || "open").toLowerCase()] || typeMap[op[2]] || "open";
      if (k === "door") { const ov = op[3] && typeof op[3] === "object" ? op[3] : {}; ops.push([a, b, "door", { hinge: ov.hinge === "b" ? "b" : "a", side: N(ov.side) < 0 ? -1 : 1 }]); }
      else ops.push([a, b, k]);
    });
    ops.sort((p, q) => p[0] - q[0]);
    for (let j = 1; j < ops.length; j++) if (ops[j][0] < ops[j - 1][1]) warn.push(`第 ${i + 1} 面牆的開口互相重疊，請用「編輯底圖」檢查`);
    walls.push([x1, y1, x2, y2, th, ops]);
  });
  if (!walls.length) throw new Error("沒有可用的牆");
  const out = { name: String(o.name || "AI 產生的底圖"), walls };
  out.columns = (o.columns || []).map(r => rect4(r, "柱子")).filter(Boolean);
  out.canopies = (o.canopies || []).map(r => rect4(r, "雨遮")).filter(Boolean);
  if (out.canopies.length) out.canopyLabel = String(o.canopyLabel || "雨遮");
  out.outOfScope = (o.outOfScope || []).map(z => { const r = rect4(z && z.r, "不在範圍區"); return r ? { name: String(z.name || ""), r } : null; }).filter(Boolean);
  out.rooms = (o.rooms || []).filter(r => r && fin(N(r.x)) && fin(N(r.y))).map(r => ({ n: String(r.n || r.name || ""), s: String(r.s || ""), x: N(r.x), y: N(r.y) }));
  out.fixtures = (o.fixtures || []).filter(f => { const ok = f && DRAW[f.type] && [f.x, f.y, f.w, f.d].map(N).every(fin); if (!ok) warn.push(`略過無法辨識的固定設備：${f && f.type}`); return ok; })
    .map(f => ({ type: f.type, x: N(f.x), y: N(f.y), w: N(f.w), d: N(f.d), rot: N(f.rot) || 0, flip: !!f.flip, label: String(f.label || "") }));
  out.dims = (o.dims || []).filter(d => Array.isArray(d) && d.slice(0, 4).map(N).every(fin)).map(d => d.slice(0, 4).map(N));
  // 外牆是否封閉：每個端點至少與另一面牆相接
  const ends = walls.flatMap(w => [[w[0], w[1]], [w[2], w[3]]]); const loose = ends.filter(([x, y]) => walls.filter(w => Math.hypot(w[0] - x, w[1] - y) < 1.5 || Math.hypot(w[2] - x, w[3] - y) < 1.5 || distSeg({ x, y }, w[0], w[1], w[2], w[3]) < w[4] / 2 + 1).length < 2);
  if (loose.length) warn.push(`有 ${loose.length} 個牆端點沒有接到其他牆（可能是缺口或 T 字牆），請目視檢查`);
  return { base: out, warn };
}
export function setBase(b, keepItems = true) {
  if (!validBase(b)) throw new Error("底圖格式不正確（需要 walls 牆面資料或 image 圖片）");
  const { app, version, unit, savedAt, ...rest } = b;
  S.BASE = { walls: [], ...rest }; S.BASE.bounds = computeBounds(S.BASE);
  if (!keepItems) { state.items = []; state.nextId = 1; }
  state.sel = null; if (typeof S.bsel !== "undefined") S.bsel = null; hideGate(); drawGrid(); drawBase(); fit(); renderItems(); renderProps(); autosave(); updateButtons();
}
