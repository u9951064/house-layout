// 多語系：預設繁體中文；以中文原文當 key，英文字典見 src/i18n/en.js
import { EN, EN_HTML } from "../i18n/en.js";

export const LANGS = [
  ["zh-TW", "繁體中文"],
  ["en", "English"],
];
const pick = v => (LANGS.some(([k]) => k === v) ? v : null);
/** 目前語系：網址 ?lang= 優先，其次是上次的選擇，預設 zh-TW */
export const LANG = (() => {
  const q = pick(new URLSearchParams(location.search).get("lang"));
  if (q) localStorage.setItem("hl-lang", q);
  return q || pick(localStorage.getItem("hl-lang")) || "zh-TW";
})();
export const isEn = LANG === "en";
/** 日期／數字格式用的 locale */
export const LOCALE = isEn ? "en-US" : "zh-TW";

/** 翻譯：t("已選取 {n} 個", { n: 3 }) */
export function t(s, vars) {
  let r = isEn ? (EN[s] ?? s) : s;
  if (vars) r = r.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  return r;
}

export function setLang(l) {
  localStorage.setItem("hl-lang", l);
  const u = new URL(location.href);
  u.searchParams.delete("lang");
  location.href = u.toString();
}

const ATTRS = ["title", "placeholder", "aria-label", "alt"];
/** 翻譯 index.html 的靜態文字：data-i18n-html 整段替換，其餘逐一翻譯文字節點與屬性 */
export function translateDOM(root = document.body) {
  document.documentElement.lang = isEn ? "en" : "zh-Hant";
  if (!isEn) return;
  document.title = t(document.title);
  const md = document.querySelector('meta[name="description"]');
  if (md) md.content = t(md.content);
  root.querySelectorAll("[data-i18n-html]").forEach(e => {
    const h = EN_HTML[e.dataset.i18nHtml];
    if (h != null) e.innerHTML = h;
  });
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const s = n.nodeValue.trim();
    if (s && s in EN) n.nodeValue = n.nodeValue.replace(s, EN[s]);
  }
  root.querySelectorAll(ATTRS.map(a => `[${a}]`).join(",")).forEach(e => {
    for (const a of ATTRS) if (e.hasAttribute(a)) e.setAttribute(a, t(e.getAttribute(a)));
  });
}
