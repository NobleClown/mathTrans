/*
 * 离线运行演练
 * 断网条件：路由层阻断一切非本机（非 http://127.0.0.1:8642）请求并记录尝试；
 *          全新浏览器上下文（空缓存）+ CDP 显式清缓存并禁用缓存；
 *          Service Worker 阻断注册。本机 HTTP 服务保留（localhost ≠ 外网）。
 * 运行：node tests/offline-test.mjs
 */
import { chromium } from "playwright-core";
import { writeFileSync } from "node:fs";

const BASE = "http://127.0.0.1:8642/";
const results = [];
const record = (id, name, pass, detail) => {
  results.push({ id, name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${name}  — ${detail}`);
};

const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({
  viewport: { width: 1400, height: 900 },
  serviceWorkers: "block", // 阻断 SW 注册，排除缓存干扰
});
const page = await context.newPage();

// 网络审计：记录一切请求；阻断并记录外部尝试；记录失败请求与响应状态
const net = { all: [], externalAttempted: [], failed: [], responses: [] };
await page.route("**/*", (route) => {
  const url = route.request().url();
  net.all.push(url);
  if (url.startsWith(BASE)) return route.continue();
  net.externalAttempted.push(url);
  return route.abort(); // 模拟断外网：仅本机可达
});
page.on("requestfailed", (req) =>
  net.failed.push({ url: req.url(), err: req.failure()?.errorText })
);
page.on("response", (res) =>
  net.responses.push({ url: res.url(), status: res.status() })
);

// 双保险：CDP 显式清缓存 + 禁用缓存（可审计的演练条件）
const cdp = await context.newCDPSession(page);
await cdp.send("Network.clearBrowserCache");
await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });

await page.goto(BASE);
await page.waitForLoadState("domcontentloaded");
let loaded = true;
try {
  await page.waitForFunction(
    () => {
      const mf = document.getElementById("mf");
      return (
        mf && typeof mf.insert === "function" && typeof window.MathLive !== "undefined"
      );
    },
    null,
    { timeout: 10000 }
  );
} catch {
  loaded = false;
}
record("D1", "断网条件下 MathLive 正常加载（mathfield 可升级可用）", loaded, `加载=${loaded}`);

const swState = await page.evaluate(() =>
  navigator.serviceWorker
    ? navigator.serviceWorker.controller
      ? "active"
      : "none"
    : "unsupported"
);
record("D2", "无 Service Worker / 缓存干扰（净缓存环境）", swState === "none", `serviceWorker.controller=${swState}`);

record(
  "D3", "未发起任何外部（非本机）请求",
  net.externalAttempted.length === 0,
  `外部尝试=${JSON.stringify(net.externalAttempted)}`
);

const localResponses = net.responses.filter((r) => r.url.startsWith(BASE));
const badCore = localResponses.filter(
  (r) => r.status >= 400 && !r.url.includes("favicon")
);
const favicon404 = localResponses.filter(
  (r) => r.status >= 400 && r.url.includes("favicon")
);
record(
  "D4", "本机核心资源全部加载成功（无 4xx/5xx；favicon 404 为浏览器自动请求，非核心）",
  badCore.length === 0,
  `本机响应=${localResponses.length} 核心异常=${JSON.stringify(badCore)} favicon404=${favicon404.length} 请求失败=${JSON.stringify(net.failed)}`
);

// —— 断网条件下的功能实测 ——
await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
const norm = (s) => s.replace(/\s+/g, "").replace(/\{([^{}])\}/g, "$1");

// 键盘输入 + 预览/源码同步
await page.locator("#mf").click();
await page.waitForTimeout(200); // 等编辑区焦点稳定（e2e T1 同款缓冲；否则首字符可能丢失）
const focusedD5 = await page.evaluate(() => document.getElementById("mf").hasFocus());
await page.keyboard.type("x+y=z", { delay: 40 });
const v1 = await page.evaluate(() => document.getElementById("mf").value);
const src1 = await page.evaluate(() => document.getElementById("source").value);
const pv1 = await page.evaluate(() => document.getElementById("preview").innerHTML.length);
record(
  "D5", "键盘输入与预览/源码同步",
  focusedD5 && v1 === "x+y=z" && src1 === "x+y=z" && pv1 > 20,
  `聚焦=${focusedD5} value=${JSON.stringify(v1)} 源码=${JSON.stringify(src1)} 预览长度=${pv1}`
);

// 结构模板（分数）+ 光标定位
await page.evaluate(() => {
  const b = document.getElementById("btn-clear");
  b.click();
  b.click();
});
await page.locator("#mf").click();
await page.getByTitle(/分数：/).click();
await page.keyboard.type("a");
await page.keyboard.press("Tab");
await page.keyboard.type("b");
const v2 = await page.evaluate(() => document.getElementById("mf").value);
record("D6", "结构模板（分数）光标定位与填充", norm(v2) === norm("\\frac{a}{b}"), `value=${JSON.stringify(v2)}`);

// 符号按钮（α 属于「希腊字母」子分类，需先切换子标签——与 e2e T5 序列一致）
await page.getByRole("tab", { name: "符号" }).click();
await page.locator(".subtab", { hasText: "希腊字母" }).click();
await page.getByTitle("α：\\alpha").click();
const v3 = await page.evaluate(() => document.getElementById("mf").value);
record("D7", "符号按钮插入", v3.includes("\\alpha"), `value=${JSON.stringify(v3)}`);

// 矩阵
await page.evaluate(() => {
  const b = document.getElementById("btn-clear");
  b.click();
  b.click();
});
await page.getByRole("tab", { name: "结构模板" }).click(); // D7 停留在符号页签，先切回
await page.locator("#mf").click();
await page.getByTitle(/3×3 矩阵：\\begin\{pmatrix\}/).first().click();
for (let i = 1; i <= 9; i++) {
  await page.keyboard.type(String(i));
  if (i < 9) await page.keyboard.press("Tab");
}
const v4 = await page.evaluate(() => document.getElementById("mf").value);
record(
  "D8", "3×3 矩阵逐格输入",
  norm(v4) === norm("\\begin{pmatrix}1&2&3\\\\4&5&6\\\\7&8&9\\end{pmatrix}"),
  `value=${JSON.stringify(v4.slice(0, 60))}…`
);

// 复制（真实剪贴板）
await page.locator("#btn-copy-latex").click();
await page.waitForTimeout(300);
const clip = await page.evaluate(() => navigator.clipboard.readText());
record("D9", "复制功能（真实剪贴板内容=当前公式）", clip === v4, `剪贴板=${JSON.stringify(clip.slice(0, 30))}…`);

// 网络审计汇总
record(
  "D10", "网络审计：全部请求均为本机资源",
  net.all.every((u) => u.startsWith(BASE)),
  `总请求=${net.all.length}（本机） 外部尝试=${net.externalAttempted.length} 失败=${net.failed.length}`
);

await browser.close();
writeFileSync(
  "tests/offline-results.json",
  JSON.stringify(
    {
      results,
      conditions: {
        browser: "Edge (msedge channel, headless)",
        cache: "全新上下文 + CDP Network.clearBrowserCache + setCacheDisabled",
        serviceWorker: "context serviceWorkers: block",
        offline: "Playwright route 阻断一切非 127.0.0.1:8642 请求；localhost 保留",
      },
      net: {
        total: net.all.length,
        urls: net.all,
        externalAttempted: net.externalAttempted,
        failed: net.failed,
      },
    },
    null,
    2
  )
);
const failed = results.filter((r) => !r.pass);
console.log(`\n==== ${results.length - failed.length}/${results.length} 通过 ====`);
if (failed.length) process.exitCode = 1;
