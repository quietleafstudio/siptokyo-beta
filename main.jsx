
import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

const ratingLabels = [
  "🤫 静かさ",
  "🪑 一人で行きやすい",
  "⌛ 長居しやすい",
  "🌿 やさしい一杯",
  "☕🚫 コーヒーが主役じゃない度",
];

const spots = [
  {
    name: "古桑庵",
    area: "自由が丘",
    type: "日本茶 / 和カフェ",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=%E5%8F%A4%E6%A1%91%E5%BA%B5%20%E8%87%AA%E7%94%B1%E3%81%8C%E4%B8%98",
    tags: ["日本茶", "静か", "一人時間", "長居OK", "やさしい一杯"],
    note: "古民家の静けさで、ゆっくり日本茶を楽しめる Quiet Leaf スポット。",
    ratings: [5, 4, 4, 5, 5],
  },
  {
    name: "nana's green tea 自由が丘",
    area: "自由が丘",
    type: "日本茶 / 抹茶",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=nana%27s%20green%20tea%20%E8%87%AA%E7%94%B1%E3%81%8C%E4%B8%98",
    tags: ["日本茶", "抹茶", "一人時間", "長居OK", "やさしい一杯"],
    note: "日本茶系の選択肢が多く、コーヒー以外を選びやすい。",
    ratings: [2, 4, 4, 4, 5],
  },
  {
    name: "TEA TATAMO! 三軒茶屋店",
    area: "三軒茶屋",
    type: "日本茶 / 候補",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=TEA%20TATAMO%20%E4%B8%89%E8%BB%92%E8%8C%B6%E5%B1%8B%E5%BA%97",
    tags: ["日本茶", "長居OK", "やさしい一杯", "未訪問候補"],
    note: "畳とお茶の雰囲気。体にやさしい一杯を探したい日に。未訪問の候補。",
    ratings: null,
  },
  {
    name: "ocha room ashita ITOEN",
    area: "渋谷",
    type: "日本茶 / 抹茶",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=ocha%20room%20ashita%20ITOEN%20%E6%B8%8B%E8%B0%B7",
    tags: ["日本茶", "抹茶", "やさしい一杯"],
    note: "伊藤園のお茶体験。東京で気軽に日本茶を楽しめる。",
    ratings: [2, 3, 2, 4, 5],
  },
  {
    name: "とらや 髙島屋新宿店",
    area: "新宿",
    type: "和菓子 / 日本茶",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=%E3%81%A8%E3%82%89%E3%82%84%20%E9%AB%99%E5%B3%B6%E5%B1%8B%E6%96%B0%E5%AE%BF%E5%BA%97",
    tags: ["日本茶", "一人時間", "長居OK", "やさしい一杯"],
    note: "和菓子とお茶で落ち着ける、上品な新宿の休憩スポット。",
    ratings: [2, 4, 4, 5, 5],
  },
  {
    name: "MATCHA CAFE | MAME-TO-CHA Shinjuku",
    area: "新宿",
    type: "抹茶 / 日本茶",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=MATCHA%20CAFE%20MAME-TO-CHA%20Shinjuku",
    tags: ["抹茶", "日本茶", "やさしい一杯", "未訪問候補"],
    note: "抹茶好きの友達と行きやすい、新宿の候補。",
    ratings: null,
  },
  {
    name: "アバイブーベ カフェ オーガニックハーブティー",
    area: "東京",
    type: "ハーブティー",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=%E3%82%A2%E3%83%90%E3%82%A4%E3%83%96%E3%83%BC%E3%83%99%20%E3%82%AB%E3%83%95%E3%82%A7%20%E3%82%AA%E3%83%BC%E3%82%AC%E3%83%8B%E3%83%83%E3%82%AF%E3%83%8F%E3%83%BC%E3%83%96%E3%83%86%E3%82%A3%E3%83%BC",
    tags: ["ハーブティー", "やさしい一杯", "未訪問候補"],
    note: "オーガニックハーブティー系。やさしい飲み物を探す日に。",
    ratings: null,
  },
  {
    name: "ロンナムチャ チェンマイ Rong Namcha Chiangmai",
    area: "東京",
    type: "お茶 / ハーブ系",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=%E3%83%AD%E3%83%B3%E3%83%8A%E3%83%A0%E3%83%81%E3%83%A3%20%E3%83%81%E3%82%A7%E3%83%B3%E3%83%9E%E3%82%A4%20Rong%20Namcha%20Chiangmai",
    tags: ["ハーブティー", "やさしい一杯", "未訪問候補"],
    note: "個性派のお茶スポット。SIPTokyoらしい発見枠。",
    ratings: null,
  },
  {
    name: "木馬®︎",
    area: "東京",
    type: "カフェ / お茶",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=%E6%9C%A8%E9%A6%AC%20%E6%9D%B1%E4%BA%AC%20%E3%82%AB%E3%83%95%E3%82%A7",
    tags: ["静か", "一人時間", "やさしい一杯", "未訪問候補"],
    note: "落ち着いた雰囲気を期待したい候補。詳細確認したいスポット。",
    ratings: null,
  },
  {
    name: "うつわカフェ茶簞笥 Café Cha Dance",
    area: "東京",
    type: "日本茶 / うつわカフェ",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=%E3%81%86%E3%81%A4%E3%82%8F%E3%82%AB%E3%83%95%E3%82%A7%E8%8C%B6%E7%B0%9E%E7%AC%A5%20Caf%C3%A9%20Cha%20Dance",
    tags: ["日本茶", "静か", "やさしい一杯", "未訪問候補"],
    note: "うつわとお茶の世界観。Quiet Leaf に合いそうな候補。",
    ratings: null,
  },
];

