// ===== えいたんご（英単語・熟語アプリ）の動き =====
// 単語・熟語のデータは words.js と idioms.js にあります。
// 学習の記録は、ブラウザの「localStorage（ローカルストレージ）」に、人ごとに保存します。
//
// 【覚え具合（レベル）のしくみ】
// 正解するたびにレベルが1つ上がり、次に出てくるまでの日数がのびていきます。
//   レベル1 → 1日後、レベル2 → 3日後、レベル3 → 7日後、レベル4 → 14日後、レベル5 → 30日後
// まちがえるとレベル0に戻り、次の日にまた出てきます。
// 「出てくる日」になった単語が「今日の復習」に出てきます（忘れかけた頃にもう一度、というしくみ）。

const STORAGE_KEY = "eitango";
const SESSION_SIZE = 10;                 // 1回の問題数
const INTERVALS = [1, 1, 3, 7, 14, 30];  // レベルごとの「次に出るまでの日数」
const MAX_LV = INTERVALS.length - 1;
const MASTER_LV = 3;                     // このレベル以上を「覚えた」とする
const LV_NAMES = ["にがて", "うろおぼえ", "もう少し", "覚えた", "しっかり", "完ぺき"];
const AVATARS = ["🐱", "🐰", "🐶", "🦊", "🐼", "🐻", "🐨", "🐧", "🦄", "🐹", "🐸", "🌸"];

// ===== データの準備 =====
// words.js / idioms.js の文字を読み取って、1語ずつの「カード」にする
function parseItems() {
  const items = [];
  const seen = new Set(); // 同じ単語が2回書かれていたら、最初の1つだけ使う

  let grade = 1;
  for (const line of WORDS_TEXT.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith("#")) { grade = Number(t.slice(1)); continue; }
    const [en, ja, emoji] = t.split("|");
    const id = "w:" + en; // 大文字・小文字は区別する（May＝5月 と may＝〜してもよい）
    if (seen.has(id)) continue;
    seen.add(id);
    items.push({ id, kind: "w", en, ja, grade, emoji: emoji || "" });
  }

  grade = 1;
  for (const line of IDIOMS_TEXT.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith("#")) { grade = Number(t.slice(1)); continue; }
    const [raw, ja, ex, exJa] = t.split("|");
    const en = raw.replace(/[\[\]]/g, "");
    const m = raw.match(/\[(.+?)\]/);
    const id = "i:" + en.toLowerCase();
    if (seen.has(id)) continue;
    seen.add(id);
    items.push({ id, kind: "i", en, raw, blank: m ? m[1] : "", ja, grade, ex: ex || "", exJa: exJa || "", emoji: "" });
  }
  return items;
}

const ITEMS = parseItems();
const PICTURE_ITEMS = ITEMS.filter((i) => i.emoji && i.kind === "w" && i.grade === 1); // 中1の絵文字のある単語（小学生モード用）
const BLANK_WORDS = [...new Set(ITEMS.filter((i) => i.blank).map((i) => i.blank))]; // 穴うめの選択肢

// ===== 保存まわり =====
function defaultStore() {
  return {
    users: [
      { id: "u1", name: "中1", mode: "chu", avatar: "🐱", rate: "normal" },
      { id: "u2", name: "小3", mode: "sho", avatar: "🐰", rate: "slow" },
    ],
    currentId: null,
    progress: {}, // 人ごと → 単語ごとの記録 { lv, ok, ng, due, last }
    days: {},     // 人ごと → 日ごとの解いた問題数
    prefs: {},    // 人ごと → 出題範囲（学年・種類）
    sound: true,  // 効果音
  };
}

function loadStore() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (data && Array.isArray(data.users)) return Object.assign(defaultStore(), data);
  } catch (e) {
    // 読めなかったときは最初の状態にする
  }
  return defaultStore();
}

function saveStore() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (e) {
    alert("保存できませんでした（プライベートモードなどでは保存できないことがあります）");
  }
}

let store = loadStore();

// ===== 小さな道具 =====
// 今日を「1970年1月1日から何日目か」の数で表す（日本時間など、その端末の日付で数える）
function today() {
  const d = new Date();
  return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
}

// 文字を画面に安全に出すための変換（< や & などをそのまま表示する）
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickOne(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function user() {
  return store.users.find((u) => u.id === store.currentId);
}

function isKid() {
  const u = user();
  return u && u.mode === "sho";
}

// 中学生モードと小学生モードで、ことばを使い分ける
function T(chu, sho) {
  return isKid() ? sho : chu;
}

function recs() {
  const id = store.currentId;
  if (!store.progress[id]) store.progress[id] = {};
  return store.progress[id];
}

function prefs() {
  const id = store.currentId;
  if (!store.prefs[id]) store.prefs[id] = { grade: "1", kind: "w" };
  return store.prefs[id];
}

function studyDays(uid) {
  if (!store.days[uid]) store.days[uid] = {};
  return store.days[uid];
}

// 何日続けて勉強しているか（きょうまだでも、きのうまで続いていれば数える）
function streak(uid) {
  const days = studyDays(uid);
  let d = today();
  if (!days[d]) d--;
  let n = 0;
  while (days[d]) { n++; d--; }
  return n;
}

// ===== 読み上げ（ブラウザの音声合成を使う） =====
let enVoice = null;
function findVoice() {
  if (!("speechSynthesis" in window)) return null;
  const voices = speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === "en-US" && /Samantha|Google US English|Aria|Jenny/.test(v.name)) ||
    voices.find((v) => v.lang === "en-US") ||
    voices.find((v) => v.lang.startsWith("en")) ||
    null
  );
}
if ("speechSynthesis" in window) {
  speechSynthesis.onvoiceschanged = () => { enVoice = findVoice(); };
}

