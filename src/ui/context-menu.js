// 右鍵與彈出選單
import { $ } from "../core/dom.js";

export function showCtx(x, y, items) {
  const M = $("sheetMenu");
  M.innerHTML = items
    .map((m, i) =>
      m === "-"
        ? "<hr>"
        : `<div data-i="${i}" class="${m.danger ? "danger" : ""}" style="display:flex;justify-content:space-between;gap:24px${m.off ? ";opacity:.4;pointer-events:none" : ""}"><span>${m.t}</span><span style="color:#9ca3af">${m.k || ""}</span></div>`,
    )
    .join("");
  M.style.left = "0px";
  M.style.top = "0px";
  M.classList.add("show");
  const r = M.getBoundingClientRect();
  M.style.left = Math.min(x, innerWidth - r.width - 8) + "px";
  M.style.top = Math.min(y, innerHeight - r.height - 8) + "px";
  M.querySelectorAll("div[data-i]").forEach(
    d =>
      (d.onclick = () => {
        M.classList.remove("show");
        items[+d.dataset.i].f();
      }),
  );
}
