'use strict';

const fs = require('fs-extra');
const path = require('path');
const { convertDocument } = require('../convert');
const {
  buildNavTree,
  flattenPages,
  findFirstPageByDir,
  generateBreadcrumb,
  generateNavSidebar
} = require('../navigation');
const { applyTemplate, finalizePage, escapeHtml } = require('../html');
const { SOURCE_DIR, CONFIG_DIR } = require('../paths');
const { stylesFor } = require('../styles');
const { THEME_HEAD, themeButton, SITE_LOGO } = require('../theme');
const { renderFooter } = require('../footer');
const { folderTitle } = require('../config');

function pageNav(prev, next) {
  if (!prev && !next) return '';
  let html = '<nav class="page-nav" aria-label="章节导航">';
  html += prev
    ? `<a class="page-nav-link page-nav-prev" href="${prev.webPath}"><span>← 上一章</span><strong>${escapeHtml(prev.title)}</strong></a>`
    : '<span></span>';
  html += next
    ? `<a class="page-nav-link page-nav-next" href="${next.webPath}"><span>下一章 →</span><strong>${escapeHtml(next.title)}</strong></a>`
    : '<span></span>';
  html += '</nav>';
  return html;
}

function breadcrumbFor(page, rootDir, config, tree) {
  const parts = [];
  const relDir = path.relative(rootDir, path.dirname(page.absolutePath));

  if (relDir && relDir !== '.') {
    let accum = '';
    for (const part of relDir.split(path.sep)) {
      accum = accum ? `${accum}/${part}` : part;
      parts.push({
        name: folderTitle(config, accum, part),
        url: findFirstPageByDir(tree, accum)
      });
    }
  }
  parts.push({ name: page.title, url: null });
  return generateBreadcrumb(parts);
}

async function processNavRoot(rootConfig, config) {
  const cleanPath = rootConfig.path.replace(/^\//, '');
  const rootDir = path.join(SOURCE_DIR, cleanPath);
  if (!fs.existsSync(rootDir)) {
    console.warn(`⚠️  导航目录不存在: ${rootConfig.path}`);
    return 0;
  }
  console.log(`\n📚 ${rootConfig.path}/`);

  const tree = buildNavTree(rootDir, rootDir, config);
  if (!tree.length) {
    console.warn(`⚠️  ${rootConfig.path}/ 下没有可转换的 .adoc/.md 文件`);
    return 0;
  }
  const pages = flattenPages(tree);

  const tplPath = path.join(CONFIG_DIR, rootConfig.template || 'templates/template_nav.html');
  if (!fs.existsSync(tplPath)) {
    console.error(`❌ 模板不存在: ${tplPath}`);
    return 0;
  }

  let count = 0;

  for (let index = 0; index < pages.length; index++) {
    const page = pages[index];
    const outPath = path.join(SOURCE_DIR, page.outRelative);
    const { htmlContent, tocHtml, hasMath } = await convertDocument(page.absolutePath, rootDir, {
      externalFallbackBase: config.external_fallback_base
    });
    const navHtml = generateNavSidebar(tree, page.webPath, rootConfig.title || config.name);

    const finalHtml = applyTemplate(tplPath, {
      title: `${page.title} · ${config.name}`,
      description: config.tagline,
      site_name: config.name,
      tagline: config.tagline,
      author: config.author,
      repo: config.repo,
      site_logo: SITE_LOGO,
      theme_head: THEME_HEAD,
      theme_button: themeButton('header'),
      styles: stylesFor(hasMath),
      nav_sidebar: navHtml,
      breadcrumb: breadcrumbFor(page, rootDir, config, tree),
      toc: tocHtml,
      content: htmlContent,
      prev_next: pageNav(pages[index - 1], pages[index + 1]),
      footer: renderFooter(config)
    });

    fs.ensureDirSync(path.dirname(outPath));
    fs.writeFileSync(outPath, finalizePage(finalHtml, page.outRelative));
    count++;
    console.log(`  ✅ ${page.outRelative}`);
  }

  console.log(`📚 ${rootConfig.path}/ 完成，共 ${count} 个页面`);
  return count;
}

module.exports = { processNavRoot };