function speak(text) {
  if (!("speechSynthesis" in window)) return;
  // 「～」「…」「A」「B」などの記号は読まない
  const clean = text.replace(/[～~…]/g, " ").replace(/\b[AB]\b/g, " ").replace(/\s+/g, " ").trim();
  if (!clean) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(clean);
  if (!enVoice) enVoice = findVoice();
  if (enVoice) u.voice = enVoice;
  u.lang = "en-US";
  u.rate = user() && user().rate === "slow" ? 0.7 : 0.95;
  speechSynthesis.speak(u);
}

// ===== 効果音（ピンポン・ブブー） =====
let audioCtx = null;
function beep(ok) {
  if (!store.sound) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const notes = ok ? [880, 1320] : [300, 220];
    notes.forEach((freq, i) => {
      const t = audioCtx.currentTime + i * 0.12;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = ok ? "sine" : "square";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(ok ? 0.2 : 0.06, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + 0.22);
    });
  } catch (e) {
    // 音が出せない端末では何もしない
  }
}

// ===== 出題範囲と出題の選び方 =====
function gradeMatch(item) {
  const g = prefs().grade;
  return g === "all" || item.grade === Number(g);
}

// 今の人・今の範囲で出せる単語
function basePool() {
  if (isKid()) return PICTURE_ITEMS;
  const p = prefs();
  return ITEMS.filter((i) => gradeMatch(i) && (p.kind === "all" || i.kind === p.kind));
}

// 遊び方ごとに出せる単語をしぼる
function poolForMode(mode) {
  if (isKid()) {
    if (mode === "spell") return PICTURE_ITEMS.filter((i) => /^[a-zA-Z]{2,7}$/.test(i.en));
    return PICTURE_ITEMS;
  }
  if (mode === "weak") return ITEMS; // にがては、学年・種類に関係なく全部から集める
  if (mode === "spell") return ITEMS.filter((i) => i.kind === "w" && gradeMatch(i));
  if (mode === "blank") return ITEMS.filter((i) => i.kind === "i" && i.blank && gradeMatch(i));
  if (mode === "order") {
    return ITEMS.filter((i) => {
      if (i.kind !== "i" || !i.ex || !gradeMatch(i)) return false;
      const n = i.ex.split(" ").length;
      return n >= 3 && n <= 9;
    });
  }
  return basePool();
}

// 出す単語を選ぶ：①復習の日が来たもの → ②まだ見たことがないもの → ③そのほか
function pickItems(pool, n, mode) {
  const r = recs();
  const t = today();
  if (mode === "weak") {
    const weak = pool.filter((i) => r[i.id] && r[i.id].ng > 0 && r[i.id].lv < MASTER_LV);
    return shuffle(weak.sort((a, b) => r[b.id].ng - r[a.id].ng).slice(0, n));
  }
  const due = shuffle(pool.filter((i) => r[i.id] && r[i.id].due <= t)).sort((a, b) => r[a.id].lv - r[b.id].lv);
  const fresh = pool.filter((i) => !r[i.id]); // 新しい単語は、データに書いた順（テーマごと）に出す
  const others = shuffle(pool.filter((i) => r[i.id] && r[i.id].due > t)).sort((a, b) => r[a.id].due - r[b.id].due);
  let picked = due.slice(0, n);
  if (picked.length < n) picked = picked.concat(fresh.slice(0, n - picked.length));
  if (picked.length < n) picked = picked.concat(others.slice(0, n - picked.length));
  return shuffle(picked);
}

// 今日の復習の数（復習の日が来た単語の数）
function dueCount() {
  const r = recs();
  const t = today();
  return basePool().filter((i) => r[i.id] && r[i.id].due <= t).length;
}

// 間違いの選択肢を3つ選ぶ（同じ学年のものを優先）
function distractors(item, n = 3) {
  const source = isKid() ? PICTURE_ITEMS : ITEMS.filter((x) => x.kind === item.kind);
  const cands = shuffle(source.filter((x) =>
    x.id !== item.id &&
    x.ja !== item.ja &&
    x.en.toLowerCase() !== item.en.toLowerCase() &&
    (!isKid() || x.emoji !== item.emoji)
  ));
  cands.sort((a, b) => (a.grade === item.grade ? 0 : 1) - (b.grade === item.grade ? 0 : 1));
  return cands.slice(0, n);
}

// ===== 遊び方（モード）の一覧 =====
const MODES = {
  review: { icon: "📅", chu: "今日の復習", sho: "きょうの れんしゅう" },
  card:   { icon: "🃏", chu: "カードで覚える", sho: "カードで おぼえる" },
  en2ja:  { icon: "🔤", chu: "英語 → 意味", sho: "えいごを よんで えらぶ" },
  ja2en:  { icon: "🗾", chu: "意味 → 英語", sho: "えを みて えらぶ", shoIcon: "🖼️" },
  listen: { icon: "🎧", chu: "聞いて選ぶ", sho: "きいて えらぶ" },
  spell:  { icon: "⌨️", chu: "スペルを書く", sho: "もじを ならべる", shoIcon: "🔠" },
  blank:  { icon: "🧩", chu: "熟語の穴うめ" },
  order:  { icon: "🔀", chu: "例文ならべかえ" },
  weak:   { icon: "💪", chu: "にがてを練習", sho: "にがてを れんしゅう" },
};
const CHU_MODES = ["card", "en2ja", "ja2en", "listen", "spell", "blank", "order", "weak"];
const SHO_MODES = ["card", "ja2en", "listen", "en2ja", "spell", "weak"];

