const blockedHosts = [
  "google.",
  "gstatic.",
  "ggpht.",
  "googleusercontent.",
  "googleapis.",
  "schema.org",
  "maps.apple.",
  "facebook.com",
  "twitter.com",
  "x.com",
];

function json(response, status = 200) {
  response.status(status).setHeader("content-type", "application/json; charset=utf-8");
}

function decodeHtml(value = "") {
  return value
    .replace(/\\u003d/g, "=")
    .replace(/\\u0026/g, "&")
    .replace(/\\\//g, "/")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function cleanText(value = "") {
  return decodeHtml(value)
    .replace(/\s+/g, " ")
    .replace(/\s+-\s+Google Maps$/i, "")
    .trim();
}

function metaContent(html, property) {
  const pattern = new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i");
  return cleanText(html.match(pattern)?.[1] || "");
}

function extractCoordinates(url, html = "") {
  const sources = [url, html];
  for (const source of sources) {
    const atMatch = source.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (atMatch) return { lat: atMatch[1], lng: atMatch[2] };

    const dataMatch = source.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    if (dataMatch) return { lat: dataMatch[1], lng: dataMatch[2] };
  }

  return null;
}

function isUsableExternalUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    const pathname = parsed.pathname.toLowerCase();
    const isMedia = /\.(jpg|jpeg|png|webp|gif|svg|ico)(\?.*)?$/.test(pathname);
    return parsed.protocol.startsWith("http") && !isMedia && !blockedHosts.some((blockedHost) => host.includes(blockedHost));
  } catch {
    return false;
  }
}

function normalizeUrl(rawUrl) {
  try {
    const decoded = decodeHtml(decodeURIComponent(rawUrl));
    const parsed = new URL(decoded);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return "";
  }
}

function extractExternalLinks(html) {
  const candidates = new Set();
  const patterns = [
    /https?:\\?\/\\?\/[^"'<>\\\s]+/g,
    /url=(https?%3A%2F%2F[^"'&<>]+)/g,
  ];

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const raw = match[1] || match[0];
      const normalized = normalizeUrl(raw);
      if (normalized && isUsableExternalUrl(normalized)) {
        candidates.add(normalized);
      }
    }
  }

  const urls = [...candidates];
  const instagramUrl = urls.find((url) => /instagram\.com/i.test(url)) || "";
  const menuUrl =
    urls.find((url) => /(menu|メニュー|tabelog|hotpepper|gnavi|retty|menu\/|\/menus?)/i.test(url)) || "";
  const officialUrl =
    urls.find((url) => url !== instagramUrl && url !== menuUrl && !/(tabelog|hotpepper|gnavi|retty|tripadvisor)/i.test(url)) ||
    "";

  return { officialUrl, instagramUrl, menuUrl };
}

function inferNameFromUrl(url) {
  try {
    const parsed = new URL(url);
    const query = parsed.searchParams.get("query") || parsed.searchParams.get("q") || "";
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    const placeIndex = pathParts.findIndex((part) => part === "place" || part === "search");
    const placeText = placeIndex >= 0 ? pathParts[placeIndex + 1] || "" : "";
    return cleanText(decodeURIComponent(query || placeText || "Google Maps候補").replace(/\+/g, " "));
  } catch {
    return "Google Maps候補";
  }
}

async function reverseGeocode(coordinates) {
  if (!coordinates) return "";

  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", coordinates.lat);
  url.searchParams.set("lon", coordinates.lng);
  url.searchParams.set("zoom", "18");
  url.searchParams.set("accept-language", "ja");

  try {
    const response = await fetch(url, {
      headers: {
        "accept": "application/json",
        "user-agent": "SIPTokyo/1.0 contact: https://siptokyo-beta.vercel.app",
      },
    });

    if (!response.ok) return "";
    const data = await response.json();
    return cleanText(data.display_name || "");
  } catch {
    return "";
  }
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "accept": "text/html,application/xhtml+xml",
      "accept-language": "ja,en;q=0.8",
      "user-agent": "Mozilla/5.0 SIPTokyoResearch/1.0",
    },
  });

  const html = await response.text();
  return {
    finalUrl: response.url || url,
    html,
    ok: response.ok,
  };
}

export default async function handler(request, response) {
  const rawUrl = request.query?.url || "";

  if (!rawUrl) {
    json(response, 400);
    response.end(JSON.stringify({ error: "url is required" }));
    return;
  }

  let mapsUrl = "";
  try {
    mapsUrl = new URL(rawUrl).toString();
  } catch {
    json(response, 400);
    response.end(JSON.stringify({ error: "invalid url" }));
    return;
  }

  try {
    const fetched = await fetchHtml(mapsUrl);
    const title = metaContent(fetched.html, "og:title") || metaContent(fetched.html, "twitter:title");
    const description = metaContent(fetched.html, "og:description") || metaContent(fetched.html, "description");
    const image = metaContent(fetched.html, "og:image") || metaContent(fetched.html, "twitter:image");
    const coordinates = extractCoordinates(fetched.finalUrl, fetched.html);
    const address = await reverseGeocode(coordinates);
    const links = extractExternalLinks(fetched.html);

    json(response);
    response.end(
      JSON.stringify({
        name: title || inferNameFromUrl(fetched.finalUrl),
        address,
        mapsUrl: fetched.finalUrl || mapsUrl,
        photoUrl: image,
        description,
        coordinates,
        ...links,
        confidence: {
          address: address ? "coordinates_reverse_geocode" : "",
          links: links.officialUrl || links.instagramUrl || links.menuUrl ? "page_extract" : "",
        },
      }),
    );
  } catch (error) {
    json(response, 200);
    response.end(
      JSON.stringify({
        name: inferNameFromUrl(mapsUrl),
        address: "",
        mapsUrl,
        photoUrl: "",
        officialUrl: "",
        instagramUrl: "",
        menuUrl: "",
        description: "",
        coordinates: null,
        error: error instanceof Error ? error.message : "lookup failed",
      }),
    );
  }
}
