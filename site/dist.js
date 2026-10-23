'use strict';

const fs = require('fs-extra');
const path = require('path');
const { SOURCE_DIR, relativeToSource, toPosix } = require('./paths');
const { buildNavTree, flattenPages } = require('./navigation');

// Cloudflare Pages 单文件上限 25 MiB；超过的文件会让整次部署失败。
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const DIST_DIR = path.join(SOURCE_DIR, 'dist');

function isExternal(url) {
  return /^(#|mailto:|tel:|javascript:|data:|https?:|\/\/)/i.test(url);
}

// 从生成的 HTML 里收集站内资源：只靠页面实际引用决定 dist 里要放什么，
// 这样 en/、未翻译章节用不到的大文件（比如 30MB 的 gif）不会被带上。
function collectLocalUrls(html) {
  const urls = [];
  const re = /\b(?:href|src)=["']([^"']+)["']/gi;
  let match;
  while ((match = re.exec(html))) urls.push(match[1]);
  return urls;
}

function resolveLocalPath(url, fromFile) {
  let clean = url.split('#')[0].split('?')[0];
  if (!clean || clean === './') return null;
  try {
    clean = decodeURIComponent(clean);
  } catch (error) {
    // 非法百分号编码就按原样处理
  }
  return clean.startsWith('/')
    ? path.join(SOURCE_DIR, clean.replace(/^\//, ''))
    : path.resolve(path.dirname(fromFile), clean);
}

async function buildDist(config) {
  console.log('\n📦 生成部署目录 dist/（仅包含页面引用到的文件）');
  await fs.remove(DIST_DIR);
  await fs.ensureDir(DIST_DIR);

  const sources = new Set();
  const pages = [];

  pages.push(path.join(SOURCE_DIR, 'index.html'));
  for (const root of config.roots) {
    const rootDir = path.join(SOURCE_DIR, root.path.replace(/^\//, ''));
    if (!fs.existsSync(rootDir)) continue;
    for (const page of flattenPages(buildNavTree(rootDir, rootDir, config))) {
      pages.push(path.join(SOURCE_DIR, page.outRelative));
    }
  }

  // 页面本身 + 页面引用到的本地文件
  for (const page of pages) {
    if (!fs.existsSync(page)) continue;
    sources.add(page);
    for (const url of collectLocalUrls(await fs.readFile(page, 'utf8'))) {
      if (isExternal(url)) continue;
      const target = resolveLocalPath(url, page);
      if (!target || !fs.existsSync(target) || !fs.statSync(target).isFile()) continue;
      sources.add(target);
    }
  }

  // 浏览器端脚本、图标、许可
  for (const extra of ['js', 'favicon.svg', 'LICENSE-MIT']) {
    const full = path.join(SOURCE_DIR, extra);
    if (!fs.existsSync(full)) continue;
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      for (const file of await fs.readdir(full)) sources.add(path.join(full, file));
    } else {
      sources.add(full);
    }
  }

  let copied = 0;
  let bytes = 0;
  const oversized = [];
  for (const source of sources) {
    const size = fs.statSync(source).size;
    const rel = toPosix(path.relative(SOURCE_DIR, source));
    if (size > MAX_FILE_SIZE) {
      oversized.push({ rel, size });
      continue;
    }
    const dest = path.join(DIST_DIR, rel);
    await fs.ensureDir(path.dirname(dest));
    await fs.copyFile(source, dest);
    copied++;
    bytes += size;
  }

  if (oversized.length) {
    console.warn(`⚠️  跳过了 ${oversized.length} 个超过 25 MiB 的文件（Cloudflare Pages 限制）：`);
    for (const item of oversized) {
      console.warn(`  · ${item.rel}（${(item.size / 1024 / 1024).toFixed(1)} MB）`);
    }
  }

  const largest = Array.from(sources)
    .filter(source => fs.existsSync(source))
    .map(source => ({ rel: relativeToSource(source), size: fs.statSync(source).size }))
    .sort((a, b) => b.size - a.size)[0];
  console.log(`📦 dist/ 共 ${copied} 个文件，${(bytes / 1024 / 1024).toFixed(1)} MB${largest ? `，最大 ${largest.rel}（${(largest.size / 1024 / 1024).toFixed(1)} MB）` : ''}`);
  console.log('   部署时把 build 输出目录设为 dist 即可。');
}

module.exports = { buildDist, MAX_FILE_SIZE };