function modeLabel(mode) {
  const m = MODES[mode];
  return isKid() ? m.sho : m.chu;
}
function modeIcon(mode) {
  const m = MODES[mode];
  return isKid() && m.shoIcon ? m.shoIcon : m.icon;
}

// 「今日の復習」「にがて」では、問題の形をまぜる
function typeFor(mode, item) {
  if (mode !== "review" && mode !== "weak") return mode;
  if (item.kind === "i") return pickOne(item.blank ? ["en2ja", "ja2en", "blank"] : ["en2ja", "ja2en"]);
  return pickOne(isKid() ? ["ja2en", "listen", "en2ja"] : ["en2ja", "ja2en", "listen"]);
}

// ===== 画面の状態 =====
const $app = document.getElementById("app");
const $nav = document.getElementById("bottom-nav");
const $userChip = document.getElementById("user-chip");

let screen = "users";   // users / home / quiz / result / records / list / settings
let session = null;     // 今やっている問題のまとまり
let autoNextTimer = null;
let listFilter = { grade: "all", kind: "all", q: "" }; // 単語の一覧のしぼりこみ

// ===== 問題を始める・進める =====
function startSession(mode) {
  const pool = poolForMode(mode);
  const items = pickItems(pool, SESSION_SIZE, mode);
  if (!items.length) {
    alert(mode === "weak"
      ? T("にがてな単語はまだありません。ほかの練習をしてみましょう！", "にがてな ことばは まだ ないよ。ほかの れんしゅうを してみよう！")
      : T("出せる問題がありません。範囲を変えてみてください。", "もんだいが ないよ。"));
    return;
  }
  session = {
    mode,
    queue: items.map((item) => ({ item, type: typeFor(mode, item), retry: false })),
    index: 0,
    results: [],
    answered: null,
  };
  screen = "quiz";
  render();
}

function cur() {
  return session.queue[session.index];
}

// 1問の結果を記録する
function recordResult(item, ok) {
  const r = recs();
  const t = today();
  const rec = r[item.id] || { lv: 0, ok: 0, ng: 0, due: t };
  if (ok) {
    rec.ok++;
    rec.lv = Math.min(rec.lv + 1, MAX_LV);
    rec.due = t + INTERVALS[rec.lv];
  } else {
    rec.ng++;
    rec.lv = 0;
    rec.due = t + 1;
  }
  rec.last = t;
  r[item.id] = rec;
  const days = studyDays(store.currentId);
  days[t] = (days[t] || 0) + 1;
  saveStore();
}

// 答えたとき（正解 / 不正解）
function answer(correct, extra = {}) {
  if (session.answered) return;
  const q = cur();
  session.answered = Object.assign({ correct }, extra);
  if (!q.retry) {
    session.results.push({ item: q.item, correct });
    recordResult(q.item, correct);
    // まちがえた問題は、最後にもう一度出す
    if (!correct) session.queue.push({ item: q.item, type: q.type, retry: true });
  }
  beep(correct);
  speak(q.item.en);
  render();
  // 正解で例文がないときは、少し待って自動で次へ
  if (correct && !q.item.ex) autoNextTimer = setTimeout(next, 1300);
}

function next() {
  clearTimeout(autoNextTimer);
  if (!session) return;
  session.index++;
  session.answered = null;
  if (session.index >= session.queue.length) screen = "result";
  render();
}

// ===== 画面を作る =====
function render() {
  const u = user();
  document.body.classList.toggle("kid", !!isKid());

  // 上の「だれが使っているか」ボタン
  if (u && screen !== "users") {
    $userChip.hidden = false;
    $userChip.innerHTML = `<span class="avatar-sm">${esc(u.avatar)}</span>${esc(u.name)}`;
  } else {
    $userChip.hidden = true;
  }

  // 下のメニュー（問題を解いている間はかくす）
  $nav.hidden = !u || screen === "users" || screen === "quiz";
  $nav.querySelectorAll("button").forEach((b) => {
    const active = b.dataset.go === screen || (screen === "list" && b.dataset.go === "records");
    b.classList.toggle("active", active);
  });
  const navLabels = { home: T("ホーム", "ホーム"), records: T("記録", "きろく"), settings: T("設定", "せってい") };
  $nav.querySelectorAll("button").forEach((b) => {
    b.querySelector(".nav-label").textContent = navLabels[b.dataset.go];
  });

  const views = { users: renderUsers, home: renderHome, quiz: renderQuiz, result: renderResult, records: renderRecords, list: renderList, settings: renderSettings };
  $app.innerHTML = views[screen]();
  afterRender();
}

// 画面を作ったあとにすること（読み上げ・入力欄にカーソル）
function afterRender() {
  if (screen === "quiz" && session && !session.answered) {
    const q = cur();
    if ((q.type === "listen" || q.type === "en2ja") && !q.spoken) {
      q.spoken = true;
      speak(q.item.en);
    }
    const input = document.getElementById("spell-input");
    if (input) input.focus();
  }
}

// --- だれが勉強する？ ---
function renderUsers() {
  const cards = store.users.map((u) => {
    const days = studyDays(u.id);
    const st = streak(u.id);
    return `
      <button class="user-card" data-action="pick-user" data-id="${u.id}">
        <span class="avatar">${esc(u.avatar)}</span>
        <span class="user-name">${esc(u.name)}</span>
        <span class="user-sub">${u.mode === "sho" ? "しょうがくせい モード" : "中学生モード"}</span>
        <span class="user-stat">🔥 ${st}にち れんぞく ・ きょう ${days[today()] || 0}もん</span>
      </button>`;
  }).join("");
  return `
    <h2 class="center">だれが べんきょうする？</h2>
    <div class="user-list">${cards}</div>
    <p class="note center">なまえや モードは、えらんだあと「せってい」で かえられます。</p>`;
}

