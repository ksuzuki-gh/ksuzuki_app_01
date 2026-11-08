// ===== 共通の部品 =====
// 入力用のアプリ（score/）と、メンバー向けの閲覧ページ（results/）の両方で使う部分です。
// 同じ計算や表を2か所に書かないように、ここにまとめています。
//
// 保存するデータの形：
// {
//   players: [ { id, number, name } ],                              ← 選手
//   games:   [ { id, date, season, opponent, lineup, atBats } ]    ← 試合
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
  return `${g.date.replaceAll("-", "/")} vs ${g.opponent || "（相手未入力）"}`;
}

// 新しい日付の試合が上に来るように並べる（同じ日付なら、後から作った試合が上）
function sortGames(games) {
  return [...games].reverse().sort((a, b) => b.date.localeCompare(a.date));
}

// 試合に出てくるシーズンの一覧（新しい順）
function seasonsOf(games) {
  return [...new Set(games.map((g) => g.season))].sort((a, b) => b - a);
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
//   games:     集計する試合
//   hideEmpty: true なら、打席がない選手は表に出さない
function renderStatsTable(table, games, players, hideEmpty) {
  table.innerHTML = "";
  const allAtBats = games.flatMap((g) => g.atBats);

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

  for (const p of players) {
    const atBats = allAtBats.filter((a) => a.playerId === p.id);
    if (hideEmpty && atBats.length === 0) continue;
    const gameCount = games.filter((g) => g.atBats.some((a) => a.playerId === p.id)).length;
    addRow(playerLabel(p), gameCount, calcStats(atBats));
  }

  addRow("チーム合計", games.length, calcStats(allAtBats), "total");
}
