'use strict';

const fs = require('fs');
const path = require('path');
const { CONFIG_DIR } = require('./paths');

// 站点配置沿用原项目自带的 config/nav_roots.json：roots 决定要生成哪些目录，
// 其余字段（站点名、目录中文名、未翻译章节的回退地址）是同文件里的扩展项，都有默认值。
const DEFAULTS = {
  name: 'Vulkan 教程',
  tagline: '',
  author: 'Kalin',
  repo: '',
  external_fallback_base: '',
  roots: [],
  folder_titles: {}
};

function loadSiteConfig() {
  const configPath = path.join(CONFIG_DIR, 'nav_roots.json');
  const raw = fs.existsSync(configPath)
    ? JSON.parse(fs.readFileSync(configPath, 'utf8'))
    : {};
  const config = { ...DEFAULTS, ...raw };
  config.roots = Array.isArray(config.roots) ? config.roots : [];
  config.folder_titles = config.folder_titles || {};
  return config;
}

// 目录的中文名：nav_roots.json 的 folder_titles 里配了就用手写的，没配就退回目录名（去掉数字前缀和 _）。
function folderTitle(config, relPath, folderName) {
  const key = relPath.replace(/\\/g, '/');
  if (config.folder_titles && config.folder_titles[key]) return config.folder_titles[key];
  return prettifyName(folderName);
}

function prettifyName(name) {
  return String(name).replace(/^\d+_/, '').replace(/_/g, ' ');
}

// 文件/目录名的数字前缀（00_Introduction -> "00"），导航排序和展示用得上。
function numericPrefix(name) {
  const match = /^(\d+)_/.exec(name);
  return match ? match[1] : '';
}

module.exports = {
  loadSiteConfig,
  folderTitle,
  prettifyName,
  numericPrefix
};