// --- ホーム ---
function renderHome() {
  const u = user();
  const st = streak(u.id);
  const todayCount = studyDays(u.id)[today()] || 0;
  const due = dueCount();
  const r = recs();
  const pool = basePool();
  const freshLeft = pool.filter((i) => !r[i.id]).length;

  let range = "";
  if (!isKid()) {
    const p = prefs();
    const chip = (key, val, label) =>
      `<button class="chip ${p[key] === val ? "on" : ""}" data-action="pref" data-key="${key}" data-val="${val}">${label}</button>`;
    range = `
      <div class="range">
        <div class="range-row"><span class="range-label">学年</span>
          ${chip("grade", "1", "中1")}${chip("grade", "2", "中2")}${chip("grade", "3", "中3")}${chip("grade", "all", "ぜんぶ")}
        </div>
        <div class="range-row"><span class="range-label">種類</span>
          ${chip("kind", "w", "単語")}${chip("kind", "i", "熟語")}${chip("kind", "all", "両方")}
        </div>
      </div>`;
  }

  const sub = due > 0
    ? T(`復習 ${due}語`, `ふくしゅう ${due}こ`) + (freshLeft ? T(" ＋ 新しい単語", " ＋ あたらしい ことば") : "")
    : freshLeft ? T("新しい単語を覚えよう", "あたらしい ことばを おぼえよう") : T("全部の単語を学習ずみ！", "ぜんぶ やったよ！");

  const modes = (isKid() ? SHO_MODES : CHU_MODES).map((m) =>
    `<button class="mode-btn" data-action="start" data-mode="${m}"><span class="mode-icon">${modeIcon(m)}</span>${modeLabel(m)}</button>`
  ).join("");

  return `
    <div class="hello">
      <span class="avatar">${esc(u.avatar)}</span>
      <div>
        <div class="hello-name">${esc(u.name)}${T("さん", "ちゃん")}、${T("がんばろう！", "がんばろうね！")}</div>
        <div class="hello-stat">🔥 ${st}${T("日連続", "にち れんぞく")} ・ ${T("きょう", "きょう")} ${todayCount}${T("問", "もん")}</div>
      </div>
    </div>
    ${range}
    <button class="big-btn" data-action="start" data-mode="review">
      <span class="mode-icon">📅</span>${modeLabel("review")}
      <small>${sub}</small>
    </button>
    <div class="mode-grid">${modes}</div>`;
}

// --- 問題の画面 ---
function renderQuiz() {
  const q = cur();
  const done = session.index;
  const total = session.queue.length;
  const top = `
    <div class="quiz-top">
      <button class="icon-btn" data-action="quit" aria-label="やめる">✕</button>
      <div class="bar"><div style="width:${Math.round((done / total) * 100)}%"></div></div>
      <span class="count">${done + 1}/${total}</span>
    </div>
    ${q.retry ? `<div class="retry-tag">${T("🔁 もう一回", "🔁 もういっかい")}</div>` : ""}`;

  const body = {
    card: quizCard, en2ja: quizChoice, ja2en: quizChoice, listen: quizChoice,
    blank: quizChoice, spell: isKid() ? quizTiles : quizSpell, order: quizOrder,
  }[q.type](q);

  return top + body + (session.answered ? feedbackHtml(q) : "");
}

function speakBtn(text, cls = "") {
  return `<button class="speak-btn ${cls}" data-action="speak" data-text="${esc(text)}" aria-label="読み上げ">🔊</button>`;
}

// 4つから選ぶ問題（英→意味、意味→英、聞いて選ぶ、熟語の穴うめ）
function quizChoice(q) {
  const item = q.item;
  const kid = isKid();

  // 選択肢は最初に1回だけ作って覚えておく
  if (!q.choices) {
    if (q.type === "blank") {
      const others = shuffle(BLANK_WORDS.filter((w) => w.toLowerCase() !== item.blank.toLowerCase())).slice(0, 3);
      q.choices = shuffle([item.blank, ...others]);
    } else {
      q.choices = shuffle([item, ...distractors(item)]);
    }
  }

  let prompt = "";
  let showJa; // 選択肢に意味を出すか、英語を出すか
  if (q.type === "en2ja") {
    prompt = `<div class="prompt"><div class="prompt-en">${esc(item.en)}</div>${speakBtn(item.en)}</div>
      <p class="ask">${T("意味はどれ？", "どれの ことかな？")}</p>`;
    showJa = true;
  } else if (q.type === "ja2en") {
    prompt = `<div class="prompt">${kid ? `<div class="prompt-emoji">${item.emoji}</div>` : ""}<div class="prompt-ja">${esc(item.ja)}</div></div>
      <p class="ask">${T("英語はどれ？", "えいごで なんて いうかな？")}</p>`;
    showJa = false;
  } else if (q.type === "listen") {
    prompt = `<div class="prompt">${speakBtn(item.en, "speak-big")}</div>
      <p class="ask">${T("聞こえた単語はどれ？", "きこえた ことばは どれ？")}</p>`;
    showJa = kid; // 小学生は絵で選ぶ
  } else {
    // 熟語の穴うめ
    const shown = esc(item.raw).replace(/\[.+?\]/, '<span class="blank">＿＿＿</span>');
    prompt = `<div class="prompt"><div class="prompt-en">${shown}</div><div class="prompt-sub">${esc(item.ja)}</div></div>
      <p class="ask">空らんに入る語は？</p>`;
  }

  const a = session.answered;
  const buttons = q.choices.map((c, i) => {
    const isRight = q.type === "blank" ? c === item.blank : c.id === item.id;
    let cls = "";
    if (a) {
      if (isRight) cls = "correct";
      else if (a.choice === i) cls = "wrong";
    }
    let label;
    if (q.type === "blank") label = esc(c);
    else if (showJa) label = kid ? `<span class="choice-emoji">${c.emoji}</span>${esc(c.ja)}` : esc(c.ja);
    else label = esc(c.en);
    return `<button class="choice ${cls} ${kid && showJa ? "pic" : ""}" data-action="choose" data-i="${i}" ${a ? "disabled" : ""}>${label}</button>`;
  }).join("");

  return `${prompt}<div class="choices ${kid && showJa ? "grid2" : ""}">${buttons}</div>`;
}

