// 一次性探针 v2：遍历符号面板所有子标签，收集真实 title
import { chromium } from "playwright-core";

const browser = await chromium.launch({ channel: "msedge", headless: true });
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
await page.getByRole("tab", { name: "符号" }).click();

const subtabs = await page.evaluate(() =>
  [...document.querySelectorAll("#symbol-subtabs .subtab")].map((t) => t.textContent)
);
console.log("子标签：", JSON.stringify(subtabs));

for (const label of subtabs) {
  await page.locator(".subtab", { hasText: label }).click();
  await page.waitForTimeout(150);
  const titles = await page.evaluate(() =>
    [...document.querySelectorAll("#symbols-grid .sym-btn")].map((b) => b.title)
  );
  console.log(`\n[${label}] (${titles.length} 个)`);
  console.log(JSON.stringify(titles));
}
await browser.close();
