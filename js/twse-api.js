// 台灣證券交易所 OpenAPI 呼叫封裝（含 localStorage 快取，避免過度請求）
const TWSE_BASE = 'https://www.twse.com.tw';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cacheGet(key, maxAgeMs) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.t > maxAgeMs) return null;
    return parsed.data;
  } catch (e) {
    return null;
  }
}

function cacheSet(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ t: Date.now(), data }));
  } catch (e) {
    /* 儲存空間不足時略過快取 */
  }
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function isCurrentMonth(year, month) {
  const now = new Date();
  return year === now.getFullYear() && month === now.getMonth() + 1;
}

// 取得單一股票、單一月份的每日成交資訊
async function fetchStockMonth(stockNo, year, month) {
  const dateStr = `${year}${pad2(month)}01`;
  const cacheKey = `twse_day_${stockNo}_${year}${pad2(month)}`;
  const maxAge = isCurrentMonth(year, month) ? 30 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
  const cached = cacheGet(cacheKey, maxAge);
  if (cached) return cached;
  const url = `${TWSE_BASE}/exchangeReport/STOCK_DAY?response=json&date=${dateStr}&stockNo=${encodeURIComponent(stockNo)}`;
  const json = await fetchJSON(url);
  cacheSet(cacheKey, json);
  return json;
}

// 將 STOCK_DAY 回傳的月資料轉為統一格式的日 K 陣列
function parseStockDayRows(json, stockNo) {
  if (!json || json.stat !== 'OK' || !Array.isArray(json.data)) return { name: null, rows: [] };
  let name = null;
  if (json.title) {
    const idx = json.title.indexOf(stockNo);
    if (idx >= 0) {
      const rest = json.title.slice(idx + stockNo.length).trim();
      name = rest.split(/\s+/)[0] || null;
    }
  }
  const rows = [];
  for (const cols of json.data) {
    // fields: 日期, 成交股數, 成交金額, 開盤價, 最高價, 最低價, 收盤價, 漲跌價差, 成交筆數, 註記
    const [dateStr, volStr, , openStr, highStr, lowStr, closeStr] = cols;
    const open = parseFloat(String(openStr).replace(/,/g, ''));
    const high = parseFloat(String(highStr).replace(/,/g, ''));
    const low = parseFloat(String(lowStr).replace(/,/g, ''));
    const close = parseFloat(String(closeStr).replace(/,/g, ''));
    const volume = parseFloat(String(volStr).replace(/,/g, ''));
    if ([open, high, low, close].some((v) => Number.isNaN(v))) continue;
    const m = dateStr.match(/^(\d+)\/(\d+)\/(\d+)$/);
    if (!m) continue;
    const gYear = parseInt(m[1], 10) + 1911;
    const time = `${gYear}-${pad2(parseInt(m[2], 10))}-${pad2(parseInt(m[3], 10))}`;
    rows.push({ time, open, high, low, close, volume: Number.isNaN(volume) ? 0 : volume });
  }
  return { name, rows };
}

// 取得股票近 N 個月的日 K 資料（依序請求並加入延遲，避免觸發速率限制）
async function fetchStockHistory(stockNo, months, onProgress) {
  const now = new Date();
  let name = null;
  const rows = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    try {
      const json = await fetchStockMonth(stockNo, d.getFullYear(), d.getMonth() + 1);
      const parsed = parseStockDayRows(json, stockNo);
      if (parsed.name) name = parsed.name;
      rows.push(...parsed.rows);
    } catch (e) {
      // 單月失敗不中斷整體查詢
    }
    if (onProgress) onProgress(months - i, months);
    if (i > 0) await sleep(250);
  }
  return { name, rows };
}

// 取得本益比 / 殖利率 / 股價淨值比（BWIBBU），若當月尚無資料則往前一個月查詢
async function fetchFundamentals(stockNo) {
  const now = new Date();
  for (let back = 0; back < 3; back++) {
    const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const dateStr = `${d.getFullYear()}${pad2(d.getMonth() + 1)}01`;
    const cacheKey = `twse_bwibbu_${stockNo}_${d.getFullYear()}${pad2(d.getMonth() + 1)}`;
    const maxAge = back === 0 ? 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
    let json = cacheGet(cacheKey, maxAge);
    if (!json) {
      try {
        const url = `${TWSE_BASE}/exchangeReport/BWIBBU?response=json&date=${dateStr}&stockNo=${encodeURIComponent(stockNo)}`;
        json = await fetchJSON(url);
        cacheSet(cacheKey, json);
      } catch (e) {
        continue;
      }
    }
    if (json && json.stat === 'OK' && Array.isArray(json.data) && json.data.length > 0) {
      const last = json.data[json.data.length - 1];
      // fields: 日期, 殖利率(%), 股利年度, 本益比, 股價淨值比, 財報年/季
      const [dateLabel, yieldStr, , peStr, pbStr] = last;
      return {
        date: dateLabel,
        yieldPct: parseFloat(yieldStr),
        pe: parseFloat(peStr),
        pb: parseFloat(pbStr),
      };
    }
  }
  return null;
}

