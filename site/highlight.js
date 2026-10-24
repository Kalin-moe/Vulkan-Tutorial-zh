'use strict';

const cheerio = require('cheerio');
const { escapeHtml } = require('./html');

// 构建时语法高亮（Shiki）
// ---------------------------------------------------------------------------
// 在 AsciiDoc/Markdown 转成 HTML 之后，把 <pre><code class="language-…"> 里的
// 纯文本交给 Shiki（VS Code 同款 TextMate 语法）重新着色，输出仍是静态 HTML：
//   <pre class="highlight shiki" style="--shiki-light:…;--shiki-dark:…">
//     <code class="language-c++" data-lang="c++"><span style="…">int</span> …
//
// 这样做的原因：
//   · 浏览器端不需要加载任何高亮脚本，没有“先白后彩”的闪动，禁用 JS 也能看；
//   · 颜色写成 --shiki-light / --shiki-dark 两个 CSS 变量，
//     站点现有的 data-theme 切换直接复用，不用为深色主题准备第二套 HTML；
//   · 复制按钮（js/code-copy.js）读的 language-* 类和 innerText 都保持不变。
// ---------------------------------------------------------------------------

const THEMES = { light: 'github-light-default', dark: 'github-dark-default' };

// 语法名映射：AsciiDoc 里写的语言名不一定等于 Shiki 的语法名。
// Slang 是 HLSL 方言，用 hlsl 语法上色最接近；GLSL 两种写法都很常见。
const LANGUAGE_ALIASES = new Map([
  ['c++', 'cpp'],
  ['cpp', 'cpp'],
  ['cxx', 'cpp'],
  ['cc', 'cpp'],
  ['c', 'c'],
  ['slang', 'hlsl'],
  ['hlsl', 'hlsl'],
  ['glsl', 'glsl'],
  ['vert', 'glsl'],
  ['frag', 'glsl'],
  ['cmake', 'cmake'],
  ['bash', 'bash'],
  ['sh', 'shellscript'],
  ['shell', 'shellscript'],
  ['zsh', 'shellscript'],
  ['console', 'shellscript'],
  ['bat', 'bat'],
  ['batch', 'bat'],
  ['cmd', 'bat'],
  ['groovy', 'groovy'],
  ['xml', 'xml'],
  ['html', 'html'],
  ['css', 'css'],
  ['java', 'java'],
  ['json', 'json'],
  ['yaml', 'yaml'],
  ['yml', 'yaml'],
  ['toml', 'toml'],
  ['ini', 'ini'],
  ['diff', 'diff'],
  ['patch', 'diff'],
  ['makefile', 'makefile'],
  ['make', 'makefile'],
  ['dockerfile', 'dockerfile'],
  ['python', 'python'],
  ['py', 'python'],
  ['javascript', 'javascript'],
  ['js', 'javascript'],
  ['typescript', 'typescript'],
  ['ts', 'typescript'],
  ['rust', 'rust'],
  ['go', 'go'],
  ['lua', 'lua'],
  ['sql', 'sql'],
  ['powershell', 'powershell'],
  ['ps1', 'powershell']
]);

// 没有语法、或本来就该按纯文本显示的块：不包 span，少一堆无意义的标记。
const PLAIN_LANGUAGES = new Set(['', 'text', 'plaintext', 'txt', 'none', 'output', 'terminal']);

let highlighterPromise = null;
let highlighterFailed = false;
const loadedLanguages = new Set();
const htmlCache = new Map();

// Shiki 是纯 ESM 包，这里从 CommonJS 里用动态 import 按需加载；
// 整个构建过程只创建一次 highlighter（oniguruma wasm 只初始化一次）。
function getHighlighter() {
  if (highlighterFailed) return Promise.resolve(null);
  if (!highlighterPromise) {
    highlighterPromise = import('shiki')
      .then(({ createHighlighter }) => createHighlighter({ themes: [THEMES.light, THEMES.dark], langs: [] }))
      .catch(error => {
        highlighterFailed = true;
        console.warn(`⚠️  Shiki 加载失败，本次构建跳过代码高亮：${error.message}`);
        return null;
      });
  }
  return highlighterPromise;
}

