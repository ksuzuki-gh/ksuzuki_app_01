// ===== 打撃成績スコアシートの動き =====
// データはメモ帳と同じく、ブラウザの「localStorage」に保存します。
//
// 保存するデータの形：
// {
//   players: [ { id, number, name } ],                          ← 選手
//   games:   [ { id, date, opponent, lineup, atBats } ]         ← 試合
// }
//
// lineup（オーダー）：打順ごとの「その打順に入った選手の移り変わり」
//   [
//     [ { playerId: "田中", type: "start", inning: 1 },          ← 1番：先発
//       { playerId: "山本", type: "sub",   inning: 3 } ],        ←       3回に代打
//     [ { playerId: "鈴木", type: "start", inning: 1 },          ← 2番：先発
//       { playerId: null,   type: "ejected", inning: 5 } ],      ←       5回に退場
//     ...
//   ]
//   それぞれの打順の「一番最後の人」が、いまその打順に入っている選手です。
//
// atBats（打席）の1つ分：
//   { id, playerId, slot（何番目の打順か。0が1番）, entry（その打順の何人目か。0が先発）,
//     inning（回）, result（結果）, rbi（打点）, run（得点したか）, sb（盗塁数） }

const STORAGE_KEY = "softball-score";
const MIN_INNINGS = 7;   // ソフトボールは7回までなので、表は最低7回分つくる
const MAX_INNING = 15;   // 延長は15回まで入力できる
const MAX_SLOTS = 15;    // 打順は最大15番まで
const DEFAULT_SLOTS = 9; // 最初のオーダーの打順の数
const MAX_RBI = 4;
const MAX_SB = 3;

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

// 画面の部品を取り出す（$ は「idで探す」の短縮形）
const $ = (id) => document.getElementById(id);

// --- アプリの状態 ---
let data = loadData();        // 保存されているデータ
let currentGameId = null;     // いま選んでいる試合
let currentInning = 1;        // いま入力している回
let currentSlot = null;       // いまの打者の打順（0が1番）
let selectedResult = null;    // 選んでいる打席結果
let selectedRbi = 0;          // 選んでいる打点
let editing = null;           // 直している打席 { game, atBat }
let subTarget = null;         // 交代させる打順 { game, slot }

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

