# Math Input — 数学公式输入器

一个独立、本地运行的数学公式输入工具，面向图形学学习场景：点击按钮插入数学结构（分数、矩阵、上下标、求和积分等）与符号，实时预览排版结果，一键复制 LaTeX 源码或 Markdown 公式，用于 ChatGPT 对话、Markdown 笔记与技术文档。

本阶段为独立工具：无后端、无账号、无数据库、无 AI 功能；页面资源全部本地化，无任何外部 URL 引用。

## 启动方法

需要通过本地 HTTP 服务打开（ES 模块与字体在 `file://` 下受浏览器限制）：

```bash
cd mathTrans
python -m http.server 8642
# 浏览器打开 http://127.0.0.1:8642/
```

任何静态文件服务器均可（如 `npx serve`）。核心库为本地构建产物，页面加载后**完全离线可用**——已通过显式断网演练验证（2026-10-11：阻断全部非本机请求 + 净缓存 + 禁用缓存 + 阻断 Service Worker，10/10 通过，见 `tests/offline-test.mjs` 与 `tests/offline-results.json`）。首次部署需要联网获取 vendor 构建产物，之后日常使用完全本地。

## 依赖

| 依赖 | 版本 | 说明 |
|---|---|---|
| MathLive | 0.111.1 | 公式编辑核心（MIT），本地构建产物置于 `vendor/mathlive/`（js + 字体 CSS + 20 个 KaTeX 字体，共约 1.2 MB） |
| 浏览器 | Chrome / Edge 现代版本 | 需支持 Web Components 与 Clipboard API |
| Playwright（仅测试） | 1.x（playwright-core） | E2E 验收测试用，复用系统 Edge，无需下载浏览器 |

`third_party/mathlive/` 是 MathLive 官方源码仓库副本，仅作 API 查阅，不参与运行（本地参考副本，不随仓库分发）。

## 使用

- **编辑区**：直接键入变量、数字、运算符；MathLive 内置 LaTeX 快捷输入（如 `^`、`_`、`/`）。
- **结构模板面板**：20 个模板按钮（分数、上下标、根号、括号、范数、求和、积分、极限、矩阵、分段函数、向量等）。点击后在光标处插入结构，光标自动落到第一个占位符，`Tab` 在占位符间跳转。
- **符号面板**：五个分类（基础运算 / 希腊字母 / 线性代数 / 微积分 / 集合与逻辑），分类切换。
- **图形学面板**：列向量、齐次坐标、3×3/4×4 矩阵、点积叉积、模长归一化、坐标变换、透视/正交投影、坐标空间下标（world/view/clip/ndc/screen）、near/far 参数等 17 个模板 + 5 个下标按钮。
- **实时预览**：随编辑即时更新，与编辑器、源码区共享同一份数据。
- **LaTeX 源码**：只读同步显示，支持全选后手动复制。
- **复制**：复制 LaTeX（纯源码）、复制 `$$…$$` Markdown、复制 `$…$` 行内公式；剪贴板 API 不可用时自动降级 execCommand，失败有明确提示。复制时 MathLive 专有空位符 `\placeholder{}` 自动转换为标准 `\square`（KaTeX/MathJax/ChatGPT 均支持）；填满占位符后复制即为纯标准 LaTeX。
- **清空**：两步确认（再次点击执行；按 Esc 或 4 秒后自动取消），避免误触。
- **载入示例**：一键载入透视投影公式 `x_{ndc}=d·x_{view}/(−z_{view})`。

## 测试

```bash
python -m http.server 8642        # 终端 1
node tests/e2e-test.mjs           # 终端 2：验收测试 T1–T10b（12 项）
node tests/panel-check.mjs        # 终端 3：面板裁切检查 P1–P3
node tests/offline-test.mjs       # 终端 4：离线演练 D1–D10
node tests/capture.mjs            # 终端 5：生成界面截图到 tests/screenshots/
```

测试使用 playwright-core + 系统 Edge（真实键盘事件驱动 MathLive）。验收记录见 `tests/TEST-RECORD.md`。

## 已知限制

1. MathLive 对 LaTeX 的序列化是语义等价规范化（单字符指数省略花括号、`\\` 后补空格），复制出的源码与手写习惯略有差异但语义正确。
2. `file://` 直接双击打开时部分浏览器可能限制剪贴板 API（有降级方案）；推荐本地 HTTP 服务方式。
3. MathLive 编辑器右键菜单保留（含复制/剪切功能），虚拟键盘与无标签菜单图标已隐藏。
4. 极长公式在预览区横向滚动查看；源码区自动换行。
