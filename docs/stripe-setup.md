# Stripe 決済セットアップ手順

ポイントチャージを Stripe Checkout（Stripe がホストする決済ページ）で行う。
カード情報は Stripe 側にしか渡らず、このアプリには一切保存されない。

---

## 1. 全体の流れ

```
[ユーザー] /points でプランを選ぶ
      │
      ▼
POST /api/checkout
      ├─ プラン ID から金額をサーバ側で引き直す（クライアントの申告値は使わない）
      ├─ payments 行を pending で作る（金額・付与ポイントをここに焼く）
      └─ Stripe Checkout Session を作り、その URL へ飛ばす
      │
      ▼
[Stripe の決済ページ] カード入力・支払い
      │
      ├─────────────► /points/complete?session_id=... （画面が戻るだけ。入金の証明ではない）
      │
      ▼
POST /api/stripe/webhook   ← ここだけがポイントを増やせる
      ├─ 署名を検証（通らないリクエストは中身を見ずに 400）
      └─ fulfill_stripe_payment() を呼ぶ
            ├─ payments 行を FOR UPDATE でロック
            ├─ すでに paid なら何もしない ← 二重付与の防波堤
            └─ credit_points() でポイント付与 + payments を paid に更新（同一トランザクション）
```

**ポイントが増えるのは Webhook 経由だけ。** 成功 URL に戻ってきたことは
入金の証明にならない（URL を直接開けば誰でも到達できる）ため、
`/points/complete` は payments の状態を読んで表示しているだけ。

---

## 2. DB マイグレーション

Supabase の **SQL Editor** で以下を順に実行する（既に済んでいるものは飛ばす）。

| 順 | ファイル |
|----|----------|
| 1 | `supabase/schema.sql` |
| 2 | `supabase/functions.sql` |
| 3 | `supabase/migrations/0001_virtual_inventory.sql` |
| 4 | `supabase/migrations/0002_stripe_payments.sql` ← 今回追加 |

`0002` は何度実行しても壊れない（冪等）。追加されるもの:

- `payments` テーブル（Checkout Session 1件につき1行）
- `fulfill_stripe_payment()` … 入金確定 → ポイント付与（冪等）
- `fail_stripe_payment()` … 失敗・期限切れの記録

どちらの関数も `service_role` からしか実行できない。

---

## 3. Stripe ダッシュボードでの作業

