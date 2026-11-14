// ===== 成績を見る（チームに公開されている成績）の動き =====
// 記録係が公開した data.json を読み込んで、表にして見せます。
// 計算や表の作り方は common.js を使います。
//
// 「記録する」側（app.js）と名前がぶつからないように、全体を Viewer という1つの箱に入れています。
// 外から使うのは Viewer.show(published) だけです。

const Viewer = (() => {
  const byId = (id) => document.getElementById(id);

  let data = normalizeData({ players: [], games: [] });

  // 規定打席：通算成績を並べかえるとき、この打席数以上の選手を上にまとめる
  const QUALIFYING_PA = 20;

  // --- 並び順の種類 ---
  // key:  calcStats などで計算した数字のどれで並べるか（null なら選手の登録順）
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

  // 試合結果のプルダウンに出す試合：今の記録の試合 ＋ 過去の試合（選手ごとの合計だけ）
  const allGames = () => [...data.games, ...data.history.games];

  // 試合結果
  function renderGame() {
    const id = byId("v-game-select").value;
    const live = data.games.find((g) => g.id === id);
    const past = data.history.games.find((g) => g.id === id);
    const game = live || past;
    if (!game) return;
    byId("v-game-title").textContent = `${gameLabel(game)}（${seasonLabel(game.season)}）`;
    byId("v-sheet-legend").hidden = !live;
    byId("v-history-note").hidden = !past;
    if (live) {
      // 見るだけなので、目立たせる回なし・タップもなし
      renderSheetTable(byId("v-sheet-table"), live, data.players, null, null);
    } else {
      renderHistoryGameTable(byId("v-sheet-table"), past, data.players);
    }
  }

  // 並び順に合わせて行を並べかえる
  function sortRows(rows, sortIndex) {
    const key = SORTS[sortIndex].key;
    if (key === null) return rows;
    // 計算できない選手（打数0など）は一番下にする
    return [...rows].sort((a, b) => (b.totals[key] ?? -1) - (a.totals[key] ?? -1));
  }

  // 規定打席以上の選手を上、未満の選手を下に分けて、それぞれを並べかえる（「選手順」のときは分けない）
  function sortRowsQualified(rows, sortIndex) {
    if (SORTS[sortIndex].key === null) return rows;
    const played = rows.filter((row) => row.totals.pa > 0);
    const qualified = played.filter((row) => row.totals.pa >= QUALIFYING_PA);
    const others = played.filter((row) => row.totals.pa < QUALIFYING_PA);
    if (others.length === 0) return sortRows(qualified, sortIndex);
    return [
      ...sortRows(qualified, sortIndex),
      { separator: `（参考：規定打席 ${QUALIFYING_PA} 未満）` },
      ...sortRows(others, sortIndex),
    ];
  }

  // シーズン
  function renderSeason() {
    const season = Number(byId("v-season-select").value);
    const collected = collectStats(data, { type: "season", season: season });
    byId("v-season-info").textContent =
      `${seasonLabel(season)}（${season}年4月〜${season + 1}年3月）　${collected.team.games}試合`;
    const rows = sortRows(collected.rows, Number(byId("v-season-sort").value));
    renderStatsTable(byId("v-season-table"), collected, rows, true); // 打席がない選手は出さない
  }

  // 通算
  function renderCareer() {
    const seasons = allSeasons(data);
    const collected = collectStats(data, { type: "all" });
    const range = seasons.length > 0
      ? `${seasonLabel(seasons[seasons.length - 1])}〜${seasonLabel(seasons[0])}`
      : "";
    byId("v-career-info").textContent = `全${collected.team.games}試合　${range}`;
    const rows = sortRowsQualified(collected.rows, Number(byId("v-career-sort").value));
    renderStatsTable(byId("v-career-table"), collected, rows, true);
  }

  // プルダウンの準備
  function setupSelects() {
    // 試合（シーズンごとに分ける。一番新しい試合を選んでおく）
    byId("v-game-select").innerHTML = "";
    appendGameOptions(byId("v-game-select"), allGames());
    const latest = sortGames(allGames())[0];
    if (latest) byId("v-game-select").value = latest.id;

    // シーズン（新しい順）
    byId("v-season-select").innerHTML = "";
    for (const s of allSeasons(data)) byId("v-season-select").append(new Option(seasonLabel(s), s));

    // 並び順
    for (const id of ["v-season-sort", "v-career-sort"]) {
      byId(id).innerHTML = "";
      SORTS.forEach((sort, i) => byId(id).append(new Option(sort.label, i)));
    }
  }

  // 公開されている成績を表示する
  //   published: fetchPublishedData() の戻り値（読めなかったときは null）
  function show(published) {
    const hasData = published && (published.data.games.length > 0 ||
      published.data.history.games.length > 0 || published.data.history.seasonTotals.length > 0);

    byId("v-load-error").hidden = hasData;
    document.querySelectorAll(".v-needs-data").forEach((card) => (card.hidden = !hasData));
    if (!hasData) return;

    data = published.data;
    // いつの記録か（書き出した日時）を表示する
    const d = new Date(published.exportedAt);
    byId("v-updated").textContent = isNaN(d) ? "" : `最終更新：${d.toLocaleString("ja-JP")}`;

    setupSelects();
    renderGame();
    renderSeason();
    renderCareer();
  }

  // プルダウンを変えたときの動き
  byId("v-game-select").addEventListener("change", renderGame);
  byId("v-season-select").addEventListener("change", renderSeason);
  byId("v-season-sort").addEventListener("change", renderSeason);
  byId("v-career-sort").addEventListener("change", renderCareer);

  return { show };
})();
