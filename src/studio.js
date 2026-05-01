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
  mode: "query",
  area: "自由が丘",
  genre: "抹茶",
  mapsUrl: "",
  results: [],
  decisions: readDecisions(),
  isLookupLoading: false,
  isSearchLoading: false,
  searchError: "",
  searchMeta: null,
  copyStatus: "",
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

function hashString(value) {
  let hash = 0;
  for (const char of String(value)) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash.toString(36);
}

function idSlugFromName(value) {
  const normalized = String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || `spot-${hashString(value)}`;
}

function pick(list, index) {
  return list[index % list.length];
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeMapsUrl(value) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`;
}

function inferNameFromMapsUrl(url) {
  try {
    const parsed = new URL(url);
    const query = parsed.searchParams.get("query") || decodeURIComponent(parsed.pathname.split("/").filter(Boolean).pop() || "");
    return query.replace(/\+/g, " ").replace(/\s+/g, " ").trim() || "Google Maps候補";
  } catch {
    return url.replace(/^https?:\/\//, "").slice(0, 28) || "Google Maps候補";
  }
}

function decodeMapsText(value) {
  return decodeURIComponent(String(value || ""))
    .replace(/\+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitCandidateNameAndAddress(text) {
  const normalized = decodeMapsText(text);
  const separators = ["｜", "|", "\n", "、"];
  const separator = separators.find((item) => normalized.includes(item));

  if (separator) {
    const [name, ...rest] = normalized.split(separator).map((item) => item.trim()).filter(Boolean);
    return { name: name || normalized, address: rest.join(" ") };
  }

  const addressMatch = normalized.match(/(.+?)\s+(東京都|神奈川県|埼玉県|千葉県|大阪府|京都府|北海道|.+?[県府])(.+)/);
  if (addressMatch) {
    return {
      name: addressMatch[1].trim(),
      address: `${addressMatch[2]}${addressMatch[3]}`.trim(),
    };
  }

  return { name: normalized, address: "" };
}

function extractMapsPlaceData(url) {
  const fallback = {
    name: inferNameFromMapsUrl(url),
    address: "",
    coordinates: "",
    mapsUrl: url,
  };

  try {
    const parsed = new URL(url);
    const queryText =
      parsed.searchParams.get("query") ||
      parsed.searchParams.get("q") ||
      parsed.searchParams.get("destination") ||
      parsed.searchParams.get("daddr") ||
      "";
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    const placeIndex = pathParts.findIndex((part) => part === "place" || part === "search");
    const pathText = placeIndex >= 0 ? pathParts[placeIndex + 1] || "" : "";
    const sourceText = queryText || pathText || fallback.name;
    const parsedText = splitCandidateNameAndAddress(sourceText);
    const coordinates = parsed.pathname.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);

    return {
      name: parsedText.name || fallback.name,
      address: parsedText.address,
      coordinates: coordinates ? `${coordinates[1]}, ${coordinates[2]}` : "",
      mapsUrl: url,
    };
  } catch {
    return fallback;
  }
}

async function lookupMapsData(mapsUrl) {
  try {
    const response = await fetch(`/api/maps-lookup?url=${encodeURIComponent(mapsUrl)}`, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`maps lookup failed: ${response.status}`);
    }

    return await response.json();
  } catch {
    return null;
  }
}

async function searchPlaces(area, genre) {
  try {
    const url = `/api/places-search?area=${encodeURIComponent(area)}&genre=${encodeURIComponent(genre)}`;
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`places search failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    return {
      places: [],
      error: error instanceof Error ? error.message : "places search failed",
    };
  }
}

