import { readFile } from "node:fs/promises";
import { join } from "node:path";

const areaCenters = {
  自由が丘: { latitude: 35.6074, longitude: 139.6686 },
  新宿: { latitude: 35.6896, longitude: 139.7006 },
  表参道: { latitude: 35.6652, longitude: 139.7123 },
  浅草: { latitude: 35.7148, longitude: 139.7967 },
  渋谷: { latitude: 35.658, longitude: 139.7016 },
  三軒茶屋: { latitude: 35.6435, longitude: 139.6715 },
  銀座: { latitude: 35.6719, longitude: 139.765 },
  代々木上原: { latitude: 35.669, longitude: 139.6801 },
  東京: { latitude: 35.6812, longitude: 139.7671 },
};


const stationCenters = {
  渋谷: { latitude: 35.658, longitude: 139.7016 },
  恵比寿: { latitude: 35.6467, longitude: 139.7101 },
  代々木上原: { latitude: 35.669, longitude: 139.6801 },
  原宿: { latitude: 35.6702, longitude: 139.7027 },
  代官山: { latitude: 35.6481, longitude: 139.7034 },
  広尾: { latitude: 35.6516, longitude: 139.7223 },
  神泉: { latitude: 35.6575, longitude: 139.6933 },
  笹塚: { latitude: 35.6737, longitude: 139.6673 },
  三軒茶屋: { latitude: 35.6435, longitude: 139.6715 },
  下北沢: { latitude: 35.6615, longitude: 139.6667 },
  二子玉川: { latitude: 35.6115, longitude: 139.6271 },
  経堂: { latitude: 35.6514, longitude: 139.6369 },
  豪徳寺: { latitude: 35.6538, longitude: 139.6472 },
  駒沢大学: { latitude: 35.6335, longitude: 139.6614 },
  中目黒: { latitude: 35.644, longitude: 139.6993 },
  自由が丘: { latitude: 35.6074, longitude: 139.6686 },
  学芸大学: { latitude: 35.6288, longitude: 139.6852 },
  祐天寺: { latitude: 35.6372, longitude: 139.6913 },
  目黒: { latitude: 35.6339, longitude: 139.7157 },
  浅草: { latitude: 35.7148, longitude: 139.7967 },
  蔵前: { latitude: 35.7041, longitude: 139.7907 },
  上野: { latitude: 35.7138, longitude: 139.777 },
  谷中: { latitude: 35.7244, longitude: 139.7667 },
  田原町: { latitude: 35.7099, longitude: 139.7908 },
  銀座: { latitude: 35.6719, longitude: 139.765 },
  日本橋: { latitude: 35.6824, longitude: 139.7745 },
  人形町: { latitude: 35.6862, longitude: 139.7823 },
  築地: { latitude: 35.6676, longitude: 139.7724 },
  東銀座: { latitude: 35.6695, longitude: 139.7671 },
  三越前: { latitude: 35.6846, longitude: 139.7731 },
  表参道: { latitude: 35.6652, longitude: 139.7123 },
  青山一丁目: { latitude: 35.6728, longitude: 139.7241 },
  六本木: { latitude: 35.6628, longitude: 139.7314 },
  麻布十番: { latitude: 35.6565, longitude: 139.7369 },
  赤坂: { latitude: 35.6721, longitude: 139.7366 },
  新橋: { latitude: 35.6663, longitude: 139.7586 },
  白金台: { latitude: 35.6379, longitude: 139.7264 },
  品川: { latitude: 35.6285, longitude: 139.7388 },
  新宿: { latitude: 35.6896, longitude: 139.7006 },
  神楽坂: { latitude: 35.7038, longitude: 139.7344 },
  高田馬場: { latitude: 35.7123, longitude: 139.7038 },
  四ツ谷: { latitude: 35.686, longitude: 139.7309 },
  早稲田: { latitude: 35.7057, longitude: 139.7212 },
  新宿三丁目: { latitude: 35.6907, longitude: 139.7063 },
  飯田橋: { latitude: 35.7021, longitude: 139.7445 },
  東京: { latitude: 35.6812, longitude: 139.7671 },
  日比谷: { latitude: 35.6745, longitude: 139.7598 },
  有楽町: { latitude: 35.6751, longitude: 139.7633 },
  神保町: { latitude: 35.6959, longitude: 139.7576 },
  御茶ノ水: { latitude: 35.6993, longitude: 139.7656 },
  秋葉原: { latitude: 35.6984, longitude: 139.773 },
  根津: { latitude: 35.7174, longitude: 139.7657 },
  千駄木: { latitude: 35.7256, longitude: 139.7634 },
  本郷三丁目: { latitude: 35.7067, longitude: 139.7599 },
  後楽園: { latitude: 35.7073, longitude: 139.7519 },
  茗荷谷: { latitude: 35.7173, longitude: 139.7373 },
  押上: { latitude: 35.7101, longitude: 139.8129 },
  とうきょうスカイツリー: { latitude: 35.7101, longitude: 139.8107 },
  本所吾妻橋: { latitude: 35.7086, longitude: 139.8047 },
  錦糸町: { latitude: 35.6967, longitude: 139.8145 },
  両国: { latitude: 35.696, longitude: 139.7936 },
  清澄白河: { latitude: 35.6826, longitude: 139.7981 },
  門前仲町: { latitude: 35.6719, longitude: 139.7959 },
  豊洲: { latitude: 35.655, longitude: 139.7966 },
  亀戸: { latitude: 35.6974, longitude: 139.8266 },
  五反田: { latitude: 35.6264, longitude: 139.7234 },
  大井町: { latitude: 35.6063, longitude: 139.7348 },
  戸越銀座: { latitude: 35.6156, longitude: 139.716 },
  武蔵小山: { latitude: 35.6205, longitude: 139.7044 },
  蒲田: { latitude: 35.5625, longitude: 139.716 },
  大森: { latitude: 35.5884, longitude: 139.7281 },
  田園調布: { latitude: 35.5968, longitude: 139.6673 },
  中野: { latitude: 35.706, longitude: 139.6657 },
  東中野: { latitude: 35.7065, longitude: 139.6834 },
  中野坂上: { latitude: 35.6978, longitude: 139.6828 },
  荻窪: { latitude: 35.704, longitude: 139.6199 },
  西荻窪: { latitude: 35.7038, longitude: 139.5996 },
  高円寺: { latitude: 35.7057, longitude: 139.6497 },
  阿佐ヶ谷: { latitude: 35.7048, longitude: 139.6358 },
  池袋: { latitude: 35.7295, longitude: 139.7109 },
  目白: { latitude: 35.7212, longitude: 139.7066 },
  巣鴨: { latitude: 35.7335, longitude: 139.7393 },
  大塚: { latitude: 35.7314, longitude: 139.7286 },
  駒込: { latitude: 35.7365, longitude: 139.7469 },
  赤羽: { latitude: 35.778, longitude: 139.7209 },
  王子: { latitude: 35.7526, longitude: 139.7382 },
  田端: { latitude: 35.7381, longitude: 139.7608 },
  日暮里: { latitude: 35.7278, longitude: 139.7709 },
  西日暮里: { latitude: 35.7321, longitude: 139.7668 },
  町屋: { latitude: 35.742, longitude: 139.7804 },
  南千住: { latitude: 35.7333, longitude: 139.7996 },
  板橋: { latitude: 35.7456, longitude: 139.7198 },
  大山: { latitude: 35.7485, longitude: 139.7025 },
  成増: { latitude: 35.7773, longitude: 139.6326 },
  練馬: { latitude: 35.7375, longitude: 139.6545 },
  江古田: { latitude: 35.7375, longitude: 139.6725 },
  石神井公園: { latitude: 35.7438, longitude: 139.6062 },
  大泉学園: { latitude: 35.7499, longitude: 139.5862 },
  北千住: { latitude: 35.749, longitude: 139.8053 },
  綾瀬: { latitude: 35.7621, longitude: 139.8248 },
  西新井: { latitude: 35.7775, longitude: 139.7905 },
  亀有: { latitude: 35.7666, longitude: 139.8476 },
  金町: { latitude: 35.7696, longitude: 139.8706 },
  新小岩: { latitude: 35.7167, longitude: 139.8583 },
  青砥: { latitude: 35.7457, longitude: 139.8562 },
  葛西: { latitude: 35.6635, longitude: 139.8726 },
  西葛西: { latitude: 35.6646, longitude: 139.8594 },
  小岩: { latitude: 35.7332, longitude: 139.8819 },
  船堀: { latitude: 35.6839, longitude: 139.8643 },
};

