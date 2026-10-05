// 立面圖檢視：左側牆面清單與索引平面，右側可編輯的立面圖（拖曳物件改離地高度與沿牆位置、調整高度、註記工具、從元件庫直接放上牆）
import { t } from "../core/i18n.js";
import { S, state } from "../core/store.js";
import { NS, el, esc, toast } from "../core/dom.js";
import { commit } from "../core/history.js";
import { DEFAULTS } from "../shapes/library.js";
import { renderItems } from "../canvas/items.js";
import { addItem } from "../edit/actions.js";
import { renderProps } from "../ui/props.js";
import { EXT, onChange } from "../ext/registry.js";
import { itemElev, itemH } from "../ext/heights.js";
import { layerOf } from "../ext/plans.js";
import { openMatPicker } from "../materials/index.js";
import { download, safeName, stamp } from "../io/file.js";
import { drawElevation } from "./elevation.js";
import { NOTE_KINDS, drawNote, drawNotes, notesRef } from "./notes.js";
import { allFaces, faceInfo, faceTitle } from "./walls.js";
import { elevationSheet } from "./sheet.js";
import { printSheets } from "./drawset.js";

const V = {
  host: null,
  cur: null, // { i, face }
  vb: null,
  tool: "select",
  doors: "closed",
  depth: 70,
  den: 30,
  noteSel: -1,
  drag: null,
  draft: null,
  res: null,
  faces: [],
};
export const elevState = V;
const $h = sel => V.host && V.host.querySelector(sel);

function pickDefault(faces) {
  const withStuff = faces.find(f => (f.F.ops || []).length && !f.ext) || faces.find(f => !f.ext) || faces[0];
  return withStuff ? { i: withStuff.i, face: withStuff.face } : null;
}
function curFace() {
  return V.faces.find(f => V.cur && f.i === V.cur.i && f.face === V.cur.face);
}

