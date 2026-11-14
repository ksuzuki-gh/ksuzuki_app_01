// ===== 共通の部品 =====
// 入力用のアプリ（score/）と、メンバー向けの閲覧ページ（results/）の両方で使う部分です。
// 同じ計算や表を2か所に書かないように、ここにまとめています。
//
// 保存するデータの形：
// {
//   players: [ { id, number, name } ],                              ← 選手
//   games:   [ { id, date, season, opponent, lineup, atBats } ]    ← 試合
//   lastLineup: [ 選手ID, ... ]   ← 新しい試合の最初のオーダー（このスマホにまだ試合がないときに使う）
// }
//
// season（シーズン）：年度の数字。2026 なら「2026年度（2026年4月〜2027年3月）」
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
//
// history（過去の成績。Excelから取り込んだもの。打席ごとの記録はなく、合計の数字だけ）：
// {
//   seasonTotals: [ { season, name, stats } ],                  ← シーズンの合計（試合ごとの記録がない年度）
//   games:        [ { id, season, date, opponent, lines: [ { name, stats } ] } ]  ← 試合ごとの合計
// }
// stats：{ g 試合, pa 打席, ab 打数, r 得点, s1 単打, d 二塁打, t 三塁打, hr 本塁打,
//          rbi 打点, sb 盗塁, sac 犠打飛, bbhbp 四死球, so 三振 }
// 過去の成績は、選手の「名前」でアプリの選手とつなげます（同じ名前の選手の成績として合計）。

const MIN_INNINGS = 7;   // ソフトボールは7回までなので、表は最低7回分つくる
const MAX_INNING = 15;   // 延長は15回まで入力できる
const MAX_SLOTS = 15;    // 打順は最大15番まで
const MAX_RBI = 4;
const MAX_SB = 3;

// --- 打席結果の種類 ---
// ab:    打数に数えるか（四球・死球・犠打・犠飛は数えない）
// bases: ヒットなら何塁打か（0はヒットではない）
// kind:  色分け（hit=ヒット、walk=四死球、out=アウトなど）
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

// 日付から年度を出す（4月〜翌3月。2027年3月の試合は 2026年度）
function fiscalYear(date) {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  return month >= 4 ? year : year - 1;
}

function seasonLabel(season) {
  return `${season}年度`;
}

function playerLabel(p) {
  return p.number ? `#${p.number} ${p.name}` : p.name;
}

function gameLabel(g) {
  const date = g.date ? g.date.replaceAll("-", "/") : "日付不明";
  return `${date} vs ${g.opponent || "（相手未入力）"}`;
}

// 新しい日付の試合が上に来るように並べる（同じ日付なら、後から作った試合が上）
function sortGames(games) {
  return [...games].reverse().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

// 試合に出てくるシーズンの一覧（新しい順）
function seasonsOf(games) {
  return [...new Set(games.map((g) => g.season))].sort((a, b) => b - a);
}

// 今の記録と過去の成績の、すべてのシーズン（新しい順）
function allSeasons(data) {
  const list = [...data.games, ...data.history.games, ...data.history.seasonTotals];
  return seasonsOf(list);
}

// 試合のプルダウンを、シーズンごとのグループに分けて作る
function appendGameOptions(select, games) {
  for (const season of seasonsOf(games)) {
    const group = document.createElement("optgroup");
    group.label = seasonLabel(season);
    for (const g of sortGames(games.filter((x) => x.season === season))) {
      group.append(new Option(gameLabel(g), g.id));
    }
    select.append(group);
  }
}

// =========================================================
// データの形を整える
// =========================================================
// 古い形のデータや、バックアップファイルの中身を、このアプリで使える形にそろえる。
// 使えないデータなら null を返す。
function normalizeData(raw) {
  if (!raw || !Array.isArray(raw.players) || !Array.isArray(raw.games)) return null;

  const players = raw.players
    .filter((p) => p && p.id && typeof p.name === "string")
    .map((p) => ({ id: String(p.id), number: String(p.number ?? ""), name: p.name }));

  const games = raw.games.filter((g) => g && g.id).map((g) => normalizeGame(g, players));
  const lastLineup = Array.isArray(raw.lastLineup)
    ? raw.lastLineup.slice(0, MAX_SLOTS).map((id) => (id == null ? null : String(id)))
    : null;
  return { players, games, history: normalizeHistory(raw.history), lastLineup };
}

// チームに公開されている成績（data.json）を読み込む。読めなければ null
//   戻り値: { data, exportedAt }
async function fetchPublishedData() {
  // 以前は results フォルダに置いていたので、そちらも探す
  for (const url of ["data.json", "../results/data.json"]) {
    try {
      // cache: "no-store" … 古いファイルではなく、いつも最新のファイルを取りにいく
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) continue;
      const json = await response.json();
      const data = normalizeData(json.data ?? json);
      if (data) return { data: data, exportedAt: json.exportedAt || null };
    } catch (e) {
      // 次の場所を試す
    }
  }
  return null;
}