function inferTeaTags(candidate) {
  const text = [candidate.name, candidate.address, candidate.description, candidate.genreQuery, candidate.primaryType, ...(candidate.types || [])]
    .filter(Boolean)
    .join(" ");
  const tagRules = [
    ["抹茶", /抹茶|matcha/i],
    ["ハーブ", /ハーブ|herb|薬草|オーガニック/i],
    ["日本茶", /日本茶|煎茶|緑茶|ほうじ茶|玉露|茶房|茶寮|伊藤園/i],
    ["中国茶", /中国茶|台湾茶|烏龍|普洱|プーアル/i],
    ["古民家", /古民家|民家|畳|庭|和室/i],
    ["静か", /静か|落ち着|隠れ家|茶室|庭|余白/i],
    ["会話向け", /カフェ|cafe|サロン|ラウンジ|広々|テーブル/i],
    ["一人時間", /茶房|茶寮|カウンター|静か|一人|ひとり/i],
    ["異国感", /台湾|中国茶|薬膳|タイ|ハーブ|烏龍|普洱|プーアル|chai|spice|oriental/i],
    ["洗練", /表参道|銀座|青山|サロン|ラウンジ|ホテル|teahouse|tea house|洗練|上質/i],
  ];

  const inferred = tagRules.filter(([, pattern]) => pattern.test(text)).map(([tag]) => tag);
  return unique([candidate.genreQuery, ...inferred, "一人時間"]).slice(0, 6);
}

function buildMemoDraft(candidate) {
  const tags = candidate.tags || [];
  const has = (tag) => tags.includes(tag);

  if (has("古民家")) {
    return "木の気配が残る空間で、お茶の香りをゆっくり味わう。\n時間までやわらかくほどける、静かな休憩になりそう。";
  }

  if (has("異国感") || has("中国茶")) {
    return "異国の香りを少しだけまとった、奥行きのある一杯。\n日常の外側へふっと出られる、お茶時間になりそう。";
  }

  if (has("洗練")) {
    return "すっきり整った空間で、背筋まで軽く伸びる一杯を。\n都会の途中に置いておきたい、上品なお茶時間。";
  }

  if (has("静か") && has("一人時間")) {
    return "静かな午後に、丁寧な一杯をひとりで味わいたい。\n気持ちまでふっと整う、余白のあるお茶時間。";
  }

  if (has("抹茶")) {
    return "抹茶の深い緑に、少しだけ心を預けたくなる。\n甘さとほろ苦さが寄り添う、やさしい休憩になりそう。";
  }

  if (has("日本茶")) {
    return "湯気の向こうに、日本茶の静かな香りが立ちのぼる。\n急がない気分で訪れたい、落ち着いた一杯の場所。";
  }

  if (has("会話向け")) {
    return "お茶を囲んで、言葉が自然にほどけていく時間。\n誰かとゆっくり過ごしたい日に選びたくなる。";
  }

  if (has("一人時間")) {
    return "ひとりで座って、呼吸を少し深く戻したい。\n短い休憩にも余韻が残る、お茶のための場所。";
  }

  return "街の流れから少し離れて、お茶の香りにひと息つく。\nふらりと立ち寄りたくなる、やさしい休憩の候補。";
}

function buildCommentDraft(candidate) {
  const tags = candidate.tags || [];
  const genre = candidate.genreQuery || "";
  const score = candidate.score || {};
  const sourceText = [candidate.name, candidate.area, genre, ...tags].join("|");
  const seed = Number.parseInt(hashString(sourceText).slice(0, 6), 36) || 0;
  const has = (tag) => tags.includes(tag);
  const highWorldview = Number(score.worldview || 0) >= 6;
  const highQuiet = Number(score.talkQuietFit || 0) >= 8;
  const highSpace = Number(score.spaceComfort || 0) >= 12;
  let options = [];

  if (has("古民家")) {
    options = [
      "木の気配に包まれる、静かな茶の時間。",
      "懐かしい空気に、お茶の香りが重なる。",
      "畳の余白で、心までゆっくりほどける。",
    ];
  } else if (has("異国感") || has("中国茶")) {
    options = [
      "少し旅する気分で、お茶に深く浸りたい。",
      "異国の香りがふわりと残る、静かな一杯。",
      "湯気の向こうに、遠い街の気配が揺れる。",
    ];
  } else if (has("洗練") || highWorldview) {
    options = [
      "背筋をふっと伸ばしたくなる、凛とした一杯。",
      "都会の余白に似合う、澄んだお茶時間。",
      "きれいな空気ごと味わいたい、上品な一席。",
    ];
  } else if (has("静か") || highQuiet) {
    options = [
      "静かな余白に、気持ちまでゆっくりほどける。",
      "音を少し遠ざけて、お茶に心を預けたい。",
      "ひと息の奥に、静けさがやさしく残る。",
    ];
  } else if (has("抹茶")) {
    options = [
      "抹茶の緑に、心がすっと落ち着いていく。",
      "ほろ苦い余韻で、午後をやさしく整える。",
      "深い緑の一杯に、少しだけ立ち止まりたい。",
    ];
  } else if (has("日本茶")) {
    options = [
      "茶葉の香りに、気分が静かに整っていく。",
      "湯気の向こうで、街の時間がゆるんでいく。",
      "まっすぐなお茶の香りで、ひと息つける。",
    ];
  } else if (has("会話向け")) {
    options = [
      "会話の合間にも、お茶の香りがやさしく残る。",
      "誰かと過ごす午後に、そっと寄り添う一杯。",
      "明るい空気の中で、肩の力を抜いて過ごせる。",
    ];
  } else if (has("一人時間")) {
    options = [
      "ひとりの時間に、そっと余韻を足してくれる。",
      "短い休憩にも、静かな気配が残る一杯。",
      "自分の呼吸に戻れる、やさしいお茶時間。",
    ];
  } else if (highSpace) {
    options = [
      "空間の心地よさまで味わいたくなる一席。",
      "ゆったりした空気に、お茶の香りがなじむ。",
      "席に着いた瞬間、少し長居したくなる。",
    ];
  } else {
    options = [
      "街の途中で、ふっとお茶に立ち寄りたい。",
      "小さな休憩に、やさしい香りを添えてくれる。",
      "今日の気分に、静かな一杯を選びたい。",
    ];
  }

  return pick(options, seed);
}

