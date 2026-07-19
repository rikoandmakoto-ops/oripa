/**
 * 法定表示に使う事業者情報。
 *
 * ここの値は必ず実際の情報に差し替えてください（.env.local か直接編集）。
 * 未設定のまま公開すると特定商取引法違反になります。
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
  lastUpdated: process.env.NEXT_PUBLIC_LEGAL_UPDATED || '2026-07-19',
} as const

/** 値が未設定（プレースホルダのまま）かどうか */
export function isPlaceholder(value: string): boolean {
  return value.startsWith('（')
}