// 過去の成績を整える（なければ空っぽ）
function normalizeHistory(raw) {
  const h = raw && typeof raw === "object" ? raw : {};
  const validName = (x) => x && typeof x.name === "string" && x.name.trim() !== "";
  const validSeason = (x) => clampInt(x && x.season, 1900, 2999, null) !== null;

  const seasonTotals = (Array.isArray(h.seasonTotals) ? h.seasonTotals : [])
    .filter((t) => validName(t) && validSeason(t))
    .map((t) => ({ season: Number(t.season), name: t.name.trim(), stats: normalizeHistoryStats(t.stats) }));

  const games = (Array.isArray(h.games) ? h.games : [])
    .filter((g) => g && validSeason(g) && Array.isArray(g.lines))
    .map((g) => ({
      id: String(g.id ?? newId()),
      season: Number(g.season),
      date: typeof g.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(g.date) ? g.date : null,
      opponent: String(g.opponent ?? ""),
      lines: g.lines.filter(validName).map((l) => ({ name: l.name.trim(), stats: normalizeHistoryStats(l.stats) })),
    }));

  return { seasonTotals, games };
}

function normalizeHistoryStats(raw) {
  const x = raw && typeof raw === "object" ? raw : {};
  const n = (key) => clampInt(x[key], 0, 99999, 0);
  return { g: n("g"), pa: n("pa"), ab: n("ab"), r: n("r"), s1: n("s1"), d: n("d"), t: n("t"), hr: n("hr"),
    rbi: n("rbi"), sb: n("sb"), sac: n("sac"), bbhbp: n("bbhbp"), so: n("so") };
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
  const date = typeof g.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(g.date) ? g.date : today();

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
    date: date,
    season: clampInt(g.season, 1900, 2999, fiscalYear(date)), // シーズンがない古い記録は日付から決める
    opponent: String(g.opponent ?? ""),
    lineup: lineup,
    atBats: checked,
  };
}

// =========================================================
// 成績の計算
// =========================================================
// 成績の「合計の数字」の入れ物（0から足していく）
//   obpNum / obpDen：出塁率の「割られる数」と「割る数」
function emptyTotals() {
  return { pa: 0, ab: 0, h: 0, d: 0, t: 0, hr: 0, tb: 0, rbi: 0, r: 0, sb: 0, bbhbp: 0, so: 0,
    obpNum: 0, obpDen: 0 };
}

// 合計 a に、合計 b を足す
function addTotals(a, b) {
  for (const key of Object.keys(a)) a[key] += b[key];
  return a;
}

// 合計の数字から、打率などの「率」を計算して付ける
function withRates(s) {
  // 割り算の「割る数」が0のときは計算できないので null にする
  s.avg = s.ab > 0 ? s.h / s.ab : null;                               // 打率
  s.obp = s.obpDen > 0 ? s.obpNum / s.obpDen : null;                  // 出塁率
  s.slg = s.ab > 0 ? s.tb / s.ab : null;                              // 長打率
  s.ops = s.obp !== null && s.slg !== null ? s.obp + s.slg : null;    // OPS
  return s;
}

// atBats（打席の記録の配列）から、各種の数字を計算する
function calcStats(atBats) {
  const s = emptyTotals();
  for (const atBat of atBats) {
    const r = RESULTS[atBat.result];
    const isWalk = atBat.result === "walk" || atBat.result === "hbp";
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
    if (isWalk) s.bbhbp += 1;          // 四死球
    if (atBat.result === "strikeout") s.so += 1;
    // 出塁率：（安打＋四死球）÷（打数＋四死球＋犠飛）
    if (r.bases > 0 || isWalk) s.obpNum += 1;
    if (r.ab || isWalk || atBat.result === "sacFly") s.obpDen += 1;
  }
  return withRates(s);
}