function buildCandidate(index, area, genre, overrides = {}) {
  const styles = ["茶房", "ティーサロン", "和カフェ", "茶寮", "ティースタンド", "喫茶室"];
  const streets = ["1-3-8", "2-12-4", "3-6-11", "4-9-2", "5-18-7"];
  const name = overrides.name || `${area}${pick(styles, index)} ${pick(["葉音", "香月", "翠日", "茶々", "雨庭"], index)} ${index + 1}`;
  const id = `${slug(area)}-${slug(genre)}-${index + 1}`;
  const fallbackTags = unique([
    genre,
    pick(["一人時間", "会話向け", "静か"], index),
    pick(["駅近", "明るい", "上品", "穴場"], index + 1),
  ]);
  const score = buildScore(index, genre);
  const mapsUrl = overrides.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${area} ${genre} カフェ`)}`;

  return {
    id: overrides.id || id,
    source: {
      provider: overrides.sourceProvider || "mock",
      mode: overrides.sourceMode || "query",
      input: overrides.sourceInput || `${area} × ${genre}`,
      fetchedAt: new Date().toISOString(),
    },
    placeId: overrides.placeId || "",
    name,
    area,
    genreQuery: genre,
    address: overrides.address || `東京都${area}エリア ${pick(streets, index)}`,
    mapsUrl,
    officialUrl: overrides.officialUrl ?? (index % 3 === 0 ? `https://example.com/${id}` : ""),
    instagramUrl: overrides.instagramUrl ?? (index % 4 === 0 ? `https://www.instagram.com/${id.replaceAll("-", "_")}` : ""),
    menuUrl: overrides.menuUrl ?? (index % 2 === 0 ? `https://example.com/${id}/menu` : ""),
    reviewCount: overrides.reviewCount ?? 24 + index * 11,
    rating: overrides.rating ?? Number((3.7 + ((index % 6) * 0.15)).toFixed(1)),
    hours: overrides.hours || pick(["11:00-19:00", "10:00-20:00", "12:00-18:00", "営業時間確認中"], index),
    photoUrl: overrides.photoUrl || "",
    photoLabel: overrides.photoLabel || "photo pending",
    genreGuess: overrides.genreGuess || `${genre} / ${pick(["カフェ", "茶房", "喫茶", "和菓子"], index)}`,
    tags: overrides.tags || fallbackTags,
    score,
    totalScore: Object.values(score).reduce((sum, value) => sum + value, 0),
    commentDraft: overrides.commentDraft || buildCommentDraft({ name, area, genreQuery: genre, tags: overrides.tags || fallbackTags, score }),
    memoDraft: overrides.memoDraft || buildMemoDraft({ tags: overrides.tags || fallbackTags }),
    menuSummary: overrides.menuSummary || inferMenuSummary(genre, index),
    priceRange: overrides.priceRange || pick(["1,000円台", "1,500-2,500円", "価格確認中"], index),
    riskFlags: overrides.riskFlags || (index % 5 === 0 ? ["コース中心の可能性", "単品利用要確認"] : []),
  };
}

