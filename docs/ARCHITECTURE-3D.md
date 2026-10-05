# House Layout 3D／施工圖擴充架構

> 本文件是各擴充模組之間的介面契約。核心檔案（`src/core`、`src/canvas`、`src/ui`、`src/project`、`src/ext`）只透過 `src/ext/registry.js` 掛勾，模組不直接修改核心。

## 座標與單位
- 單位一律 **cm**。平面座標：x 向右、y 向下（SVG）。
- 3D：`X = 平面 x`、`Z = 平面 y`、`Y = 離地高度`（向上）。1 單位 = 1 cm。
- 物件（item）在平面上是 `x, y, w, d, rot, flip`：以左上角為原點、寬 w（沿 x）、深 d（沿 y），繞中心順時針旋轉 `rot` 度；`flip` 為左右鏡像。
- **物件正面朝 +y（局部座標 y = d 那一側）**。例如沙發椅背在 y=0、座位朝 y=d。
- `it.z` 是**繪製順序**（上層／下層），不是高度！高度用 `it.h`，離地用 `it.elev`（`src/ext/heights.js` 的 `itemH(it)`、`itemElev(it)` 會套預設值）。

## 資料模型（專案檔 v4）
```
project = { app, version: 4, name, base, designs: [design], cur, ghost, materials: [自訂材質] }
design  = { id, name, items: [item], nextId, spec }
state   = { items, sel, nextId, spec }          // 目前方案（src/core/store.js）
S.PROJ.materials                                 // 專案共用的自訂材質
```
- `spec`（每個方案的設計規格）預設值見 `SPEC_DEFAULTS`（`src/ext/heights.js`），用 `spec()` 取得合併後的值：
  `slabH` 樓板高、`ceilH` 天花完成面高、`floorMat`、`wallMat`、`ceilMat`、`skirtH`、`skirtMat`、`doorH`、`winSill`、`winHead`、
  `wallFin: { "牆索引:面": 材質id }`。
- **牆面的「面」**：牆 `[x1,y1,x2,y2,thk,ops]`，方向 d = (x2−x1, y2−y1)。面 `1` 是單位法向量 `(−dy, dx)/|d|` 指向的那一側（例如由左往右畫的水平牆，面 1 是 +y／下方那側），面 `-1` 是另一側。
- **開口**（底圖牆上的門窗）：`[a, b, kind, opts]`，a/b 是沿牆的座標（水平牆為 x、垂直牆為 y）。opts：
  - 窗 `win`：`{ sill, head, style: "slide2|slide3|casement|fixed|awning|bay", frameMat, glass: "clear|frosted|reeded|lowe" }`
  - 門 `door`：`{ hinge: "a|b", side: 1|-1, head, leafStyle: "flat|panel|glass|groove|louver", leafMat, frameMat }`
  - 開口 `open`：`{ head }`
  未填用 `spec()` 的 `winSill / winHead / doorH`。
- `undo`／`redo` 快照包含 items、nextId、spec、自訂材質、底圖。改資料後呼叫 `commit()`（`src/core/history.js`）。

## 圖層與圖面別
每個元件定義（library def）有 `layer`：`furniture | partition | cabinet | floor | ceiling | finish | light | power | hvac`。
`src/ext/plans.js` 定義圖面別（配置圖、地坪、天花 RCP、燈具迴路、插座弱電、空調風管、全部）各圖層 on／dim／off。

