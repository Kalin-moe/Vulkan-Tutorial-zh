'use strict';

const showdown = require('showdown');
const showdownFootnotes = require('showdown-footnotes');
const katex = require('katex');
require('katex/contrib/mhchem');

// 首页 doc.md 用 showdown 转换；正文是 AsciiDoc，用 asciidoc.js。
const converter = new showdown.Converter();
converter.setOption('breaks', true);
converter.setOption('tables', true);
converter.setOption('simplifiedAutoLink', true);
converter.setOption('strikethrough', true);
converter.setOption('tasklists', true);
converter.setOption('emoji', true);
converter.setOption('openLinksInNewWindow', false);
converter.addExtension(showdownFootnotes);

function makeHtml(text) {
  return converter.makeHtml(text);
}

// 代码块里的 $ 通常是 shell/CMake 变量（${VAR}），不是公式。
// 先把代码块整体换成占位符，等公式抽取完再原样放回去，避免 ${A} ... ${B}
// 被当成行内公式。AsciiDoc 认 ----/.... 分隔块，Markdown 认 ``` / ~~~ 围栏。
const DELIMITED_BLOCK_RE = /^(-{4,}|\.{4,})$/;
const FENCE_RE = /^(`{3,}|~{3,})/;

function protectCodeBlocks(text, asciidoc) {
  const lines = text.split('\n');
  const blocks = [];
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const delimited = asciidoc ? line.trim().match(DELIMITED_BLOCK_RE) : null;
    const fenced = asciidoc ? null : line.match(FENCE_RE);
    const marker = delimited ? delimited[1] : (fenced ? fenced[1] : '');
    if (!marker) {
      out.push(line);
      i++;
      continue;
    }

    const char = marker[0];
    let end = i + 1;
    for (; end < lines.length; end++) {
      const closer = lines[end].trim();
      if (closer && closer[0] === char && closer === char.repeat(closer.length) && closer.length >= marker.length) break;
    }
    if (end >= lines.length) end = lines.length - 1;

    const placeholder = `%%KATEXCODE${blocks.length}%%`;
    blocks.push({ placeholder, text: lines.slice(i, end + 1).join('\n') });
    out.push(placeholder);
    i = end + 1;
  }

  return { protectedText: out.join('\n'), blocks };
}

function restoreCodeBlocks(text, blocks) {
  let result = text;
  for (const block of blocks) {
    result = result.split(block.placeholder).join(block.text);
  }
  return result;
}

// 公式先换成占位符，等 HTML 生成完再整体渲染，避免 showdown/asciidoctor
// 去转义 LaTeX 里的特殊字符。
function preprocessMath(text, options = {}) {
  const formulas = [];
  const chineseRegex = /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/;
  const { protectedText, blocks } = protectCodeBlocks(text, options.asciidoc !== false);

  const patterns = [
    { regex: /\$\$([\s\S]*?)\$\$/g, display: true },
    { regex: /\\\[([\s\S]*?)\\\]/g, display: true },
    { regex: /\[stem\]\s*\+\+\+\+\s*([\s\S]*?)\s*\+\+\+\+/g, display: true },
    { regex: /\$(?!\$)([^$\n]+?)\$/g, display: false },
    { regex: /\\\(([^)]+?)\\\)/g, display: false },
    { regex: /stem:\[([^\]]+)\]/g, display: false }
  ];

  let idx = 0;
  let processed = protectedText;

  for (const { regex, display } of patterns) {
    processed = processed.replace(regex, (match, formula) => {
      if (chineseRegex.test(formula)) {
        return match;
      }
      const placeholder = `%%KATEX${idx}%%`;
      formulas.push({ placeholder, tex: formula.trim(), display });
      idx++;
      return placeholder;
    });
  }

  return { processedText: restoreCodeBlocks(processed, blocks), formulas };
}

function renderMathPlaceholders(html, formulas) {
  let result = html;
  formulas.forEach(({ placeholder, tex, display }) => {
    try {
      const rendered = katex.renderToString(tex, { displayMode: display, throwOnError: false, trust: true });
      // 函数形式：KaTeX 输出里可能出现 $& 之类的字符，不能交给字符串替换去解释。
      result = result.replace(placeholder, () => rendered);
    } catch (error) {
      result = result.replace(placeholder, () => `<span class="katex-error">公式渲染错误: ${tex}</span>`);
    }
  });
  return result;
}

function renderMarkdown(text) {
  const { processedText, formulas } = preprocessMath(text, { asciidoc: false });
  const html = makeHtml(processedText);
  return {
    html: renderMathPlaceholders(html, formulas),
    hasMath: formulas.length > 0
  };
}

module.exports = { makeHtml, preprocessMath, renderMathPlaceholders, renderMarkdown };
