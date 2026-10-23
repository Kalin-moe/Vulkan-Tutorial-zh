'use strict';

const { escapeHtml } = require('./html');

// 页脚：教程正文的许可（CC BY-SA 4.0）和生成器的许可（MIT）分开写清楚，
// 免得读者以为整个仓库都是同一种许可。
function renderFooter(config) {
  const year = new Date().getFullYear();
  const repo = config.repo
    ? ` · <a href="${escapeHtml(config.repo)}">GitHub 仓库</a>`
    : '';
  return `<footer class="site-footer">
  <p>教程内容改编自 <a href="https://github.com/KhronosGroup/Vulkan-Tutorial">Khronos Vulkan® Tutorial</a>，按 <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a> 发布。</p>
  <p>站点生成器 <a href="/LICENSE-MIT">MIT License</a> © ${year} ${escapeHtml(config.author)}${repo}</p>
</footer>`;
}

module.exports = { renderFooter };
