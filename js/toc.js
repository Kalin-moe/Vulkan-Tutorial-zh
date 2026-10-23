// toc.js - 独立目录折叠逻辑
(function() {
  const sidebar = document.querySelector('.toc-sidebar');
  if (!sidebar || sidebar.children.length === 0) return;

  const header = sidebar.querySelector('.toc-header');
  const body = sidebar.querySelector('.toc-body');
  if (!header || !body) return;

  // 如果 TOC 内容为空，直接隐藏
  if (!body.innerHTML.trim()) {
    sidebar.style.display = 'none';
    return;
  }

  let isAnimating = false;

  // 窄屏默认折叠
  if (window.innerWidth < 1024) {
    sidebar.classList.add('toc-collapsed');
    body.style.maxHeight = '0px';
  }

  // 核心修复：获取真实高度（即使当前是折叠状态）
  function getActualHeight() {
    const wasCollapsed = sidebar.classList.contains('toc-collapsed');
    // 临时展开以获取真实高度
    if (wasCollapsed) {
      body.style.maxHeight = 'none';
      body.style.display = 'block';
    }
    // 强制回流获取真实高度
    const height = body.scrollHeight;
    if (wasCollapsed) {
      body.style.maxHeight = '0px';
      body.style.display = '';
    }
    return height;
  }

  header.addEventListener('click', function() {
    if (isAnimating) return;
    isAnimating = true;

    const isCollapsed = sidebar.classList.contains('toc-collapsed');

    if (isCollapsed) {
      // 展开：先临时释放限制获取真实高度
      body.style.maxHeight = 'none';
      body.style.display = 'block';
      void body.offsetHeight; // 强制回流
      const targetHeight = body.scrollHeight;
      // 重置为 0 准备动画
      body.style.maxHeight = '0px';
      void body.offsetHeight;
      // 设置目标高度触发过渡
      body.style.maxHeight = targetHeight + 'px';
      sidebar.classList.remove('toc-collapsed');
    } else {
      // 收起
      const currentHeight = body.scrollHeight;
      body.style.maxHeight = currentHeight + 'px';
      void body.offsetHeight;
      body.style.maxHeight = '0px';
      sidebar.classList.add('toc-collapsed');
    }

    const onEnd = function() {
      isAnimating = false;
      if (!sidebar.classList.contains('toc-collapsed')) {
        body.style.maxHeight = 'none';
        body.style.display = '';
      } else {
        body.style.maxHeight = '0px';
        body.style.display = '';
      }
      body.removeEventListener('transitionend', onEnd);
    };
    body.addEventListener('transitionend', onEnd);
  });

  // 窗口改变或加载完成后重新校准高度
  function recalcHeight() {
    if (!sidebar.classList.contains('toc-collapsed')) {
      // 临时展开以获取准确高度
      body.style.maxHeight = 'none';
      body.style.display = 'block';
      void body.offsetHeight;
      const height = body.scrollHeight;
      body.style.maxHeight = height + 'px';
      // 过渡完成后恢复
      const onEnd = function() {
        body.style.maxHeight = 'none';
        body.style.display = '';
        body.removeEventListener('transitionend', onEnd);
      };
      body.addEventListener('transitionend', onEnd);
    }
  }

  let recalcTimer;
  window.addEventListener('resize', function() {
    clearTimeout(recalcTimer);
    recalcTimer = setTimeout(recalcHeight, 100);
  });

  // 在页面完全加载后重新计算（解决图片、字体加载导致的高度变化）
  if (document.readyState === 'complete') {
    setTimeout(recalcHeight, 200);
  } else {
    window.addEventListener('load', function() {
      setTimeout(recalcHeight, 300);
    });
  }
})();