// 整数を min〜max の範囲におさめる（数字でなければ def を使う）
function clampInt(value, min, max, def) {
  const n = Number(value);
  if (!Number.isInteger(n)) return def;
  return Math.min(max, Math.max(min, n));
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

// 選手IDから表示用の名前を作る（削除された選手にも対応）
function playerName(id) {
  const p = findPlayer(id);
  return p ? playerLabel(p) : "（削除された選手）";
}

function gameLabel(g) {
  return `${g.date.replaceAll("-", "/")} vs ${g.opponent || "（相手未入力）"}`;
}

// 新しい日付の試合が上に来るように並べる（同じ日付なら、後から作った試合が上）
function sortedGames() {
  return [...data.games].reverse().sort((a, b) => b.date.localeCompare(a.date));
}

// =========================================================
// オーダー（打順）の便利関数
// =========================================================

// その打順に、いま入っている選手のID（退場・未設定なら null）
function occupant(game, slot) {
  const entries = game.lineup[slot];
  return entries ? entries[entries.length - 1].playerId : null;
}

// その打順は打席に立てるか（選手が入っているか）
function isActive(game, slot) {
  const id = occupant(game, slot);
  return id !== null && findPlayer(id) !== undefined;
}

// from の次の、打席に立てる打順を探す（最後の次は1番に戻る。退場した打順は飛ばす）
function nextActiveSlot(game, from) {
  const n = game.lineup.length;
  for (let k = 1; k <= n; k++) {
    const slot = (((from + k) % n) + n) % n;
    if (isActive(game, slot)) return slot;
  }
  return null; // 打てる打順が1つもない
}

// その選手が、ほかの打順にいま入っているか
function activeElsewhere(game, playerId, exceptSlot) {
  return game.lineup.some((_, i) => i !== exceptSlot && occupant(game, i) === playerId);
}

// 打順の状態を短い文字にする（打者のプルダウン用）
function slotStatus(game, slot) {
  const entries = game.lineup[slot];
  const last = entries[entries.length - 1];
  if (last.type === "ejected") return "（退場）";
  if (last.playerId === null) return "（未設定）";
  return playerName(last.playerId);
}

// 新しい試合のオーダー。前の試合の先発を引き継ぐ（なければ選手一覧の順）
function defaultLineup() {
  const latest = sortedGames()[0];
  let ids;
  if (latest && latest.lineup.length > 0) {
    ids = latest.lineup.map((entries) => (findPlayer(entries[0].playerId) ? entries[0].playerId : null));
  } else {
    ids = data.players.slice(0, DEFAULT_SLOTS).map((p) => p.id);
  }
  return ids.map((id) => [{ playerId: id, type: "start", inning: 1 }]);
}

// =========================================================
// 保存と読み込み
// =========================================================

// データの形を整える。
// 古い形のデータや、バックアップファイルの中身を、このアプリで使える形にそろえる。
// 使えないデータなら null を返す。
function normalizeData(raw) {
  if (!raw || !Array.isArray(raw.players) || !Array.isArray(raw.games)) return null;

  const players = raw.players
    .filter((p) => p && p.id && typeof p.name === "string")
    .map((p) => ({ id: String(p.id), number: String(p.number ?? ""), name: p.name }));

  const games = raw.games.filter((g) => g && g.id).map((g) => normalizeGame(g, players));
  return { players, games };
}

// 打順1つ分の「選手の移り変わり」を整える
function normalizeSlot(raw) {
  const entries = (Array.isArray(raw) ? raw : [])
    .filter((e) => e && typeof e === "object")
    .map((e) => ({
      playerId: e.playerId == null || e.type === "ejected" ? null : String(e.playerId),
      type: ["start", "sub", "ejected"].includes(e.type) ? e.type : "sub",
      inning: clampInt(e.inning, 1, MAX_INNING, 1),
    }));
  if (entries.length === 0) entries.push({ playerId: null, type: "start", inning: 1 });
  entries[0].type = "start"; // 1人目は必ず先発
  return entries;
}

// 試合1つ分を整える
function normalizeGame(g, players) {
  const atBats = (Array.isArray(g.atBats) ? g.atBats : [])
    .filter((a) => a && Object.hasOwn(RESULTS, a.result) && a.playerId != null) // 知らない結果は捨てる
    .map((a) => ({
      id: String(a.id ?? newId()),
      playerId: String(a.playerId),
      slot: clampInt(a.slot, 0, MAX_SLOTS - 1, -1),
      entry: clampInt(a.entry, 0, 999, -1),
      inning: clampInt(a.inning, 1, MAX_INNING, 1), // 回がない古い記録は1回にする
      result: a.result,
      rbi: clampInt(a.rbi, 0, MAX_RBI, 0),
      run: a.run === true,
      sb: clampInt(a.sb, 0, MAX_SB, 0),
    }));

  let lineup;
  if (Array.isArray(g.lineup)) {
    lineup = g.lineup.slice(0, MAX_SLOTS).map(normalizeSlot);
  } else {
    // オーダーがない古いデータ：打席の記録がある選手を、選手一覧の順に並べてオーダーにする
    lineup = players
      .filter((p) => atBats.some((a) => a.playerId === p.id))
      .slice(0, MAX_SLOTS)
      .map((p) => [{ playerId: p.id, type: "start", inning: 1 }]);
  }

  // 打席の記録が、オーダーのどこに当たるかを確かめる
  const checked = [];
  for (const a of atBats) {
    const entry = lineup[a.slot] && lineup[a.slot][a.entry];
    if (entry && entry.playerId === a.playerId) {
      checked.push(a);
      continue;
    }
    // 合わなければ、その選手がいる場所を探す
    let found = false;
    lineup.forEach((entries, i) => {
      entries.forEach((e, j) => {
        if (!found && e.playerId === a.playerId) {
          a.slot = i;
          a.entry = j;
          found = true;
        }
      });
    });
    // どこにもいなければ、打順を1つ足してそこに入れる
    if (!found && lineup.length < MAX_SLOTS) {
      lineup.push([{ playerId: a.playerId, type: "start", inning: 1 }]);
      a.slot = lineup.length - 1;
      a.entry = 0;
      found = true;
    }
    if (found) checked.push(a);
  }

  return {
    id: String(g.id),
    date: typeof g.date === "string" && g.date ? g.date : today(),
    opponent: String(g.opponent ?? ""),
    lineup: lineup,
    atBats: checked,
  };
}

function loadData() {
  try {
    const saved = normalizeData(JSON.parse(localStorage.getItem(STORAGE_KEY)));
    if (saved) return saved;
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
// 成績の計算
// =========================================================
// atBats（打席の記録の配列）から、各種の数字を計算する
function calcStats(atBats) {
  const s = { pa: 0, ab: 0, h: 0, d: 0, t: 0, hr: 0, tb: 0, rbi: 0, r: 0, sb: 0,
    bb: 0, hbp: 0, so: 0, sf: 0 };

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
    if (atBat.run) s.r += 1;           // 得点
    s.sb += atBat.sb;                  // 盗塁
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
// タブ：試合入力
// =========================================================

// 試合を選ぶ。回と打者は「その試合の続き」から始める
function selectGame(id) {
  const game = findGame(id) || sortedGames()[0] || null;
  currentGameId = game ? game.id : null;
  if (!game || game.atBats.length === 0) {
    currentInning = 1;
    currentSlot = game ? nextActiveSlot(game, -1) : null;
    return;
  }
  const last = game.atBats[game.atBats.length - 1];
  currentInning = Math.max(...game.atBats.map((a) => a.inning));
  currentSlot = nextActiveSlot(game, last.slot);
}

// 試合を選ぶプルダウンを作る
function renderGameSelect() {
  const select = $("game-select");
  select.innerHTML = "";
  const games = sortedGames();

  if (games.length === 0) {
    select.append(new Option("試合がありません", ""));
    select.disabled = true;
    return;
  }
  select.disabled = false;
  for (const g of games) select.append(new Option(gameLabel(g), g.id));
  select.value = currentGameId;
}

// 回・打者・結果ボタン・打点ボタンを作る
function renderInput() {
  const game = findGame(currentGameId);
  const hasPlayers = data.players.length > 0;
  const canBat = game ? game.lineup.some((_, i) => isActive(game, i)) : false;
  $("no-player-message").hidden = hasPlayers;
  $("no-lineup-message").hidden = !(hasPlayers && game && !canBat);
  $("input-card").hidden = !(hasPlayers && game && canBat);
  if ($("input-card").hidden) return;

  // 回
  $("inning-label").textContent = `${currentInning}回`;
  $("inning-prev").disabled = currentInning <= 1;
  $("inning-next").disabled = currentInning >= MAX_INNING;

  // 打者のプルダウン（打順ごと。退場・未設定の打順は選べない）
  if (currentSlot === null || !isActive(game, currentSlot)) {
    currentSlot = nextActiveSlot(game, currentSlot ?? -1);
  }
  const batter = $("batter-select");
  batter.innerHTML = "";
  game.lineup.forEach((_, i) => {
    const option = new Option(`${i + 1}番 ${slotStatus(game, i)}`, i);
    option.disabled = !isActive(game, i);
    batter.append(option);
  });
  batter.value = currentSlot;

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
  for (let n = 0; n <= MAX_RBI; n++) {
    const button = el("button", "choice", String(n));
    if (n === selectedRbi) button.classList.add("selected");
    button.addEventListener("click", () => {
      selectedRbi = n;
      renderInput();
    });
    rbiArea.append(button);
  }
}

// 打席の記録を短い文字にする（例：「本2●」＝本塁打・2打点・得点）
function chipText(atBat) {
  let text = RESULTS[atBat.result].short;
  if (atBat.rbi > 0) text += atBat.rbi;
  if (atBat.run) text += "●";
  if (atBat.sb > 0) text += atBat.sb > 1 ? `盗${atBat.sb}` : "盗";
  return text;
}

// この試合のスコアシート（スコアブック形式の表）を作る
function renderSheet() {
  const game = findGame(currentGameId);
  $("sheet-card").hidden = !game || game.lineup.length === 0;
  if ($("sheet-card").hidden) return;

  const table = $("sheet-table");
  table.innerHTML = "";

  // 表の回の数：最低7回。延長や、いま入力中の回があればそこまで広げる
  const innings = Math.max(MIN_INNINGS, currentInning, ...game.atBats.map((a) => a.inning));
  const inningList = Array.from({ length: innings }, (_, i) => i + 1); // [1, 2, ..., innings]
  const inningClass = (n, base) => (n === currentInning ? `${base} current` : base);

  // 見出しの行
  const head = el("tr");
  head.append(el("th", "", "打順・選手"));
  for (const n of inningList) head.append(el("th", inningClass(n, ""), n));
  for (const title of ["打数", "安打", "打点", "得点", "盗塁"]) head.append(el("th", "", title));
  table.append(head);

  // 打順ごとに、その打順に入った選手を1行ずつ並べる
  game.lineup.forEach((entries, slot) => {
    entries.forEach((entry, j) => {
      // 退場の行：記録はないので、名前の欄だけ
      if (entry.type === "ejected") {
        const tr = el("tr", "ejected-row");
        const td = el("td", "", `× 退場（${entry.inning}回）`);
        td.colSpan = 1 + inningList.length + 5;
        tr.append(td);
        table.append(tr);
        return;
      }

      const tr = el("tr");
      if (j === 0) {
        tr.append(el("td", "", `${slot + 1} ${entry.playerId ? playerName(entry.playerId) : "（未設定）"}`));
      } else {
        tr.append(el("td", "sub-name", `代 ${playerName(entry.playerId)}`));
      }

      // 回ごとのマス。打席の記録をボタン（チップ）で入れる。タップで直せる
      const atBats = game.atBats.filter((a) => a.slot === slot && a.entry === j);
      for (const n of inningList) {
        const td = el("td", inningClass(n, "cell"));
        for (const atBat of atBats.filter((a) => a.inning === n)) {
          const chip = el("button", `chip kind-${RESULTS[atBat.result].kind}`, chipText(atBat));
          chip.addEventListener("click", () => openEdit(game, atBat));
          td.append(chip);
        }
        tr.append(td);
      }

      const s = calcStats(atBats);
      for (const v of [s.ab, s.h, s.rbi, s.r, s.sb]) tr.append(el("td", "", v));
      table.append(tr);
    });
  });

  // 一番下の行：各回のチームの得点と合計
  const total = el("tr", "total");
  total.append(el("td", "", "合計"));
  for (const n of inningList) {
    const runs = game.atBats.filter((a) => a.inning === n && a.run).length;
    total.append(el("td", inningClass(n, ""), runs));
  }
  const s = calcStats(game.atBats);
  for (const v of [s.ab, s.h, s.rbi, s.r, s.sb]) total.append(el("td", "", v));
  table.append(total);
}

// 「◀」「▶」ボタンで回を変える
function changeInning(step) {
  currentInning = clampInt(currentInning + step, 1, MAX_INNING, 1);
  renderAll();
}

// 「記録する」ボタン
function recordAtBat() {
  const game = findGame(currentGameId);
  if (!game || currentSlot === null || !isActive(game, currentSlot)) return;
  if (!selectedResult) {
    alert("結果を選んでください");
    return;
  }

  game.atBats.push({
    id: newId(),
    playerId: occupant(game, currentSlot),
    slot: currentSlot,
    entry: game.lineup[currentSlot].length - 1, // その打順の、いまの選手
    inning: currentInning,
    result: selectedResult,
    rbi: selectedRbi,
    run: selectedResult === "homerun", // 本塁打なら自動で得点
    sb: 0,
  });
  saveData();

  // 次の打順に進め、選んでいた結果・打点をリセット
  currentSlot = nextActiveSlot(game, currentSlot);
  selectedResult = null;
  selectedRbi = 0;
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
  const game = { id: newId(), date: date, opponent: opponent, lineup: defaultLineup(), atBats: [] };
  data.games.push(game);
  saveData();
  selectGame(game.id); // 1回・1番打者から始まる
  closeNewGameForm();
  renderAll();
  switchTab("order"); // まずオーダーを確認してもらう
}

// 「この試合を削除」ボタン
function deleteGame() {
  const game = findGame(currentGameId);
  if (!game) return;
  if (!confirm(`「${gameLabel(game)}」を削除しますか？\nこの試合の記録もすべて消えます。`)) return;
  data.games = data.games.filter((g) => g.id !== game.id);
  saveData();
  selectGame(null);
  renderAll();
}

// =========================================================
// タブ：オーダー（打順）
// =========================================================
function renderOrder() {
  const game = findGame(currentGameId);
  $("order-no-game").hidden = !!game;
  $("order-card").hidden = !game;
  if (!game) return;

  $("order-game").textContent = gameLabel(game);
  const area = $("order-area");
  area.innerHTML = "";

  game.lineup.forEach((entries, i) => {
    const box = el("div", "slot");

    // 打順の番号と、先発の選手を選ぶプルダウン
    const head = el("div", "slot-head");
    head.append(el("span", "slot-no", `${i + 1}番`));
    const select = el("select");
    select.append(new Option("（未設定）", ""));
    for (const p of data.players) select.append(new Option(playerLabel(p), p.id));
    const starter = entries[0].playerId;
    if (starter && !findPlayer(starter)) select.append(new Option("（削除された選手）", starter));
    select.value = starter ?? "";
    select.addEventListener("change", () => changeStarter(game, i, select.value || null));
    head.append(select);
    box.append(head);

    // 代打・退場の移り変わり
    if (entries.length > 1) {
      const history = el("ul", "slot-history");
      for (const e of entries.slice(1)) {
        const text = e.type === "ejected"
          ? `→ 退場（${e.inning}回）`
          : `→ 代打 ${playerName(e.playerId)}（${e.inning}回〜）`;
        history.append(el("li", "", text));
      }
      box.append(history);
    }

    // ボタン
    const actions = el("div", "slot-actions");
    const sub = el("button", "small", "代打・交代");
    sub.disabled = entries.length === 1 && starter === null; // 先発が決まっていないときは使わない
    sub.addEventListener("click", () => openSub(game, i));
    const eject = el("button", "small danger", "退場");
    eject.disabled = occupant(game, i) === null;
    eject.addEventListener("click", () => ejectPlayer(game, i));
    const undo = el("button", "small secondary", "取消");
    undo.disabled = entries.length <= 1;
    undo.addEventListener("click", () => undoChange(game, i));
    actions.append(sub, eject, undo);
    box.append(actions);

    area.append(box);
  });

  $("add-slot").disabled = game.lineup.length >= MAX_SLOTS;
  $("remove-slot").disabled = game.lineup.length === 0;
}

// 先発の選手を変えたとき
function changeStarter(game, slot, playerId) {
  if (playerId && activeElsewhere(game, playerId, slot)) {
    alert("その選手は、すでに別の打順に入っています");
    renderAll();
    return;
  }
  const records = game.atBats.filter((a) => a.slot === slot && a.entry === 0);
  if (records.length > 0) {
    if (!playerId) {
      alert("この選手の打席の記録があるので、未設定にはできません");
      renderAll();
      return;
    }
    const message = `${slot + 1}番の先発を変えると、すでに記録した${records.length}打席も、新しい選手の記録になります。よろしいですか？`;
    if (!confirm(message)) {
      renderAll();
      return;
    }
    records.forEach((a) => (a.playerId = playerId));
  }
  game.lineup[slot][0].playerId = playerId;
  saveData();
  renderAll();
}

// 「代打・交代」ボタン（オーダータブ・試合入力タブの両方から使う）
function openSub(game, slot) {
  subTarget = { game, slot };
  const now = occupant(game, slot);
  $("sub-title").textContent = `${slot + 1}番 ${now ? playerName(now) : "（空き）"} の代打・交代`;

  // 代わりに入れる選手：いまこの打順にいる選手と、ほかの打順に入っている選手は除く
  const select = $("sub-player");
  select.innerHTML = "";
  const candidates = data.players.filter((p) => p.id !== now && !activeElsewhere(game, p.id, slot));
  for (const p of candidates) select.append(new Option(playerLabel(p), p.id));
  if (candidates.length === 0) {
    select.append(new Option("入れられる選手がいません（選手タブで登録してください）", ""));
  }
  $("sub-save").disabled = candidates.length === 0;

  $("sub-inning").value = currentInning;
  $("sub-dialog").showModal();
}

function closeSub() {
  subTarget = null;
  $("sub-dialog").close();
}

// 「交代する」ボタン
function saveSub() {
  if (!subTarget || !$("sub-player").value) return;
  const { game, slot } = subTarget;
  game.lineup[slot].push({
    playerId: $("sub-player").value,
    type: "sub",
    inning: Number($("sub-inning").value),
  });
  saveData();
  closeSub();
  renderAll();
}

// 「退場」ボタン
function ejectPlayer(game, slot) {
  const name = playerName(occupant(game, slot));
  const message = `${slot + 1}番 ${name} を退場にしますか？（${currentInning}回）\n` +
    "この打順は、代わりの選手を入れるまで飛ばされます。";
  if (!confirm(message)) return;
  game.lineup[slot].push({ playerId: null, type: "ejected", inning: currentInning });
  saveData();
  renderAll();
}

// 「取消」ボタン：その打順の最後の変更（代打・退場）を元に戻す
function undoChange(game, slot) {
  const entries = game.lineup[slot];
  const lastIndex = entries.length - 1;
  if (lastIndex === 0) return;
  if (game.atBats.some((a) => a.slot === slot && a.entry === lastIndex)) {
    alert("この選手の打席の記録があるので取り消せません。\n先にスコアシートで、その打席を削除してください。");
    return;
  }
  const last = entries[lastIndex];
  const text = last.type === "ejected" ? "退場" : `代打 ${playerName(last.playerId)}`;
  if (!confirm(`${slot + 1}番の「${text}」を取り消しますか？`)) return;
  entries.pop();
  saveData();
  renderAll();
}

// 「＋ 打順を追加」ボタン
function addSlot() {
  const game = findGame(currentGameId);
  if (!game || game.lineup.length >= MAX_SLOTS) return;
  game.lineup.push([{ playerId: null, type: "start", inning: 1 }]);
  saveData();
  renderAll();
}

// 「－ 最後の打順を削除」ボタン
function removeSlot() {
  const game = findGame(currentGameId);
  if (!game || game.lineup.length === 0) return;
  const slot = game.lineup.length - 1;
  if (game.atBats.some((a) => a.slot === slot)) {
    alert(`${slot + 1}番には打席の記録があるので削除できません`);
    return;
  }
  game.lineup.pop();
  saveData();
  renderAll();
}

// =========================================================
// 打席の記録を直す画面
// =========================================================

// プルダウンの選択肢を作る（最初に1回だけ）
function setupDialogOptions() {
  for (let n = 1; n <= MAX_INNING; n++) {
    $("edit-inning").append(new Option(`${n}回`, n));
    $("sub-inning").append(new Option(`${n}回`, n));
  }
  for (const [key, r] of Object.entries(RESULTS)) $("edit-result").append(new Option(r.label, key));
  for (let n = 0; n <= MAX_RBI; n++) $("edit-rbi").append(new Option(n, n));
  for (let n = 0; n <= MAX_SB; n++) $("edit-sb").append(new Option(n, n));
}

// スコアシートの記録をタップしたとき
function openEdit(game, atBat) {
  editing = { game, atBat };
  $("edit-title").textContent = `${atBat.slot + 1}番 ${playerName(atBat.playerId)} の打席`;
  $("edit-inning").value = atBat.inning;
  $("edit-result").value = atBat.result;
  $("edit-rbi").value = atBat.rbi;
  $("edit-run").checked = atBat.run;
  $("edit-sb").value = atBat.sb;
  $("edit-dialog").showModal();
}

function closeEdit() {
  editing = null;
  $("edit-dialog").close();
}

// 「保存」ボタン
function saveEdit() {
  if (!editing) return;
  const atBat = editing.atBat;
  atBat.inning = Number($("edit-inning").value);
  atBat.result = $("edit-result").value;
  atBat.rbi = Number($("edit-rbi").value);
  atBat.run = $("edit-run").checked;
  atBat.sb = Number($("edit-sb").value);
  saveData();
  closeEdit();
  renderAll();
}

// 「削除」ボタン
function deleteEdit() {
  if (!editing) return;
  if (!confirm("この打席の記録を削除しますか？")) return;
  const { game, atBat } = editing;
  game.atBats = game.atBats.filter((a) => a.id !== atBat.id);
  saveData();
  closeEdit();
  renderAll();
}

// =========================================================
// タブ：成績
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
    "打点", "得点", "盗塁", "四球", "死球", "三振", "出塁率", "長打率", "OPS"];
  const head = el("tr");
  for (const title of columns) head.append(el("th", "", title));
  table.append(head);

  // 1行分の数字を表に追加する
  const addRow = (name, gameCount, s, className) => {
    const tr = el("tr", className);
    const values = [name, formatRate(s.avg), gameCount, s.pa, s.ab, s.h, s.d, s.t, s.hr,
      s.rbi, s.r, s.sb, s.bb, s.hbp, s.so, formatRate(s.obp), formatRate(s.slg), formatRate(s.ops)];
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
// タブ：選手
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

// 並び順を1つ上げる（-1）／下げる（+1）
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
    // オーダーからも外す（その打順は空きになる）
    for (const entries of g.lineup) {
      for (const e of entries) {
        if (e.playerId === player.id) e.playerId = null;
      }
    }
  }
  saveData();
  renderAll();
}

// =========================================================
// タブ：データ（バックアップ）
// =========================================================
function renderDataSummary() {
  const atBatCount = data.games.reduce((sum, g) => sum + g.atBats.length, 0);
  $("data-summary").textContent =
    `選手 ${data.players.length}人 ／ 試合 ${data.games.length}件 ／ 打席 ${atBatCount}件`;
}

// 「ファイルに書き出す」ボタン
async function exportData() {
  // データを文字（JSON という形式）にして、ファイルを作る
  const content = JSON.stringify(
    { app: "softball-score", exportedAt: new Date().toISOString(), data: data }, null, 2);
  const fileName = `softball-score-${today()}.json`;
  const file = new File([content], fileName, { type: "application/json" });

  // スマホなら「共有」メニューを出す（メール・LINE・ドライブなどに送れる）
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "打撃成績のバックアップ" });
      return;
    } catch (e) {
      if (e.name === "AbortError") return; // 共有メニューを閉じたときは何もしない
      // それ以外の失敗は、下のダウンロードに切りかえる
    }
  }

  // 共有ができないとき（パソコンなど）は、ファイルとしてダウンロードする
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ファイルが選ばれたとき
function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let imported = null;
    try {
      const json = JSON.parse(reader.result);
      imported = normalizeData(json.data ?? json);
    } catch (e) {
      // 読めないファイルなら imported は null のまま
    }
    if (!imported) {
      alert("このファイルは読み込めませんでした。\nこのアプリで書き出したファイルを選んでください。");
      return;
    }

    const message = `選手 ${imported.players.length}人・試合 ${imported.games.length}件 の記録を読み込みます。\n` +
      "今このスマホにある記録は、すべて置き換わります。よろしいですか？";
    if (!confirm(message)) return;

    data = imported;
    saveData();
    selectGame(null);
    renderAll();
    alert("読み込みました");
  };
  reader.readAsText(file);
}