export function render() {
  if (!V.host) return;
  if (!S.BASE) {
    V.host.innerHTML = `<div class="sc-empty">${t("尚未匯入底圖。")}</div>`;
    return;
  }
  if (!$h(".ev-wrap")) build();
  V.faces = allFaces();
  if (!curFace()) {
    V.cur = pickDefault(V.faces);
    V.vb = null;
  }
  renderList();
  renderKey();
  renderDrawing();
}
function build() {
  const tools = [["select", "選取"], ...NOTE_KINDS.map(k => [k[0], k[1]])];
  V.host.innerHTML = `<div class="ev-wrap">
    <aside class="ev-side"><svg class="ev-key" id="evKey"></svg><div class="ev-list" id="evList"></div></aside>
    <section class="ev-main">
      <div class="ev-bar">
        <span class="seg">${tools.map(([k, n]) => `<button class="tb" data-evtool="${k}" title="${t(n)}">${t(n)}</button>`).join("")}</span>
        <span class="tsep"></span>
        <button class="tb" id="evDoors" title="${t("櫃門：切換立面圖顯示櫃門關閉或打開（顯示內部層板抽屜）")}"></button>
        <label class="ev-lbl">${t("納入深度")}<input id="evDepth" type="number" min="10" max="400" step="10" value="${V.depth}"> cm</label>
        <label class="ev-lbl">${t("比例")}<select id="evScale">${[20, 30, 50].map(d => `<option value="${d}" ${d === V.den ? "selected" : ""}>1:${d}</option>`).join("")}</select></label>
        <span class="grow"></span>
        <button class="tb" id="evFit">${t("全圖")}</button>
        <button class="tb" id="evPrint">${t("列印此張")}</button>
        <button class="tb" id="evSVG">${t("下載 SVG")}</button>
      </div>
      <div class="ev-canvas"><svg id="evSvg" xmlns="${NS}"><defs></defs><g id="evDraw"></g><g id="evUI"></g></svg>
      <div class="ev-hint" id="evHint"></div></div>
    </section></div>`;
  V.host.querySelectorAll("[data-evtool]").forEach(b => (b.onclick = () => setEvTool(b.dataset.evtool)));
  $h("#evDoors").onclick = () => {
    V.doors = V.doors === "open" ? "closed" : "open";
    renderDrawing();
  };
  $h("#evDepth").onchange = e => {
    V.depth = Math.max(10, +e.target.value || 70);
    renderDrawing();
  };
  $h("#evScale").onchange = e => {
    V.den = +e.target.value;
    V.vb = null;
    renderDrawing();
  };
  $h("#evFit").onclick = () => {
    V.vb = null;
    renderDrawing();
  };
  $h("#evPrint").onclick = () => {
    const f = curFace();
    if (f) printSheets([elevationSheet(f, "E-01", { den: V.den, doors: V.doors, depth: V.depth })], faceTitle(f));
  };
  $h("#evSVG").onclick = () => {
    const f = curFace();
    if (!f) return;
    const s = new XMLSerializer().serializeToString(
      elevationSheet(f, "E-01", { den: V.den, doors: V.doors, depth: V.depth }),
    );
    download(`${safeName()}-${faceTitle(f)}-${stamp()}.svg`, new Blob([s], { type: "image/svg+xml" }));
  };
  bindCanvas();
  setEvTool(V.tool);
}
export function setEvTool(k) {
  V.tool = k;
  V.draft = null;
  if (!V.host) return;
  V.host.querySelectorAll("[data-evtool]").forEach(b => b.classList.toggle("on", b.dataset.evtool === k));
  const hints = {
    select: t(
      "點選物件或註記；拖曳改變位置與離地高度，拖上下把手調整高度；Delete 刪除註記。滾輪縮放、拖曳空白處平移。",
    ),
    dim: t("點兩點（或拖曳）加尺寸標註。"),
    text: t("點引出位置，再點文字位置，輸入文字。"),
    mat: t("點要標示的面，再點文字位置，選擇材質。"),
    rect: t("拖曳畫矩形（造型、線板、腰帶…）。"),
    line: t("點兩點畫線條。"),
    mark: t("點一下標示開孔或插座位置（含高度）。"),
  };
  const hint = $h("#evHint");
  if (hint) hint.textContent = hints[k] || "";
  const svg = $h("#evSvg");
  if (svg) svg.style.cursor = k === "select" ? "" : "crosshair";
  renderUI();
}

function renderList() {
  const box = $h("#evList");
  const groups = new Map();
  for (const f of V.faces) (groups.get(f.room) || groups.set(f.room, []).get(f.room)).push(f);
  const nItems = f => {
    try {
      return drawCount(f);
    } catch (e) {
      return 0;
    }
  };
  box.innerHTML = [...groups]
    .sort((a, b) => (a[1][0].ext ? 1 : 0) - (b[1][0].ext ? 1 : 0))
    .map(
      ([room, fs]) =>
        `<div class="ev-grp"><b>${esc(room)}</b>${fs
          .map(f => {
            const on = V.cur && f.i === V.cur.i && f.face === V.cur.face;
            const ops = (f.F.ops || []).length,
              n = nItems(f);
            return `<div class="ev-face${on ? " on" : ""}" data-k="${f.i}:${f.face}"><span class="ev-letter">${f.letter}</span><span>${t("牆 {i}", { i: f.i + 1 })}・${Math.round(f.F.len)} cm</span><small class="muted">${ops ? t("{n} 開口", { n: ops }) : ""}${ops && n ? "・" : ""}${n ? t("{n} 物件", { n }) : ""}</small></div>`;
          })
          .join("")}</div>`,
    )
    .join("");
  box.querySelectorAll(".ev-face").forEach(d => (d.onclick = () => selectFace(d.dataset.k)));
}
function drawCount(f) {
  return state.items.filter(it => {
    if (["text", "dimension"].includes(it.type) || layerOf(it) === "floor") return false;
    const cx = it.x + it.w / 2,
      cy = it.y + it.d / 2;
    const dx = cx - f.F.o.x,
      dy = cy - f.F.o.y;
    const s = dx * f.F.r.x + dy * f.F.r.y,
      dn = dx * f.F.n.x + dy * f.F.n.y - f.F.thk / 2;
    return s > 0 && s < f.F.len && dn > -2 && dn < V.depth + Math.max(it.w, it.d) / 2;
  }).length;
}
function selectFace(k) {
  const [i, face] = k.split(":").map(Number);
  V.cur = { i, face };
  V.vb = null;
  V.noteSel = -1;
  V.draft = null;
  renderList();
  renderKey();
  renderDrawing();
}

