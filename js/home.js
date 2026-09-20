// 首頁邏輯：大盤摘要、TAIEX 走勢圖、熱門股、自選股總覽比較表

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
      renderWatchlistOverview();
    });
    li.appendChild(a);
    li.appendChild(btn);
    ul.appendChild(li);
  });
}

function renderQuickList() {
  const el = document.getElementById('quick-list');
  el.innerHTML = '';
  QUICK_STOCKS.forEach(({ code, name }) => {
    const btn = document.createElement('button');
    btn.textContent = `${name} ${code}`;
    btn.addEventListener('click', () => {
      window.location.href = `stock.html?code=${encodeURIComponent(code)}`;
    });
    el.appendChild(btn);
  });
}

async function renderMarketSummary() {
  const el = document.getElementById('market-summary');
  try {
    const summary = await fetchMarketSummary();
    if (!summary) {
      el.innerHTML = '<div class="summary-card"><div class="label">大盤資訊暫無法取得</div></div>';
      return;
    }
    const pct = (summary.change / (summary.index - summary.change)) * 100;
    el.innerHTML = `
      <div class="summary-card">
        <div class="label">加權指數 (TAIEX) · ${summary.date}</div>
        <div class="value">${fmtNum(summary.index)}</div>
        <div class="sub ${changeClass(summary.change)}">${summary.change >= 0 ? '+' : ''}${fmtNum(summary.change)}（${fmtPercent(pct)}）</div>
      </div>
      <div class="summary-card">
        <div class="label">成交金額</div>
        <div class="value">${fmtNum(summary.amount / 100000000, 1)} 億元</div>
      </div>
      <div class="summary-card">
        <div class="label">自選股數量</div>
        <div class="value">${getWatchlist().length}</div>
        <div class="sub">前往「個股」頁新增追蹤</div>
      </div>
    `;
  } catch (e) {
    el.innerHTML = '<div class="summary-card"><div class="label">大盤資訊載入失敗</div></div>';
  }
}

async function renderTaiexChart() {
  const container = document.getElementById('taiex-chart');
  const chart = LightweightCharts.createChart(container, {
    width: container.clientWidth,
    height: container.clientHeight,
    layout: { background: { color: 'transparent' }, textColor: '#9aa0b4' },
    grid: { vertLines: { color: '#2a2f3f' }, horzLines: { color: '#2a2f3f' } },
    rightPriceScale: { borderColor: '#2a2f3f' },
    timeScale: { borderColor: '#2a2f3f' },
  });
  const areaSeries = chart.addAreaSeries({
    lineColor: '#4f8cff', topColor: 'rgba(79,140,255,0.35)', bottomColor: 'rgba(79,140,255,0.02)', lineWidth: 2,
  });
  window.addEventListener('resize', () => chart.resize(container.clientWidth, container.clientHeight));

  try {
    const rows = await fetchTaiexHistory(6);
    if (rows.length === 0) {
      container.innerHTML = '<div class="hint">大盤指數資料暫無法取得</div>';
      return;
    }
    areaSeries.setData(rows.map((r) => ({ time: r.time, value: r.close })));
    chart.timeScale().fitContent();
  } catch (e) {
    container.innerHTML = '<div class="hint">大盤指數資料載入失敗</div>';
  }
}

async function renderWatchlistOverview() {
  const list = getWatchlist();
  const emptyEl = document.getElementById('watchlist-empty');
  const tableEl = document.getElementById('watchlist-table');
  const bodyEl = document.getElementById('watchlist-table-body');

  if (list.length === 0) {
    emptyEl.hidden = false;
    tableEl.hidden = true;
    return;
  }
  emptyEl.hidden = true;
  tableEl.hidden = false;
  bodyEl.innerHTML = list.map((code) => `<tr><td colspan="7">載入中：${code} ...</td></tr>`).join('');

  const rowsHtml = [];
  for (const code of list) {
    try {
      const [{ name, rows }, fundamentals] = await Promise.all([
        fetchStockHistory(code, 1),
        fetchFundamentals(code),
      ]);
      if (!rows || rows.length === 0) {
        rowsHtml.push(`<tr><td>${code}</td><td colspan="6">查無資料</td></tr>`);
        continue;
      }
      const last = rows[rows.length - 1];
      const prev = rows.length > 1 ? rows[rows.length - 2] : null;
      const diff = prev ? last.close - prev.close : null;
      const pct = prev ? (diff / prev.close) * 100 : null;
      rowsHtml.push(`
        <tr>
          <td><a href="stock.html?code=${encodeURIComponent(code)}">${code}</a></td>
          <td>${name || '--'}</td>
          <td>${fmtNum(last.close)}</td>
          <td class="${changeClass(diff)}">${diff === null ? '--' : `${diff >= 0 ? '+' : ''}${fmtNum(diff)} (${fmtPercent(pct)})`}</td>
          <td>${fundamentals ? fmtNum(fundamentals.pe) : '--'}</td>
          <td>${fundamentals ? fmtNum(fundamentals.yieldPct) : '--'}</td>
          <td>${fundamentals ? fmtNum(fundamentals.pb) : '--'}</td>
        </tr>
      `);
    } catch (e) {
      rowsHtml.push(`<tr><td>${code}</td><td colspan="6">載入失敗</td></tr>`);
    }
    bodyEl.innerHTML = rowsHtml.join('');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  renderWatchlistSidebar();
  renderQuickList();
  renderMarketSummary();
  renderTaiexChart();
  renderWatchlistOverview();
});
