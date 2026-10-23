// theme.js - 主题切换（自动 / 浅色 / 深色）
//
// 约定：
//   localStorage['kalin-theme'] 保存用户选择，取值 auto | light | dark，默认 auto。
//   <html> 上挂两个属性：
//     data-theme-mode = 用户选的模式（auto / light / dark）
//     data-theme      = 实际生效的主题（light / dark），auto 时跟随系统
//   首屏属性由页面 <head> 里的内联脚本写入（见 site/theme.js 的 THEME_HEAD），
//   这里只负责点按切换、持久化，以及跟随系统主题变化。
(function () {
  var KEY = 'kalin-theme';
  var MODES = ['auto', 'light', 'dark'];
  var NAME = { auto: '自动', light: '浅色', dark: '深色' };
  var NEXT = { auto: 'light', light: 'dark', dark: 'auto' };

  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function read() {
    try {
      var v = localStorage.getItem(KEY);
      return MODES.indexOf(v) >= 0 ? v : 'auto';
    } catch (e) {
      return 'auto';
    }
  }

  function write(mode) {
    try { localStorage.setItem(KEY, mode); } catch (e) {}
  }

  function apply(mode) {
    var dark = mode === 'dark' || (mode === 'auto' && !!mq && mq.matches);
    var root = document.documentElement;
    root.setAttribute('data-theme-mode', mode);
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
  }

  function describe(mode) {
    return NAME[mode] + '（点击切换为' + NAME[NEXT[mode]] + '）';
  }

  function sync() {
    var mode = read();
    apply(mode);
    var buttons = document.querySelectorAll('[data-theme-toggle]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute('title', describe(mode));
      buttons[i].setAttribute('aria-label', '主题：' + describe(mode));
    }
  }

  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest ? e.target.closest('[data-theme-toggle]') : null;
    if (!btn) return;
    e.preventDefault();
    var next = NEXT[read()];
    write(next);
    sync();
  });

  // 自动模式下跟随系统深浅色切换
  if (mq) {
    var onSystemChange = function () { if (read() === 'auto') sync(); };
    if (mq.addEventListener) mq.addEventListener('change', onSystemChange);
    else if (mq.addListener) mq.addListener(onSystemChange);
  }

  // 从往返缓存（bfcache）回来时重新对齐一次
  window.addEventListener('pageshow', sync);

  sync();
})();
