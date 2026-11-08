// ===== 打撃成績スコアシートの動き =====
// データはメモ帳と同じく、ブラウザの「localStorage」に保存します。
//
// 保存するデータの形：
// {
//   players: [ { id, number, name } ],                 ← 選手（並び順＝打順）
//   games:   [ { id, date, opponent,
//                atBats: [ { id, playerId, result, rbi } ] } ]  ← 試合と打席
// }

const STORAGE_KEY = "softball-score";

// --- 打席結果の種類 ---
// ab:    打数に数えるか（四球・死球・犠打・犠飛は数えない）
// bases: ヒットなら何塁打か（0はヒットではない）
// kind:  ボタンの色分け（hit=ヒット、walk=四死球、out=アウトなど）
const RESULTS = {
  single:    { label: "単打",   short: "安",   ab: true,  bases: 1, kind: "hit" },
  double:    { label: "二塁打", short: "二",   ab: true,  bases: 2, kind: "hit" },
  triple:    { label: "三塁打", short: "三",   ab: true,  bases: 3, kind: "hit" },
  homerun:   { label: "本塁打", short: "本",   ab: true,  bases: 4, kind: "hit" },
  walk:      { label: "四球",   short: "四",   ab: false, bases: 0, kind: "walk" },
  hbp:       { label: "死球",   short: "死",   ab: false, bases: 0, kind: "walk" },
  strikeout: { label: "三振",   short: "振",   ab: true,  bases: 0, kind: "out" },
  grounder:  { label: "ゴロ",   short: "ゴ",   ab: true,  bases: 0, kind: "out" },
  fly:       { label: "フライ", short: "飛",   ab: true,  bases: 0, kind: "out" },
  error:     { label: "失策",   short: "失",   ab: true,  bases: 0, kind: "out" },
  fc:        { label: "野選",   short: "野",   ab: true,  bases: 0, kind: "out" },
  sacBunt:   { label: "犠打",   short: "犠",   ab: false, bases: 0, kind: "out" },
  sacFly:    { label: "犠飛",   short: "犠飛", ab: false, bases: 0, kind: "out" },
};

// --- アプリの状態 ---
let data = loadData();      // 保存されているデータ
let currentGameId = null;   // いま選んでいる試合
let selectedResult = null;  // 選んでいる打席結果
let selectedRbi = 0;        // 選んでいる打点

// 画面の部品を取り出す（$ は「idで探す」の短縮形）
const $ = (id) => document.getElementById(id);

// =========================================================
// 保存と読み込み
// =========================================================
function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && saved.players && saved.games) return saved;
  } catch (e) {
    // 読めなかったときは下の「空っぽのデータ」を使う
  }
  return { players: [], games: [] };
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    alert("保存できませんでした（プライベートモードなどでは保存できないことがあります）");
  }
}

// =========================================================
// 小さな便利関数
// =========================================================

// 重ならないIDを作る
function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// 画面の部品（タグ）を作る
function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text; // textContentは安全に文字を入れられる
  return e;
}

// 今日の日付を「2026-11-08」の形で返す
function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// 率を「.333」の形にする（野球の表示方法）
function formatRate(value) {
  if (value === null) return "-";
  const s = value.toFixed(3);
  return s.startsWith("0") ? s.slice(1) : s;
}

function findPlayer(id) {
  return data.players.find((p) => p.id === id);
}

function findGame(id) {
  return data.games.find((g) => g.id === id);
}

function playerLabel(p) {
  return p.number ? `#${p.number} ${p.name}` : p.name;
}

function gameLabel(g) {
  return `${g.date.replaceAll("-", "/")} vs ${g.opponent || "（相手未入力）"}`;
}

// 新しい日付の試合が上に来るように並べる
function sortedGames() {
  return [...data.games].sort((a, b) => b.date.localeCompare(a.date));
}