const radiusMeters = 3000;

function json(response, status = 200) {
  response.status(status).setHeader("content-type", "application/json; charset=utf-8");
}

function cleanText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function normalizeKey(value = "") {
  return String(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[\s\-ー・|｜,，.。()（）[\]【】]/g, "");
}

function spotPlaceId(spot) {
  return spot.placeId || spot.googlePlaceId || spot.instagram?.placeId || "";
}

async function readRegisteredSpots() {
  try {
    const file = await readFile(join(process.cwd(), "public", "spots.json"), "utf8");
    const spots = JSON.parse(file);
    return Array.isArray(spots) ? spots : [];
  } catch {
    return [];
  }
}

function buildRegisteredIndex(spots) {
  const nameKeys = spots.map((spot) => normalizeKey(spot.name)).filter(Boolean);
  return {
    placeIds: new Set(spots.map(spotPlaceId).filter(Boolean)),
    nameKeys,
    nameAddressKeys: new Set(spots.map((spot) => `${normalizeKey(spot.name)}|${normalizeKey(spot.address)}`).filter((key) => key !== "|")),
  };
}

function isRegisteredName(nameKey, registeredNameKeys) {
  return registeredNameKeys.some((registeredNameKey) => nameKey === registeredNameKey || nameKey.includes(registeredNameKey));
}

