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
  return {
    placeIds: new Set(spots.map(spotPlaceId).filter(Boolean)),
    nameAddressKeys: new Set(spots.map((spot) => `${normalizeKey(spot.name)}|${normalizeKey(spot.address)}`).filter((key) => key !== "|")),
  };
}

function isRegisteredPlace(place, registeredIndex) {
  const placeId = place.id || (place.name || "").replace(/^places\//, "");
  if (placeId && registeredIndex.placeIds.has(placeId)) {
    return true;
  }

  const name = cleanText(place.displayName?.text || "");
  const address = cleanText(place.formattedAddress || "");
  return registeredIndex.nameAddressKeys.has(`${normalizeKey(name)}|${normalizeKey(address)}`);
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
  };
}

export default async function handler(request, response) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY || "";
  const area = cleanText(request.query?.area || "");
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
          areaCenter: areaCenters[area] || null,
        },
      }),
    );
    return;
  }

  const center = areaCenters[area] || null;
  const registeredSpots = await readRegisteredSpots();
  const registeredIndex = buildRegisteredIndex(registeredSpots);
  const textQuery = `${genre} お茶 カフェ 茶房`;
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
          areaCenter: areaCenters[area] || null,
        },
      }),
    );
  }
}
