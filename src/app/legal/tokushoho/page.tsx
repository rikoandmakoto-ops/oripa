import type { Metadata } from 'next'

import { LegalLayout } from '@/components/legal/LegalLayout'
import { BUSINESS, TERMS, isPlaceholder } from '@/lib/legal'

export const metadata: Metadata = { title: '特定商取引法に基づく表示' }

const EXPIRY_MONTHS = Math.round(TERMS.pointExpiryDays / 30)
const SHIPPING_FEE = TERMS.shippingFeeYen.toLocaleString('ja-JP')

type Row = { label: string; value: React.ReactNode; raw?: string }

const ROWS: Row[] = [
  { label: '販売事業者', value: BUSINESS.companyName, raw: BUSINESS.companyName },
  {
    label: '運営統括責任者',
    value: BUSINESS.representative,
    raw: BUSINESS.representative,
  },
  { label: '所在地', value: BUSINESS.address, raw: BUSINESS.address },
  {
    label: '電話番号',
    value: (
      <>
        {BUSINESS.phone}
        <br />
        <span className="text-ink-dim">
          お問い合わせはメールにて承っております。お電話でのご請求があった場合は、
          遅滞なく開示いたします。
        </span>
      </>
    ),
    raw: BUSINESS.phone,
  },
  { label: 'メールアドレス', value: BUSINESS.email, raw: BUSINESS.email },
  { label: '受付時間', value: BUSINESS.businessHours },
  {
    label: '古物商許可番号',
    value: `${BUSINESS.antiqueLicenseAuthority} ${BUSINESS.antiqueLicenseNo}`,
    raw: BUSINESS.antiqueLicenseNo,
  },
  {
    label: '販売価格',
    value: (
      <>
        本サービスは、あらかじめポイントをご購入いただき、ポイントを消費してオリパの
        抽選を行うポイント制です。ポイントの価格は各ポイント購入ページに表示された金額
        （消費税込）とします。オリパ1口あたりに必要なポイント数は、各オリパのページに
        表示します。
      </>
    ),
  },
  {
    label: '商品代金以外に必要な料金',
    value: (
      <>
        カードの発送をご希望の場合の送料：1回の発送につき全国一律 {SHIPPING_FEE}
        円（税込）。
        <br />
        インターネット接続に係る通信料および決済手段に係る手数料は、
        お客様のご負担となります。
      </>
    ),
  },
  {
    label: '支払方法',
    value: (
      <>
        クレジットカード決済（Visa / Mastercard / JCB / American Express）
        <br />
        <span className="text-ink-dim">
          ※ クレジットカード決済はPhase 2にて提供開始予定です。
        </span>
      </>
    ),
  },
  {
    label: '支払時期',
    value: 'ポイント購入手続きの完了時に即時決済されます。',
  },
  {
    label: '申込みの有効期限',
    value:
      'ポイント購入手続きの開始後30分以内に決済が完了しない場合、当該申込みは無効となります。',
  },
  {
    label: 'ポイントの有効期限',
    value: (
      <>
        ポイントが付与された日から{TERMS.pointExpiryDays}日間（約{EXPIRY_MONTHS}
        か月）。期限を経過したポイントは失効します。有効期限は、その後のポイントの
        購入または利用によって延長されません。
      </>
    ),
  },
  {
    label: 'サービスの提供時期',
    value:
      'ポイントは決済の完了後ただちに付与されます。オリパの抽選結果は、抽選の実行後ただちに反映されます。',
  },
  {
    label: '商品の引渡時期',
    value: (
      <>
        当選確定後、お客様が発送を申請された時点から仕入先への発注を行い、調達の完了次第
        発送いたします。発送までの所要期間は
        <strong className="font-bold text-ink">{TERMS.shippingLeadTime}</strong>
        を目安とします。天候、配送事情または仕入先の在庫状況により、
        前後する場合があります。
      </>
    ),
  },
  {
    label: '返品・交換・キャンセル',
    value: (
      <>
        本サービスはデジタルサービスの性質を有するため、
        <strong className="font-bold text-ink">
          抽選の実行後のキャンセル、返品および返金は一切お受けできません。
        </strong>
        ポイント購入後の現金への払い戻しも、法令に基づく場合を除きお受けできません。
        <br />
        <br />
        ただし、次の場合は当社が対応いたします。
        <br />
        ・調達失敗の場合：発送申請から{TERMS.procurementDeadlineDays}
        日以内に現物を調達できなかったときは、当該カードのポイント価値を
        <strong className="font-bold text-ink">全額返還</strong>いたします。
        <br />・商品に破損、汚損または相違があった場合：到着後
        {TERMS.damageClaimDays}
        日以内にご連絡ください。当社の負担にて交換または相当ポイントでの補償を行います。
      </>
    ),
  },
  {
    label: '動作環境',
    value:
      '最新版の Google Chrome / Safari / Microsoft Edge のいずれかを推奨します。JavaScript および Cookie を有効にしてご利用ください。',
  },
  {
    label: '年齢制限',
    value:
      '18歳未満の方はご利用いただけません。18歳以上20歳未満の方は、法定代理人の同意を得たうえでご利用ください。',
  },
]

export default function TokushohoPage() {
  return (
    <LegalLayout title="特定商取引法に基づく表示">
      {/*
        表形式だとモバイルで見出し列が潰れるので、dl を使って
        モバイルでは縦積み、sm 以上で 1:2 の二列に切り替える。
      */}
      <dl className="overflow-hidden rounded-2xl border border-line">
        {ROWS.map((row) => (
          <div
            key={row.label}
            className="border-b border-line last:border-b-0 sm:grid sm:grid-cols-[minmax(8rem,1fr)_2fr]"
          >
            <dt className="bg-surface/60 px-4 py-3 text-xs font-bold text-ink">
              {row.label}
              {row.raw && isPlaceholder(row.raw) && (
                <span className="ml-1.5 font-normal text-gold">（未設定）</span>
              )}
            </dt>
            <dd className="px-4 pb-3 pt-1 text-xs leading-relaxed sm:py-3">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      <p className="text-xs text-ink-dim">
        本表示に関するお問い合わせは、上記のメールアドレスまでご連絡ください。
        請求があった場合には、遅滞なく法令に定める事項を電磁的方法により提供いたします。
      </p>
    </LegalLayout>
  )
}