1. [dashboard.stripe.com](https://dashboard.stripe.com) でアカウントを作る
2. **まずはテストモード**（画面右上のトグル）で進める
3. **開発者 → APIキー** から「シークレットキー」をコピー → `STRIPE_SECRET_KEY`
   - テスト: `sk_test_...` / 本番: `sk_live_...`
   - 公開可能キー（`pk_...`）はこの実装では使わない。
     Checkout ページへリダイレクトするだけで、ブラウザ側で Stripe.js を使わないため。
4. **開発者 → Webhook → エンドポイントを追加**
   - URL: `https://<本番ドメイン>/api/stripe/webhook`
   - 送信するイベント（4つ）:
     - `checkout.session.completed`
     - `checkout.session.async_payment_succeeded`
     - `checkout.session.async_payment_failed`
     - `checkout.session.expired`
   - 作成後に表示される **署名シークレット**（`whsec_...`）を `STRIPE_WEBHOOK_SECRET` へ
5. **本番申請**（ライブモードを使うには事業者情報の登録・審査が必要）
   - オリパは「デジタルコンテンツ内で使えるポイントの販売」にあたる。
     取扱商材について Stripe から確認が入ることがあるので、
     利用規約・特商法表示ページを公開してから申請すること。

> テストモードと本番モードでキーも Webhook 署名シークレットも別物。
> 本番へ切り替えるときは両方入れ替える。

---

## 4. 環境変数（Vercel に設定するもの）

### 今回の決済で新しく必要なもの

| 変数 | 例 | 対象環境 | 備考 |
|------|----|----------|------|
| `STRIPE_SECRET_KEY` | `sk_live_...` | Production | Preview には `sk_test_...` を入れる |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Production | Webhook エンドポイントごとに違う値 |
| `NEXT_PUBLIC_SITE_URL` | `https://oripa.example.com` | Production | 決済後の戻り先。未設定なら自動判定 |

### すでに必要なもの（未設定なら合わせて登録）

| 変数 | 備考 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | |
| `SUPABASE_SERVICE_ROLE_KEY` | 公開厳禁。Webhook からのポイント付与に必須 |
| `NEXT_PUBLIC_SERVICE_NAME` | 特商法表示 |
| `NEXT_PUBLIC_COMPANY_NAME` | 特商法表示 |
| `NEXT_PUBLIC_REPRESENTATIVE` | 特商法表示 |
| `NEXT_PUBLIC_ADDRESS` | 特商法表示 |
| `NEXT_PUBLIC_PHONE` | 特商法表示 |
| `NEXT_PUBLIC_CONTACT_EMAIL` | 特商法表示 |
| `NEXT_PUBLIC_BUSINESS_HOURS` | 特商法表示 |
| `NEXT_PUBLIC_ANTIQUE_LICENSE_NO` | 古物商許可番号 |
| `NEXT_PUBLIC_ANTIQUE_LICENSE_AUTHORITY` | 交付した公安委員会 |
| `NEXT_PUBLIC_LEGAL_UPDATED` | 規約の最終更新日 |

### 本番で設定してはいけないもの

| 変数 | 理由 |
|------|------|
| `ENABLE_DEV_TOPUP` | 決済なしでポイントを配れてしまう。Production には**入れない**（入っていても `NODE_ENV=production` では無効だが、そもそも登録しない） |

`RESEND_API_KEY` は今回の変更では一切触っていない。

> 設定は Vercel のダッシュボード（Project → Settings → Environment Variables）から
> 画面上で入力できる。ターミナルを使わずに済む。
> ターミナルで一気に入れたい場合は `scripts/setup-stripe-env.command` をダブルクリック。

---

## 5. ローカルでの動作確認

1. `.env.local` に `STRIPE_SECRET_KEY`（テストキー）と `STRIPE_WEBHOOK_SECRET` を入れる
2. `scripts/stripe-listen.command` をダブルクリック
   - Stripe CLI がローカルの `/api/stripe/webhook` にイベントを転送してくれる
   - 起動時に表示される `whsec_...` を `.env.local` の `STRIPE_WEBHOOK_SECRET` に入れて `npm run dev` を再起動
3. ログインして `/points` からプランを選ぶ
4. テストカード `4242 4242 4242 4242` / 有効期限は未来の日付 / CVC は任意の3桁
5. 決済後、`/points/complete` に戻りポイントが増えていれば成功
   - `/points/history` に「ポイントチャージ」と「チャージボーナス」の2行が入る

### 想定どおり動いているかの確認ポイント

- 同じイベントを Stripe CLI から2回送っても、ポイントは1回しか増えない
  （`payments.status = 'paid'` で打ち切られる）
- 決済ページで「戻る」を押すと `/points?canceled=1` に戻り、ポイントは増えない
- 署名が不正なリクエストは 400 で弾かれる

---

## 6. 本番デプロイ手順

1. `supabase/migrations/0002_stripe_payments.sql` を本番 Supabase で実行
2. Vercel に上の環境変数を設定（Production）
3. デプロイ
4. Stripe の Webhook エンドポイントを本番 URL で登録し、署名シークレットを Vercel に反映
5. ライブモードで少額（1,000円プラン）を実際に購入して、
   - ポイントが増えること
   - `payments` が `paid` になっていること
   - Stripe ダッシュボードの Webhook が 200 を返していること
   を確認する

---

## 7. 運用メモ

- **Webhook が失敗したとき**: Stripe は最大3日間再送する。
  一時的な障害なら自動で復旧する。ダッシュボードの Webhook 画面から手動再送も可能。
- **`PAYMENT_NOT_FOUND` が出続ける**: テストモードの Webhook が本番 DB を叩いている、
  または別環境のセッションが混ざっている。エンドポイントの向き先を確認する。
- **`AMOUNT_MISMATCH`**: Stripe 側の請求額と `payments.amount_yen` が食い違っている。
  付与せず 200 を返して止めるようにしてある（要調査の事象）。
- **返金**: 現状は自動でポイントを回収しない。返金した場合は
  管理者が `credit_points()` を負の値で呼んで手動調整すること
  （`refund` タイプで台帳に残る）。

---

## 8. 法務まわりの残タスク

決済を有効にすると、以下は「公開前に必ず」対応が必要になる。

- [ ] 特商法表示（`/legal/tokushoho`）を実際の事業者情報にする
- [ ] 資金決済法の前払式支払手段に該当するか確認する
      （未使用残高が基準額を超えると財務局への届出・供託義務が生じる）
- [ ] 有効期限（現在の表示は「最終利用日から180日」）が
      規約・特商法表示・実装で食い違っていないか確認する
- [ ] 未成年者の課金についての運用を決める
