// 材質挑選器：分類、搜尋、色票、預覽、自訂材質（新增／編輯／刪除）
import { t } from "../core/i18n.js";
import { S } from "../core/store.js";
import { esc, toast } from "../core/dom.js";
import { commit } from "../core/history.js";
import { CATS, PATTERNS, catName } from "./library.js";
import { paintTexture } from "./textures.js";
import { allMats, customMats, getMat, matSwatchURL } from "./index.js";

let modal = null,
  st = null;

function ensureModal() {
  if (modal) return modal;
  modal = document.createElement("div");
  modal.id = "matModal";
  modal.innerHTML = `<div class="gcard matcard" role="dialog" aria-modal="true">
    <div class="mhead"><h2 id="matTitle"></h2><input id="matSearch" type="search" placeholder="${esc(t("搜尋材質名稱或規格"))}"></div>
    <div class="mbody"><nav id="matCats"></nav><div id="matGrid"></div><aside id="matSide"></aside></div>
    <div class="actions"><button id="matNew">＋ ${t("新增自訂材質")}</button><span class="grow"></span><button id="matCancel">${t("取消")}</button><button id="matOk" class="primary">${t("選用")}</button></div>
  </div>`;
  document.body.appendChild(modal);
  modal.addEventListener("pointerdown", e => {
    if (e.target === modal) close(null);
  });
  // 以 capture 攔截：挑選器開著時，鍵盤不觸發畫布快捷鍵（Delete、R…）
  document.addEventListener(
    "keydown",
    e => {
      if (!modal.classList.contains("show")) return;
      e.stopPropagation();
      if (e.key === "Escape") {
        if (st && st.edit) {
          st.edit = null;
          renderSide();
        } else close(null);
      } else if (e.key === "Enter" && e.target.tagName !== "INPUT" && st && !st.browse && !st.edit && st.sel)
        close(st.sel);
    },
    true,
  );
  modal.querySelector("#matSearch").oninput = e => {
    st.q = e.target.value.trim().toLowerCase();
    renderGrid();
  };
  modal.querySelector("#matCancel").onclick = () => close(null);
  modal.querySelector("#matOk").onclick = () => st.sel && close(st.sel);
  modal.querySelector("#matNew").onclick = () => {
    if (!S.PROJ) return toast(t("請先建立專案，才能新增自訂材質"));
    const base = getMat(st.sel);
    st.edit = {
      id: null,
      name: t("自訂材質"),
      cat: st.cats ? st.cats[0] : base.cat || "paint",
      color: base.color || "#cccccc",
      pattern: base.pattern || "plain",
      size: base.size || 100,
      rough: base.rough ?? 0.7,
      metal: base.metal ?? 0,
      opacity: base.opacity ?? 1,
      code: "",
    };
    renderSide();
  };
  return modal;
}

export function openPicker({ value, cats, title, browse } = {}) {
  ensureModal();
  return new Promise(resolve => {
    if (st) st.resolve(null);
    st = {
      resolve,
      cats: cats && cats.length ? cats : null,
      browse: !!browse,
      sel: value || null,
      cat: "all",
      q: "",
      edit: null,
    };
    modal.querySelector("#matTitle").textContent = title || (browse ? t("材質庫") : t("選擇材質"));
    modal.querySelector("#matSearch").value = "";
    modal.querySelector("#matOk").hidden = st.browse;
    modal.querySelector("#matCancel").textContent = st.browse ? t("關閉") : t("取消");
    modal.classList.add("show");
    renderCats();
    renderGrid();
    renderSide();
    setTimeout(() => {
      const on = modal.querySelector(".mcard.on");
      if (on) on.scrollIntoView({ block: "nearest" });
      modal.querySelector("#matSearch").focus();
    }, 0);
  });
}
function close(id) {
  modal.classList.remove("show");
  const s = st;
  st = null;
  if (s) s.resolve(s.browse ? null : id);
}

