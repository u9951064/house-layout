// MCP 工具在網頁端的實作：由 scripts/mcp-server.mjs 透過 WebSocket 轉送過來
import { S, state } from "../core/store.js";
import { commit, redo, undo } from "../core/history.js";
import { DEFAULTS, LIB } from "../shapes/library.js";
import { computeBounds, drawBase, drawGrid } from "../canvas/base-render.js";
import { renderItems } from "../canvas/items.js";
import { fit } from "../canvas/view.js";
import { setSel } from "../canvas/selection.js";
import { addItem } from "../edit/actions.js";
import { renderProps } from "../ui/props.js";
import { exportSVGString } from "../io/export.js";
import { curDesign, syncDesign, uid } from "../project/project.js";
import { switchDesign } from "../project/sheets.js";
import { itemElev, itemH, spec, SPEC_DEFAULTS } from "../ext/heights.js";
import { layerOf } from "../ext/plans.js";
import { setPlan, setView } from "../ext/views.js";
import { EXT } from "../ext/registry.js";
import { allMats } from "../materials/index.js";

const r1 = v => Math.round(v * 10) / 10;
const CORE_KEYS = new Set(["id", "type", "label", "x", "y", "w", "d", "rot", "z", "flip", "h", "elev", "locked"]);
const isObj = v => v && typeof v === "object" && !Array.isArray(v);
function deepMerge(dst, src) {
  for (const k in src) {
    if (isObj(src[k]) && isObj(dst[k])) deepMerge(dst[k], src[k]);
    else if (src[k] === null) delete dst[k];
    else dst[k] = structuredClone(src[k]);
  }
  return dst;
}
function needBase() {
  if (!S.BASE) throw new Error("目前沒有專案底圖：請使用者先在網頁匯入底圖或開啟範例專案。");
}
function done() {
  renderItems();
  renderProps();
  commit();
}
const findItem = id => {
  const it = state.items.find(i => i.id === id);
  if (!it) throw new Error(`找不到物件 id ${id}`);
  return it;
};

// —— 讀取 ——
function wallInfo(w, i) {
  const [x1, y1, x2, y2, thk] = w,
    dx = x2 - x1,
    dy = y2 - y1,
    len = Math.hypot(dx, dy) || 1;
  const n = [-dy / len, dx / len];
  const roomNear = face => {
    const mx = (x1 + x2) / 2 + n[0] * face * (thk / 2 + 40),
      my = (y1 + y2) / 2 + n[1] * face * (thk / 2 + 40);
    let best = null,
      bd = Infinity;
    for (const r of S.BASE.rooms || []) {
      const dd = Math.hypot(r.x - mx, r.y - my);
      if (dd < bd) [best, bd] = [r.n, dd];
    }
    return best;
  };
  const side = face => {
    const vx = n[0] * face,
      vy = n[1] * face;
    return Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? "+x（右側）" : "-x（左側）") : vy > 0 ? "+y（下方）" : "-y（上方）";
  };
  const sp = spec();
  return {
    index: i,
    x1,
    y1,
    x2,
    y2,
    thk,
    len: r1(len),
    dir: Math.abs(dy) < 0.01 ? "horizontal" : Math.abs(dx) < 0.01 ? "vertical" : "diagonal",
    openings: (w[5] || []).map((op, j) => ({ index: j, a: op[0], b: op[1], kind: op[2], opts: op[3] || {} })),
    faces: Object.fromEntries(
      [1, -1].map(f => [f, { side: side(f), room: roomNear(f), material: (sp.wallFin || {})[`${i}:${f}`] || null }]),
    ),
  };
}
function itemInfo(it) {
  const def = DEFAULTS[it.type] || {};
  const o = {
    id: it.id,
    type: it.type,
    name: def.name || it.type,
    layer: layerOf(it),
    label: it.label || "",
    x: r1(it.x),
    y: r1(it.y),
    w: r1(it.w),
    d: r1(it.d),
    rot: it.rot || 0,
    h: r1(itemH(it)),
    elev: r1(itemElev(it)),
  };
  if (it.flip) o.flip = true;
  if (it.locked) o.locked = true;
  const props = {};
  for (const k in it) if (!CORE_KEYS.has(k)) props[k] = it[k];
  if (Object.keys(props).length) o.props = props;
  return o;
}
export function get_state({ include_items = true, include_base = true } = {}) {
  needBase();
  const B = S.BASE;
  const out = {
    project: S.PROJ ? S.PROJ.name : B.name,
    designs: S.PROJ ? S.PROJ.designs.map((d, k) => ({ index: k, name: d.name, current: k === S.PROJ.cur })) : [],
    view: S.view,
    plan: S.plan,
    selected: state.sel,
    spec: spec(),
    bounds: B.bounds && { x: B.bounds.x, y: B.bounds.y, w: B.bounds.w, h: B.bounds.h },
    counts: { walls: (B.walls || []).length, items: state.items.length },
  };
  if (include_base)
    out.base = {
      name: B.name,
      walls: (B.walls || []).map(wallInfo),
      rooms: B.rooms || [],
      columns: B.columns || [],
      canopies: B.canopies || [],
      outOfScope: B.outOfScope || [],
      fixtures: B.fixtures || [],
      hasImage: !!B.image,
    };
  if (include_items) out.items = state.items.map(itemInfo);
  return out;
}
export function get_catalog({ layer, query } = {}) {
  const q = (query || "").toLowerCase();
  const out = [];
  for (const cat of LIB)
    for (const def of cat.items) {
      const lay = def.layer || cat.layer || "furniture";
      if (layer && lay !== layer) continue;
      if (q && !(def.name + " " + def.type + " " + cat.cat).toLowerCase().includes(q)) continue;
      const extra = {};
      for (const k in def)
        if (!["type", "name", "w", "d", "layer", "init", "tool"].includes(k) && typeof def[k] !== "function")
          extra[k] = def[k];
      out.push({ type: def.type, name: def.name, category: cat.cat, layer: lay, w: def.w, d: def.d, ...extra });
    }
  return out;
}
export function list_materials({ category, query } = {}) {
  const q = (query || "").toLowerCase();
  return allMats(category ? [category] : undefined)
    .filter(m => !q || (m.id + " " + m.name + " " + (m.code || "")).toLowerCase().includes(q))
    .map(m => ({ id: m.id, name: m.name, category: m.cat, color: m.color, code: m.code || undefined }));
}

