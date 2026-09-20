// 台股新聞頁邏輯：顯示 TWSE 公布注意股票（即時公開資料）

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

async function renderNotices() {
  const statusEl = document.getElementById('notice-status');
  const tableEl = document.getElementById('notice-table');
  const bodyEl = document.getElementById('notice-table-body');
  try {
    const rows = await fetchAttentionStocks();
    if (!rows || rows.length === 0) {
      statusEl.textContent = '今日尚無公布注意股票，或資料尚未更新。';
      return;
    }
    statusEl.hidden = true;
    tableEl.hidden = false;
    // fields: 編號, 證券代號, 證券名稱, 累計次數, 注意交易資訊, 日期, 收盤價, 本益比
    bodyEl.innerHTML = rows.slice(0, 50).map((cols) => {
      const [, code, name, count, info, , close, pe] = cols;
      return `<tr>
        <td><a href="stock.html?code=${encodeURIComponent(code)}">${code}</a></td>
        <td>${name}</td>
        <td>${info}</td>
        <td>${count}</td>
        <td>${close}</td>
        <td>${pe}</td>
      </tr>`;
    }).join('');
  } catch (e) {
    statusEl.textContent = '資料載入失敗，請稍後再試。';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  renderWatchlistSidebar();
  renderNotices();
});
