'use strict';

// 删除构建生成的 HTML（以及 dist/），保留 AsciiDoc 源文件和模板。
// 用法：
//   node site/clean.js --dry-run   # 只看会删哪些
//   node site/clean.js             # 真的删
//
// 只删生成器知道的产物：各导航根目录下的 *.adoc/*.md 对应 HTML、根目录跳转页、dist/。
// 手写的 HTML（比如以后加的 404.html）不会被碰到。

const fs = require('fs');
const path = require('path');
const { loadSiteConfig } = require('./config');
const { SOURCE_DIR, CONFIG_DIR } = require('./paths');
const { buildNavTree, flattenPages } = require('./navigation');

const dryRun = process.argv.includes('--dry-run');
const config = loadSiteConfig();
const targets = new Set();

function add(file) {
  const abs = path.resolve(file);
  if (!abs.startsWith(SOURCE_DIR + path.sep)) return;
  if (fs.existsSync(abs)) targets.add(abs);
}

for (const root of config.roots) {
  const rootDir = path.join(SOURCE_DIR, root.path.replace(/^\//, ''));
  if (!fs.existsSync(rootDir)) continue;
  for (const page of flattenPages(buildNavTree(rootDir, rootDir, config))) {
    add(path.join(SOURCE_DIR, page.outRelative));
  }
}

// 构建入口自己写的根目录跳转页
add(path.join(SOURCE_DIR, 'index.html'));

const list = Array.from(targets).sort();
let removed = 0;
for (const file of list) {
  console.log(`${dryRun ? '会删除' : '删除'} ${path.relative(SOURCE_DIR, file)}`);
  if (!dryRun) {
    fs.unlinkSync(file);
    removed++;
  }
}

// dist/ 整个目录都是生成物
const distDir = path.join(SOURCE_DIR, 'dist');
if (fs.existsSync(distDir)) {
  console.log(`${dryRun ? '会删除' : '删除'} dist/`);
  if (!dryRun) fs.rmSync(distDir, { recursive: true, force: true });
}

console.log(
  dryRun
    ? `\n共 ${list.length} 个 HTML 将被删除（未执行）。`
    : `\n共删除 ${removed} 个 HTML 文件${fs.existsSync(distDir) ? '' : '和 dist/'}。`
);
