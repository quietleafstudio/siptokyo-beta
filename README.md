# SIPTokyo beta

コーヒーが主役じゃない店を探すなら。

Where tea comes first. 🌿

## 店舗データの追加

店舗情報は `public/spots.json` で管理しています。
公開後に店舗を追加する時は、このJSON配列に1店舗分のオブジェクトを追加してください。

主な項目:

- `id`: お気に入り保存に使う一意のID
- `name`: 店名
- `area`: エリア
- `address`: 住所
- `station`: 最寄駅
- `walk`: 徒歩分数
- `genre`: ジャンル
- `tags`: 検索タグ
- `comment`: カードに出す一言コメント
- `mapsUrl`: Google Maps URL
- `image`: 写真URL、または `public/images` 内の画像ファイル名
- `officialUrl`: 公式HP URL
- `instagramUrl`: Instagram URL
- `menuUrl`: メニューURL
- `menuSummary`: メニュー要約の配列。例: `["抹茶あり", "カフェ利用OK"]`
- `priceRange`: 価格帯
- `cautionNote`: 注意メモ。例: `ランチまたは日本茶飲み比べコース中心。ふらっと一杯利用は事前確認がおすすめ。`

`image` が空の場合は、緑系のプレースホルダーで表示されます。
メニュー関連の項目は、値が入っている場合だけ店舗カードに小さく表示されます。

## SIP Studio Research

候補店舗のモックリサーチ画面は `studio.html` です。
外部APIなしで、エリア × ジャンルから20件の候補カードを生成します。