function visibleCats() {
  const ids = new Set(allMats(st.cats).map(m => m.cat));
  return CATS.filter(([k]) => ids.has(k) && (!st.cats || st.cats.includes(k)));
}
function renderCats() {
  const nav = modal.querySelector("#matCats"),
    cs = visibleCats(),
    nCustom = customMats().filter(m => !st.cats || st.cats.includes(m.cat)).length;
  nav.innerHTML =
    `<button data-cat="all" class="${st.cat === "all" ? "on" : ""}">${t("全部")}</button>` +
    cs.map(([k, n]) => `<button data-cat="${k}" class="${st.cat === k ? "on" : ""}">${esc(n)}</button>`).join("") +
    (nCustom
      ? `<button data-cat="custom" class="${st.cat === "custom" ? "on" : ""}">★ ${t("自訂")} <small>${nCustom}</small></button>`
      : "");
  nav.querySelectorAll("[data-cat]").forEach(
    b =>
      (b.onclick = () => {
        st.cat = b.dataset.cat;
        renderCats();
        renderGrid();
      }),
  );
}
function listed() {
  let list = allMats(st.cats);
  if (st.cat === "custom") list = list.filter(m => String(m.id).startsWith("custom-"));
  else if (st.cat !== "all") list = list.filter(m => m.cat === st.cat);
  if (st.q) list = list.filter(m => `${m.name} ${m.code || ""} ${catName(m.cat)} ${m.id}`.toLowerCase().includes(st.q));
  return list;
}
function renderGrid() {
  const g = modal.querySelector("#matGrid"),
    list = listed();
  g.innerHTML = list.length
    ? list
        .map(
          m =>
            `<button class="mcard${m.id === st.sel ? " on" : ""}" data-id="${esc(m.id)}" title="${esc(m.name)}"><img alt="" loading="lazy" src="${matSwatchURL(m.id, 96)}"><span>${esc(m.name)}</span>${m.code ? `<small>${esc(m.code)}</small>` : ""}</button>`,
        )
        .join("")
    : `<div class="empty">${t("沒有符合的材質")}</div>`;
  g.querySelectorAll(".mcard").forEach(b => {
    b.onclick = () => {
      st.sel = b.dataset.id;
      st.edit = null;
      g.querySelectorAll(".mcard").forEach(x => x.classList.toggle("on", x === b));
      renderSide();
    };
    b.ondblclick = () => !st.browse && close(b.dataset.id);
  });
}

const pct = v => Math.round((v ?? 0) * 100) + "%";
function renderSide() {
  const side = modal.querySelector("#matSide");
  if (st.edit) return renderEditor(side);
  const m = st.sel ? getMat(st.sel) : null;
  if (!m || m.name === "?") {
    side.innerHTML = `<div class="empty">${t("點選左側的材質查看細節；雙擊直接選用。")}</div>`;
    return;
  }
  const custom = String(m.id).startsWith("custom-");
  side.innerHTML = `<img class="mbig" alt="" src="${matSwatchURL(m.id, 256)}">
    <b>${esc(m.name)}</b>
    <table class="mprops">
      <tr><td>${t("分類")}</td><td>${esc(catName(m.cat))}</td></tr>
      ${m.code ? `<tr><td>${t("規格")}</td><td>${esc(m.code)}</td></tr>` : ""}
      <tr><td>${t("紋理")}</td><td>${esc((PATTERNS.find(p => p[0] === m.pattern) || [0, m.pattern])[1])}</td></tr>
      <tr><td>${t("紋理尺寸")}</td><td>${m.size} cm</td></tr>
      <tr><td>${t("粗糙度")}</td><td>${pct(m.rough)}</td></tr>
      <tr><td>${t("金屬感")}</td><td>${pct(m.metal)}</td></tr>
      ${(m.opacity ?? 1) < 1 ? `<tr><td>${t("不透明度")}</td><td>${pct(m.opacity)}</td></tr>` : ""}
      <tr><td>${t("色碼")}</td><td><span class="mdot" style="background:${esc(m.color)}"></span> ${esc(m.color)}</td></tr>
    </table>
    <div class="actions">${custom ? `<button id="matEdit">${t("編輯")}</button><button id="matDel" style="color:#d1242f">${t("刪除")}</button>` : `<button id="matDup">${t("以此為基礎自訂")}</button>`}</div>`;
  const dup = side.querySelector("#matDup");
  if (dup)
    dup.onclick = () => {
      if (!S.PROJ) return toast(t("請先建立專案，才能新增自訂材質"));
      st.edit = { ...m, id: null, name: t("{name}（自訂）", { name: m.name }), img: m.img };
      renderSide();
    };
  const ed = side.querySelector("#matEdit");
  if (ed)
    ed.onclick = () => {
      st.edit = { ...m };
      renderSide();
    };
  const del = side.querySelector("#matDel");
  if (del)
    del.onclick = () => {
      if (!confirm(t("刪除自訂材質「{name}」？已使用這個材質的地方會改成灰色。", { name: m.name }))) return;
      S.PROJ.materials = customMats().filter(x => x.id !== m.id);
      st.sel = null;
      commit();
      renderCats();
      renderGrid();
      renderSide();
    };
}

