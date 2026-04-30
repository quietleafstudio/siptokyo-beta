function json(response, status = 200) {
  response.status(status).setHeader("content-type", "application/json; charset=utf-8");
}

function cleanText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
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
      }),
    );
    return;
  }

  const textQuery = `${area} ${genre} お茶 カフェ 茶房`;
  const fieldMask = [
    "places.id",
    "places.name",
    "places.displayName",
    "places.formattedAddress",
    "places.googleMapsUri",
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
      }),
    });

    const data = await placesResponse.json();
    if (!placesResponse.ok) {
      json(response, 200);
      response.end(
        JSON.stringify({
          error: data.error?.message || `Google Places request failed: ${placesResponse.status}`,
          places: [],
        }),
      );
      return;
    }

    json(response);
    response.end(
      JSON.stringify({
        places: (data.places || []).slice(0, 20).map((place) => mapPlace(place, area, genre)),
      }),
    );
  } catch (error) {
    json(response, 200);
    response.end(
      JSON.stringify({
        error: error instanceof Error ? error.message : "places search failed",
        places: [],
      }),
    );
  }
}
