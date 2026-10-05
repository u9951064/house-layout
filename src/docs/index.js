// 工程圖模組：立面圖（可編輯）、數量估算表、施工圖集（A3 圖框、圖例、列印／下載 HTML）
//
// 傳給 EXT.elev2d[type](g, it, ctx) 的 ctx 欄位：
//   doors      "closed" | "open"：櫃門關閉或打開（打開時畫內部層板、抽屜、吊衣桿）
//   scale      比例分母（20、30、50…），den 同義
//   fs         建議字級（cm，約為紙上 2.5 mm）
//   svgRoot    最外層 <svg>（放 <defs> 用），root 同義
//   svgPattern (材質id) → 填色字串（url(#…) 或顏色），mat 同義
//   face       牆面 1 | -1；wallIndex 牆索引（S.BASE.walls）
//   view       "front"（只有物件正面朝向觀看者時才會呼叫 elev2d）
//   mirror     立面中是否左右鏡像（群組已套用 scale(-1,1)，文字請自行反向或不畫文字）
//   spec       spec() 設計規格；h、elev：itemH(it)、itemElev(it)
// 局部座標：x∈[0, it.w]（觀看者左→右）、y＝−高度（地面 y=0，模組自己套 elev），群組已有 class="item"。
import { t } from "../core/i18n.js";
import { S } from "../core/store.js";
import { registerMenu, registerView } from "../ext/registry.js";
import { setView } from "../ext/views.js";
import { elevView, initElevView } from "./elev-view.js";
import { schedView } from "./schedule.js";
import { openDrawSet } from "./drawset.js";

export function register() {
  registerView(elevView);
  registerView(schedView);
  const item = () => ({ t: t("📐 輸出施工圖集…"), f: openDrawSet, off: !S.BASE });
  registerMenu("design", () => [
    { t: t("立面圖"), f: () => setView("elev"), off: !S.BASE },
    { t: t("數量估算表"), f: () => setView("sched"), off: !S.BASE },
    item(),
  ]);
  registerMenu("file", item);
}
export function init() {
  initElevView();
}
export { openDrawSet, buildSheets, sheetsHTML } from "./drawset.js";
export { drawElevation, itemsInFront } from "./elevation.js";
export { allSections, scheduleCSV } from "./schedule.js";
export { makeSheet, planSheet, elevationSheet } from "./sheet.js";
export { placeOnWall } from "./elev-view.js";
