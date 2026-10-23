document.addEventListener('DOMContentLoaded', function () {
  function extractLang(codeEl) {
    const cls = codeEl.className || '';
    const match = cls.match(/language-(\S+)/);
    if (!match) return '';
    let lang = match[1].toLowerCase();
    const map = {
      cpp: 'C++', c: 'C', js: 'JavaScript', ts: 'TypeScript',
      py: 'Python', java: 'Java', html: 'HTML', css: 'CSS',
      bash: 'Bash', shell: 'Shell', json: 'JSON', xml: 'XML',
      yaml: 'YAML', sql: 'SQL', go: 'Go', rust: 'Rust',
      adoc: 'AsciiDoc', md: 'Markdown', plaintext: 'Text'
    };
    return map[lang] || lang.toUpperCase();
  }

  document.querySelectorAll('pre').forEach(function (pre) {
    if (pre.querySelector('.code-toolbar')) return;

    const code = pre.querySelector('code');
    const lang = code ? extractLang(code) : '';

    const toolbar = document.createElement('div');
    toolbar.className = 'code-toolbar';

    if (lang) {
      const langSpan = document.createElement('span');
      langSpan.className = 'code-lang';
      langSpan.textContent = lang;
      toolbar.appendChild(langSpan);
    }

    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.innerHTML = '📋';
    copyBtn.title = '复制代码';
    toolbar.appendChild(copyBtn);

    toolbar.addEventListener('click', function (e) {
      const text = code ? code.innerText : pre.innerText;
      navigator.clipboard.writeText(text).then(() => {
        copyBtn.innerHTML = '✅';
        setTimeout(() => { copyBtn.innerHTML = '📋'; }, 2000);
      }).catch(() => {
        copyBtn.innerHTML = '❌';
        setTimeout(() => { copyBtn.innerHTML = '📋'; }, 2000);
      });
    });

    pre.style.position = 'relative';
    pre.appendChild(toolbar);
  });
});