function inferMenuSummary(genre, index) {
  return unique([
    genre === "抹茶" ? "抹茶あり" : "",
    genre === "日本茶" ? "日本茶飲み比べあり" : "",
    genre === "ハーブ" ? "ハーブティーあり" : "",
    pick(["カフェ利用OK", "単品のお茶あり", "予約推奨", "最低注文金額確認"], index),
  ]);
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

function buildScoreFromPlace(place, index, genre) {
  const rating = Number(place.rating || 0);
  const reviewCount = Number(place.reviewCount || 0);
  const ratingBoost = rating ? Math.round((rating - 3.5) * 3) : 0;
  const reviewBoost = reviewCount > 120 ? 2 : reviewCount > 40 ? 1 : 0;
  const teaBoost = genre === "抹茶" || genre === "日本茶" ? 3 : 0;
  const typeText = [place.name, place.primaryType, ...(place.types || [])].join(" ");
  const cafeBoost = /cafe|tea|japanese|restaurant|bakery/i.test(typeText) ? 1 : 0;
  const tags = place.tags || [];

  return {
    teaTaste: clamp(17 + ratingBoost + reviewBoost + teaBoost, 12, 25),
    teaFocus: clamp(13 + teaBoost + cafeBoost + (tags.includes("抹茶") ? 2 : 0), 8, 20),
    spaceComfort: clamp(9 + ratingBoost + cafeBoost, 6, 15),
    seatComfort: clamp(6 + cafeBoost + (index % 3), 5, 10),
    talkQuietFit: clamp(6 + (tags.includes("会話向け") ? 2 : 0) + (tags.includes("静か") ? 1 : 0), 4, 10),
    menuDepth: clamp(4 + teaBoost + cafeBoost, 3, 8),
    worldview: clamp(4 + (tags.includes("古民家") ? 2 : 0) + (tags.includes("静か") ? 1 : 0), 3, 7),
    access: clamp(3 + (place.address ? 1 : 0) + (place.mapsUrl ? 1 : 0), 2, 5),
  };
}

function buildCandidateFromPlace(place, index, area, genre) {
  const tags = inferTeaTags({ ...place, genreQuery: genre });
  const memoDraft = buildMemoDraft({ ...place, tags });
  const score = buildScoreFromPlace({ ...place, tags }, index, genre);

  return buildCandidate(index, area, genre, {
    id: `place-${place.placeId || idSlugFromName(place.name)}`,
    name: place.name || `${area} ${genre}候補`,
    address: place.address || "",
    mapsUrl: place.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name || `${area} ${genre}`)}`,
    officialUrl: place.officialUrl || "",
    instagramUrl: place.instagramUrl || "",
    menuUrl: place.menuUrl || "",
    reviewCount: place.reviewCount || null,
    rating: place.rating || null,
    photoUrl: place.photoUrl || "",
    photoLabel: "Google Places",
    genreGuess: `${genre} / お茶候補`,
    tags,
    score,
    commentDraft: buildCommentDraft({ ...place, genreQuery: genre, tags, score }),
    memoDraft,
    sourceProvider: "google-places",
    sourceMode: "areaGenre",
    sourceInput: `${area} × ${genre}`,
    placeId: place.placeId || "",
    riskFlags: unique(["Google Places", place.placeId ? "placeIdあり" : "", place.officialUrl ? "公式HP候補あり" : "公式情報要確認"]),
  });
}

async function generateQueryResults() {
  state.mode = "query";
  state.isSearchLoading = true;
  state.searchError = "";
  state.copyStatus = "";
  render();

  const data = await searchPlaces(state.area, state.genre);
  state.isSearchLoading = false;
  state.searchMeta = data.meta || null;

  if (Array.isArray(data.places) && data.places.length) {
    state.results = data.places.slice(0, 20).map((place, index) => buildCandidateFromPlace(place, index, state.area, state.genre));
    state.searchError = "";
  } else {
    state.results = [];
    state.searchError =
      data.error === "GOOGLE_PLACES_API_KEY is not configured"
        ? "Google Places APIキーが未設定です。Vercelの環境変数 GOOGLE_PLACES_API_KEY を設定してください。"
        : data.error || "実在候補を取得できませんでした。";
  }

  render();
}

async function generateMapsResult() {
  const mapsUrl = normalizeMapsUrl(state.mapsUrl);
  if (!mapsUrl) {
    state.results = [];
    render();
    return;
  }

  state.mode = "maps";
  state.isLookupLoading = true;
  state.searchError = "";
  state.searchMeta = null;
  state.copyStatus = "";
  render();

  const urlPlaceData = extractMapsPlaceData(mapsUrl);
  const apiPlaceData = await lookupMapsData(mapsUrl);
  const placeData = {
    ...urlPlaceData,
    ...(apiPlaceData || {}),
    name: apiPlaceData?.name || urlPlaceData.name,
    address: apiPlaceData?.address || urlPlaceData.address || "",
    mapsUrl: apiPlaceData?.mapsUrl || urlPlaceData.mapsUrl,
    coordinates: apiPlaceData?.coordinates || urlPlaceData.coordinates || "",
  };
  const address = placeData.address || "Google Mapsで住所を開いて確認";
  const autoTags = inferTeaTags({
    name: placeData.name,
    address,
    description: placeData.description,
    genreQuery: state.genre,
  });
  const memoDraft = buildMemoDraft({ tags: autoTags });

  state.mode = "maps";
  state.isLookupLoading = false;
  state.results = [
    buildCandidate(0, state.area, state.genre, {
      id: `maps-${slug(placeData.name) || Date.now()}`,
      name: placeData.name,
      address,
      mapsUrl: placeData.mapsUrl,
      officialUrl: placeData.officialUrl || "",
      instagramUrl: placeData.instagramUrl || "",
      menuUrl: placeData.menuUrl || "",
      reviewCount: null,
      rating: null,
      hours: "営業時間確認中",
      photoUrl: placeData.photoUrl || "",
      sourceProvider: "google-maps-url",
      sourceMode: "mapsUrl",
      sourceInput: mapsUrl,
      photoLabel: "Google Maps URL",
      tags: autoTags,
      genreGuess: `${state.genre} / お茶候補`,
      memoDraft,
      riskFlags: unique([
        "URL由来",
        placeData.address ? "住所候補あり" : "住所はMapsで確認",
        placeData.officialUrl || placeData.instagramUrl || placeData.menuUrl ? "外部リンク候補あり" : "公式情報要確認",
      ]),
    }),
  ];
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

function buildDraftSpot(candidate) {
  const type = candidate.genreGuess || candidate.genreQuery || "";
  const mapUrl = candidate.mapsUrl || "";

  return {
    id: idSlugFromName(candidate.name),
    name: candidate.name,
    area: candidate.area,
    address: candidate.address,
    station: "",
    walk: "",
    image: candidate.photoUrl || "",
    placeId: candidate.placeId || "",
    type,
    genre: type,
    tags: candidate.tags,
    comment: candidate.commentDraft || buildCommentDraft(candidate),
    mapUrl,
    mapsUrl: mapUrl,
    officialUrl: candidate.officialUrl || "",
    instagramUrl: candidate.instagramUrl || "",
    menuUrl: candidate.menuUrl || "",
    menuSummary: candidate.menuSummary,
    priceRange: candidate.priceRange || "",
    note: candidate.memoDraft,
    searchTags: unique([candidate.area, candidate.genreQuery, candidate.name]),
    cautionNote: candidate.riskFlags.join(" / "),
    instagram: { handle: "", placeId: "" },
  };
}

function getAdoptedCandidates() {
  return state.results.filter((candidate) => state.decisions[candidate.id] === "採用");
}

function getAdoptedDraftJson() {
  return JSON.stringify(getAdoptedCandidates().map(buildDraftSpot), null, 2);
}

function renderAdoptedJsonSection() {
  const adoptedCandidates = getAdoptedCandidates();
  const adoptedJson = getAdoptedDraftJson();
  const adoptedList = adoptedCandidates.map((candidate) => `<li>${escapeHtml(candidate.name)}</li>`).join("");

  return `
    <section class="adoptedJsonPanel" aria-label="追加用JSON">
      <div class="adoptedJsonHeader">
        <div>
          <p>採用済みリスト</p>
          <h2>追加用JSON</h2>
        </div>
        <button class="copyJsonButton" type="button" data-copy-adopted-json ${adoptedCandidates.length ? "" : "disabled"}>
          ${state.copyStatus || "JSONをコピー"}
        </button>
      </div>
      ${
        adoptedCandidates.length
          ? `<ul class="adoptedList">${adoptedList}</ul><pre id="adoptedJsonOutput">${escapeHtml(adoptedJson)}</pre>`
          : `<div class="emptyState">候補カードで「採用」を押すと、ここに spots.json 追加用のJSONが生成されます。</div>`
      }
    </section>
  `;
}

function renderCandidate(candidate, index) {
  const decision = state.decisions[candidate.id] || "";
  const links = [
    `<a class="primaryLink" href="${candidate.mapsUrl}" target="_blank" rel="noreferrer">Google Maps</a>`,
    candidate.officialUrl ? `<a href="${candidate.officialUrl}" target="_blank" rel="noreferrer">公式HP</a>` : "",
    candidate.instagramUrl ? `<a href="${candidate.instagramUrl}" target="_blank" rel="noreferrer">Instagram</a>` : "",
    candidate.menuUrl ? `<a href="${candidate.menuUrl}" target="_blank" rel="noreferrer">メニュー</a>` : "",
  ]
    .filter(Boolean)
    .join("");
  const riskFlags = candidate.riskFlags.map((flag) => `<span>${escapeHtml(flag)}</span>`).join("");
  const menuSummary = candidate.menuSummary.map((item) => `<span>${escapeHtml(item)}</span>`).join("");
  const draftJson = JSON.stringify(buildDraftSpot(candidate), null, 2);

  return `
    <article class="candidateCard">
      <div class="cardTop">
        <span class="resultIndex">${String(index + 1).padStart(2, "0")}</span>
        <span class="scoreBadge">${candidate.totalScore} / 100</span>
      </div>
      ${candidate.photoUrl ? `<img class="candidatePhoto" src="${escapeHtml(candidate.photoUrl)}" alt="${escapeHtml(candidate.name)}の写真" />` : `<div class="candidatePhoto emptyPhoto">${escapeHtml(candidate.photoLabel)}</div>`}
      <h2>${escapeHtml(candidate.name)}</h2>
      <p class="address">${escapeHtml(candidate.address)}</p>
      <div class="linkGrid">${links}</div>
      <dl class="candidateMeta">
        <div><dt>評価 / 口コミ</dt><dd>${candidate.rating ? `${candidate.rating} / ${candidate.reviewCount}件` : "確認中"}</dd></div>
        <div><dt>営業時間</dt><dd>${escapeHtml(candidate.hours)}</dd></div>
        <div><dt>placeId</dt><dd>${escapeHtml(candidate.placeId || "確認中")}</dd></div>
        <div><dt>ジャンル推定</dt><dd>${escapeHtml(candidate.genreGuess)}</dd></div>
        <div><dt>タグ候補</dt><dd>${candidate.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</dd></div>
        <div><dt>メニュー要約</dt><dd>${menuSummary || "確認中"}</dd></div>
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
      ${
        decision === "採用"
          ? `<details class="draftJson" open>
              <summary>spots.json 下書き</summary>
              <pre>${escapeHtml(draftJson)}</pre>
            </details>`
          : ""
      }
    </article>
  `;
}

function renderDecisionButton(id, decision, label) {
  const active = decision === label ? " active" : "";
  return `<button class="decisionButton${active}" type="button" data-decision="${escapeHtml(label)}" data-id="${escapeHtml(id)}">${escapeHtml(label)}</button>`;
}

function render() {
  const root = document.getElementById("studio-root");
  const activeResultIds = new Set(state.results.map((candidate) => candidate.id));
  const activeDecisions = Object.entries(state.decisions)
    .filter(([id]) => activeResultIds.has(id))
    .map(([, value]) => value);
  const adopted = activeDecisions.filter((value) => value === "採用").length;
  const pending = activeDecisions.filter((value) => value === "保留").length;
  const rejected = activeDecisions.filter((value) => value === "不採用").length;
  const headline = state.mode === "maps" ? "Google Maps URL" : `${state.area} × ${state.genre}`;
  const searchMetaText = state.searchMeta
    ? `${state.searchMeta.returnedCount || 0}件取得 / 登録済み${state.searchMeta.registeredExcluded || 0}件除外 / エリア外${state.searchMeta.areaExcluded || 0}件除外`
    : "";

  root.innerHTML = `
    <div class="studioShell">
      <header class="studioHeader">
        <p class="eyebrow">SIP Studio</p>
        <h1>Research</h1>
        <p class="lead">Google Maps URL 1本、またはエリア × ジャンルから、SIP Tokyo登録候補を半自動生成する管理画面。</p>
      </header>

      <section class="searchBoard" aria-label="検索条件">
        <label class="wideField">
          <span>Google Maps URL または店名URL</span>
          <input id="mapsUrlInput" value="${escapeHtml(state.mapsUrl)}" placeholder="https://www.google.com/maps/place/..." />
        </label>
        <button id="mapsResearchButton" type="button">${state.isLookupLoading ? "取得中..." : "URLから生成"}</button>
        <label>
          <span>エリア</span>
          <select id="areaSelect">${renderOptions(areaOptions, state.area)}</select>
        </label>
        <label>
          <span>ジャンル</span>
          <select id="genreSelect">${renderOptions(genreOptions, state.genre)}</select>
        </label>
        <button id="researchButton" type="button">${state.isSearchLoading ? "検索中..." : "20件リサーチ"}</button>
      </section>

      <section class="criteriaPanel" aria-label="掲載基準">
        <div>
          <p>将来API接続</p>
          <span>Google Places / Serp / Instagram / メニュー解析の結果を、同じ候補データ構造に流し込める前提で設計。</span>
        </div>
        <div>
          <p>掲載基準</p>
          <span>お茶が主役 / 座って過ごせる / イートインあり / 一杯と時間を過ごしたくなる空間</span>
        </div>
      </section>

      <section class="resultHeader">
        <div>
          <p>${escapeHtml(headline)}</p>
          <h2>${state.results.length} candidates</h2>
          ${searchMetaText ? `<span class="searchMeta">${escapeHtml(searchMetaText)}</span>` : ""}
        </div>
        <div class="decisionStats">
          <span>採用 ${adopted}</span>
          <span>保留 ${pending}</span>
          <span>不採用 ${rejected}</span>
        </div>
      </section>

      <main class="candidateList">
        ${
          state.isSearchLoading
            ? `<div class="emptyState">Google Placesから実在候補を検索しています。</div>`
            : state.isLookupLoading
            ? `<div class="emptyState">Google Maps URLから店舗情報を取得しています。</div>`
            : state.searchError
              ? `<div class="emptyState">${escapeHtml(state.searchError)}</div>`
            : state.results.length
              ? state.results.map(renderCandidate).join("")
              : `<div class="emptyState">Google Maps URLを入力するか、エリア × ジャンルで検索してください。</div>`
        }
      </main>
      ${renderAdoptedJsonSection()}
    </div>
  `;
}

document.addEventListener("input", (event) => {
  if (event.target.id === "mapsUrlInput") {
    state.mapsUrl = event.target.value;
  }
});

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
    void generateQueryResults();
    return;
  }

  if (event.target.id === "mapsResearchButton") {
    void generateMapsResult();
    return;
  }

  if (event.target.matches(".decisionButton")) {
    const id = event.target.dataset.id;
    const decision = event.target.dataset.decision;
    state.decisions[id] = state.decisions[id] === decision ? "" : decision;
    state.copyStatus = "";
    saveDecisions();
    render();
  }

  if (event.target.matches("[data-copy-adopted-json]")) {
    void copyAdoptedJson();
  }
});

async function copyAdoptedJson() {
  const json = getAdoptedDraftJson();
  if (!getAdoptedCandidates().length) return;

  try {
    if (window.navigator?.clipboard?.writeText) {
      await window.navigator.clipboard.writeText(json);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = json;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }

    state.copyStatus = "コピー済み";
  } catch {
    state.copyStatus = "コピー失敗";
  }

  render();
  window.setTimeout(() => {
    state.copyStatus = "";
    render();
  }, 1600);
}

generateQueryResults();
