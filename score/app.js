// ===== 打撃成績スコアシート（入力用）の動き =====
// データはメモ帳と同じく、ブラウザの「localStorage」に保存します。
// データの形や、成績の計算・表の作り方は common.js にまとめてあります。

const STORAGE_KEY = "softball-score";
const DEFAULT_SLOTS = 9; // 最初のオーダーの打順の数

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
let formGameId = null;        // 試合情報の入力欄で直している試合（新しく作るときは null）

// =========================================================
// 保存と読み込み
// =========================================================
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
// 小さな便利関数
// =========================================================
function findPlayer(id) {
  return data.players.find((p) => p.id === id);
}

function findGame(id) {
  return data.games.find((g) => g.id === id);
}

// 選手IDから表示用の名前を作る（削除された選手にも対応）
function playerName(id) {
  const p = findPlayer(id);
  return p ? playerLabel(p) : "（削除された選手）";
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
  const latest = sortGames(data.games)[0];
  let ids;
  if (latest && latest.lineup.length > 0) {
    ids = latest.lineup.map((entries) => (findPlayer(entries[0].playerId) ? entries[0].playerId : null));
  } else {
    ids = data.players.slice(0, DEFAULT_SLOTS).map((p) => p.id);
  }
  return ids.map((id) => [{ playerId: id, type: "start", inning: 1 }]);
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
  const game = findGame(id) || sortGames(data.games)[0] || null;
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

// 試合を選ぶプルダウンを作る（シーズンごとに分ける）
function renderGameSelect() {
  const select = $("game-select");
  select.innerHTML = "";

  if (data.games.length === 0) {
    select.append(new Option("試合がありません", ""));
    select.disabled = true;
    return;
  }
  select.disabled = false;
  appendGameOptions(select, data.games);
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

// この試合のスコアシート（表の作り方は common.js）
function renderSheet() {
  const game = findGame(currentGameId);
  $("sheet-card").hidden = !game || game.lineup.length === 0;
  if ($("sheet-card").hidden) return;
  $("sheet-season").textContent = seasonLabel(game.season);
  renderSheetTable($("sheet-table"), game, data.players, currentInning, (atBat) => openEdit(game, atBat));
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

// --- 試合情報の入力欄（新しい試合を作る／試合情報を変更する） ---

// シーズンのプルダウンを作る（日付の年度の前後と、いま選んでいる年度）
function fillSeasonOptions(date, selected) {
  const select = $("game-season");
  const base = fiscalYear(date);
  const seasons = new Set([base - 2, base - 1, base, base + 1, selected]);
  select.innerHTML = "";
  for (const s of [...seasons].sort((a, b) => b - a)) select.append(new Option(seasonLabel(s), s));
  select.value = selected;
}

function openGameForm(game) {
  formGameId = game ? game.id : null;
  const date = game ? game.date : today();
  $("game-form-title").textContent = game ? "試合情報を変更" : "新しい試合";
  $("game-form-save").textContent = game ? "保存" : "作成";
  $("game-date").value = date;
  $("game-opponent").value = game ? game.opponent : "";
  fillSeasonOptions(date, game ? game.season : fiscalYear(date));
  $("game-form").hidden = false;
  $("game-form").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function closeGameForm() {
  formGameId = null;
  $("game-form").hidden = true;
}

// 日付を変えたら、シーズンもその日付の年度に合わせる
function onGameDateChange() {
  const date = $("game-date").value;
  if (date) fillSeasonOptions(date, fiscalYear(date));
}

// 「作成」「保存」ボタン
function saveGameForm() {
  const date = $("game-date").value || today();
  const opponent = $("game-opponent").value.trim();
  const season = Number($("game-season").value);

  if (formGameId) {
    // 試合情報を変更
    const game = findGame(formGameId);
    if (game) Object.assign(game, { date, opponent, season });
    saveData();
    closeGameForm();
    renderAll();
    return;
  }

  // 新しい試合を作る
  const game = { id: newId(), date, season, opponent, lineup: defaultLineup(), atBats: [] };
  data.games.push(game);
  saveData();
  selectGame(game.id); // 1回・1番打者から始まる
  closeGameForm();
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
  // 「どの範囲を集計するか」のプルダウン：通算／シーズン／試合
  const filter = $("stats-filter");
  const before = filter.value;
  filter.innerHTML = "";
  filter.append(new Option("通算（全試合）", "all"));
  const seasonGroup = document.createElement("optgroup");
  seasonGroup.label = "シーズン";
  for (const s of seasonsOf(data.games)) seasonGroup.append(new Option(seasonLabel(s), `season:${s}`));
  filter.append(seasonGroup);
  appendGameOptions(filter, data.games);

  // 前に選んでいたものが残っていれば、それを選ぶ
  const values = [...filter.options].map((o) => o.value);
  filter.value = values.includes(before) ? before : "all";

  let games;
  if (filter.value === "all") {
    games = data.games;
  } else if (filter.value.startsWith("season:")) {
    const season = Number(filter.value.slice("season:".length));
    games = data.games.filter((g) => g.season === season);
  } else {
    games = [findGame(filter.value)];
  }
  renderStatsTable($("stats-table"), games, data.players, false);
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
// タブ：データ（バックアップ・公開）
// =========================================================
function renderDataSummary() {
  const atBatCount = data.games.reduce((sum, g) => sum + g.atBats.length, 0);
  $("data-summary").textContent =
    `選手 ${data.players.length}人 ／ 試合 ${data.games.length}件 ／ 打席 ${atBatCount}件`;
}

// データをファイルにして、共有メニュー（スマホ）かダウンロード（パソコン）で渡す
//   fileName: ファイルの名前
async function exportData(fileName, title) {
  // データを文字（JSON という形式）にして、ファイルを作る
  const content = JSON.stringify(
    { app: "softball-score", exportedAt: new Date().toISOString(), data: data }, null, 2);
  const file = new File([content], fileName, { type: "application/json" });

  // スマホなら「共有」メニューを出す（メール・LINE・ドライブなどに送れる）
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: title });
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
$("new-game-button").addEventListener("click", () => openGameForm(null));
$("edit-game-button").addEventListener("click", () => openGameForm(findGame(currentGameId)));
$("game-date").addEventListener("change", onGameDateChange);
$("game-form-cancel").addEventListener("click", closeGameForm);
$("game-form-save").addEventListener("click", saveGameForm);
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
$("export-button").addEventListener("click", () =>
  exportData(`softball-score-${today()}.json`, "打撃成績のバックアップ"));
$("publish-button").addEventListener("click", () =>
  exportData("data.json", "成績公開用ファイル"));
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
