'use strict';

// 构建产物自检：每次构建后跑一遍，确认
//   1. 每个 .adoc 都生成了对应的 .html；
//   2. 页面里没有漏替换的 {{占位符}}、没有空标题；
//   3. 页面内的站内链接（href/src）都能在仓库里找到对应文件。
// 用法：node site/check.js（或 npm test）

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const glob = require('glob');
const { loadSiteConfig } = require('./config');
const { SOURCE_DIR, IGNORE_DIRS, relativeToSource } = require('./paths');
const { buildNavTree, flattenPages } = require('./navigation');

const globSync = glob.globSync || (glob.sync ? glob.sync : null) || glob;
const config = loadSiteConfig();

let failures = 0;
let checkedLinks = 0;
let checkedPages = 0;

function fail(message) {
  failures++;
  console.error(`  ✗ ${message}`);
}

function note(message) {
  console.log(`  ✓ ${message}`);
}

// 站内 URL -> 磁盘路径（生成物已改成相对路径，这里两种写法都支持）。
function resolveTarget(url, fromFile) {
  let target = url.split('#')[0].split('?')[0];
  if (!target) return null;
  try {
    target = decodeURIComponent(target);
  } catch (error) {
    // 非法的百分号编码就当原样路径处理
  }
  if (target.startsWith('/')) return path.join(SOURCE_DIR, target.replace(/^\//, ''));
  return path.resolve(path.dirname(fromFile), target);
}

function checkLinks(document, file) {
  const nodes = Array.from(document.querySelectorAll('a[href], img[src], script[src], link[href]'));
  for (const node of nodes) {
    const attr = node.hasAttribute('href') ? 'href' : 'src';
    const url = node.getAttribute(attr);
    if (!url || /^(#|mailto:|tel:|javascript:|data:|https?:|\/\/)/i.test(url)) continue;
    const target = resolveTarget(url, file);
    if (!target) continue;
    checkedLinks++;
    if (!fs.existsSync(target)) {
      fail(`${relativeToSource(file)}: 链接找不到目标 ${url}`);
    }
  }
}

function checkPage(file) {
  const html = fs.readFileSync(file, 'utf8');
  const rel = relativeToSource(file);
  checkedPages++;

  if (/\{\{[a-z_]+\}\}/.test(html)) fail(`${rel}: 仍有未替换的模板占位符`);
  if (!/<title>.+?<\/title>/.test(html)) fail(`${rel}: 缺少 <title>`);

  const dom = new JSDOM(html);
  const document = dom.window.document;
  if (!document.querySelector('.markdown-body')) fail(`${rel}: 缺少正文容器 .markdown-body`);
  checkLinks(document, file);
  dom.window.close();
}

function main() {
  console.log(`🔍 检查 ${config.name} 的构建产物`);

  // 1. 每个源文件都有产物
  for (const root of config.roots) {
    const rootRel = root.path.replace(/^\//, '');
    const rootDir = path.join(SOURCE_DIR, rootRel);
    if (!fs.existsSync(rootDir)) {
      fail(`缺少内容目录 ${rootRel}/`);
      continue;
    }
    const tree = buildNavTree(rootDir, rootDir, config);
    const pages = flattenPages(tree);
    for (const page of pages) {
      const out = path.join(SOURCE_DIR, page.outRelative);
      if (!fs.existsSync(out)) fail(`缺少产物 ${page.outRelative}（源：${page.filePath}）`);
    }
    note(`${rootRel}/：${pages.length} 个源文件`);

    const sources = globSync(`${rootRel}/**/*.{adoc,md}`, {
      cwd: SOURCE_DIR,
      ignore: IGNORE_DIRS.map(dir => `${dir}/**`)
    });
    const missing = sources.filter(src => !fs.existsSync(path.join(SOURCE_DIR, src.replace(/\.(adoc|md)$/i, '.html'))));
    if (missing.length) fail(`有 ${missing.length} 个源文件没有对应 HTML：${missing.slice(0, 5).join(', ')}`);
    else note(`${rootRel}/：${sources.length} 个源文件全部有产物`);
  }

  // 2. 根目录跳转页
  const home = path.join(SOURCE_DIR, 'index.html');
  if (!fs.existsSync(home)) {
    fail('缺少根目录 index.html');
  } else {
    const html = fs.readFileSync(home, 'utf8');
    if (!/http-equiv="refresh"/.test(html)) fail('index.html 不是跳转页');
    else note('index.html：跳转到第一章');
  }

  // 3. 所有章节页面
  for (const root of config.roots) {
    const rootDir = path.join(SOURCE_DIR, root.path.replace(/^\//, ''));
    if (!fs.existsSync(rootDir)) continue;
    for (const page of flattenPages(buildNavTree(rootDir, rootDir, config))) {
      const out = path.join(SOURCE_DIR, page.outRelative);
      if (fs.existsSync(out)) checkPage(out);
    }
  }

  console.log(`\n📄 检查了 ${checkedPages} 个页面、${checkedLinks} 条站内链接`);
  if (failures) {
    console.error(`❌ ${failures} 项检查未通过`);
    process.exit(1);
  }
  console.log('✅ 全部通过');
}

main();
