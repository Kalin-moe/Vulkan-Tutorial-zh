'use strict';

const fs = require('fs');
const path = require('path');
const { loadSiteConfig } = require('./config');
const { processNavRoot } = require('./pages/nav');
const { flushWarnings } = require('./asciidoc');
const { SOURCE_DIR } = require('./paths');
const { buildNavTree, flattenPages } = require('./navigation');
const { escapeHtml } = require('./html');

// 根目录 index.html：教程原文没有首页（靠导航栏浏览），这里放一个通往第一章的
// 入口页，避免访问站点根目录时 404。
//
// 注意：这个文件也会被托管平台当作 404 兜底页返回（Cloudflare Pages 开了 SPA
// 回退时，任何不存在的路径都返回 index.html）。所以跳转只能用脚本、且只在真正的
// 站点根目录执行：用 <meta http-equiv="refresh"> + 相对地址的话，访问 /en/ 会跳到
// /en/zh/…，再被兜底成同一个页面，于是 /en/zh/zh/zh/… 无限叠加。
// 非根路径则显示“没有这个页面”，并给出绝对路径的入口；data-root 是给 HTTP 用的
// 绝对地址，静态 href 保留相对路径，这样 file:// 下双击也能用。
function writeRootPage(config) {
  const primary = config.roots[0];
  if (!primary) return;
  const rootDir = path.join(SOURCE_DIR, primary.path.replace(/^\//, ''));
  const pages = flattenPages(buildNavTree(rootDir, rootDir, config));
  if (!pages.length) return;

  const target = pages[0].outRelative;
  const absolute = `/${target}`;
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(config.name)}</title>
<link rel="canonical" href="${absolute}">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<style>
:root { color-scheme: light dark; }
body {
  margin: 0;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1.25rem;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', 'Helvetica Neue', sans-serif;
  line-height: 1.75;
  color: #111111;
  background: #ffffff;
}
main { width: 100%; max-width: 34rem; }
h1 { font-size: 2rem; line-height: 1.2; margin: 0 0 0.4rem; letter-spacing: -0.02em; }
h2 { font-size: 1.05rem; margin: 1.8rem 0 0.4rem; }
p { margin: 0 0 0.9rem; }
.tagline { color: #555555; }
.actions { display: flex; flex-wrap: wrap; gap: 0.6rem; margin: 1.4rem 0 1.1rem; }
.btn {
  display: inline-flex;
  align-items: center;
  padding: 0.6rem 1.1rem;
  border: 1px solid #dddddd;
  border-radius: 10px;
  font-weight: 600;
  font-size: 0.95rem;
  text-decoration: none;
  color: #111111;
  background: #ffffff;
}
.btn.primary { color: #ffffff; background: #c8102e; border-color: #c8102e; }
.note { color: #6a737d; font-size: 0.88rem; }
.not-found { margin-top: 1.6rem; padding: 0.9rem 1rem; border-radius: 10px; background: #f6f8fa; border: 1px solid #eaecef; }
.not-found p { margin: 0.35rem 0 0; font-size: 0.92rem; }
a { color: #0366d6; }
@media (prefers-color-scheme: dark) {
  body { color: #e6edf3; background: #0d1117; }
  .tagline, .note { color: #a9b4c0; }
  .btn { color: #e6edf3; background: #161b22; border-color: #30363d; }
  .btn.primary { color: #ffffff; background: #c8102e; border-color: #c8102e; }
  .not-found { background: #161b22; border-color: #30363d; }
  a { color: #58a6ff; }
}
</style>
</head>
<body>
<main>
  <h1>${escapeHtml(config.name)}</h1>
  <p class="tagline">${escapeHtml(config.tagline || 'Khronos Vulkan® Tutorial')}</p>
  <p class="actions">
    <a class="btn primary" href="./${target}" data-root="${absolute}">开始阅读</a>
    <a class="btn" href="https://docs.vulkan.org/tutorial/latest/">官方英文版</a>
  </p>
  <p class="note">本站只提供中文页面。</p>
  <div id="not-found" class="not-found" hidden>
    <h2>没有这个页面</h2>
    <p>你访问的地址在本站不存在。中文教程请从 <a href="./${target}" data-root="${absolute}">第一章</a> 开始。</p>
  </div>
</main>
<script>
(function () {
  var isFile = location.protocol === 'file:';
  var path = location.pathname;
  var links = document.querySelectorAll('a[data-root]');
  for (var i = 0; i < links.length; i++) {
    if (!isFile) links[i].setAttribute('href', links[i].getAttribute('data-root'));
  }
  if (isFile || path === '/' || path === '/index.html') {
    location.replace(isFile ? './${target}' : '${absolute}');
    return;
  }
  document.getElementById('not-found').hidden = false;
  document.title = '没有这个页面 · ' + document.title;
})();
</script>
</body>
</html>
`;
  fs.writeFileSync(path.join(SOURCE_DIR, 'index.html'), html);
  console.log(`🏠 index.html（首页跳转 + 404 兜底）`);
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

  writeRootPage(config);

  if (process.argv.includes('--dist')) {
    const { buildDist } = require('./dist');
    await buildDist(config);
  }

  flushWarnings();
  console.log(`\n🎉 构建完成：${total} 个章节页面，用时 ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
}

module.exports = { main };
