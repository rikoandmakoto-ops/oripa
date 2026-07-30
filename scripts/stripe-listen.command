#!/bin/bash
# =============================================================
# ローカルで Stripe の Webhook を受け取る（ダブルクリックで実行）
#
#   Stripe はインターネット越しにしかイベントを送れないので、
#   ローカル開発では Stripe CLI に転送してもらう必要がある。
#
#   このウィンドウは開いたままにしておくこと。閉じると転送が止まる。
# =============================================================
set -u
cd "$(dirname "$0")/.." || exit 1

PORT="${1:-3000}"

echo "======================================================"
echo " Stripe Webhook 転送（ORIPA）"
echo "======================================================"
echo

if ! command -v stripe >/dev/null 2>&1; then
  echo "❌ Stripe CLI が入っていません。"
  echo
  echo "   このウィンドウに次の1行を貼り付けて Enter を押すとインストールできます:"
  echo
  echo "      brew install stripe/stripe-cli/stripe"
  echo
  echo "   Homebrew 自体が入っていない場合は https://brew.sh を先に。"
  echo
  read -r -p "Enter キーで閉じます..."
  exit 1
fi

echo "① Stripe にログインします（ブラウザが開きます）"
echo "   すでにログイン済みなら、そのまま次へ進みます。"
echo
stripe config --list >/dev/null 2>&1 || stripe login

echo
echo "② http://localhost:${PORT}/api/stripe/webhook へ転送を開始します。"
echo
echo "   ⚠️ 下に表示される whsec_ で始まる文字列を .env.local の"
echo "      STRIPE_WEBHOOK_SECRET に貼り付けて、npm run dev を再起動してください。"
echo "      （この値は stripe listen を起動するたびに変わることがあります）"
echo
echo "------------------------------------------------------"
echo

stripe listen \
  --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired \
  --forward-to "localhost:${PORT}/api/stripe/webhook"

echo
read -r -p "終了しました。Enter キーで閉じます..."
