function json(response, status = 200) {
  response.status(status).setHeader("content-type", "application/json; charset=utf-8");
}

export default async function handler(request, response) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY || "";
  const name = request.query?.name || "";

  if (!apiKey || !name) {
    json(response, 404);
    response.end(JSON.stringify({ error: "photo unavailable" }));
    return;
  }

  const url = new URL(`https://places.googleapis.com/v1/${name}/media`);
  url.searchParams.set("maxWidthPx", "720");
  url.searchParams.set("key", apiKey);

  try {
    const photoResponse = await fetch(url, { redirect: "follow" });
    if (!photoResponse.ok) {
      json(response, 404);
      response.end(JSON.stringify({ error: "photo unavailable" }));
      return;
    }

    const contentType = photoResponse.headers.get("content-type") || "image/jpeg";
    const buffer = Buffer.from(await photoResponse.arrayBuffer());
    response.status(200).setHeader("content-type", contentType).setHeader("cache-control", "public, max-age=86400");
    response.end(buffer);
  } catch {
    json(response, 404);
    response.end(JSON.stringify({ error: "photo unavailable" }));
  }
}
