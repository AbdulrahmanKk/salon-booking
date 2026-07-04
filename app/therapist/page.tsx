import TherapistPanel from "@/components/TherapistPanel";

export const metadata = { title: "لوحة الثيرابست — سوفت مومنت" };

export default function TherapistPage() {
  return (
    <div>
      <h1 className="mb-2 text-3xl font-bold">لوحة الثيرابست</h1>
      <p className="mb-8 text-salon-mauve">مواعيد اليوم · المواقع · تحديث الحالة</p>
      <TherapistPanel />
    </div>
  );
}
