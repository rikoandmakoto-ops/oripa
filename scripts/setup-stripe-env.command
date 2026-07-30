#!/bin/bash
# =============================================================
# Stripe の環境変数を設定する（ダブルクリックで実行）
#
#   .env.local（ローカル開発用）と、任意で Vercel（本番）に
#   同じ値を登録する。入力した値は画面に表示されない。
#
#   ここで入力するもの:
#     STRIPE_SECRET_KEY      … ダッシュボード > 開発者 > APIキー
#     STRIPE_WEBHOOK_SECRET  … ダッシュボード > 開発者 > Webhook
#     NEXT_PUBLIC_SITE_URL   … 本番ドメイン（任意）
#
#   詳細は docs/stripe-setup.md を参照。
# =============================================================
set -u
cd "$(dirname "$0")/.." || exit 1

ENV_FILE=".env.local"

echo "======================================================"
echo " Stripe 環境変数セットアップ（ORIPA）"
echo "======================================================"
echo
echo "値は入力しても画面に表示されません（そのまま打って Enter）。"
echo "空のまま Enter を押した項目はスキップします。"
echo

read -r -s -p "STRIPE_SECRET_KEY (sk_test_... / sk_live_...) : " SECRET_KEY
echo
read -r -s -p "STRIPE_WEBHOOK_SECRET (whsec_...)             : " WEBHOOK_SECRET
echo
read -r -p "NEXT_PUBLIC_SITE_URL (例 https://oripa.example.com) : " SITE_URL
echo

# 形式が明らかに違うものは弾く（打ち間違いで動かないのを防ぐ）
if [ -n "$SECRET_KEY" ] && [[ "$SECRET_KEY" != sk_* ]]; then
  echo "❌ STRIPE_SECRET_KEY は sk_ で始まるはずです。中断しました。"
  read -r -p "Enter キーで閉じます..."
  exit 1
fi
if [ -n "$WEBHOOK_SECRET" ] && [[ "$WEBHOOK_SECRET" != whsec_* ]]; then
  echo "❌ STRIPE_WEBHOOK_SECRET は whsec_ で始まるはずです。中断しました。"
  read -r -p "Enter キーで閉じます..."
  exit 1
fi

# -------------------------------------------------------------
# .env.local を書き換える（既存の同名キーは差し替え、他は残す）
# -------------------------------------------------------------
set_env() {
  local key="$1" value="$2"
  [ -z "$value" ] && return 0

  touch "$ENV_FILE"
  # 既存行を消してから追記する
  local tmp
  tmp="$(mktemp)"
  grep -v "^${key}=" "$ENV_FILE" > "$tmp" 2>/dev/null || true
  printf '%s=%s\n' "$key" "$value" >> "$tmp"
  mv "$tmp" "$ENV_FILE"
  echo "  ✓ ${key} を ${ENV_FILE} に書きました"
}

echo
echo "--- ${ENV_FILE} を更新します ---"
if [ -f "$ENV_FILE" ]; then
  cp "$ENV_FILE" "${ENV_FILE}.bak"
  echo "  （念のため ${ENV_FILE}.bak にバックアップしました）"
fi
set_env "STRIPE_SECRET_KEY" "$SECRET_KEY"
set_env "STRIPE_WEBHOOK_SECRET" "$WEBHOOK_SECRET"
set_env "NEXT_PUBLIC_SITE_URL" "$SITE_URL"

# -------------------------------------------------------------
# Vercel（本番）にも入れるか
# -------------------------------------------------------------
echo
if command -v vercel >/dev/null 2>&1; then
  read -r -p "同じ値を Vercel の Production にも登録しますか？ [y/N] : " PUSH
  if [[ "$PUSH" =~ ^[yY]$ ]]; then
    push_vercel() {
      local key="$1" value="$2"
      [ -z "$value" ] && return 0
      # 既存の値があると add は失敗するので、先に消してから入れ直す
      vercel env rm "$key" production --yes >/dev/null 2>&1
      if printf '%s' "$value" | vercel env add "$key" production >/dev/null 2>&1; then
        echo "  ✓ ${key} を Vercel(Production) に登録しました"
      else
        echo "  ✗ ${key} の登録に失敗しました。Vercel の画面から手動で設定してください"
      fi
    }
    echo
    push_vercel "STRIPE_SECRET_KEY" "$SECRET_KEY"
    push_vercel "STRIPE_WEBHOOK_SECRET" "$WEBHOOK_SECRET"
    push_vercel "NEXT_PUBLIC_SITE_URL" "$SITE_URL"
    echo
    echo "  ※ 反映するには再デプロイが必要です。"
  fi
else
  echo "（Vercel CLI が無いので、本番の設定は Vercel の画面から行ってください）"
fi

echo
echo "======================================================"
echo " 完了しました。"
echo
echo " 次にやること:"
echo "   1. Supabase の SQL Editor で"
echo "      supabase/migrations/0002_stripe_payments.sql を実行"
echo "   2. npm run dev を再起動"
echo "   3. ローカルで試すなら scripts/stripe-listen.command を実行"
echo "======================================================"
echo
read -r -p "Enter キーで閉じます..."
