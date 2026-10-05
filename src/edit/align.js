// 多選對齊、平均分布、邊緣貼合
import { t } from "../core/i18n.js";
import { opt } from "../core/store.js";
import { toast } from "../core/dom.js";
import { commit } from "../core/history.js";
import { itemBox, unionBox } from "../core/geometry.js";
import { renderItems } from "../canvas/items.js";
import { cur, selItems } from "../canvas/selection.js";
import { renderMultiProps } from "../ui/props.js";

export function alignSel(kind) {
  const its = selItems().filter(i => !i.locked);
  if (its.length < 2) {
    toast(t("請至少選取 2 個未鎖定的物件"));
    return;
  }
  const shift = (it, dx, dy) => {
    it.x = Math.round((it.x + dx) * 10) / 10;
    it.y = Math.round((it.y + dy) * 10) / 10;
  };
  const U = unionBox(its),
    B = it => itemBox(it),
    gap = opt.gap || 0,
    ref = cur() && !cur().locked ? cur() : its[its.length - 1];
  if (kind === "left") its.forEach(i => shift(i, U.x1 - B(i).x1, 0));
  if (kind === "right") its.forEach(i => shift(i, U.x2 - B(i).x2, 0));
  if (kind === "hcenter")
    its.forEach(i => {
      const b = B(i);
      shift(i, (U.x1 + U.x2) / 2 - (b.x1 + b.x2) / 2, 0);
    });
  if (kind === "top") its.forEach(i => shift(i, 0, U.y1 - B(i).y1));
  if (kind === "bottom") its.forEach(i => shift(i, 0, U.y2 - B(i).y2));
  if (kind === "vcenter")
    its.forEach(i => {
      const b = B(i);
      shift(i, 0, (U.y1 + U.y2) / 2 - (b.y1 + b.y2) / 2);
    });
  if (kind === "disth" || kind === "distv") {
    if (its.length < 3) {
      toast(t("平均分布需要 3 個以上的物件"));
      return;
    }
    const H = kind === "disth",
      sorted = its.slice().sort((a, b) => (H ? B(a).x1 - B(b).x1 : B(a).y1 - B(b).y1));
    const total = H ? U.x2 - U.x1 : U.y2 - U.y1,
      sizes = sorted.map(i => {
        const b = B(i);
        return H ? b.x2 - b.x1 : b.y2 - b.y1;
      });
    const g = (total - sizes.reduce((a, b) => a + b, 0)) / (sorted.length - 1);
    let pos = H ? U.x1 : U.y1;
    sorted.forEach((i, k) => {
      const b = B(i);
      H ? shift(i, pos - b.x1, 0) : shift(i, 0, pos - b.y1);
      pos += sizes[k] + g;
    });
  }
  if (kind.startsWith("packh") || kind.startsWith("packv")) {
    const H = kind.startsWith("packh"),
      sorted = its.slice().sort((a, b) => (H ? B(a).x1 - B(b).x1 : B(a).y1 - B(b).y1));
    let pos = H ? B(sorted[0]).x2 + gap : B(sorted[0]).y2 + gap;
    if (kind === "packhA") sorted.forEach(i => shift(i, 0, U.y1 - B(i).y1));
    if (kind === "packvA") sorted.forEach(i => shift(i, U.x1 - B(i).x1, 0));
    sorted.slice(1).forEach(i => {
      const b = B(i);
      H ? shift(i, pos - b.x1, 0) : shift(i, 0, pos - b.y1);
      const nb = B(i);
      pos = (H ? nb.x2 : nb.y2) + gap;
    });
  }
  if (kind === "samew" || kind === "samed")
    its.forEach(i => {
      if (i === ref) return;
      if (kind === "samew") {
        const c = i.x + i.w / 2;
        i.w = ref.w;
        i.x = c - i.w / 2;
      } else {
        const c = i.y + i.d / 2;
        i.d = ref.d;
        i.y = c - i.d / 2;
      }
    });
  renderItems();
  renderMultiProps();
  commit();
  toast(
    {
      left: t("已靠左對齊"),
      right: t("已靠右對齊"),
      hcenter: t("已水平置中"),
      top: t("已靠上對齊"),
      bottom: t("已靠下對齊"),
      vcenter: t("已垂直置中"),
      disth: t("已水平平均分布"),
      distv: t("已垂直平均分布"),
      packh: t("已水平貼合"),
      packv: t("已垂直貼合"),
      packhA: t("已水平貼合並靠上"),
      packvA: t("已垂直貼合並靠左"),
      samew: t("已統一寬度"),
      samed: t("已統一深度"),
    }[kind],
  );
}
