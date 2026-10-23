'use strict';

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { asciidoc } = require('./asciidoc');
const { IGNORE_DIRS, relativeToSource, toPosix } = require('./paths');
const { escapeHtml } = require('./html');
const { folderTitle, prettifyName, numericPrefix } = require('./config');

// ---------- 查找目录中第一个文件 ----------
function findFirstFileInDir(dirPath) {
  if (!fs.existsSync(dirPath)) return null;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    .filter(entry => !entry.name.startsWith('.') && !IGNORE_DIRS.includes(entry.name));

  for (const entry of entries) {
    if (entry.isFile() && /\.(adoc|md)$/i.test(entry.name)) {
      return path.join(dirPath, entry.name);
    }
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const found = findFirstFileInDir(path.join(dirPath, entry.name));
      if (found) return found;
    }
  }
  return null;
}

// ---------- 标题 ----------
// 一页的标题就是 AsciiDoc 的文档标题（第一处以 "= " 开头的行），
// 没有的话退回文件名。构建时同一文件会被导航、面包屑、标题栏各取一次，所以缓存。
const titleCache = new Map();

function cleanInlineMarkup(title) {
  return title
    .replace(/\^([^^]+)\^/g, '$1') // 上标
    .replace(/~([^~]+)~/g, '$1')   // 下标
    .replace(/\*([^*]+)\*/g, '$1') // 粗体
    .replace(/_([^_]+)_/g, '$1')   // 斜体
    .replace(/\+([^+]+)\+/g, '$1') // 等宽
    .replace(/#([^#]+)#/g, '$1')   // 等宽（另一种）
    .replace(/\s+/g, ' ')
    .trim();
}

function getDocTitle(filePath) {
  if (titleCache.has(filePath)) return titleCache.get(filePath);

  let title = '';
  if (fs.existsSync(filePath)) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.adoc') {
      const match = raw.match(/^=\s+(.+)$/m);
      if (match) title = match[1];
      else {
        try {
          const doc = asciidoc.load(raw, { safe: 'safe' });
          title = doc.getDocumentTitle() || '';
        } catch (error) {
          // 解析失败就退回文件名
        }
      }
    } else if (ext === '.md') {
      const match = raw.match(/^#\s+(.+)$/m);
      if (match) title = match[1];
    }
  }

  if (!title) title = prettifyName(path.basename(filePath, path.extname(filePath)));
  const cleaned = cleanInlineMarkup(title) || 'Untitled';
  titleCache.set(filePath, cleaned);
  return cleaned;
}

