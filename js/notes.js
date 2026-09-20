// 追蹤筆記頁邏輯：可填寫表格（股票代號 / 目標價格 / 想問的問題），資料存於 Supabase「notes」資料表
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

let notes = [];

async function fetchNotes() {
  const { data, error } = await supabaseClient
    .from('notes')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) {
    console.error('讀取追蹤筆記失敗', error);
    return [];
  }
  return data;
}

async function updateNoteField(id, patch) {
  const { error } = await supabaseClient
    .from('notes')
    .update(patch)
    .eq('id', id);
  if (error) console.error('更新追蹤筆記失敗', error);
}

const debouncedUpdateNoteField = debounce(updateNoteField, 500);

async function insertNote() {
  const { data, error } = await supabaseClient
    .from('notes')
    .insert({ code: '', target_price: null, question: '' })
    .select()
    .single();
  if (error) {
    console.error('新增追蹤筆記失敗', error);
    return null;
  }
  return data;
}

async function deleteNote(id) {
  const { error } = await supabaseClient.from('notes').delete().eq('id', id);
  if (error) console.error('刪除追蹤筆記失敗', error);
}

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
      debouncedUpdateNoteField(note.id, { code: note.code });
    });
    codeTd.appendChild(codeInput);

    const priceTd = document.createElement('td');
    const priceInput = document.createElement('input');
    priceInput.type = 'number';
    priceInput.step = '0.01';
    priceInput.placeholder = '例如 650';
    priceInput.value = note.target_price ?? '';
    priceInput.addEventListener('input', () => {
      note.target_price = priceInput.value === '' ? null : Number(priceInput.value);
      debouncedUpdateNoteField(note.id, { target_price: note.target_price });
    });
    priceTd.appendChild(priceInput);

    const questionTd = document.createElement('td');
    const questionInput = document.createElement('textarea');
    questionInput.placeholder = '想問的問題，例如：這波法人是否持續買超？';
    questionInput.value = note.question || '';
    questionInput.addEventListener('input', () => {
      note.question = questionInput.value;
      debouncedUpdateNoteField(note.id, { question: note.question });
    });
    questionTd.appendChild(questionInput);

    const actionTd = document.createElement('td');
    const delBtn = document.createElement('button');
    delBtn.className = 'row-delete-btn';
    delBtn.textContent = '刪除';
    delBtn.addEventListener('click', async () => {
      notes = notes.filter((n) => n.id !== note.id);
      renderNotesTable();
      await deleteNote(note.id);
    });
    actionTd.appendChild(delBtn);

    tr.appendChild(codeTd);
    tr.appendChild(priceTd);
    tr.appendChild(questionTd);
    tr.appendChild(actionTd);
    body.appendChild(tr);
  });
}

async function addRow() {
  const newNote = await insertNote();
  if (!newNote) return;
  notes.push(newNote);
  renderNotesTable();
  const rows = document.querySelectorAll('#notes-table-body tr');
  const lastRow = rows[rows.length - 1];
  if (lastRow) {
    const firstInput = lastRow.querySelector('input');
    if (firstInput) firstInput.focus();
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  renderWatchlistSidebar();
  notes = await fetchNotes();
  renderNotesTable();
  document.getElementById('add-row-btn').addEventListener('click', addRow);
});
