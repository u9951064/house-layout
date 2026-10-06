// 連線 Claude（MCP）：網頁以 WebSocket 連到本機的 MCP server（scripts/mcp-server.mjs），執行 Claude 呼叫的工具
import { t } from "../core/i18n.js";
import { S } from "../core/store.js";
import { $, esc, toast } from "../core/dom.js";
import { registerMenu } from "../ext/registry.js";

const KEY_AUTO = "hl-mcp-auto",
  KEY_PORT = "hl-mcp-port";
let ws = null,
  want = false,
  timer = null,
  status = "off"; // off | wait | on
const logs = [];
// 會修改圖稿的工具（完成時顯示提示）
const MUTATE = new Set([
  "open_project",
  "add_material",
  "add_items",
  "update_items",
  "delete_items",
  "draw_run",
  "set_spec",
  "set_wall_finish",
  "edit_base",
  "designs",
  "undo",
  "redo",
]);

const port = () => +localStorage.getItem(KEY_PORT) || 8766;

export function connect() {
  want = true;
  localStorage.setItem(KEY_AUTO, "1");
  open();
}
export function disconnect() {
  want = false;
  localStorage.removeItem(KEY_AUTO);
  clearTimeout(timer);
  if (ws) ws.close();
  ws = null;
  setStatus("off");
}
function open() {
  clearTimeout(timer);
  if (ws && ws.readyState <= 1) return;
  setStatus("wait");
  let sock;
  try {
    sock = new WebSocket(`ws://127.0.0.1:${port()}`);
  } catch (e) {
    retry();
    return;
  }
  ws = sock;
  sock.onopen = () => {
    setStatus("on");
    sock.send(JSON.stringify({ type: "hello", app: "house-layout", project: S.PROJ ? S.PROJ.name : null }));
  };
  sock.onmessage = e => handle(sock, e.data);
  sock.onclose = () => {
    if (ws === sock) ws = null;
    if (want) retry();
    else setStatus("off");
  };
  sock.onerror = () => {};
}
function retry() {
  setStatus("wait");
  clearTimeout(timer);
  timer = setTimeout(open, 2500);
}
async function handle(sock, data) {
  let m;
  try {
    m = JSON.parse(data);
  } catch (e) {
    return;
  }
  if (!m || !m.tool) return;
  const entry = { at: new Date(), tool: m.tool, ok: null, msg: "" };
  logs.unshift(entry);
  logs.length = Math.min(logs.length, 60);
  setBusy(true);
  try {
    const { HANDLERS } = await import("./handlers.js");
    const fn = HANDLERS[m.tool];
    if (!fn) throw new Error(t("網頁不支援這個工具：{name}", { name: m.tool }));
    const result = await fn(m.args || {});
    entry.ok = true;
    entry.msg = summary(m.tool, m.args, result);
    sock.send(JSON.stringify({ id: m.id, ok: true, result }));
    if (MUTATE.has(m.tool)) toast("🤖 " + entry.msg);
  } catch (err) {
    entry.ok = false;
    entry.msg = err.message;
    sock.send(JSON.stringify({ id: m.id, ok: false, error: err.message }));
  } finally {
    setBusy(false);
    renderLog();
  }
}
function summary(tool, a = {}, r = {}) {
  const n = x => (Array.isArray(x) ? x.length : 0);
  switch (tool) {
    case "open_project":
      return t("Claude 開啟了專案「{name}」", { name: r.project });
    case "add_material":
      return t("Claude 新增了材質「{name}」", { name: a.name });
    case "add_items":
      return t("Claude 新增了 {n} 個物件", { n: n(a.items) });
    case "update_items":
      return t("Claude 修改了 {n} 個物件", { n: n(a.items) });
    case "delete_items":
      return t("Claude 刪除了 {n} 個物件", { n: r.deleted ?? n(a.ids) });
    case "draw_run":
      return t("Claude 畫了一段 {type}", { type: a.type });
    case "set_spec":
    case "set_wall_finish":
      return t("Claude 調整了設計規格／材質");
    case "edit_base":
      return t("Claude 修改了底圖");
    case "designs":
      return t("Claude 操作了方案分頁");
    case "screenshot":
      return t("Claude 查看了截圖（{view}）", { view: a.view });
    case "undo":
    case "redo":
      return tool === "undo" ? t("Claude 復原了修改") : t("Claude 重做了修改");
    default:
      return t("Claude 讀取了 {tool}", { tool });
  }
}

