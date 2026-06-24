// 5E 不全书 - 阅读器

// 根据URL参数选择书籍
const _book = new URLSearchParams(window.location.search).get('book');
const TOC_FILE = 'dnd_chm_extract/toc_full.json';
let allItems = [];
let currentItemIndex = -1;
let currentPagePath = ''; // 当前页面path，用于滚动位置保存
let _userClickedToc = false;

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// 滚动时保存阅读位置（防抖）
var _scrollTimer = null;
window.addEventListener('scroll', function() {
  if (_scrollTimer) clearTimeout(_scrollTimer);
  _scrollTimer = setTimeout(function() {
    if (currentPagePath) {
      try {
        localStorage.setItem('dnd_sp_' + _book, window.scrollY);
      } catch(e) {}
    }
  }, 800);
});

document.addEventListener('click', function(e) {
  const s = document.getElementById('sidebar');
  const t = document.getElementById('menuToggle');
  if (s && t && !s.contains(e.target) && !t.contains(e.target) && window.innerWidth <= 768) {
    s.classList.remove('open');
  }
});

// 搜索功能
function doSearch(query) {
  var results = document.getElementById('searchResults');
  if (!results) return;
  if (!query || query.length < 1) { results.classList.remove('active'); return; }
  
  var q = query.toLowerCase();
  var hits = [];
  for (var i = 0; i < allItems.length; i++) {
    var item = allItems[i];
    if (item.path && item.name.toLowerCase().includes(q)) {
      // 查找所属书籍
      var book = '';
      for (var k = i - 1; k >= 0; k--) {
        if (allItems[k].level === 1 && !allItems[k].name.startsWith('——')) {
          book = allItems[k].name;
          break;
        }
      }
      hits.push({ item: item, book: book });
      if (hits.length >= 20) break;
    }
  }
  
  if (hits.length === 0) {
    results.innerHTML = '<div class="sr-item">未找到</div>';
  } else {
    var html = '';
    for (var j = 0; j < hits.length; j++) {
      var h = hits[j].item;
      var bookName = hits[j].book;
      var name = h.name;
      var idx = name.toLowerCase().indexOf(q);
      if (idx >= 0) {
        name = name.substring(0, idx) + '<strong>' + name.substring(idx, idx + q.length) + '</strong>' + name.substring(idx + q.length);
      }
      var fn = 'loadPage(allItems[' + allItems.indexOf(h) + '])';
      html += '<div class="sr-item" onclick="' + fn + '">';
      html += '<span>' + name + '</span>';
      if (bookName) html += '<div class="sr-path">' + bookName + '</div>';
      html += '</div>';
    }
    results.innerHTML = html;
  }
  results.classList.add('active');
}

document.addEventListener('click', function(e) {
  var r = document.getElementById('searchResults');
  if (r && !e.target.closest('.search-bar')) {
    r.classList.remove('active');
  }
});