const filters = ["日本茶", "ハーブティー", "抹茶", "静か", "一人時間", "長居OK", "やさしい一杯", "未訪問候補"];

function renderStars(value) {
  return "★".repeat(value) + "☆".repeat(5 - value);
}

function App() {
  const [active, setActive] = useState("すべて");
  const [query, setQuery] = useState("");

  const filteredSpots = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return spots.filter((spot) => {
      const matchesFilter = active === "すべて" || spot.tags.includes(active);
      const searchableText = [spot.name, spot.area, spot.type, spot.note, ...spot.tags].join(" ").toLowerCase();
      const matchesQuery = normalizedQuery === "" || searchableText.includes(normalizedQuery);
      return matchesFilter && matchesQuery;
    });
  }, [active, query]);

  return (
    <div className="page">
      <header className="hero">
        <p className="eyebrow">Quiet Leaf 🌿</p>
        <h1>SIPTokyo</h1>
        <p className="headline">コーヒーが主役じゃない店を探すなら。</p>
        <p className="sub">Where tea comes first. 🌿</p>
        <div className="badge">Beta · {spots.length} spots</div>
      </header>

      <section className="searchBox">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="エリアやお茶で検索（例：渋谷、ハーブ、静か）"
        />
        <div className="filters">
          <button className={active === "すべて" ? "active" : ""} onClick={() => setActive("すべて")}>すべて</button>
          {filters.map((filter) => (
            <button key={filter} className={active === filter ? "active" : ""} onClick={() => setActive(filter)}>
              {filter}
            </button>
          ))}
        </div>
      </section>

      <main className="layout">
        <section className="mapPlaceholder">
          <div>
            <div className="cup">🍵</div>
            <h2>カード一覧 + Google Mapsリンク</h2>
            <p>まずはAPIなしで軽く公開。各カードからGoogle Mapsを開けます。</p>
          </div>
        </section>

        <section className="cards">
          <div className="cardsHeader">
            <h2>Quiet Leafスポット</h2>
            <span>{filteredSpots.length}件</span>
          </div>

          {filteredSpots.length === 0 ? (
            <div className="empty">条件に合うスポットが見つかりませんでした。</div>
          ) : (
            filteredSpots.map((spot) => (
              <article key={spot.name} className="card">
                <div className="cardTop">
                  <div>
                    <h3>{spot.name}</h3>
                    <p>{spot.area} · {spot.type}</p>
                  </div>
                  <span>{spot.ratings ? "Verified" : "候補"}</span>
                </div>

                <p className="note">{spot.note}</p>

                {spot.ratings ? (
                  <div className="ratings">
                    {ratingLabels.map((label, index) => (
                      <div key={label} className="ratingRow">
                        <span>{label}</span>
                        <strong>{renderStars(spot.ratings[index])}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="candidate">まだ未訪問の候補です。行ったら評価を追加します。</div>
                )}

                <div className="tags">
                  {spot.tags.map((tag) => <span key={tag}>{tag}</span>)}
                </div>

                <a className="mapsButton" href={spot.mapsUrl} target="_blank" rel="noreferrer">
                  🗺️ Google Mapsで開く
                </a>
              </article>
            ))
          )}
        </section>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
