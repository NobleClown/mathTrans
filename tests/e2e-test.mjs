/*
 * Math Input 验收测试 T1–T10（v2，全部断言基于探针实证的真实 title）
 * 运行：node tests/e2e-test.mjs   （需先启动：python -m http.server 8642）
 */
import { chromium } from "playwright-core";
import { writeFileSync } from "node:fs";

const BASE = "http://127.0.0.1:8642/";
const results = [];
function record(id, name, pass, detail) {
  results.push({ id, name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${name}  — ${detail}`);
}

// MathLive 序列化规范化：去空白、去单字符花括号（语义等价）
const norm = (s) => s.replace(/\s+/g, "").replace(/\{([^{}])\}/g, "$1");

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on("pageerror", (e) => console.log("  [pageerror]", e.message));

try {
  await page.goto(BASE);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(() => {
    const mf = document.getElementById("mf");
    return mf && typeof mf.insert === "function" && typeof window.MathLive !== "undefined";
  }, null, { timeout: 10000 });

  const state = () =>
    page.evaluate(() => ({
      value: document.getElementById("mf").value,
      source: document.getElementById("source").value,
      previewHTML: document.getElementById("preview").innerHTML,
      previewText: document.getElementById("preview").textContent.trim(),
      errHidden: document.getElementById("preview-error").hidden,
      status: document.getElementById("status").textContent,
    }));

  async function clearAll() {
    const btn = page.locator("#btn-clear");
    await btn.click();
    await btn.click();
    await page.waitForTimeout(100);
  }

  // ============ T1 基础输入 ============
  await clearAll();
  await page.locator("#mf").click();
  await page.keyboard.type("x+y=z", { delay: 40 });
  await page.waitForTimeout(200);
  let s = await state();
  record(
    "T1", "基础输入 x+y=z",
    s.value === "x+y=z" && s.source === "x+y=z" && s.previewHTML.length > 20 && s.errHidden,
    `value=${JSON.stringify(s.value)} source=${JSON.stringify(s.source)} previewLen=${s.previewHTML.length}`
  );

  // ============ T2 分数 ============
  await clearAll();
  await page.locator("#mf").click();
  await page.getByTitle(/分数：/).click();
  await page.keyboard.type("a", { delay: 30 });
  await page.keyboard.press("Tab");
  await page.keyboard.type("b", { delay: 30 });
  await page.waitForTimeout(200);
  s = await state();
  record(
    "T2", "分数模板与光标定位",
    norm(s.value) === norm("\\frac{a}{b}"),
    `value=${JSON.stringify(s.value)}（光标先落分子、Tab 跳分母）`
  );

  // ============ T3 嵌套结构 ============
  await clearAll();
  await page.locator("#mf").click();
  await page.getByTitle(/分数：/).click();
  await page.keyboard.type("a+b", { delay: 30 });
  await page.keyboard.press("Shift+ArrowLeft");
  await page.keyboard.press("^");
  await page.keyboard.type("2", { delay: 30 });
  await page.keyboard.press("Tab");
  await page.keyboard.type("c", { delay: 30 });
  await page.waitForTimeout(200);
  s = await state();
  record(
    "T3", "嵌套结构 (a+b^2)/c",
    norm(s.value) === norm("\\frac{a+b^{2}}{c}"),
    `value=${JSON.stringify(s.value)}`
  );

  // ============ T4 3×3 矩阵 ============
  await clearAll();
  await page.locator("#mf").click();
  await page.getByTitle(/3×3 矩阵：\\begin\{pmatrix\}/).first().click();
  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
  for (let i = 0; i < digits.length; i++) {
    await page.keyboard.type(digits[i], { delay: 30 });
    if (i < digits.length - 1) await page.keyboard.press("Tab");
  }
  await page.waitForTimeout(200);
  s = await state();
  record(
    "T4", "3×3 矩阵逐格输入",
    norm(s.value) === norm("\\begin{pmatrix}1&2&3\\\\4&5&6\\\\7&8&9\\end{pmatrix}"),
    `value=${JSON.stringify(s.value)}`
  );

  // ============ T5 数学符号插入（title 已探针实证） ============
  await clearAll();
  await page.locator("#mf").click();
  await page.getByRole("tab", { name: "符号" }).click();
  await page.locator(".subtab", { hasText: "基础运算" }).click();
  await page.getByTitle("≠：\\ne").click();
  await page.locator(".subtab", { hasText: "希腊字母" }).click();
  await page.getByTitle("α：\\alpha").click();
  await page.locator(".subtab", { hasText: "微积分" }).click();
  await page.getByTitle("偏导数：\\partial").click();
  await page.getByTitle("无穷：\\infty").click();
  await page.locator(".subtab", { hasText: "线性代数" }).click();
  await page.getByTitle("点积：\\cdot").click();
  await page.getByTitle("叉积：\\times").click();
  await page.waitForTimeout(200);
  s = await state();
  const hasAll = ["\\alpha", "\\partial", "\\infty", "\\cdot", "\\times", "\\ne"].every((t) =>
    s.value.includes(t)
  );
  record(
    "T5", "符号面板分类插入",
    hasAll && s.value.startsWith("\\ne"),
    `value=${JSON.stringify(s.value)}（顺序=点击顺序，含 ≠/α/∂/∞/·/×）`
  );

  // ============ T6 图形学公式（透视投影示例） ============
  await clearAll(); // 模板按钮按 F2 规范在光标处插入，先清空再验证独立构建
  await page.getByRole("tab", { name: "图形学" }).click();
  await page.getByTitle(/透视投影：/).click();
  await page.waitForTimeout(200);
  s = await state();
  const sample = "x_{\\mathrm{ndc}}=\\frac{d\\,x_{\\mathrm{view}}}{-z_{\\mathrm{view}}}";
  const previewRendered = s.previewHTML.length > 100;
  record(
    "T6", "图形学公式：透视投影",
    norm(s.value) === norm(sample) && previewRendered && s.errHidden,
    `value=${JSON.stringify(s.value)} previewLen=${s.previewHTML.length}`
  );

  // ============ T7 复制 ============
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.locator("#btn-copy-latex").click();
  await page.waitForTimeout(200);
  const clipLatex = await page.evaluate(() => navigator.clipboard.readText());
  await page.locator("#btn-copy-md").click();
  await page.waitForTimeout(200);
  const clipMd = await page.evaluate(() => navigator.clipboard.readText());
  await page.locator("#btn-copy-inline").click();
  await page.waitForTimeout(200);
  const clipInline = await page.evaluate(() => navigator.clipboard.readText());
  s = await state();
  record(
    "T7", "复制 LaTeX / Markdown / 行内",
    clipLatex === s.value &&
      clipMd === `$$${s.value}$$` &&
      clipInline === `$${s.value}$` &&
      s.status.includes("已复制"),
    `latex=${JSON.stringify(clipLatex.slice(0, 24))}… md=${JSON.stringify(clipMd.slice(0, 6))}… status=${JSON.stringify(s.status)}`
  );

  // ============ T8 清空（二次确认）与恢复 ============
  const clearBtn = page.locator("#btn-clear");
  await clearBtn.click();
  const armedText = await clearBtn.textContent();
  await clearBtn.click();
  await page.waitForTimeout(100);
  s = await state();
  const emptyOk = s.value === "" && s.source === "" && s.previewText.includes("空公式");
  await page.locator("#mf").click();
  await page.keyboard.type("E=mc^2", { delay: 30 });
  await page.waitForTimeout(200);
  const s2 = await state();
  record(
    "T8", "清空（二次确认）与恢复编辑",
    armedText.includes("确认") && emptyOk && norm(s2.value) === norm("E=mc^{2}"),
    `armed=${JSON.stringify(armedText)} 清空后 value=${JSON.stringify(s.value)} 重新输入=${JSON.stringify(s2.value)}`
  );

  // ============ T9 长公式：无破版 + 源码完整可达 + 预览按需可滚（双视口实测） ============
  // 足够长：嵌套分数（分子内再套分数/根号/上下标）+ 矩阵 + 上下标。
  // 宽视口可能恰好放下（不强制滚动）；窄视口预览必然横向溢出（验证真实滚动可达最右）。
  const longLatex =
    "\\begin{pmatrix}\\frac{a}{b}&\\sqrt{x^{2}+y^{2}}&\\sum_{i=1}^{n}x_{i}&\\int_{-\\infty}^{\\infty}f(t)\\,dt\\\\\\lim_{x\\to 0}\\frac{\\sin x}{x}&\\left\\|\\mathbf{v}\\right\\|^{2}&\\frac{\\frac{a}{b}+\\sqrt{c^{2}+d^{2}}}{e^{x_{i}^{2}}}&\\prod_{k=1}^{m}\\left(a_{k}^{2}+b_{k}^{2}\\right)\\end{pmatrix}";

  async function setLongFormula() {
    // setValue 为程序化赋值，不触发 MathLive input 事件；手动派发以走应用真实同步链路
    await page.evaluate((latex) => {
      const mf = document.getElementById("mf");
      mf.setValue(latex);
      mf.dispatchEvent(new Event("input", { bubbles: true }));
    }, longLatex);
    await page.waitForTimeout(300);
  }

  async function checkLayout() {
    return page.evaluate(() => {
      const doc = document.documentElement;
      const preview = document.getElementById("preview");
      const src = document.getElementById("source");
      const cs = getComputedStyle(src);
      // —— 源码：真实尺寸 + 实际 CSS 布局（textarea 软换行）——
      const source = {
        scrollWidth: src.scrollWidth,
        clientWidth: src.clientWidth,
        scrollHeight: src.scrollHeight,
        clientHeight: src.clientHeight,
        whiteSpace: cs.whiteSpace,
      };
      const sourceNoHorizontalOverflow = source.scrollWidth <= source.clientWidth + 2;
      const sourceWraps =
        ["pre-wrap", "break-spaces"].includes(source.whiteSpace) ||
        (src.getAttribute("wrap") || "soft").toLowerCase() !== "off";
      // 内容可达：全部显示（不超高）或真实滚动可到底（scrollTop 实测钳制行为）
      src.scrollTop = 999999;
      const sourceBottomReachable =
        source.scrollHeight - src.scrollTop - source.clientHeight <= 2;
      // —— 预览：仅当实际横向溢出时要求可滚动且真实滚到最右；恰好放下不强制 ——
      const previewOverflowX = preview.scrollWidth > preview.clientWidth + 2;
      const previewOverflowCss = ["auto", "scroll"].includes(
        getComputedStyle(preview).overflowX
      );
      preview.scrollLeft = 999999;
      const previewRightReached =
        preview.scrollWidth - preview.scrollLeft - preview.clientWidth <= 2;
      const bodyNoHorizontalOverflow = doc.scrollWidth <= doc.clientWidth + 2;
      return {
        source, sourceNoHorizontalOverflow, sourceWraps, sourceBottomReachable,
        previewOverflowX, previewOverflowCss, previewRightReached, bodyNoHorizontalOverflow,
      };
    });
  }

  const previewOk = (l) =>
    !l.previewOverflowX || (l.previewOverflowCss && l.previewRightReached);

  // —— 正常视口 1400×900 ——
  await setLongFormula();
  s = await state();
  const layoutWide = await checkLayout();
  record(
    "T9a", "长公式·正常视口：无破版 + 源码完整可达 + 预览按需可滚",
    norm(s.value) === norm(longLatex) &&
      s.source !== "" &&
      s.previewHTML.length > 100 &&
      layoutWide.bodyNoHorizontalOverflow &&
      layoutWide.sourceNoHorizontalOverflow &&
      layoutWide.sourceWraps &&
      layoutWide.sourceBottomReachable &&
      previewOk(layoutWide),
    `valueMatch=${norm(s.value) === norm(longLatex)} 源码已同步=${s.source !== ""} 预览已渲染=${s.previewHTML.length > 100} bodyOverflowX=${!layoutWide.bodyNoHorizontalOverflow} 源码横向溢出=${!layoutWide.sourceNoHorizontalOverflow} 源码滚到底=${layoutWide.sourceBottomReachable} 预览溢出=${layoutWide.previewOverflowX}`
  );

  // —— 窄视口 800×640（单列媒体查询生效、预览最窄）：预览必然横向溢出，验证真实滚动可达最右 ——
  await page.setViewportSize({ width: 800, height: 640 });
  await page.waitForTimeout(300);
  const layoutNarrow = await checkLayout();
  record(
    "T9b", "长公式·窄视口：源码完整可达 + 预览溢出时可真实滚到最右",
    layoutNarrow.bodyNoHorizontalOverflow &&
      layoutNarrow.sourceNoHorizontalOverflow &&
      layoutNarrow.sourceBottomReachable &&
      previewOk(layoutNarrow),
    `bodyOverflowX=${!layoutNarrow.bodyNoHorizontalOverflow} 源码横向溢出=${!layoutNarrow.sourceNoHorizontalOverflow} 源码滚到底=${layoutNarrow.sourceBottomReachable} 预览溢出=${layoutNarrow.previewOverflowX} 溢出时可滚到最右=${layoutNarrow.previewRightReached}`
  );
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.waitForTimeout(200);

  // ============ T10a MathLive 加载失败 → 明确报错 ============
  const page2 = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page2.route("**/vendor/mathlive/mathlive.min.js", (r) => r.abort());
  await page2.goto(BASE);
  await page2.waitForLoadState("domcontentloaded");
  await page2.waitForTimeout(600);
  const failState = await page2.evaluate(() => ({
    banner: !document.getElementById("load-error").hidden,
    bannerText: document.getElementById("load-error").textContent.slice(0, 40),
    clearDisabled: document.getElementById("btn-clear").disabled,
  }));
  record(
    "T10a", "MathLive 加载失败 → 明确报错横幅",
    failState.banner && failState.bannerText.includes("加载失败") && failState.clearDisabled,
    `banner=${failState.banner} clearDisabled=${failState.clearDisabled}`
  );
  await page2.close();

  // ============ T10b 剪贴板受限时有明确反馈 ============
  await page.context().clearPermissions();
  await page.locator("#btn-copy-latex").click();
  await page.waitForTimeout(400);
  s = await state();
  // 无权限时：要么 execCommand 降级成功（已复制），要么失败提示——两者都不得静默
  const handled =
    s.status.includes("已复制") ||
    s.status.includes("复制失败") ||
    s.status.includes("手动");
  record(
    "T10b", "剪贴板受限时有明确反馈（降级成功或失败提示）",
    handled && s.status.length > 0,
    `status=${JSON.stringify(s.status)}`
  );
} catch (e) {
  record("FATAL", "测试执行中断", false, e.message);
}

await browser.close();
writeFileSync("tests/e2e-results.json", JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.pass);
console.log(`\n==== ${results.length - failed.length}/${results.length} 通过 ====`);
if (failed.length) process.exitCode = 1;
