/*
 * 结构模板面板底行裁切验证（修复后 DOM 级检查 + 截图证据）
 * 运行：node tests/panel-check.mjs （需先启动本地服务器）
 */
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";

mkdirSync("tests/screenshots/after-fix", { recursive: true });
const results = [];
const record = (id, name, pass, detail) => {
  results.push({ id, name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${name}  — ${detail}`);
};

// 面板可见性检查：所有按钮完整落在滚动容器可视区内
const checkPanel = (page, tabId) =>
  page.evaluate((tabId) => {
    const tabPage = document.getElementById(tabId);
    const cs = getComputedStyle(tabPage);
    const container = tabPage.getBoundingClientRect();
    const btns = [...tabPage.querySelectorAll(".tpl-btn")];
    const clipped = btns
      .map((b) => {
        const r = b.getBoundingClientRect();
        const name = b.querySelector(".name");
        const nr = name ? name.getBoundingClientRect() : r;
        return {
          name: name ? name.textContent : "?",
          overBottom: Math.round(nr.bottom - container.bottom),
          overRight: Math.round(r.right - container.right),
        };
      })
      .filter((x) => x.overBottom > 1 || x.overRight > 1);
    return {
      btnCount: btns.length,
      clipped,
      maxH: cs.maxHeight,
      internalScroll: tabPage.scrollHeight > tabPage.clientHeight + 2,
      bodyOverflowX:
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth + 2,
      pageHeight: document.documentElement.scrollHeight,
    };
  }, tabId);

const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto("http://127.0.0.1:8642/");
  await page.waitForFunction(
    () => {
      const mf = document.getElementById("mf");
      return mf && typeof mf.insert === "function";
    },
    null,
    { timeout: 10000 }
  );
  await page.waitForTimeout(400);

  // P1 正常视口 1400×900：结构模板面板全部按钮完整可见
  const wide = await checkPanel(page, "tab-structures");
  record(
    "P1", "结构面板·1400×900：20 个模板按钮全部完整可见（无裁切、无内部滚动）",
    wide.btnCount === 20 && wide.clipped.length === 0 && !wide.internalScroll && !wide.bodyOverflowX,
    `buttons=${wide.btnCount} 裁切项=${JSON.stringify(wide.clipped)} 内部滚动=${wide.internalScroll} maxHeight=${wide.maxH} bodyOverflowX=${wide.bodyOverflowX} pageHeight=${wide.pageHeight}`
  );
  await page.locator(".column-right").screenshot({
    path: "tests/screenshots/after-fix/panel-1400.png",
  });

  // P2 常见笔记本视口 1366×768
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.waitForTimeout(300);
  const laptop = await checkPanel(page, "tab-structures");
  record(
    "P2", "结构面板·1366×768：全部模板按钮完整可见",
    laptop.btnCount === 20 && laptop.clipped.length === 0 && !laptop.internalScroll && !laptop.bodyOverflowX,
    `裁切项=${JSON.stringify(laptop.clipped)} 内部滚动=${laptop.internalScroll} bodyOverflowX=${laptop.bodyOverflowX} pageHeight=${laptop.pageHeight}`
  );

  // P3 窄视口 800×640（单列布局）：图形学面板内容最多——末行滚动可达且可点击
  await page.setViewportSize({ width: 800, height: 640 });
  await page.waitForTimeout(300);
  await page.getByRole("tab", { name: "图形学" }).click();
  const narrow = await page.evaluate(() => {
    const tabPage = document.getElementById("tab-graphics");
    tabPage.scrollTop = 999999; // 真实滚动到底
    const container = tabPage.getBoundingClientRect();
    const btns = [...tabPage.querySelectorAll(".tpl-btn")];
    const last = btns[btns.length - 1];
    const r = last.getBoundingClientRect();
    return {
      btnCount: btns.length,
      lastBottom: Math.round(r.bottom),
      containerBottom: Math.round(container.bottom),
      lastFullyVisible:
        r.top >= container.top - 1 && r.bottom <= container.bottom + 1,
      bodyOverflowX:
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth + 2,
    };
  });
  // 可操作性：真实点击最后一个模板（远裁剪面）
  await page.locator("#graphics-grid .tpl-btn").last().click();
  const valueAfter = await page.evaluate(() => document.getElementById("mf").value);
  record(
    "P3", "窄视口 800×640：图形学面板末行滚动可达且可点击",
    narrow.btnCount === 17 &&
      narrow.lastFullyVisible &&
      !narrow.bodyOverflowX &&
      valueAfter.includes("far"),
    `buttons=${narrow.btnCount} lastBottom=${narrow.lastBottom} 容器底=${narrow.containerBottom} 末行完整可见=${narrow.lastFullyVisible} bodyOverflowX=${narrow.bodyOverflowX} 点击后 value=${JSON.stringify(valueAfter)}`
  );
  await page.screenshot({
    path: "tests/screenshots/after-fix/panel-800-narrow.png",
  });
} catch (e) {
  record("FATAL", "面板检查中断", false, e.message);
}

await browser.close();
writeFileSync("tests/panel-check-results.json", JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.pass);
console.log(`\n==== ${results.length - failed.length}/${results.length} 通过 ====`);
if (failed.length) process.exitCode = 1;
