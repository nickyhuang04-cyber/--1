// 追蹤筆記頁邏輯：可填寫表格（股票代號 / 目標價格 / 想問的問題），存於 localStorage
const NOTES_KEY = 'tw_notes_v1';

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

function loadNotes() {
  try {
    const raw = localStorage.getItem(NOTES_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

function saveNotes(list) {
  try {
    localStorage.setItem(NOTES_KEY, JSON.stringify(list));
  } catch (e) {
    /* localStorage 不可用時靜默略過 */
  }
}

function makeId() {
  return `n${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

let notes = loadNotes();

function renderNotesTable() {
  const body = document.getElementById('notes-table-body');
  body.innerHTML = '';

  if (notes.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 4;
    td.className = 'notes-empty';
    td.textContent = '尚無資料，點下方「＋ 新增一列」開始記錄。';
    tr.appendChild(td);
    body.appendChild(tr);
    return;
  }

  notes.forEach((note) => {
    const tr = document.createElement('tr');
    tr.dataset.id = note.id;

    const codeTd = document.createElement('td');
    const codeInput = document.createElement('input');
    codeInput.type = 'text';
    codeInput.placeholder = '例如 2330';
    codeInput.value = note.code || '';
    codeInput.addEventListener('input', () => {
      note.code = codeInput.value;
      saveNotes(notes);
    });
    codeTd.appendChild(codeInput);

    const priceTd = document.createElement('td');
    const priceInput = document.createElement('input');
    priceInput.type = 'number';
    priceInput.step = '0.01';
    priceInput.placeholder = '例如 650';
    priceInput.value = note.targetPrice ?? '';
    priceInput.addEventListener('input', () => {
      note.targetPrice = priceInput.value;
      saveNotes(notes);
    });
    priceTd.appendChild(priceInput);

    const questionTd = document.createElement('td');
    const questionInput = document.createElement('textarea');
    questionInput.placeholder = '想問的問題，例如：這波法人是否持續買超？';
    questionInput.value = note.question || '';
    questionInput.addEventListener('input', () => {
      note.question = questionInput.value;
      saveNotes(notes);
    });
    questionTd.appendChild(questionInput);

    const actionTd = document.createElement('td');
    const delBtn = document.createElement('button');
    delBtn.className = 'row-delete-btn';
    delBtn.textContent = '刪除';
    delBtn.addEventListener('click', () => {
      notes = notes.filter((n) => n.id !== note.id);
      saveNotes(notes);
      renderNotesTable();
    });
    actionTd.appendChild(delBtn);

    tr.appendChild(codeTd);
    tr.appendChild(priceTd);
    tr.appendChild(questionTd);
    tr.appendChild(actionTd);
    body.appendChild(tr);
  });
}

function addRow() {
  notes.push({ id: makeId(), code: '', targetPrice: '', question: '' });
  saveNotes(notes);
  renderNotesTable();
  const rows = document.querySelectorAll('#notes-table-body tr');
  const lastRow = rows[rows.length - 1];
  if (lastRow) {
    const firstInput = lastRow.querySelector('input');
    if (firstInput) firstInput.focus();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  renderWatchlistSidebar();
  renderNotesTable();
  document.getElementById('add-row-btn').addEventListener('click', addRow);
});
