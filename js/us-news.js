// 美股/國際新聞頁邏輯：解析 Yahoo Finance RSS
const US_NEWS_CACHE_KEY = 'us_news_cache_v1';
const US_NEWS_MAX_AGE = 15 * 60 * 1000;

async function renderWatchlistSidebar() {
  const ul = document.getElementById('watchlist');
  const list = getWatchlist();
  ul.innerHTML = '';
  if (list.length === 0) {
    const li = document.createElement('li');
    li.textContent = '尚無自選股';
    li.style.color = 'var(--text-dim)';
    ul.appendChild(li);
    return;
  }
  const nameMap = await getStockNameMap();
  list.forEach((code) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = `stock.html?code=${encodeURIComponent(code)}`;
    const name = nameMap[code];
    a.textContent = name ? `${name} ${code}` : code;
    const btn = document.createElement('button');
    btn.textContent = '✕';
    btn.title = '移除自選';
    btn.addEventListener('click', () => {
      removeFromWatchlist(code);
      renderWatchlistSidebar();
    });
    li.appendChild(a);
    li.appendChild(btn);
    ul.appendChild(li);
  });
}

function stripCdata(text) {
  return (text || '').replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim();
}

async function fetchUsNews() {
  try {
    const raw = localStorage.getItem(US_NEWS_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.t < US_NEWS_MAX_AGE) return parsed.data;
    }
  } catch (e) { /* 略過快取讀取錯誤 */ }

  const res = await fetch('https://finance.yahoo.com/news/rss');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xmlText = await res.text();
  const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
  const items = Array.from(doc.querySelectorAll('item')).map((item) => ({
    title: stripCdata(item.querySelector('title')?.textContent),
    link: stripCdata(item.querySelector('link')?.textContent),
    pubDate: stripCdata(item.querySelector('pubDate')?.textContent),
    description: stripCdata(item.querySelector('description')?.textContent).replace(/<[^>]+>/g, '').slice(0, 160),
  })).filter((i) => i.title && i.link);

  try {
    localStorage.setItem(US_NEWS_CACHE_KEY, JSON.stringify({ t: Date.now(), data: items }));
  } catch (e) { /* 儲存空間不足時略過 */ }

  return items;
}

async function renderNews() {
  const statusEl = document.getElementById('news-status');
  const listEl = document.getElementById('news-list');
  try {
    const items = await fetchUsNews();
    if (!items || items.length === 0) {
      statusEl.textContent = '目前無法取得新聞資料。';
      return;
    }
    statusEl.hidden = true;
    listEl.innerHTML = items.slice(0, 25).map((item) => {
      const date = item.pubDate ? new Date(item.pubDate) : null;
      const dateLabel = date && !Number.isNaN(date.getTime())
        ? date.toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
        : item.pubDate;
      return `<li>
        <a href="${item.link}" target="_blank" rel="noopener">${item.title}</a>
        <div class="news-meta">${dateLabel || ''}</div>
        ${item.description ? `<div class="news-desc">${item.description}...</div>` : ''}
      </li>`;
    }).join('');
  } catch (e) {
    statusEl.textContent = '新聞載入失敗，可能是來源暫時無回應，請稍後再試。';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  renderWatchlistSidebar();
  renderNews();
});