async function init() {
  const toc = document.getElementById('toc');
  if (!toc) return;

  const resp = await fetch(TOC_FILE);
  allItems = await resp.json();

  for (const item of allItems) {
    if (item.level !== 1) continue;
    if ('分隔符' === item.name) continue;

    // 分组标题（——核心规则——等）
    if (item.name.startsWith('——')) {
      const sep = document.createElement('div');
      sep.className = 'toc-item l1';
      sep.textContent = item.name.replace(/——/g, '');
      sep.style.marginTop = '12px';
      sep.style.cursor = 'default';
      sep.style.fontWeight = '600';
      sep.style.textAlign = 'center';
      toc.appendChild(sep);
      continue;
    }

    // 书籍节点（可展开）
    const group = document.createElement('div');
    group.className = 'toc-group';
    group.style.fontWeight = '700';
    group.style.paddingLeft = '12px';
    const icon = '<img src="icons/1.gif" class="toc-book-icon"> ';
    group.innerHTML = `<span>${icon}${item.name}</span> <span>▶</span>`;

    const pages = document.createElement('div');
    pages.className = 'toc-children';

    // 收集子项
    const idx = allItems.indexOf(item);
    const children = [];
    for (let i = idx + 1; i < allItems.length; i++) {
      if (allItems[i].level <= 1) break;
      if (allItems[i].path) children.push(allItems[i]);
    }

    let expanded = false;
    group.onclick = function(e) {
      e.stopPropagation();
      if (children.length > 0) {
        expanded = !expanded;
        pages.classList.toggle('open', expanded);
        group.querySelector('span:last-child').textContent = expanded ? '▼' : '▶';
      } else if (item.path) {
        loadPage(item);
      }
    };

    toc.appendChild(group);
    toc.appendChild(pages);

    if (children.length > 0) {
      renderChildren(children, pages);
    }
  }

  // 显示书籍名称
  var tag = document.getElementById('bookTag');
  if (tag) {
    tag.textContent = _book === 'coc' ? '· 克苏鲁的呼唤' : '';
  }
  if (_book === 'coc') {
    document.title = '克苏鲁的呼唤 - 规则书';
    var ft = document.getElementById('footerText');
    if (ft) ft.innerHTML = '克苏鲁的呼唤 第七版 · 基于 <a href="https://www.chaosium.com" target="_blank">Chaosium Inc.</a>';
    var lt = document.getElementById('logoTitle');
    if (lt) lt.textContent = '克苏鲁的呼唤';
  }

  // 首页 - 优先恢复阅读进度
  var savedPath = null, savedHash = null;
  try { savedPath = localStorage.getItem('dnd_reader_path'); } catch(e) {}
  try { savedHash = localStorage.getItem('dnd_reader_hash'); } catch(e) {}

  const params = new URLSearchParams(window.location.search);
  const file = params.get('file');

  if (file) {
    const t = allItems.find(i => i.path === file);
    if (t) loadPage(t);
  } else if (savedPath) {
    const t = allItems.find(function(i) { return i.path && i.path === savedPath; });
    if (t) loadPage(t, savedHash || undefined);
    else {
      // 保存的页面找不到了，回首页
      const home = allItems.find(i => i.name === '写在前面' && i.path);
      if (home) loadPage(home);
    }
  } else {
    const home = allItems.find(i => i.name === '写在前面' && i.path);
    if (home) loadPage(home);
  }
}

function renderChildren(items, parent, level) {
  if (!level) level = 2;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item.path) continue;

    // 检查有没有子项
    let hasKids = false;
    for (let j = i + 1; j < items.length; j++) {
      if (items[j].level <= item.level) break;
      hasKids = true;
      break;
    }

    if (hasKids) {
      const group = document.createElement('div');
      group.className = 'toc-group';
      group.style.fontWeight = item.level <= 2 ? '600' : '500';
      group.style.paddingLeft = (12 + (item.level - 1) * 12) + 'px';
      group.style.fontSize = item.level >= 3 ? '12px' : '13px';
      group.innerHTML = `<span>${item.name}</span> <span>▶</span>`;

      const subDiv = document.createElement('div');
      subDiv.className = 'toc-children';

      const subs = [];
      for (let j = i + 1; j < items.length; j++) {
        if (items[j].level <= item.level) break;
        if (items[j].path) subs.push(items[j]);
      }

      let expanded = false;
      group.onclick = function(e) {
        e.stopPropagation();
        expanded = !expanded;
        subDiv.classList.toggle('open', expanded);
        group.querySelector('span:last-child').textContent = expanded ? '▼' : '▶';
      };

      parent.appendChild(group);
      parent.appendChild(subDiv);
      renderChildren(subs, subDiv, item.level + 1);
      i += subs.length;

    } else {
      const a = document.createElement('a');
      a.className = 'toc-item l' + Math.min(item.level, 4);
      a.textContent = item.name;
      a.setAttribute('data-ai', allItems.indexOf(item));
      a.style.paddingLeft = (16 + (item.level - 1) * 12) + 'px';
      a.style.fontSize = item.level >= 3 ? '12px' : '13px';
      a.href = 'javascript:void(0)';
      a.onclick = (function(p) {
        return function(e) {
          e.stopPropagation();
          _userClickedToc = true;
          loadPage(p);
        };
      })(item);
      parent.appendChild(a);
    }
  }
}

