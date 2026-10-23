'use strict';

const fs = require('fs');
const path = require('path');
const { SOURCE_DIR, toPosix } = require('./paths');

// ---------- 智能加载 Asciidoctor ----------
let asciidoc;
try {
  asciidoc = require('@asciidoctor/core')();
} catch (error) {
  try {
    const Asciidoctor = require('asciidoctor');
    asciidoc = typeof Asciidoctor === 'function' ? Asciidoctor() : (Asciidoctor.default ? Asciidoctor.default() : Asciidoctor);
  } catch (fallbackError) {
    console.error('❌ 未安装 Asciidoctor，请先运行：npm install');
    process.exit(1);
  }
}

// 转换过程中的警告先收集起来，构建结束再一次性打印，避免刷屏淹没真正的错误。
const WARNINGS = [];

function flushWarnings() {
  if (!WARNINGS.length) return;
  console.warn(`\n⚠️  AsciiDoc 警告 ${WARNINGS.length} 条：`);
  for (const item of WARNINGS.slice(0, 40)) {
    console.warn(`  · ${path.relative(SOURCE_DIR, item.file)}: ${item.message}`);
  }
  if (WARNINGS.length > 40) console.warn(`  … 其余 ${WARNINGS.length - 40} 条省略`);
}

// Asciidoctor.js 4 的 convert() 返回 Promise，所以这里必须是 async。
async function convertAsciidoc(text, filePath) {
  const options = {
    safe: 'unsafe',
    header_footer: false,
    base_dir: path.dirname(filePath),
    attributes: {
      sectids: '',
      toc: 'left',
      'toclevels': '3',
      'toc-title': '目录',
      'experimental': '',
      'source-highlighter': 'none'
    }
  };

  let logger = null;
  if (asciidoc.MemoryLogger) {
    logger = asciidoc.MemoryLogger.create();
    if (typeof logger.setMaxMessages === 'function') logger.setMaxMessages(100);
    options.logger = logger;
  }

  const html = await asciidoc.convert(text, options);

  if (logger && typeof logger.getMessages === 'function') {
    for (const message of logger.getMessages()) {
      WARNINGS.push({ file: filePath, message: String(message) });
    }
  }
  return html;
}

// ========== 修复 AsciiDoc 交叉引用 ==========
// 教程源码是给 Antora 写的，xref 有两种写法：
//   1. 相对当前文件的路径，如 ./02_Image_views.adoc；
//   2. 相对“页面根”（也就是 zh/）的路径，如 03_Drawing_a_triangle/00_Setup/04_Logical_device_and_queues.adoc。
// Antora 找不到第一种时会退回页面根再找一次，所以这里照同样的顺序解析。
// 译文里未翻译的章节（90_FAQ、进阶教程等）在页面根也不存在，就按配置退回官方英文站，
// 免得页面上出现死链。
const XREF_RE = /xref:([^\s\[]+\.(?:adoc|md))(#[^\s\[]*)?(\[[^\]]*\])/g;
const ATTACHMENT_RE = /xref:attachment\$([^\s\[]+)(#[^\s\[]*)?\[([^\]]*)\]/g;

function fixXrefPaths(content, filePath, contentRoot, externalBase = '') {
  const currentDir = path.dirname(filePath);
  const fallbackBase = String(externalBase || '').replace(/\/+$/, '');

  // Antora 的 attachment$ 资源引用：映射到仓库根的 attachments/ 目录。
  content = content.replace(ATTACHMENT_RE, (match, target, hash = '', text) => {
    const abs = path.join(SOURCE_DIR, 'attachments', target);
    if (fs.existsSync(abs)) return `link:/attachments/${toPosix(target)}${hash}[${text}]`;
    return match;
  });

  return content.replace(XREF_RE, (match, target, hash = '', tail = '') => {
    if (/^[a-z][a-z0-9+.-]*:/i.test(target)) return match; // 已经是外链

    const rootRelative = target.startsWith('/');
    const fromCurrent = rootRelative ? null : path.resolve(currentDir, target);
    const fromRoot = path.resolve(contentRoot, target.replace(/^\//, ''));

    let resolved = null;
    if (fromCurrent && fs.existsSync(fromCurrent)) resolved = fromCurrent;
    else if (fs.existsSync(fromRoot)) resolved = fromRoot;

    if (resolved) {
      const rel = toPosix(path.relative(currentDir, resolved));
      return `xref:${rel}${hash}${tail}`;
    }

    if (fallbackBase) {
      // 用“相对页面根”的路径拼官方站地址；跑到页面根外面的路径不动。
      const relToRoot = path.posix.normalize(target.replace(/^\//, '')).replace(/\.(adoc|md)$/i, '.html');
      if (!relToRoot.startsWith('..')) {
        return `link:${fallbackBase}/${relToRoot}${hash}${tail}`;
      }
    }

    // 真的解析不了：保留原样，让 Asciidoctor 打一条警告，构建仍然继续。
    return match;
  });
}

module.exports = { asciidoc, convertAsciidoc, fixXrefPaths, flushWarnings };
