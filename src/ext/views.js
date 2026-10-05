// 主畫面檢視切換：平面圖（核心 SVG 畫布）／3D／立面圖／櫃體工程圖／數量表…（由模組 registerView 註冊）
import { t } from "../core/i18n.js";
import { S } from "../core/store.js";
import { $ } from "../core/dom.js";
import { renderItems } from "../canvas/items.js";
import { fit } from "../canvas/view.js";
import { EXT, emitChange } from "./registry.js";
import { curPlan } from "./plans.js";

let mounted = null;

export function setView(id) {
  const v = EXT.views.find(x => x.id === id);
  if (id !== "plan" && !v) return;
  if (mounted && mounted.unmount) mounted.unmount();
  mounted = null;
  S.view = id;
  const host = $("viewHost");
  host.innerHTML = "";
  document.body.dataset.view = id;
  host.hidden = id === "plan";
  if (v) {
    mounted = v;
    v.mount(host);
  } else if (S.BASE) fit();
  renderViewTabs();
  emitChange("view");
}
export function setPlan(id) {
  S.plan = id;
  if (S.view !== "plan") setView("plan");
  renderItems();
  renderViewTabs();
  try {
    localStorage.setItem("hl-plan", id);
  } catch (e) {}
}
export function renderViewTabs() {
  const vt = $("viewTabs");
  if (!vt) return;
  const views = [{ id: "plan", name: t("平面圖"), icon: "▦" }, ...EXT.views];
  vt.innerHTML =
    `<span class="seg">` +
    views
      .map(
        v =>
          `<button class="tb${S.view === v.id ? " on" : ""}" data-view="${v.id}" title="${v.name}">${v.icon ? v.icon + " " : ""}${v.name}</button>`,
      )
      .join("") +
    `</span>` +
    (S.view === "plan"
      ? `<select id="selPlan" title="${t("圖面別：切換要顯示的圖層")}">${EXT.plans
          .map(p => `<option value="${p.id}" ${p.id === curPlan().id ? "selected" : ""}>${p.name}</option>`)
          .join("")}</select>`
      : "");
  vt.querySelectorAll("[data-view]").forEach(b => (b.onclick = () => setView(b.dataset.view)));
  if ($("selPlan")) $("selPlan").onchange = e => setPlan(e.target.value);
}
/** 目前檢視需要重畫時呼叫（例如資料變更） */
export function refreshView() {
  if (mounted && mounted.refresh) mounted.refresh();
}

export function init() {
  try {
    const p = localStorage.getItem("hl-plan");
    if (p && EXT.plans.some(x => x.id === p)) S.plan = p;
  } catch (e) {}
  document.body.dataset.view = "plan";
  renderViewTabs();
}