// 取得大盤發行量加權股價指數（TAIEX）單一月份日資料
async function fetchTaiexMonth(year, month) {
  const dateStr = `${year}${pad2(month)}01`;
  const cacheKey = `twse_taiex_${year}${pad2(month)}`;
  const maxAge = isCurrentMonth(year, month) ? 30 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
  const cached = cacheGet(cacheKey, maxAge);
  if (cached) return cached;
  const url = `${TWSE_BASE}/indicesReport/MI_5MINS_HIST?response=json&date=${dateStr}`;
  const json = await fetchJSON(url);
  cacheSet(cacheKey, json);
  return json;
}

function parseTaiexRows(json) {
  if (!json || json.stat !== 'OK' || !Array.isArray(json.data)) return [];
  const rows = [];
  for (const cols of json.data) {
    // fields: 日期, 開盤指數, 最高指數, 最低指數, 收盤指數
    const [dateStr, openStr, highStr, lowStr, closeStr] = cols;
    const open = parseFloat(String(openStr).replace(/,/g, ''));
    const high = parseFloat(String(highStr).replace(/,/g, ''));
    const low = parseFloat(String(lowStr).replace(/,/g, ''));
    const close = parseFloat(String(closeStr).replace(/,/g, ''));
    if ([open, high, low, close].some((v) => Number.isNaN(v))) continue;
    const m = dateStr.match(/^(\d+)\/(\d+)\/(\d+)$/);
    if (!m) continue;
    const gYear = parseInt(m[1], 10) + 1911;
    const time = `${gYear}-${pad2(parseInt(m[2], 10))}-${pad2(parseInt(m[3], 10))}`;
    rows.push({ time, open, high, low, close });
  }
  return rows;
}

async function fetchTaiexHistory(months) {
  const now = new Date();
  const rows = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    try {
      const json = await fetchTaiexMonth(d.getFullYear(), d.getMonth() + 1);
      rows.push(...parseTaiexRows(json));
    } catch (e) {
      /* 略過失敗月份 */
    }
    if (i > 0) await sleep(200);
  }
  return rows;
}

// 大盤每日成交量值與漲跌點數（用於首頁摘要）
async function fetchMarketSummary() {
  const now = new Date();
  for (let back = 0; back < 2; back++) {
    const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const dateStr = `${d.getFullYear()}${pad2(d.getMonth() + 1)}01`;
    const cacheKey = `twse_fmtqik_${d.getFullYear()}${pad2(d.getMonth() + 1)}`;
    const maxAge = back === 0 ? 30 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
    let json = cacheGet(cacheKey, maxAge);
    if (!json) {
      try {
        const url = `${TWSE_BASE}/exchangeReport/FMTQIK?response=json&date=${dateStr}`;
        json = await fetchJSON(url);
        cacheSet(cacheKey, json);
      } catch (e) {
        continue;
      }
    }
    if (json && json.stat === 'OK' && Array.isArray(json.data) && json.data.length > 0) {
      const last = json.data[json.data.length - 1];
      // fields: 日期, 成交股數, 成交金額, 成交筆數, 發行量加權股價指數, 漲跌點數
      const [dateLabel, , amountStr, , indexStr, changeStr] = last;
      const index = parseFloat(String(indexStr).replace(/,/g, ''));
      const change = parseFloat(String(changeStr).replace(/,/g, ''));
      const amount = parseFloat(String(amountStr).replace(/,/g, ''));
      return { date: dateLabel, index, change, amount };
    }
  }
  return null;
}

// 今日公布注意股票（官方即時公開資料，可視為台股即時訊息的一種）
async function fetchAttentionStocks() {
  const cacheKey = 'twse_attention_notice';
  const cached = cacheGet(cacheKey, 20 * 60 * 1000);
  if (cached) return cached;
  const url = `${TWSE_BASE}/announcement/notice?response=json`;
  const json = await fetchJSON(url);
  const rows = (json && json.stat === 'OK' && Array.isArray(json.data)) ? json.data : [];
  cacheSet(cacheKey, rows);
  return rows;
}