// =========================================================
// 画面全体を作り直す
// =========================================================
function renderAll() {
  if (!findGame(currentGameId)) selectGame(null);
  renderGameSelect();
  renderInput();
  renderSheet();
  renderOrder();
  renderStats();
  renderPlayers();
  renderDataSummary();
}

// =========================================================
// ボタンに動きを結びつける
// =========================================================
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => switchTab(tab.dataset.tab));
});

// 試合入力
$("game-select").addEventListener("change", (e) => {
  selectGame(e.target.value);
  renderAll();
});
$("new-game-button").addEventListener("click", openNewGameForm);
$("new-game-cancel").addEventListener("click", closeNewGameForm);
$("new-game-save").addEventListener("click", createGame);
$("inning-prev").addEventListener("click", () => changeInning(-1));
$("inning-next").addEventListener("click", () => changeInning(1));
$("batter-select").addEventListener("change", (e) => {
  currentSlot = Number(e.target.value);
});
$("pinch-button").addEventListener("click", () => {
  const game = findGame(currentGameId);
  if (game && currentSlot !== null) openSub(game, currentSlot);
});
$("record-button").addEventListener("click", recordAtBat);
$("delete-game-button").addEventListener("click", deleteGame);

// オーダー
$("add-slot").addEventListener("click", addSlot);
$("remove-slot").addEventListener("click", removeSlot);
$("go-input").addEventListener("click", () => switchTab("game"));

// 代打・交代の画面
$("sub-save").addEventListener("click", saveSub);
$("sub-cancel").addEventListener("click", closeSub);

// 打席を直す画面
$("edit-save").addEventListener("click", saveEdit);
$("edit-cancel").addEventListener("click", closeEdit);
$("edit-delete").addEventListener("click", deleteEdit);

// 成績・選手
$("stats-filter").addEventListener("change", renderStats);
$("add-player-button").addEventListener("click", addPlayer);

// データ
$("export-button").addEventListener("click", exportData);
$("import-button").addEventListener("click", () => $("import-file").click());
$("import-file").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) importData(file);
  e.target.value = ""; // 同じファイルをもう一度選べるように空にしておく
});

// 最初に一回、画面を作る
setupDialogOptions();
selectGame(null);
renderAll();