## 註冊方式（`src/ext/registry.js`）
| 掛勾 | 用途 |
|---|---|
| `registerCatalog(cat)`（`src/shapes/library.js`） | 新增元件庫分類 `{ cat, layer, items: [def] }`；def 至少有 `type, name, w, d`，可有 `h, elev, layer, no3d` 與自訂預設參數 |
| `EXT.draw2d[type] = (g, w, d, it)` | 平面圖例（局部座標，class：`s` 實線外框、`t` 細線、`d` 虛線、`f` 填色、`g` 灰） |
| `EXT.build3d[type] = (it, ctx) => Object3D` | 3D 模型，局部座標：原點 = 物件左上角、地面 y=0（**模組自己套 elev**），x∈[0,w]、z∈[0,d]；3D 檢視負責平移、旋轉、鏡像 |
| `EXT.elev2d[type] = (g, it, ctx)` | 立面圖正視圖：局部座標 x∈[0,w]（觀看者面對物件正面時的左→右）、y = −高度（SVG 向上為負），地面 y=0 |
| `EXT.props[type]` / `EXT.propsAny` | 右側屬性面板額外區塊 `{ html(it), bind(it, api) }`，api = `{ $, commit, rerender }` |
| `EXT.noResize` / `EXT.noScopeCheck` / `EXT.noSize` / `EXT.noHit` | 不顯示縮放把手／不檢查放在衛浴陽台／不顯示寬×深字／不加外框點擊範圍（折線） |
| `def.tool` | 點選元件庫卡片時改為 `setTool(def.tool, def)`（工具的 `start(def)` 會收到 def） |
| `EXT.paletteClick.push(def => bool)` | 其他檢視攔截元件庫點選（回傳 true 表示已處理） |
| `def.init(it, def)` | 新增物件時設定預設參數（例如深拷貝 `it.cab`） |
| `registerTool(name, tool)` + `setTool(name)`（`src/canvas/interact.js`） | 畫布工具：`down/move/up(p, e)`、`key(e)→bool`、`draw(uiLayer, kk)`、`cancel()`；Esc 結束 |
| `registerView({ id, name, icon, mount(el), unmount, refresh })` | 主畫面檢視（3D、立面、櫃體工程圖、數量表…），`setView(id)`（`src/ext/views.js`） |
| `registerPTab({ id, name, html(), bind(api) })` | 右側面板分頁（例如「裝修」） |
| `registerMenu(menu, () => items)` | 選單附加項（file/edit/view/base/design/help），項目格式同 `src/ui/menubar.js` |
| `registerSchedule({ id, name, rows() })` | 數量估算表：rows → `[{ group, item, spec, qty, unit, note }]` |
| `onChange(fn)` | 資料變動通知（commit、restore、items、design、project、view、tool）；**renderItems 拖曳時也會觸發，重活請 debounce** |

繪製順序：floor 圖層最底，ceiling／finish 在家具上，light／power／hvac 最上（`src/canvas/items.js`）。

模組進入點：`src/<module>/index.js` 匯出 `register()`（元件庫建立前，註冊 catalog／draw2d 等）與 `init()`（DOM 就緒後）。

## 材質（`src/materials`）
材質 `{ id, name, cat, color, pattern, size, rough, metal, opacity, code, img? }`；`size` = 紋理一格代表的實際 cm。
- `getMat(id)`、`allMats(cats?)`
- `matSwatchURL(id)`：色票圖（data URL）
- `threeMaterial(THREE, id)`：MeshStandardMaterial（快取）；**幾何 UV 以 cm 為單位**，材質內部設定 `map.repeat = 1/size`
- `svgPattern(svgRoot, id, { angle })` → `"url(#…)"`：2D 平面／立面填色
- `openMatPicker({ value, cats, title })` → `Promise<id|null>`
- `matFieldHTML(key, id, label)`、`bindMatField(root, key, cats, onPick)`：屬性面板裡的材質欄位

## 模組分工
| 模組 | 內容 |
|---|---|
| `materials` | 內建材質庫、程序化紋理、材質挑選器、自訂材質 |
| `arch` | 地坪、天花（平釘／降板／間照／假樑／窗簾盒）、牆面裝修、踢腳板、門板、窗型、窗簾、「裝修」分頁 |
| `cabinet` | 參數化櫃體（分格、門抽、層板、材質、五金）、櫃體工程圖、板材裁切清單 |
| `mep` | 插座、開關、燈具、電箱、弱電、走線（迴路）、全熱交換機與風管、出回風口 |
| `view3d` | three.js 3D 檢視（環繞、俯視、漫遊、剖切、材質刷、截圖） |
| `docs` | 立面圖、數量估算表、施工圖集列印（圖框、圖例） |

## 測試
- e2e 測試會檢查所有 `t("中文")` 都有英文翻譯（`src/i18n/en/<module>.js`）。
- 每個模組有自己的測試檔 `tests/<module>.test.mjs`，埠號 `(+process.env.TEST_PORT || 4199) + 偏移`。
