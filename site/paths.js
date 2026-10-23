'use strict';

const path = require('path');

// 所有路径都从仓库根目录解析：生成器放在 site/ 里，产物和源文件在同一棵树中。
// （之所以不叫 build/，是因为上游 .gitignore 忽略了所有 build 目录。）
const ROOT_DIR = path.resolve(__dirname, '..');
const SOURCE_DIR = ROOT_DIR;
const CONFIG_DIR = path.join(ROOT_DIR, 'config');
const TEMPLATE_DIR = path.join(CONFIG_DIR, 'templates');
const STYLE_DIR = path.join(CONFIG_DIR, 'styles');
const JS_DIR = path.join(ROOT_DIR, 'js');

// 扫描目录时跳过的名字：生成器自身的目录、依赖、版本库等。
const IGNORE_DIRS = ['node_modules', '.git', '.github', 'site', 'config', 'js', 'assets', 'scripts', 'antora'];

function toPosix(value) {
  return String(value).split(path.sep).join('/');
}

function relativeToSource(target) {
  return toPosix(path.relative(SOURCE_DIR, target));
}

module.exports = {
  ROOT_DIR,
  SOURCE_DIR,
  CONFIG_DIR,
  TEMPLATE_DIR,
  STYLE_DIR,
  JS_DIR,
  IGNORE_DIRS,
  toPosix,
  relativeToSource
};
