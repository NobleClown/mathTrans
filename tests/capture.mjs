// 设计评审截图：捕获四个代表性状态
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

mkdirSync("tests/screenshots", { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:8642/");
await page.waitForFunction(
  () => {
    const mf = document.getElementById("mf");
    return mf && typeof mf.insert === "function";
  },
  null,
  { timeout: 10000 }
);
await page.waitForTimeout(500);

// 1. 初始空态（结构模板 tab）
await page.screenshot({ path: "tests/screenshots/01-initial.png" });

// 2. 载入示例（透视投影公式：编辑+预览+源码+复制状态）
await page.locator("#btn-example").click();
await page.waitForTimeout(400);
await page.screenshot({ path: "tests/screenshots/02-sample-loaded.png" });

// 3. 符号面板 - 微积分分类
await page.getByRole("tab", { name: "符号" }).click();
await page.locator(".subtab", { hasText: "微积分" }).click();
await page.waitForTimeout(200);
await page.screenshot({ path: "tests/screenshots/03-symbols-calculus.png" });

// 4. 长公式 + 源码展开（布局压力状态）
// 注意：setValue 是程序化赋值，不触发 MathLive 的 input 事件；
// 应用 UI 路径（按钮/键盘）都会自动同步，此处手动派发以模拟真实同步链路。
await page.evaluate(() => {
  const mf = document.getElementById("mf");
  mf.setValue(
    "\\begin{pmatrix}\\frac{a}{b}&\\sqrt{x^{2}+y^{2}}&\\sum_{i=1}^{n}x_{i}\\\\\\int_{-\\infty}^{\\infty}f(t)\\,dt&\\lim_{x\\to 0}\\frac{\\sin x}{x}&\\left\\|\\mathbf{v}\\right\\|^{2}\\end{pmatrix}"
  );
  mf.dispatchEvent(new Event("input", { bubbles: true }));
});
await page.waitForTimeout(400);
await page.screenshot({ path: "tests/screenshots/04-long-formula.png" });

// 5. 清空确认态（交互反馈）
await page.locator("#btn-clear").click();
await page.waitForTimeout(200);
await page.screenshot({ path: "tests/screenshots/05-clear-armed.png" });

await browser.close();
console.log("截图完成：tests/screenshots/01-05");
