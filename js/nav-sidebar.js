// nav-sidebar.js - 左侧导航侧边栏与文件夹折叠（统一用于 nav 模板）
//
// 折叠动画踩过的三个坑，这里都绕开了：
// 1. transitionend 会冒泡。子级的折叠箭头（.nav-folder-name::before 的 transform）和
//    子级 ul 的高度动画，事件都会冒泡到祖先的 ul 上；祖先"动画结束"的回调被提前触发，
//    正在跑的动画就被中断（收起时会提前 display:none，展开时会提前跳到 auto）。
//    → 不再监听 transitionend，统一用 setTimeout + token，过期回调直接丢弃。
// 2. 父级按"子级还收起时"量到的高度定死像素，子级一动就把子级裁掉，看起来就是
//    "子文件夹展开动画后马上收回去"。
//    → 展开/收起子级时，把每个已展开祖先的高度按同样的像素量同步伸缩，父子同速。
// 3. 动画结束后留下 px 高度 + overflow:hidden，内容一变就是裁切、收起后还会留下空白。
//    → 动画结束一律把 height 交还给 auto。
//
// "展开全部"按深度分批：父级先展开完毕（并交还 auto），子级再动画，避免父级拿着
// "子级还收起时"的旧高度把子级裁掉。
(function() {
  const nav = document.getElementById('navSidebar');
  const toggleBtn = document.getElementById('navToggleBtn');
  const showBtn = document.getElementById('navShowBtn');
  if (!nav || !toggleBtn || !showBtn) return;

  const DURATION = 300; // 文件夹展开/收起的动画时长（ms），与 CSS 保持一致

  nav.classList.remove('init-hide');

  const savedState = localStorage.getItem('navSidebarCollapsed');
  const shouldCollapse = (savedState === null && window.innerWidth <= 1024) || savedState === 'true';

  if (shouldCollapse) {
    nav.style.transition = 'none';
    nav.classList.add('collapsed');
    void nav.offsetHeight;
    nav.style.transition = '';
  }

  function updateUI() {
    const isCollapsed = nav.classList.contains('collapsed');
    showBtn.style.display = isCollapsed ? 'block' : 'none';
    toggleBtn.innerHTML = isCollapsed ? '▶ 展开导航' : '◀ 收起导航';
    // 桌面端展开时给正文让出左侧空间（见模板里的 body.nav-expanded 规则）
    document.body.classList.toggle('nav-expanded', !isCollapsed);
  }

  window.collapseNavSidebar = function() {
    if (window.innerWidth <= 1024 && !nav.classList.contains('collapsed')) {
      nav.classList.add('collapsed');
      localStorage.setItem('navSidebarCollapsed', 'true');
      updateUI();
    }
  };

  toggleBtn.addEventListener('click', () => {
    nav.classList.toggle('collapsed');
    localStorage.setItem('navSidebarCollapsed', nav.classList.contains('collapsed'));
    updateUI();
  });
  showBtn.addEventListener('click', () => {
    nav.classList.remove('collapsed');
    localStorage.setItem('navSidebarCollapsed', 'false');
    updateUI();
  });
  updateUI();

  const allFolders = Array.from(document.querySelectorAll('.nav-folder'));
  const toggleAllBtn = document.getElementById('toggleAllFolders');
  const navInner = document.querySelector('.nav-inner');

  const isCollapsed = folder => folder.classList.contains('collapsed');
  const subTreeOf = folder => folder.querySelector(':scope > .nav-tree');
  const heightOf = el => el.getBoundingClientRect().height;

  function forceReflowNav() {
    if (navInner) void navInner.offsetHeight;
  }

  // 高度动画。token 保证被新动画接管的元素不会吃过期回调；完成时把 height 交还给 auto，
  // 这样之后再动子级也不会被这段像素高度裁掉。
  function animateHeight(el, from, to, done) {
    if (!el) {
      if (done) done();
      return;
    }
    const token = (el.__navToken = (el.__navToken || 0) + 1);
    clearTimeout(el.__navTimer);
    el.style.transition = 'none';
    el.style.height = from + 'px';
    void el.offsetHeight; // 提交起点，之后的赋值才会成为一次 transition
    el.style.transition = 'height ' + DURATION + 'ms ease';
    el.style.height = to + 'px';
    el.__navTimer = setTimeout(function() {
      if (el.__navToken !== token) return; // 已被更晚的动画接管，什么也别做
      el.style.transition = '';
      el.style.height = ''; // auto
      el.style.overflow = '';
      forceReflowNav();
      if (done) done();
    }, DURATION + 30);
  }

  // 已展开的祖先（由内向外）
  function expandedAncestors(folder) {
    const list = [];
    let parent = folder.parentElement;
    while (parent) {
      if (parent.classList.contains('nav-folder') && !isCollapsed(parent)) {
        list.push(parent);
      }
      parent = parent.parentElement;
    }
    return list;
  }

  // 展开一个文件夹。子级长高的同时，已展开的祖先按同样的像素量一起长高，
  // 父级既不会提前裁掉子级，动画结束后也不会残留像素高度。
  function openFolder(folder, animated, done) {
    const sub = subTreeOf(folder);
    folder.classList.remove('collapsed');
    if (!sub) {
      if (done) done();
      return;
    }

    // 先量祖先（此刻这个文件夹还是收起的，祖先的高度才是"增量"的基准），
    // 再去量本级的 内容高度——顺序反了的话会把本级内容算进基准，父级会多长一截。
    const ancestors = animated ? expandedAncestors(folder) : [];
    const from = ancestors.map(a => {
      const s = subTreeOf(a);
      return s ? heightOf(s) : 0;
    });

    sub.style.transition = 'none';
    sub.style.display = 'block';
    sub.style.height = 'auto';
    const target = sub.scrollHeight; // 子级此时还是收起的，这是"当前内容"的高度

    if (!animated) {
      sub.style.transition = '';
      sub.style.height = '';
      if (done) done();
      return;
    }

    let pending = ancestors.length + 1;
    const finish = function() {
      if (--pending === 0 && done) done();
    };

    ancestors.forEach((a, i) => animateHeight(subTreeOf(a), from[i], from[i] + target, finish));
    animateHeight(sub, 0, target, finish);
  }

  // 收起一个文件夹。祖先按子级当前高度同步收回，收起后不留空白。
  function closeFolder(folder, animated, done) {
    const sub = subTreeOf(folder);
    folder.classList.add('collapsed');
    if (!sub) {
      if (done) done();
      return;
    }

    // 同样是先量祖先、再动本级的样式
    const ancestors = animated ? expandedAncestors(folder) : [];
    const from = ancestors.map(a => {
      const s = subTreeOf(a);
      return s ? heightOf(s) : 0;
    });

    sub.style.transition = 'none';
    sub.style.display = 'block'; // 保证量得到高度（可能刚被 display:none 过）
    const start = heightOf(sub);
    sub.style.height = start + 'px';

    if (!animated) {
      sub.style.transition = '';
      sub.style.height = '';
      sub.style.display = 'none';
      if (done) done();
      return;
    }

    let pending = ancestors.length + 1;
    const finish = function() {
      if (--pending === 0 && done) done();
    };

    ancestors.forEach((a, i) => animateHeight(subTreeOf(a), from[i], Math.max(0, from[i] - start), finish));
    animateHeight(sub, start, 0, function() {
      sub.style.display = 'none';
      finish();
    });
  }

  // 文件夹在树里的层级（外层 0）
  function depthOf(folder) {
    let depth = 0;
    let parent = folder.parentElement;
    while (parent) {
      if (parent.classList.contains('nav-folder')) depth++;
      parent = parent.parentElement;
    }
    return depth;
  }

  // 批量展开/收起：按深度分批，等这一层全部动画结束再动下一层
  function runBatch(folders, expand) {
    if (!folders.length) return;
    const groups = new Map();
    folders.forEach(f => {
      const d = depthOf(f);
      if (!groups.has(d)) groups.set(d, []);
      groups.get(d).push(f);
    });
    const depths = Array.from(groups.keys()).sort((a, b) => (expand ? a - b : b - a));
    let index = 0;

    (function next() {
      const list = groups.get(depths[index++]);
      if (!list) {
        saveCollapsedState();
        forceReflowNav();
        return;
      }
      let pending = list.length;
      list.forEach(f => {
        const finish = function() {
          if (--pending === 0) next();
        };
        if (expand) openFolder(f, true, finish);
        else closeFolder(f, true, finish);
      });
    })();
  }

  // 立刻把所有文件夹落到当前 class 对应的终态，丢弃在跑的动画（首屏、resize、连点用）
  function settleAll() {
    allFolders.forEach(f => {
      const sub = subTreeOf(f);
      if (!sub) return;
      clearTimeout(sub.__navTimer);
      sub.__navToken = (sub.__navToken || 0) + 1;
      sub.style.transition = '';
      sub.style.height = '';
      sub.style.overflow = '';
      sub.style.display = isCollapsed(f) ? 'none' : 'block';
    });
    forceReflowNav();
  }

  function saveCollapsedState() {
    const state = {};
    allFolders.forEach(f => {
      const name = f.querySelector('.nav-folder-name')?.textContent?.trim() || '';
      state[name] = isCollapsed(f);
    });
    localStorage.setItem('collapsedFolders', JSON.stringify(state));
  }

  function expandParentsOfCurrent() {
    const currentFile = document.querySelector('.nav-file.current');
    if (!currentFile) return;

    const parents = [];
    let parent = currentFile.parentElement;
    while (parent) {
      if (parent.classList.contains('nav-folder')) parents.unshift(parent);
      parent = parent.parentElement;
    }

    parents.forEach(f => openFolder(f, false));
    forceReflowNav();

    requestAnimationFrame(() => {
      currentFile.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  }

  // 首屏：只有当前页所在的目录链展开，其余收起（静态完成，不做动画）
  allFolders.forEach(f => f.classList.add('collapsed'));
  settleAll();
  expandParentsOfCurrent();
  saveCollapsedState();

  window.addEventListener('load', function() {
    const currentFile = document.querySelector('.nav-file.current');
    if (currentFile) {
      requestAnimationFrame(() => {
        currentFile.scrollIntoView({ block: 'center', behavior: 'auto' });
      });
    }
  });

  // 窗口变化时把在跑的动画落定，避免残留半截的像素高度
  window.addEventListener('resize', settleAll);

  allFolders.forEach(folder => {
    const nameEl = folder.querySelector('.nav-folder-name');
    if (!nameEl) return;
    nameEl.addEventListener('click', function(e) {
      e.stopPropagation();
      if (isCollapsed(folder)) {
        openFolder(folder, true, saveCollapsedState);
      } else {
        closeFolder(folder, true, saveCollapsedState);
      }
    });
  });

  if (toggleAllBtn) {
    toggleAllBtn.addEventListener('click', function() {
      settleAll(); // 上一批动画没跑完就直接落定，避免两批互相抢高度
      // 只有"全都展开"时才全部收起，否则一律展开——否则页面上只要有一个目录是
      // 展开的（当前页所在的目录链永远展开），点"展开全部"反而会把目录收起来
      const allExpanded = allFolders.length > 0 && allFolders.every(f => !isCollapsed(f));
      const targets = allFolders.filter(f => (allExpanded ? !isCollapsed(f) : isCollapsed(f)));
      runBatch(targets, !allExpanded);
    });
  }

  document.querySelectorAll('.nav-file a').forEach(link => {
    link.addEventListener('click', function() {
      if (window.collapseNavSidebar) {
        window.collapseNavSidebar();
      }
    });
  });
})();
