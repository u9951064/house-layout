#!/usr/bin/env node
// House Layout MCP server：讓 Claude（Claude Code／Claude Desktop）透過工具調整網頁上的圖稿
//
// 架構：Claude ⇄（MCP：stdio 或 Streamable HTTP）⇄ 本程式 ⇄（WebSocket，僅限本機）⇄ 開著的 House Layout 網頁
// 網頁端在「設計 → 🤖 連線 Claude（MCP）」按「連線」後，工具呼叫才會轉給網頁執行；所有修改都可在網頁上「復原」。
//
// 用法：
//   node scripts/mcp-server.mjs            stdio 模式（Claude Code 的 .mcp.json、Claude Desktop 設定檔使用）
//   node scripts/mcp-server.mjs --http     Streamable HTTP 模式：http://127.0.0.1:8765/mcp
// 環境變數：HL_MCP_WS_PORT（網頁連線埠，預設 8766）、HL_MCP_HTTP_PORT（預設 8765）、HL_MCP_ORIGINS（額外允許的網頁來源，逗號分隔）
import http from "node:http";
import { WebSocketServer } from "ws";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const WS_PORT = +process.env.HL_MCP_WS_PORT || 8766;
const HTTP_PORT = +process.env.HL_MCP_HTTP_PORT || 8765;
const HTTP_MODE = process.argv.includes("--http");
const log = (...a) => console.error("[house-layout-mcp]", ...a); // stdout 留給 MCP 協定

// —— 與網頁的橋接 ——
const EXTRA = (process.env.HL_MCP_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);
function originOK(origin) {
  if (!origin) return false;
  if (EXTRA.includes(origin)) return true;
  try {
    const u = new URL(origin);
    if (["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)) return true;
    return u.protocol === "https:" && u.hostname === "house-layout.tinycloud.tw";
  } catch (e) {
    return false;
  }
}
let page = null; // 目前連線的網頁（最後連上的那一個）
let seq = 0;
const pending = new Map();
let wsError = null;
const wss = new WebSocketServer({
  host: "127.0.0.1",
  port: WS_PORT,
  verifyClient: ({ origin }) => originOK(origin),
});
wss.on("listening", () => log(`等待網頁連線：ws://127.0.0.1:${WS_PORT}`));
wss.on("error", e => {
  wsError = e.code === "EADDRINUSE" ? `連線埠 ${WS_PORT} 已被另一個 House Layout MCP server 使用` : e.message;
  log("WebSocket 錯誤：", wsError);
});
wss.on("connection", (ws, req) => {
  if (page && page !== ws) page.close(4000, "replaced");
  page = ws;
  log("網頁已連線：", req.headers.origin);
  ws.on("message", buf => {
    let m;
    try {
      m = JSON.parse(String(buf));
    } catch (e) {
      return;
    }
    if (m.type === "hello") {
      ws.info = m;
      return;
    }
    const p = pending.get(m.id);
    if (!p) return;
    pending.delete(m.id);
    clearTimeout(p.timer);
    if (m.ok) p.resolve(m.result);
    else p.reject(new Error(m.error || "網頁執行失敗"));
  });
  ws.on("close", () => {
    if (page === ws) page = null;
    for (const [id, p] of pending) {
      pending.delete(id);
      clearTimeout(p.timer);
      p.reject(new Error("網頁已中斷連線"));
    }
  });
});
function callPage(tool, args, timeout = 45000) {
  if (wsError) return Promise.reject(new Error(wsError));
  if (!page || page.readyState !== 1)
    return Promise.reject(
      new Error(
        "House Layout 網頁尚未連線。請使用者打開網頁（例如 http://127.0.0.1:8000 或 https://house-layout.tinycloud.tw），" +
          "在「設計 → 🤖 連線 Claude（MCP）」按「連線」。The House Layout page is not connected: ask the user to open it and click Design → Connect Claude (MCP) → Connect.",
      ),
    );
  const id = ++seq;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`網頁沒有在 ${timeout / 1000} 秒內回應（${tool}）`));
    }, timeout);
    pending.set(id, { resolve, reject, timer });
    page.send(JSON.stringify({ id, tool, args }));
  });
}

