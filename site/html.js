'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { JS_DIR } = require('./paths');

// ---------- 模板填充 ----------
function applyTemplate(tplPath, replacements) {
  let tpl = fs.readFileSync(tplPath, 'utf8');
  // 必须用函数形式的 replace。字符串形式的替换串里 $&、$'、$$ 等有特殊含义，
  // 正文里一旦出现 $ 就会被替换成别的东西，所以一律用函数。
  for (const [key, value] of Object.entries(replacements)) {
    tpl = tpl.replace(new RegExp(`{{${key}}}`, 'g'), () => (value == null ? '' : String(value)));
  }
  return tpl;
}

function escapeHtml(value) {
  return value
    ? String(value).replace(/[&<>"]/g, ch => (ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : '&quot;'))
    : '';
}

// ---------- 静态资源版本号 ----------
// 部署平台通常给 /js/*.js 发长缓存；内容变了 URL 不变，浏览器就会一直用旧副本。
// 按文件内容哈希加 ?v=…，内容一变 URL 就变。
const assetHashCache = new Map();

function assetVersion(fileName) {
  if (assetHashCache.has(fileName)) return assetHashCache.get(fileName);
  let version = '';
  try {
    version = crypto.createHash('sha1').update(fs.readFileSync(path.join(JS_DIR, fileName))).digest('hex').slice(0, 8);
  } catch (error) {
    console.warn(`⚠️  无法读取 js/${fileName}，跳过版本号`);
  }
  assetHashCache.set(fileName, version);
  return version;
}

function withAssetVersions(html) {
  return html.replace(/src="\/js\/([A-Za-z0-9._-]+)\.js"/g, (match, name) => {
    const version = assetVersion(`${name}.js`);
    return version ? `src="/js/${name}.js?v=${version}"` : match;
  });
}

// ---------- 站内 URL 改成相对路径 ----------
// 直接双击 .html（file://）时，/js、/images 这类站点绝对路径会解析到磁盘根目录，
// 脚本加载不到、导航栏一直 init-hide。按输出文件所在深度算前缀，HTTP 下解析结果不变。
// （和 kalin-web 的 build/html.js 保持一致。）
function outputBase(outRelative) {
  const posix = String(outRelative).replace(/\\/g, '/');
  const dir = path.posix.dirname(posix);
  if (!dir || dir === '.') return './';
  return '../'.repeat(dir.split('/').filter(Boolean).length);
}

function relativizeUrls(html, outRelative) {
  const base = outputBase(outRelative);
  return html
    .replace(/\bhref=(["'])\/(["'])/g, (match, quote) => `href=${quote}${base}index.html${quote}`)
    .replace(/\b(href|src)=(["'])\/(?!\/)/g, (match, attr, quote) => `${attr}=${quote}${base}`)
    .replace(/url\((['"]?)\/(?!\/)/g, (match, quote) => `url(${quote}${base}`);
}

// ---------- 产物清理 ----------
const HTML_COMMENT_RE = /<!--[\s\S]*?-->/g;
const CSS_COMMENT_RE = /\/\*[\s\S]*?\*\//g;
const STYLE_BLOCK_RE = /(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi;

function stripCssComments(css) {
  return css
    .replace(CSS_COMMENT_RE, '')
    .split('\n')
    .map(line => line.trimEnd())
    .filter(line => line.trim() !== '')
    .join('\n');
}

function stripStyleComments(html) {
  return html.replace(STYLE_BLOCK_RE, (match, open, css, close) => open + stripCssComments(css) + close);
}

// 发布产物不保留注释：HTML 注释和 <style> 里的 CSS 注释都在这里去掉。
function finalizeOutput(html) {
  return stripStyleComments(html).replace(HTML_COMMENT_RE, '');
}

// 一页产物的完整处理：资源版本号 -> 相对路径 -> 去注释。
function finalizePage(html, outRelative) {
  return finalizeOutput(relativizeUrls(withAssetVersions(html), outRelative));
}

module.exports = {
  applyTemplate,
  escapeHtml,
  assetVersion,
  withAssetVersions,
  outputBase,
  relativizeUrls,
  finalizeOutput,
  finalizePage,
  stripCssComments
};
