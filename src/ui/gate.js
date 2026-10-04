// 匯入底圖畫面
import { loadData } from "../io/file.js";
import { S } from "../core/store.js";
import { $, toast } from "../core/dom.js";
import { endCalib, startCalib } from "../tools/calibrate.js";
import { applyGateBase } from "../project/project.js";
import { openFile } from "../io/file.js";

export function showGate(intent = "new") {
  S.gateIntent = intent;
  $("gate").classList.remove("hidden");
  $("gateClose").style.display = S.BASE ? "" : "none";
  $("gate").querySelector("h2").textContent =
    intent === "replace"
      ? `更換「${S.PROJ ? S.PROJ.name : ""}」的底圖`
      : S.BASE
        ? "建立新專案：匯入房屋底圖"
        : "開始之前：匯入你的房屋底圖";
}
export function hideGate() {
  $("gate").classList.add("hidden");
}

export function init() {
  $("gateSample").onclick = async e => {
    e.preventDefault();
    try {
      const data = await (await fetch("examples/sample-project.json", { cache: "no-cache" })).json();
      S.gateIntent = "new";
      loadData(data, "範例兩房");
    } catch (err) {
      alert("無法載入範例：" + err.message);
    }
  };
  $("gateCancel").onclick = e => {
    e.preventDefault();
    if (S.BASE) hideGate();
  };
  $("gateJson").addEventListener("change", e => {
    const f = e.target.files[0];
    if (f) openFile(f);
    e.target.value = "";
  });
  $("gateImg").addEventListener("change", e => {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 2400,
          sc = Math.min(1, max / Math.max(img.width, img.height)); // 縮小大圖，避免存檔過大
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * sc);
        c.height = Math.round(img.height * sc);
        const x = c.getContext("2d");
        x.fillStyle = "#fff";
        x.fillRect(0, 0, c.width, c.height);
        x.drawImage(img, 0, 0, c.width, c.height);
        const src = c.toDataURL("image/jpeg", 0.85);
        try {
          if (
            !applyGateBase(
              { name: "", walls: [], image: { src, x: 0, y: 0, w: c.width, h: c.height, opacity: 0.6 } },
              f.name.replace(/\.[^.]+$/, ""),
            )
          )
            return;
        } catch (err) {
          alert(err.message);
          return;
        }
        startCalib();
      };
      img.onerror = () => alert("無法讀取這張圖片");
      img.src = rd.result;
    };
    rd.readAsDataURL(f);
  });
  $("gateRect").onclick = () => {
    const w = parseFloat(prompt("外框寬度（cm，牆中心線）", "800"));
    if (!(w > 50)) return;
    const d = parseFloat(prompt("外框深度（cm，牆中心線）", "900"));
    if (!(d > 50)) {
      alert("請輸入正確的尺寸");
      return;
    }
    const t = parseFloat(prompt("外牆厚度（cm）", "20")) || 20;
    if (
      !applyGateBase(
        {
          name: "",
          walls: [
            [0, 0, w, 0, t, []],
            [w, 0, w, d, t, []],
            [0, d, w, d, t, []],
            [0, 0, 0, d, t, []],
          ],
        },
        "我的新家",
      )
    )
      return;
    toast("已建立外牆。用左側「隔間牆」「門」「柱子」元件畫出格局");
  };
  $("calCancel").onclick = endCalib;
}
