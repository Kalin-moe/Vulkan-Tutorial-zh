# Vulkan 教程（中文）

[Khronos Vulkan® Tutorial](https://github.com/KhronosGroup/Vulkan-Tutorial) 的中文翻译，
配一个轻量的静态站点生成器（从 kalin-web 的生成器裁剪而来）。

站点直接由仓库里的 AsciiDoc 生成：`zh/**.adoc` → 同名 `.html`。
生成器会把站内 URL 改写成相对路径，所以 HTTP 部署和直接双击 HTML 都能打开。

## 构建命令

```bash
npm install       # 第一次
npm run build     # 等同于 node build-site.js
```

生成的 HTML 就在 `zh/` 对应 `.adoc` 旁边（`*.html` 已被 `.gitignore` 忽略）。
访问仓库根目录会跳到第一章；正文靠左侧导航栏浏览，没有单独的首页。

部署到 Cloudflare Pages：

```bash
npm run build:dist   # 构建 + 生成 dist/ 部署目录
# 构建命令：npm run build:dist
# 输出目录：dist
```

`dist/` 只包含页面实际引用到的文件，并会跳过超过 25 MiB 的文件
（Cloudflare Pages 的单文件上限，仓库里 `images/38_*` 两个 30MB 的 gif 不会带上）。

构建后可以跑一遍自检（每个 `.adoc` 都有产物、站内链接都能找到目标）：

```bash
npm test          # 等同于 node site/check.js
```

清理生成的 HTML（保留 AsciiDoc 源文件；`--dry-run` 只看不删）：

```bash
npm run clean            # = node site/clean.js
npm run clean -- --dry-run
```

> 需要 Node.js ≥ 20。构建入口是 `build-site.js`（原来的 `prebuild.js` 已改名）。

## 目录结构

```
build-site.js          构建入口（--dist 生成部署目录）
site/                  生成器：AsciiDoc 转换、导航树、TOC、模板填充、dist、自检
config/
  nav_roots.json       配置：要生成的目录（roots=zh/）、站点名、目录中文名
  templates/           章节页模板
  styles/              主题变量与正文排版
js/                    浏览器端脚本：主题切换、TOC 折叠、导航折叠、代码复制
zh/                    中文译文（AsciiDoc）
```

### 几点实现说明

- **交叉引用**：`xref:` 先按当前文件解析，找不到再按页面根（`zh/`）解析，和 Antora 的规则一致；
  `zh/` 里没有的章节（进阶教程、FAQ）自动指向官方英文教程，避免死链。
- **目录中文名**：目录本身是英文命名（`03_Drawing_a_triangle`），中文名在
  `config/nav_roots.json` 的 `folder_titles` 里配置，改一行就能生效。
- **上一章 / 下一章**：按导航树的阅读顺序自动生成。

## 许可

| 内容 | 许可 |
| --- | --- |
| `zh/` 译文、`images/`、`attachments/`、`en/` 等教程内容 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)（与上游一致） |
| 站点生成器（`site/`、`config/`、`js/`、`build-site.js` 等） | [MIT License](LICENSE-MIT)，© 2026 Kalin |

详见 [LICENSE-MIT](LICENSE-MIT)（生成器）与根目录 [LICENSE](LICENSE)（教程内容）。
