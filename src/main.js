const primaryTagOrder = ["静か", "抹茶", "ハーブ", "古民家", "一人時間", "会話向け"];
const publicBasePath = import.meta.env?.BASE_URL || "/";
const dataVersion = "20260429-2";
let searchRenderTimer = null;

function publicAssetPath(path) {
  const basePath = publicBasePath.endsWith("/") ? publicBasePath : `${publicBasePath}/`;
  const resolvedPath = `${basePath}${path.replace(/^\/+/, "")}`;

  if (typeof window !== "undefined" && window.location?.origin) {
    return new URL(resolvedPath, window.location.origin).toString();
  }

  return resolvedPath;
}

function withCacheBust(url) {
  const parsedUrl = new URL(url, window.location.origin);
  parsedUrl.searchParams.set("v", dataVersion);
  return parsedUrl.toString();
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function getSpotDataUrls() {
  const origin = window.location.origin;
  return uniqueValues([
    withCacheBust(publicAssetPath("spots.json")),
    withCacheBust(new URL("/spots.json", origin).toString()),
    withCacheBust(new URL("/public/spots.json", origin).toString()),
  ]);
}

const state = {
  activeTag: "すべて",
  activeArea: "すべて",
  query: "",
  favorites: readFavorites(),
  spots: [],
  isLoading: true,
  loadError: "",
  isComposing: false,
};

function readFavorites() {
  try {
    return JSON.parse(localStorage.getItem("sipTokyoFavorites") || "[]");
  } catch {
    return [];
  }
}

function saveFavorites() {
  localStorage.setItem("sipTokyoFavorites", JSON.stringify(state.favorites));
}

async function loadSpots() {
  try {
    let spots = null;
    let lastError = null;

    for (const url of getSpotDataUrls()) {
      try {
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`${url} could not be loaded: ${response.status}`);
        }

        spots = await response.json();
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!Array.isArray(spots)) {
      throw lastError || new Error("spots.json could not be loaded");
    }

    state.spots = spots.map(normalizeSpot);
  } catch (error) {
    state.loadError = "店舗データを読み込めませんでした。";
    console.error(error);
  } finally {
    state.isLoading = false;
    render();
  }
}

function normalizeSpot(spot) {
  return {
    ...spot,
    tags: Array.isArray(spot.tags) ? spot.tags : [],
    searchTags: Array.isArray(spot.searchTags) ? spot.searchTags : [],
    image: normalizeImagePath(spot.image || ""),
  };
}

