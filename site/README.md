# 站点生成器

本站点的静态页面生成器，仅供自用，不对外发布。

## 代码高亮

代码块在**构建时**由 [Shiki](https://shiki.style/) 着色，入口是 `site/highlight.js`：

- 产物里是带 `--shiki-light` / `--shiki-dark` CSS 变量的静态 `<span>`，浏览器端不再加载高亮脚本，
  禁用 JS 也能看到颜色，也不会出现“先白后彩”的闪动；
- 浅色/深色主题复用站点已有的 `html[data-theme]`，由 `config/styles/highlight.css` 切换变量；
- 语言名映射写在 `LANGUAGE_ALIASES` 里。AsciiDoc 里用到新语言（如 `[source,rust]`）时，
  若 Shiki 的语法名和写法不一致，补一条映射即可；未知语言会保持纯文本并打一条警告；
- Slang 是 HLSL 方言，目前借用 `hlsl` 语法着色；纯文本块（`[source,text]` 或没写语言）不生成 span；
- 代码块原有的 `class="language-*"`、`data-lang` 和复制按钮逻辑都保持不变；
- 公式预处理（`site/markdown.js`）会先跳过代码块，避免 CMake 的 `${A} … ${B}` 被误当成行内公式。

## 版权与许可

Copyright © 2026 Kalin

以 MIT License 发布，完整文本见 [LICENSE-MIT](../LICENSE-MIT)。