// =========================================================
// 成績の計算
// =========================================================
// atBats（打席の記録の配列）から、各種の数字を計算する
function calcStats(atBats) {
  const s = { pa: 0, ab: 0, h: 0, d: 0, t: 0, hr: 0, tb: 0, rbi: 0, bb: 0, hbp: 0, so: 0, sf: 0 };

  for (const atBat of atBats) {
    const r = RESULTS[atBat.result];
    s.pa += 1;                         // 打席
    if (r.ab) s.ab += 1;               // 打数
    if (r.bases > 0) s.h += 1;         // 安打
    if (r.bases === 2) s.d += 1;       // 二塁打
    if (r.bases === 3) s.t += 1;       // 三塁打
    if (r.bases === 4) s.hr += 1;      // 本塁打
    s.tb += r.bases;                   // 塁打数
    s.rbi += atBat.rbi;                // 打点
    if (atBat.result === "walk") s.bb += 1;
    if (atBat.result === "hbp") s.hbp += 1;
    if (atBat.result === "strikeout") s.so += 1;
    if (atBat.result === "sacFly") s.sf += 1;
  }

  // 割り算の「割る数」が0のときは計算できないので null にする
  const obpBase = s.ab + s.bb + s.hbp + s.sf;
  s.avg = s.ab > 0 ? s.h / s.ab : null;                               // 打率
  s.obp = obpBase > 0 ? (s.h + s.bb + s.hbp) / obpBase : null;        // 出塁率
  s.slg = s.ab > 0 ? s.tb / s.ab : null;                              // 長打率
  s.ops = s.obp !== null && s.slg !== null ? s.obp + s.slg : null;    // OPS
  return s;
}

// =========================================================
// タブの切りかえ
// =========================================================
function switchTab(name) {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === name);
  });
  document.querySelectorAll(".tab-page").forEach((page) => {
    page.hidden = page.id !== `tab-${name}`;
  });
  window.scrollTo(0, 0);
}

// =========================================================
// タブ1：試合入力
// =========================================================

// 試合を選ぶプルダウンを作る
function renderGameSelect() {
  const select = $("game-select");
  select.innerHTML = "";
  const games = sortedGames();

  if (games.length === 0) {
    select.append(new Option("試合がありません", ""));
    select.disabled = true;
    currentGameId = null;
    return;
  }

  select.disabled = false;
  for (const g of games) select.append(new Option(gameLabel(g), g.id));

  // 選んでいた試合がなければ、いちばん新しい試合を選ぶ
  if (!findGame(currentGameId)) currentGameId = games[0].id;
  select.value = currentGameId;
}

// 打者のプルダウン・結果ボタン・打点ボタンを作る
function renderInput() {
  const hasPlayers = data.players.length > 0;
  $("no-player-message").hidden = hasPlayers;
  $("input-card").hidden = !(hasPlayers && currentGameId);

  // 打者のプルダウン（選んでいた打者はそのまま残す）
  const batter = $("batter-select");
  const before = batter.value;
  batter.innerHTML = "";
  data.players.forEach((p, i) => {
    batter.append(new Option(`${i + 1}番 ${playerLabel(p)}`, p.id));
  });
  if (findPlayer(before)) batter.value = before;

  // 結果ボタン（種類ごとに1段ずつ並べる）
  const area = $("result-buttons");
  area.innerHTML = "";
  for (const kind of ["hit", "walk", "out"]) {
    const group = el("div", "result-group");
    for (const [key, r] of Object.entries(RESULTS)) {
      if (r.kind !== kind) continue;
      const button = el("button", `result-button kind-${kind}`, r.label);
      if (key === selectedResult) button.classList.add("selected");
      button.addEventListener("click", () => {
        selectedResult = key;
        renderInput();
      });
      group.append(button);
    }
    area.append(group);
  }

  // 打点ボタン（0〜4）
  const rbiArea = $("rbi-buttons");
  rbiArea.innerHTML = "";
  for (let n = 0; n <= 4; n++) {
    const button = el("button", "choice", String(n));
    if (n === selectedRbi) button.classList.add("selected");
    button.addEventListener("click", () => {
      selectedRbi = n;
      renderInput();
    });
    rbiArea.append(button);
  }
}

