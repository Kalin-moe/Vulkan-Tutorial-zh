#!/usr/bin/env node
'use strict';

// 站点构建入口（原 kalin-web 的 prebuild.js，改名以免和“预构建”这个词混淆）。
// 用法：
//   node build-site.js           # 生成 HTML 到 .adoc 旁边
//   node build-site.js --dist    # 额外生成 dist/ 部署目录（Cloudflare Pages 用）
//   node build-site.js --help
//
// 所有路径都由 site/paths.js 从仓库根目录解析，因此不必在意当前工作目录。

const { main } = require('./site');
const { loadSiteConfig } = require('./site/config');

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  const config = loadSiteConfig();
  console.log(`用法：node build-site.js [--dist] [--help]

把 ${config.roots.map(root => `${root.path}/`).join('、')} 下的 AsciiDoc
构建成静态 HTML，输出到源文件旁边（*.adoc -> *.html）。

  --dist   额外生成 dist/：只包含页面引用到的文件，跳过超过 25 MiB
           的文件（Cloudflare Pages 的单文件上限）。部署时输出目录填 dist。`);
  process.exit(0);
}

main().catch(error => {
  console.error('❌ 构建失败：', error);
  process.exit(1);
});
