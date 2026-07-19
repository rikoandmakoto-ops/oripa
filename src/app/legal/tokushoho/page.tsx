import type { Metadata } from 'next'

import { LegalLayout } from '@/components/legal/LegalLayout'
import { BUSINESS } from '@/lib/legal'

export const metadata: Metadata = { title: '特定商取引法に基づく表示' }

const ROWS: { label: string; value: string }[] = [
  { label: '販売事業者', value: BUSINESS.companyName },
  { label: '運営責任者', value: BUSINESS.representative },
  { label: '所在地', value: BUSINESS.address },
  { label: '電話番号', value: BUSINESS.phone },
  { label: 'メールアドレス', value: BUSINESS.email },
  { label: '受付時間', value: BUSINESS.businessHours },
  {
    label: '古物商許可番号',
    value: `${BUSINESS.antiqueLicenseAuthority} ${BUSINESS.antiqueLicenseNo}`,
  },
  {
    label: '販売価格',
    value:
      '各ポイント購入ページに表示された金額（消費税込）。オリパの利用に必要なポイント数は各オリパページに表示します。',
  },
  {
    label: '商品代金以外の必要料金',
    value:
      'カードの発送を希望される場合の送料（1回の発送につき全国一律 550円・税込）、および決済手数料。インターネット接続に係る通信料はお客様のご負担となります。',
  },
  {
    label: '支払方法',
    value: 'クレジットカード決済（Visa / Mastercard / JCB / American Express）',
  },
  { label: '支払時期', value: 'ポイント購入手続きの完了時に即時決済されます。' },
  {
    label: 'ポイントの有効期限',
    value: '最終利用日から180日間。期限を過ぎたポイントは失効します。',
  },
  {
    label: 'サービス提供時期',
    value:
      'ポイントは決済完了後ただちに付与されます。オリパの抽選結果は抽選実行後ただちに反映されます。',
  },
  {
    label: '商品の引渡時期',
    value:
      '発送を選択された場合、申請確認後7営業日以内に発送します。天候・配送状況により遅れる場合があります。',
  },
  {
    label: '返品・キャンセルについて',
    value:
      'ポイント購入後および抽選実行後のキャンセル・返金・現金への払い戻しは、法令に基づく場合を除き一切お受けできません。商品に破損・汚損があった場合は、到着後7日以内にご連絡ください。当社の負担にて交換または相当ポイントでの補償を行います。',
  },
  {
    label: '動作環境',
    value:
      '最新版の Google Chrome / Safari / Microsoft Edge のいずれかを推奨します。',
  },
  {
    label: '年齢制限',
    value:
      '18歳未満の方はご利用いただけません。未成年者の方は保護者の同意を得たうえでご利用ください。',
  },
]

export default function TokushohoPage() {
  return (
    <LegalLayout title="特定商取引法に基づく表示">
      <div className="overflow-hidden rounded-2xl border border-line">
        <table className="w-full">
          <tbody>
            {ROWS.map((row) => (
              <tr
                key={row.label}
                className="border-b border-line last:border-b-0"
              >
                <th className="w-1/3 bg-surface/60 px-4 py-3 text-left align-top text-xs font-bold text-ink">
                  {row.label}
                </th>
                <td className="px-4 py-3 align-top text-xs leading-relaxed">
                  {row.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </LegalLayout>
  )
}
