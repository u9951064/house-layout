// 底圖編輯模式：畫牆、門窗開口、柱子、雨遮、不在範圍、房間名稱、固定設備
import { S, state, view } from "../core/store.js";
import { $, TXT, el, esc, svg, toast, uiLayer } from "../core/dom.js";
import { commit } from "../core/history.js";
import { distSeg, inFixture, inRect, isAxis, snapV, wallHz } from "../core/geometry.js";
import { DEFAULTS } from "../shapes/library.js";
import { DRAW } from "../shapes/draw.js";
import { toWorld } from "../canvas/view.js";
import { computeBounds, drawBase, drawGrid } from "../canvas/base-render.js";
import { renderItems, renderSelection } from "../canvas/items.js";
import { startPan } from "../canvas/interact.js";
import { startCalib } from "../tools/calibrate.js";
import { addItem } from "../edit/actions.js";
import { applyGateBase, autosave } from "../project/project.js";
import { bindBaseSection, renderBaseSection, renderProps } from "../ui/props.js";
import { showGate } from "../ui/gate.js";

export const BTOOLS = { select: "選取", wall: "畫牆", win: "＋窗", door: "＋門", open: "＋開口", column: "柱子", canopy: "雨遮", oos: "不在範圍", room: "房間名稱" };
export function setMode(m) {
  if (m === "base" && !S.BASE) { showGate(); return; }
  if (m === S.mode) return;
  S.mode = m; S.wallDraw = null; S.rectDraw = null; S.bsel = null; state.sel = null;
  svg.classList.toggle("basemode", S.mode === "base"); $("basebar").classList.toggle("show", S.mode === "base"); $("btnBaseEdit").classList.toggle("on", S.mode === "base");
  $("sheets").style.display = S.mode === "base" ? "none" : "";
  $("palette").style.display = S.mode === "base" ? "none" : ""; $("basePal").style.display = S.mode === "base" ? "block" : "none";
  if (S.mode === "base") setTool("select"); else { svg.style.cursor = ""; S.BASE.bounds = computeBounds(S.BASE); drawGrid(); drawBase(); }
  renderItems(); renderProps(); toast(S.mode === "base" ? "底圖編輯模式：家具暫時鎖定" : "回到設計模式");
}
export function setTool(t) {
  S.btool = t; S.wallDraw = null; S.rectDraw = null;
  document.querySelectorAll("#basebar button[data-tool], #basePal [data-tool]").forEach(b => b.classList.toggle("on", b.dataset.tool === t));
  svg.style.cursor = t === "select" ? "" : "crosshair"; renderSelection(); renderProps();
}
export function syncThk() { document.querySelectorAll("#basePal [data-thk]").forEach(b => b.classList.toggle("on", +b.dataset.thk === +$("bThick").value)); }
export function commitBase() { S.BASE.bounds = computeBounds(S.BASE); drawBase(); commit(); renderSelection(); renderProps(); }
export const wallTh = () => Math.max(3, parseFloat($("bThick").value) || 12);
export function snapPt(p, from, free) {
  let q = { x: snapV(p.x), y: snapV(p.y) }; const tol = 10 / view.s;
  for (const w of S.BASE.walls || []) for (const [x, y] of [[w[0], w[1]], [w[2], w[3]]]) if (Math.hypot(p.x - x, p.y - y) < tol) return { x, y };
  if (from && !free) { if (Math.abs(q.x - from.x) > Math.abs(q.y - from.y)) q.y = from.y; else q.x = from.x; }
  return q;
}
export function hitBase(p) {
  const B = S.BASE, tol = 8 / view.s;
  if (S.bsel && S.bsel.k === "wall") { const w = B.walls[S.bsel.i]; if (w) { if (Math.hypot(p.x - w[0], p.y - w[1]) < tol * 1.4) return { k: "wall", i: S.bsel.i, part: "p1" }; if (Math.hypot(p.x - w[2], p.y - w[3]) < tol * 1.4) return { k: "wall", i: S.bsel.i, part: "p2" }; } }
  for (let i = (B.fixtures || []).length - 1; i >= 0; i--) if (inFixture(p, B.fixtures[i])) return { k: "fixture", i };
  for (let i = 0; i < (B.rooms || []).length; i++) { const r = B.rooms[i]; if (Math.abs(p.x - r.x) < 45 && p.y > r.y - 18 && p.y < r.y + 26) return { k: "room", i }; }
  for (let i = 0; i < (B.columns || []).length; i++) if (inRect(p, B.columns[i])) return { k: "column", i };
  for (let i = 0; i < (B.walls || []).length; i++) { const w = B.walls[i]; if (distSeg(p, w[0], w[1], w[2], w[3]) <= w[4] / 2 + tol) return { k: "wall", i }; }
  for (let i = 0; i < (B.doors || []).length; i++) { const d = B.doors[i]; if (distSeg(p, d.h[0], d.h[1], d.o[0], d.o[1]) < tol || Math.hypot(p.x - d.h[0], p.y - d.h[1]) < Math.hypot(d.o[0] - d.h[0], d.o[1] - d.h[1])) { const mx = (d.o[0] + d.c[0]) / 2, my = (d.o[1] + d.c[1]) / 2; if (Math.hypot(p.x - mx, p.y - my) < Math.hypot(d.o[0] - d.c[0], d.o[1] - d.c[1]) * 0.6) return { k: "door", i }; } }
  for (let i = 0; i < (B.outOfScope || []).length; i++) if (inRect(p, B.outOfScope[i].r)) return { k: "oos", i };
  for (let i = 0; i < (B.canopies || []).length; i++) if (inRect(p, B.canopies[i])) return { k: "canopy", i };
  if (B.image && inRect(p, [B.image.x, B.image.y, B.image.x + B.image.w, B.image.y + B.image.h])) return { k: "image" };
  return null;
}
export function addOpening(p, kind) {
  const tol = 10 / view.s; let best = null;
  (S.BASE.walls || []).forEach((w, i) => { const d = distSeg(p, w[0], w[1], w[2], w[3]); if (d <= w[4] / 2 + tol && (!best || d < best.d)) best = { i, d }; });
  if (!best) { toast("請點在牆上"); return; }
  const w = S.BASE.walls[best.i]; if (!isAxis(w)) { toast("斜牆目前不支援門窗開口"); return; }
  const hz = wallHz(w), lo = Math.min(hz ? w[0] : w[1], hz ? w[2] : w[3]), hi = Math.max(hz ? w[0] : w[1], hz ? w[2] : w[3]);
  const width = kind === "win" ? 120 : kind === "door" ? 80 : 90;
  let c = snapV(hz ? p.x : p.y), a = Math.max(lo, c - width / 2), b = Math.min(hi, a + width); a = Math.max(lo, b - width);
  w[5] = w[5] || []; w[5].push(kind === "door" ? [a, b, "door", { hinge: "a", side: 1 }] : [a, b, kind]);
  S.bsel = { k: "wall", i: best.i }; commitBase();
}
export function basePointerDown(e) {
  const raw = toWorld(e.clientX, e.clientY);
  if (S.btool === "wall") {
    const last = S.wallDraw && S.wallDraw.pts[S.wallDraw.pts.length - 1], q = snapPt(raw, last, e.altKey);
    if (!S.wallDraw) { S.wallDraw = { pts: [q] }; }
    else if (Math.hypot(q.x - last.x, q.y - last.y) > 1) { S.BASE.walls.push([last.x, last.y, q.x, q.y, wallTh(), []]); S.wallDraw.pts.push(q); commitBase(); }
    renderSelection(); return;
  }
  if (["win", "door", "open"].includes(S.btool)) { addOpening(raw, S.btool); return; }
  if (["column", "canopy", "oos"].includes(S.btool)) { const q = { x: snapV(raw.x), y: snapV(raw.y) }; S.rectDraw = { a: q, b: q }; S.drag = { kind: "brect" }; svg.setPointerCapture(e.pointerId); return; }
  if (S.btool === "room") { const n = prompt("房間名稱", "客廳"); if (!n) return; (S.BASE.rooms = S.BASE.rooms || []).push({ n, s: "", x: snapV(raw.x), y: snapV(raw.y) }); S.bsel = { k: "room", i: S.BASE.rooms.length - 1 }; commitBase(); return; }
  const h = hitBase(raw); S.bsel = h ? { k: h.k, i: h.i } : null; renderSelection(); renderProps();
  if (!h) { startPan(e); return; }
  S.drag = { kind: "bmove", part: h.part, start: raw, orig: JSON.parse(JSON.stringify(baseTarget(h))) }; svg.setPointerCapture(e.pointerId);
}
export function baseTarget(h) { const B = S.BASE; return { wall: () => B.walls[h.i], column: () => B.columns[h.i], canopy: () => B.canopies[h.i], oos: () => B.outOfScope[h.i], room: () => B.rooms[h.i], fixture: () => B.fixtures[h.i], door: () => B.doors[h.i], image: () => B.image }[h.k](); }
export function basePointerMove(e) {
  if (S.drag && (S.drag.kind === "pan" || S.drag.kind === "measure")) return false;
  const raw = toWorld(e.clientX, e.clientY);
  if (!S.drag) { if (S.btool === "wall" && S.wallDraw) { S.hoverPt = snapPt(raw, S.wallDraw.pts[S.wallDraw.pts.length - 1], e.altKey); renderSelection(); } return true; }
  if (S.drag.kind === "brect") { S.rectDraw.b = { x: snapV(raw.x), y: snapV(raw.y) }; renderSelection(); return true; }
  if (S.drag.kind !== "bmove" || !S.bsel) return true;
  const o = S.drag.orig, dx = snapV(raw.x - S.drag.start.x), dy = snapV(raw.y - S.drag.start.y), t = baseTarget(S.bsel);
  if (S.bsel.k === "wall") {
    if (S.drag.part) { const fix = S.drag.part === "p1" ? [o[2], o[3]] : [o[0], o[1]], q = snapPt(raw, { x: fix[0], y: fix[1] }, e.altKey); if (S.drag.part === "p1") { t[0] = q.x; t[1] = q.y; } else { t[2] = q.x; t[3] = q.y; } }
    else { const hz = wallHz(o); t[0] = o[0] + dx; t[1] = o[1] + dy; t[2] = o[2] + dx; t[3] = o[3] + dy; t[5] = (o[5] || []).map(op => [op[0] + (hz ? dx : dy), op[1] + (hz ? dx : dy), ...op.slice(2)]); }
  } else if (["column", "canopy"].includes(S.bsel.k)) { t[0] = o[0] + dx; t[1] = o[1] + dy; t[2] = o[2] + dx; t[3] = o[3] + dy; }
  else if (S.bsel.k === "oos") { t.r = [o.r[0] + dx, o.r[1] + dy, o.r[2] + dx, o.r[3] + dy]; }
  else if (["room", "fixture", "image"].includes(S.bsel.k)) { t.x = o.x + dx; t.y = o.y + dy; }
  else if (S.bsel.k === "door") { for (const k of ["h", "o", "c"]) t[k] = [o[k][0] + dx, o[k][1] + dy]; }
  drawBase(); renderSelection(); renderProps(true); return true;
}
export function basePointerUp(e) {
  if (!S.drag || S.drag.kind === "pan" || S.drag.kind === "measure") return false;
  if (S.drag.kind === "brect") {
    const { a, b } = S.rectDraw, r = [Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x, b.x), Math.max(a.y, b.y)]; S.rectDraw = null; S.drag = null;
    if (r[2] - r[0] < 3 || r[3] - r[1] < 3) { renderSelection(); return true; }
    if (S.btool === "column") { (S.BASE.columns = S.BASE.columns || []).push(r); S.bsel = { k: "column", i: S.BASE.columns.length - 1 }; }
    if (S.btool === "canopy") { (S.BASE.canopies = S.BASE.canopies || []).push(r); if (!S.BASE.canopyLabel) S.BASE.canopyLabel = "雨遮"; S.bsel = { k: "canopy", i: S.BASE.canopies.length - 1 }; }
    if (S.btool === "oos") { const n = prompt("區域名稱（例如：衛浴、陽台）", "衛浴") || ""; (S.BASE.outOfScope = S.BASE.outOfScope || []).push({ name: n, r }); S.bsel = { k: "oos", i: S.BASE.outOfScope.length - 1 }; }
    commitBase(); return true;
  }
  const changed = S.bsel && JSON.stringify(baseTarget(S.bsel)) !== JSON.stringify(S.drag.orig); S.drag = null;
  if (changed) commitBase(); return true;
}
export function addFixture(def, x, y) {
  const f = { type: def.type, x: snapV(x - def.w / 2), y: snapV(y - def.d / 2), w: def.w, d: def.d, rot: 0, label: def.name };
  if (def.seats) f.seats = def.seats; if (def.chairs != null) f.chairs = def.chairs; if (def.thick) f.thick = def.thick;
  (S.BASE.fixtures = S.BASE.fixtures || []).push(f); S.bsel = { k: "fixture", i: S.BASE.fixtures.length - 1 }; setTool("select"); commitBase();
  toast(`已加入固定設備「${def.name}」（離開編輯模式後鎖定）`); return null;
}
export function delBaseSel() {
  if (!S.bsel) return; const B = S.BASE, k = S.bsel.k, i = S.bsel.i;
  if (k === "wall") B.walls.splice(i, 1); if (k === "column") B.columns.splice(i, 1); if (k === "canopy") B.canopies.splice(i, 1);
  if (k === "oos") B.outOfScope.splice(i, 1); if (k === "room") B.rooms.splice(i, 1); if (k === "fixture") B.fixtures.splice(i, 1); if (k === "door") B.doors.splice(i, 1);
  if (k === "image") { if (!confirm("移除底圖圖片？（牆與其他元素保留）")) return; delete B.image; }
  S.bsel = null; commitBase();
}
export function baseKey(e) {
  if (e.key === "Escape" || e.key === "Enter") { if (S.wallDraw) { S.wallDraw = null; S.hoverPt = null; } else S.bsel = null; renderSelection(); renderProps(); return; }
  if ((e.key === "Delete" || e.key === "Backspace") && S.bsel) { e.preventDefault(); delBaseSel(); return; }
  if (e.key === "v" || e.key === "V") setTool("select"); if (e.key === "w" || e.key === "W") setTool("wall");
}
export function drawBaseEditUI() {
  const k = 1 / view.s, B = S.BASE, ui = uiLayer, blue = "#1f6feb";
  (B.walls || []).forEach(w => { for (const [x, y] of [[w[0], w[1]], [w[2], w[3]]]) el("circle", { cx: x, cy: y, r: 3 * k, fill: "#fff", stroke: "#94a3b8", "stroke-width": k }, ui); });
  if (S.bsel) {
    const t = baseTarget(S.bsel); let r = null;
    if (S.bsel.k === "wall") { el("line", { x1: t[0], y1: t[1], x2: t[2], y2: t[3], stroke: blue, "stroke-width": t[4] + 6 * k, "stroke-opacity": .25 }, ui); for (const [x, y] of [[t[0], t[1]], [t[2], t[3]]]) el("circle", { cx: x, cy: y, r: 6 * k, class: "handle", "stroke-width": 1.5 * k }, ui);
      const len = Math.round(Math.hypot(t[2] - t[0], t[3] - t[1])); const lb = TXT(ui, (t[0] + t[2]) / 2, (t[1] + t[3]) / 2 - t[4] / 2 - 10 * k, `${len} cm`, "dimtext"); lb.setAttribute("font-size", 13 * k); }
    else if (["column", "canopy"].includes(S.bsel.k)) r = t; else if (S.bsel.k === "oos") r = t.r;
    else if (S.bsel.k === "image") r = [t.x, t.y, t.x + t.w, t.y + t.h];
    else if (S.bsel.k === "room") r = [t.x - 45, t.y - 18, t.x + 45, t.y + 26];
    else if (S.bsel.k === "door") { const xs = [t.h[0], t.o[0], t.c[0]], ys = [t.h[1], t.o[1], t.c[1]]; r = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; }
    else if (S.bsel.k === "fixture") { const g = el("g", { transform: `translate(${t.x} ${t.y}) rotate(${t.rot || 0} ${t.w / 2} ${t.d / 2})` }, ui); el("rect", { x: -3 * k, y: -3 * k, width: t.w + 6 * k, height: t.d + 6 * k, class: "selbox", "stroke-width": 1.4 * k }, g); }
    if (r) el("rect", { x: r[0] - 3 * k, y: r[1] - 3 * k, width: r[2] - r[0] + 6 * k, height: r[3] - r[1] + 6 * k, class: "selbox", "stroke-width": 1.4 * k }, ui);
  }
  if (S.wallDraw) {
    const pts = S.wallDraw.pts, last = pts[pts.length - 1];
    el("circle", { cx: last.x, cy: last.y, r: 5 * k, fill: blue }, ui);
    if (S.hoverPt) { el("line", { x1: last.x, y1: last.y, x2: S.hoverPt.x, y2: S.hoverPt.y, stroke: blue, "stroke-width": wallTh(), "stroke-opacity": .35 }, ui);
      const t = TXT(ui, (last.x + S.hoverPt.x) / 2, (last.y + S.hoverPt.y) / 2 - wallTh() / 2 - 10 * k, `${Math.round(Math.hypot(S.hoverPt.x - last.x, S.hoverPt.y - last.y))} cm`, "dimtext"); t.setAttribute("font-size", 14 * k); }
  }
  if (S.rectDraw) { const { a, b } = S.rectDraw; el("rect", { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y), fill: "rgba(31,111,235,.12)", stroke: blue, "stroke-width": 1.4 * k, "stroke-dasharray": `${6 * k} ${4 * k}` }, ui);
    const t = TXT(ui, (a.x + b.x) / 2, Math.min(a.y, b.y) - 8 * k, `${Math.round(Math.abs(b.x - a.x))}×${Math.round(Math.abs(b.y - a.y))}`, "dimtext"); t.setAttribute("font-size", 13 * k); }
}
export function renderBaseProps() {
  const P = $("props"), B = S.BASE;
  const help = { select: "點選底圖元素即可編輯；拖曳移動，拖曳牆端點調整長度。Delete 刪除。", wall: "點一下起點，再點下一點完成一面牆，可連續畫。預設鎖水平／垂直，Alt 可畫斜牆；會吸附既有牆端點。Esc、Enter 或雙擊結束。",
    win: "點在牆上加一扇窗（預設 120 cm），再到右側調整位置與寬度。", door: "點在牆上加一扇門（預設 80 cm），可在右側設定鉸鏈端與開向。", open: "點在牆上加一個沒有門的開口（預設 90 cm）。",
    column: "在圖上拖拉出柱子範圍。", canopy: "拖拉出雨遮範圍（斜線表示）。", oos: "拖拉框出不在設計範圍的區域（例如衛浴、陽台），家具放進去會紅框提示。", room: "點一下放房間名稱。" }[S.btool];
  let html = `<h2>✏️ 底圖編輯｜${BTOOLS[S.btool]}</h2><div class="empty">${help}</div>`;
  const num = (id, label, v, step = 1) => `<div class="row"><span>${label}</span><input id="${id}" type="number" step="${step}" value="${Math.round(v * 10) / 10}"></div>`;
  if (S.bsel) {
    const t = baseTarget(S.bsel);
    if (S.bsel.k === "wall") {
      const hz = wallHz(t), ax = isAxis(t), lo = Math.min(hz ? t[0] : t[1], hz ? t[2] : t[3]);
      html += `<h2 style="margin-top:14px">牆（長 ${Math.round(Math.hypot(t[2] - t[0], t[3] - t[1]))} cm）</h2>
        <div class="row2"><label>起點 X<input id="w0" type="number" value="${t[0]}"></label><label>起點 Y<input id="w1" type="number" value="${t[1]}"></label></div>
        <div class="row2"><label>終點 X<input id="w2" type="number" value="${t[2]}"></label><label>終點 Y<input id="w3" type="number" value="${t[3]}"></label></div>
        ${num("w4", "厚度", t[4])}`;
      if (ax) {
        html += `<b style="display:block;margin-top:10px">門窗開口（距牆起點 cm）</b>`;
        (t[5] || []).forEach((op, j) => {
          html += `<div style="border:1px solid #e5e7eb;border-radius:6px;padding:6px;margin:6px 0">
            <div class="row2"><select data-op="${j}" data-f="k"><option value="win" ${op[2] === "win" ? "selected" : ""}>窗</option><option value="door" ${op[2] === "door" ? "selected" : ""}>門</option><option value="open" ${!["win", "door"].includes(op[2]) ? "selected" : ""}>開口</option></select>
            <button data-op="${j}" data-f="del" style="color:#d1242f">刪除</button></div>
            <div class="row2"><label>起點<input data-op="${j}" data-f="a" type="number" value="${Math.round((op[0] - lo) * 10) / 10}"></label><label>寬度<input data-op="${j}" data-f="w" type="number" value="${Math.round((op[1] - op[0]) * 10) / 10}"></label></div>
            ${op[2] === "door" ? `<div class="row2"><select data-op="${j}" data-f="hinge"><option value="a" ${(op[3] || {}).hinge !== "b" ? "selected" : ""}>鉸鏈：靠起點</option><option value="b" ${(op[3] || {}).hinge === "b" ? "selected" : ""}>鉸鏈：靠終點</option></select>
              <button data-op="${j}" data-f="side">翻轉開向</button></div>` : ""}</div>`;
        });
        html += `<div class="actions"><button data-add="win">＋窗</button><button data-add="door">＋門</button><button data-add="open">＋開口</button></div>`;
      } else html += `<div class="muted" style="font-size:12px;margin-top:6px">斜牆目前不支援門窗開口。</div>`;
    }
    else if (["column", "canopy"].includes(S.bsel.k)) html += `<h2 style="margin-top:14px">${S.bsel.k === "column" ? "柱子" : "雨遮"}</h2>${num("r0", "X", t[0])}${num("r1", "Y", t[1])}${num("rw", "寬", t[2] - t[0])}${num("rh", "深", t[3] - t[1])}`;
    else if (S.bsel.k === "oos") html += `<h2 style="margin-top:14px">不在設計範圍</h2><div class="row"><span>名稱</span><input id="oName" type="text" value="${esc(t.name || "")}"></div>${num("r0", "X", t.r[0])}${num("r1", "Y", t.r[1])}${num("rw", "寬", t.r[2] - t.r[0])}${num("rh", "深", t.r[3] - t.r[1])}`;
    else if (S.bsel.k === "room") html += `<h2 style="margin-top:14px">房間名稱</h2><div class="row"><span>名稱</span><input id="rmN" type="text" value="${esc(t.n || "")}"></div><div class="row"><span>副標</span><input id="rmS" type="text" value="${esc(t.s || "")}" placeholder="例如：約 3 坪"></div>${num("fx", "X", t.x)}${num("fy", "Y", t.y)}`;
    else if (S.bsel.k === "fixture") html += `<h2 style="margin-top:14px">固定設備</h2><div class="row"><span>名稱</span><input id="fxL" type="text" value="${esc(t.label || "")}"></div>${num("fw", "寬", t.w)}${num("fd", "深", t.d)}${num("fr", "旋轉", t.rot || 0, 15)}${num("fx", "X", t.x)}${num("fy", "Y", t.y)}<div class="actions"><button id="fxRot">旋轉 90°</button><button id="fxFlip">左右鏡像</button></div>`;
    else if (S.bsel.k === "door") html += `<h2 style="margin-top:14px">門（舊格式）</h2><div class="muted" style="font-size:12px">可拖曳移動或刪除；新增的門建議用牆上的「＋門」。</div>`;
    else if (S.bsel.k === "image") html += `<h2 style="margin-top:14px">底圖圖片</h2>${num("fx", "X", t.x)}${num("fy", "Y", t.y)}<div class="row"><span>透明度</span><input id="imOp" type="range" min="0.1" max="1" step="0.05" value="${t.opacity ?? 0.6}"></div><div class="actions"><button id="imCal">重新校正比例</button></div>`;
    html += `<div class="actions"><button id="bDel" style="color:#d1242f">刪除${S.bsel.k === "image" ? "圖片" : ""}</button></div>`;
  } else {
    html += `<div class="list"><b>底圖內容</b><div>牆 ${(B.walls || []).length} 面</div><div>柱子 ${(B.columns || []).length}・雨遮 ${(B.canopies || []).length}・不在範圍 ${(B.outOfScope || []).length}</div><div>房間名稱 ${(B.rooms || []).length}・固定設備 ${(B.fixtures || []).length}</div></div>` + renderBaseSection();
  }
  P.innerHTML = html;
  if (!S.bsel) { bindBaseSection(); return; }
  const t = baseTarget(S.bsel), ch = (id, fn) => { const x = $(id); if (x) x.onchange = () => { const v = x.type === "number" ? parseFloat(x.value) : x.value; if (x.type === "number" && isNaN(v)) return; fn(v); commitBase(); }; };
  if (S.bsel.k === "wall") {
    const hz = wallHz(t), lo = Math.min(hz ? t[0] : t[1], hz ? t[2] : t[3]);
    ["w0", "w1", "w2", "w3"].forEach((id, j) => ch(id, v => t[j] = v)); ch("w4", v => t[4] = Math.max(3, v));
    P.querySelectorAll("[data-op]").forEach(x => {
      const j = +x.dataset.op, f = x.dataset.f, op = t[5][j];
      if (f === "del") x.onclick = () => { t[5].splice(j, 1); commitBase(); };
      else if (f === "side") x.onclick = () => { op[3] = { ...(op[3] || { hinge: "a" }), side: -((op[3] || {}).side || 1) }; commitBase(); };
      else x.onchange = () => {
        if (f === "k") { op[2] = x.value; if (x.value === "door") op[3] = op[3] || { hinge: "a", side: 1 }; else op.length = 3; }
        if (f === "hinge") op[3] = { ...(op[3] || { side: 1 }), hinge: x.value };
        if (f === "a") { const w = op[1] - op[0]; op[0] = lo + (+x.value || 0); op[1] = op[0] + w; }
        if (f === "w") op[1] = op[0] + Math.max(10, +x.value || 10);
        commitBase();
      };
    });
    P.querySelectorAll("[data-add]").forEach(x => x.onclick = () => { const len = Math.hypot(t[2] - t[0], t[3] - t[1]), w = x.dataset.add === "win" ? 120 : x.dataset.add === "door" ? 80 : 90, a = lo + Math.max(0, (len - w) / 2);
      (t[5] = t[5] || []).push(x.dataset.add === "door" ? [a, a + w, "door", { hinge: "a", side: 1 }] : [a, a + w, x.dataset.add]); commitBase(); });
  }
  if (["column", "canopy"].includes(S.bsel.k)) { ch("r0", v => { const w = t[2] - t[0]; t[0] = v; t[2] = v + w; }); ch("r1", v => { const h = t[3] - t[1]; t[1] = v; t[3] = v + h; }); ch("rw", v => t[2] = t[0] + Math.max(1, v)); ch("rh", v => t[3] = t[1] + Math.max(1, v)); }
  if (S.bsel.k === "oos") { ch("oName", v => t.name = v); const r = t.r; ch("r0", v => { const w = r[2] - r[0]; r[0] = v; r[2] = v + w; }); ch("r1", v => { const h = r[3] - r[1]; r[1] = v; r[3] = v + h; }); ch("rw", v => r[2] = r[0] + Math.max(1, v)); ch("rh", v => r[3] = r[1] + Math.max(1, v)); }
  if (S.bsel.k === "room") { ch("rmN", v => t.n = v); ch("rmS", v => t.s = v); ch("fx", v => t.x = v); ch("fy", v => t.y = v); }
  if (S.bsel.k === "fixture") { ch("fxL", v => t.label = v); ch("fw", v => t.w = Math.max(5, v)); ch("fd", v => t.d = Math.max(3, v)); ch("fr", v => t.rot = ((v % 360) + 360) % 360); ch("fx", v => t.x = v); ch("fy", v => t.y = v);
    $("fxRot").onclick = () => { t.rot = ((t.rot || 0) + 90) % 360; commitBase(); }; $("fxFlip").onclick = () => { t.flip = !t.flip; commitBase(); }; }
  if (S.bsel.k === "image") { ch("fx", v => t.x = v); ch("fy", v => t.y = v); $("imOp").oninput = e => { t.opacity = +e.target.value; drawBase(); autosave(); }; $("imCal").onclick = startCalib; }
  $("bDel").onclick = delBaseSel;
}

