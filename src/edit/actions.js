// 新增、刪除、再製、旋轉、鏡像
import { CURVE_KEYS } from "../shapes/curve.js";
import { S, state } from "../core/store.js";
import { commit } from "../core/history.js";
import { snapV } from "../core/geometry.js";
import { renderItems } from "../canvas/items.js";
import { selItems, setSel } from "../canvas/selection.js";
import { addFixture } from "../base-edit/base-edit.js";
import { renderProps } from "../ui/props.js";
import { showGate } from "../ui/gate.js";

export function addItem(def, x, y) {
  if (!S.BASE) {
    showGate();
    return null;
  }
  if (S.mode === "base") return addFixture(def, x, y);
  const it = {
    id: state.nextId++,
    type: def.type,
    label: def.name,
    x: 0,
    y: 0,
    w: def.w,
    d: def.d,
    rot: 0,
    z: state.nextId,
  };
  if (def.seats) it.seats = def.seats;
  for (const k of CURVE_KEYS) if (def[k] != null) it[k] = def[k];
  if (def.thick) it.thick = def.thick;
  if (def.chairs != null) it.chairs = def.chairs;
  if (def.type === "text") {
    it.label = "文字";
    it.fontSize = 16;
  }
  it.x = snapV(x - it.w / 2);
  it.y = snapV(y - it.d / 2);
  state.items.push(it);
  state.sel = it.id;
  renderItems();
  renderProps();
  commit();
  return it;
}
export function delSel() {
  const del = selItems().filter(i => !i.locked);
  if (!del.length) return;
  state.items = state.items.filter(i => !del.includes(i));
  S.msel = [];
  state.sel = null;
  renderItems();
  renderProps();
  commit();
}
export function dupSel() {
  const src = selItems();
  if (!src.length) return;
  const ids = src.map(it => {
    const c = {
      ...JSON.parse(JSON.stringify(it)),
      id: state.nextId++,
      x: it.x + 20,
      y: it.y + 20,
      locked: false,
      z: state.nextId,
    };
    state.items.push(c);
    return c.id;
  });
  renderItems();
  setSel(ids);
  commit();
}
export function rotSel(deg) {
  const its = selItems().filter(i => !i.locked);
  if (!its.length) return;
  its.forEach(it => (it.rot = (((it.rot + deg) % 360) + 360) % 360));
  renderItems();
  renderProps();
  commit();
}
export function flipSel() {
  const its = selItems().filter(i => !i.locked);
  if (!its.length) return;
  its.forEach(it => (it.flip = !it.flip));
  renderItems();
  commit();
}