// 過去の成績（Excelから取り込んだ合計）を、同じ形の合計にする
// 出塁率は、Excelの記録と同じく「犠打飛」をすべて割る数に入れて計算する
function historyTotals(x) {
  const h = x.s1 + x.d + x.t + x.hr;
  return {
    pa: x.pa, ab: x.ab, h: h, d: x.d, t: x.t, hr: x.hr, tb: x.s1 + 2 * x.d + 3 * x.t + 4 * x.hr,
    rbi: x.rbi, r: x.r, sb: x.sb, bbhbp: x.bbhbp, so: x.so,
    obpNum: h + x.bbhbp, obpDen: x.ab + x.bbhbp + x.sac,
  };
}

// 集計する範囲（scope）の、選手ごとの成績を集める
//   scope: { type: "all" }（通算） / { type: "season", season } / { type: "game", id }
//   戻り値: { rows: [ { name, games, totals } ], team: { games, totals } }
function collectStats(data, scope) {
  const inScope = (season) => scope.type === "all" || (scope.type === "season" && scope.season === season);
  const isGame = scope.type === "game";
  const liveGames = data.games.filter((g) => (isGame ? g.id === scope.id : inScope(g.season)));
  const pastGames = data.history.games.filter((g) => (isGame ? g.id === scope.id : inScope(g.season)));
  const pastTotals = isGame ? [] : data.history.seasonTotals.filter((t) => inScope(t.season));

  // 選手ごとの入れ物。登録している選手を先に、登録順で並べる
  const rowMap = new Map();
  const rowOf = (key, name) => {
    if (!rowMap.has(key)) rowMap.set(key, { name: name, games: 0, totals: emptyTotals() });
    return rowMap.get(key);
  };
  for (const p of data.players) rowOf(`p:${p.id}`, playerLabel(p));

  // 過去の成績の名前 → アプリの選手（同じ名前がなければ、名前だけの行にする）
  const rowOfName = (name) => {
    const p = data.players.find((x) => x.name === name);
    return p ? rowOf(`p:${p.id}`, playerLabel(p)) : rowOf(`n:${name}`, name);
  };

  // 今の記録（打席ごと）
  for (const g of liveGames) {
    for (const p of data.players) {
      const atBats = g.atBats.filter((a) => a.playerId === p.id);
      if (atBats.length === 0) continue;
      const row = rowOf(`p:${p.id}`);
      row.games += 1;
      addTotals(row.totals, calcStats(atBats));
    }
  }
  // 過去の試合ごとの合計
  for (const g of pastGames) {
    for (const line of g.lines) {
      const row = rowOfName(line.name);
      row.games += 1;
      addTotals(row.totals, historyTotals(line.stats));
    }
  }
  // 過去のシーズン合計
  for (const t of pastTotals) {
    const row = rowOfName(t.name);
    row.games += t.stats.g;
    addTotals(row.totals, historyTotals(t.stats));
  }

  // チーム合計。シーズン合計しかない年度の試合数は、一番多く出た選手の試合数とする
  const team = { games: liveGames.length + pastGames.length, totals: emptyTotals() };
  for (const season of seasonsOf(pastTotals)) {
    team.games += Math.max(...pastTotals.filter((t) => t.season === season).map((t) => t.stats.g));
  }
  const rows = [...rowMap.values()];
  for (const row of rows) addTotals(team.totals, row.totals);

  for (const row of rows) withRates(row.totals);
  withRates(team.totals);
  return { rows, team };
}

// 打席の記録を短い文字にする（例：「本2●」＝本塁打・2打点・得点）
function chipText(atBat) {
  let text = RESULTS[atBat.result].short;
  if (atBat.rbi > 0) text += atBat.rbi;
  if (atBat.run) text += "●";
  if (atBat.sb > 0) text += atBat.sb > 1 ? `盗${atBat.sb}` : "盗";
  return text;
}

// =========================================================
// 表を作る
// =========================================================

