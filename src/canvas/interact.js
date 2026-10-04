// 畫布滑鼠互動：選取、拖曳、縮放、框選、右鍵
import { S, opt, state, view } from "../core/store.js";
import { KEY, svg, toast } from "../core/dom.js";
import { commit } from "../core/history.js";
import { itemBox, snapAxis, snapV, unionBox } from "../core/geometry.js";
import { applyView, toWorld } from "./view.js";
import { renderItems, renderSelection } from "./items.js";
import { cur, edgeTargets, selIds, selItems, setSel } from "./selection.js";
import { applyCalib } from "../tools/calibrate.js";
import { copySel, getClip, pasteClip } from "../edit/clipboard.js";
import { delSel, dupSel, flipSel, rotSel } from "../edit/actions.js";
import { alignSel } from "../edit/align.js";
import { basePointerDown, basePointerMove, basePointerUp } from "../base-edit/base-edit.js";
import { renderProps } from "../ui/props.js";
import { showCtx } from "../ui/context-menu.js";

export function startPan(e) { S.drag = { kind: "pan", sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y }; svg.classList.add("panning"); svg.setPointerCapture(e.pointerId); }

export function init() {
  svg.addEventListener("pointerdown", e => {
    if (S.calib && e.button === 0) { S.calib.pts.push(toWorld(e.clientX, e.clientY)); renderSelection(); if (S.calib.pts.length === 2) setTimeout(applyCalib, 30); return; }
    if (e.button === 2) return;   // 右鍵：開選單（contextmenu）
    if (e.button === 1) { startPan(e); return; }
    if (S.measureMode) { let p = toWorld(e.clientX, e.clientY); if (opt.snap) p = { x: snapV(p.x), y: snapV(p.y) }; S.measure = { a: p, b: p }; S.drag = { kind: "measure" }; svg.setPointerCapture(e.pointerId); renderSelection(); return; }
    if (S.mode === "base") { basePointerDown(e); return; }
    const h = e.target.getAttribute && e.target.getAttribute("data-h");
    const p = toWorld(e.clientX, e.clientY);
    if (h && cur()) {
      const it = cur(); S.drag = { kind: h, id: it.id, start: p, orig: { ...it } }; svg.setPointerCapture(e.pointerId); e.preventDefault(); return;
    }
    const ig = e.target.closest && e.target.closest("#itemLayer .item[data-id]");
    if (ig) {
      const id = +ig.getAttribute("data-id"), ids = selIds();
      if (e.shiftKey || e.metaKey || e.ctrlKey) { setSel(ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]); e.preventDefault(); return; }
      if (ids.includes(id)) { state.sel = id; if (ids.length > 1) S.msel = ids; } else { S.msel = []; state.sel = id; }
      renderSelection(); renderProps();
      const movers = selItems().filter(i => !i.locked);
      if (movers.length) { S.drag = { kind: "mmove", start: p, origs: movers.map(i => ({ id: i.id, x: i.x, y: i.y })), b0: unionBox(movers), moved: false }; svg.setPointerCapture(e.pointerId); }
      e.preventDefault(); return;
    }
    if (e.shiftKey) { S.boxSel = { a: p, b: p, add: selIds() }; S.drag = { kind: "box" }; svg.setPointerCapture(e.pointerId); return; }
    S.msel = []; state.sel = null; renderSelection(); renderProps(); startPan(e);
  });
  svg.addEventListener("pointerleave", () => { S.lastMouse = null; });
  svg.addEventListener("contextmenu", e => {
    e.preventDefault(); if (S.mode === "base" || !S.BASE || S.measureMode) return;
    const p = toWorld(e.clientX, e.clientY), ig = e.target.closest && e.target.closest("#itemLayer .item[data-id]");
    if (ig) {
      const rid = +ig.getAttribute("data-id"); if (!selIds().includes(rid)) { S.msel = []; } state.sel = rid; if (S.msel.length > 1 && !S.msel.includes(rid)) S.msel = []; renderSelection(); renderProps(); const it = cur();
      const many = selIds().length > 1;
      showCtx(e.clientX, e.clientY, [
        ...(many ? [{ t: `已選取 ${selIds().length} 個`, off: true }, "-", { t: "靠左對齊", f: () => alignSel("left") }, { t: "靠上對齊", f: () => alignSel("top") }, { t: "水平貼合", f: () => alignSel("packh") }, { t: "垂直貼合", f: () => alignSel("packv") }, "-"] : []),
        { t: "複製", k: KEY + "C", f: () => copySel(false) }, { t: "剪下", k: KEY + "X", f: () => copySel(true), off: !many && it.locked },
        { t: "貼上", k: KEY + "V", f: () => pasteClip(p), off: !getClip() }, { t: "再製", k: KEY + "D", f: dupSel }, "-",
        { t: "旋轉 90°", k: "R", f: () => rotSel(90), off: it.locked }, { t: "左右鏡像", k: "F", f: flipSel, off: it.locked },
        { t: "移到上層", f: () => { it.z = Math.max(...state.items.map(i => i.z || 0)) + 1; renderItems(); commit(); } },
        { t: "移到下層", f: () => { it.z = Math.min(...state.items.map(i => i.z || 0)) - 1; renderItems(); commit(); } },
        { t: it.locked ? "解除鎖定" : "鎖定位置", f: () => { it.locked = !it.locked; renderItems(); renderProps(); commit(); } }, "-",
        { t: "刪除", k: "Delete", f: delSel, danger: true, off: it.locked }]);
    } else {
      state.sel = null; renderSelection(); renderProps();
      showCtx(e.clientX, e.clientY, [{ t: "貼上到這裡", k: KEY + "V", f: () => pasteClip(p), off: !getClip() }]);
    }
  });
  svg.addEventListener("pointermove", e => {
    S.lastMouse = toWorld(e.clientX, e.clientY);
    if (S.mode === "base" && basePointerMove(e)) return;
    if (!S.drag) return;
    if (S.drag.kind === "pan") { view.x = S.drag.vx + e.clientX - S.drag.sx; view.y = S.drag.vy + e.clientY - S.drag.sy; applyView(); renderSelection(); return; }
    if (S.drag.kind === "measure") { let p = toWorld(e.clientX, e.clientY); if (opt.snap) p = { x: snapV(p.x), y: snapV(p.y) };
      if (e.shiftKey) { if (Math.abs(p.x - S.measure.a.x) > Math.abs(p.y - S.measure.a.y)) p.y = S.measure.a.y; else p.x = S.measure.a.x; }
      S.measure.b = p; renderSelection(); return; }
    if (S.drag.kind === "box") { S.boxSel.b = toWorld(e.clientX, e.clientY); renderSelection(); return; }
    if (S.drag.kind === "mmove") {
      const p = toWorld(e.clientX, e.clientY), b0 = S.drag.b0, tol = 8 / view.s;
      let dx = p.x - S.drag.start.x, dy = p.y - S.drag.start.y; S.snapGuides = [];
      if (Math.abs(dx) + Math.abs(dy) > 0.5) S.drag.moved = true;
      const ex = opt.edge && !e.altKey ? snapAxis([b0.x1 + dx, b0.x2 + dx, (b0.x1 + b0.x2) / 2 + dx], (S.drag.tg = S.drag.tg || edgeTargets(S.drag.origs.map(o => o.id))).xs, tol) : null;
      const ey = opt.edge && !e.altKey ? snapAxis([b0.y1 + dy, b0.y2 + dy, (b0.y1 + b0.y2) / 2 + dy], S.drag.tg.ys, tol) : null;
      if (ex) { dx += ex.d; S.snapGuides.push({ x: ex.at }); } else dx = snapV(b0.x1 + dx) - b0.x1;
      if (ey) { dy += ey.d; S.snapGuides.push({ y: ey.at }); } else dy = snapV(b0.y1 + dy) - b0.y1;
      for (const o of S.drag.origs) { const it = state.items.find(i => i.id === o.id); if (it) { it.x = Math.round((o.x + dx) * 10) / 10; it.y = Math.round((o.y + dy) * 10) / 10; } }
      renderItems(); renderProps(true); return;
    }
    const it = state.items.find(i => i.id === S.drag.id); if (!it) return;
    const p = toWorld(e.clientX, e.clientY), o = S.drag.orig;
    if (S.drag.kind === "move") { it.x = snapV(o.x + p.x - S.drag.start.x); it.y = snapV(o.y + p.y - S.drag.start.y); }
    else if (S.drag.kind === "rot") {
      const cx = o.x + o.w / 2, cy = o.y + o.d / 2; let a = Math.atan2(p.y - cy, p.x - cx) * 180 / Math.PI + 90;
      a = e.shiftKey ? Math.round(a) : Math.round(a / 15) * 15; it.rot = ((a % 360) + 360) % 360;
    } else {
      // 轉到物件本地座標系計算拉伸
      const a = o.rot * Math.PI / 180, dx = p.x - S.drag.start.x, dy = p.y - S.drag.start.y;
      const lx = dx * Math.cos(a) + dy * Math.sin(a), ly = -dx * Math.sin(a) + dy * Math.cos(a);
      let w = o.w, d = o.d, sx = 0, sy = 0;
      if (S.drag.kind.includes("e")) w = Math.max(5, snapV(o.w + lx));
      if (S.drag.kind === "w") { w = Math.max(5, snapV(o.w - lx)); sx = -(w - o.w); }
      if (S.drag.kind.includes("s")) d = Math.max(3, snapV(o.d + ly));
      if (S.drag.kind === "n") { d = Math.max(3, snapV(o.d - ly)); sy = -(d - o.d); }
      // 保持對邊固定：計算本地左上角在世界座標的位移
      const ocx = o.x + o.w / 2, ocy = o.y + o.d / 2;
      const tl = [ocx + (-o.w / 2) * Math.cos(a) - (-o.d / 2) * Math.sin(a), ocy + (-o.w / 2) * Math.sin(a) + (-o.d / 2) * Math.cos(a)];
      const ntl = [tl[0] + sx * Math.cos(a) - sy * Math.sin(a), tl[1] + sx * Math.sin(a) + sy * Math.cos(a)];
      const ncx = ntl[0] + (w / 2) * Math.cos(a) - (d / 2) * Math.sin(a), ncy = ntl[1] + (w / 2) * Math.sin(a) + (d / 2) * Math.cos(a);
      it.w = w; it.d = d; it.x = Math.round((ncx - w / 2) * 10) / 10; it.y = Math.round((ncy - d / 2) * 10) / 10;
    }
    renderItems(); renderProps(true);
  });
  svg.addEventListener("pointerup", e => {
    if (S.mode === "base" && basePointerUp(e)) return;
    if (!S.drag) return; svg.classList.remove("panning");
    if (S.drag.kind === "box") {
      const { a, b, add } = S.boxSel, r = { x1: Math.min(a.x, b.x), y1: Math.min(a.y, b.y), x2: Math.max(a.x, b.x), y2: Math.max(a.y, b.y) };
      const hit = state.items.filter(i => { const q = itemBox(i); return q.x1 < r.x2 && q.x2 > r.x1 && q.y1 < r.y2 && q.y2 > r.y1; }).map(i => i.id);
      S.boxSel = null; S.drag = null; setSel([...new Set([...add, ...hit])]); if (hit.length) toast(`已選取 ${selIds().length} 個物件`); return;
    }
    if (S.drag.kind === "mmove") { S.snapGuides = []; const moved = S.drag.moved; S.drag = null; renderSelection(); if (moved) commit(); return; }
    if (S.drag.kind !== "pan" && S.drag.kind !== "measure") { const it = state.items.find(i => i.id === S.drag.id); if (it && JSON.stringify(it) !== JSON.stringify(S.drag.orig)) commit(); }
    S.drag = null;
  });
}