// —— 工具定義（實作在網頁端 src/mcp/handlers.js）——
const num = z.number();
const pt = z.tuple([num, num]);
const itemFields = {
  w: num.optional().describe("寬 cm（沿物件局部 x）"),
  d: num.optional().describe("深 cm（沿物件局部 y；正面朝 +y）"),
  rot: num.optional().describe("順時針旋轉角度（度），繞物件中心"),
  flip: z.boolean().optional().describe("左右鏡像"),
  label: z.string().optional().describe("圖上顯示的名稱"),
  h: num.optional().describe("高度 cm（3D／立面）"),
  elev: num.optional().describe("離地高度 cm"),
  locked: z.boolean().optional(),
  props: z
    .record(z.string(), z.any())
    .optional()
    .describe("其他參數（依類型，例如 mat、cab、circuit、dia、ceilH、seats…；物件深度合併）"),
};
const TOOLS = [
  {
    name: "get_state",
    title: "讀取目前圖稿",
    description:
      "取得目前專案、方案、設計規格（spec）、底圖（牆、門窗開口、房間、柱子…，含牆的索引與面）與所有物件。修改前請先呼叫。",
    input: {
      include_items: z.boolean().optional().describe("是否列出物件（預設 true）"),
      include_base: z.boolean().optional().describe("是否列出底圖細節（預設 true）"),
    },
  },
  {
    name: "get_catalog",
    title: "元件庫",
    description:
      "列出可新增的元件類型（type、名稱、圖層、預設尺寸與參數）。圖層：furniture partition cabinet floor ceiling finish light power hvac。",
    input: {
      layer: z.string().optional().describe("只列出某圖層"),
      query: z.string().optional().describe("用名稱或 type 搜尋"),
    },
  },
  {
    name: "list_materials",
    title: "材質庫",
    description: "列出材質 id 與名稱（地板、磁磚、石材、木皮、系統板、塗料、壁紙、天花、金屬、玻璃、布料、檯面…）。",
    input: { category: z.string().optional(), query: z.string().optional() },
  },
  {
    name: "add_items",
    title: "新增物件",
    description:
      "在目前方案新增物件（家具、櫃體、地坪、天花、窗簾、燈具、插座…）。x、y 為物件左上角（cm），若 center=true 則為中心。回傳新物件 id。",
    input: {
      items: z
        .array(
          z.object({
            type: z.string().describe("元件類型（get_catalog 的 type）"),
            x: num,
            y: num,
            center: z.boolean().optional().describe("x、y 代表中心點"),
            ...itemFields,
          }),
        )
        .min(1),
    },
  },
  {
    name: "update_items",
    title: "修改物件",
    description: "修改物件的位置、尺寸、旋轉、高度、名稱或參數（props 深度合併，例如 { cab: { sections: [...] } }）。",
    input: {
      items: z.array(z.object({ id: num, x: num.optional(), y: num.optional(), ...itemFields })).min(1),
    },
  },
  {
    name: "delete_items",
    title: "刪除物件",
    description: "依 id 刪除物件。",
    input: { ids: z.array(num).min(1) },
  },
  {
    name: "draw_run",
    title: "畫走線或風管",
    description:
      "以世界座標點畫折線元件：走線 wire／conduit，風管 ductSupply ductReturn ductFresh ductExhaust acDuct。props 可設定 circuit、kind、dia（cm）、elev。",
    input: { type: z.string(), points: z.array(pt).min(2), props: z.record(z.string(), z.any()).optional() },
  },
  {
    name: "set_spec",
    title: "設計規格",
    description:
      "修改目前方案的設計規格（深度合併）：slabH 樓板高、ceilH 天花高、floorMat、wallMat、ceilMat、skirtH、skirtMat、doorH、winSill、winHead、wallFin（{'牆索引:面': 材質id}）。",
    input: { patch: z.record(z.string(), z.any()) },
  },
  {
    name: "set_wall_finish",
    title: "牆面材質",
    description:
      "設定某面牆某一面的材質（face 1 或 -1，見 get_state 的 walls[].faces）。material 為 null 表示回到預設。",
    input: { wall: num, face: z.union([z.literal(1), z.literal(-1)]), material: z.string().nullable() },
  },
  {
    name: "edit_base",
    title: "修改底圖",
    description:
      "修改底圖（所有方案共用）：新增／修改／刪除牆、門窗開口、房間名稱、柱子。牆 [x1,y1,x2,y2,厚度]；開口 a、b 為沿牆座標（水平牆＝x、垂直牆＝y），kind win|door|open，opts 例如 { sill, head, style, hinge, side, leafStyle }。",
    input: {
      add_walls: z.array(z.tuple([num, num, num, num, num])).optional(),
      update_walls: z
        .array(
          z.object({
            index: num,
            x1: num.optional(),
            y1: num.optional(),
            x2: num.optional(),
            y2: num.optional(),
            thk: num.optional(),
          }),
        )
        .optional(),
      delete_walls: z.array(num).optional().describe("牆索引（刪除後其他牆的索引會改變）"),
      add_openings: z
        .array(
          z.object({
            wall: num,
            a: num,
            b: num,
            kind: z.enum(["win", "door", "open"]),
            opts: z.record(z.string(), z.any()).optional(),
          }),
        )
        .optional(),
      update_openings: z
        .array(
          z.object({
            wall: num,
            index: num,
            a: num.optional(),
            b: num.optional(),
            kind: z.enum(["win", "door", "open"]).optional(),
            opts: z.record(z.string(), z.any()).optional(),
          }),
        )
        .optional(),
      delete_openings: z.array(z.object({ wall: num, index: num })).optional(),
      set_rooms: z
        .array(z.object({ n: z.string(), s: z.string().optional(), x: num, y: num }))
        .optional()
        .describe("整個取代房間名稱標籤"),
      add_columns: z
        .array(z.tuple([num, num, num, num]))
        .optional()
        .describe("[x1,y1,x2,y2]"),
    },
  },
  {
    name: "designs",
    title: "方案分頁",
    description: "列出、切換、新增（可複製）或重新命名方案分頁。",
    input: {
      action: z.enum(["list", "switch", "add", "rename"]),
      index: num.optional().describe("方案索引（從 0 開始）"),
      name: z.string().optional(),
      copy_from: num.optional().describe("add 時要複製的方案索引"),
    },
  },
  {
    name: "screenshot",
    title: "截圖查看結果",
    description:
      "把目前方案畫成圖片回傳，用來檢查結果。view：plan（平面，可指定 plan 圖面別 layout|floor|ceiling|light|power|hvac|all）、3d（camera iso|front|back|left|right|top，doors 0~1 門片開啟程度）、elevation（指定 wall、face）、cabinet（指定 cabinet_id，doors closed|open）。",
    input: {
      view: z.enum(["plan", "3d", "elevation", "cabinet"]),
      plan: z.string().optional(),
      camera: z.string().optional(),
      doors: z.union([num, z.string()]).optional(),
      wall: num.optional(),
      face: z.union([z.literal(1), z.literal(-1)]).optional(),
      cabinet_id: num.optional(),
      max_width: num.optional().describe("圖片最大寬度 px（預設 1400）"),
    },
  },
  {
    name: "show",
    title: "在網頁上顯示",
    description: "切換網頁的檢視（plan／3d／elev／sched／cab）與圖面別，並可選取物件，讓使用者看到你在說明的地方。",
    input: { view: z.string().optional(), plan: z.string().optional(), select: z.array(num).optional() },
  },
  {
    name: "get_schedule",
    title: "數量估算表",
    description: "取得數量估算表（地坪、牆面、天花面積，櫃體板材，燈具插座、走線、風管…）。",
    input: {},
  },
  {
    name: "get_cabinet",
    title: "櫃體細節",
    description: "取得某個櫃體的參數、板件、裁切清單與五金清單。",
    input: { id: num },
  },
  {
    name: "undo",
    title: "復原",
    description: "復原最近的修改（steps 次，預設 1）。",
    input: { steps: num.optional() },
  },
  {
    name: "redo",
    title: "重做",
    description: "重做（steps 次，預設 1）。",
    input: { steps: num.optional() },
  },
];