// スペルを書く（中学生：キーボードで入力）
function quizSpell(q) {
  const item = q.item;
  const a = session.answered;
  const hint = q.hint
    ? `<p class="hint">ヒント：<b>${esc(item.en[0])}</b> から始まる ${item.en.replace(/[^a-zA-Z]/g, "").length}文字</p>`
    : "";
  return `
    <div class="prompt"><div class="prompt-ja">${esc(item.ja)}</div></div>
    <p class="ask">英語で書こう</p>
    <form class="spell-form" data-form="spell">
      <input id="spell-input" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"
        value="${a ? esc(a.typed || "") : ""}" ${a ? "disabled" : ""} placeholder="ここに入力">
      ${a ? "" : `<button type="submit" class="primary">答える</button>`}
    </form>
    ${hint}
    ${a ? "" : `<div class="row-btns">
      ${q.hint ? "" : `<button class="sub-btn" data-action="hint">💡 ヒント</button>`}
      <button class="sub-btn" data-action="giveup">わからない</button>
    </div>`}`;
}

// 文字をならべる（小学生：文字のタイルをタップ）
function quizTiles(q) {
  const item = q.item;
  const a = session.answered;
  if (!q.tiles) {
    let letters = item.en.split("");
    let tiles = shuffle(letters);
    // ならべかえたのに答えと同じになったら、もう一度まぜる
    for (let k = 0; k < 5 && tiles.join("") === item.en && letters.length > 1; k++) tiles = shuffle(letters);
    q.tiles = tiles;
    q.typed = [];
  }
  const slots = item.en.split("").map((_, i) => {
    const ti = q.typed[i];
    return `<span class="slot ${ti !== undefined ? "filled" : ""}">${ti !== undefined ? esc(q.tiles[ti]) : ""}</span>`;
  }).join("");
  const tiles = q.tiles.map((ch, i) =>
    `<button class="tile" data-action="tile" data-i="${i}" ${q.typed.includes(i) || a ? "disabled" : ""}>${esc(ch)}</button>`
  ).join("");
  return `
    <div class="prompt"><div class="prompt-emoji">${item.emoji}</div><div class="prompt-ja">${esc(item.ja)}</div>${speakBtn(item.en)}</div>
    <p class="ask">もじを ならべて えいごに しよう</p>
    <div class="slots">${slots}</div>
    <div class="tiles">${tiles}</div>
    ${a ? "" : `<div class="row-btns"><button class="sub-btn" data-action="untile">⌫ ひとつ けす</button></div>`}`;
}

// 例文ならべかえ（熟語の例文の単語をならべる）
function quizOrder(q) {
  const item = q.item;
  const a = session.answered;
  if (!q.tokens) {
    const words = item.ex.split(" ");
    let tokens = shuffle(words);
    for (let k = 0; k < 5 && tokens.join(" ") === item.ex; k++) tokens = shuffle(words);
    q.tokens = tokens;
    q.placed = [];
  }
  const placed = q.placed.map((ti, n) =>
    `<button class="token placed" data-action="unplace" data-n="${n}" ${a ? "disabled" : ""}>${esc(q.tokens[ti])}</button>`
  ).join("");
  const tokens = q.tokens.map((w, i) =>
    `<button class="token" data-action="place" data-i="${i}" ${q.placed.includes(i) || a ? "disabled" : ""}>${esc(w)}</button>`
  ).join("");
  return `
    <div class="prompt"><div class="prompt-ja">${esc(item.exJa)}</div><div class="prompt-sub">熟語：${esc(item.en)}（${esc(item.ja)}）</div></div>
    <p class="ask">単語をタップして、英文を完成させよう</p>
    <div class="answer-line">${placed || '<span class="placeholder">ここに並びます</span>'}</div>
    <div class="tokens">${tokens}</div>`;
}

// カードで覚える
function quizCard(q) {
  const item = q.item;
  const kid = isKid();
  const front = `
    ${kid ? `<div class="card-emoji">${item.emoji}</div>` : ""}
    <div class="card-en">${esc(item.en)}</div>`;
  const back = q.flipped ? `
    <div class="card-ja">${esc(item.ja)}</div>
    ${item.ex ? `<div class="card-ex">${esc(item.ex)}<br><small>${esc(item.exJa)}</small></div>` : ""}` : "";
  return `
    <div class="flashcard ${q.flipped ? "flipped" : ""}" data-action="flip">
      ${front}
      ${back || `<div class="card-tap">${T("タップして意味を見る", "タップして いみを みる")}</div>`}
    </div>
    <div class="row-btns center">${speakBtn(item.en)}</div>
    ${q.flipped ? `
      <div class="rate-btns">
        <button class="rate ng" data-action="rate" data-ok="0">😅 ${T("まだ", "まだ")}</button>
        <button class="rate ok" data-action="rate" data-ok="1">😊 ${T("覚えた", "おぼえた")}</button>
      </div>` : ""}`;
}

