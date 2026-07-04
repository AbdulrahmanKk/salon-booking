/**
 * أدوات واتساب — تنسيق الرقم وبناء رابط الإرسال
 */

/** تحويل رقم سعودي إلى صيغة wa.me (9665xxxxxxxx) */
export function formatPhoneForWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("966")) return digits;
  if (digits.startsWith("0")) return `966${digits.slice(1)}`;
  if (digits.startsWith("5") && digits.length === 9) return `966${digits}`;
  return digits;
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const num = formatPhoneForWhatsApp(phone);
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
}

/** رسالة جاهزة لإرسال كرت الإهداء للمُهدى لها */
export function buildGiftWhatsAppMessage(input: {
  recipientName: string;
  gifterName: string;
  servicesSummary: string;
  message: string;
  occasionDate?: string | null;
  bookUrl?: string;
}): string {
  const lines = [
    `مرحباً ${input.recipientName}! 🌸`,
    "",
    `${input.gifterName} أهدتكِ لحظة استرخاء في صالون بيوتي:`,
    `✨ ${input.servicesSummary}`,
  ];
  if (input.occasionDate) {
    lines.push(`📅 مناسبة: ${input.occasionDate}`);
  }
  if (input.message.trim()) {
    lines.push("", `💌 "${input.message.trim()}"`);
  }
  lines.push(
    "",
    "احجزي موعدكِ لاحقاً عبر موقعنا:",
    input.bookUrl ?? "http://localhost:3000/book",
    "",
    "مع أطيب التمنيات،",
    "سوفت مومنت 🌿",
  );
  return lines.join("\n");
}
