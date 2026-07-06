import { scoreAxes, getScoringProvider, screenPlace } from "./studio-scoring.js";

const scoringProvider = getScoringProvider("rules");
const hiddenUserTags = new Set(["お茶候補"]);

const stationAreas = {
  "渋谷区": ["渋谷", "恵比寿", "代々木上原", "原宿", "代官山", "広尾", "神泉", "笹塚"],
  "世田谷区": ["三軒茶屋", "下北沢", "二子玉川", "経堂", "豪徳寺", "駒沢大学", "千歳烏山", "成城学園前"],
  "目黒区": ["中目黒", "自由が丘", "学芸大学", "祐天寺", "都立大学", "目黒", "洗足"],
  "台東区": ["浅草", "蔵前", "上野", "谷中", "御徒町", "田原町", "入谷"],
  "中央区": ["銀座", "日本橋", "人形町", "築地", "東銀座", "三越前", "茅場町"],
  "港区": ["表参道", "青山一丁目", "六本木", "麻布十番", "赤坂", "新橋", "白金台", "品川"],
  "新宿区": ["新宿", "神楽坂", "高田馬場", "四ツ谷", "早稲田", "新宿三丁目", "飯田橋"],
  "千代田区": ["東京", "日比谷", "有楽町", "神保町", "御茶ノ水", "秋葉原", "永田町"],
  "文京区": ["根津", "千駄木", "本郷三丁目", "後楽園", "茗荷谷", "護国寺"],
  "墨田区": ["押上", "とうきょうスカイツリー", "本所吾妻橋", "錦糸町", "両国", "曳舟"],
  "江東区": ["清澄白河", "門前仲町", "豊洲", "亀戸", "木場", "森下"],
  "品川区": ["目黒", "五反田", "大井町", "戸越銀座", "武蔵小山", "天王洲アイル"],
  "大田区": ["蒲田", "大森", "田園調布", "池上", "洗足池", "羽田空港"],
  "中野区": ["中野", "東中野", "中野坂上", "新井薬師前", "鷺ノ宮"],
  "杉並区": ["荻窪", "西荻窪", "高円寺", "阿佐ヶ谷", "永福町", "浜田山"],
  "豊島区": ["池袋", "目白", "巣鴨", "大塚", "駒込", "雑司が谷"],
  "北区": ["赤羽", "王子", "田端", "十条", "駒込"],
  "荒川区": ["日暮里", "西日暮里", "町屋", "南千住", "三河島"],
  "板橋区": ["板橋", "大山", "成増", "ときわ台", "志村坂上"],
  "練馬区": ["練馬", "江古田", "石神井公園", "大泉学園", "光が丘"],
  "足立区": ["北千住", "綾瀬", "西新井", "竹ノ塚", "梅島"],
  "葛飾区": ["亀有", "金町", "新小岩", "青砥", "柴又"],
  "江戸川区": ["葛西", "西葛西", "小岩", "船堀", "瑞江", "篠崎"],
};
const wardOptions = Object.keys(stationAreas);
const genreOptions = ["抹茶", "日本茶", "ハーブティー", "チャイ", "お茶", "中国茶", "和菓子", "薬膳茶"];
const decisionsStorageKey = "sipStudioDecisions";
const rejectedStorageKey = "sipStudioRejectedCandidates";

const state = {
  mode: "query",
  ward: "目黒区",
  station: "自由が丘",
  area: "自由が丘",
  genre: "抹茶",
  mapsUrl: "",
  results: [],
  decisions: readDecisions(),
  rejectedCandidates: readRejectedCandidates(),
  rejectedExcludedCount: 0,
  screenExcludedCount: 0,
  screenExcludedReasons: [],
  isLookupLoading: false,
  isSearchLoading: false,
  searchError: "",
  searchMeta: null,
  copyStatus: "",
};

function readDecisions() {
  try {
    return JSON.parse(localStorage.getItem(decisionsStorageKey) || "{}");
  } catch {
    return {};
  }
}

function saveDecisions() {
  localStorage.setItem(decisionsStorageKey, JSON.stringify(state.decisions));
}

function readRejectedCandidates() {
  try {
    const stored = JSON.parse(localStorage.getItem(rejectedStorageKey) || "[]");
    return Array.isArray(stored) ? stored.filter((item) => item?.key) : [];
  } catch {
    return [];
  }
}

function saveRejectedCandidates() {
  localStorage.setItem(rejectedStorageKey, JSON.stringify(state.rejectedCandidates));
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

function cleanUserLabel(value) {
  if (!value) return "";

  return String(value)
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part && !hiddenUserTags.has(part))
    .join(" / ");
}

