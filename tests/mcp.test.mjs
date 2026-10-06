// MCP 端對端測試：SDK Client（stdio）→ scripts/mcp-server.mjs → WebSocket → 網頁
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { serve } from "../scripts/serve.mjs";

const BASE = +process.env.TEST_PORT || 4199;
const PORT = BASE + 7,
  WS_PORT = BASE + 8,
  URL = `http://127.0.0.1:${PORT}/index.html`;
let server, browser, page, client;
const errors = [];

test.before(async () => {
  server = await serve(PORT, process.env.TEST_ROOT ? path.resolve(process.env.TEST_ROOT) : undefined);
  client = new Client({ name: "test", version: "1" });
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: ["scripts/mcp-server.mjs"],
      env: { ...process.env, HL_MCP_WS_PORT: String(WS_PORT) },
      stderr: "ignore",
    }),
  );
  browser = await chromium.launch({
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("pageerror", e => errors.push(e.message));
  page.on("dialog", d => d.accept());
});
test.after(async () => {
  await client?.close();
  await browser?.close();
  server?.close();
});

const call = async (name, args = {}) => {
  const r = await client.callTool({ name, arguments: args });
  const text = r.content.find(c => c.type === "text");
  return { r, json: text && !r.isError ? safeJSON(text.text) : null, text: text && text.text };
};
const safeJSON = s => {
  try {
    return JSON.parse(s);
  } catch (e) {
    return s;
  }
};

test("列出工具；網頁未連線時回傳清楚的錯誤", async () => {
  const { tools } = await client.listTools();
  const names = tools.map(t => t.name);
  for (const n of ["get_state", "add_items", "update_items", "screenshot", "edit_base", "draw_run"])
    assert.ok(names.includes(n), n);
  const r = await call("get_state");
  assert.equal(r.r.isError, true);
  assert.match(r.text, /尚未連線|not connected/);
});

test("網頁以 ?mcp= 連線後可讀取圖稿", async () => {
  await page.goto(`${URL}?mcp=${WS_PORT}`);
  await page.evaluate(() => localStorage.setItem("hl-tip-off", "1"));
  const sample = JSON.parse(fs.readFileSync("examples/sample-project.json", "utf8"));
  await page.evaluate(d => window.__fp.loadData(d, d.name), sample);
  await page.waitForFunction(() => document.getElementById("mcpPill")?.classList.contains("on"));
  const { json } = await call("get_state");
  assert.equal(json.project, "範例兩房");
  assert.ok(json.base.walls.length >= 8);
  assert.ok(json.items.length > 5);
  assert.ok(json.base.walls[0].faces["1"].side);
});

test("新增、修改、刪除物件與復原", async () => {
  const add = await call("add_items", {
    items: [
      { type: "cabTV", x: 80, y: 342, w: 240, props: { label: "測試電視櫃" } },
      { type: "downlight", x: 300, y: 500, center: true },
    ],
  });
  const [cab, light] = add.json.added;
  assert.ok(cab && light);
  const ids = await page.evaluate(() => window.__fp.state.items.map(i => i.id));
  assert.ok(ids.includes(cab) && ids.includes(light));
  await call("update_items", { items: [{ id: cab, w: 200, elev: 25, props: { cab: { handle: "groove" } } }] });
  const it = await page.evaluate(id => window.__fp.state.items.find(i => i.id === id), cab);
  assert.equal(it.w, 200);
  assert.equal(it.elev, 25);
  assert.equal(it.cab.handle, "groove");
  const cabInfo = await call("get_cabinet", { id: cab });
  assert.ok(cabInfo.json.cutList.length > 0);
  await call("delete_items", { ids: [light] });
  assert.equal(await page.evaluate(id => window.__fp.state.items.some(i => i.id === id), light), false);
  await call("undo");
  assert.equal(await page.evaluate(id => window.__fp.state.items.some(i => i.id === id), light), true);
});

test("規格、牆面材質、底圖開口、走線", async () => {
  await call("set_spec", { patch: { ceilH: 265 } });
  await call("set_wall_finish", { wall: 4, face: 1, material: "paint-sage" });
  const spec = await page.evaluate(() => window.__fp.state.spec);
  assert.equal(spec.ceilH, 265);
  assert.equal(spec.wallFin["4:1"], "paint-sage");
  const bad = await call("set_wall_finish", { wall: 4, face: 1, material: "no-such-mat" });
  assert.equal(bad.r.isError, true);
  const eb = await call("edit_base", { add_openings: [{ wall: 6, a: 100, b: 180, kind: "win", opts: { sill: 100 } }] });
  assert.ok(eb.json.walls[6].openings.some(o => o.kind === "win" && o.opts.sill === 100));
  const run = await call("draw_run", {
    type: "ductSupply",
    points: [
      [700, 420],
      [430, 420],
      [430, 160],
    ],
    props: { dia: 10 },
  });
  assert.equal(run.json.type, "ductSupply");
  assert.equal(run.json.props.pts.length, 3);
});

test("截圖：平面、3D、立面", async () => {
  for (const args of [
    { view: "plan", plan: "ceiling" },
    { view: "3d", camera: "iso" },
    { view: "elevation", wall: 4, face: 1 },
  ]) {
    const { r } = await call("screenshot", args);
    assert.notEqual(r.isError, true, JSON.stringify(r.content).slice(0, 200));
    const img = r.content.find(c => c.type === "image");
    assert.ok(img && img.data.length > 5000, args.view);
  }
});

test("方案分頁：新增複本並切換", async () => {
  const { json } = await call("designs", { action: "add", name: "Claude 提案", copy_from: 0 });
  assert.equal(json.at(-1).name, "Claude 提案");
  assert.equal(json.at(-1).current, true);
});

test("整個流程沒有頁面錯誤", () => {
  assert.deepEqual(errors, []);
});