// 定位到当前阅读章节
function locateInToc() {
  if (currentItemIndex < 0) return;
  var el = document.querySelector('#toc [data-ai="' + currentItemIndex + '"]');
  if (!el) return;
  // 展开所有父级目录
  var p = el.parentElement;
  while (p && p.id !== 'toc') {
    if (p.classList.contains('toc-children')) {
      p.classList.add('open');
      // 找到前一个兄弟中的 group，更新箭头
      var prev = p.previousElementSibling;
      if (prev && prev.classList.contains('toc-group')) {
        var arrow = prev.querySelector('span:last-child');
        if (arrow) arrow.textContent = '▼';
      }
    }
    p = p.parentElement;
  }
  // 滚动到可见位置
  setTimeout(function() {
    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  }, 50);
}

async function loadPage(item, hash) {
  // 自动从 item.path 提取 hash
  if (!hash && item.path) {
    var hi = item.path.indexOf('#');
    if (hi >= 0) {
      hash = item.path.substring(hi + 1);
    }
  }
  const content = document.getElementById('pageContent');
  const nav = document.getElementById('pageNav');
  if (!content) return;

  content.innerHTML = '<div class="loading">加载中...</div>';
  try {
    const resp = await fetch('dnd_chm_extract/' + item.path);
    if (!resp.ok) throw Error('404');
    let html = await resp.text();
    
    // 提取并保留脚本
    var scripts = [];
    html = html.replace(/<script[\s\S]*?<\/script>/gi, function(match) {
      scripts.push(match);
      return '';
    });
    
    html = html.replace(/<object[^>]*>[\s\S]*?<\/object>/g, '');
    html = html.replace(/<param[^>]*>/g, '');
    html = html.replace(/<head>[\s\S]*?<\/head>/g, '');
    html = html.replace(/<[\\/]?html[^>]*>/g, '');
    html = html.replace(/<[\\/]?body[^>]*>/g, '');
    html = html.replace(/<!DOCTYPE[^>]*>/gi, '');
    
    content.innerHTML = html;
    
    // 执行脚本
    for (var si = 0; si < scripts.length; si++) {
      var s = document.createElement('script');
      var srcMatch = scripts[si].match(/src="([^"]+)"/);
      if (srcMatch) {
        s.src = srcMatch[1];
      } else {
        var codeMatch = scripts[si].match(/<script[^>]*>([\s\S]*?)<\/script>/i);
        if (codeMatch && codeMatch[1].trim()) {
          s.textContent = codeMatch[1];
        }
      }
      if (s.src || s.textContent) {
        content.appendChild(s);
      }
    }
    
    document.title = item.name + ' - 5E 不全书';
    // 标记当前阅读条目
    currentItemIndex = allItems.indexOf(item);
    currentPagePath = item.path;  // 用于滚动保存
    document.querySelectorAll('#toc .toc-item.active').forEach(function(el){ el.classList.remove('active'); });
    var activeEl = document.querySelector('#toc [data-ai="' + currentItemIndex + '"]');
    if (activeEl) activeEl.classList.add('active');
    // 保存阅读进度到 localStorage，刷新后恢复
    try { localStorage.setItem('dnd_reader_path', item.path); } catch(e) {}
    if (hash) {
      try { localStorage.setItem('dnd_reader_hash', hash); } catch(e) {}
    } else {
      try { localStorage.removeItem('dnd_reader_hash'); } catch(e) {}
    }
    window.scrollTo(0, 0);
    
    // 劫持内容中的链接
    content.querySelectorAll('a[href]').forEach(function(a) {
      var href = a.getAttribute('href');
      if (href && !href.startsWith('#') && !href.startsWith('javascript') && !href.startsWith('http') && !href.startsWith('mailto')) {
        (function(origHref) {
          a.onclick = function(e) {
            e.preventDefault();
            var hashPos = origHref.indexOf('#');
            var target = hashPos >= 0 ? origHref.substring(0, hashPos) : origHref;
            var linkHash = hashPos >= 0 ? origHref.substring(hashPos + 1) : null;
            if (target.startsWith('/')) target = target.substring(1);
            else {
              var base = item.path.split('/');
              base.pop();
              while (target.startsWith('../')) {
                target = target.substring(3);
                if (base.length > 0) base.pop();
              }
              if (base.length > 0) {
                target = base.join('/') + '/' + target;
              }
            }
            var found = allItems.find(function(i) { return i.path && (i.path === target || i.path.endsWith('/' + target)); });
            if (found) loadPage(found, linkHash);
            else {
              var fakeItem = { name: target, path: target };
              loadPage(fakeItem, linkHash);
            }
          };
        })(href);
      }
    });

    // 处理锚点跳转（手动补偿header高度）
    if (hash) {
      setTimeout(function() {
        var targetEl = document.getElementById(hash);
        if (targetEl) {
          targetEl.scrollIntoView({ block: 'start', behavior: 'instant' });
          // 手动补偿固定header的高度
          var hdr = document.getElementById('header');
          if (hdr) {
            var offset = hdr.offsetHeight + 10;
            window.scrollBy(0, -offset);
          }
        }
        if (hash === 'input') {
          var inp = document.querySelector('#pageContent input, #pageContent [contenteditable]');
          if (inp) {
            inp.focus();
            if (inp.tagName === 'INPUT' || inp.tagName === 'TEXTAREA') {
              try { inp.select(); } catch(e) {}
            }
          }
        }
        // 用户主动点击目录时，不恢复滚动位置
        if (!_userClickedToc) {
          var spKey = 'dnd_sp_' + _book;
          var sp = (function(){ try { return parseInt(localStorage.getItem(spKey)); } catch(e) { return null; } })();
          if (sp && sp > 0) {
            setTimeout(function() {
              window.scrollTo({ top: sp, behavior: 'instant' });
            }, 50);
          }
        }
        _userClickedToc = false;
      }, 100);
    } else {
      // 无hash时，也尝试恢复滚动位置
      if (!_userClickedToc) {
        var spKey = 'dnd_sp_' + _book;
        var sp = (function(){ try { return parseInt(localStorage.getItem(spKey)); } catch(e) { return null; } })();
        if (sp && sp > 0) {
          setTimeout(function() {
            window.scrollTo({ top: sp, behavior: 'instant' });
          }, 50);
        }
      }
      _userClickedToc = false;
    }

    if (nav) {
      const idx = allItems.indexOf(item);
      let links = '';
      if (idx > 0) {
        const prev = allItems.slice(0, idx).reverse().find(i => i.path);
        if (prev) links += '<a href="javascript:void(0)" onclick="_userClickedToc=true;loadPage(allItems[' + allItems.indexOf(prev) + '])">← 上一页</a>';
      }
      for (let j = idx + 1; j < allItems.length; j++) {
        if (allItems[j].path) {
          links += '<a href="javascript:void(0)" onclick="_userClickedToc=true;loadPage(allItems[' + j + '])">下一页 →</a>';
          break;
        }
      }
      nav.innerHTML = links;
    }
  } catch(e) {
    content.innerHTML = '<div class="welcome-page"><h2>页面未找到</h2></div>';
  }
}

document.addEventListener('DOMContentLoaded', init);