// この試合のスコアシート（表）を作る
function renderSheet() {
  const game = findGame(currentGameId);
  $("sheet-card").hidden = !game;
  if (!game) return;

  const table = $("sheet-table");
  table.innerHTML = "";

  // 記録がある選手だけを、打順どおりに並べる
  const rows = data.players.filter((p) => game.atBats.some((a) => a.playerId === p.id));
  $("sheet-empty").hidden = rows.length > 0;
  if (rows.length === 0) return;

  const head = el("tr");
  for (const title of ["選手", "打席結果", "打数", "安打", "打点"]) head.append(el("th", "", title));
  table.append(head);

  for (const p of rows) {
    const atBats = game.atBats.filter((a) => a.playerId === p.id);
    const s = calcStats(atBats);
    const tr = el("tr");
    tr.append(el("td", "", playerLabel(p)));

    // 打席結果をボタン（チップ）で並べる。タップで取り消し
    const chips = el("td", "chips");
    for (const atBat of atBats) {
      const r = RESULTS[atBat.result];
      const text = atBat.rbi > 0 ? `${r.short}${atBat.rbi}` : r.short; // 打点があれば数字を付ける
      const chip = el("button", `chip kind-${r.kind}`, text);
      chip.addEventListener("click", () => deleteAtBat(game, atBat, p));
      chips.append(chip);
    }
    tr.append(chips);

    tr.append(el("td", "", s.ab), el("td", "", s.h), el("td", "", s.rbi));
    table.append(tr);
  }
}

// 「記録する」ボタン
function recordAtBat() {
  const game = findGame(currentGameId);
  const playerId = $("batter-select").value;
  if (!game || !playerId) return;
  if (!selectedResult) {
    alert("結果を選んでください");
    return;
  }

  game.atBats.push({ id: newId(), playerId: playerId, result: selectedResult, rbi: selectedRbi });
  saveData();

  // 次の打者に進める（最後の打者の次は1番に戻る）
  const index = data.players.findIndex((p) => p.id === playerId);
  const next = data.players[(index + 1) % data.players.length];
  $("batter-select").value = next.id;

  // 選んでいた結果・打点をリセット
  selectedResult = null;
  selectedRbi = 0;
  renderAll();
}

// スコアシートのチップをタップしたとき
function deleteAtBat(game, atBat, player) {
  const label = RESULTS[atBat.result].label;
  if (!confirm(`${player.name}の「${label}」を取り消しますか？`)) return;
  game.atBats = game.atBats.filter((a) => a.id !== atBat.id);
  saveData();
  renderAll();
}

// 新しい試合の入力欄を開く／閉じる
function openNewGameForm() {
  $("game-date").value = today();
  $("game-opponent").value = "";
  $("new-game-form").hidden = false;
}

function closeNewGameForm() {
  $("new-game-form").hidden = true;
}

// 「作成」ボタン
function createGame() {
  const date = $("game-date").value || today();
  const opponent = $("game-opponent").value.trim();
  const game = { id: newId(), date: date, opponent: opponent, atBats: [] };
  data.games.push(game);
  saveData();
  currentGameId = game.id;
  if (data.players.length > 0) $("batter-select").value = data.players[0].id; // 1番打者から
  closeNewGameForm();
  renderAll();
}

// 「この試合を削除」ボタン
function deleteGame() {
  const game = findGame(currentGameId);
  if (!game) return;
  if (!confirm(`「${gameLabel(game)}」を削除しますか？\nこの試合の記録もすべて消えます。`)) return;
  data.games = data.games.filter((g) => g.id !== game.id);
  saveData();
  currentGameId = null;
  renderAll();
}

