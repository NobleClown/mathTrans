/*
 * Math Input — 独立数学公式输入器
 * 核心依赖：MathLive 0.111.1（本地 vendor/mathlive/mathlive.min.js，全局构建）
 * 无后端、无网络请求、无构建系统。
 */
(function () {
  'use strict';

  // ---------- 加载守卫 ----------
  function fatalIfNoMathLive() {
    if (typeof window.MathLive === 'undefined') {
      var banner = document.getElementById('load-error');
      if (banner) banner.hidden = false;
      document.querySelectorAll('button, math-field, textarea')
        .forEach(function (el) { el.disabled = true; });
      return false;
    }
    return true;
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!fatalIfNoMathLive()) return;
    init();
  });

  function init() {
    var mf = document.getElementById('mf');
    var preview = document.getElementById('preview');
    var previewError = document.getElementById('preview-error');
    var source = document.getElementById('source');
    var statusEl = document.getElementById('status');

    // 关闭按键音效，避免运行时请求音频资源
    try { window.MathfieldElement.soundsDirectory = null; } catch (e) { /* 可选设置 */ }

    var ML = window.MathLive;
    var hasValidate = typeof ML.validateLatex === 'function';
    var hasMarkup = typeof ML.convertLatexToMarkup === 'function';

    // ============================================================
    // 数据：结构模板 / 符号 / 图形学模板
    // latex：点击插入的内容；demo：按钮上展示的静态渲染
    // ============================================================

    var STRUCTURES = [
      { name: '分数', latex: '\\frac{\\placeholder{}}{\\placeholder{}}', demo: '\\frac{a}{b}' },
      { name: '上标', latex: '^{\\placeholder{}}', demo: 'x^{2}' },
      { name: '下标', latex: '_{\\placeholder{}}', demo: 'x_{i}' },
      { name: '上下标', latex: '^{\\placeholder{}}_{\\placeholder{}}', demo: 'x_{i}^{2}' },
      { name: '平方根', latex: '\\sqrt{\\placeholder{}}', demo: '\\sqrt{x}' },
      { name: 'n 次根', latex: '\\sqrt[\\placeholder{}]{\\placeholder{}}', demo: '\\sqrt[n]{x}' },
      { name: '圆括号', latex: '\\left(\\placeholder{}\\right)', demo: '\\left(x\\right)' },
      { name: '方括号', latex: '\\left[\\placeholder{}\\right]', demo: '\\left[x\\right]' },
      { name: '花括号', latex: '\\left\\{\\placeholder{}\\right\\}', demo: '\\left\\{x\\right\\}' },
      { name: '绝对值', latex: '\\left|\\placeholder{}\\right|', demo: '\\left|x\\right|' },
      { name: '范数', latex: '\\left\\|\\placeholder{}\\right\\|', demo: '\\left\\|\\mathbf{v}\\right\\|' },
      { name: '求和', latex: '\\sum_{\\placeholder{}}^{\\placeholder{}}', demo: '\\sum_{i=1}^{n}' },
      { name: '积分', latex: '\\int_{\\placeholder{}}^{\\placeholder{}}', demo: '\\int_{a}^{b}' },
      { name: '极限', latex: '\\lim_{\\placeholder{}\\to\\placeholder{}}', demo: '\\lim_{x\\to 0}' },
      { name: '转置', latex: '^{\\mathrm{T}}', demo: 'A^{\\mathrm{T}}', attach: true },
      { name: '2×2 矩阵', latex: '\\begin{pmatrix}\\placeholder{}&\\placeholder{}\\\\\\placeholder{}&\\placeholder{}\\end{pmatrix}', demo: '\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}' },
      { name: '3×3 矩阵', latex: '\\begin{pmatrix}\\placeholder{}&\\placeholder{}&\\placeholder{}\\\\\\placeholder{}&\\placeholder{}&\\placeholder{}\\\\\\placeholder{}&\\placeholder{}&\\placeholder{}\\end{pmatrix}', demo: '\\begin{pmatrix}a&b&c\\\\d&e&f\\\\g&h&i\\end{pmatrix}' },
      { name: '分段函数', latex: 'f(x)=\\begin{cases}\\placeholder{}&\\placeholder{}\\\\\\placeholder{}&\\placeholder{}\\end{cases}', demo: 'f(x)=\\begin{cases}x&x>0\\\\-x&x\\le 0\\end{cases}' },
      { name: '向量箭头', latex: '\\vec{\\placeholder{}}', demo: '\\vec{v}' },
      { name: '列向量', latex: '\\begin{pmatrix}\\placeholder{}\\\\\\placeholder{}\\\\\\placeholder{}\\end{pmatrix}', demo: '\\begin{pmatrix}x\\\\y\\\\z\\end{pmatrix}' }
    ];

    var GRAPHICS = [
      { name: '三维向量', latex: '\\mathbf{v}=\\begin{bmatrix}\\placeholder{}\\\\\\placeholder{}\\\\\\placeholder{}\\end{bmatrix}', demo: '\\mathbf{v}=\\begin{bmatrix}x\\\\y\\\\z\\end{bmatrix}' },
      { name: '齐次坐标', latex: '\\begin{bmatrix}\\placeholder{}\\\\\\placeholder{}\\\\\\placeholder{}\\\\\\placeholder{}\\end{bmatrix}', demo: '\\begin{bmatrix}x\\\\y\\\\z\\\\1\\end{bmatrix}' },
      { name: '矩阵乘向量', latex: '\\mathbf{M}\\,\\begin{bmatrix}\\placeholder{}\\\\\\placeholder{}\\\\\\placeholder{}\\\\\\placeholder{}\\end{bmatrix}=\\begin{bmatrix}\\placeholder{}\\\\\\placeholder{}\\\\\\placeholder{}\\\\\\placeholder{}\\end{bmatrix}', demo: '\\mathbf{M}\\begin{bmatrix}x\\\\y\\\\z\\\\w\\end{bmatrix}=\\begin{bmatrix}r_1\\\\r_2\\\\r_3\\\\r_4\\end{bmatrix}' },
      { name: '3×3 矩阵', latex: '\\begin{bmatrix}\\placeholder{}&\\placeholder{}&\\placeholder{}\\\\\\placeholder{}&\\placeholder{}&\\placeholder{}\\\\\\placeholder{}&\\placeholder{}&\\placeholder{}\\end{bmatrix}', demo: '\\begin{bmatrix}r_{11}&r_{12}&r_{13}\\\\r_{21}&r_{22}&r_{23}\\\\r_{31}&r_{32}&r_{33}\\end{bmatrix}' },
      { name: '4×4 矩阵', latex: '\\begin{bmatrix}\\placeholder{}&\\placeholder{}&\\placeholder{}&\\placeholder{}\\\\\\placeholder{}&\\placeholder{}&\\placeholder{}&\\placeholder{}\\\\\\placeholder{}&\\placeholder{}&\\placeholder{}&\\placeholder{}\\\\\\placeholder{}&\\placeholder{}&\\placeholder{}&\\placeholder{}\\end{bmatrix}', demo: '\\begin{bmatrix}m_{11}&m_{12}&m_{13}&m_{14}\\\\m_{21}&m_{22}&m_{23}&m_{24}\\\\m_{31}&m_{32}&m_{33}&m_{34}\\\\m_{41}&m_{42}&m_{43}&m_{44}\\end{bmatrix}' },
      { name: '矩阵乘向量', latex: '\\mathbf{M}\\,\\begin{bmatrix}x\\\\y\\\\z\\\\w\\end{bmatrix}=\\begin{bmatrix}\\placeholder{}\\\\\\placeholder{}\\\\\\placeholder{}\\\\\\placeholder{}\\end{bmatrix}', demo: '\\mathbf{M}\\begin{bmatrix}x\\\\y\\\\z\\\\w\\end{bmatrix}=\\begin{bmatrix}r_1\\\\r_2\\\\r_3\\\\r_4\\end{bmatrix}' },
      { name: '点积', latex: '\\mathbf{a}\\cdot\\mathbf{b}', demo: '\\mathbf{a}\\cdot\\mathbf{b}' },
      { name: '叉积', latex: '\\mathbf{a}\\times\\mathbf{b}', demo: '\\mathbf{a}\\times\\mathbf{b}' },
      { name: '模长', latex: '\\left\\|\\placeholder{}\\right\\|', demo: '\\left\\|\\mathbf{v}\\right\\|' },
      { name: '归一化', latex: '\\hat{\\mathbf{v}}=\\frac{\\mathbf{v}}{\\left\\|\\mathbf{v}\\right\\|}', demo: '\\hat{\\mathbf{v}}=\\frac{\\mathbf{v}}{\\left\\|\\mathbf{v}\\right\\|}' },
      { name: '坐标变换', latex: "\\mathbf{p}'=\\mathbf{M}\\,\\mathbf{p}", demo: "\\mathbf{p}'=\\mathbf{M}\\,\\mathbf{p}" },
      { name: '透视投影', latex: 'x_{\\mathrm{ndc}}=\\frac{d\\,x_{\\mathrm{view}}}{-z_{\\mathrm{view}}}', demo: 'x_{\\mathrm{ndc}}=\\frac{d\\,x_{\\mathrm{view}}}{-z_{\\mathrm{view}}}' },
      { name: '正交投影', latex: '\\mathbf{p}_{\\mathrm{ndc}}=\\mathbf{P}_{\\mathrm{ortho}}\\,\\mathbf{p}_{\\mathrm{view}}', demo: '\\mathbf{p}_{\\mathrm{ndc}}=\\mathbf{P}_{\\mathrm{ortho}}\\,\\mathbf{p}_{\\mathrm{view}}' },
      { name: '逆矩阵', latex: '\\mathbf{M}^{-1}', demo: '\\mathbf{M}^{-1}' },
      { name: '转置矩阵', latex: '\\mathbf{M}^{\\mathrm{T}}', demo: '\\mathbf{M}^{\\mathrm{T}}' },
      { name: '逆转置', latex: '\\left(\\mathbf{M}^{\\mathrm{T}}\\right)^{-1}', demo: '\\left(\\mathbf{M}^{\\mathrm{T}}\\right)^{-1}' },
      { name: '单位矩阵', latex: '\\mathbf{I}', demo: '\\mathbf{I}' },
      { name: '近裁剪面', latex: 'z_{\\mathrm{near}}', demo: 'z_{\\mathrm{near}}' },
      { name: '远裁剪面', latex: 'z_{\\mathrm{far}}', demo: 'z_{\\mathrm{far}}' }
    ];

    // 坐标空间下标：附着到光标前的元素
    var GRAPHICS_SUBS = [
      { name: 'world', latex: '_{\\mathrm{world}}', char: 'world' },
      { name: 'view', latex: '_{\\mathrm{view}}', char: 'view' },
      { name: 'clip', latex: '_{\\mathrm{clip}}', char: 'clip' },
      { name: 'ndc', latex: '_{\\mathrm{ndc}}', char: 'ndc' },
      { name: 'screen', latex: '_{\\mathrm{screen}}', char: 'screen' }
    ];

    var SYMBOL_GROUPS = [
      {
        id: 'basic', label: '基础运算', items: [
          { latex: '+', char: '+' },
          { latex: '-', char: '−' },
          { latex: '\\times', char: '×' },
          { latex: '\\div', char: '÷' },
          { latex: '=', char: '=', upright: true },
          { latex: '\\ne', char: '≠', upright: true },
          { latex: '\\approx', char: '≈', upright: true },
          { latex: '<', char: '<', upright: true },
          { latex: '>', char: '>', upright: true },
          { latex: '\\le', char: '≤', upright: true },
          { latex: '\\ge', char: '≥', upright: true },
          { latex: '\\pm', char: '±', upright: true }
        ]
      },
      {
        id: 'greek', label: '希腊字母', items: [
          { latex: '\\alpha', char: 'α' },
          { latex: '\\beta', char: 'β' },
          { latex: '\\gamma', char: 'γ' },
          { latex: '\\delta', char: 'δ' },
          { latex: '\\varepsilon', char: 'ε' },
          { latex: '\\theta', char: 'θ' },
          { latex: '\\lambda', char: 'λ' },
          { latex: '\\mu', char: 'μ' },
          { latex: '\\pi', char: 'π' },
          { latex: '\\rho', char: 'ρ' },
          { latex: '\\sigma', char: 'σ' },
          { latex: '\\tau', char: 'τ' },
          { latex: '\\phi', char: 'φ' },
          { latex: '\\varphi', char: 'ϕ' },
          { latex: '\\omega', char: 'ω' },
          { latex: '\\Gamma', char: 'Γ', upright: true },
          { latex: '\\Delta', char: 'Δ', upright: true },
          { latex: '\\Theta', char: 'Θ', upright: true },
          { latex: '\\Lambda', char: 'Λ', upright: true },
          { latex: '\\Pi', char: 'Π', upright: true },
          { latex: '\\Sigma', char: 'Σ', upright: true },
          { latex: '\\Phi', char: 'Φ', upright: true },
          { latex: '\\Psi', char: 'Ψ', upright: true },
          { latex: '\\Omega', char: 'Ω', upright: true }
        ]
      },
      {
        id: 'linalg', label: '线性代数', items: [
          { latex: '\\det', char: 'det', upright: true, name: '行列式' },
          { latex: '\\dim', char: 'dim', upright: true, name: '维度' },
          { latex: '\\operatorname{tr}', char: 'tr', upright: true, name: '迹' },
          { latex: '\\cdot', char: '·', upright: true, name: '点积' },
          { latex: '\\times', char: '×', upright: true, name: '叉积' },
          { latex: '\\circ', char: '∘', upright: true, name: '复合' },
          { latex: '\\perp', char: '⊥', upright: true, name: '垂直' },
          { latex: '\\parallel', char: '∥', upright: true, name: '平行' }
        ]
      },
      {
        id: 'calculus', label: '微积分', items: [
          { latex: '\\partial', char: '∂', upright: true, name: '偏导数' },
          { latex: '\\nabla', char: '∇', upright: true, name: '梯度' },
          { latex: '\\infty', char: '∞', upright: true, name: '无穷' },
          { latex: '\\propto', char: '∝', upright: true, name: '成正比' },
          { latex: '\\int', char: '∫', upright: true, name: '积分号' },
          { latex: '\\sum', char: '∑', upright: true, name: '求和号' },
          { latex: '\\lim', char: 'lim', upright: true, name: '极限' },
          { latex: '\\frac{d}{d\\placeholder{}}', char: 'd/dx', upright: true, name: '全导数模板' },
          { latex: '\\frac{\\partial}{\\partial\\placeholder{}}', char: '∂/∂x', upright: true, name: '偏导数模板' }
        ]
      },
      {
        id: 'setlogic', label: '集合与逻辑', items: [
          { latex: '\\in', char: '∈', upright: true },
          { latex: '\\notin', char: '∉', upright: true },
          { latex: '\\subset', char: '⊂', upright: true },
          { latex: '\\subseteq', char: '⊆', upright: true },
          { latex: '\\cup', char: '∪', upright: true },
          { latex: '\\cap', char: '∩', upright: true },
          { latex: '\\setminus', char: '∖', upright: true },
          { latex: '\\emptyset', char: '∅', upright: true },
          { latex: '\\forall', char: '∀', upright: true },
          { latex: '\\exists', char: '∃', upright: true },
          { latex: '\\neg', char: '¬', upright: true },
          { latex: '\\land', char: '∧', upright: true },
          { latex: '\\lor', char: '∨', upright: true },
          { latex: '\\Rightarrow', char: '⇒', upright: true },
          { latex: '\\Leftrightarrow', char: '⇔', upright: true }
        ]
      }
    ];

    var SAMPLE_LATEX = 'x_{\\mathrm{ndc}}=\\frac{d\\,x_{\\mathrm{view}}}{-z_{\\mathrm{view}}}';

    // ============================================================
    // 面板构建
    // ============================================================

    function makeButton(className, title) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = className;
      b.title = title;
      return b;
    }

    function buildTemplateGrid(gridEl, items) {
      items.forEach(function (item) {
        var b = makeButton('tpl-btn', item.name + '：' + item.latex);
        var glyph = document.createElement('span');
        glyph.className = 'glyph';
        try {
          glyph.innerHTML = hasMarkup
            ? ML.convertLatexToMarkup(item.demo)
            : escapeHtml(item.demo);
        } catch (e) {
          glyph.textContent = item.name;
        }
        var name = document.createElement('span');
        name.className = 'name';
        name.textContent = item.name;
        b.appendChild(glyph);
        b.appendChild(name);
        b.addEventListener('click', function () { insertLatex(item.latex); });
        gridEl.appendChild(b);
      });
    }

    function buildSymbolGrid(gridEl, items) {
      items.forEach(function (item) {
        var b = makeButton('sym-btn' + (item.upright ? ' upright' : ''),
          (item.name || item.char || item.latex) + '：' + item.latex);
        b.textContent = item.char;
        b.addEventListener('click', function () { insertLatex(item.latex); });
        gridEl.appendChild(b);
      });
    }

    buildTemplateGrid(document.getElementById('structures-grid'), STRUCTURES);
    buildTemplateGrid(document.getElementById('graphics-grid'), GRAPHICS);
    buildSymbolGrid(document.getElementById('graphics-sub-grid'), GRAPHICS_SUBS);

    // 符号分类子标签
    var subtabsNav = document.getElementById('symbol-subtabs');
    var symbolsGrid = document.getElementById('symbols-grid');
    var currentGroup = SYMBOL_GROUPS[0];

    function selectSymbolGroup(group) {
      currentGroup = group;
      subtabsNav.querySelectorAll('.subtab').forEach(function (t) {
        var active = t.dataset.group === group.id;
        t.classList.toggle('is-active', active);
        t.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      symbolsGrid.innerHTML = '';
      buildSymbolGrid(symbolsGrid, group.items);
    }

    SYMBOL_GROUPS.forEach(function (group) {
      var t = document.createElement('button');
      t.type = 'button';
      t.className = 'subtab';
      t.textContent = group.label;
      t.dataset.group = group.id;
      t.addEventListener('click', function () { selectSymbolGroup(group); });
      subtabsNav.appendChild(t);
    });
    selectSymbolGroup(currentGroup);

    // ============================================================
    // Tab 切换
    // ============================================================

    var tabs = [
      { btn: document.getElementById('tab-btn-structures'), page: document.getElementById('tab-structures') },
      { btn: document.getElementById('tab-btn-symbols'), page: document.getElementById('tab-symbols') },
      { btn: document.getElementById('tab-btn-graphics'), page: document.getElementById('tab-graphics') }
    ];
    tabs.forEach(function (tab) {
      tab.btn.addEventListener('click', function () {
        tabs.forEach(function (t) {
          var active = t === tab;
          t.btn.classList.toggle('is-active', active);
          t.btn.setAttribute('aria-selected', active ? 'true' : 'false');
          t.page.classList.toggle('is-active', active);
          t.page.hidden = !active;
        });
      });
    });

    // ============================================================
    // 插入与同步
    // ============================================================

    function insertLatex(latex) {
      mf.insert(latex, { focus: true, selectionMode: 'placeholder', format: 'latex' });
    }

    function escapeHtml(s) {
      return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function update() {
      var latex = mf.value || '';
      source.value = latex;

      if (!latex.trim()) {
        preview.innerHTML = '<span class="empty-state">（空公式 — 在上方键入，或点击右侧按钮插入结构）</span>';
        previewError.hidden = true;
        return;
      }

      // 源码有效性检查（MathLive validateLatex）
      if (hasValidate) {
        var errors;
        try { errors = ML.validateLatex(latex); } catch (e) { errors = []; }
        if (errors && errors.length) {
          var msgs = errors.slice(0, 5).map(function (er) {
            return (er.code || 'error') + (er.arg ? '：' + er.arg : '');
          });
          previewError.textContent = 'LaTeX 语法警告：' + msgs.join('；');
          previewError.hidden = false;
        } else {
          previewError.hidden = true;
        }
      }

      if (hasMarkup) {
        try {
          preview.innerHTML = ML.convertLatexToMarkup(latex);
        } catch (e) {
          preview.innerHTML = '';
          previewError.textContent = '该公式无法渲染：' + e.message;
          previewError.hidden = false;
        }
      } else {
        preview.textContent = latex; // 静态渲染不可用时的兜底：显示源码
      }
    }

    mf.addEventListener('input', update);
    update();

    // ============================================================
    // 复制（含降级方案与失败反馈）
    // ============================================================

    var statusTimer = null;
    function setStatus(msg, isError) {
      statusEl.textContent = msg;
      statusEl.classList.toggle('is-error', !!isError);
      if (statusTimer) clearTimeout(statusTimer);
      statusTimer = setTimeout(function () {
        statusEl.textContent = '';
        statusEl.classList.remove('is-error');
      }, 3000);
    }

    function copyViaExecCommand(text) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      return ok;
    }

    // 导出规范化：\placeholder{} 是 MathLive 专有命令（编辑器内表示待填空位），
    // KaTeX/MathJax 等外部渲染器无法解析；复制时转换为标准 AMS 空位符号 \square
    function normalizeForExport(latex) {
      return (latex || '')
        .replace(/\\placeholder\s*\{[^{}]*\}/g, '\\square')
        .replace(/\\placeholder(?!\s*\{)/g, '\\square');
    }

    // 导出规范化：\placeholder{} 是 MathLive 专有命令（编辑器内表示待填空位），
    // KaTeX/MathJax/ChatGPT 等外部渲染器无法解析；复制时转换为标准 AMS 空位 \square
    function normalizeForExport(latex) {
      return (latex || '').replace(/\\placeholder\s*\{[^{}]*\}/g, '\\square');
    }

    function copyText(text, label) {
      text = normalizeForExport(text);
      text = normalizeForExport(text);
      if (!text || !text.trim()) {
        setStatus('当前公式为空，没有可复制的内容', true);
        return;
      }
      function ok() { setStatus('已复制' + label); }
      function fail(err) {
        setStatus('复制失败：' + (err && err.message ? err.message : err) + '。请在源码区手动选择复制', true);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(ok, function (err) {
          if (copyViaExecCommand(text)) { ok(); } else { fail(err); }
        });
      } else {
        if (copyViaExecCommand(text)) { ok(); } else {
          setStatus('浏览器不支持剪贴板 API，请在源码区手动选择复制', true);
        }
      }
    }

    document.getElementById('btn-copy-latex').addEventListener('click', function () {
      copyText(mf.value || '', ' LaTeX 源码');
    });
    document.getElementById('btn-copy-md').addEventListener('click', function () {
      copyText('$$' + (mf.value || '') + '$$', ' Markdown 公式（独立公式）');
    });
    document.getElementById('btn-copy-inline').addEventListener('click', function () {
      copyText('$' + (mf.value || '') + '$', ' 行内公式');
    });

    document.getElementById('btn-select-source').addEventListener('click', function () {
      source.focus();
      source.select();
      setStatus('已全选源码，可 Ctrl+C 复制');
    });

    // ============================================================
    // 清空（二次确认）与示例
    // ============================================================

    var clearBtn = document.getElementById('btn-clear');
    var clearArmed = false;
    var clearTimer = null;
    function disarmClear() {
      clearArmed = false;
      clearBtn.textContent = '清空公式';
      clearBtn.title = '清空当前公式（需二次确认）';
      clearBtn.classList.remove('armed');
      if (clearTimer) { clearTimeout(clearTimer); clearTimer = null; }
    }
    clearBtn.addEventListener('click', function () {
      if (!clearArmed) {
        clearArmed = true;
        clearBtn.textContent = '确认清空？';
        clearBtn.classList.add('armed');
        clearBtn.title = '再次点击执行清空；按 Esc 或等待片刻可取消';
        clearTimer = setTimeout(disarmClear, 4000);
        return;
      }
      disarmClear();
      mf.setValue('');
      mf.focus();
      update();
      setStatus('已清空');
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && clearArmed) {
        disarmClear();
        setStatus('已取消清空');
      }
    });

    document.getElementById('btn-example').addEventListener('click', function () {
      mf.setValue(SAMPLE_LATEX);
      mf.focus();
      update();
      setStatus('已载入示例：透视投影公式');
    });
  }
})();