export function init() {
  document.querySelectorAll("#basebar button[data-tool], #basePal [data-tool]").forEach(b => b.onclick = () => setTool(b.dataset.tool));
  document.querySelectorAll("#basePal [data-thk]").forEach(b => b.onclick = () => { $("bThick").value = b.dataset.thk; syncThk(); if (S.btool !== "wall") setTool("wall"); toast(`牆厚 ${b.dataset.thk} cm`); });
  $("bThick").addEventListener("input", syncThk);
  syncThk();
  $("basePalDone").onclick = () => setMode("design");
  (function buildBaseFix() {
    const F = $("basePalFix");
    for (const t of ["counter", "fridge", "appliance", "cabinet", "shoe", "wardrobe", "wardrobeSlide", "bookshelf", "lowcab", "bench"]) {
      const def = DEFAULTS[t]; if (!def) continue;
      const card = document.createElement("div"); card.className = "pal"; card.draggable = true; card.title = `加入固定設備（${def.w}×${def.d} cm）`;
      const ps = el("svg", {}); const pad = 14, m = Math.max(def.w, def.d) + pad * 2;
      ps.setAttribute("viewBox", `${-pad - (def.w < def.d ? (def.d - def.w) / 2 : 0)} ${-pad - (def.d < def.w ? (def.w - def.d) / 2 : 0)} ${m} ${m}`);
      DRAW[t](el("g", { class: "item" }, ps), def.w, def.d, def); card.appendChild(ps);
      const sp = document.createElement("span"); sp.innerHTML = `${def.name}<br><small>${def.w}×${def.d}</small>`; card.appendChild(sp);
      card.addEventListener("dragstart", e => { e.dataTransfer.setData("text/x-floorplan", JSON.stringify(def)); e.dataTransfer.effectAllowed = "copy"; });
      card.addEventListener("click", () => { const r = svg.getBoundingClientRect(); const p = toWorld(r.left + r.width / 2, r.top + r.height / 2); addItem(def, p.x, p.y); });
      F.appendChild(card);
    }
  })();
  $("bDone").onclick = () => setMode("design");
  $("btnBaseEdit").onclick = () => setMode(S.mode === "base" ? "design" : "base");
  $("gateDraw").onclick = () => {
    if (!applyGateBase({ name: "", walls: [] }, "我的新家")) return; setMode("base"); setTool("wall");
    toast("從空白開始：點擊畫牆，Esc 或雙擊結束一段");
  };
  svg.addEventListener("dblclick", () => { if (S.mode === "base" && S.btool === "wall") { S.wallDraw = null; S.hoverPt = null; renderSelection(); } });
}