// =========================================================
// タブ2：成績
// =========================================================
function renderStats() {
  // 「どの試合を集計するか」のプルダウン
  const filter = $("stats-filter");
  const before = filter.value;
  filter.innerHTML = "";
  filter.append(new Option("全試合", "all"));
  for (const g of sortedGames()) filter.append(new Option(gameLabel(g), g.id));
  filter.value = findGame(before) ? before : "all";

  const games = filter.value === "all" ? data.games : [findGame(filter.value)];
  const allAtBats = games.flatMap((g) => g.atBats);

  const table = $("stats-table");
  table.innerHTML = "";
  // 打率はよく見るので、選手名のすぐ右に置く
  const columns = ["選手", "打率", "試合", "打席", "打数", "安打", "二塁打", "三塁打", "本塁打",
    "打点", "四球", "死球", "三振", "出塁率", "長打率", "OPS"];
  const head = el("tr");
  for (const title of columns) head.append(el("th", "", title));
  table.append(head);

  // 1行分の数字を表に追加する
  const addRow = (name, gameCount, s, className) => {
    const tr = el("tr", className);
    const values = [name, formatRate(s.avg), gameCount, s.pa, s.ab, s.h, s.d, s.t, s.hr, s.rbi, s.bb, s.hbp, s.so,
      formatRate(s.obp), formatRate(s.slg), formatRate(s.ops)];
    for (const v of values) tr.append(el("td", "", v));
    table.append(tr);
  };

  for (const p of data.players) {
    const atBats = allAtBats.filter((a) => a.playerId === p.id);
    const gameCount = games.filter((g) => g.atBats.some((a) => a.playerId === p.id)).length;
    addRow(playerLabel(p), gameCount, calcStats(atBats));
  }

  addRow("チーム合計", games.length, calcStats(allAtBats), "total");
}

// =========================================================
// タブ3：選手
// =========================================================
function renderPlayers() {
  const list = $("player-list");
  list.innerHTML = "";
  $("player-empty").hidden = data.players.length > 0;

  data.players.forEach((p, i) => {
    const li = el("li");
    const name = el("span", "player-name");
    name.append(el("span", "player-number", p.number ? `#${p.number}` : "-"), p.name);

    const up = el("button", "small secondary", "↑");
    up.disabled = i === 0;
    up.addEventListener("click", () => movePlayer(i, -1));

    const down = el("button", "small secondary", "↓");
    down.disabled = i === data.players.length - 1;
    down.addEventListener("click", () => movePlayer(i, 1));

    const del = el("button", "small danger", "削除");
    del.addEventListener("click", () => deletePlayer(p));

    li.append(el("span", "", `${i + 1}.`), name, up, down, del);
    list.append(li);
  });
}

// 「追加」ボタン
function addPlayer() {
  const name = $("player-name").value.trim();
  const number = $("player-number").value.trim();
  if (name === "") {
    alert("名前を入れてください");
    return;
  }
  data.players.push({ id: newId(), number: number, name: name });
  saveData();
  $("player-name").value = "";
  $("player-number").value = "";
  renderAll();
}

// 打順を1つ上げる（-1）／下げる（+1）
function movePlayer(index, step) {
  const target = index + step;
  // 2人の場所を入れかえる
  [data.players[index], data.players[target]] = [data.players[target], data.players[index]];
  saveData();
  renderAll();
}

// 「削除」ボタン
function deletePlayer(player) {
  if (!confirm(`${player.name}を削除しますか？\nこの選手の打席の記録もすべて消えます。`)) return;
  data.players = data.players.filter((p) => p.id !== player.id);
  for (const g of data.games) {
    g.atBats = g.atBats.filter((a) => a.playerId !== player.id);
  }
  saveData();
  renderAll();
}

// =========================================================
// 画面全体を作り直す
// =========================================================
function renderAll() {
  renderGameSelect();
  renderInput();
  renderSheet();
  renderStats();
  renderPlayers();
}

// =========================================================
// ボタンに動きを結びつける
// =========================================================
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => switchTab(tab.dataset.tab));
});

$("game-select").addEventListener("change", (e) => {
  currentGameId = e.target.value;
  renderAll();
});
$("new-game-button").addEventListener("click", openNewGameForm);
$("new-game-cancel").addEventListener("click", closeNewGameForm);
$("new-game-save").addEventListener("click", createGame);
$("record-button").addEventListener("click", recordAtBat);
$("delete-game-button").addEventListener("click", deleteGame);
$("stats-filter").addEventListener("change", renderStats);
$("add-player-button").addEventListener("click", addPlayer);

// 最初に一回、画面を作る
renderAll();
