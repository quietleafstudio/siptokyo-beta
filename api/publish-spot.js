// SIP Studio「採用済みをサイトに掲載」用エンドポイント
//
// GitHub Contents API で public/spots.json に採用スポットを追記コミットする。
// コミットが push されると Vercel が自動デプロイし、本番サイトに反映される。
//
// 必要な環境変数（Vercel側で設定）:
// - GITHUB_TOKEN          … Contents: Read and write 権限を持つ fine-grained PAT
// - STUDIO_PUBLISH_TOKEN  … Studio からの掲載を許可する共有シークレット（任意の文字列）
// - GITHUB_REPO           … 省略時 "quietleafstudio/siptokyo-beta"
// - GITHUB_BRANCH         … 省略時 "main"

const SPOTS_PATH = "public/spots.json";
const MAX_SPOTS_PER_REQUEST = 10;

// buildDraftSpot（studio.js）が出力するキーのみ受け付ける
const allowedKeys = new Set([
  "id", "name", "area", "address", "station", "walk", "image", "placeId",
  "type", "genre", "tags", "comment", "mapUrl", "mapsUrl", "officialUrl",
  "instagramUrl", "menuUrl", "menuSummary", "priceRange", "note",
  "searchTags", "cautionNote", "instagram",
]);

function json(response, status = 200) {
  response.status(status).setHeader("content-type", "application/json; charset=utf-8");
}

function normalizeKey(value = "") {
  return String(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[\s\-ー・|｜,，.。()（）[\]【】]/g, "");
}

function sanitizeSpot(spot) {
  if (!spot || typeof spot !== "object") return null;

  const cleaned = {};
  for (const [key, value] of Object.entries(spot)) {
    if (!allowedKeys.has(key)) continue;
    if (Array.isArray(value)) {
      cleaned[key] = value.filter((item) => typeof item === "string").slice(0, 20);
    } else if (key === "instagram" && value && typeof value === "object") {
      cleaned[key] = { handle: String(value.handle || ""), placeId: String(value.placeId || "") };
    } else if (typeof value === "string") {
      cleaned[key] = value.slice(0, 2000);
    }
  }

  if (!cleaned.id || !cleaned.name || !cleaned.area) return null;
  return cleaned;
}

function githubHeaders(token) {
  return {
    authorization: `Bearer ${token}`,
    accept: "application/vnd.github+json",
    "user-agent": "siptokyo-studio-publish",
  };
}

async function fetchSpotsFile(repo, branch, token) {
  const response = await fetch(
    `https://api.github.com/repos/${repo}/contents/${SPOTS_PATH}?ref=${encodeURIComponent(branch)}`,
    { headers: githubHeaders(token) },
  );

  if (!response.ok) {
    throw new Error(`GitHubからspots.jsonを取得できませんでした: ${response.status}`);
  }

  const data = await response.json();
  const spots = JSON.parse(Buffer.from(data.content, "base64").toString("utf8"));
  if (!Array.isArray(spots)) {
    throw new Error("spots.jsonの形式が配列ではありません");
  }

  return { spots, sha: data.sha };
}

async function commitSpotsFile(repo, branch, token, spots, sha, names) {
  const message = `Studioから掲載: ${names.join("、")}`;
  const response = await fetch(`https://api.github.com/repos/${repo}/contents/${SPOTS_PATH}`, {
    method: "PUT",
    headers: { ...githubHeaders(token), "content-type": "application/json" },
    body: JSON.stringify({
      message,
      content: Buffer.from(JSON.stringify(spots, null, 2)).toString("base64"),
      sha,
      branch,
    }),
  });

  if (!response.ok) {
    const error = new Error(`GitHubへのコミットに失敗しました: ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return response.json();
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    json(response, 405);
    response.end(JSON.stringify({ error: "POST only" }));
    return;
  }

  const githubToken = process.env.GITHUB_TOKEN || "";
  const publishToken = process.env.STUDIO_PUBLISH_TOKEN || "";
  const repo = process.env.GITHUB_REPO || "quietleafstudio/siptokyo-beta";
  const branch = process.env.GITHUB_BRANCH || "main";

  if (!githubToken || !publishToken) {
    json(response, 200);
    response.end(JSON.stringify({ error: "GITHUB_TOKEN / STUDIO_PUBLISH_TOKEN が未設定です。Vercelの環境変数を設定してください。" }));
    return;
  }

  const requestToken = String(request.headers["x-studio-token"] || "");
  if (requestToken !== publishToken) {
    json(response, 401);
    response.end(JSON.stringify({ error: "掲載トークンが一致しません。" }));
    return;
  }

  const rawSpots = Array.isArray(request.body?.spots) ? request.body.spots : [];
  const incoming = rawSpots.slice(0, MAX_SPOTS_PER_REQUEST).map(sanitizeSpot).filter(Boolean);

  if (!incoming.length) {
    json(response, 400);
    response.end(JSON.stringify({ error: "掲載できるスポットがありません。" }));
    return;
  }

  try {
    // shaコンフリクト（他のコミットとの競合）時は1回だけ取り直して再試行する
    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const { spots, sha } = await fetchSpotsFile(repo, branch, githubToken);

      const existingPlaceIds = new Set(spots.map((spot) => spot.placeId || spot.instagram?.placeId).filter(Boolean));
      const existingNameKeys = new Set(spots.map((spot) => normalizeKey(spot.name)).filter(Boolean));
      const existingIds = new Set(spots.map((spot) => spot.id).filter(Boolean));

      const skipped = [];
      const toAdd = [];
      for (const spot of incoming) {
        const isDuplicate =
          (spot.placeId && existingPlaceIds.has(spot.placeId)) ||
          existingNameKeys.has(normalizeKey(spot.name)) ||
          existingIds.has(spot.id);
        if (isDuplicate) {
          skipped.push(spot.name);
        } else {
          toAdd.push(spot);
        }
      }

      if (!toAdd.length) {
        json(response, 200);
        response.end(JSON.stringify({ added: 0, addedNames: [], skipped }));
        return;
      }

      try {
        const result = await commitSpotsFile(repo, branch, githubToken, [...spots, ...toAdd], sha, toAdd.map((spot) => spot.name));
        json(response, 200);
        response.end(
          JSON.stringify({
            added: toAdd.length,
            addedNames: toAdd.map((spot) => spot.name),
            skipped,
            commitUrl: result.commit?.html_url || "",
          }),
        );
        return;
      } catch (error) {
        lastError = error;
        if (error.status !== 409 && error.status !== 422) throw error;
      }
    }

    throw lastError || new Error("コミットに失敗しました");
  } catch (error) {
    json(response, 200);
    response.end(JSON.stringify({ error: error instanceof Error ? error.message : "掲載に失敗しました" }));
  }
}