// —— 開啟專案 ——
export async function open_project({ data, name }) {
  if (!data || typeof data !== "object") throw new Error("檔案內容不正確");
  const { validBase } = await import("../model/base.js");
  const { newProject, parseDesigns } = await import("../project/project.js");
  const { setMode } = await import("../base-edit/base-edit.js");
  if (S.mode === "base") setMode("design");
  const isProject = Array.isArray(data.designs) || Array.isArray(data.items);
  const base = isProject ? data.base : data;
  if (!validBase(base)) throw new Error("底圖格式不正確（需要 walls 牆面資料或 image 圖片）");
  const nm = name || data.name || base.name || "專案";
  const designs = isProject ? parseDesigns(data) : undefined;
  newProject(nm, base, designs, data.cur || 0, data.ghost || null, Array.isArray(data.materials) ? data.materials : []);
  return {
    project: S.PROJ.name,
    designs: S.PROJ.designs.map((d, k) => ({ index: k, name: d.name, items: d.items.length })),
    walls: S.BASE.walls.length,
  };
}

// —— 自訂材質 ——
export function add_material(a) {
  needBase();
  if (!S.PROJ) throw new Error("沒有專案");
  const tw = +a.tile_w || 0,
    th = +a.tile_h || tw;
  const m = {
    id: a.id && String(a.id).startsWith("custom-") ? a.id : "custom-" + uid(),
    name: a.name,
    cat: a.category,
    color: a.color,
    pattern: a.pattern || (tw ? "tile" : "plain"),
    size: +a.size || (tw ? Math.max(tw, th) * 2 : 100),
    rough: a.rough ?? 0.6,
    metal: a.metal ?? 0,
    opacity: a.opacity ?? 1,
    code: a.code || (tw ? `${tw}×${th} cm` : ""),
  };
  if (tw) Object.assign(m, { tw, th });
  if (a.grout) m.grout = a.grout;
  const list = (S.PROJ.materials || []).slice(),
    i = list.findIndex(x => x.id === m.id);
  if (i >= 0) list[i] = m;
  else list.push(m);
  S.PROJ.materials = list;
  done();
  return m;
}

