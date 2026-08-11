# 仮在庫モデル Phase 2：仕入れ先の自動巡回（設計のみ・未実装）

Phase 1 は仕入れ先の登録も在庫・価格の更新もすべて管理者の手入力。
Phase 2 でここを自動化する。**この文書は設計だけで、コードはまだ書いていない。**

## 全体像

```
Vercel Cron (1日2回)
      │
      ▼
POST /api/cron/crawl-sources        ← CRON_SECRET で保護
      │
      ├─ card_sources から is_active な行を shop_code ごとに取り出す
      ├─ shop_code に対応する Adapter を呼ぶ（並列度は shop ごとに制限）
      ├─ card_sources.price / stock_status / last_checked_at を更新
      │     └─ 値が動いた行だけ price_history にトリガで積まれる
      └─ 在庫切れになった仕入れ先が「そのカードの最後の1件」だったら管理者に通知
```

`price_history` への書き込みは `card_sources` の after-insert/update トリガが
やるので、巡回側は `card_sources` を UPDATE するだけでよい。
同じ値が返ってきた場合はトリガ側で弾かれるので履歴は膨らまない。

## Adapter インターフェース

`src/lib/procurement/adapters.ts` に型だけ置いてある。

```ts
type SourceProbe = {
  price: number | null
  stock_status: SourceStockStatus
  fetched_at: string
}

interface ShopAdapter {
  code: ShopCode
  kind: 'api' | 'scrape'
  /** 同時実行数。相手のサーバに負荷をかけないための上限。 */
  concurrency: number
  probe(url: string): Promise<SourceProbe>
}
```

失敗したら例外を投げず `stock_status: 'unknown'` を返す。
巡回が1件コケても他が止まらないようにするため。
`unknown` は `bestSource()` で除外されないので、
**取得失敗をそのまま在庫切れ扱いにしない**（誤返還を防ぐ）。

## ショップ別

| shop_code  | 方式   | 実装メモ |
| ---------- | ------ | -------- |
| `yahoo`    | API    | Yahoo!ショッピング 商品検索API。`appid` を `YAHOO_APP_ID` に置く。JANコード or 商品コードで引ければ最も安定。レート制限に注意。 |
| `yuyutei`  | scrape | 商品ページのHTMLから価格と在庫表記を抽出。DOM構造の変更で壊れるので、パースに失敗したら `unknown` を返して管理画面に「要確認」を出す。 |
| `cardrush` | scrape | 同上。カート投入可否で在庫を判定するのが確実だが、まずは在庫表記で十分。 |
| `toretoku` | scrape | 同上。買取メインのサイトなので、販売在庫が取れるページかを事前に確認する。 |

## スクレイピング時の約束

- 各サイトの `robots.txt` と利用規約を必ず確認してから実装する。
  禁止されているサイトは Phase 2 でも手動運用のままにする。
- User-Agent に連絡先を入れる。
- 1商品あたり最短でも数秒空ける（`concurrency` で制御）。
- 巡回は1日2回程度。当選直後のリアルタイム取得はしない
  （調達判断は人間がやるので、鮮度より相手サイトへの負荷を優先する）。

## 通知（未実装）

`RESEND_API_KEY` は既存の用途で使われているのでここでは触らない。
Phase 2 で調達アラートを出す場合も、既存の送信まわりは変更せず
別途 Cron から呼ぶだけにする。

## 未決事項

- 為替・送料・手数料を原価に含めるか（今は商品価格のみ）
- 同一カードが複数パックにまたがる場合、`card_sources` を
  カード単位ではなくカタログ（マスターカード）単位に正規化するか
