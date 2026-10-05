// index.html 的靜態文字：text 為逐一翻譯的文字節點／屬性，html 為 data-i18n-html 整段替換
const text = {
  "House Layout｜室內平面設計工具": "House Layout | Floor Plan Designer",
  "在瀏覽器裡畫室內平面配置圖：匯入自己的房屋底圖，拖拉家具、設定尺寸、量測距離。所有資料只存在你的電腦。":
    "Draw interior floor plans in your browser: import your own base plan, drag in furniture, set sizes and measure distances. All data stays on your computer.",
  // 選單列與標題列
  檔案: "File",
  編輯: "Edit",
  檢視: "View",
  底圖: "Base plan",
  說明: "Help",
  "🌐 語言": "🌐 Language",
  "語言 Language": "語言 Language",
  切換專案: "Switch project",
  "復原 (⌘Z)": "Undo (⌘Z)",
  "重做 (⇧⌘Z)": "Redo (⇧⌘Z)",
  "儲存整個專案（底圖＋所有方案分頁）成一個 .json 檔（⌘S）":
    "Save the whole project (base plan + all design tabs) as one .json file (⌘S)",
  儲存: "Save",
  "底圖設定：名稱、透明度、重新校正、匯出或更換底圖":
    "Base plan settings: name, opacity, recalibrate, export or replace",
  "編輯底圖：畫牆、加門窗、柱子、房間名稱、固定設備":
    "Edit base plan: draw walls, add doors/windows, columns, room names, fixtures",
  "✏️ 編輯底圖": "✏️ Edit base plan",
  "專案管理：開啟、重新命名、刪除": "Project manager: open, rename, delete",
  "專案…": "Projects…",
  "建立新專案：命名後匯入新的底圖": "Create a new project: name it, then import a new base plan",
  "＋新專案": "+ New project",
  "開啟專案檔（底圖＋所有方案分頁），會開成一個新專案":
    "Open a project file (base plan + all design tabs) as a new project",
  開啟檔案: "Open file",
  拖曳時物件邊緣自動貼齊其他家具與牆面: "Snap item edges to other furniture and walls while dragging",
  貼邊: "Edge snap",
  吸附: "Snap",
  吸附精度: "Snap step",
  格線: "Grid",
  尺寸: "Sizes",
  底圖檔若含尺寸標註才會顯示: "Only shown if the base plan file includes dimensions",
  牆尺寸: "Wall dims",
  "量測距離：按住拖曳拉出量測線（快捷鍵 M）": "Measure distance: drag to draw a measuring line (shortcut M)",
  "📏 量測": "📏 Measure",
  全圖顯示: "Fit to screen",
  全圖: "Fit",
  匯出目前方案: "Export current design",
  "匯出／列印…": "Export / print…",
  "匯出 PNG": "Export PNG",
  "匯出 SVG（1:50）": "Export SVG (1:50)",
  列印: "Print",
  // 工具列
  "量測距離：拖曳拉線看距離，Shift 鎖水平／垂直（M）":
    "Measure distance: drag a line to see its length, Shift locks horizontal/vertical (M)",
  "拖曳時物件邊緣自動貼齊其他家具與牆面（拖曳時按住 Alt 暫停）":
    "Snap item edges to other furniture and walls while dragging (hold Alt to pause)",
  "🧲 貼邊": "🧲 Edge snap",
  "移動、縮放時吸附格線": "Snap to grid when moving or resizing",
  "⌗ 吸附": "⌗ Snap",
  顯示格線: "Show grid",
  "家具上顯示寬×深": "Show width × depth on furniture",
  顯示底圖的牆面尺寸標註: "Show wall dimensions from the base plan",
  // 關於
  "在瀏覽器裡畫室內平面配置圖：匯入自己的房屋底圖、拖拉家具、量測空間、用分頁比較多個設計方案。":
    "Draw interior floor plans in your browser: import your own base plan, drag in furniture, measure spaces and compare several designs in tabs.",
  開發者: "Developer",
  使用教學: "User guide",
  原始碼: "Source code",
  問題回報: "Issues",
  "AI 提示詞": "AI prompt",
  授權: "License",
  隱私: "Privacy",
  "單一靜態網頁，沒有後端、沒有追蹤程式。底圖與設計稿只存在你的瀏覽器與你下載的檔案。":
    "A single static web page with no backend and no tracking. Your base plan and designs live only in your browser and the files you download.",
  "⭐ 前往 GitHub": "⭐ View on GitHub",
  關閉: "Close",
  // 元件庫面板
  收起面板: "Collapse panel",
  全部收合: "Collapse all",
  全部展開: "Expand all",
  展開面板: "Expand panel",
  "» 底圖工具": "» Base plan tools",
  底圖工具: "Base plan tools",
  "選取／移動（V）": "Select / move (V)",
  "選取／移動": "Select / move",
  "畫牆（W）": "Draw wall (W)",
  畫牆: "Draw wall",
  窗: "Window",
  門: "Door",
  開口: "Opening",
  柱子: "Column",
  雨遮: "Canopy",
  不在範圍: "Out of scope",
  房間名稱: "Room name",
  牆厚: "Wall thickness",
  "外牆 20": "Exterior 20",
  "隔間 12": "Partition 12",
  "輕隔間 10": "Drywall 10",
  "畫牆：連續點擊，Esc／Enter／雙擊結束；Alt 畫斜牆。窗、門、開口：點在牆上。柱子、雨遮、不在範圍：拖拉出範圍。":
    "Walls: click point to point; Esc / Enter / double-click to finish; Alt for angled walls. Windows, doors, openings: click on a wall. Columns, canopies, out-of-scope areas: drag out an area.",
  固定設備: "Fixtures",
  "拖拉或點選加入底圖，離開編輯後會鎖定，所有方案共用。":
    "Drag or click to add to the base plan. Fixtures are locked after editing and shared by all designs.",
  完成底圖編輯: "Finish editing base plan",
  // 提示卡、縮放列
  "關閉提示（之後可從「說明 → 顯示操作提示」再打開）": "Close tips (reopen from Help → Show tips)",
  關閉提示: "Close tips",
  "💡 小提示": "💡 Tips",
  "縮放（1 m 在螢幕上的像素：100% ≈ 100 px）": "Zoom (screen pixels per metre: 100% ≈ 100 px)",
  縮小: "Zoom out",
  拖曳縮放: "Drag to zoom",
  放大: "Zoom in",
  "輸入百分比後按 Enter": "Type a percentage and press Enter",
  常用比例: "Preset zoom levels",
  // 對話框
  並排比較所有方案: "Compare all designs side by side",
  專案管理: "Project manager",
  "專案暫存在這個瀏覽器。要備份或換電腦，請用「儲存檔案」存成一個 .json 檔（含底圖與所有方案分頁）。":
    "Projects are stored in this browser. To back up or move to another computer, use “Save file” to save a .json file (base plan + all design tabs).",
  "開始之前：匯入你的房屋底圖": "Before you start: import your base plan",
  "① 匯入底圖或專案檔": "① Import a base plan or project file",
  "本工具輸出的 .json（底圖檔或含底圖的專案檔）": "A .json exported by this tool (base plan file or project file)",
  "② 上傳平面圖圖片": "② Upload a floor plan image",
  "PNG／JPG。上傳後在圖上點兩個已知距離的端點，輸入實際公分數即可校正比例":
    "PNG / JPG. After uploading, click two points a known distance apart and enter the real length in cm to set the scale",
  "③ 輸入外框尺寸": "③ Enter outer dimensions",
  "建立矩形外牆，再用「編輯底圖」加隔間、門窗、柱子":
    "Creates rectangular outer walls; then use “Edit base plan” to add partitions, doors, windows and columns",
  "④ 從空白開始畫底圖": "④ Draw a base plan from scratch",
  "直接進入底圖編輯模式，用「畫牆」一面一面畫出格局":
    "Go straight into base plan editing and draw the layout wall by wall",
  "⑤ 貼上 AI 產生的底圖": "⑤ Paste an AI-generated base plan",
  "複製提示詞給 ChatGPT／Claude／Gemini，連同平面尺寸圖或不動產說明書一起送出，再把回覆貼回來":
    "Copy the prompt to ChatGPT / Claude / Gemini, send it with a dimensioned floor plan or property document, then paste the reply back here",
  "還沒有平面圖？": "No floor plan yet?",
  先開啟範例專案試用: "Try the sample project first",
  "PDF 平面圖請先截圖或轉成 PNG。建議圖片中有一段標示尺寸的牆，方便校正。":
    "For PDF floor plans, take a screenshot or convert to PNG first. An image with at least one dimensioned wall makes calibration easier.",
  "取消，回到目前的底圖": "Cancel and return to the current base plan",
  // 底圖編輯列
  "✏️ 底圖編輯": "✏️ Base plan editing",
  "選取、移動（V）": "Select, move (V)",
  選取: "Select",
  "連續點擊畫牆，Esc／Enter／雙擊結束（W）":
    "Click point to point to draw walls; Esc / Enter / double-click to finish (W)",
  點在牆上加窗: "Click on a wall to add a window",
  "＋窗": "+ Window",
  點在牆上加門: "Click on a wall to add a door",
  "＋門": "+ Door",
  "點在牆上加開口（無門）": "Click on a wall to add an opening (no door)",
  "＋開口": "+ Opening",
  拖拉畫柱子: "Drag to draw a column",
  拖拉畫雨遮: "Drag to draw a canopy",
  "拖拉框出不在設計範圍的區域（衛浴、陽台…）": "Drag to mark areas outside the design scope (bathroom, balcony…)",
  點一下放房間名稱: "Click to place a room name",
  "左側元件會成為固定設備 ｜ Alt：斜牆": "Items from the left become fixtures | Alt: angled wall",
  完成編輯: "Done",
  // AI
  "🤖 用 AI 產生底圖": "🤖 Generate a base plan with AI",
  "📋 複製提示詞": "📋 Copy prompt",
  查看提示詞全文: "View full prompt",
  "把 AI 的回覆整段貼在這裡（含 ```json 區塊也可以）": "Paste the AI's full reply here (```json blocks are fine)",
  取消: "Cancel",
  套用到畫面: "Apply",
  "資料只在你的瀏覽器與你選用的 AI 之間傳遞，本網站沒有伺服器、不會收到任何內容。":
    "Data only travels between your browser and the AI you choose. This site has no server and never receives anything.",
};

