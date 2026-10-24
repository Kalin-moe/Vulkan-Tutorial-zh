'use strict';

const fs = require('fs');
const path = require('path');
const { STYLE_DIR } = require('./paths');

// 主题变量与基础排版分开存放：theme.css 只放变量和主题按钮，
// common_styles.css 放正文排版。顺序不能反——变量必须在引用它的样式之前。
const THEME_CSS = fs.readFileSync(path.join(STYLE_DIR, 'theme.css'), 'utf8');
const BASE_CSS = fs.readFileSync(path.join(STYLE_DIR, 'common_styles.css'), 'utf8');
const HIGHLIGHT_CSS = fs.readFileSync(path.join(STYLE_DIR, 'highlight.css'), 'utf8');
const KATEX_CSS = fs.readFileSync(require.resolve('katex/dist/katex.min.css'), 'utf8')
  .replace(/url\(fonts\//g, 'url(/fonts/');

// KaTeX 样式只在页面真的有公式时注入，否则每个普通页面都会白白多背 20 多 KB。
// 代码高亮样式只有几百字节，而且几乎每页都有代码块，直接常驻。
function stylesFor(useMath) {
  return [THEME_CSS, BASE_CSS, HIGHLIGHT_CSS, useMath ? KATEX_CSS : ''].filter(Boolean).join('\n');
}

module.exports = { THEME_CSS, BASE_CSS, HIGHLIGHT_CSS, KATEX_CSS, stylesFor };
