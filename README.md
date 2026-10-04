# House Layout — 室內平面設計工具

在瀏覽器裡畫室內平面配置圖：<https://house-layout.tinycloud.tw>

- **先匯入自己的房屋底圖**：匯入底圖／專案檔（.json）、上傳平面圖圖片並以兩點校正比例，或輸入外框尺寸建立外牆。
- **AI 產生底圖**：複製內建提示詞（[PROMPT.md](PROMPT.md)）給 ChatGPT／Claude／Gemini，附上平面尺寸圖或不動產說明書，把回覆貼回網頁即可套用；會自動修正小誤差並列出提醒。
- **專案與方案分頁**：一間房子一個專案；畫布下方像 Excel 工作表，一頁一個設計方案（雙擊改名、右鍵複製／刪除／排序），可疊圖或並排比較。「儲存檔案」把底圖與所有方案存成一個 .json。
- **編輯底圖**：畫牆（鎖水平／垂直、吸附端點）、在牆上加窗／門（可設鉸鏈與開向）／開口、柱子、雨遮、不在設計範圍區、房間名稱、固定設備；也可從空白開始畫。
- **拖拉家具元件**：床、衣櫃、沙發、餐桌、書桌、化妝台、各式門與隔間（含弧形牆、弧形拉門）等 80 種建商平面圖風格圖例，可設定寬深與角度。
- **同一比例（公分）**：比例尺、量測工具、1 cm 吸附格線，方便評估空間感。
- **存檔與匯出**：專案檔（.json，含底圖）可再次開啟；匯出 PNG 或 1:50 實際尺寸的 SVG。

## 隱私

整個工具只有一個靜態網頁（`index.html`），沒有後端、沒有追蹤程式。你的底圖與設計稿只存在瀏覽器（localStorage）與你下載的檔案中，不會上傳到任何伺服器。

## 專案架構

純前端、沒有建置步驟：`index.html` 以瀏覽器原生 ES Modules 載入 `src/main.js`，GitHub Pages 直接部署。

```
index.html            頁面結構（不含程式與樣式）
css/
  base.css            版面骨架、按鈕、選單列與工具列
  panels.css          元件庫、屬性面板、分頁列、縮放列
  dialogs.css         對話框、匯入畫面、底圖編輯列
  canvas.css          SVG 畫布：牆、門窗、家具圖例
src/
  main.js             進入點：初始化各模組、還原上次的專案
  core/               store（共用狀態 S）、dom 工具、history（復原／重做）、geometry
  shapes/             library（元件定義）、draw（平面圖例繪製）
  model/base.js       底圖資料：驗證、AI 回覆解析與正規化
  canvas/             view（縮放平移）、base-render、items、selection、interact
  tools/              measure（量測）、calibrate（圖片比例校正）
  edit/               actions、clipboard、align（對齊／分布／貼合）
  base-edit/          底圖編輯模式
  project/            project（專案與暫存）、sheets（方案分頁）、compare、manager
  io/                 file（存檔／開檔）、export（PNG／SVG／列印）
  ui/                 palette、props、menubar、toolbar、zoombar、gate、ai、keyboard、context-menu
scripts/serve.mjs     開發用靜態伺服器（零相依）
tests/e2e.test.mjs    端對端測試（Playwright）
PROMPT.md             AI 產生底圖的提示詞（網頁執行時讀取）
```

慣例：每個模組只放宣告；需要綁定事件的模組匯出 `init()`，由 `main.js` 依序呼叫。跨模組共用的可變狀態都在 `core/store.js` 的 `S`。

## 開發

```bash
npm install
npm run test:install   # 第一次：下載測試用的 Chromium
npm run dev            # http://127.0.0.1:8000/
npm test               # 端對端測試
```

ES Modules 不能用 `file://` 直接開啟，請用 `npm run dev`。

## 開發者

- Josh Tsai（[@u9951064](https://github.com/u9951064)）
- 原始碼：<https://github.com/u9951064/house-layout>
- 問題回報與建議：<https://github.com/u9951064/house-layout/issues>