// —— 物件 ——
function applyFields(it, f) {
  for (const k of ["w", "d", "rot", "flip", "label", "h", "elev", "locked"]) if (f[k] !== undefined) it[k] = f[k];
  if (it.rot != null) it.rot = ((it.rot % 360) + 360) % 360;
  if (f.props) deepMerge(it, f.props);
}
export function add_items({ items }) {
  needBase();
  if (S.mode === "base") throw new Error("網頁目前在「底圖編輯」模式，請使用者先按「完成編輯」。");
  const ids = [];
  for (const f of items) {
    const def = DEFAULTS[f.type];
    if (!def) throw new Error(`沒有這種元件：${f.type}（請用 get_catalog 查詢）`);
    const w = f.w ?? def.w,
      d = f.d ?? def.d;
    const cx = f.center ? f.x : f.x + w / 2,
      cy = f.center ? f.y : f.y + d / 2;
    const it = addItem(def, cx, cy);
    if (!it) throw new Error("無法新增物件");
    applyFields(it, { ...f, w, d });
    it.x = cx - it.w / 2;
    it.y = cy - it.d / 2;
    ids.push(it.id);
  }
  setSel(ids);
  done();
  return { added: ids, items: ids.map(id => itemInfo(findItem(id))) };
}
export function update_items({ items }) {
  needBase();
  for (const f of items) {
    const it = findItem(f.id);
    if (f.x !== undefined) it.x = f.x;
    if (f.y !== undefined) it.y = f.y;
    applyFields(it, f);
  }
  setSel(items.map(f => f.id));
  done();
  return { updated: items.map(f => itemInfo(findItem(f.id))) };
}
export function delete_items({ ids }) {
  needBase();
  const del = new Set(ids);
  const before = state.items.length;
  state.items = state.items.filter(i => !del.has(i.id));
  state.sel = null;
  S.msel = [];
  done();
  return { deleted: before - state.items.length };
}
export async function draw_run({ type, points, props }) {
  needBase();
  const def = DEFAULTS[type];
  if (!def) throw new Error(`沒有這種元件：${type}`);
  const it = addItem(def, points[0][0], points[0][1]);
  const mep = await import("../mep/index.js");
  if (typeof mep.fitPts !== "function") throw new Error("水電模組不支援折線");
  mep.fitPts(it, points);
  if (props) deepMerge(it, props);
  setSel([it.id]);
  done();
  return itemInfo(it);
}