function renderKey() {
  const svg = $h("#evKey");
  const b = S.BASE.bounds,
    pad = 70;
  svg.setAttribute("viewBox", `${b.x - pad} ${b.y - pad} ${b.w + pad * 2} ${b.h + pad * 2}`);
  svg.innerHTML = "";
  for (const r of S.BASE.rooms || []) {
    const e = el("text", { x: r.x, y: r.y, class: "ev-key-room", "text-anchor": "middle" }, svg);
    e.textContent = r.n;
  }
  S.BASE.walls.forEach(w =>
    el("line", { x1: w[0], y1: w[1], x2: w[2], y2: w[3], class: "ev-key-wall", "stroke-width": w[4] || 12 }, svg),
  );
  const cf = curFace();
  for (const f of V.faces) {
    const F = f.F,
      off = F.thk / 2 + 14;
    const on = cf && f.i === cf.i && f.face === cf.face;
    el(
      "line",
      {
        x1: F.x1 + F.n.x * off + F.u.x * 10,
        y1: F.y1 + F.n.y * off + F.u.y * 10,
        x2: F.x2 + F.n.x * off - F.u.x * 10,
        y2: F.y2 + F.n.y * off - F.u.y * 10,
        class: "ev-key-face" + (on ? " on" : ""),
        "data-k": `${f.i}:${f.face}`,
      },
      svg,
    );
  }
  // 立面索引符號：目前房間的各面
  if (cf)
    for (const f of V.faces.filter(x => x.room === cf.room)) {
      const F = f.F,
        on = f.i === cf.i && f.face === cf.face,
        mx = (F.x1 + F.x2) / 2 + F.n.x * (F.thk / 2 + 55),
        my = (F.y1 + F.y2) / 2 + F.n.y * (F.thk / 2 + 55),
        r = 20;
      const g = el("g", { class: "ev-key-idx" + (on ? " on" : ""), "data-k": `${f.i}:${f.face}` }, svg);
      const tip = { x: mx - F.n.x * (r + 16), y: my - F.n.y * (r + 16) },
        side = { x: -F.n.y * r, y: F.n.x * r };
      el("path", { d: `M${tip.x} ${tip.y} L${mx + side.x} ${my + side.y} L${mx - side.x} ${my - side.y} Z` }, g);
      el("circle", { cx: mx, cy: my, r }, g);
      const tx = el("text", { x: mx, y: my + 8, "text-anchor": "middle" }, g);
      tx.textContent = f.letter;
    }
  svg.querySelectorAll("[data-k]").forEach(n => (n.onclick = () => selectFace(n.getAttribute("data-k"))));
}

