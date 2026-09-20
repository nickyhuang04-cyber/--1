// 個股分析頁邏輯：查詢、繪圖（K線/均線/成交量/KD/RSI/MACD）、基本面、自選股
let currentCode = null;
let currentMonths = 6;
let charts = null; // { price, kd, rsi, macd, series: {...} }

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function setStatus(msg, isError) {
  const el = document.getElementById('status-msg');
  if (!msg) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.textContent = msg;
  el.classList.toggle('error', !!isError);
}

function renderQuickList() {
  const el = document.getElementById('quick-list');
  el.innerHTML = '';
  QUICK_STOCKS.forEach(({ code, name }) => {
    const btn = document.createElement('button');
    btn.textContent = `${name} ${code}`;
    btn.addEventListener('click', () => loadStock(code));
    el.appendChild(btn);
  });
}

function renderWatchlistSidebar() {
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
  list.forEach((code) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = `stock.html?code=${encodeURIComponent(code)}`;
    a.textContent = code;
    a.addEventListener('click', (e) => {
      e.preventDefault();
      loadStock(code);
    });
    const btn = document.createElement('button');
    btn.textContent = '✕';
    btn.title = '移除自選';
    btn.addEventListener('click', () => {
      removeFromWatchlist(code);
      renderWatchlistSidebar();
      if (code === currentCode) updateWatchButton();
    });
    li.appendChild(a);
    li.appendChild(btn);
    ul.appendChild(li);
  });
}

function updateWatchButton() {
  const btn = document.getElementById('watch-btn');
  const active = isInWatchlist(currentCode);
  btn.textContent = active ? '★ 已加入自選' : '＋ 加入自選';
  btn.classList.toggle('active', active);
}

function ensureCharts() {
  if (charts) return charts;

  const priceEl = document.getElementById('price-chart');
  const kdEl = document.getElementById('kd-chart');
  const rsiEl = document.getElementById('rsi-chart');
  const macdEl = document.getElementById('macd-chart');

  const commonOptions = {
    layout: { background: { color: 'transparent' }, textColor: '#9aa0b4' },
    grid: { vertLines: { color: '#2a2f3f' }, horzLines: { color: '#2a2f3f' } },
    rightPriceScale: { borderColor: '#2a2f3f' },
    timeScale: { borderColor: '#2a2f3f' },
    crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
  };

  const priceChart = LightweightCharts.createChart(priceEl, {
    ...commonOptions,
    width: priceEl.clientWidth,
    height: priceEl.clientHeight,
  });
  const candleSeries = priceChart.addCandlestickSeries({
    upColor: '#e6483c', downColor: '#1fa774',
    borderUpColor: '#e6483c', borderDownColor: '#1fa774',
    wickUpColor: '#e6483c', wickDownColor: '#1fa774',
  });
  candleSeries.priceScale().applyOptions({ scaleMargins: { top: 0.05, bottom: 0.28 } });

  const volumeSeries = priceChart.addHistogramSeries({
    priceFormat: { type: 'volume' },
    priceScaleId: '',
  });
  volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.78, bottom: 0 } });

  const maColors = { ma5: '#f5b301', ma10: '#4f8cff', ma20: '#b478ff', ma60: '#ff7ac6' };
  const maSeries = {};
  Object.entries(maColors).forEach(([key, color]) => {
    maSeries[key] = priceChart.addLineSeries({ color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
  });

  const kdChart = LightweightCharts.createChart(kdEl, { ...commonOptions, width: kdEl.clientWidth, height: kdEl.clientHeight });
  const kSeries = kdChart.addLineSeries({ color: '#4f8cff', lineWidth: 1.5 });
  const dSeries = kdChart.addLineSeries({ color: '#f5b301', lineWidth: 1.5 });

  const rsiChart = LightweightCharts.createChart(rsiEl, { ...commonOptions, width: rsiEl.clientWidth, height: rsiEl.clientHeight });
  const rsiSeries = rsiChart.addLineSeries({ color: '#b478ff', lineWidth: 1.5 });

  const macdChart = LightweightCharts.createChart(macdEl, { ...commonOptions, width: macdEl.clientWidth, height: macdEl.clientHeight });
  const macdHistSeries = macdChart.addHistogramSeries({ priceFormat: { type: 'price', precision: 2 } });
  const macdLineSeries = macdChart.addLineSeries({ color: '#4f8cff', lineWidth: 1.5 });
  const macdSignalSeries = macdChart.addLineSeries({ color: '#f5b301', lineWidth: 1.5 });

  const allCharts = [priceChart, kdChart, rsiChart, macdChart];
  let syncing = false;
  allCharts.forEach((chart) => {
    chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (syncing || !range) return;
      syncing = true;
      allCharts.forEach((other) => {
        if (other !== chart) other.timeScale().setVisibleLogicalRange(range);
      });
      syncing = false;
    });
  });

  window.addEventListener('resize', () => {
    priceChart.resize(priceEl.clientWidth, priceEl.clientHeight);
    kdChart.resize(kdEl.clientWidth, kdEl.clientHeight);
    rsiChart.resize(rsiEl.clientWidth, rsiEl.clientHeight);
    macdChart.resize(macdEl.clientWidth, macdEl.clientHeight);
  });

  charts = {
    priceChart, kdChart, rsiChart, macdChart,
    candleSeries, volumeSeries, maSeries,
    kSeries, dSeries, rsiSeries,
    macdHistSeries, macdLineSeries, macdSignalSeries,
  };
  return charts;
}