// 按需加载语法。未知语言不报错，只是这个代码块保持纯文本。
async function ensureLanguage(highlighter, lang) {
  if (loadedLanguages.has(lang)) return true;
  try {
    await highlighter.loadLanguage(lang);
    loadedLanguages.add(lang);
    return true;
  } catch (error) {
    console.warn(`⚠️  未知的代码语言 "${lang}"，该代码块不做高亮`);
    return false;
  }
}

function styleToString(htmlStyle) {
  if (!htmlStyle) return '';
  return Object.entries(htmlStyle)
    .map(([key, value]) => `${key}:${value}`)
    .join(';');
}

// 把 Shiki 的 token 拼成 HTML。相邻且样式相同的 token 合并成一个 span，
// 空白和普通标识符往往占大量 token，合并后页面能小不少。
function renderTokens(tokens) {
  let html = '';
  let pendingStyle = null;
  let pendingText = '';

  const flush = () => {
    if (!pendingText) return;
    const text = escapeHtml(pendingText);
    html += pendingStyle ? `<span style="${pendingStyle}">${text}</span>` : text;
    pendingText = '';
  };

  for (const line of tokens) {
    for (const token of line) {
      const style = styleToString(token.htmlStyle);
      if (style !== pendingStyle) {
        flush();
        pendingStyle = style;
      }
      pendingText += token.content;
    }
    // Shiki 按行返回 token，换行本身不在 token 内容里，这里补回去。
    pendingText += '\n';
  }
  // 最后一行末尾的换行是多余补的，去掉（codeToTokens 已按实际内容分行）。
  if (pendingText.endsWith('\n')) pendingText = pendingText.slice(0, -1);
  flush();
  return html;
}

// 生成一个代码块的内部 HTML；Plain 语言返回 null。
async function highlightCode(highlighter, code, lang) {
  const key = `${lang}\u0000${code}`;
  if (htmlCache.has(key)) return htmlCache.get(key);

  let result;
  try {
    const { tokens, fg } = highlighter.codeToTokens(code, {
      lang,
      themes: THEMES,
      defaultColor: false
    });
    result = { inner: renderTokens(tokens), fg: fg || '' };
  } catch (error) {
    console.warn(`⚠️  代码高亮失败（${lang}）：${error.message}`);
    return null;
  }

  htmlCache.set(key, result);
  return result;
}

function readLanguage($code) {
  const dataLang = $code.attr('data-lang') || '';
  if (dataLang) return dataLang.trim().toLowerCase();
  const className = $code.attr('class') || '';
  const match = className.match(/language-([^\s]+)/);
  return match ? match[1].trim().toLowerCase() : '';
}

// 入口：接收一页 HTML，返回替换好 token 的 HTML。
// 没有任何可高亮的代码块时原样返回，避免一次多余的 cheerio 解析/序列化。
async function highlightHtml(html) {
  if (!html || html.indexOf('<pre') === -1) return html;

  const $ = cheerio.load(html, null, false);
  const targets = [];

  $('pre').each((_, pre) => {
    const $pre = $(pre);
    const $code = $pre.children('code').first();
    if (!$code.length) return;

    // 代码块里已经有标记（例如公式渲染出来的 <span class="katex">）时不要重新着色，
    // 否则 $code.text() 会把公式拆成纯文本再高亮一遍。
    if ($code.children().length) return;

    const raw = readLanguage($code);
    if (PLAIN_LANGUAGES.has(raw)) return;

    const lang = LANGUAGE_ALIASES.get(raw) || raw;
    targets.push({ $pre, $code, lang });
  });

  if (!targets.length) return html;

  const highlighter = await getHighlighter();
  if (!highlighter) return html;

  const langs = [...new Set(targets.map(target => target.lang))];
  const usable = new Set();
  for (const lang of langs) {
    if (await ensureLanguage(highlighter, lang)) usable.add(lang);
  }

  let changed = false;
  for (const { $pre, $code, lang } of targets) {
    if (!usable.has(lang)) continue;
    const code = $code.text();
    if (!code) continue;

    const highlighted = await highlightCode(highlighter, code, lang);
    if (!highlighted) continue;

    $code.html(highlighted.inner);
    $pre.addClass('shiki');
    if (highlighted.fg) {
      const existing = $pre.attr('style');
      $pre.attr('style', existing ? `${existing};${highlighted.fg}` : highlighted.fg);
    }
    changed = true;
  }

  return changed ? $.html() : html;
}

module.exports = { highlightHtml };