function renderEditor(side) {
  const e = st.edit,
    opt = (list, v) =>
      list.map(([k, n]) => `<option value="${k}" ${k === v ? "selected" : ""}>${esc(n)}</option>`).join("");
  side.innerHTML = `<img class="mbig" id="medPrev" alt="">
    <b>${e.id ? t("編輯自訂材質") : t("新增自訂材質")}</b>
    <label>${t("名稱")}<input id="medName" type="text" value="${esc(e.name)}"></label>
    <label>${t("分類")}<select id="medCat">${opt(CATS, e.cat)}</select></label>
    <div class="row2"><label>${t("底色")}<input id="medColor" type="color" value="${esc(toHex(e.color))}"></label>
      <label>${t("紋理尺寸 (cm)")}<input id="medSize" type="number" min="1" max="1000" value="${e.size}"></label></div>
    <label>${t("紋理")}<select id="medPat">${opt(PATTERNS, e.pattern)}</select></label>
    <label>${t("粗糙度")} <small id="medRoughV">${pct(e.rough)}</small><input id="medRough" type="range" min="0" max="1" step="0.05" value="${e.rough}"></label>
    <label>${t("金屬感")} <small id="medMetalV">${pct(e.metal)}</small><input id="medMetal" type="range" min="0" max="1" step="0.05" value="${e.metal}"></label>
    <label>${t("不透明度")} <small id="medOpV">${pct(e.opacity)}</small><input id="medOp" type="range" min="0.1" max="1" step="0.05" value="${e.opacity ?? 1}"></label>
    <label>${t("規格／色號")}<input id="medCode" type="text" value="${esc(e.code || "")}" placeholder="${esc(t("例如：60×60 cm、色號"))}"></label>
    <label>${t("材質照片（選填，會鋪滿一個紋理尺寸）")}<input id="medImg" type="file" accept="image/*"></label>
    ${e.img ? `<button id="medImgClr" type="button">${t("移除照片")}</button>` : ""}
    <div class="actions"><button id="medCancel">${t("取消")}</button><button id="medSave" class="primary">${t("儲存材質")}</button></div>`;
  const $ = id => side.querySelector("#" + id);
  const preview = () => {
    $("medPrev").src = e.img || paintTexture({ ...e, id: e.id || "draft" }, 256).toDataURL("image/png");
  };
  preview();
  const bind = (id, key, conv = v => v, label) =>
    ($(id).oninput = ev => {
      e[key] = conv(ev.target.value);
      if (label) $(label).textContent = pct(e[key]);
      preview();
    });
  bind("medName", "name");
  bind("medCat", "cat");
  bind("medColor", "color");
  bind("medSize", "size", v => Math.max(1, +v || 100));
  bind("medPat", "pattern");
  bind("medRough", "rough", Number, "medRoughV");
  bind("medMetal", "metal", Number, "medMetalV");
  bind("medOp", "opacity", Number, "medOpV");
  bind("medCode", "code");
  $("medImg").onchange = ev => {
    const f = ev.target.files[0];
    if (!f) return;
    readImage(f, 512)
      .then(url => {
        e.img = url;
        renderEditor(side);
      })
      .catch(() => toast(t("無法讀取這張圖片")));
  };
  if ($("medImgClr"))
    $("medImgClr").onclick = () => {
      delete e.img;
      renderEditor(side);
    };
  $("medCancel").onclick = () => {
    st.edit = null;
    renderSide();
  };
  $("medSave").onclick = () => {
    if (!S.PROJ) return toast(t("請先建立專案，才能新增自訂材質"));
    const m = {
      id: e.id || "custom-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: String(e.name || "").trim() || t("自訂材質"),
      cat: e.cat,
      color: toHex(e.color),
      pattern: e.pattern,
      size: Math.max(1, +e.size || 100),
      rough: +e.rough,
      metal: +e.metal,
      opacity: +e.opacity,
      code: e.code || "",
    };
    if (e.img) m.img = e.img;
    const list = customMats().slice(),
      i = list.findIndex(x => x.id === m.id);
    if (i >= 0) list[i] = m;
    else list.push(m);
    S.PROJ.materials = list;
    commit();
    st.sel = m.id;
    st.edit = null;
    st.cat = "custom";
    renderCats();
    renderGrid();
    renderSide();
    toast(t("已儲存材質「{name}」", { name: m.name }));
  };
}

function toHex(c) {
  const s = String(c || "");
  if (/^#[0-9a-f]{6}$/i.test(s)) return s;
  if (/^#[0-9a-f]{3}$/i.test(s)) return "#" + [...s.slice(1)].map(x => x + x).join("");
  return "#cccccc";
}
/** 讀取圖片並縮到最長邊 max px，回傳 JPEG data URL */
function readImage(file, max) {
  return new Promise((resolve, reject) => {
    const rd = new FileReader();
    rd.onerror = reject;
    rd.onload = () => {
      const im = new Image();
      im.onerror = reject;
      im.onload = () => {
        const sc = Math.min(1, max / Math.max(im.width, im.height)),
          c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(im.width * sc));
        c.height = Math.max(1, Math.round(im.height * sc));
        c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", 0.86));
      };
      im.src = rd.result;
    };
    rd.readAsDataURL(file);
  });
}
