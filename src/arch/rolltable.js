// 移動摺疊餐桌：屬性面板（展開／收合）
import { t } from "../core/i18n.js";

export const rollTableProps = {
  html: it =>
    `<label class="toggle" style="margin-top:6px"><input id="rtFold" type="checkbox" ${it.fold ? "checked" : ""}>${t("收合（兩側桌板垂下）")}</label>
    <div class="muted" style="font-size:12px">${t("寬深填目前狀態的外框尺寸；收合時通常只剩中央框架的深度。")}</div>`,
  bind(it, api) {
    const e = api.$("rtFold");
    if (e)
      e.onchange = () => {
        it.fold = e.target.checked;
        api.commit();
        api.rerender();
      };
  },
};