// 答えたあとの「正解・不正解」の表示
function feedbackHtml(q) {
  const a = session.answered;
  const item = q.item;
  const title = a.correct ? T("⭕ 正解！", "⭕ せいかい！") : T("❌ ざんねん…", "❌ ざんねん…");
  return `
    <div class="feedback ${a.correct ? "ok" : "ng"}">
      <div class="fb-title">${title}</div>
      <div class="fb-word">${item.emoji ? `<span class="fb-emoji">${item.emoji}</span>` : ""}<b>${esc(item.en)}</b>${speakBtn(item.en)}</div>
      <div class="fb-ja">${esc(item.ja)}</div>
      ${item.ex ? `<div class="fb-ex">${esc(item.ex)}<br><small>${esc(item.exJa)}</small></div>` : ""}
      <button class="primary next-btn" data-action="next">${T("つぎへ", "つぎへ")} ▶</button>
    </div>`;
}

// --- 結果の画面 ---
function renderResult() {
  const res = session.results;
  const ok = res.filter((r) => r.correct).length;
  const rate = res.length ? ok / res.length : 0;
  let msg;
  if (rate === 1) msg = T("🎉 パーフェクト！", "🎉 パーフェクト！すごい！");
  else if (rate >= 0.8) msg = T("✨ すごい！", "✨ すごい！");
  else if (rate >= 0.5) msg = T("👍 いいね！", "👍 いいね！");
  else msg = T("💪 次はがんばろう！", "💪 つぎも がんばろう！");
  const stars = "⭐".repeat(Math.max(1, Math.round(rate * 3)));

  const rows = res.map((r) => `
    <li class="${r.correct ? "ok" : "ng"}">
      <span class="mark">${r.correct ? "⭕" : "❌"}</span>
      <span class="w-en">${r.item.emoji ? r.item.emoji + " " : ""}${esc(r.item.en)}</span>
      <span class="w-ja">${esc(r.item.ja)}</span>
      ${speakBtn(r.item.en, "small")}
    </li>`).join("");

  return `
    <div class="result">
      <div class="stars">${stars}</div>
      <div class="result-msg">${msg}</div>
      <div class="result-score">${res.length}${T("問中", "もん中")} <b>${ok}</b>${T("問正解", "もん せいかい")}</div>
      <div class="result-streak">🔥 ${streak(store.currentId)}${T("日連続", "にち れんぞく")}</div>
    </div>
    <ul class="word-list">${rows}</ul>
    <div class="row-btns stack">
      <button class="primary" data-action="start" data-mode="${session.mode}">🔁 ${T("もう一回", "もういっかい")}</button>
      <button class="sub-btn" data-action="go" data-go="home">🏠 ${T("ホームへ", "ホームへ")}</button>
    </div>`;
}

// --- 記録の画面 ---
function progressBar(label, items) {
  const r = recs();
  const learned = items.filter((i) => r[i.id]).length;
  const mastered = items.filter((i) => r[i.id] && r[i.id].lv >= MASTER_LV).length;
  const total = items.length || 1;
  return `
    <div class="prog">
      <div class="prog-head"><span>${label}</span><span>${T("覚えた", "おぼえた")} <b>${mastered}</b> / ${items.length}</span></div>
      <div class="prog-bar">
        <div class="prog-learned" style="width:${(learned / total) * 100}%"></div>
        <div class="prog-mastered" style="width:${(mastered / total) * 100}%"></div>
      </div>
    </div>`;
}

function renderRecords() {
  const u = user();
  const r = recs();
  const days = studyDays(u.id);
  const total = Object.values(days).reduce((s, n) => s + n, 0);
  const masteredAll = Object.values(r).filter((x) => x.lv >= MASTER_LV).length;

  let bars;
  if (isKid()) {
    bars = progressBar("えの ある ことば", PICTURE_ITEMS);
  } else {
    bars = [1, 2, 3].map((g) => progressBar(`単語 中${g}`, ITEMS.filter((i) => i.kind === "w" && i.grade === g))).join("")
      + [1, 2, 3].map((g) => progressBar(`熟語 中${g}`, ITEMS.filter((i) => i.kind === "i" && i.grade === g))).join("");
  }

  // 最近2週間のカレンダー
  const t = today();
  const cal = [];
  for (let d = t - 13; d <= t; d++) {
    const n = days[d] || 0;
    const date = new Date(d * 86400000);
    const level = n === 0 ? 0 : n < 10 ? 1 : n < 30 ? 2 : 3;
    cal.push(`<div class="cal-day lv${level}" title="${n}"><span>${date.getUTCDate()}</span></div>`);
  }

  const weak = ITEMS.filter((i) => r[i.id] && r[i.id].ng > 0 && r[i.id].lv < MASTER_LV)
    .sort((a, b) => r[b.id].ng - r[a.id].ng).slice(0, 15);
  const weakRows = weak.map((i) => `
    <li><span class="w-en">${i.emoji ? i.emoji + " " : ""}${esc(i.en)}</span><span class="w-ja">${esc(i.ja)}</span>
    <span class="ng-count">×${r[i.id].ng}</span>${speakBtn(i.en, "small")}</li>`).join("");

  return `
    <div class="stats">
      <div class="stat"><b>🔥 ${streak(u.id)}</b><span>${T("日連続", "にち れんぞく")}</span></div>
      <div class="stat"><b>${total}</b><span>${T("解いた問題", "といた もんだい")}</span></div>
      <div class="stat"><b>${masteredAll}</b><span>${T("覚えた語", "おぼえた ことば")}</span></div>
    </div>
    <h3>${T("この2週間", "この 2しゅうかん")}</h3>
    <div class="calendar">${cal.join("")}</div>
    <h3>${T("覚えた数", "おぼえた かず")}</h3>
    ${bars}
    <p class="note"><span class="legend learned"></span>${T("学習した", "やった")}　<span class="legend mastered"></span>${T("覚えた（3回以上つづけて正解）", "おぼえた（3かい つづけて せいかい）")}</p>
    <h3>${T("にがてな単語", "にがてな ことば")}</h3>
    ${weak.length ? `<ul class="word-list">${weakRows}</ul>` : `<p class="note">${T("まだありません", "まだ ないよ")}</p>`}
    <button class="primary wide" data-action="go" data-go="list">📚 ${T("単語の一覧を見る", "ことばの いちらんを みる")}</button>`;
}