// —— 介面 ——
function setStatus(s) {
  status = s;
  const pill = $("mcpPill");
  if (pill) {
    pill.hidden = s === "off";
    pill.className = "mcp-pill " + s;
    pill.textContent = s === "on" ? "🤖 Claude" : "🤖 …";
    pill.title = s === "on" ? t("已連線 Claude（MCP）") : t("等待 MCP server…");
  }
  renderModal();
}
function setBusy(b) {
  const pill = $("mcpPill");
  if (pill) pill.classList.toggle("busy", b);
}
function statusText() {
  return status === "on"
    ? `🟢 ${t("已連線，Claude 可以讀取與修改目前的圖稿")}`
    : status === "wait"
      ? `🟡 ${t("等待本機 MCP server（ws://127.0.0.1:{port}）…", { port: port() })}`
      : `⚪ ${t("未連線")}`;
}
function renderLog() {
  const box = $("mcpLog");
  if (!box) return;
  box.innerHTML = logs.length
    ? logs
        .map(
          l =>
            `<div class="${l.ok === false ? "err" : ""}"><span class="muted">${l.at.toLocaleTimeString()}</span> <code>${esc(l.tool)}</code> ${esc(l.msg)}</div>`,
        )
        .join("")
    : `<div class="muted">${t("還沒有任何操作。")}</div>`;
}
function renderModal() {
  const st = $("mcpStatus");
  if (!st) return;
  st.textContent = statusText();
  $("mcpConnect").textContent = want ? t("中斷連線") : t("連線");
  $("mcpConnect").classList.toggle("primary", !want);
}
const CMD_CODE = "claude mcp add house-layout -- node /path/to/house-layout/scripts/mcp-server.mjs";
const CMD_HTTP = "claude mcp add --transport http house-layout http://127.0.0.1:8765/mcp";
const DESKTOP = `{
  "mcpServers": {
    "house-layout": {
      "command": "node",
      "args": ["/path/to/house-layout/scripts/mcp-server.mjs"]
    }
  }
}`;
export function openMcpModal() {
  let m = $("mcpModal");
  if (!m) {
    m = document.createElement("div");
    m.id = "mcpModal";
    m.innerHTML = `<div class="gcard" style="width:min(720px,94vw)">
  <h2>🤖 ${t("連線 Claude（MCP）")}</h2>
  <p style="margin-top:0">${t("讓 Claude 透過 MCP 工具讀取、修改並截圖查看這個網頁上的圖稿：用一句話請它擺家具、畫櫃體、配燈具插座、換材質，或依你的描述調整格局。所有修改都可以「復原」。")}</p>
  <div class="mcp-row"><b id="mcpStatus"></b><span class="grow"></span>
    <label class="toggle"><input id="mcpAuto" type="checkbox">${t("開啟網頁時自動連線")}</label>
    <label>${t("連線埠")} <input id="mcpPort" type="number" min="1024" max="65535" style="width:80px"></label>
    <button id="mcpConnect"></button></div>
  <ol class="mcp-steps">
    <li>${t("在電腦上啟動 MCP server（需要 Node.js）：")}
      <ul>
        <li><b>Claude Code</b>：${t("在 house-layout 專案資料夾執行 claude 會自動載入 .mcp.json；或在任何地方加入：")}<pre>${CMD_CODE}</pre></li>
        <li><b>Claude Desktop</b>：${t("在設定檔（claude_desktop_config.json）加入：")}<pre>${esc(DESKTOP)}</pre></li>
        <li>${t("或以 HTTP 模式執行 npm run mcp，再加入：")}<pre>${CMD_HTTP}</pre></li>
      </ul></li>
    <li>${t("按上方「連線」，狀態變成綠燈。")}</li>
    <li>${t("在 Claude 輸入需求，例如：「把客廳電視櫃改成 240 公分、加六盞嵌燈並接到同一個開關，畫好後給我看 3D」。")}</li>
  </ol>
  <p class="warn" style="color:#9a3412">${t("隱私：連線後，Claude 會讀取目前專案的資料（包含底圖格局）並傳送到 Anthropic 處理。不按「連線」就不會傳送；網頁本身仍然沒有伺服器。")}</p>
  <b>${t("操作紀錄")}</b>
  <div id="mcpLog" class="mcp-log"></div>
  <div class="actions" style="justify-content:flex-end"><button id="mcpClose">${t("關閉")}</button></div>
</div>`;
    document.body.appendChild(m);
    m.addEventListener("click", e => e.target === m && m.classList.remove("show"));
    $("mcpClose").onclick = () => m.classList.remove("show");
    $("mcpConnect").onclick = () => (want ? disconnect() : connect());
    $("mcpAuto").onchange = e =>
      e.target.checked ? localStorage.setItem(KEY_AUTO, "1") : localStorage.removeItem(KEY_AUTO);
    $("mcpPort").onchange = e => {
      localStorage.setItem(KEY_PORT, String(+e.target.value || 8766));
      if (want) {
        if (ws) ws.close();
        open();
      }
    };
  }
  $("mcpAuto").checked = !!localStorage.getItem(KEY_AUTO);
  $("mcpPort").value = port();
  renderModal();
  renderLog();
  m.classList.add("show");
}

export function register() {
  registerMenu("design", () => [{ t: "🤖 " + t("連線 Claude（MCP）…"), f: openMcpModal }]);
  registerMenu("help", () => [{ t: "🤖 " + t("連線 Claude（MCP）…"), f: openMcpModal }]);
}
export function init() {
  const pill = document.createElement("button");
  pill.id = "mcpPill";
  pill.hidden = true;
  pill.onclick = openMcpModal;
  const sel = $("selProj");
  sel.parentNode.insertBefore(pill, sel.nextSibling);
  const q = new URLSearchParams(location.search).get("mcp");
  if (q && /^\d+$/.test(q) && +q > 1) localStorage.setItem(KEY_PORT, q);
  if (q || localStorage.getItem(KEY_AUTO)) connect();
}
