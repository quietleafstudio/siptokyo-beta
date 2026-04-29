const scoreWeights = [
  ["teaTaste", "お茶のおいしさ", 25],
  ["teaFocus", "お茶主役度", 20],
  ["spaceComfort", "空間の心地よさ", 15],
  ["seatComfort", "座席快適性", 10],
  ["talkQuietFit", "会話 / 静けさ適性", 10],
  ["menuDepth", "メニュー充実度", 8],
  ["worldview", "世界観", 7],
  ["access", "アクセス", 5],
];

const areaOptions = ["自由が丘", "新宿", "表参道", "浅草", "渋谷", "三軒茶屋", "銀座", "代々木上原"];
const genreOptions = ["抹茶", "日本茶", "ハーブ", "中国茶", "和菓子", "薬膳茶"];

const state = {
  area: "自由が丘",
  genre: "抹茶",
  results: [],
  decisions: readDecisions(),
};

function readDecisions() {
  try {
    return JSON.parse(localStorage.getItem("sipStudioDecisions") || "{}");
  } catch {
    return {};
  }
}

function saveDecisions() {
  localStorage.setItem("sipStudioDecisions", JSON.stringify(state.decisions));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-|-$/g, "");
}

function pick(list, index) {
  return list[index % list.length];
}

function buildCandidate(index, area, genre) {
  const styles = ["茶房", "ティーサロン", "和カフェ", "茶寮", "ティースタンド", "喫茶室"];
  const moods = ["静かな", "余白のある", "会話しやすい", "ひと息つける", "明るい", "落ち着いた"];
  const streets = ["1-3-8", "2-12-4", "3-6-11", "4-9-2", "5-18-7"];
  const name = `${area}${pick(styles, index)} ${pick(["葉音", "香月", "翠日", "茶々", "雨庭"], index)} ${index + 1}`;
  const id = `${slug(area)}-${slug(genre)}-${index + 1}`;
  const tags = unique([
    genre,
    pick(["一人時間", "会話向け", "静か"], index),
    pick(["駅近", "明るい", "上品", "穴場"], index + 1),
  ]);
  const score = buildScore(index, genre);

  return {
    id,
    name,
    area,
    genreQuery: genre,
    address: `東京都${area}エリア ${pick(streets, index)}`,
    mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${area} ${genre} カフェ`)}`,
    officialUrl: index % 3 === 0 ? `https://example.com/${id}` : "",
    instagramUrl: index % 4 === 0 ? `https://www.instagram.com/${id.replaceAll("-", "_")}` : "",
    menuUrl: index % 2 === 0 ? `https://example.com/${id}/menu` : "",
    genreGuess: `${genre} / ${pick(["カフェ", "茶房", "喫茶", "和菓子"], index)}`,
    tags,
    score,
    totalScore: Object.values(score).reduce((sum, value) => sum + value, 0),
    memoDraft: `${pick(moods, index)}${area}の${genre}候補。お茶を主役にした利用ができそうか、イートイン席と単品注文の可否を確認したい。`,
    riskFlags: index % 5 === 0 ? ["コース中心の可能性", "単品利用要確認"] : [],
  };
}

