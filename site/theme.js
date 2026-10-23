'use strict';

// 主题必须在首屏渲染前落到 <html> 上，否则深色用户会看到一瞬白屏，
// 所以这段只能内联进 <head>（外部脚本必然晚于首次绘制）。
// 存储键和 kalin-web 保持一致，方便两边共用同一套前端脚本。
const THEME_STORAGE_KEY = 'kalin-theme';
const THEME_HEAD = `<script>(function(){try{var m=localStorage.getItem('${THEME_STORAGE_KEY}');if(m!=='auto'&&m!=='light'&&m!=='dark')m='auto';var d=m==='dark'||(m==='auto'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);var e=document.documentElement;e.setAttribute('data-theme-mode',m);e.setAttribute('data-theme',d?'dark':'light');}catch(e){}})();<\/script>`;

// 三个状态各画一个图标，全部走 currentColor，由 CSS 按 data-theme-mode 只显示一个，
// 这样即便 theme.js 还没执行，图标也已经是对的。
const THEME_ICONS = {
  // 自动：一半实心一半空心的圆（跟随系统）
  auto: '<svg class="theme-icon theme-icon--auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" stroke="none"/></svg>',
  // 浅色：太阳
  light: '<svg class="theme-icon theme-icon--light" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4.6"/><path d="M12 1.8v2.6M12 19.6v2.6M1.8 12h2.6M19.6 12h2.6M4.75 4.75l1.85 1.85M19.25 19.25l-1.85-1.85M4.75 19.25l1.85-1.85M19.25 4.75l-1.85 1.85"/></svg>',
  // 深色：月牙
  dark: '<svg class="theme-icon theme-icon--dark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'
};

// 站点 logo：内联 SVG，省掉一张图片请求，也不会因为子路径部署而丢图。
const SITE_LOGO = '<svg class="logo-mark" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><defs><linearGradient id="vt-logo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d7263d"/><stop offset="1" stop-color="#7a0a1c"/></linearGradient></defs><rect width="48" height="48" rx="11" fill="url(#vt-logo)"/><path d="M14.5 15.5 24 33l9.5-17.5" fill="none" stroke="#fff" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// variant: 'inline' 挂在顶栏 | 'floating' 右上角悬浮
function themeButton(variant) {
  const icons = THEME_ICONS.auto + THEME_ICONS.light + THEME_ICONS.dark;
  const label = '主题：自动（点击切换为浅色）';
  return `<button type="button" class="theme-toggle theme-toggle--${variant}" data-theme-toggle aria-label="${label}" title="${label}">${icons}</button>`;
}

module.exports = { THEME_STORAGE_KEY, THEME_HEAD, THEME_ICONS, SITE_LOGO, themeButton };
