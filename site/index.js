'use strict';

const fs = require('fs');
const path = require('path');
const { loadSiteConfig } = require('./config');
const { processNavRoot } = require('./pages/nav');
const { flushWarnings } = require('./asciidoc');
const { SOURCE_DIR } = require('./paths');
const { buildNavTree, flattenPages } = require('./navigation');
const { escapeHtml } = require('./html');

// 根目录 index.html：教程原文没有首页（靠导航栏浏览），这里只放一个跳转到
// 第一章的入口，避免访问站点根目录时 404。
function writeRootRedirect(config) {
  const primary = config.roots[0];
  if (!primary) return;
  const rootDir = path.join(SOURCE_DIR, primary.path.replace(/^\//, ''));
  const pages = flattenPages(buildNavTree(rootDir, rootDir, config));
  if (!pages.length) return;

  const target = pages[0].outRelative;
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="refresh" content="0; url=./${target}">
<link rel="canonical" href="./${target}">
<title>${escapeHtml(config.name)}</title>
</head>
<body>
<p>正在前往 <a href="./${target}">${escapeHtml(config.name)}</a>…</p>
</body>
</html>
`;
  fs.writeFileSync(path.join(SOURCE_DIR, 'index.html'), html);
  console.log(`↪️  index.html -> ${target}`);
}

// ========== 主函数 ==========
async function main() {
  const config = loadSiteConfig();
  const startedAt = Date.now();
  console.log(`🔧 开始构建 ${config.name}`);
  if (!config.roots.length) {
    console.warn('⚠️  config/nav_roots.json 里没有配置 roots。');
  }

  let total = 0;
  for (const root of config.roots) {
    total += await processNavRoot(root, config);
  }

  writeRootRedirect(config);

  if (process.argv.includes('--dist')) {
    const { buildDist } = require('./dist');
    await buildDist(config);
  }

  flushWarnings();
  console.log(`\n🎉 构建完成：${total} 个章节页面，用时 ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
}

module.exports = { main };