function toLine(times, values) {
  const out = [];
  for (let i = 0; i < times.length; i++) {
    if (values[i] !== null && values[i] !== undefined && !Number.isNaN(values[i])) {
      out.push({ time: times[i], value: values[i] });
    }
  }
  return out;
}

function renderCharts(rows) {
  const c = ensureCharts();
  const times = rows.map((r) => r.time);
  const closes = rows.map((r) => r.close);
  const highs = rows.map((r) => r.high);
  const lows = rows.map((r) => r.low);

  c.candleSeries.setData(rows.map((r) => ({ time: r.time, open: r.open, high: r.high, low: r.low, close: r.close })));
  c.volumeSeries.setData(rows.map((r, i) => ({
    time: r.time,
    value: r.volume,
    color: r.close >= r.open ? 'rgba(230,72,60,0.5)' : 'rgba(31,167,116,0.5)',
  })));

  c.maSeries.ma5.setData(toLine(times, sma(closes, 5)));
  c.maSeries.ma10.setData(toLine(times, sma(closes, 10)));
  c.maSeries.ma20.setData(toLine(times, sma(closes, 20)));
  c.maSeries.ma60.setData(toLine(times, sma(closes, 60)));

  const { k, d } = kd(highs, lows, closes, 9);
  c.kSeries.setData(toLine(times, k));
  c.dSeries.setData(toLine(times, d));

  c.rsiSeries.setData(toLine(times, rsi(closes, 14)));

  const macdResult = macd(closes, 12, 26, 9);
  c.macdHistSeries.setData(rows.map((r, i) => (
    macdResult.hist[i] === null ? null : {
      time: r.time,
      value: macdResult.hist[i],
      color: macdResult.hist[i] >= 0 ? 'rgba(230,72,60,0.6)' : 'rgba(31,167,116,0.6)',
    }
  )).filter(Boolean));
  c.macdLineSeries.setData(toLine(times, macdResult.macd));
  c.macdSignalSeries.setData(toLine(times, macdResult.signal));

  [c.priceChart, c.kdChart, c.rsiChart, c.macdChart].forEach((chart) => chart.timeScale().fitContent());
}

async function loadStock(code) {
  code = String(code).trim();
  if (!code) return;
  currentCode = code;
  document.getElementById('global-search-input').value = code;
  document.getElementById('stock-panel').hidden = true;
  setStatus(`查詢中：${code} ...`, false);

  try {
    const [{ name, rows }, fundamentals] = await Promise.all([
      fetchStockHistory(code, currentMonths),
      fetchFundamentals(code),
    ]);

    if (!rows || rows.length === 0) {
      setStatus(`查無「${code}」的交易資料，請確認為上市股票代號（本站暫不支援上櫃股票）。`, true);
      return;
    }

    setStatus(null);
    document.getElementById('stock-panel').hidden = false;

    document.getElementById('stock-name').textContent = name || code;
    document.getElementById('stock-code').textContent = code;

    const last = rows[rows.length - 1];
    const prev = rows.length > 1 ? rows[rows.length - 2] : null;
    document.getElementById('stock-price').textContent = fmtNum(last.close);
    const changeEl = document.getElementById('stock-change');
    if (prev) {
      const diff = last.close - prev.close;
      const pct = (diff / prev.close) * 100;
      changeEl.textContent = `${diff >= 0 ? '+' : ''}${fmtNum(diff)} (${fmtPercent(pct)})`;
      changeEl.className = `stock-change ${changeClass(diff)}`;
    } else {
      changeEl.textContent = '--';
      changeEl.className = 'stock-change flat';
    }

    document.getElementById('fund-pe').textContent = fundamentals ? fmtNum(fundamentals.pe) : '--';
    document.getElementById('fund-yield').textContent = fundamentals ? fmtNum(fundamentals.yieldPct) : '--';
    document.getElementById('fund-pb').textContent = fundamentals ? fmtNum(fundamentals.pb) : '--';
    document.getElementById('fund-month').textContent = fundamentals ? fundamentals.date : '--';

    renderCharts(rows);
    updateWatchButton();

    const url = new URL(window.location.href);
    url.searchParams.set('code', code);
    window.history.replaceState({}, '', url);
  } catch (e) {
    setStatus('查詢失敗，可能是台灣證券交易所 API 暫時無回應，請稍後再試。', true);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  renderQuickList();
  renderWatchlistSidebar();

  document.querySelectorAll('.range-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.range-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentMonths = parseInt(btn.dataset.months, 10);
      if (currentCode) loadStock(currentCode);
    });
  });

  document.getElementById('watch-btn').addEventListener('click', () => {
    if (!currentCode) return;
    if (isInWatchlist(currentCode)) removeFromWatchlist(currentCode);
    else addToWatchlist(currentCode);
    updateWatchButton();
    renderWatchlistSidebar();
  });

  const initialCode = getQueryParam('code') || '2330';
  loadStock(initialCode);
});
