// 選取（單選／多選）與拖曳貼邊目標
import { S, state } from "../core/store.js";
import { itemBox } from "../core/geometry.js";
import { renderSelection } from "./items.js";
import { renderProps } from "../ui/props.js";

export const cur = () => state.items.find(i => i.id === state.sel);
export function selIds() {
  if (state.sel == null) return [];
  return S.msel.length > 1 && S.msel.includes(state.sel)
    ? S.msel.filter(id => state.items.some(i => i.id === id))
    : [state.sel];
}
export function selItems() {
  const ids = selIds();
  return state.items.filter(i => ids.includes(i.id));
}
export function setSel(ids) {
  ids = ids.filter(id => state.items.some(i => i.id === id));
  S.msel = ids.length > 1 ? ids : [];
  state.sel = ids.length ? ids[ids.length - 1] : null;
  renderSelection();
  renderProps();
}
export function edgeTargets(excludeIds) {
  // 其他家具、牆面、柱子、固定設備的邊
  const xs = [],
    ys = [],
    add = (x1, y1, x2, y2) => {
      xs.push(x1, x2, (x1 + x2) / 2);
      ys.push(y1, y2, (y1 + y2) / 2);
    };
  state.items.forEach(i => {
    if (!excludeIds.includes(i.id) && !["rug", "rugRound", "dimension", "text"].includes(i.type)) {
      const b = itemBox(i);
      add(b.x1, b.y1, b.x2, b.y2);
    }
  });
  if (S.BASE) {
    (S.BASE.walls || []).forEach(w => {
      const h = w[4] / 2;
      if (Math.abs(w[1] - w[3]) < 0.01) {
        xs.push(Math.min(w[0], w[2]) - h, Math.max(w[0], w[2]) + h);
        ys.push(w[1] - h, w[1] + h);
      } else if (Math.abs(w[0] - w[2]) < 0.01) {
        ys.push(Math.min(w[1], w[3]) - h, Math.max(w[1], w[3]) + h);
        xs.push(w[0] - h, w[0] + h);
      }
    });
    (S.BASE.columns || []).forEach(c => {
      xs.push(c[0], c[2]);
      ys.push(c[1], c[3]);
    });
    (S.BASE.fixtures || []).forEach(f => {
      const b = itemBox({ rot: 0, ...f });
      xs.push(b.x1, b.x2);
      ys.push(b.y1, b.y2);
    });
  }
  return { xs, ys };
}