// ---------- 导航树 ----------
// 目录名和文件名都用 "数字_" 前缀排序（00_、01_…），展示时去掉前缀。
function buildNavTree(dirPath, rootDir, config, relPath = '') {
  if (!fs.existsSync(dirPath)) return [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const items = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.') || IGNORE_DIRS.includes(entry.name)) continue;
    const childRel = relPath ? `${relPath}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      const fullDir = path.join(dirPath, entry.name);
      const children = buildNavTree(fullDir, rootDir, config, childRel);
      if (!children.length) continue;

      const indexAdoc = path.join(fullDir, 'index.adoc');
      const indexMd = path.join(fullDir, 'index.md');
      let indexPage = '';
      if (fs.existsSync(indexAdoc)) indexPage = '/' + relativeToSource(indexAdoc).replace(/\.adoc$/, '.html');
      else if (fs.existsSync(indexMd)) indexPage = '/' + relativeToSource(indexMd).replace(/\.md$/, '.html');

      // 目录的第一页按阅读顺序取（先子目录后文件），这样面包屑和首页卡片
      // 会落在“第一章”而不是目录里恰好排在前面的那个文件。
      const flat = flattenPages(children);
      items.push({
        type: 'folder',
        name: folderTitle(config, childRel, entry.name),
        originalName: entry.name,
        num: numericPrefix(entry.name),
        relPath: childRel,
        indexPage,
        firstPage: indexPage || (flat.length ? '/' + flat[0].outRelative : ''),
        size: flat.length,
        children
      });
    } else if (/\.(adoc|md)$/i.test(entry.name)) {
      items.push({
        type: 'file',
        filePath: relativeToSource(path.join(dirPath, entry.name)),
        fileName: entry.name,
        num: numericPrefix(entry.name),
        relPath: childRel,
        absolutePath: path.join(dirPath, entry.name)
      });
    }
  }

  items.sort((a, b) => {
    const nameA = a.originalName || a.fileName || '';
    const nameB = b.originalName || b.fileName || '';
    return nameA.localeCompare(nameB, undefined, { numeric: true });
  });

  return items;
}

// 把树按阅读顺序摊平：目录里的页面按目录展开，用来算上一章/下一章。
function flattenPages(tree) {
  const pages = [];
  function walk(nodes) {
    for (const node of nodes) {
      if (node.type === 'folder') {
        walk(node.children);
      } else {
        const outRelative = node.filePath.replace(/\.(adoc|md)$/i, '.html');
        pages.push({
          absolutePath: node.absolutePath,
          filePath: node.filePath,
          outRelative,
          webPath: '/' + outFile(outRelative),
          title: getDocTitle(node.absolutePath)
        });
      }
    }
  }
  walk(tree);
  return pages;
}

function outFile(outRelative) {
  return toPosix(outRelative);
}

// ---------- 侧边栏 ----------
function renderNavTree(items, currentWebPath) {
  if (!items.length) return '';
  let html = '<ul class="nav-tree">';
  for (const item of items) {
    if (item.type === 'folder') {
      html += `<li class="nav-folder"><div class="nav-folder-name">${escapeHtml(item.name)}</div>`;
      html += renderNavTree(item.children, currentWebPath);
      html += '</li>';
    } else {
      const outFile = item.filePath.replace(/\.(adoc|md)$/i, '.html');
      const webPath = '/' + toPosix(outFile);
      const title = getDocTitle(item.absolutePath);
      const isCurrent = webPath === currentWebPath;
      html += `<li class="nav-file${isCurrent ? ' current' : ''}"><a href="${webPath}">${escapeHtml(title)}</a></li>`;
    }
  }
  html += '</ul>';
  return html;
}

function generateNavSidebar(tree, currentWebPath, title) {
  if (!tree.length) return '';
  return `
  <div class="nav-header">
  <h3>${escapeHtml(title || '目录')}</h3>
  </div>
  <div class="nav-body" id="navBody">${renderNavTree(tree, currentWebPath)}</div>`;
}

// ---------- TOC ----------
function generateToc(htmlContent) {
  const $ = cheerio.load(htmlContent, null, false);
  const headings = $('h1, h2, h3, h4, h5, h6');
  if (headings.length < 2) return '';
  const items = [];
  headings.each((index, element) => {
    const level = parseInt(element.tagName[1]);
    const text = $(element).text().trim();
    const id = $(element).attr('id');
    if (id && text) items.push({ level, text, id });
  });
  if (items.length < 2) return '';

  function buildTree(nodes, level) {
    let html = '<ul class="toc-list">';
    let index = 0;
    while (index < nodes.length) {
      const item = nodes[index];
      if (item.level < level) break;
      if (item.level === level) {
        html += `<li><a href="#${item.id}">${escapeHtml(item.text)}</a>`;
        if (index + 1 < nodes.length && nodes[index + 1].level > level) {
          const sub = [];
          let next = index + 1;
          while (next < nodes.length && nodes[next].level > level) sub.push(nodes[next++]);
          html += buildTree(sub, level + 1);
          index = next - 1;
        }
        html += '</li>';
        index++;
      } else {
        index++;
      }
    }
    html += '</ul>';
    return html;
  }

  const minLevel = Math.min(...items.map(item => item.level));
  return `<div class="toc-header" id="tocToggle"><span>目录</span><span class="arrow">▶</span></div><div class="toc-body" id="tocBody">${buildTree(items, minLevel)}</div>`;
}

// ---------- 面包屑 ----------
function generateBreadcrumb(parts) {
  if (!parts.length) return '<a href="/">首页</a>';
  let bread = '<a href="/">首页</a>';
  for (const part of parts) {
    const isLast = part === parts[parts.length - 1];
    if (!isLast && part.url) {
      bread += `<span class="separator">/</span><a href="${part.url}">${escapeHtml(part.name)}</a>`;
    } else {
      bread += `<span class="separator">/</span><span>${escapeHtml(part.name)}</span>`;
    }
  }
  return bread;
}

// ---------- 目录首页 ----------
function findFirstPageByDir(tree, targetRelDir) {
  if (!targetRelDir) return null;
  const parts = targetRelDir.split(/[\\/]/).filter(part => part);
  function search(nodes, depth) {
    for (const node of nodes) {
      if (node.type === 'folder' && node.originalName === parts[depth]) {
        if (depth === parts.length - 1) {
          return node.indexPage || node.firstPage || null;
        }
        return search(node.children, depth + 1);
      }
    }
    return null;
  }
  return search(tree, 0);
}

module.exports = {
  findFirstFileInDir,
  getDocTitle,
  buildNavTree,
  flattenPages,
  renderNavTree,
  generateNavSidebar,
  generateToc,
  generateBreadcrumb,
  findFirstPageByDir
};
