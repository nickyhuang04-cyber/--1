// 共用工具：導覽列高亮、自選股清單 (localStorage)、格式化函式
const WATCHLIST_KEY = 'tw_watchlist_v1';

const QUICK_STOCKS = [
  { code: '2330', name: '台積電' },
  { code: '2317', name: '鴻海' },
  { code: '2454', name: '聯發科' },
  { code: '0050', name: '元大台灣50' },
  { code: '2603', name: '長榮' },
  { code: '2881', name: '富邦金' },
  { code: '2882', name: '國泰金' },
  { code: '3008', name: '大立光' },
];

function getWatchlist() {
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveWatchlist(list) {
  try {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list));
  } catch (e) {
    /* localStorage 不可用時靜默略過 */
  }
}

function isInWatchlist(code) {
  return getWatchlist().includes(code);
}

function addToWatchlist(code) {
  const list = getWatchlist();
  if (!list.includes(code)) {
    list.push(code);
    saveWatchlist(list);
  }
  return list;
}

function removeFromWatchlist(code) {
  const list = getWatchlist().filter((c) => c !== code);
  saveWatchlist(list);
  return list;
}

function highlightNav() {
  const page = document.body.dataset.page;
  document.querySelectorAll('.nav a').forEach((a) => {
    a.classList.toggle('active', a.dataset.page === page);
  });
}

function fmtNum(n, digits = 2) {
  if (n === null || n === undefined || Number.isNaN(n)) return '--';
  return Number(n).toLocaleString('zh-TW', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function fmtInt(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '--';
  return Number(n).toLocaleString('zh-TW');
}

function fmtPercent(n, digits = 2) {
  if (n === null || n === undefined || Number.isNaN(n)) return '--';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(digits)}%`;
}

function changeClass(n) {
  if (n === null || n === undefined || Number.isNaN(n) || n === 0) return 'flat';
  return n > 0 ? 'up' : 'down';
}

function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

document.addEventListener('DOMContentLoaded', () => {
  highlightNav();
  const form = document.getElementById('global-search-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('global-search-input');
      const code = input.value.trim();
      if (code) {
        window.location.href = `stock.html?code=${encodeURIComponent(code)}`;
      }
    });
  }
});
