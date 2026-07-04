/**
 * أدوات العميلة — تطبيع رقم الجوال
 */

export function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("966")) digits = "0" + digits.slice(3);
  if (digits.startsWith("5") && digits.length === 9) digits = "0" + digits;
  return digits;
}

export function phonesMatch(a: string, b: string): boolean {
  return normalizePhone(a) === normalizePhone(b);
}

/** رمز تحقق وهمي للتجربة */
export const DEMO_OTP = "1234";
