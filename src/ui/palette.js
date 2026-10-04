// 左側元件庫（可收合）與拖拉放置
import { S } from "../core/store.js";
import { $, TXT, el, svg, toast } from "../core/dom.js";
import { LIB } from "../shapes/library.js";
import { DRAW } from "../shapes/draw.js";
import { fit, toWorld } from "../canvas/view.js";
import { addItem } from "../edit/actions.js";

export function buildPalette() {
  const pal = $("palette");
  pal.innerHTML = "";
  const sw = document.createElement("input");
  sw.type = "search";
  sw.placeholder = "搜尋元件（例如：門、櫃、床）";
  sw.style.cssText =
    "width:100%;font:inherit;font-size:13px;padding:6px 8px;border:1px solid #d0d7de;border-radius:6px;margin:4px 0 2px";
  sw.oninput = () => {
    const q = sw.value.trim();
    pal.classList.toggle("searching", !!q);
    pal.querySelectorAll(".pal").forEach(c => (c.style.display = !q || c.dataset.name.includes(q) ? "" : "none"));
    pal.querySelectorAll("h3").forEach(h => {
      const g = h.nextSibling;
      h.style.display = g.querySelector('.pal:not([style*="none"])') ? "" : "none";
    });
  };
  pal.insertAdjacentHTML("beforeend", palTopHTML());
  pal.appendChild(sw);
  for (const cat of LIB) {
    const h = document.createElement("h3");
    h.textContent = cat.cat;
    h.dataset.key = "f:" + cat.cat;
    pal.appendChild(h);
    const grid = document.createElement("div");
    grid.className = "grid";
    pal.appendChild(grid);
    for (const def of cat.items) {
      const card = document.createElement("div");
      card.className = "pal";
      card.draggable = true;
      card.dataset.name = def.name + cat.cat;
      card.title = `拖拉到圖上（${def.w}×${def.d} cm）`;
      const ps = el("svg", {});
      const pad = 14,
        m = Math.max(def.w, def.d) + pad * 2;
      const extra = ["vanity", "desk", "deskLift", "dining", "diningRound", "ac"].includes(def.type)
        ? 45
        : def.type === "sofabed"
          ? 110
          : 0;
      ps.setAttribute(
        "viewBox",
        `${-pad - (def.w < def.d ? (def.d - def.w) / 2 : 0)} ${-pad - extra * 0.5 - (def.type === "swingDoor" ? def.w : def.type === "doubleDoor" ? def.w / 2 : def.type === "foldDoor" ? def.d : 0) - (def.d < def.w ? (def.w - def.d) / 2 - extra * 0.3 : 0)} ${m} ${m + extra * 0.4}`,
      );
      const g = el("g", { class: "item" }, ps);
      DRAW[def.type](g, def.w, def.d, def);
      if (def.type === "text") {
        const t = TXT(g, def.w / 2, def.d / 2, "Aa");
        t.style.fontSize = "22px";
      }
      card.appendChild(ps);
      const s = document.createElement("span");
      s.innerHTML = `${def.name}<br><small>${def.w}×${def.d}</small>`;
      card.appendChild(s);
      card.addEventListener("dragstart", e => {
        e.dataTransfer.setData("text/x-floorplan", JSON.stringify(def));
        e.dataTransfer.effectAllowed = "copy";
      });
      card.addEventListener("click", () => {
        const r = svg.getBoundingClientRect();
        const p = toWorld(r.left + r.width / 2, r.top + r.height / 2);
        addItem(def, p.x, p.y);
        toast(`已加入「${def.name}」，可拖曳移動`);
      });
      grid.appendChild(card);
    }
  }
}
export function palTopHTML() {
  return `<div class="paltop"><button class="paltog" title="收起面板">«</button><button data-all="0" title="全部收合">全部收合</button><button data-all="1" title="全部展開">全部展開</button></div><div class="palrail" title="展開面板">» 圖案庫</div>`;
}
export const COLL_KEY = "hl-collapsed";
export function collSet() {
  try {
    return new Set(JSON.parse(localStorage.getItem(COLL_KEY) || "[]"));
  } catch (e) {
    return new Set();
  }
}
export function collSave(set) {
  try {
    localStorage.setItem(COLL_KEY, JSON.stringify([...set]));
  } catch (e) {}
}
export function applyCollapse() {
  const set = collSet();
  document
    .querySelectorAll("#palette h3[data-key], #basePal h3[data-key]")
    .forEach(h => h.classList.toggle("collapsed", set.has(h.dataset.key)));
  document.getElementById("app").classList.toggle("palcollapsed", set.has("__panel"));
}
export function setPanel(collapsed) {
  const set = collSet();
  collapsed ? set.add("__panel") : set.delete("__panel");
  collSave(set);
  applyCollapse();
  setTimeout(() => {
    if (S.BASE) fit();
  }, 30);
}

export function init() {
  svg.addEventListener("dragover", e => {
    if ([...e.dataTransfer.types].includes("text/x-floorplan")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  });
  svg.addEventListener("drop", e => {
    const data = e.dataTransfer.getData("text/x-floorplan");
    if (!data) return;
    e.preventDefault();
    const p = toWorld(e.clientX, e.clientY);
    addItem(JSON.parse(data), p.x, p.y);
  });
  ["palette", "basePal"].forEach(id =>
    $(id).addEventListener("click", e => {
      const h = e.target.closest("h3[data-key]");
      if (h) {
        const set = collSet();
        set.has(h.dataset.key) ? set.delete(h.dataset.key) : set.add(h.dataset.key);
        collSave(set);
        applyCollapse();
        return;
      }
      if (e.target.closest(".paltog")) {
        setPanel(true);
        return;
      }
      if (e.target.closest(".palrail")) {
        setPanel(false);
        return;
      }
      const all = e.target.closest("[data-all]");
      if (all) {
        const set = collSet();
        $(id)
          .querySelectorAll("h3[data-key]")
          .forEach(h3 => (all.dataset.all === "0" ? set.add(h3.dataset.key) : set.delete(h3.dataset.key)));
        collSave(set);
        applyCollapse();
      }
    }),
  );
  applyCollapse();
}
