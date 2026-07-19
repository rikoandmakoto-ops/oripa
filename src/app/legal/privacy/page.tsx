import type { Metadata } from 'next'

import { LegalLayout, Section } from '@/components/legal/LegalLayout'
import { BUSINESS } from '@/lib/legal'

export const metadata: Metadata = { title: 'プライバシーポリシー' }

export default function PrivacyPage() {
  return (
    <LegalLayout title="プライバシーポリシー">
      <p>
        {BUSINESS.companyName}（以下「当社」）は、「{BUSINESS.serviceName}」
        （以下「本サービス」）における利用者の個人情報の取扱いについて、
        以下のとおりプライバシーポリシーを定めます。
      </p>

      <Section heading="1. 取得する情報">
        <p>当社は、本サービスの提供にあたり以下の情報を取得します。</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>メールアドレス（アカウント登録時）</li>
          <li>表示名・アバター画像（利用者が設定した場合）</li>
          <li>
            氏名・郵便番号・住所・電話番号（カードの発送を申請した場合に限る）
          </li>
          <li>ポイントの購入・利用履歴、オリパの抽選履歴</li>
          <li>
            アクセスログ（IPアドレス、ブラウザの種類、アクセス日時等）
          </li>
        </ul>
        <p>
          クレジットカード番号等の決済情報は決済代行会社が直接取得・処理するものであり、
          当社が保持することはありません。
        </p>
      </Section>

      <Section heading="2. 利用目的">
        <ul className="ml-5 list-disc space-y-1">
          <li>本サービスの提供・本人確認・アカウント管理</li>
          <li>当選カードの発送および配送状況の連絡</li>
          <li>ポイントの管理および決済処理</li>
          <li>お問い合わせへの対応</li>
          <li>不正利用の検知・防止</li>
          <li>
            サービス改善のための統計データの作成（個人を特定できない形式に加工します）
          </li>
          <li>法令に基づく対応</li>
        </ul>
      </Section>

      <Section heading="3. 第三者提供">
        <p>
          当社は、以下の場合を除き、あらかじめ利用者の同意を得ることなく
          個人情報を第三者に提供しません。
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>法令に基づく場合</li>
          <li>人の生命、身体または財産の保護のために必要がある場合</li>
          <li>
            利用目的の達成に必要な範囲で業務を委託する場合（配送業者・決済代行会社等）
          </li>
        </ul>
      </Section>

      <Section heading="4. 業務委託先">
        <p>
          当社は、本サービスの運営にあたり以下の外部サービスを利用しています。
          各社のプライバシーポリシーもあわせてご確認ください。
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>Supabase（認証基盤・データベース・ファイル保管）</li>
          <li>Vercel（アプリケーションのホスティング）</li>
          <li>Stripe（クレジットカード決済の処理）</li>
        </ul>
      </Section>

      <Section heading="5. Cookie の利用">
        <p>
          本サービスは、ログイン状態の維持のために Cookie を使用します。
          これらは本サービスの動作に必要なものであり、無効にすると
          ログインできなくなる場合があります。
        </p>
      </Section>

      <Section heading="6. 保有期間">
        <p>
          個人情報は利用目的の達成に必要な期間保有します。
          ただし、取引記録については、法令に定める期間（原則7年間）保存します。
        </p>
      </Section>

      <Section heading="7. 開示・訂正・削除の請求">
        <p>
          利用者は、当社が保有する自己の個人情報について、開示・訂正・利用停止・削除を
          請求することができます。ご請求は下記の窓口までご連絡ください。
          ご本人であることを確認のうえ、法令に従い対応します。
        </p>
      </Section>

      <Section heading="8. 安全管理措置">
        <p>
          当社は、個人情報への不正アクセス・紛失・改ざん・漏えいを防止するため、
          通信の暗号化、アクセス権限の管理、行単位のアクセス制御等の措置を講じます。
        </p>
      </Section>

      <Section heading="9. ポリシーの変更">
        <p>
          当社は、必要に応じて本ポリシーを変更します。
          変更後の内容は本ページに掲示した時点から効力を生じます。
        </p>
      </Section>

      <Section heading="10. お問い合わせ窓口">
        <p>
          {BUSINESS.companyName}
          <br />
          {BUSINESS.address}
          <br />
          {BUSINESS.email}
          <br />
          受付時間：{BUSINESS.businessHours}
        </p>
      </Section>
    </LegalLayout>
  )
}