// --- 単語の一覧 ---
// 一覧に出す単語（学年・種類・さがす文字でしぼる）
function listItems() {
  let items = isKid() ? PICTURE_ITEMS : ITEMS;
  if (!isKid()) {
    if (listFilter.grade !== "all") items = items.filter((i) => i.grade === Number(listFilter.grade));
    if (listFilter.kind !== "all") items = items.filter((i) => i.kind === listFilter.kind);
  }
  const q = listFilter.q.trim().toLowerCase();
  if (q) items = items.filter((i) => i.en.toLowerCase().includes(q) || i.ja.includes(q));
  return items;
}

function listRowsHtml() {
  const r = recs();
  const items = listItems();
  const rows = items.slice(0, 300).map((i) => {
    const rec = r[i.id];
    const lv = rec ? rec.lv : -1;
    return `
      <li>
        <span class="lv-dot lv${lv}" title="${rec ? LV_NAMES[lv] : "まだ"}"></span>
        <span class="w-en">${i.emoji ? i.emoji + " " : ""}${esc(i.en)}</span>
        <span class="w-ja">${esc(i.ja)}</span>
        ${speakBtn(i.en, "small")}
      </li>`;
  }).join("");
  const count = `${items.length}${T("語", "こ")}${items.length > 300 ? T("（最初の300語を表示）", "") : ""}`;
  return { rows, count };
}

function renderList() {
  const chip = (key, val, label) =>
    `<button class="chip ${listFilter[key] === val ? "on" : ""}" data-action="list-filter" data-key="${key}" data-val="${val}">${label}</button>`;
  const filters = isKid() ? "" : `
    <div class="range">
      <div class="range-row">${chip("grade", "all", "ぜんぶ")}${chip("grade", "1", "中1")}${chip("grade", "2", "中2")}${chip("grade", "3", "中3")}</div>
      <div class="range-row">${chip("kind", "all", "両方")}${chip("kind", "w", "単語")}${chip("kind", "i", "熟語")}</div>
    </div>`;
  const { rows, count } = listRowsHtml();
  return `
    <button class="back-link" data-action="go" data-go="records">◀ ${T("記録へ戻る", "もどる")}</button>
    ${filters}
    <input id="list-search" class="search" type="search" placeholder="${T("英語か日本語でさがす", "さがす")}" value="${esc(listFilter.q)}">
    <p class="note" id="list-count">${count}</p>
    <div class="lv-legend">
      ${LV_NAMES.map((n, k) => `<span><span class="lv-dot lv${k}"></span>${n}</span>`).join("")}
      <span><span class="lv-dot lv-1"></span>${T("未学習", "まだ")}</span>
    </div>
    <ul class="word-list" id="list-rows">${rows}</ul>`;
}

// --- 設定 ---
function renderSettings() {
  const userForms = store.users.map((u) => `
    <div class="setting-user">
      <div class="avatar-pick">
        ${AVATARS.map((a) => `<button class="${u.avatar === a ? "on" : ""}" data-action="avatar" data-id="${u.id}" data-val="${a}">${a}</button>`).join("")}
      </div>
      <label>なまえ
        <input type="text" data-field="name" data-id="${u.id}" value="${esc(u.name)}" maxlength="10">
      </label>
      <label>モード
        <select data-field="mode" data-id="${u.id}">
          <option value="chu" ${u.mode === "chu" ? "selected" : ""}>中学生モード（中1〜中3の単語・熟語）</option>
          <option value="sho" ${u.mode === "sho" ? "selected" : ""}>しょうがくせい モード（えで おぼえる）</option>
        </select>
      </label>
      <label>よみあげの はやさ
        <select data-field="rate" data-id="${u.id}">
          <option value="normal" ${u.rate !== "slow" ? "selected" : ""}>ふつう</option>
          <option value="slow" ${u.rate === "slow" ? "selected" : ""}>ゆっくり</option>
        </select>
      </label>
      <button class="danger" data-action="reset-user" data-id="${u.id}">${esc(u.name)}の きろくを けす</button>
    </div>`).join("");

  return `
    <h3>つかう ひと</h3>
    ${userForms}
    <h3>そのほか</h3>
    <label class="switch-row">
      <input type="checkbox" data-field="sound" ${store.sound ? "checked" : ""}> こうかおん（ピンポン・ブブー）
    </label>
    <h3>バックアップ</h3>
    <p class="note">記録はこのスマホのブラウザの中に保存されています。機種変更のときや、念のために書き出しておくと安心です。</p>
    <div class="row-btns stack">
      <button class="sub-btn" data-action="export">📤 記録を書き出す</button>
      <label class="sub-btn file-btn">📥 記録を読み込む<input type="file" accept=".json,application/json" data-field="import" hidden></label>
    </div>
    <p class="note">単語 ${ITEMS.filter((i) => i.kind === "w").length}語 ・ 熟語 ${ITEMS.filter((i) => i.kind === "i").length}こ を収録</p>`;
}

