// ===== チーム成績（メンバー向け・見るだけのページ）の動き =====
// 記録係の人が公開した data.json を読み込んで、表にして見せます。
// 計算や表の作り方は、入力用アプリと同じ ../score/common.js を使います。

const $ = (id) => document.getElementById(id);

let data = { players: [], games: [] };

// --- 並び順の種類 ---
// key:  calcStats で計算した数字のどれで並べるか（null なら選手の登録順）
const SORTS = [
  { label: "選手順", key: null },
  { label: "打率が高い順", key: "avg" },
  { label: "安打が多い順", key: "h" },
  { label: "本塁打が多い順", key: "hr" },
  { label: "打点が多い順", key: "rbi" },
  { label: "得点が多い順", key: "r" },
  { label: "盗塁が多い順", key: "sb" },
  { label: "出塁率が高い順", key: "obp" },
  { label: "OPSが高い順", key: "ops" },
];

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
// 表を作る
// =========================================================

// 試合結果
function renderGame() {
  const game = data.games.find((g) => g.id === $("game-select").value);
  if (!game) return;
  $("game-title").textContent = `${gameLabel(game)}（${seasonLabel(game.season)}）`;
  // 見るだけなので、目立たせる回なし・タップもなし
  renderSheetTable($("sheet-table"), game, data.players, null, null);
}

// 並び順に合わせて選手を並べかえる
function sortPlayers(games, sortIndex) {
  const key = SORTS[sortIndex].key;
  if (key === null) return data.players;

  const allAtBats = games.flatMap((g) => g.atBats);
  const valueOf = (p) => calcStats(allAtBats.filter((a) => a.playerId === p.id))[key];
  // 計算できない選手（打数0など）は一番下にする
  return [...data.players].sort((a, b) => (valueOf(b) ?? -1) - (valueOf(a) ?? -1));
}

// シーズン
function renderSeason() {
  const season = Number($("season-select").value);
  const games = data.games.filter((g) => g.season === season);
  $("season-info").textContent = `${seasonLabel(season)}（${season}年4月〜${season + 1}年3月）　${games.length}試合`;
  const players = sortPlayers(games, Number($("season-sort").value));
  renderStatsTable($("season-table"), games, players, true); // 打席がない選手は出さない
}

// 通算
function renderCareer() {
  const seasons = seasonsOf(data.games);
  const range = seasons.length > 0
    ? `${seasonLabel(seasons[seasons.length - 1])}〜${seasonLabel(seasons[0])}`
    : "";
  $("career-info").textContent = `全${data.games.length}試合　${range}`;
  const players = sortPlayers(data.games, Number($("career-sort").value));
  renderStatsTable($("career-table"), data.games, players, true);
}

// =========================================================
// プルダウンの準備
// =========================================================
function setupSelects() {
  // 試合（シーズンごとに分ける。一番新しい試合を選んでおく）
  appendGameOptions($("game-select"), data.games);
  const latest = sortGames(data.games)[0];
  if (latest) $("game-select").value = latest.id;

  // シーズン（新しい順）
  for (const s of seasonsOf(data.games)) $("season-select").append(new Option(seasonLabel(s), s));

  // 並び順
  for (const id of ["season-sort", "career-sort"]) {
    SORTS.forEach((sort, i) => $(id).append(new Option(sort.label, i)));
  }
}

// =========================================================
// data.json を読み込む
// =========================================================
async function loadPublishedData() {
  try {
    // cache: "no-store" … 古いファイルではなく、いつも最新のファイルを取りにいく
    const response = await fetch("data.json", { cache: "no-store" });
    if (!response.ok) throw new Error("data.json が見つかりません");
    const json = await response.json();
    const loaded = normalizeData(json.data ?? json);
    if (!loaded || loaded.games.length === 0) throw new Error("試合の記録がありません");
    data = loaded;

    // いつの記録か（書き出した日時）を表示する
    if (json.exportedAt) {
      const d = new Date(json.exportedAt);
      if (!isNaN(d)) $("updated").textContent = `最終更新：${d.toLocaleString("ja-JP")}`;
    }
  } catch (e) {
    $("load-error").hidden = false;
    return;
  }

  $("content").hidden = false;
  setupSelects();
  renderGame();
  renderSeason();
  renderCareer();
}

// =========================================================
// ボタンに動きを結びつける
// =========================================================
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => switchTab(tab.dataset.tab));
});
$("game-select").addEventListener("change", renderGame);
$("season-select").addEventListener("change", renderSeason);
$("season-sort").addEventListener("change", renderSeason);
$("career-sort").addEventListener("change", renderCareer);

loadPublishedData();
