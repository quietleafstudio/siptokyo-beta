// SIP Studio 採点エンジン
//
// 採点は「プロバイダ」として分離されており、studio.js はこのモジュールの
// 入出力契約だけに依存する。将来 Anthropic API 等のAI採点に差し替える場合は、
// 同じ score(input) -> ScoringResult を実装したプロバイダを providers に追加し、
// getScoringProvider("anthropic") のように切り替えるだけでよい。
//
// input: {
//   name, genreQuery, rating, reviewCount,
//   reviews: [{ text, rating, when }],   // Google Places 口コミ（最大5件）
//   types, primaryType,
// }
// ScoringResult: {
//   provider,            // 採点方式のID
//   confidence,          // "高" | "中" | "低"
//   needsFieldCheck,     // true = 要現地確認（口コミ3件未満）
//   reviewCount,         // 採点に使った口コミ件数
//   axes: [{ key, label, max, value, evidence }],
//                        // value: 0〜max の整数。null = データ不足（採点しない）
//                        // evidence: [{ keyword, count, direction: "+" | "-" }]
//   total, totalMax,     // 採点できた軸のみの合計と満点
//   scoredCount,         // 採点できた軸の数
// }

export const scoreAxes = [
  { key: "teaTaste", label: "お茶のおいしさ", max: 25 },
  { key: "teaFocus", label: "お茶主役度", max: 20 },
  { key: "spaceComfort", label: "空間の心地よさ", max: 15 },
  { key: "seatComfort", label: "座って過ごせる度", max: 10 },
  { key: "talkQuietFit", label: "静けさ適性", max: 10 },
  { key: "menuDepth", label: "メニュー充実度", max: 8 },
  { key: "worldview", label: "世界観", max: 7 },
  { key: "access", label: "アクセス", max: 5 },
];

const teaWords = ["抹茶", "日本茶", "煎茶", "ほうじ茶", "玉露", "緑茶", "中国茶", "台湾茶", "烏龍", "紅茶", "ハーブティー", "薬膳茶", "チャイ", "お茶"];
const dessertWords = ["ソフトクリーム", "パフェ", "かき氷", "ケーキ", "スイーツ目当て", "アイス"];

// 軸ごとのキーワードルール。positive/negative は口コミ本文へのマッチで加減点する
const axisRules = {
  teaTaste: {
    positive: ["お茶が美味", "お茶がおいし", "抹茶が濃", "香りが良", "香りがい", "風味", "本格的", "丁寧に淹れ", "淹れたて", "美味しいお茶", "お茶の味"],
    negative: ["薄い", "ぬるい", "味が微妙", "残念な味"],
  },
  // teaFocus は「言及率」ベースの特別ルール（下の scoreTeaFocus）
  spaceComfort: {
    positive: ["居心地", "落ち着い", "落ち着く", "雰囲気が良", "雰囲気がい", "素敵な空間", "癒され", "きれいな店内", "清潔", "おしゃれ", "内装"],
    negative: ["狭い", "せまい", "窮屈", "汚い", "居心地が悪"],
  },
  seatComfort: {
    positive: ["座敷", "ソファ", "カウンター席", "座って", "ゆったり座", "席が広", "イートイン", "店内で飲", "店内飲食"],
    negative: ["テイクアウト専門", "持ち帰りのみ", "立ち飲み", "座る場所がない", "席がない", "スタンド", "テイクアウト"],
  },
  talkQuietFit: {
    positive: ["静か", "落ち着く", "落ち着い", "ゆっくり", "ゆったり", "長居", "のんびり", "穴場", "隠れ家"],
    negative: ["行列", "混雑", "混んで", "うるさい", "騒がし", "回転", "待ち時間", "並ん"],
  },
  menuDepth: {
    positive: ["メニューが豊富", "種類が豊富", "品揃え", "選べる", "飲み比べ", "季節限定", "メニューが多"],
    negative: ["メニューが少な", "種類が少な"],
  },
  worldview: {
    positive: ["世界観", "趣", "風情", "こだわり", "洗練", "上品", "和の雰囲気", "非日常", "コンセプト"],
    negative: [],
  },
  access: {
    positive: ["駅近", "駅から近", "駅チカ", "アクセスが良", "アクセスがい", "すぐ近く", "便利な立地"],
    negative: ["駅から遠", "分かりにくい", "わかりにくい", "迷い"],
  },
};

function countMatches(reviews, keyword) {
  return reviews.filter((review) => review.text.includes(keyword)).length;
}

function collectEvidence(reviews, keywords, direction) {
  return keywords
    .map((keyword) => ({ keyword, count: countMatches(reviews, keyword), direction }))
    .filter((item) => item.count > 0);
}

// 汎用軸：positive/negative キーワードの出現バランスで採点。
// 1件だけのマッチで満点/零点に振れないよう、マッチ量に応じて振れ幅を弱める。
function scoreByKeywords(axis, reviews) {
  const rules = axisRules[axis.key];
  const positives = collectEvidence(reviews, rules.positive, "+");
  const negatives = collectEvidence(reviews, rules.negative, "-");
  const positiveHits = positives.reduce((sum, item) => sum + item.count, 0);
  const negativeHits = negatives.reduce((sum, item) => sum + item.count, 0);
  const totalHits = positiveHits + negativeHits;

  if (totalHits === 0) {
    return { value: null, evidence: [] };
  }

  const ratio = (positiveHits - negativeHits) / totalHits;
  const strength = Math.min(1, totalHits / 4);
  const value = Math.round(axis.max * (0.5 + 0.45 * ratio * strength));

  return {
    value: Math.max(0, Math.min(axis.max, value)),
    evidence: [...positives, ...negatives],
  };
}