const html = {
  tipList: `
        <li>Drag items from the left onto the plan; drag empty space to pan, scroll to zoom</li>
        <li><kbd>R</kbd> rotate, <kbd>Delete</kbd> delete, <kbd>⌘C</kbd>/<kbd>⌘V</kbd> copy &amp; paste</li>
        <li>Shift-click or drag a box to multi-select, then align on the right; right-click for a menu</li>
      `,
  tipGuide: `<a href="guide.en.html" target="_blank" rel="noopener">Read the full user guide →</a>`,
  aboutDev: `Josh Tsai (<a href="https://github.com/u9951064" target="_blank" rel="noopener">@u9951064</a>)`,
  aboutGuide: `<a href="guide.en.html" target="_blank" rel="noopener">Overview and how to use it</a>`,
  aboutIssues: `<a href="https://github.com/u9951064/house-layout/issues" target="_blank" rel="noopener">GitHub Issues</a> (bug reports and suggestions welcome)`,
  aboutPrompt: `<a href="PROMPT.md" target="_blank" rel="noopener">PROMPT.md</a> (generate a base plan from a floor plan with AI)`,
  gateIntro: `Provide your walls and dimensions first, then start designing. <b>All data stays in your browser</b> and is never uploaded to any server; saving downloads a file to your computer.`,
  gateGuide: `<a href="guide.en.html" target="_blank" rel="noopener">User guide</a>`,
  aiSteps: `
    <li>Click “Copy prompt” and paste it into an AI that can read images or PDFs (ChatGPT, Claude, Gemini…).</li>
    <li>Send it together with a <b>dimensioned floor plan</b> or <b>property document</b> (survey drawing, partition plan).</li>
    <li>Paste the AI's entire reply below and click “Apply”. You can fine-tune it afterwards with “✏️ Edit base plan”.</li>
  `,
  calbar: `📐 Calibrate scale: click <b>two points a known distance apart</b> on the image (e.g. both ends of a wall).`,
  svgBath: "Bath",
  svgRoom: "Living",
};

export default { text, html };
