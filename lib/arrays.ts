/** مصفوفة آمنة — ترجع [] إذا كانت القيمة undefined أو ليست مصفوفة */
export function asArray<T>(value: T[] | null | undefined | unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}