function buildScore(index, genre) {
  const teaBoost = genre === "抹茶" || genre === "日本茶" ? 3 : 0;
  return {
    teaTaste: Math.min(25, 17 + ((index * 3) % 7) + teaBoost),
    teaFocus: Math.min(20, 13 + ((index * 2) % 6) + teaBoost),
    spaceComfort: 9 + ((index * 5) % 6),
    seatComfort: 6 + (index % 5),
    talkQuietFit: 6 + ((index + 2) % 5),
    menuDepth: 4 + ((index * 3) % 5),
    worldview: 4 + ((index + 1) % 4),
    access: 3 + (index % 3),
  };
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function generateResults() {
  state.results = Array.from({ length: 20 }, (_, index) => buildCandidate(index, state.area, state.genre));
  render();
}

function renderOptions(options, activeValue) {
  return options
    .map((option) => `<option value="${escapeHtml(option)}"${option === activeValue ? " selected" : ""}>${escapeHtml(option)}</option>`)
    .join("");
}

function renderScore(candidate) {
  return scoreWeights
    .map(([key, label, max]) => {
      const value = candidate.score[key];
      const percent = Math.round((value / max) * 100);
      return `
        <div class="scoreLine">
          <div>
            <span>${escapeHtml(label)}</span>
            <strong>${value}/${max}</strong>
          </div>
          <i style="--score:${percent}%"></i>
        </div>
      `;
    })
    .join("");
}

function renderCandidate(candidate, index) {
  const decision = state.decisions[candidate.id] || "";
  const links = [
    `<a href="${candidate.mapsUrl}" target="_blank" rel="noreferrer">Google Maps</a>`,
    candidate.officialUrl ? `<a href="${candidate.officialUrl}" target="_blank" rel="noreferrer">公式HP</a>` : "",
    candidate.instagramUrl ? `<a href="${candidate.instagramUrl}" target="_blank" rel="noreferrer">Instagram</a>` : "",
    candidate.menuUrl ? `<a href="${candidate.menuUrl}" target="_blank" rel="noreferrer">メニュー</a>` : "",
  ]
    .filter(Boolean)
    .join("");
  const riskFlags = candidate.riskFlags.map((flag) => `<span>${escapeHtml(flag)}</span>`).join("");

  return `
    <article class="candidateCard">
      <div class="cardTop">
        <span class="resultIndex">${String(index + 1).padStart(2, "0")}</span>
        <span class="scoreBadge">${candidate.totalScore} / 100</span>
      </div>
      <h2>${escapeHtml(candidate.name)}</h2>
      <p class="address">${escapeHtml(candidate.address)}</p>
      <div class="linkGrid">${links}</div>
      <dl class="candidateMeta">
        <div><dt>ジャンル推定</dt><dd>${escapeHtml(candidate.genreGuess)}</dd></div>
        <div><dt>タグ候補</dt><dd>${candidate.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</dd></div>
      </dl>
      <section class="scorePanel" aria-label="SIPスコア内訳">
        ${renderScore(candidate)}
      </section>
      ${riskFlags ? `<div class="riskFlags">${riskFlags}</div>` : ""}
      <div class="memoBox">
        <p>SIPメモ草案</p>
        <span>${escapeHtml(candidate.memoDraft)}</span>
      </div>
      <div class="decisionGroup" data-id="${escapeHtml(candidate.id)}">
        ${renderDecisionButton(candidate.id, decision, "採用")}
        ${renderDecisionButton(candidate.id, decision, "保留")}
        ${renderDecisionButton(candidate.id, decision, "不採用")}
      </div>
    </article>
  `;
}

function renderDecisionButton(id, decision, label) {
  const active = decision === label ? " active" : "";
  return `<button class="decisionButton${active}" type="button" data-decision="${escapeHtml(label)}" data-id="${escapeHtml(id)}">${escapeHtml(label)}</button>`;
}

function render() {
  const root = document.getElementById("studio-root");
  const adopted = Object.values(state.decisions).filter((value) => value === "採用").length;
  const pending = Object.values(state.decisions).filter((value) => value === "保留").length;
  const rejected = Object.values(state.decisions).filter((value) => value === "不採用").length;

  root.innerHTML = `
    <div class="studioShell">
      <header class="studioHeader">
        <p class="eyebrow">SIP Studio</p>
        <h1>Research</h1>
        <p class="lead">エリア × ジャンルで、SIP Tokyo掲載候補を20件ずつ洗い出すモック管理画面。</p>
      </header>

      <section class="searchBoard" aria-label="検索条件">
        <label>
          <span>エリア</span>
          <select id="areaSelect">${renderOptions(areaOptions, state.area)}</select>
        </label>
        <label>
          <span>ジャンル</span>
          <select id="genreSelect">${renderOptions(genreOptions, state.genre)}</select>
        </label>
        <button id="researchButton" type="button">20件リサーチ</button>
      </section>

      <section class="criteriaPanel" aria-label="掲載基準">
        <div>
          <p>掲載基準</p>
          <span>お茶が主役 / 座って過ごせる / イートインあり / 一杯と時間を過ごしたくなる空間</span>
        </div>
        <div>
          <p>除外</p>
          <span>コーヒー主役 / テイクアウト専門 / スイーツ主役 / 回転率重視 / 空間にいたくならない</span>
        </div>
      </section>

      <section class="resultHeader">
        <div>
          <p>${escapeHtml(state.area)} × ${escapeHtml(state.genre)}</p>
          <h2>${state.results.length} candidates</h2>
        </div>
        <div class="decisionStats">
          <span>採用 ${adopted}</span>
          <span>保留 ${pending}</span>
          <span>不採用 ${rejected}</span>
        </div>
      </section>

      <main class="candidateList">
        ${state.results.map(renderCandidate).join("")}
      </main>
    </div>
  `;
}

document.addEventListener("change", (event) => {
  if (event.target.id === "areaSelect") {
    state.area = event.target.value;
  }

  if (event.target.id === "genreSelect") {
    state.genre = event.target.value;
  }
});

document.addEventListener("click", (event) => {
  if (event.target.id === "researchButton") {
    generateResults();
    return;
  }

  if (event.target.matches(".decisionButton")) {
    const id = event.target.dataset.id;
    const decision = event.target.dataset.decision;
    state.decisions[id] = state.decisions[id] === decision ? "" : decision;
    saveDecisions();
    render();
  }
});

generateResults();