export function renderDrawing() {
  const svg = $h("#evSvg");
  if (!svg || !V.cur) return;
  const g = svg.querySelector("#evDraw");
  g.innerHTML = "";
  const f = curFace();
  if (!f) return;
  V.res = drawElevation(g, f.i, f.face, { den: V.den, root: svg, doors: V.doors, depth: V.depth });
  const fs = 0.3 * V.den;
  drawNotes(g, f.i, f.face, fs, svg, V.noteSel);
  const bb = V.res.bbox;
  const tt = el("text", { x: bb.x + fs, y: bb.y + bb.h + fs * 0.2, class: "ev-title", "font-size": fs * 1.2 }, g);
  tt.textContent = `${faceTitle(f)}\u30001:${V.den}`;
  if (!V.vb) {
    const p = fs * 2;
    V.vb = { x: bb.x - p, y: bb.y - p, w: bb.w + p * 2, h: bb.h + p * 3 };
  }
  applyVB();
  const db = $h("#evDoors");
  if (db) {
    db.textContent = V.doors === "open" ? t("櫃門：開") : t("櫃門：關");
    db.classList.toggle("on", V.doors === "open");
  }
  renderUI();
}
function applyVB() {
  const svg = $h("#evSvg");
  if (svg && V.vb) svg.setAttribute("viewBox", `${V.vb.x} ${V.vb.y} ${V.vb.w} ${V.vb.h}`);
}
function selEntry() {
  return V.res && V.res.items.find(x => x.it.id === state.sel);
}
function renderUI() {
  const svg = $h("#evSvg");
  if (!svg) return;
  const ui = svg.querySelector("#evUI");
  ui.innerHTML = "";
  const fs = 0.3 * V.den;
  const x = selEntry();
  if (x && layerOf(x.it) !== "ceiling") {
    const h = itemH(x.it),
      e0 = itemElev(x.it);
    el("rect", { x: x.smin - 2, y: -(e0 + h) - 2, width: x.smax - x.smin + 4, height: h + 4, class: "ev-selbox" }, ui);
    if (!x.it.locked) {
      const hs = fs * 0.7,
        cx = (x.smin + x.smax) / 2;
      el(
        "rect",
        { x: cx - hs / 2, y: -(e0 + h) - hs / 2, width: hs, height: hs, class: "ev-handle-ui", "data-h": "top" },
        ui,
      );
      el(
        "rect",
        { x: cx - hs / 2, y: -e0 - hs / 2, width: hs, height: hs, class: "ev-handle-ui", "data-h": "bot" },
        ui,
      );
      const lt = el("text", { x: x.smax + fs * 0.4, y: -e0 - fs * 0.3, class: "ev-uitext", "font-size": fs * 0.8 }, ui);
      lt.textContent = `${t("離地")} ${Math.round(e0)}・H ${Math.round(h)}`;
    }
  }
  if (V.draft && V.draft.pts.length) {
    const n = { kind: V.draft.kind, pts: V.draft.pts, text: "" };
    drawNote(ui, n, -1, fs, svg, true);
  }
}

