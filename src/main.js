import { initGoogleAnalytics, trackAnalyticsEvent } from "./analytics.js";

const primaryTagOrder = ["静か", "抹茶", "ハーブ", "古民家", "一人時間", "会話向け"];
const publicBasePath = import.meta.env?.BASE_URL || "/";
const dataVersion = "20260502-2";
let searchRenderTimer = null;

initGoogleAnalytics();

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
  openJournalArticleId: null,
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
    stations: Array.isArray(spot.stations) ? spot.stations : [],
    image: normalizeImagePath(spot.image || ""),
    menuSummary: Array.isArray(spot.menuSummary) ? spot.menuSummary : [],
  };
}

function normalizeImagePath(image) {
  if (!image) return "";
  if (image.startsWith("http://") || image.startsWith("https://")) {
    return image;
  }
  if (image.startsWith("/api/")) {
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
      spot.nearestStation,
      spot.walk,
      spot.genre,
      spot.comment,
      spot.note,
      spot.priceRange,
      spot.cautionNote,
      spot.officialUrl,
      spot.instagramUrl,
      spot.menuUrl,
      ...spot.tags,
      ...spot.searchTags,
      ...spot.stations,
      ...spot.menuSummary,
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


function renderBrandNav(activePage = "spots") {
  const links = [
    { href: "#about", label: "About", page: "about" },
    { href: "#", label: "Spot guide", page: "spots" },
    { href: "#for-home", label: "For Home", page: "forHome" },
    { href: "#journal", label: "Journal", page: "journal" },
  ];

  return `
    <nav class="brandNav" aria-label="SIP Tokyo navigation">
      ${links
        .map(
          (link) => `<a class="brandNavLink${activePage === link.page ? " active" : ""}" href="${link.href}">${link.label}</a>`,
        )
        .join("")}
    </nav>
  `;
}

function renderLanguageSwitcher(activeLanguage = "jp") {
  return `
    <div class="languageSwitch" aria-label="Language switcher">
      <a class="${activeLanguage === "jp" ? "active" : ""}" href="/" aria-current="${activeLanguage === "jp" ? "page" : "false"}">JP</a>
      <span aria-hidden="true">/</span>
      <a class="${activeLanguage === "en" ? "active" : ""}" href="/en" aria-current="${activeLanguage === "en" ? "page" : "false"}">EN</a>
    </div>
  `;
}

function renderSpotCard(spot) {
  const isFavorite = state.favorites.includes(spot.id);
  const displayStation = spot.nearestStation || spot.station;
  const spotName = Array.isArray(spot.displayName)
    ? spot.displayName.map((line) => `<span class="spotNameLine">${escapeHtml(line)}</span>`).join("")
    : escapeHtml(spot.name);
  const photo = spot.image
    ? `<img src="${escapeHtml(spot.image)}" alt="${escapeHtml(spot.name)}の雰囲気" onerror="window.handleSipImageError(this)" />`
    : `<span>Tea place</span>`;
  const tags = spot.tags
    .slice(0, 5)
    .map((tag) => `<span class="tagPill">${escapeHtml(tag)}</span>`)
    .join("");
  const menuSummary = spot.menuSummary
    .map((item) => `<span>${escapeHtml(item)}</span>`)
    .join("");
  const detailLinks = [
    spot.mapsUrl
      ? `<a href="${escapeHtml(spot.mapsUrl)}" target="_blank" rel="noreferrer" onclick="window.trackSipExternalLink('google_maps', '${escapeHtml(spot.id)}')">Google Maps</a>`
      : "",
    spot.officialUrl
      ? `<a href="${escapeHtml(spot.officialUrl)}" target="_blank" rel="noreferrer" onclick="window.trackSipExternalLink('official_hp', '${escapeHtml(spot.id)}')">公式HP</a>`
      : "",
    spot.instagramUrl
      ? `<a href="${escapeHtml(spot.instagramUrl)}" target="_blank" rel="noreferrer" onclick="window.trackSipExternalLink('instagram', '${escapeHtml(spot.id)}')">Instagram</a>`
      : "",
    spot.menuUrl
      ? `<a href="${escapeHtml(spot.menuUrl)}" target="_blank" rel="noreferrer" onclick="window.trackSipExternalLink('menu', '${escapeHtml(spot.id)}')">Menu</a>`
      : "",
  ]
    .filter(Boolean)
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
        <h3>${spotName}</h3>
        <div class="locationInfo">
          ${spot.address ? `<p><span aria-hidden="true">📍</span>${escapeHtml(spot.address)}</p>` : ""}
          ${
            displayStation || spot.walk
              ? `<p><span aria-hidden="true">🚉</span>${escapeHtml([displayStation, spot.walk].filter(Boolean).join("・"))}</p>`
              : ""
          }
        </div>
        ${tags ? `<div class="tagWrap" aria-label="${escapeHtml(spot.name)}のタグ">${tags}</div>` : ""}
        <p class="comment">${escapeHtml(spot.comment)}</p>
        <details>
          <summary>くわしく見る</summary>
          <div class="detailInfo">
            ${detailLinks ? `<div class="detailLinks">${detailLinks}</div>` : ""}
            ${menuSummary ? `<div class="menuSummary">${menuSummary}</div>` : ""}
            ${spot.priceRange ? `<p class="priceRange">価格帯: ${escapeHtml(spot.priceRange)}</p>` : ""}
            ${spot.note ? `<p class="detailNote"><span>SIPメモ</span>${escapeHtml(spot.note)}</p>` : ""}
          </div>
        </details>
      </div>
    </article>
  `;
}

function render() {
  const filteredSpots = filterSpots();
  const tagFilters = getTagFilters();
  const areaFilters = getAreaFilters();
  const root = document.getElementById("root");

  if (window.location.pathname.replace(/\/$/, "") === "/en") {
    root.innerHTML = renderEnglishLandingPage();
    return;
  }

  if (window.location.hash === "#about") {
    root.innerHTML = renderAboutPage();
    return;
  }

  if (window.location.hash === "#for-home") {
    root.innerHTML = renderForHomePage();
    return;
  }

  if (window.location.hash === "#journal") {
    root.innerHTML = renderJournalPage();
    return;
  }

  root.innerHTML = `
    <div class="appShell">
      <header class="hero">
        <div class="brandRow">
          <div class="brandIdentity">
            <div class="logoMark">SIP</div>
            <p>SIP Tokyo</p>
          </div>
          ${renderLanguageSwitcher("jp")}
          ${renderBrandNav("spots")}
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

function renderEnglishLandingPage() {
  const keywords = [
    {
      title: "Quiet",
      text: "A calm presence in everyday life.",
    },
    {
      title: "Ritual",
      text: "A gentle practice, one cup at a time.",
    },
    {
      title: "Space",
      text: "Room to breathe, pause, and simply be.",
    },
  ];
  const exploreLinks = [
    {
      title: "Tea Spots",
      text: "Discover peaceful tea places across Tokyo.",
      href: "/#spots",
    },
    {
      title: "Journal",
      text: "Stories of tea, culture, and mindful living.",
      href: "/#journal",
    },
    {
      title: "For Home",
      text: "Bring quiet rituals into your everyday life.",
      href: "/#for-home",
    },
  ];

  return `
    <div class="appShell enShell">
      <header class="enHero">
        <nav class="aboutNav" aria-label="SIP English navigation">
          <a class="aboutLogo" href="/en">
            <span class="logoMark">SIP</span>
            <span class="brandTextStack">
              <span>SIP Tokyo</span>
              <small>Rooted in Tokyo</small>
            </span>
          </a>
          ${renderLanguageSwitcher("en")}
          <nav class="brandNav enNav" aria-label="English sections">
            <a class="brandNavLink" href="#en-about">About</a>
            <a class="brandNavLink" href="/#spots">Tea Spots</a>
            <a class="brandNavLink" href="/#for-home">For Home</a>
            <a class="brandNavLink" href="/#journal">Journal</a>
            <a class="brandNavLink" href="#en-featured">Featured by SIP</a>
          </nav>
        </nav>

        <div class="enHeroImage">
          <img src="${publicAssetPath("images/siptokyo-hero.png")}" alt="Matcha and herbal tea in soft Tokyo light" onerror="window.handleSipImageError(this)" />
        </div>

        <div class="enHeroCopy">
          <p class="kicker">SIP · Rooted in Tokyo</p>
          <h1>A quiet moment, steeped in Tokyo.</h1>
          <p>A gentle pause for the soul.</p>
          <div class="enHeroActions">
            <a class="enPrimaryCta" href="#en-about">Begin Your Quiet Moment</a>
            <a class="enSecondaryCta" href="/#spots">Explore Tea Spots →</a>
          </div>
        </div>
      </header>

      <main class="enMain">
        <section class="enKeywordGrid" aria-label="SIP brand keywords">
          ${keywords
            .map(
              (keyword) => `
                <article class="enKeywordCard">
                  <h2>${keyword.title}</h2>
                  <p>${keyword.text}</p>
                </article>
              `,
            )
            .join("")}
        </section>

        <section id="en-about" class="enAbout">
          <p class="sectionLabel">About SIP</p>
          <h2>Tea is more than a drink — it is a quiet ritual.</h2>
          <div class="enEssay">
            <p>At SIP, tea is more than a drink — it is a quiet ritual.</p>
            <p>Rooted in Tokyo, we curate gentle moments through tea, space, and thoughtful living. From bowls of vibrant matcha to quiet corners of Tokyo, SIP invites you to slow down and reconnect with yourself.</p>
            <p>In a fast-moving world, we believe in the beauty of pause — a warm cup in your hands, a soft breath, a moment of stillness.</p>
            <p>A quiet moment, steeped in Tokyo.<br>A gentle pause for the soul.</p>
          </div>
        </section>

        <section class="enExplore" aria-label="Explore SIP">
          <p class="sectionLabel">Explore SIP</p>
          <div class="enExploreList">
            ${exploreLinks
              .map(
                (link) => `
                  <a class="enExploreCard" href="${link.href}">
                    <h2>${link.title}</h2>
                    <p>${link.text}</p>
                  </a>
                `,
              )
              .join("")}
          </div>
        </section>

        <section id="en-featured" class="enFeatured">
          <p class="sectionLabel">Featured by SIP</p>
          <h2>Curated for slower, softer living.</h2>
          <p>Objects, leaves, and small rituals selected for quiet moments at home.</p>
          <a class="enSecondaryCta" href="/#for-home">Visit For Home →</a>
        </section>
      </main>

      <footer class="enFooter">
        <p>SIP</p>
        <span>Rooted in Tokyo</span>
        <small>A gentle pause, wherever you are.</small>
      </footer>
    </div>
  `;
}

function renderAboutPage() {
  return `
    <div class="appShell aboutShell">
      <header class="aboutHero">
        <nav class="aboutNav" aria-label="SIP Tokyo">
          <a class="aboutLogo" href="#">
            <span class="logoMark">SIP</span>
            <span>SIP Tokyo</span>
          </a>
          ${renderLanguageSwitcher("jp")}
          ${renderBrandNav("about")}
        </nav>
        <div class="aboutHeroImage">
          <img src="${publicAssetPath("images/kosoan-card.jpg")}" alt="庭を眺める茶室の抹茶時間" onerror="window.handleSipImageError(this)" />
        </div>
        <div class="aboutHeroCopy">
          <p class="kicker">About SIP Tokyo</p>
          <h1><span>静かな一杯から、</span><span>東京の時間を美しく。</span></h1>
          <p>ふっと肩の力が抜ける、<br>そんな時間のために。</p>
        </div>
      </header>

      <main class="aboutMain">
        <section class="aboutEssay">
          <p class="sectionLabel">Our Story</p>
          <h2>コーヒーではなく、お茶を選びたい日がある。</h2>
          <p>
            東京には、急ぐための場所がたくさんあります。けれど、ときどき必要なのは、速度を上げる一杯ではなく、呼吸をゆるめる一杯。
          </p>
          <p>
            SIP Tokyo は、抹茶、日本茶、ハーブティー、中国茶など、お茶が主役になる場所を静かに集めています。味だけではなく、席の心地よさ、光の入り方、器の美しさ、会話の余白まで含めて。
          </p>
        </section>

        <section class="aboutPhilosophy">
          <p class="sectionLabel">Our Philosophy</p>
          <div class="philosophyList">
            <article>
              <span>01</span>
              <h3>空間で選ぶ</h3>
              <p>その一杯をどんな場所で飲むか。窓際、庭、静かなカウンター。SIP は空間の気配を大切にします。</p>
            </article>
            <article>
              <span>02</span>
              <h3>余白を残す</h3>
              <p>情報を詰め込みすぎず、行ってみたいと思える静かな余韻を残すこと。</p>
            </article>
            <article>
              <span>03</span>
              <h3>お茶を主役に</h3>
              <p>抹茶、日本茶、ハーブティー。コーヒーではない選択肢を、日常の中に増やしていきます。</p>
            </article>
          </div>
        </section>

        <section class="aboutClosing">
          <p class="sectionLabel">For Your Quiet Moment</p>
          <h2>次の休憩が、少し美しくなりますように。</h2>
          <p>
            一人で整えたい日も、誰かと静かに話したい日も。SIP Tokyo は、東京のお茶時間を、ひとつずつ丁寧に集めていきます。
          </p>
          <a class="aboutCta" href="#">お茶スポットを見る</a>
        </section>
      </main>
    </div>
  `;
}


function renderForHomePage() {
  const categories = [
    {
      title: "Tea Leaves",
      icon: "🍃",
      text: "Selected leaves for quiet moments",
    },
    {
      title: "Tea Ware",
      icon: "🍵",
      text: "Beautiful tools for daily rituals",
    },
    {
      title: "Herbal Tea",
      icon: "🌿",
      text: "Gentle blends for slow evenings",
    },
  ];
  const featuredItems = [
    {
      number: "SIP Select #001",
      title: "Organic Matcha",
      caption: "by THE MATCHA TOKYO",
      image: "https://www.the-matcha.tokyo/cdn/shop/products/200414_010_1200x1200.jpg?v=1587912481",
      imageAlt: "Organic Matcha by THE MATCHA TOKYO",
      body: [
        "忙しい日々の中に、<br>ほんの少し、静かな余白を。",
        "手を動かし、泡を立てる。<br>そのひとときが、<br>心をそっと元の場所へ戻してくれる。",
      ],
      href: "https://www.the-matcha.tokyo/en/products/100-organic-matcha-japan-premium",
    },
    {
      number: "SIP Select #002",
      title: "Matcha Ritual Set",
      caption: "by Rakuten Select",
      image: publicAssetPath("images/for-home-hero.png"),
      imageAlt: "茶筅と抹茶時間のための道具",
      body: [
        "茶筅を動かし、<br>ゆっくり泡を立てる。",
        "手を使って一杯をつくる時間は、<br>思っていた以上に静かで、豊か。",
        "はじめての抹茶時間に。",
      ],
      href: "https://a.r10.to/h8PWE7",
    },
  ];

  return `
    <div class="appShell homeShell">
      <header class="homeHero">
        <nav class="aboutNav" aria-label="SIP Tokyo">
          <a class="aboutLogo" href="#">
            <span class="logoMark">SIP</span>
            <span>SIP Tokyo</span>
          </a>
          ${renderLanguageSwitcher("jp")}
          ${renderBrandNav("forHome")}
        </nav>

        <div class="homeHeroImage">
          <img src="${publicAssetPath("images/for-home-hero.png")}" alt="朝の光に包まれた日本茶と茶器" />
        </div>

        <div class="homeHeroCopy">
          <p class="kicker">For Home</p>
          <h1>ふっと、心が戻る一杯を、家でも。</h1>
          <p>For quiet moments at home.</p>
        </div>
      </header>

      <main class="homeMain">
        <section class="homeIntro" aria-label="For Home introduction">
          <p>
            外で見つけた静かな時間を、家の中にも少しずつ。SIP Tokyo は、お茶の葉、器、香りのある夜のための小さな選択肢を準備しています。
          </p>
        </section>

        <section class="homeCategoryGrid" aria-label="For Home categories">
          ${categories
            .map(
              (category) => `
                <article class="homeCategoryCard">
                  <div class="homeCategoryIcon" aria-hidden="true">${category.icon}</div>
                  <div>
                    <h2>${category.title}</h2>
                    <p>${category.text}</p>
                  </div>
                  <span>Coming Soon</span>
                </article>
              `,
            )
            .join("")}
        </section>

        <section class="homeFeatured" aria-label="Featured by SIP">
          <p class="sectionLabel">Featured by SIP</p>
          <div class="featuredList">
            ${featuredItems
              .map(
                (item) => `
                  <article class="featuredItem">
                    <div class="featuredImage">
                      <img src="${item.image}" alt="${item.imageAlt}" />
                    </div>
                    <div class="featuredBody">
                      <p class="featuredNumber">${item.number}</p>
                      <h2>${item.title}</h2>
                      <p class="featuredCaption">${item.caption}</p>
                      ${item.body.map((paragraph) => `<p>${paragraph}</p>`).join("")}
                      <a
                        class="featuredCta"
                        href="${item.href}"
                        target="_blank"
                        rel="noreferrer"
                      >View item →</a>
                    </div>
                  </article>
                `,
              )
              .join("")}
          </div>
          <p class="affiliateNote">※一部リンクにはアフィリエイトリンクを含みます。</p>
        </section>

        <section class="homeClosing">
          <p class="sectionLabel">Quiet rituals</p>
          <p>朝の湯気、夜のハーブ、手になじむ器。SIP For Home は、静かな時間を家で育てるための入口です。</p>
        </section>
      </main>
    </div>
  `;
}


function renderJournalPage() {
  const journalArticles = [
    {
      id: "journal-001",
      number: "001",
      title: "日本茶の起源とは？",
      subtitle: "何気ない一杯の、はじまりの話",
      image: "/images/journal-001-nihoncha-origin.png",
      paragraphs: [
        "朝の一杯。\n仕事の合間のひと息。\n夜、ふっと肩の力を抜きたいとき。",
        "私たちの暮らしのそばには、いつもお茶があります。",
        "そんな日本茶ですが、\n実ははじまりは日本ではなく、中国から伝わったものだといわれています。",
        "今からおよそ1200年前。\n僧侶たちが中国からお茶の文化を持ち帰り、心と体を整えるための飲み物として広まっていきました。",
        "当時、お茶はとても貴重なもの。\n今のように気軽に楽しむものではなく、特別な一杯だったそうです。",
        "それが長い時間をかけて人々の暮らしに溶け込み、\n季節を感じたり、誰かと向き合ったり、\n自分の心をそっと整えたりする時間へと変わっていきました。",
        "忙しい毎日の中で、\nお湯を注ぎ、湯気が立ちのぼるのを眺める。\nそのほんの数分だけでも、気持ちが少し静かになることがあります。",
        "何気なく飲んでいる一杯にも、\nそんな長い物語が流れていると思うと、\nいつものお茶が少しだけ特別に感じられるかもしれません。",
      ],
      closing: "今日の一杯を、いつもより少し丁寧に。",
    },
    {
      id: "journal-002",
      number: "002",
      title: "表千家と裏千家の違いとは？",
      subtitle: "同じお茶、ちがう美しさ",
      image: "/images/journal-002-senke-difference.png",
      paragraphs: [
        "茶道に少し興味を持つと、\nよく耳にする「表千家」と「裏千家」という言葉。",
        "名前は知っていても、\n何が違うのかは意外と知らないものです。",
        "実はこの二つ、どちらも同じルーツを持つお茶の流派。",
        "茶の湯を大成した千利休の流れを受け継ぎながら、\nそれぞれの美意識や所作が少しずつ育まれていきました。",
        "表千家は、静寂・格式・伝統を重んじる流派、\nかたや裏千家は「伝統を守りながら現代に開かれた茶道」として、国内外に多くの門弟を抱えています。",
        "たとえば、お茶の点て方。",
        "表千家の抹茶は、泡立ちを控えめにして、しっとりと落ち着いた印象。\n一方、裏千家はふんわりと泡を立て、やわらかく親しみやすい一杯になります。",
        "お辞儀の仕方や道具の扱い方にも、それぞれの個性があります。",
        "どちらが正しい、ではなく、\nどちらにも美しさがある。",
        "静けさの中に凛とした空気を感じるなら表千家。\nやわらかく人を迎え入れるような温かさを感じるなら裏千家。",
        "そんなふうに楽しんでみると、\nお茶の世界が少し近く感じられるかもしれません。",
        "違いを知ることは、比べるためではなく、\nその奥にある美しさに気づくこと。",
        "一杯のお茶の見え方が、また少し変わるかもしれません。",
      ],
      closing: "同じ一杯にも、いくつもの美しさがある。",
    },
  ];

  const articles = [
    {
      number: "03",
      title: "抹茶と煎茶の違い",
      category: "Tea basics",
    },
    {
      number: "04",
      title: "茶室にある余白のこと",
      category: "Quiet living",
    },
  ];

  return `
    <div class="appShell journalShell">
      <header class="journalHero">
        <nav class="aboutNav" aria-label="SIP Tokyo">
          <a class="aboutLogo" href="#">
            <span class="logoMark">SIP</span>
            <span>SIP Tokyo</span>
          </a>
          ${renderLanguageSwitcher("jp")}
          ${renderBrandNav("journal")}
        </nav>

        <div class="journalHeroPanel">
          <p class="kicker">Journal</p>
          <h1>一杯の背景にある、美しい物語を。</h1>
          <p>Thoughts on tea, ritual, and quiet living.</p>
        </div>
      </header>

      <main class="journalMain">
        <section class="journalIntro" aria-label="Journal introduction">
          <p>
            お茶の味わいは、葉や器だけでなく、所作、歴史、季節の光にも宿ります。SIP Journal は、静かな一杯をもう少し深く知るための読み物です。
          </p>
        </section>

        ${journalArticles.map(renderJournalFeature).join("")}

        <section class="journalArticleList" aria-label="Journal articles">
          <p class="sectionLabel">Coming Soon</p>
          ${articles
            .map(
              (article) => `
                <article class="journalArticleCard">
                  <span>${article.number}</span>
                  <div>
                    <p>${article.category}</p>
                    <h2>${article.title}</h2>
                  </div>
                  <strong>Coming Soon</strong>
                </article>
              `,
            )
            .join("")}
        </section>

        <section class="journalClosing">
          <p class="sectionLabel">Tea notes</p>
          <p>知ることで、次の一杯は少しだけ静かに深くなる。SIP Journal は、そんな小さな入口を準備しています。</p>
        </section>
      </main>
    </div>
  `;
}

function renderJournalFeature(article) {
  const isOpen = state.openJournalArticleId === article.id;

  return `
    <article class="journalFeature ${isOpen ? "isOpen" : ""}" aria-label="Journal article ${article.number}">
      <figure class="journalFeatureImage">
        <img src="${article.image}" alt="SIP Journal #${article.number} ${article.title}" loading="${article.number === "001" ? "eager" : "lazy"}">
      </figure>

      <div class="journalFeatureHeader">
        <p>SIP Journal #${article.number}</p>
        <h2>${article.title}</h2>
        <span>${article.subtitle}</span>
      </div>

      <div class="journalExcerpt" aria-hidden="${isOpen ? "true" : "false"}">
        <p>${article.paragraphs[0].replaceAll("\n", "<br>")}</p>
      </div>

      <div class="journalArticlePanel" id="${article.id}-panel" aria-hidden="${isOpen ? "false" : "true"}">
        <div class="journalArticleBody">
          ${article.paragraphs
            .map(
              (paragraph) => `
                <p>${paragraph.replaceAll("\n", "<br>")}</p>
              `,
            )
            .join("")}
        </div>

        <p class="journalArticleClosing">${article.closing}</p>
      </div>

      <button
        class="journalToggle"
        type="button"
        aria-expanded="${isOpen}"
        aria-controls="${article.id}-panel"
        onclick="window.toggleJournalArticle('${article.id}')"
      >
        <span>${isOpen ? "閉じる" : "続きを読む"}</span>
        <span aria-hidden="true">${isOpen ? "▲" : "▼"}</span>
      </button>
    </article>
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

window.addEventListener("hashchange", () => {
  render();
  window.scrollTo({ top: 0, behavior: "instant" });
});

window.toggleJournalArticle = (id) => {
  state.openJournalArticleId = state.openJournalArticleId === id ? null : id;
  render();
};

window.setSipFilter = (type, value) => {
  if (type === "tag") {
    state.activeTag = value;
  } else {
    state.activeArea = value;
  }
  trackAnalyticsEvent("filter_select", {
    filter_type: type,
    filter_value: value,
  });
  render();
  document.getElementById("search").scrollIntoView({ block: "start" });
};

window.toggleSipFavorite = (id) => {
  const wasSaved = state.favorites.includes(id);
  state.favorites = state.favorites.includes(id)
    ? state.favorites.filter((favoriteId) => favoriteId !== id)
    : [...state.favorites, id];
  trackAnalyticsEvent(wasSaved ? "favorite_remove" : "favorite_save", {
    spot_id: id,
  });
  saveFavorites();
  render();
};

window.trackSipExternalLink = (linkType, spotId) => {
  trackAnalyticsEvent("external_link_click", {
    link_type: linkType,
    spot_id: spotId,
  });
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