function isRegisteredPlace(place, registeredIndex) {
  const placeId = place.id || (place.name || "").replace(/^places\//, "");
  if (placeId && registeredIndex.placeIds.has(placeId)) {
    return true;
  }

  const name = cleanText(place.displayName?.text || "");
  const address = cleanText(place.formattedAddress || "");
  const nameKey = normalizeKey(name);
  return isRegisteredName(nameKey, registeredIndex.nameKeys) || registeredIndex.nameAddressKeys.has(`${nameKey}|${normalizeKey(address)}`);
}

function degreesForMeters(meters, latitude) {
  const latDelta = meters / 111320;
  const lngDelta = meters / (111320 * Math.cos((latitude * Math.PI) / 180));
  return { latDelta, lngDelta };
}

function locationRestrictionFor(center) {
  const { latDelta, lngDelta } = degreesForMeters(radiusMeters, center.latitude);
  return {
    rectangle: {
      low: {
        latitude: center.latitude - latDelta,
        longitude: center.longitude - lngDelta,
      },
      high: {
        latitude: center.latitude + latDelta,
        longitude: center.longitude + lngDelta,
      },
    },
  };
}

function distanceMeters(from, to) {
  const earthRadius = 6371000;
  const lat1 = (from.latitude * Math.PI) / 180;
  const lat2 = (to.latitude * Math.PI) / 180;
  const deltaLat = ((to.latitude - from.latitude) * Math.PI) / 180;
  const deltaLng = ((to.longitude - from.longitude) * Math.PI) / 180;
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isInsideArea(place, center) {
  const location = place.location;
  if (!center || !location?.latitude || !location?.longitude) {
    return true;
  }

  return distanceMeters(center, location) <= radiusMeters;
}

// 口コミ本文（最大5件）：ルールベース採点の入力に使う
function mapReviews(place) {
  return (place.reviews || [])
    .slice(0, 5)
    .map((review) => ({
      text: cleanText(review.text?.text || review.originalText?.text || ""),
      rating: review.rating ?? null,
      when: cleanText(review.relativePublishTimeDescription || ""),
    }))
    .filter((review) => review.text);
}

function mapPlace(place, area, genre) {
  const photoName = place.photos?.[0]?.name || "";
  const googleMapsUrl = place.googleMapsUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.displayName?.text || "")}`;

  return {
    placeId: place.id || (place.name || "").replace(/^places\//, ""),
    name: cleanText(place.displayName?.text || ""),
    area,
    genreQuery: genre,
    address: cleanText(place.formattedAddress || ""),
    mapsUrl: googleMapsUrl,
    officialUrl: place.websiteUri || "",
    instagramUrl: "",
    menuUrl: "",
    rating: place.rating || null,
    reviewCount: place.userRatingCount || null,
    photoUrl: photoName ? `/api/place-photo?name=${encodeURIComponent(photoName)}` : "",
    photoName,
    location: place.location || null,
    primaryType: place.primaryType || "",
    types: Array.isArray(place.types) ? place.types : [],
    reviews: mapReviews(place),
  };
}

export default async function handler(request, response) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY || "";
  const area = cleanText(request.query?.area || "");
  const ward = cleanText(request.query?.ward || "");
  const station = cleanText(request.query?.station || "");
  const genre = cleanText(request.query?.genre || "");

  if (!area || !genre) {
    json(response, 400);
    response.end(JSON.stringify({ error: "area and genre are required", places: [] }));
    return;
  }

  if (!apiKey) {
    json(response, 200);
    response.end(
      JSON.stringify({
        error: "GOOGLE_PLACES_API_KEY is not configured",
        places: [],
        meta: {
          returnedCount: 0,
          receivedCount: 0,
          registeredExcluded: 0,
          areaExcluded: 0,
          radiusMeters,
          areaCenter: stationCenters[station] || areaCenters[area] || null,
        },
      }),
    );
    return;
  }

  const center = stationCenters[station] || areaCenters[area] || null;
  const searchAreaText = cleanText([ward, station || area].filter(Boolean).join(" ")) || area;
  const registeredSpots = await readRegisteredSpots();
  const registeredIndex = buildRegisteredIndex(registeredSpots);
  const textQuery = `${searchAreaText} ${genre} お茶 カフェ 茶房`;
  const fieldMask = [
    "places.id",
    "places.name",
    "places.displayName",
    "places.formattedAddress",
    "places.googleMapsUri",
    "places.location",
    "places.rating",
    "places.userRatingCount",
    "places.photos",
    "places.primaryType",
    "places.types",
    "places.websiteUri",
    // 口コミ本文（採点用）。Enterprise + Atmosphere SKU になる点に注意
    "places.reviews",
  ].join(",");

  try {
    const placesResponse = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
        "x-goog-fieldmask": fieldMask,
      },
      body: JSON.stringify({
        textQuery,
        languageCode: "ja",
        regionCode: "JP",
        pageSize: 20,
        ...(center ? { locationRestriction: locationRestrictionFor(center) } : {}),
      }),
    });

    const data = await placesResponse.json();
    if (!placesResponse.ok) {
      json(response, 200);
      response.end(
        JSON.stringify({
          error: data.error?.message || `Google Places request failed: ${placesResponse.status}`,
          places: [],
          meta: {
            returnedCount: 0,
            receivedCount: 0,
            registeredExcluded: 0,
            areaExcluded: 0,
            radiusMeters,
            areaCenter: center,
          },
        }),
      );
      return;
    }

    const receivedPlaces = data.places || [];
    let registeredExcluded = 0;
    let areaExcluded = 0;
    const filteredPlaces = [];

    for (const place of receivedPlaces) {
      if (isRegisteredPlace(place, registeredIndex)) {
        registeredExcluded += 1;
        continue;
      }

      if (!isInsideArea(place, center)) {
        areaExcluded += 1;
        continue;
      }

      filteredPlaces.push(place);
    }

    json(response);
    response.end(
      JSON.stringify({
        places: filteredPlaces.slice(0, 20).map((place) => mapPlace(place, area, genre)),
        meta: {
          returnedCount: filteredPlaces.length,
          receivedCount: receivedPlaces.length,
          registeredExcluded,
          areaExcluded,
          radiusMeters,
          areaCenter: center,
        },
      }),
    );
  } catch (error) {
    json(response, 200);
    response.end(
      JSON.stringify({
        error: error instanceof Error ? error.message : "places search failed",
        places: [],
        meta: {
          returnedCount: 0,
          receivedCount: 0,
          registeredExcluded: 0,
          areaExcluded: 0,
          radiusMeters,
          areaCenter: stationCenters[station] || areaCenters[area] || null,
        },
      }),
    );
  }
}