// スコアシート（スコアブック形式の表）を table に作る
//   players:       選手の一覧
//   currentInning: 目立たせる回（なければ null）
//   onChipClick:   記録をタップしたときの動き（なければタップできない）
function renderSheetTable(table, game, players, currentInning, onChipClick) {
  table.innerHTML = "";
  const nameOf = (id) => {
    const p = players.find((x) => x.id === id);
    return p ? playerLabel(p) : "（削除された選手）";
  };

  // 表の回の数：最低7回。延長や、いま入力中の回があればそこまで広げる
  const innings = Math.max(MIN_INNINGS, currentInning || 1, ...game.atBats.map((a) => a.inning));
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
        tr.append(el("td", "", `${slot + 1} ${entry.playerId ? nameOf(entry.playerId) : "（未設定）"}`));
      } else {
        tr.append(el("td", "sub-name", `代 ${nameOf(entry.playerId)}`));
      }

      // 回ごとのマス。打席の記録をチップで入れる
      const atBats = game.atBats.filter((a) => a.slot === slot && a.entry === j);
      for (const n of inningList) {
        const td = el("td", inningClass(n, "cell"));
        for (const atBat of atBats.filter((a) => a.inning === n)) {
          const className = `chip kind-${RESULTS[atBat.result].kind}`;
          if (onChipClick) {
            const chip = el("button", className, chipText(atBat));
            chip.addEventListener("click", () => onChipClick(atBat));
            td.append(chip);
          } else {
            td.append(el("span", className, chipText(atBat)));
          }
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

// 打撃成績の表を table に作る
//   collected: collectStats の戻り値
//   rows:      表に出す行（並べかえたものを渡せる）。{ separator: "文字" } の行は、区切りの行になる
//   hideEmpty: true なら、打席がない選手は表に出さない
function renderStatsTable(table, collected, rows, hideEmpty) {
  table.innerHTML = "";

  // 打率はよく見るので、選手名のすぐ右に置く
  const columns = ["選手", "打率", "試合", "打席", "打数", "安打", "二塁打", "三塁打", "本塁打",
    "打点", "得点", "盗塁", "四死球", "三振", "出塁率", "長打率", "OPS"];
  const head = el("tr");
  for (const title of columns) head.append(el("th", "", title));
  table.append(head);

  // 1行分の数字を表に追加する
  const addRow = (name, games, s, className) => {
    const tr = el("tr", className);
    const values = [name, formatRate(s.avg), games, s.pa, s.ab, s.h, s.d, s.t, s.hr,
      s.rbi, s.r, s.sb, s.bbhbp, s.so, formatRate(s.obp), formatRate(s.slg), formatRate(s.ops)];
    for (const v of values) tr.append(el("td", "", v));
    table.append(tr);
  };

  for (const row of rows) {
    if (row.separator) {
      // 区切りの行（例：「参考：規定打席 10 未満」）
      const tr = el("tr", "separator-row");
      const td = el("td", "", row.separator);
      td.colSpan = columns.length;
      tr.append(td);
      table.append(tr);
      continue;
    }
    if (hideEmpty && row.totals.pa === 0) continue;
    addRow(row.name, row.games, row.totals);
  }
  addRow("チーム合計", collected.team.games, collected.team.totals, "total");
}

// 過去の試合（選手ごとの合計しかない試合）の表を table に作る
function renderHistoryGameTable(table, game, players) {
  table.innerHTML = "";
  const columns = ["選手", "打数", "安打", "二塁打", "三塁打", "本塁打", "打点", "得点", "盗塁", "四死球", "三振"];
  const head = el("tr");
  for (const title of columns) head.append(el("th", "", title));
  table.append(head);

  const addRow = (name, s, className) => {
    const tr = el("tr", className);
    for (const v of [name, s.ab, s.h, s.d, s.t, s.hr, s.rbi, s.r, s.sb, s.bbhbp, s.so]) tr.append(el("td", "", v));
    table.append(tr);
  };

  const team = emptyTotals();
  for (const line of game.lines) {
    const p = players.find((x) => x.name === line.name);
    const totals = historyTotals(line.stats);
    addTotals(team, totals);
    addRow(p ? playerLabel(p) : line.name, totals);
  }
  addRow("合計", team, "total");
}
