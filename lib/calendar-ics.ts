import type { BookingWithServices } from "./types";
import { formatServicesSummary } from "./types";

function toIcsDate(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

/** توليد ملف ICS لحجز واحد */
export function buildBookingIcs(booking: BookingWithServices): string {
  const start = new Date(booking.start_time);
  const end = new Date(booking.end_time);
  const summary = `حجز — ${booking.customer_name || "عميلة"}`;
  const description = [
    formatServicesSummary(booking.services),
    booking.customer_phone ? `جوال: ${booking.customer_phone}` : "",
    booking.customer_notes || "",
  ]
    .filter(Boolean)
    .join("\\n");

  const uid = `${booking.id}@soft-moments`;

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Soft Moments//Booking//AR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(start)}`,
    `DTEND:${toIcsDate(end)}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description.replace(/\n/g, "\\n")}`,
    booking.location_url ? `LOCATION:${booking.location_url}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}

/** تنزيل ICS — يفتح في تطبيق التقويم على الجهاز */
export function downloadBookingIcs(booking: BookingWithServices): void {
  const ics = buildBookingIcs(booking);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `soft-moments-${booking.id.slice(0, 8)}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
