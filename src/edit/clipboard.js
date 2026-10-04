// 複製／剪下／貼上
import { S, state } from "../core/store.js";
import { KEY, toast } from "../core/dom.js";
import { commit } from "../core/history.js";
import { snapV, unionBox } from "../core/geometry.js";
import { DEFAULTS } from "../shapes/library.js";
import { renderItems } from "../canvas/items.js";
import { selItems, setSel } from "../canvas/selection.js";
import { renderProps } from "../ui/props.js";

export function itemName(it) {
  return it.label || (DEFAULTS[it.type] || {}).name || it.type;
}
export function copySel(cut) {
  let its = selItems();
  if (!its.length) return false;
  if (cut) {
    its = its.filter(i => !i.locked);
    if (!its.length) {
      toast("已鎖定的物件不能剪下");
      return true;
    }
  }
  S.CLIP = its.map(it => {
    const c = JSON.parse(JSON.stringify(it));
    delete c.locked;
    return c;
  });
  S.pasteN = 0;
  try {
    localStorage.setItem("hl-clip", JSON.stringify(S.CLIP));
  } catch (e) {}
  const what = its.length > 1 ? `${its.length} 個物件` : `「${itemName(its[0])}」`;
  if (cut) {
    state.items = state.items.filter(i => !its.includes(i));
    S.msel = [];
    state.sel = null;
    renderItems();
    renderProps();
    commit();
    toast(`已剪下${what}，${KEY}V 貼上`);
  } else toast(`已複製${what}，${KEY}V 貼上（可跨方案分頁）`);
  return true;
}
export function getClip() {
  let c = S.CLIP;
  if (!c)
    try {
      c = JSON.parse(localStorage.getItem("hl-clip") || "null");
    } catch (e) {}
  if (!c) return null;
  return Array.isArray(c) ? (c.length ? c : null) : [c];
}
export function pasteClip(at) {
  const cs = getClip();
  if (!cs) {
    toast("剪貼簿是空的");
    return;
  }
  if (!S.BASE) return;
  const u = unionBox(cs);
  let dx, dy;
  if (at) {
    dx = snapV(at.x - (u.x1 + u.x2) / 2);
    dy = snapV(at.y - (u.y1 + u.y2) / 2);
  } else {
    S.pasteN++;
    dx = dy = 20 * S.pasteN;
  }
  const ids = cs.map(c => {
    const it = { ...JSON.parse(JSON.stringify(c)), id: state.nextId++, z: state.nextId, locked: false };
    it.x = c.x + dx;
    it.y = c.y + dy;
    state.items.push(it);
    return it.id;
  });
  renderItems();
  setSel(ids);
  commit();
}