// ===== タップしたときの動き =====
const actions = {
  "pick-user": (el) => {
    store.currentId = el.dataset.id;
    saveStore();
    screen = "home";
    render();
  },
  go: (el) => {
    screen = el.dataset.go;
    session = null;
    render();
    window.scrollTo(0, 0);
  },
  pref: (el) => {
    prefs()[el.dataset.key] = el.dataset.val;
    saveStore();
    render();
  },
  start: (el) => {
    startSession(el.dataset.mode);
    window.scrollTo(0, 0);
  },
  quit: () => {
    if (session.results.length === 0 || confirm(T("やめますか？（ここまでの記録は残ります）", "やめる？"))) {
      clearTimeout(autoNextTimer);
      session = null;
      screen = "home";
      render();
    }
  },
  speak: (el) => speak(el.dataset.text),
  choose: (el) => {
    const q = cur();
    const i = Number(el.dataset.i);
    const c = q.choices[i];
    const correct = q.type === "blank" ? c === q.item.blank : c.id === q.item.id;
    answer(correct, { choice: i });
  },
  next: () => next(),
  hint: () => {
    const input = document.getElementById("spell-input");
    cur().draft = input ? input.value : "";
    cur().hint = true;
    render();
    const again = document.getElementById("spell-input");
    if (again) again.value = cur().draft || "";
  },
  giveup: () => {
    const input = document.getElementById("spell-input");
    answer(false, { typed: input ? input.value : "" });
  },
  tile: (el) => {
    const q = cur();
    q.typed.push(Number(el.dataset.i));
    if (q.typed.length === q.item.en.length) {
      const word = q.typed.map((ti) => q.tiles[ti]).join("");
      answer(word === q.item.en);
    } else {
      render();
    }
  },
  untile: () => {
    cur().typed.pop();
    render();
  },
  place: (el) => {
    const q = cur();
    q.placed.push(Number(el.dataset.i));
    if (q.placed.length === q.tokens.length) {
      const sentence = q.placed.map((ti) => q.tokens[ti]).join(" ");
      answer(sentence === q.item.ex);
    } else {
      render();
    }
  },
  unplace: (el) => {
    cur().placed.splice(Number(el.dataset.n), 1);
    render();
  },
  flip: () => {
    const q = cur();
    if (q.flipped) return;
    q.flipped = true;
    speak(q.item.en);
    render();
  },
  rate: (el) => {
    const q = cur();
    const ok = el.dataset.ok === "1";
    if (!q.retry) {
      session.results.push({ item: q.item, correct: ok });
      recordResult(q.item, ok);
      if (!ok) session.queue.push({ item: q.item, type: q.type, retry: true });
    }
    next();
  },
  "list-filter": (el) => {
    listFilter[el.dataset.key] = el.dataset.val;
    render();
  },
  avatar: (el) => {
    store.users.find((u) => u.id === el.dataset.id).avatar = el.dataset.val;
    saveStore();
    render();
  },
  "reset-user": (el) => {
    const u = store.users.find((x) => x.id === el.dataset.id);
    if (!confirm(`${u.name}の学習の記録をすべて消します。よろしいですか？`)) return;
    delete store.progress[u.id];
    delete store.days[u.id];
    saveStore();
    alert("消しました");
    render();
  },
  export: () => {
    const blob = new Blob([JSON.stringify(store, null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    const d = new Date();
    a.href = URL.createObjectURL(blob);
    a.download = `eitango-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
};

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.action];
  if (fn) fn(el);
});

// 下のメニュー
$nav.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  screen = b.dataset.go;
  session = null;
  render();
  window.scrollTo(0, 0);
});

// 上の「だれ？」ボタン → 人を選ぶ画面へ
$userChip.addEventListener("click", () => {
  if (screen === "quiz" && session && session.results.length && !confirm("とちゅうで やめて、ひとを かえますか？")) return;
  clearTimeout(autoNextTimer);
  session = null;
  screen = "users";
  render();
});

// スペル入力の「答える」
document.addEventListener("submit", (e) => {
  e.preventDefault();
  if (e.target.dataset.form !== "spell" || !session || session.answered) return;
  const typed = document.getElementById("spell-input").value;
  if (!typed.trim()) return;
  const norm = (s) => s.toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, " ").trim();
  answer(norm(typed) === norm(cur().item.en), { typed });
});

// 設定の入力欄・一覧のさがす欄
document.addEventListener("input", (e) => {
  const el = e.target;
  if (el.id === "list-search") {
    // 一覧の部分だけ作り直す（画面全体を作り直すと、日本語の入力がとぎれるため）
    listFilter.q = el.value;
    const { rows, count } = listRowsHtml();
    document.getElementById("list-rows").innerHTML = rows;
    document.getElementById("list-count").textContent = count;
    return;
  }
  if (el.dataset.field === "name") {
    store.users.find((u) => u.id === el.dataset.id).name = el.value.trim() || "なまえ";
    saveStore();
  }
});

document.addEventListener("change", (e) => {
  const el = e.target;
  const f = el.dataset.field;
  if (f === "mode" || f === "rate") {
    store.users.find((u) => u.id === el.dataset.id)[f] = el.value;
    saveStore();
    render();
  } else if (f === "name") {
    render();
  } else if (f === "sound") {
    store.sound = el.checked;
    saveStore();
  } else if (f === "import") {
    const file = el.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || !Array.isArray(data.users)) throw new Error("bad");
        if (!confirm("読み込んだ記録で、今の記録を置きかえます。よろしいですか？")) return;
        store = Object.assign(defaultStore(), data);
        saveStore();
        alert("読み込みました");
        screen = "users";
        render();
      } catch (err) {
        alert("このファイルは読み込めませんでした");
      }
    };
    reader.readAsText(file);
  }
});

render();