// —— 規格、牆面、底圖 ——
export function set_spec({ patch }) {
  needBase();
  const bad = Object.keys(patch).filter(
    k => !(k in SPEC_DEFAULTS) && !["elevNotes", "designer", "revisions"].includes(k),
  );
  state.spec = deepMerge(state.spec || {}, patch);
  if (S.PROJ) curDesign().spec = state.spec;
  done();
  return { spec: spec(), unknownKeys: bad.length ? bad : undefined };
}
export function set_wall_finish({ wall, face, material }) {
  needBase();
  if (!S.BASE.walls[wall]) throw new Error(`沒有第 ${wall} 面牆`);
  if (material && !allMats().some(m => m.id === material))
    throw new Error(`沒有這個材質：${material}（請用 list_materials）`);
  state.spec = state.spec || {};
  const wf = (state.spec.wallFin = { ...(state.spec.wallFin || {}) });
  if (material) wf[`${wall}:${face}`] = material;
  else delete wf[`${wall}:${face}`];
  if (S.PROJ) curDesign().spec = state.spec;
  done();
  return { wallFin: wf };
}
export async function edit_base(a) {
  needBase();
  if (a.replace_base) {
    const { validBase } = await import("../model/base.js");
    if (!validBase(a.replace_base)) throw new Error("底圖格式不正確（需要 walls 牆面資料或 image 圖片）");
    const { app, version, unit, savedAt, bounds, ...rest } = a.replace_base;
    S.BASE = { walls: [], ...structuredClone(rest), name: S.BASE.name };
    S.bsel = null;
  }
  const B = S.BASE;
  B.walls = B.walls || [];
  const W = i => {
    if (!B.walls[i]) throw new Error(`沒有第 ${i} 面牆`);
    return B.walls[i];
  };
  for (const u of a.update_walls || []) {
    const w = W(u.index);
    [
      ["x1", 0],
      ["y1", 1],
      ["x2", 2],
      ["y2", 3],
      ["thk", 4],
    ].forEach(([k, j]) => u[k] !== undefined && (w[j] = u[k]));
  }
  for (const o of a.delete_openings || []) {
    const w = W(o.wall);
    if (!w[5] || !w[5][o.index]) throw new Error(`第 ${o.wall} 面牆沒有開口 ${o.index}`);
    w[5][o.index] = null;
  }
  for (const w of B.walls) if (w[5]) w[5] = w[5].filter(Boolean);
  for (const o of a.update_openings || []) {
    const w = W(o.wall),
      op = (w[5] || [])[o.index];
    if (!op) throw new Error(`第 ${o.wall} 面牆沒有開口 ${o.index}`);
    if (o.a !== undefined) op[0] = o.a;
    if (o.b !== undefined) op[1] = o.b;
    if (o.kind) op[2] = o.kind;
    if (o.opts) op[3] = deepMerge(op[3] || {}, o.opts);
  }
  for (const o of a.add_openings || []) {
    const w = W(o.wall);
    if (Math.abs(w[1] - w[3]) > 0.01 && Math.abs(w[0] - w[2]) > 0.01) throw new Error("斜牆不支援門窗開口");
    const op = [Math.min(o.a, o.b), Math.max(o.a, o.b), o.kind];
    if (o.opts || o.kind === "door")
      op.push({ ...(o.kind === "door" ? { hinge: "a", side: 1 } : {}), ...(o.opts || {}) });
    (w[5] = w[5] || []).push(op);
  }
  for (const w of B.walls) if (w[5]) w[5].sort((p, q) => p[0] - q[0]);
  if (a.delete_walls && a.delete_walls.length) {
    const del = new Set(a.delete_walls);
    B.walls = B.walls.filter((w, i) => !del.has(i));
  }
  for (const w of a.add_walls || []) B.walls.push([...w, []]);
  if (a.set_rooms) B.rooms = a.set_rooms.map(r => ({ n: r.n, s: r.s || "", x: r.x, y: r.y }));
  if (a.add_columns) B.columns = [...(B.columns || []), ...a.add_columns];
  B.bounds = computeBounds(B);
  drawGrid();
  drawBase();
  if (a.replace_base) fit();
  done();
  return { walls: B.walls.map(wallInfo), rooms: B.rooms || [] };
}

// —— 方案 ——
export function designs({ action, index, name, copy_from }) {
  needBase();
  if (!S.PROJ) throw new Error("沒有專案");
  const list = () => S.PROJ.designs.map((d, k) => ({ index: k, name: d.name, current: k === S.PROJ.cur }));
  const chk = k => {
    if (k == null || !S.PROJ.designs[k]) throw new Error(`沒有方案 ${k}`);
  };
  if (action === "switch") {
    chk(index);
    switchDesign(index);
  } else if (action === "rename") {
    const k = index ?? S.PROJ.cur;
    chk(k);
    S.PROJ.designs[k].name = name || S.PROJ.designs[k].name;
    switchDesign(S.PROJ.cur);
  } else if (action === "add") {
    syncDesign();
    const src = copy_from != null ? S.PROJ.designs[copy_from] : null;
    if (copy_from != null) chk(copy_from);
    const d = {
      id: uid(),
      name: name || `方案 ${S.PROJ.designs.length + 1}`,
      items: src ? structuredClone(src.items) : [],
      nextId: src ? src.nextId : 1,
      spec: src ? structuredClone(src.spec || {}) : {},
    };
    S.PROJ.designs.push(d);
    switchDesign(S.PROJ.designs.length - 1);
  }
  return list();
}