function normalizeImagePath(image) {
  if (!image) return "";
  if (image.startsWith("http://") || image.startsWith("https://")) {
    return image;
  }
  const imageName = image.replace(/^\/?(public\/)?images\//, "");
  return publicAssetPath(`images/${imageName}`);
}

function getTagFilters() {
  const tags = new Set(state.spots.flatMap((spot) => spot.tags));
  return [
    ...primaryTagOrder.filter((tag) => tags.has(tag)),
    ...[...tags].filter((tag) => !primaryTagOrder.includes(tag)).sort((a, b) => a.localeCompare(b, "ja")),
  ];
}

function getAreaFilters() {
  return [...new Set(state.spots.map((spot) => spot.area).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "ja"),
  );
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function filterSpots() {
  const normalizedQuery = state.query.trim().toLowerCase();

  return state.spots.filter((spot) => {
    const matchesTag = state.activeTag === "すべて" || spot.tags.includes(state.activeTag);
    const matchesArea = state.activeArea === "すべて" || spot.area === state.activeArea;
    const text = [
      spot.name,
      spot.kana,
      spot.area,
      spot.address,
      spot.station,
      spot.walk,
      spot.genre,
      spot.comment,
      spot.note,
      ...spot.tags,
      ...spot.searchTags,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return matchesTag && matchesArea && (normalizedQuery === "" || text.includes(normalizedQuery));
  });
}

function updateSearchQuery(value, delay = 280) {
  window.clearTimeout(searchRenderTimer);
  searchRenderTimer = window.setTimeout(() => {
    state.query = value;
    render();
    const input = document.querySelector(".heroSearch input");

    if (input) {
      input.focus();
      input.setSelectionRange(state.query.length, state.query.length);
    }
  }, delay);
}

function renderChips(items, activeValue, type) {
  return ["すべて", ...items]
    .map((item) => {
      const activeClass = activeValue === item ? " active" : "";
      return `<button class="chip${activeClass}" type="button" onclick="window.setSipFilter('${type}', '${escapeHtml(
        item,
      )}')" data-filter-type="${type}" data-filter-value="${escapeHtml(item)}">${escapeHtml(item)}</button>`;
    })
    .join("");
}

function renderSpotCard(spot) {
  const isFavorite = state.favorites.includes(spot.id);
  const photo = spot.image
    ? `<img src="${spot.image}" alt="${escapeHtml(spot.name)}の雰囲気" onerror="window.handleSipImageError(this)" />`
    : `<span>Tea place</span>`;
  const tags = spot.tags
    .slice(0, 4)
    .map((tag) => `<span>${escapeHtml(tag)}</span>`)
    .join("");

  return `
    <article class="spotCard" data-spot-id="${escapeHtml(spot.id)}">
      <div class="${spot.image ? "photoWrap" : "photoWrap emptyPhoto"}">
        ${photo}
        <button
          class="${isFavorite ? "favoriteButton saved" : "favoriteButton"}"
          type="button"
          aria-label="${escapeHtml(spot.name)}をお気に入り${isFavorite ? "から外す" : "に保存"}"
          aria-pressed="${isFavorite ? "true" : "false"}"
          onclick="window.toggleSipFavorite('${escapeHtml(spot.id)}')"
          data-favorite="${escapeHtml(spot.id)}"
        >${isFavorite ? "♥" : "♡"}</button>
      </div>
      <div class="spotBody">
        <div class="spotMeta">
          <span>${escapeHtml(spot.area)}</span>
          <span>${escapeHtml(spot.genre)}</span>
        </div>
        <h3>${escapeHtml(spot.name)}</h3>
        <div class="locationInfo">
          ${spot.address ? `<p><span aria-hidden="true">📍</span>${escapeHtml(spot.address)}</p>` : ""}
          ${
            spot.station || spot.walk
              ? `<p><span aria-hidden="true">🚉</span>${escapeHtml([spot.station, spot.walk].filter(Boolean).join("・"))}</p>`
              : ""
          }
        </div>
        <p class="comment">${escapeHtml(spot.comment)}</p>
        <div class="tagWrap">${tags}</div>
        <details>
          <summary>くわしく見る</summary>
          <p>${escapeHtml(spot.note)}</p>
        </details>
        <a class="mapLink" href="${spot.mapsUrl}" target="_blank" rel="noreferrer">Google Mapsへ</a>
      </div>
    </article>
  `;
}

function render() {
  const filteredSpots = filterSpots();
  const tagFilters = getTagFilters();
  const areaFilters = getAreaFilters();
  const root = document.getElementById("root");

  root.innerHTML = `
    <div class="appShell">
      <header class="hero">
        <div class="brandRow">
          <div class="logoMark">SIP</div>
          <p>SIP Tokyo</p>
        </div>
        <div class="heroImage">
          <img src="${publicAssetPath("images/siptokyo-hero.png")}" alt="抹茶とハーブティーのある静かなテーブル" onerror="window.handleSipImageError(this)" />
        </div>
        <div class="heroCopy">
          <p class="kicker">Tea-first cafe guide</p>
          <h1>お茶が主役のお店を探すなら。</h1>
          <p>抹茶、日本茶、ハーブティー。気分に合わせて選べる、静かな一杯のためのガイド。</p>
        </div>
        <label id="search" class="heroSearch" aria-label="スポット検索">
          <span class="searchIcon" aria-hidden="true">⌕</span>
          <input
            value="${escapeHtml(state.query)}"
            placeholder="どんなお茶時間を探す？（例：渋谷 / 抹茶 / 静か）"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellcheck="false"
          />
        </label>
        <section class="quickTags" aria-label="タグ検索">
          <div class="filterGroup" aria-label="タグ検索">
            <div class="chipRail">${renderChips(tagFilters, state.activeTag, "tag")}</div>
          </div>
        </section>
      </header>

      <main>
        <section id="spots" class="listHeader" aria-live="polite">
          <div>
            <p>Recommended</p>
            <h2>おすすめスポット</h2>
          </div>
          <span>${filteredSpots.length} spots</span>
        </section>

        <section class="spotList">
          ${
            state.isLoading
              ? `<div class="emptyState">店舗データを読み込んでいます。</div>`
              : state.loadError
                ? `<div class="emptyState">${escapeHtml(state.loadError)}</div>`
                : filteredSpots.length
              ? filteredSpots.map(renderSpotCard).join("")
              : `<div class="emptyState">条件に合うスポットが見つかりませんでした。</div>`
          }
        </section>

        <section class="searchPanel" aria-label="スポット検索">
          <div class="filterGroup" aria-label="エリア検索">
            <div class="filterTitle">エリア</div>
            <div class="chipRail">${renderChips(areaFilters, state.activeArea, "area")}</div>
          </div>

          <p class="savedCount">${state.favorites.length} saved</p>
        </section>
      </main>
    </div>
  `;

}

document.addEventListener("input", (event) => {
  if (event.target.matches(".heroSearch input")) {
    if (state.isComposing || event.isComposing) {
      return;
    }

    updateSearchQuery(event.target.value);
  }
});

document.addEventListener("compositionstart", (event) => {
  if (event.target.matches(".heroSearch input")) {
    window.clearTimeout(searchRenderTimer);
    state.isComposing = true;
  }
});

document.addEventListener("compositionend", (event) => {
  if (event.target.matches(".heroSearch input")) {
    state.isComposing = false;
    updateSearchQuery(event.target.value);
  }
});

document.addEventListener("change", (event) => {
  if (event.target.matches(".heroSearch input")) {
    window.clearTimeout(searchRenderTimer);
    state.query = event.target.value;
    render();
  }
});

window.setSipFilter = (type, value) => {
  if (type === "tag") {
    state.activeTag = value;
  } else {
    state.activeArea = value;
  }
  render();
  document.getElementById("search").scrollIntoView({ block: "start" });
};

window.toggleSipFavorite = (id) => {
  state.favorites = state.favorites.includes(id)
    ? state.favorites.filter((favoriteId) => favoriteId !== id)
    : [...state.favorites, id];
  saveFavorites();
  render();
};

window.handleSipImageError = (image) => {
  const wrapper = image.closest(".photoWrap");

  if (wrapper) {
    wrapper.classList.add("emptyPhoto");
    image.replaceWith(document.createRange().createContextualFragment("<span>Tea place</span>"));
    return;
  }

  image.style.display = "none";
};

render();
loadSpots();
