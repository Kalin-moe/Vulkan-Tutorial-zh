'use strict';

// 构建产物自检：每次构建后跑一遍，确认
//   1. 每个 .adoc 都生成了对应的 .html；
//   2. 页面里没有漏替换的 {{占位符}}、没有空标题；
//   3. 页面内的站内链接（href/src）都能在仓库里找到对应文件。
// 用法：node site/check.js（或 npm test）

const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
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

// 用 jsdom 模拟浏览器：index.html 里的内联脚本会调用 location.replace，
// jsdom 不支持真正导航，会通过 jsdomError 抛出来，正好用来判断“有没有跳”。
function simulateIndex(html, url) {
  const virtualConsole = new VirtualConsole();
  const navigations = [];
  virtualConsole.on('jsdomError', error => {
    if (/navigation/i.test(error.message)) navigations.push(error.message);
  });
  const dom = new JSDOM(html, { url, runScripts: 'dangerously', virtualConsole });
  return { document: dom.window.document, navigations, close: () => dom.window.close() };
}

// 根目录入口页的两个场景：
//   /            -> 自动跳到第一章；
//   /en/（或任何不存在的路径，被托管平台兜底成 index.html）
//                -> 不跳转，显示“没有这个页面”，入口链接用站点绝对地址。
// 后者是回归测试：相对跳转会让 /en/ 变成 /en/zh/zh/… 无限叠加。
function checkHomePage(html) {
  const before = failures;
  const missing = simulateIndex(html, 'https://example.test/en/');
  if (missing.navigations.length) fail('index.html 在 /en/ 下仍会跳转（应显示 404 提示，否则会无限叠加 /zh/）');
  const notice = missing.document.getElementById('not-found');
  if (!notice || notice.hidden) fail('index.html 在 /en/ 下没有显示 404 提示');
  const start = missing.document.querySelector('a[data-root]');
  const rootHref = start ? start.getAttribute('data-root') : '';
  if (!start) {
    fail('index.html 缺少 data-root 入口链接');
  } else {
    if (start.href !== 'https://example.test' + rootHref) {
      fail(`index.html 在 /en/ 下的入口链接不是站点绝对地址（${start.href}）`);
    }
    if (!fs.existsSync(path.join(SOURCE_DIR, rootHref.replace(/^\//, '')))) {
      fail(`index.html 的入口目标不存在：${rootHref}`);
    }
  }
  missing.close();

  // 报告里的地址是 /en/zh/zh/…/00_Introduction.html：被兜底后仍不能跳。
  const deep = simulateIndex(html, 'https://example.test/en/zh/zh/zh/00_Introduction.html');
  if (deep.navigations.length) fail('index.html 在被 404 兜底的嵌套路径（/en/zh/zh/…）下仍会跳转');
  deep.close();

  const root = simulateIndex(html, 'https://example.test/');
  if (!root.navigations.length) fail('index.html 在站点根目录没有跳转到第一章');
  root.close();

  if (failures === before) note('index.html：根目录跳第一章，/en/ 等无效路径显示提示');
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

  // 2. 根目录入口页（同时会被托管平台当作 404 兜底页）
  const home = path.join(SOURCE_DIR, 'index.html');
  if (!fs.existsSync(home)) {
    fail('缺少根目录 index.html');
  } else {
    const html = fs.readFileSync(home, 'utf8');
    if (/http-equiv=["']refresh["']/i.test(html)) {
      fail('index.html 不能用 meta refresh：被兜底成 404 页时会叠加成 /en/zh/zh/… 无限跳转');
    } else if (!/id="not-found"/.test(html) || !/data-root="\//.test(html)) {
      fail('index.html 缺少 404 提示或第一章的站点绝对地址');
    } else {
      checkHomePage(html);
    }
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