function cleanUserTags(tags) {
  return Array.isArray(tags) ? unique(tags.map(cleanUserLabel).filter((tag) => tag && !hiddenUserTags.has(tag))) : [];
}

function normalizeIdentityText(value) {
  return String(value || "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function getCandidateIdentity(candidate) {
  const placeId = normalizeIdentityText(candidate.placeId);
  if (placeId) return `place:${placeId}`;

  const name = normalizeIdentityText(candidate.name);
  const address = normalizeIdentityText(candidate.address);
  return `name-address:${name}|${address}`;
}

function isRejectedCandidate(candidate) {
  const identity = getCandidateIdentity(candidate);
  return state.decisions[candidate.id] === "不採用" || state.rejectedCandidates.some((item) => item.key === identity);
}

function addRejectedCandidate(candidate) {
  const key = getCandidateIdentity(candidate);
  if (!key || state.rejectedCandidates.some((item) => item.key === key)) return;

  state.rejectedCandidates = [
    ...state.rejectedCandidates,
    {
      key,
      placeId: candidate.placeId || "",
      name: candidate.name || "",
      address: candidate.address || "",
      source: candidate.source?.provider || "",
      rejectedAt: new Date().toISOString(),
    },
  ];
  saveRejectedCandidates();
}

function filterRejectedCandidates(candidates) {
  const filtered = candidates.filter((candidate) => !isRejectedCandidate(candidate));
  state.rejectedExcludedCount = candidates.length - filtered.length;
  return filtered;
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

function getStationOptions(ward = state.ward) {
  return stationAreas[ward] || [];
}

function getResearchArea() {
  return state.station || getStationOptions()[0] || state.ward || state.area;
}

function getResearchQueryLabel() {
  return [state.ward, state.station].filter(Boolean).join(" ") || getResearchArea();
}

async function searchPlaces(area, genre) {
  try {
    const params = new URLSearchParams({
      area,
      genre,
      ward: state.ward || "",
      station: state.station || "",
    });
    const url = `/api/places-search?${params.toString()}`;
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
  return cleanUserTags([candidate.genreQuery, ...inferred, "一人時間"]).slice(0, 6);
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

function scoringAxisValue(scoring, key) {
  const axis = (scoring?.axes || []).find((item) => item.key === key);
  return axis && axis.value !== null ? axis.value : 0;
}

function buildCommentDraft(candidate) {
  const tags = candidate.tags || [];
  const genre = candidate.genreQuery || "";
  const scoring = candidate.scoring || null;
  const sourceText = [candidate.name, candidate.area, genre, ...tags].join("|");
  const seed = Number.parseInt(hashString(sourceText).slice(0, 6), 36) || 0;
  const has = (tag) => tags.includes(tag);
  const highWorldview = scoringAxisValue(scoring, "worldview") >= 6;
  const highQuiet = scoringAxisValue(scoring, "talkQuietFit") >= 8;
  const highSpace = scoringAxisValue(scoring, "spaceComfort") >= 12;
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

// 候補データの組み立て。判断材料のない項目は空のまま持ち、UI側で「確認中」等と正直に表示する。
// 表示順（index）やその場しのぎのダミー値からデータを作ることは絶対にしない。
function buildCandidate(area, genre, overrides = {}) {
  const name = overrides.name || `${area} ${genre}候補`;
  const mapsUrl = overrides.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${area} ${genre} カフェ`)}`;
  const resolvedTags = cleanUserTags(overrides.tags || [genre]);
  const scoring = overrides.scoring || null;

  return {
    id: overrides.id || `${slug(area)}-${slug(genre)}-${hashString(name)}`,
    source: {
      provider: overrides.sourceProvider || "unknown",
      mode: overrides.sourceMode || "query",
      input: overrides.sourceInput || `${area} × ${genre}`,
      fetchedAt: new Date().toISOString(),
    },
    placeId: overrides.placeId || "",
    name,
    area,
    genreQuery: genre,
    address: overrides.address || "",
    mapsUrl,
    officialUrl: overrides.officialUrl || "",
    instagramUrl: overrides.instagramUrl || "",
    menuUrl: overrides.menuUrl || "",
    reviewCount: overrides.reviewCount ?? null,
    rating: overrides.rating ?? null,
    reviews: overrides.reviews || [],
    hours: overrides.hours || "",
    photoUrl: overrides.photoUrl || "",
    photoLabel: overrides.photoLabel || "photo pending",
    genreGuess: cleanUserLabel(overrides.genreGuess || genre),
    tags: resolvedTags,
    scoring,
    commentDraft: overrides.commentDraft || buildCommentDraft({ name, area, genreQuery: genre, tags: resolvedTags, scoring }),
    memoDraft: overrides.memoDraft || buildMemoDraft({ tags: resolvedTags }),
    menuSummary: overrides.menuSummary || [],
    priceRange: overrides.priceRange || "",
    riskFlags: overrides.riskFlags || [],
  };
}

async function buildCandidateFromPlace(place, area, genre) {
  const tags = inferTeaTags({ ...place, genreQuery: genre });
  const scoring = await scoringProvider.score({
    name: place.name,
    genreQuery: genre,
    rating: place.rating,
    reviewCount: place.reviewCount,
    reviews: place.reviews || [],
    types: place.types || [],
    primaryType: place.primaryType || "",
  });

  return buildCandidate(area, genre, {
    id: `place-${place.placeId || idSlugFromName(place.name)}`,
    name: place.name || `${area} ${genre}候補`,
    address: place.address || "",
    mapsUrl: place.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name || `${area} ${genre}`)}`,
    officialUrl: place.officialUrl || "",
    instagramUrl: place.instagramUrl || "",
    menuUrl: place.menuUrl || "",
    reviewCount: place.reviewCount || null,
    rating: place.rating || null,
    reviews: place.reviews || [],
    photoUrl: place.photoUrl || "",
    photoLabel: "Google Places",
    genreGuess: genre,
    tags,
    scoring,
    commentDraft: buildCommentDraft({ ...place, genreQuery: genre, tags, scoring }),
    memoDraft: buildMemoDraft({ ...place, tags }),
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
  state.rejectedExcludedCount = 0;
  state.screenExcludedCount = 0;
  state.screenExcludedReasons = [];
  state.copyStatus = "";
  render();

  const researchArea = getResearchArea();
  state.area = researchArea;
  const data = await searchPlaces(researchArea, state.genre);
  state.isSearchLoading = false;
  state.searchMeta = data.meta || null;

  if (Array.isArray(data.places) && data.places.length) {
    // 掲載基準スクリーニング：紅茶メイン / 販売のみ（喫茶なし）の候補を除外
    const screenedPlaces = [];
    const screenReasons = [];
    for (const place of data.places.slice(0, 20)) {
      const screening = screenPlace(place);
      if (screening.excluded) {
        screenReasons.push(...screening.reasons);
      } else {
        screenedPlaces.push(place);
      }
    }
    state.screenExcludedCount = screenReasons.length ? data.places.slice(0, 20).length - screenedPlaces.length : 0;
    state.screenExcludedReasons = screenReasons;

    const candidates = await Promise.all(
      screenedPlaces.map((place) => buildCandidateFromPlace(place, researchArea, state.genre)),
    );
    state.results = filterRejectedCandidates(candidates);
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
  state.rejectedExcludedCount = 0;
  state.screenExcludedCount = 0;
  state.screenExcludedReasons = [];
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
  const researchArea = getResearchArea();
  state.area = researchArea;
  const autoTags = inferTeaTags({
    name: placeData.name,
    address,
    description: placeData.description,
    genreQuery: state.genre,
  });
  const memoDraft = buildMemoDraft({ tags: autoTags });

  state.mode = "maps";
  state.isLookupLoading = false;
  // URL由来の候補は口コミ本文が取れないため、採点は全軸「データ不足」・確信度「低」になる
  const scoring = await scoringProvider.score({
    name: placeData.name,
    genreQuery: state.genre,
    rating: null,
    reviewCount: null,
    reviews: [],
    types: [],
    primaryType: "",
  });
  const candidate = buildCandidate(researchArea, state.genre, {
      id: `maps-${slug(placeData.name) || Date.now()}`,
      name: placeData.name,
      address,
      mapsUrl: placeData.mapsUrl,
      officialUrl: placeData.officialUrl || "",
      instagramUrl: placeData.instagramUrl || "",
      menuUrl: placeData.menuUrl || "",
      reviewCount: null,
      rating: null,
      photoUrl: placeData.photoUrl || "",
      sourceProvider: "google-maps-url",
      sourceMode: "mapsUrl",
      sourceInput: mapsUrl,
      photoLabel: "Google Maps URL",
      tags: autoTags,
      genreGuess: state.genre,
      scoring,
      memoDraft,
      riskFlags: unique([
        "URL由来",
        placeData.address ? "住所候補あり" : "住所はMapsで確認",
        placeData.officialUrl || placeData.instagramUrl || placeData.menuUrl ? "外部リンク候補あり" : "公式情報要確認",
      ]),
    });
  state.results = filterRejectedCandidates([candidate]);
  render();
}

function renderOptions(options, activeValue) {
  return options
    .map((option) => `<option value="${escapeHtml(option)}"${option === activeValue ? " selected" : ""}>${escapeHtml(option)}</option>`)
    .join("");
}

function renderScoreEvidence(evidence) {
  if (!evidence.length) return "";

  const chips = evidence
    .map(
      (item) =>
        `<span class="evidenceChip ${item.direction === "-" ? "isNegative" : ""}">${escapeHtml(item.keyword)}×${item.count}${item.direction === "-" ? "（−）" : ""}</span>`,
    )
    .join("");

  return `<div class="evidenceList" aria-label="採点根拠">${chips}</div>`;
}

function renderScoring(candidate) {
  const scoring = candidate.scoring;

  if (!scoring) {
    return `<p class="scoringNote">採点データがありません。</p>`;
  }

  const axisLines = scoring.axes
    .map((axis) => {
      if (axis.value === null) {
        return `
          <div class="scoreLine isInsufficient">
            <div>
              <span>${escapeHtml(axis.label)}</span>
              <strong>−（データ不足）</strong>
            </div>
          </div>
        `;
      }

      const percent = Math.round((axis.value / axis.max) * 100);
      return `
        <div class="scoreLine">
          <div>
            <span>${escapeHtml(axis.label)}</span>
            <strong>${axis.value}/${axis.max}</strong>
          </div>
          <i style="--score:${percent}%"></i>
          ${renderScoreEvidence(axis.evidence || [])}
        </div>
      `;
    })
    .join("");

  return `
    ${axisLines}
    <p class="scoringNote">採点方式：ルールベース（口コミ${scoring.reviewCount}件のキーワード解析） / 確信度：${escapeHtml(scoring.confidence)}</p>
  `;
}

function renderScoreBadge(candidate) {
  const scoring = candidate.scoring;

  if (!scoring || scoring.scoredCount === 0) {
    return `<span class="scoreBadge isUnscored">採点不可（データ不足）</span>`;
  }

  const partial = scoring.scoredCount < scoring.axes.length ? `（${scoring.scoredCount}/${scoring.axes.length}軸）` : "";
  return `<span class="scoreBadge">${scoring.total} / ${scoring.totalMax}${partial}</span>`;
}

function buildDraftSpot(candidate) {
  const type = cleanUserLabel(candidate.genreGuess || candidate.genreQuery || "");
  const mapUrl = candidate.mapsUrl || "";
  const tags = cleanUserTags(candidate.tags);

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
    tags,
    comment: candidate.commentDraft || buildCommentDraft(candidate),
    mapUrl,
    mapsUrl: mapUrl,
    officialUrl: candidate.officialUrl || "",
    instagramUrl: candidate.instagramUrl || "",
    menuUrl: candidate.menuUrl || "",
    menuSummary: candidate.menuSummary,
    priceRange: candidate.priceRange || "",
    note: candidate.memoDraft,
    searchTags: cleanUserTags([candidate.area, candidate.genreQuery, candidate.name]),
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
  const riskFlags = cleanUserTags(candidate.riskFlags).map((flag) => `<span>${escapeHtml(flag)}</span>`).join("");
  const menuSummary = candidate.menuSummary.map((item) => `<span>${escapeHtml(item)}</span>`).join("");
  const draftJson = JSON.stringify(buildDraftSpot(candidate), null, 2);
  const genreGuess = cleanUserLabel(candidate.genreGuess);
  const tags = cleanUserTags(candidate.tags);

  const needsFieldCheck = candidate.scoring?.needsFieldCheck;

  return `
    <article class="candidateCard">
      <div class="cardTop">
        <span class="resultIndex">${String(index + 1).padStart(2, "0")}</span>
        <div class="badgeGroup">
          ${needsFieldCheck ? `<span class="fieldCheckBadge">要現地確認</span>` : ""}
          ${renderScoreBadge(candidate)}
        </div>
      </div>
      ${candidate.photoUrl ? `<img class="candidatePhoto" src="${escapeHtml(candidate.photoUrl)}" alt="${escapeHtml(candidate.name)}の写真" />` : `<div class="candidatePhoto emptyPhoto">${escapeHtml(candidate.photoLabel)}</div>`}
      <h2>${escapeHtml(candidate.name)}</h2>
      <p class="address">${escapeHtml(candidate.address)}</p>
      <div class="linkGrid">${links}</div>
      <dl class="candidateMeta">
        <div><dt>評価 / 口コミ</dt><dd>${candidate.rating ? `${candidate.rating} / ${candidate.reviewCount}件` : "確認中"}</dd></div>
        <div><dt>営業時間</dt><dd>${escapeHtml(candidate.hours || "確認中")}</dd></div>
        <div><dt>placeId</dt><dd>${escapeHtml(candidate.placeId || "確認中")}</dd></div>
        <div><dt>ジャンル推定</dt><dd>${escapeHtml(genreGuess)}</dd></div>
        <div><dt>タグ候補</dt><dd>${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</dd></div>
        <div><dt>メニュー要約</dt><dd>${menuSummary || "確認中"}</dd></div>
      </dl>
      <section class="scorePanel" aria-label="SIPスコア内訳">
        ${renderScoring(candidate)}
      </section>
      ${riskFlags ? `<div class="riskFlags">${riskFlags}</div>` : ""}
      <div class="memoBox">
        <p>SIPメモ草案（仮・定型文）</p>
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
  const rejected = state.rejectedCandidates.length;
  const headline = state.mode === "maps" ? "Google Maps URL" : `${getResearchQueryLabel()} × ${state.genre}`;
  const screenReasonSummary = state.screenExcludedCount
    ? `対象外${state.screenExcludedCount}件除外（${[...new Set(state.screenExcludedReasons)].join("・")}）`
    : "";
  const searchMetaText = state.searchMeta
    ? [
        `${state.searchMeta.returnedCount || 0}件取得`,
        `登録済み${state.searchMeta.registeredExcluded || 0}件除外`,
        `エリア外${state.searchMeta.areaExcluded || 0}件除外`,
        `不採用済み${state.rejectedExcludedCount || 0}件除外`,
        screenReasonSummary,
      ]
        .filter(Boolean)
        .join(" / ")
    : [state.rejectedExcludedCount ? `不採用済み${state.rejectedExcludedCount}件除外` : "", screenReasonSummary].filter(Boolean).join(" / ");

  root.innerHTML = `
    <div class="studioShell">
      <header class="studioHeader">
        <p class="eyebrow">SIP Studio</p>
        <h1>Research</h1>
        <p class="lead">Google Maps URL 1本、または区 × 駅 × ジャンルから、SIP Tokyo登録候補を半自動生成する管理画面。</p>
      </header>

      <section class="searchBoard" aria-label="検索条件">
        <label class="wideField">
          <span>Google Maps URL または店名URL</span>
          <input id="mapsUrlInput" value="${escapeHtml(state.mapsUrl)}" placeholder="https://www.google.com/maps/place/..." />
        </label>
        <button id="mapsResearchButton" type="button">${state.isLookupLoading ? "取得中..." : "URLから生成"}</button>
        <label>
          <span>区</span>
          <select id="wardSelect">${renderOptions(wardOptions, state.ward)}</select>
        </label>
        <label>
          <span>駅</span>
          <select id="stationSelect">${renderOptions(getStationOptions(), state.station)}</select>
        </label>
        <label>
          <span>ジャンル</span>
          <select id="genreSelect">${renderOptions(genreOptions, state.genre)}</select>
        </label>
        <button id="researchButton" type="button">${state.isSearchLoading ? "検索中..." : "20件リサーチ"}</button>
      </section>

      <section class="criteriaPanel" aria-label="掲載基準">
        <div>
          <p>採点方式</p>
          <span>ルールベース（Google Places口コミ最大5件のキーワード解析）。採点プロバイダは分離済みで、同じ候補データ構造のままAI採点（Anthropic API）へ差し替え可能。</span>
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
          <span>不採用済み ${rejected}</span>
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
              : state.rejectedExcludedCount
                ? `<div class="emptyState">不採用済み候補を${state.rejectedExcludedCount}件除外しました。別の条件で検索してください。</div>`
                : `<div class="emptyState">Google Maps URLを入力するか、区 × 駅 × ジャンルで検索してください。</div>`
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
  if (event.target.id === "wardSelect") {
    state.ward = event.target.value;
    state.station = getStationOptions(state.ward)[0] || "";
    state.area = getResearchArea();
    render();
    return;
  }

  if (event.target.id === "stationSelect") {
    state.station = event.target.value;
    state.area = getResearchArea();
    render();
    return;
  }

  if (event.target.id === "genreSelect") {
    state.genre = event.target.value;
    render();
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
    const candidate = state.results.find((item) => item.id === id);

    if (decision === "不採用" && candidate) {
      addRejectedCandidate(candidate);
      delete state.decisions[id];
      state.results = state.results.filter((item) => item.id !== id);
      state.rejectedExcludedCount += 1;
      state.copyStatus = "";
      saveDecisions();
      render();
      return;
    }

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
