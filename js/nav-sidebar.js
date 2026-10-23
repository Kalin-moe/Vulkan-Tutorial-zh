// nav-sidebar.js - 宸︿晶瀵艰埅渚ц竟鏍忎笌鏂囦欢澶规姌鍙狅紙缁熶竴鐢ㄤ簬 nav 妯℃澘锛?
//
// 鎶樺彔鍔ㄧ敾韪╄繃鐨勪笁涓潙锛岃繖閲岄兘缁曞紑浜嗭細
// 1. transitionend 浼氬啋娉°€傚瓙绾х殑鎶樺彔绠ご锛?nav-folder-name::before 鐨?transform锛夊拰
//    瀛愮骇 ul 鐨勯珮搴﹀姩鐢伙紝浜嬩欢閮戒細鍐掓场鍒扮鍏堢殑 ul 涓婏紱绁栧厛"鍔ㄧ敾缁撴潫"鐨勫洖璋冭鎻愬墠瑙﹀彂锛?
//    姝ｅ湪璺戠殑鍔ㄧ敾灏辫涓柇锛堟敹璧锋椂浼氭彁鍓?display:none锛屽睍寮€鏃朵細鎻愬墠璺冲埌 auto锛夈€?
//    鈫?涓嶅啀鐩戝惉 transitionend锛岀粺涓€鐢?setTimeout + token锛岃繃鏈熷洖璋冪洿鎺ヤ涪寮冦€?
// 2. 鐖剁骇鎸?瀛愮骇杩樻敹璧锋椂"閲忓埌鐨勯珮搴﹀畾姝诲儚绱狅紝瀛愮骇涓€鍔ㄥ氨鎶婂瓙绾ц鎺夛紝鐪嬭捣鏉ュ氨鏄?
//    "瀛愭枃浠跺す灞曞紑鍔ㄧ敾鍚庨┈涓婃敹鍥炲幓"銆?
//    鈫?灞曞紑/鏀惰捣瀛愮骇鏃讹紝鎶婃瘡涓凡灞曞紑绁栧厛鐨勯珮搴︽寜鍚屾牱鐨勫儚绱犻噺鍚屾浼哥缉锛岀埗瀛愬悓閫熴€?
// 3. 鍔ㄧ敾缁撴潫鍚庣暀涓?px 楂樺害 + overflow:hidden锛屽唴瀹逛竴鍙樺氨鏄鍒囥€佹敹璧峰悗杩樹細鐣欎笅绌虹櫧銆?
//    鈫?鍔ㄧ敾缁撴潫涓€寰嬫妸 height 浜よ繕缁?auto銆?
//
// "灞曞紑鍏ㄩ儴"鎸夋繁搴﹀垎鎵癸細鐖剁骇鍏堝睍寮€瀹屾瘯锛堝苟浜よ繕 auto锛夛紝瀛愮骇鍐嶅姩鐢伙紝閬垮厤鐖剁骇鎷跨潃
// "瀛愮骇杩樻敹璧锋椂"鐨勬棫楂樺害鎶婂瓙绾ц鎺夈€?
(function() {
  const nav = document.getElementById('navSidebar');
  const toggleBtn = document.getElementById('navToggleBtn');
  const showBtn = document.getElementById('navShowBtn');
  if (!nav || !toggleBtn || !showBtn) return;

  const DURATION = 300; // 鏂囦欢澶瑰睍寮€/鏀惰捣鐨勫姩鐢绘椂闀匡紙ms锛夛紝涓?CSS 淇濇寔涓€鑷?

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
    toggleBtn.innerHTML = isCollapsed ? '鈻?灞曞紑瀵艰埅' : '鈼€ 鏀惰捣瀵艰埅';
    // 妗岄潰绔睍寮€鏃剁粰姝ｆ枃璁╁嚭宸︿晶绌洪棿锛堣妯℃澘閲岀殑 body.nav-expanded 瑙勫垯锛?
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

  // 楂樺害鍔ㄧ敾銆倀oken 淇濊瘉琚柊鍔ㄧ敾鎺ョ鐨勫厓绱犱笉浼氬悆杩囨湡鍥炶皟锛涘畬鎴愭椂鎶?height 浜よ繕缁?auto锛?
  // 杩欐牱涔嬪悗鍐嶅姩瀛愮骇涔熶笉浼氳杩欐鍍忕礌楂樺害瑁佹帀銆?
  function animateHeight(el, from, to, done) {
    if (!el) {
      if (done) done();
      return;
    }
    const token = (el.__navToken = (el.__navToken || 0) + 1);
    clearTimeout(el.__navTimer);
    el.style.transition = 'none';
    el.style.height = from + 'px';
    void el.offsetHeight; // 鎻愪氦璧风偣锛屼箣鍚庣殑璧嬪€兼墠浼氭垚涓轰竴娆?transition
    el.style.transition = 'height ' + DURATION + 'ms ease';
    el.style.height = to + 'px';
    el.__navTimer = setTimeout(function() {
      if (el.__navToken !== token) return; // 宸茶鏇存櫄鐨勫姩鐢绘帴绠★紝浠€涔堜篃鍒仛
      el.style.transition = '';
      el.style.height = ''; // auto
      el.style.overflow = '';
      forceReflowNav();
      if (done) done();
    }, DURATION + 30);
  }

  // 宸插睍寮€鐨勭鍏堬紙鐢卞唴鍚戝锛?
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

  // 灞曞紑涓€涓枃浠跺す銆傚瓙绾ч暱楂樼殑鍚屾椂锛屽凡灞曞紑鐨勭鍏堟寜鍚屾牱鐨勫儚绱犻噺涓€璧烽暱楂橈紝
  // 鐖剁骇鏃笉浼氭彁鍓嶈鎺夊瓙绾э紝鍔ㄧ敾缁撴潫鍚庝篃涓嶄細娈嬬暀鍍忕礌楂樺害銆?
  function openFolder(folder, animated, done) {
    const sub = subTreeOf(folder);
    folder.classList.remove('collapsed');
    if (!sub) {
      if (done) done();
      return;
    }

    // 鍏堥噺绁栧厛锛堟鍒昏繖涓枃浠跺す杩樻槸鏀惰捣鐨勶紝绁栧厛鐨勯珮搴︽墠鏄?澧為噺"鐨勫熀鍑嗭級锛?
    // 鍐嶅幓閲忔湰绾х殑 鍐呭楂樺害鈥斺€旈『搴忓弽浜嗙殑璇濅細鎶婃湰绾у唴瀹圭畻杩涘熀鍑嗭紝鐖剁骇浼氬闀夸竴鎴€?
    const ancestors = animated ? expandedAncestors(folder) : [];
    const from = ancestors.map(a => {
      const s = subTreeOf(a);
      return s ? heightOf(s) : 0;
    });

    sub.style.transition = 'none';
    sub.style.display = 'block';
    sub.style.height = 'auto';
    const target = sub.scrollHeight; // 瀛愮骇姝ゆ椂杩樻槸鏀惰捣鐨勶紝杩欐槸"褰撳墠鍐呭"鐨勯珮搴?

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

  // 鏀惰捣涓€涓枃浠跺す銆傜鍏堟寜瀛愮骇褰撳墠楂樺害鍚屾鏀跺洖锛屾敹璧峰悗涓嶇暀绌虹櫧銆?
  function closeFolder(folder, animated, done) {
    const sub = subTreeOf(folder);
    folder.classList.add('collapsed');
    if (!sub) {
      if (done) done();
      return;
    }

    // 鍚屾牱鏄厛閲忕鍏堛€佸啀鍔ㄦ湰绾х殑鏍峰紡
    const ancestors = animated ? expandedAncestors(folder) : [];
    const from = ancestors.map(a => {
      const s = subTreeOf(a);
      return s ? heightOf(s) : 0;
    });

    sub.style.transition = 'none';
    sub.style.display = 'block'; // 淇濊瘉閲忓緱鍒伴珮搴︼紙鍙兘鍒氳 display:none 杩囷級
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

  // 鏂囦欢澶瑰湪鏍戦噷鐨勫眰绾э紙澶栧眰 0锛?
  function depthOf(folder) {
    let depth = 0;
    let parent = folder.parentElement;
    while (parent) {
      if (parent.classList.contains('nav-folder')) depth++;
      parent = parent.parentElement;
    }
    return depth;
  }

  // 鎵归噺灞曞紑/鏀惰捣锛氭寜娣卞害鍒嗘壒锛岀瓑杩欎竴灞傚叏閮ㄥ姩鐢荤粨鏉熷啀鍔ㄤ笅涓€灞?
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

  // 绔嬪埢鎶婃墍鏈夋枃浠跺す钀藉埌褰撳墠 class 瀵瑰簲鐨勭粓鎬侊紝涓㈠純鍦ㄨ窇鐨勫姩鐢伙紙棣栧睆銆乺esize銆佽繛鐐圭敤锛?
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

  // 棣栧睆锛氬彧鏈夊綋鍓嶉〉鎵€鍦ㄧ殑鐩綍閾惧睍寮€锛屽叾浣欐敹璧凤紙闈欐€佸畬鎴愶紝涓嶅仛鍔ㄧ敾锛?
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

  // 绐楀彛鍙樺寲鏃舵妸鍦ㄨ窇鐨勫姩鐢昏惤瀹氾紝閬垮厤娈嬬暀鍗婃埅鐨勫儚绱犻珮搴?
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
      settleAll(); // 涓婁竴鎵瑰姩鐢绘病璺戝畬灏辩洿鎺ヨ惤瀹氾紝閬垮厤涓ゆ壒浜掔浉鎶㈤珮搴?
      // 鍙湁"鍏ㄩ兘灞曞紑"鏃舵墠鍏ㄩ儴鏀惰捣锛屽惁鍒欎竴寰嬪睍寮€鈥斺€斿惁鍒欓〉闈笂鍙鏈変竴涓洰褰曟槸
      // 灞曞紑鐨勶紙褰撳墠椤垫墍鍦ㄧ殑鐩綍閾炬案杩滃睍寮€锛夛紝鐐?灞曞紑鍏ㄩ儴"鍙嶈€屼細鎶婄洰褰曟敹璧锋潵
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
