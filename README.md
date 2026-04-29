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

`image` が空の場合は、緑系のプレースホルダーで表示されます。