// お茶主役度：口コミのうち「お茶関連語に言及している割合」で採点し、
// デザート語が主話題（お茶より言及が多い）なら減点する。
function scoreTeaFocus(axis, reviews) {
  if (!reviews.length) {
    return { value: null, evidence: [] };
  }

  const teaEvidence = collectEvidence(reviews, teaWords, "+");
  const dessertEvidence = collectEvidence(reviews, dessertWords, "-");
  const teaReviewCount = reviews.filter((review) => teaWords.some((word) => review.text.includes(word))).length;
  const dessertReviewCount = reviews.filter((review) => dessertWords.some((word) => review.text.includes(word))).length;

  if (teaReviewCount === 0 && dessertReviewCount === 0) {
    return { value: null, evidence: [] };
  }

  const mentionRate = teaReviewCount / reviews.length;
  const dessertPenalty = dessertReviewCount > teaReviewCount ? Math.round(axis.max * 0.25) : 0;
  const value = Math.max(0, Math.min(axis.max, Math.round(axis.max * mentionRate) - dessertPenalty));

  return { value, evidence: [...teaEvidence, ...dessertEvidence] };
}

function confidenceFor(reviewCount) {
  if (reviewCount >= 5) return "高";
  if (reviewCount >= 3) return "中";
  return "低";
}

// ルールベース採点プロバイダ（無料・AI不使用）
async function scoreWithRules(input) {
  const reviews = (input.reviews || []).filter((review) => review?.text);

  const axes = scoreAxes.map((axis) => {
    const result = axis.key === "teaFocus" ? scoreTeaFocus(axis, reviews) : scoreByKeywords(axis, reviews);
    return { ...axis, value: result.value, evidence: result.evidence };
  });

  const scoredAxes = axes.filter((axis) => axis.value !== null);

  return {
    provider: "rules",
    confidence: confidenceFor(reviews.length),
    needsFieldCheck: reviews.length < 3,
    reviewCount: reviews.length,
    axes,
    total: scoredAxes.reduce((sum, axis) => sum + axis.value, 0),
    totalMax: scoredAxes.reduce((sum, axis) => sum + axis.max, 0),
    scoredCount: scoredAxes.length,
  };
}

// ---- 掲載対象スクリーニング ----
// SIPの掲載基準（お茶が主役 / 座って過ごせる / イートインあり）に明らかに
// 合わない候補を検索結果から除外する。確度の高いシグナルのみで判定し、
// 除外件数はUI側で表示して誤除外に気づけるようにする。

// 「和紅茶」は日本茶文脈なので除外対象の「紅茶」には数えない
const blackTeaPattern = /(?<!和)紅茶/;
const nonBlackTeaWords = ["抹茶", "日本茶", "煎茶", "ほうじ茶", "玉露", "緑茶", "中国茶", "台湾茶", "烏龍", "ハーブ", "チャイ", "薬膳", "和紅茶"];

const eatInTypes = new Set([
  "cafe",
  "coffee_shop",
  "tea_house",
  "restaurant",
  "japanese_restaurant",
  "dessert_shop",
  "dessert_restaurant",
  "bakery",
  "confectionery",
]);
const retailTypes = new Set([
  "store",
  "food_store",
  "grocery_store",
  "gift_shop",
  "supermarket",
  "market",
  "shopping_mall",
  "home_goods_store",
]);
const eatInReviewWords = ["店内", "イートイン", "席", "座っ", "座敷", "カウンター", "テーブル", "カフェ", "喫茶", "いただきました", "飲みました"];

export function screenPlace(input) {
  const name = input.name || "";
  const reviews = (input.reviews || []).filter((review) => review?.text);
  const types = [input.primaryType, ...(input.types || [])].filter(Boolean).map((type) => String(type).toLowerCase());
  const reasons = [];

  // 1) 紅茶メインの店：店名に「紅茶」、または口コミで紅茶が他のお茶より優勢
  const blackTeaReviewCount = reviews.filter((review) => blackTeaPattern.test(review.text)).length;
  const otherTeaReviewCount = reviews.filter((review) => nonBlackTeaWords.some((word) => review.text.includes(word))).length;
  if (blackTeaPattern.test(name) || (blackTeaReviewCount >= 2 && blackTeaReviewCount > otherTeaReviewCount)) {
    reasons.push("紅茶メイン");
  }

  // 2) 販売のみ（喫茶なし）：物販系typeのみで、口コミにも店内飲食の形跡がない
  const hasEatInType = types.some((type) => eatInTypes.has(type));
  const hasRetailType = types.some((type) => retailTypes.has(type));
  const eatInReviewCount = reviews.filter((review) => eatInReviewWords.some((word) => review.text.includes(word))).length;
  if (name.includes("販売") || (hasRetailType && !hasEatInType && eatInReviewCount === 0)) {
    reasons.push("販売のみ（喫茶なし）");
  }

  return { excluded: reasons.length > 0, reasons };
}

export const providers = {
  rules: {
    id: "rules",
    label: "ルールベース（口コミキーワード解析）",
    score: scoreWithRules,
  },
  // 将来のAI採点はここに追加する（同じ入出力契約を実装すること）:
  // anthropic: { id: "anthropic", label: "AI採点（Anthropic API）", score: scoreWithAnthropic },
};

export function getScoringProvider(name = "rules") {
  return providers[name] || providers.rules;
}
