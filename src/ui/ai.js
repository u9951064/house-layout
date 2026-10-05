// AI 產生底圖對話框
import { t } from "../core/i18n.js";
import { S } from "../core/store.js";
import { $, toast } from "../core/dom.js";
import { updateButtons } from "../core/history.js";
import { extractJSON, normalizeBase } from "../model/base.js";
import { applyGateBase } from "../project/project.js";
import { renderProps } from "./props.js";

let PROMPT = null; // 提示詞內容來自 PROMPT.md（單一來源）
async function loadPrompt() {
  if (PROMPT) return PROMPT;
  const md = await (await fetch("PROMPT.md", { cache: "no-cache" })).text();
  PROMPT = (md.split("\n---\n")[1] || md).trim();
  return PROMPT;
}
export function openAI() {
  loadPrompt().catch(() => {});
  $("aiMsg").textContent = "";
  $("aiModal").classList.add("show");
  setTimeout(() => $("aiText").focus(), 50);
}

export function init() {
  $("gateAI").onclick = openAI;
  $("aiCancel").onclick = () => $("aiModal").classList.remove("show");
  $("aiCopy").onclick = async () => {
    let txt;
    try {
      txt = await loadPrompt();
    } catch (e) {
      toast(t("讀取提示詞失敗，請改用「說明 → AI 底圖提示詞」"));
      return;
    }
    try {
      await navigator.clipboard.writeText(txt);
      toast(t("已複製提示詞，貼給 AI 並附上平面圖"));
    } catch (e) {
      $("aiText").value = txt;
      $("aiText").select();
      toast(t("無法自動複製，已放進下方文字框，請手動複製"));
    }
  };
  $("aiApply").onclick = () => {
    const msg = $("aiMsg");
    msg.style.color = "";
    try {
      const { base, warn } = normalizeBase(extractJSON($("aiText").value));
      if (!applyGateBase(base, base.name)) return;
      updateButtons();
      $("aiModal").classList.remove("show");
      $("aiText").value = "";
      toast(
        t("已套用「{name}」：{n} 面牆", { name: base.name, n: base.walls.length }) +
          (warn.length ? t("，{n} 則提醒（見右側）", { n: warn.length }) : ""),
      );
      S.lastAIWarn = warn;
      S.propTab = "base";
      renderProps();
    } catch (err) {
      msg.style.color = "#d1242f";
      msg.textContent = t("無法套用：") + err.message;
    }
  };
}
