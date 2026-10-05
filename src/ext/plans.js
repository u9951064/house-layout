// 平面圖面別（配置圖、地坪圖、天花圖、燈具迴路圖、插座弱電圖、空調風管圖）與圖層顯示規則
import { t } from "../core/i18n.js";
import { S } from "../core/store.js";
import { DEFAULTS } from "../shapes/library.js";
import { EXT, registerPlan } from "./registry.js";

const on = "on",
  dim = "dim",
  off = "off";
// 圖層順序：furniture partition cabinet floor ceiling finish light power hvac
const P = (id, name, v) => {
  const ks = ["furniture", "partition", "cabinet", "floor", "ceiling", "finish", "light", "power", "hvac"];
  registerPlan({ id, name, show: Object.fromEntries(ks.map((k, i) => [k, v[i]])) });
};
P("layout", t("平面配置圖"), [on, on, on, off, off, on, off, off, off]);
P("floor", t("地坪材質圖"), [off, on, dim, on, off, off, off, off, off]);
P("ceiling", t("天花板圖（RCP）"), [off, on, dim, off, on, on, on, off, dim]);
P("light", t("燈具開關迴路圖"), [dim, on, dim, off, dim, off, on, off, off]);
P("power", t("插座弱電配置圖"), [dim, on, dim, off, off, off, off, on, off]);
P("hvac", t("空調全熱交換風管圖"), [off, on, dim, off, dim, off, dim, off, on]);
P("all", t("全部圖層"), [on, on, on, on, on, on, on, on, on]);

export function curPlan() {
  return EXT.plans.find(p => p.id === S.plan) || EXT.plans[0];
}
export function layerOf(it) {
  return it.layer || (DEFAULTS[it.type] || {}).layer || "furniture";
}
/** 物件在目前圖面的顯示狀態："on" | "dim" | "off" */
export function showState(it) {
  return curPlan().show[layerOf(it)] || "on";
}
