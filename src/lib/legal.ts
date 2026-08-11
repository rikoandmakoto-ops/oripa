/**
 * 法定表示に使う事業者情報。
 *
 * ここの値は必ず実際の情報に差し替えてください（.env.local か直接編集）。
 * 未設定のまま公開すると特定商取引法違反になります。
 *
 * 未設定の項目は「（〜してください）」形式のプレースホルダのままになり、
 * isPlaceholder() / missingBusinessFields() で検出できます。
 * 法的ページの警告バナーはこの検出結果に連動します。
 */
export const BUSINESS = {
  serviceName: process.env.NEXT_PUBLIC_SERVICE_NAME || 'ORIPA',
  companyName: process.env.NEXT_PUBLIC_COMPANY_NAME || '（事業者名を設定してください）',
  representative:
    process.env.NEXT_PUBLIC_REPRESENTATIVE || '（代表者名を設定してください）',
  address: process.env.NEXT_PUBLIC_ADDRESS || '（所在地を設定してください）',
  phone: process.env.NEXT_PUBLIC_PHONE || '（電話番号を設定してください）',
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || '（連絡先メールを設定してください）',
  antiqueLicenseNo:
    process.env.NEXT_PUBLIC_ANTIQUE_LICENSE_NO ||
    '（古物商許可番号を設定してください）',
  antiqueLicenseAuthority:
    process.env.NEXT_PUBLIC_ANTIQUE_LICENSE_AUTHORITY || '（公安委員会名）',
  businessHours: process.env.NEXT_PUBLIC_BUSINESS_HOURS || '平日 10:00–18:00',
  lastUpdated: process.env.NEXT_PUBLIC_LEGAL_UPDATED || '2026-07-20',
} as const

/**
 * 取引条件の数値。規約・特商法表示・実装で数字がずれると事故になるので、
 * 文面に直接書かずここを参照すること。
 */
export const TERMS = {
  /**
   * ポイントの有効期限（日数）。
   *
   * 資金決済法上の前払式支払手段は、発行の日から6か月以内に限り使用できるもの
   * であれば適用除外（同法4条2号）。この除外を維持するため、
   *  - 起算日は「購入日（発行日）」であること
   *  - 180日を超えないこと
   * の2点を必ず守る。利用のたびに期限が延びる設計にすると除外を外れ、
   * 発行保証金の供託・財務局への届出義務が発生する。
   */
  pointExpiryDays: 180,
  /** 1ポイントあたりの円換算。src/lib/procurement の YEN_PER_POINT と一致させる。 */
  yenPerPoint: 1,
  /** 発送1回あたりの送料（円・税込） */
  shippingFeeYen: 550,
  /** 発送申請から発送までの目安 */
  shippingLeadTime: '1〜2週間',
  /** 調達失敗を確定させ、ポイントを返還するまでの上限日数 */
  procurementDeadlineDays: 14,
  /** 商品の破損・汚損を申し出られる期限（到着後の日数） */
  damageClaimDays: 7,
} as const

/** 値が未設定（プレースホルダのまま）かどうか */
export function isPlaceholder(value: string): boolean {
  return value.startsWith('（')
}

/** 法定表示に必須の項目のうち、未設定のもののラベル一覧 */
export function missingBusinessFields(): string[] {
  const required: { label: string; value: string }[] = [
    { label: '事業者名', value: BUSINESS.companyName },
    { label: '代表者名', value: BUSINESS.representative },
    { label: '所在地', value: BUSINESS.address },
    { label: '電話番号', value: BUSINESS.phone },
    { label: 'メールアドレス', value: BUSINESS.email },
    { label: '古物商許可番号', value: BUSINESS.antiqueLicenseNo },
  ]
  return required.filter((f) => isPlaceholder(f.value)).map((f) => f.label)
}