// —— 截圖 ——
function rasterize(svgText, maxW = 1400) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const w0 = img.naturalWidth || 1200,
        h0 = img.naturalHeight || 800,
        k = Math.min(1, maxW / w0) * (w0 < 600 ? 2 : 1);
      const c = document.createElement("canvas");
      c.width = Math.round(w0 * k);
      c.height = Math.round(h0 * k);
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/png").split(",")[1]);
    };
    img.onerror = () => reject(new Error("無法把圖面轉成圖片"));
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgText);
  });
}
const svgText = el => {
  if (typeof el === "string") return el;
  if (!el.getAttribute("xmlns")) el.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return new XMLSerializer().serializeToString(el);
};
const wait = ms => new Promise(r => setTimeout(r, ms));
export async function screenshot(a) {
  needBase();
  const maxW = a.max_width || 1400;
  if (a.view === "plan") {
    const save = { plan: S.plan, sel: state.sel, msel: S.msel };
    if (a.plan) S.plan = a.plan;
    state.sel = null;
    S.msel = [];
    renderItems();
    const s = exportSVGString(2);
    Object.assign(S, { plan: save.plan, msel: save.msel });
    state.sel = save.sel;
    renderItems();
    return { image: await rasterize(s, maxW), note: `平面圖（${a.plan || S.plan}）` };
  }
  if (a.view === "3d") {
    const prev = S.view;
    if (S.view !== "3d") setView("3d");
    for (let i = 0; i < 100 && !(window.__fp3d && window.__fp3d.snapshot && window.__fp3d.built); i++) await wait(100);
    const v = window.__fp3d;
    if (!v) throw new Error("3D 檢視無法啟動（瀏覽器可能不支援 WebGL）");
    if (a.doors != null && v.setDoors) v.setDoors(+a.doors);
    await v.rebuild?.();
    if (a.camera === "top") v.setMode?.("top", true);
    else v.preset?.(a.camera || "iso");
    await wait(400);
    const url = v.snapshot();
    if (prev !== "3d" && !a.keep_view) setView(prev);
    return { image: url.split(",")[1], note: `3D（${a.camera || "iso"}）` };
  }
  if (a.view === "elevation") {
    const { allFaces } = await import("../docs/walls.js");
    const { elevationSheet } = await import("../docs/sheet.js");
    const faces = allFaces();
    const f = faces.find(x => x.i === a.wall && x.face === (a.face || 1));
    if (!f)
      throw new Error(
        `沒有這面牆面（wall ${a.wall}, face ${a.face || 1}）。可用：` + faces.map(x => `${x.i}:${x.face}`).join(", "),
      );
    const root = elevationSheet(f, "E-1", { doors: a.doors === "open" || a.doors > 0.5 ? "open" : "closed" });
    const { collectCSS } = await import("../docs/sheet.js");
    const st = document.createElementNS("http://www.w3.org/2000/svg", "style");
    st.textContent = collectCSS();
    root.insertBefore(st, root.firstChild);
    return { image: await rasterize(svgText(root), maxW), note: `立面圖 wall ${a.wall} face ${a.face || 1}` };
  }
  if (a.view === "cabinet") {
    const it = findItem(a.cabinet_id);
    const cab = await import("../cabinet/index.js");
    const s = cab.cabSheetSVG(it, { doors: a.doors === "open" || a.doors > 0.5 ? "open" : "closed", tables: false });
    return { image: await rasterize(svgText(s), maxW), note: `櫃體工程圖 #${it.id}` };
  }
  throw new Error("不支援的 view");
}

// —— 其他 ——
export function show({ view, plan, select }) {
  if (plan) setPlan(plan);
  if (view) setView(view);
  if (select) setSel(select);
  renderProps();
  return { view: S.view, plan: S.plan, selected: state.sel };
}
export async function get_schedule() {
  needBase();
  const { allSections } = await import("../docs/schedule.js");
  return allSections().map(s => ({ section: s.name, rows: s.rows }));
}
export async function get_cabinet({ id }) {
  const it = findItem(id);
  const cab = await import("../cabinet/index.js");
  if (!EXT.build3d[it.type] || !cab.cabParts) throw new Error("這不是櫃體");
  cab.ensureCab?.(it);
  return {
    item: itemInfo(it),
    cutList: cab.cabCutList(it),
    hardware: cab.cabHardware(it),
    parts: cab.cabParts(it).length,
  };
}
export function undo_({ steps = 1 } = {}) {
  for (let i = 0; i < steps && S.undoStack.length; i++) undo();
  return { canUndo: S.undoStack.length, canRedo: S.redoStack.length };
}
export function redo_({ steps = 1 } = {}) {
  for (let i = 0; i < steps && S.redoStack.length; i++) redo();
  return { canUndo: S.undoStack.length, canRedo: S.redoStack.length };
}

export const HANDLERS = {
  open_project,
  add_material,
  get_state,
  get_catalog,
  list_materials,
  add_items,
  update_items,
  delete_items,
  draw_run,
  set_spec,
  set_wall_finish,
  edit_base,
  designs,
  screenshot,
  show,
  get_schedule,
  get_cabinet,
  undo: undo_,
  redo: redo_,
};
