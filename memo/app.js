// ===== かんたんメモ帳の動き =====
// メモはブラウザの「localStorage（ローカルストレージ）」に保存します。
// これはブラウザに用意された小さな保存場所で、ページを閉じても消えません。

const STORAGE_KEY = "kantan-memo"; // 保存場所につける名前

// 画面の部品を取り出しておく
const input = document.getElementById("memo-input");
const saveButton = document.getElementById("save-button");
const cancelButton = document.getElementById("cancel-button");
const list = document.getElementById("memo-list");
const count = document.getElementById("memo-count");
const emptyMessage = document.getElementById("empty-message");

// 編集中のメモのID（新しく書いているときは null）
let editingId = null;

// --- 保存場所からメモを読み込む ---
function loadMemos() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return []; // 読めなかったときは空っぽとして扱う
  }
}

// --- メモを保存場所に書き込む ---
function saveMemos(memos) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memos));
  } catch (e) {
    alert("保存できませんでした（プライベートモードなどでは保存できないことがあります）");
  }
}

// --- 日付を「2026/11/08 10:30」の形にする ---
function formatDate(time) {
  const d = new Date(time);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// --- メモ一覧を画面に表示する ---
function render() {
  const memos = loadMemos();
  list.innerHTML = ""; // いったん空にしてから作り直す

  for (const memo of memos) {
    const li = document.createElement("li");

    const text = document.createElement("p");
    text.className = "memo-text";
    text.textContent = memo.text; // textContent を使うと安全に文字を表示できる

    const footer = document.createElement("div");
    footer.className = "memo-footer";

    const date = document.createElement("span");
    date.className = "memo-date";
    date.textContent = formatDate(memo.updatedAt);

    const editButton = document.createElement("button");
    editButton.className = "small";
    editButton.textContent = "編集";
    editButton.addEventListener("click", () => startEdit(memo));

    const deleteButton = document.createElement("button");
    deleteButton.className = "small danger";
    deleteButton.textContent = "削除";
    deleteButton.addEventListener("click", () => deleteMemo(memo.id));

    footer.append(date, editButton, deleteButton);
    li.append(text, footer);
    list.append(li);
  }

  count.textContent = memos.length;
  emptyMessage.hidden = memos.length > 0;
}

// --- 「保存」ボタンが押されたとき ---
function handleSave() {
  const text = input.value.trim(); // 前後の空白を取り除く
  if (text === "") {
    alert("メモが空っぽです");
    return;
  }

  const memos = loadMemos();

  if (editingId === null) {
    // 新しいメモ → 一番上に追加
    memos.unshift({ id: Date.now(), text: text, updatedAt: Date.now() });
  } else {
    // 編集中のメモ → 中身を書き換える
    const memo = memos.find((m) => m.id === editingId);
    if (memo) {
      memo.text = text;
      memo.updatedAt = Date.now();
    }
  }

  saveMemos(memos);
  resetEditor();
  render();
}

// --- 「編集」ボタンが押されたとき ---
function startEdit(memo) {
  editingId = memo.id;
  input.value = memo.text;
  saveButton.textContent = "更新";
  cancelButton.hidden = false;
  input.focus();
  window.scrollTo({ top: 0, behavior: "smooth" }); // 入力欄まで戻る
}

// --- 「削除」ボタンが押されたとき ---
function deleteMemo(id) {
  if (!confirm("このメモを削除しますか？")) return;
  const memos = loadMemos().filter((m) => m.id !== id);
  saveMemos(memos);
  if (editingId === id) resetEditor();
  render();
}

// --- 入力欄を最初の状態に戻す ---
function resetEditor() {
  editingId = null;
  input.value = "";
  saveButton.textContent = "保存";
  cancelButton.hidden = true;
}

// ボタンに動きを結びつける
saveButton.addEventListener("click", handleSave);
cancelButton.addEventListener("click", resetEditor);

// 最初に一回、一覧を表示する
render();
