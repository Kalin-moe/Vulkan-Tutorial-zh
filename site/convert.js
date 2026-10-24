'use strict';

const fs = require('fs-extra');
const path = require('path');
const cheerio = require('cheerio');
const { makeHtml, preprocessMath, renderMathPlaceholders } = require('./markdown');
const { convertAsciidoc, fixXrefPaths } = require('./asciidoc');
const { generateToc } = require('./navigation');
const { highlightHtml } = require('./highlight');

function wrapToc(inner) {
  return `<div class="toc-header" id="tocToggle"><span>目录</span><span class="arrow">▶</span></div><div class="toc-body" id="tocBody">${inner}</div>`;
}

// ---------- 文档转换 ----------
// contentRoot 是这一组文档的“页面根”（例如 zh/），用于解析 Antora 风格的
// 根相对 xref；externalFallbackBase 是未翻译章节的官方英文站地址。
async function convertDocument(filePath, contentRoot, options = {}) {
  const content = await fs.readFile(filePath, 'utf8');
  const ext = path.extname(filePath).toLowerCase();

  const clean = fixXrefPaths(content, filePath, contentRoot, options.externalFallbackBase || '');
  const { processedText, formulas } = preprocessMath(clean, { asciidoc: ext === '.adoc' });

  let htmlContent;
  if (ext === '.adoc') htmlContent = await convertAsciidoc(processedText, filePath);
  else htmlContent = makeHtml(processedText);
  htmlContent = renderMathPlaceholders(htmlContent, formulas);

  // AsciiDoc 的目录由 Asciidoctor 生成（#toc），取出来放到右侧栏。
  let tocHtml = '';
  if (ext === '.adoc') {
    const $ = cheerio.load(htmlContent, null, false);
    const tocElement = $('#toc');
    if (tocElement.length) {
      const $toc = cheerio.load(tocElement.html() || '', null, false);
      $toc('#toctitle').remove();
      tocHtml = wrapToc($toc.root().html() || '');
      tocElement.remove();
      htmlContent = $.html();
    }
  }
  // 没有章节或 Asciidoctor 没给目录时，退回到自己从标题里提取。
  if (!tocHtml) tocHtml = generateToc(htmlContent);

  // 语法高亮放在最后：目录和公式都处理完了，这里只碰代码块。
  // 生成的 span 是纯展示用的，不参与目录/交叉引用。
  htmlContent = await highlightHtml(htmlContent);

  return {
    htmlContent,
    tocHtml,
    hasMath: formulas.length > 0 || /class="katex/.test(htmlContent)
  };
}

module.exports = { convertDocument, wrapToc };