const INSTRUCTIONS = `House Layout 是瀏覽器裡的室內設計工具（平面、3D、立面、櫃體工程圖）。這些工具會直接修改使用者開著的網頁，所有修改都能在網頁上復原。
- 單位一律 cm。平面座標 x 向右、y 向下。物件以左上角 (x, y)、寬 w、深 d、順時針旋轉 rot（繞中心）表示；物件正面朝 +y（例如沙發座位、櫃門朝 y=d 那側）。靠牆擺放時讓背面貼牆、正面朝向室內。
- 高度：h（物件高）、elev（離地）。天花高度在 spec.ceilH。it.z 是繪製順序，不是高度。
- 牆 walls[i] = [x1,y1,x2,y2,厚度,開口]；牆面 face 1 是法向量 (−dy, dx) 那側。
- 建議流程：get_state → get_catalog／list_materials → add_items／update_items → screenshot 檢查 → 調整。大改前可用 designs 新增方案分頁，保留原稿。
House Layout is a browser interior-design tool; these tools edit the user's open page (undoable). Units are cm; x right, y down; items use top-left x,y, w, d, rot (clockwise, about center), front faces +y.`;

function makeServer() {
  const server = new McpServer({ name: "house-layout", version: "1.0.0" }, { instructions: INSTRUCTIONS });
  for (const tl of TOOLS)
    server.registerTool(
      tl.name,
      { title: tl.title, description: tl.description, inputSchema: tl.input },
      async args => {
        try {
          const r = await callPage(tl.name, args || {});
          if (r && r.image) {
            const content = [{ type: "image", data: r.image, mimeType: r.mime || "image/png" }];
            if (r.note) content.push({ type: "text", text: r.note });
            return { content };
          }
          return { content: [{ type: "text", text: typeof r === "string" ? r : JSON.stringify(r, null, 1) }] };
        } catch (e) {
          return { content: [{ type: "text", text: "錯誤：" + e.message }], isError: true };
        }
      },
    );
  return server;
}

if (HTTP_MODE) {
  // 無狀態 Streamable HTTP：每個請求建立一組 server／transport
  const hs = http.createServer(async (req, res) => {
    if (new URL(req.url, "http://x").pathname !== "/mcp") {
      res.writeHead(404).end("Not found");
      return;
    }
    if (req.headers.origin && !originOK(req.headers.origin)) {
      res.writeHead(403).end("Forbidden origin");
      return;
    }
    let body;
    if (req.method === "POST") {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      try {
        body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "null");
      } catch (e) {
        res.writeHead(400).end("Bad JSON");
        return;
      }
    }
    const server = makeServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  });
  hs.listen(HTTP_PORT, "127.0.0.1", () => log(`MCP（Streamable HTTP）：http://127.0.0.1:${HTTP_PORT}/mcp`));
} else {
  await makeServer().connect(new StdioServerTransport());
  log("MCP（stdio）已啟動");
}