function toLocal(e) {
  const svg = $h("#evSvg"),
    g = svg.querySelector("#evDraw");
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const p = pt.matrixTransform(g.getScreenCTM().inverse());
  return { u: Math.round(p.x), h: Math.round(-p.y), x: p.x, y: p.y };
}
function bindCanvas() {
  const svg = $h("#evSvg");
  svg.addEventListener("wheel", e => {
    e.preventDefault();
    const p = toLocal(e),
      k = e.deltaY > 0 ? 1.15 : 1 / 1.15;
    V.vb = { x: p.x - (p.x - V.vb.x) * k, y: p.y - (p.y - V.vb.y) * k, w: V.vb.w * k, h: V.vb.h * k };
    applyVB();
  });
  svg.addEventListener("pointerdown", e => {
    if (e.button === 2) return;
    const p = toLocal(e);
    svg.setPointerCapture(e.pointerId);
    if (e.button === 1 || (e.button === 0 && e.altKey)) return startPan(e);
    if (V.tool !== "select") return toolDown(p);
    const hd = e.target.closest("[data-h]"),
      sx = selEntry();
    if (hd && sx) {
      V.drag = { kind: hd.getAttribute("data-h"), p0: p, it: sx.it, oh: itemH(sx.it), oe: itemElev(sx.it) };
      return;
    }
    const og = e.target.closest(".ev-obj[data-id]");
    if (og) {
      const it = state.items.find(i => i.id === +og.getAttribute("data-id"));
      if (!it) return;
      V.noteSel = -1;
      selectItem(it.id);
      if (!it.locked)
        V.drag = { kind: "move", p0: p, it, ox: it.x, oy: it.y, oe: itemElev(it), hasElev: it.elev != null };
      return;
    }
    const ng = e.target.closest(".ev-note[data-note]");
    if (ng) {
      V.noteSel = +ng.getAttribute("data-note");
      selectItem(null);
      const f = curFace(),
        n = notesRef(f.i, f.face)[V.noteSel];
      if (n) V.drag = { kind: "note", p0: p, n, orig: JSON.parse(JSON.stringify(n.pts)) };
      renderDrawing();
      return;
    }
    if (V.noteSel >= 0 || state.sel != null) {
      V.noteSel = -1;
      selectItem(null);
      renderDrawing();
    }
    startPan(e);
  });
  svg.addEventListener("pointermove", e => {
    const d = V.drag;
    if (V.tool !== "select" && V.draft && !d) {
      const p = toLocal(e);
      if (V.draft.pts.length > 1) V.draft.pts[V.draft.pts.length - 1] = [p.u, p.h];
      renderUI();
      return;
    }
    if (!d) return;
    if (d.kind === "pan") {
      const sc = V.vb.w / svg.getBoundingClientRect().width;
      V.vb.x = d.vx - (e.clientX - d.sx) * sc;
      V.vb.y = d.vy - (e.clientY - d.sy) * sc;
      applyVB();
      return;
    }
    const p = toLocal(e),
      du = p.u - d.p0.u,
      dh = p.h - d.p0.h;
    const F = faceInfo(V.cur.i, V.cur.face);
    if (d.kind === "move") {
      d.it.x = Math.round((d.ox + du * F.r.x) * 10) / 10;
      d.it.y = Math.round((d.oy + du * F.r.y) * 10) / 10;
      const ne = Math.max(0, Math.round(d.oe + dh));
      if (d.hasElev || ne !== d.oe) d.it.elev = ne;
      d.moved = true;
    } else if (d.kind === "top") {
      d.it.h = Math.max(1, Math.round(d.oh + dh));
      d.moved = true;
    } else if (d.kind === "bot") {
      const ne = Math.max(0, Math.min(d.oe + d.oh - 1, Math.round(d.oe + dh)));
      d.it.elev = ne;
      d.it.h = d.oe + d.oh - ne;
      d.moved = true;
    } else if (d.kind === "note") {
      d.n.pts = d.orig.map(([u, h]) => [u + du, h + dh]);
      d.moved = true;
    }
    renderDrawing();
  });
  svg.addEventListener("pointerup", e => {
    const d = V.drag;
    V.drag = null;
    if (V.tool !== "select") return toolUp(toLocal(e));
    if (d && d.moved) {
      renderItems();
      commit();
      renderProps();
    }
  });
  // 從元件庫拖放到立面
  svg.addEventListener("dragover", e => {
    if ([...e.dataTransfer.types].includes("text/x-floorplan")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  });
  svg.addEventListener("drop", e => {
    const raw = e.dataTransfer.getData("text/x-floorplan");
    if (!raw) return;
    e.preventDefault();
    let def;
    try {
      def = JSON.parse(raw);
    } catch (err) {
      return;
    }
    const p = toLocal(e);
    placeOnWall(DEFAULTS[def.type] || def, p.u, p.h < 15 ? 0 : p.h);
  });
}
function startPan(e) {
  V.drag = { kind: "pan", sx: e.clientX, sy: e.clientY, vx: V.vb.x, vy: V.vb.y };
}
function selectItem(id) {
  state.sel = id;
  S.msel = [];
  renderItems();
  renderProps();
  renderUI();
}

// ── 註記工具 ──
function toolDown(p) {
  const kind = V.tool,
    nPts = (NOTE_KINDS.find(k => k[0] === kind) || [])[2] || 2;
  if (nPts === 1) {
    finishNote({ kind, pts: [[p.u, p.h]] });
    return;
  }
  if (!V.draft)
    V.draft = {
      kind,
      pts: [
        [p.u, p.h],
        [p.u, p.h],
      ],
      down: [p.u, p.h],
    };
  else {
    V.draft.pts[1] = [p.u, p.h];
    const d = V.draft;
    V.draft = null;
    finishNote(d);
  }
  renderUI();
}
function toolUp(p) {
  const d = V.draft;
  if (!d) return;
  if (Math.hypot(p.u - d.down[0], p.h - d.down[1]) > 3) {
    d.pts[1] = [p.u, p.h];
    V.draft = null;
    finishNote(d);
  }
}
async function finishNote(d) {
  const f = curFace();
  if (!f) return;
  const n = { kind: d.kind, pts: d.pts };
  if (d.kind === "text") {
    const s = prompt(t("註記文字"), "");
    if (!s) return renderUI();
    n.text = s;
  } else if (d.kind === "mat") {
    const id = await openMatPicker({ title: t("材質標示") });
    if (!id) return renderUI();
    n.mat = id;
  } else if (d.kind === "mark") {
    const s = prompt(t("標示名稱（例如：插座、開孔、出線口）"), t("插座"));
    if (s === null) return;
    n.text = s;
  }
  notesRef(f.i, f.face).push(n);
  V.noteSel = notesRef(f.i, f.face).length - 1;
  commit();
  renderDrawing();
}
export function deleteNote() {
  const f = curFace();
  if (!f || V.noteSel < 0) return false;
  const arr = notesRef(f.i, f.face);
  if (!arr[V.noteSel]) return false;
  arr.splice(V.noteSel, 1);
  V.noteSel = -1;
  commit();
  renderDrawing();
  return true;
}

/** 在目前牆面前方放一個元件：背靠牆、正面朝外，u＝中心沿牆位置，elev＝底部離地 */
export function placeOnWall(def, u, elev) {
  const f = curFace();
  if (!f || !def) return null;
  const F = f.F;
  if (u == null) u = F.len / 2;
  const rot = ((((Math.atan2(-F.n.x, F.n.y) * 180) / Math.PI) % 360) + 360) % 360;
  const cx = F.o.x + F.r.x * u + F.n.x * (F.thk / 2 + def.d / 2),
    cy = F.o.y + F.r.y * u + F.n.y * (F.thk / 2 + def.d / 2);
  const it = addItem(def, cx, cy);
  if (!it) return null;
  it.rot = Math.round(rot * 100) / 100;
  it.x = Math.round((cx - it.w / 2) * 10) / 10;
  it.y = Math.round((cy - it.d / 2) * 10) / 10;
  if (elev != null && Math.round(elev) !== Math.round(itemElev(it))) it.elev = Math.max(0, Math.round(elev));
  renderItems();
  commit();
  renderProps();
  render();
  toast(t("已放到「{wall}」：{name}", { wall: faceTitle(f), name: def.name }));
  return it;
}

export const elevView = {
  id: "elev",
  name: t("立面圖"),
  icon: "▥",
  mount(host) {
    V.host = host;
    host.innerHTML = "";
    render();
  },
  unmount() {
    V.host = null;
    V.drag = null;
    V.draft = null;
  },
  refresh: render,
};

let tmr = 0;
export function initElevView() {
  onChange(why => {
    if (!V.host || V.drag || why === "view" || why === "tool") return;
    clearTimeout(tmr);
    tmr = setTimeout(() => {
      if (why === "project" || why === "design" || why === "restore") V.vb = null;
      render();
    }, 60);
  });
  // 立面圖檢視時：點元件庫卡片 → 放到目前牆面（核心掛勾 EXT.paletteClick）
  EXT.paletteClick.push(def => {
    if (S.view !== "elev" || !V.host || S.mode === "base" || !curFace()) return false;
    placeOnWall(def, null, null);
    return true;
  });
  document.addEventListener(
    "keydown",
    e => {
      if (S.view !== "elev" || !V.host) return;
      const tag = (document.activeElement && document.activeElement.tagName) || "";
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;
      if ((e.key === "Delete" || e.key === "Backspace") && V.noteSel >= 0) {
        if (deleteNote()) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      } else if (e.key === "Escape" && (V.draft || V.tool !== "select")) {
        e.stopImmediatePropagation();
        setEvTool("select");
      }
    },
    true,
  );
}
