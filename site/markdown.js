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

// 公式先换成占位符，等 HTML 生成完再整体渲染，避免 showdown/asciidoctor
// 去转义 LaTeX 里的特殊字符。
function preprocessMath(text) {
  const formulas = [];
  const chineseRegex = /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/;

  const patterns = [
    { regex: /\$\$([\s\S]*?)\$\$/g, display: true },
    { regex: /\\\[([\s\S]*?)\\\]/g, display: true },
    { regex: /\[stem\]\s*\+\+\+\+\s*([\s\S]*?)\s*\+\+\+\+/g, display: true },
    { regex: /\$(?!\$)([^$\n]+?)\$/g, display: false },
    { regex: /\\\(([^)]+?)\\\)/g, display: false },
    { regex: /stem:\[([^\]]+)\]/g, display: false }
  ];

  let idx = 0;
  let processed = text;

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

  return { processedText: processed, formulas };
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
  const { processedText, formulas } = preprocessMath(text);
  const html = makeHtml(processedText);
  return {
    html: renderMathPlaceholders(html, formulas),
    hasMath: formulas.length > 0
  };
}

module.exports = { makeHtml, preprocessMath, renderMathPlaceholders, renderMarkdown };
