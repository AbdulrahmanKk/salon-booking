import AdminPanel from "@/components/AdminPanel";

export const metadata = {
  title: "إدارة سوفت مومنت",
};

export default function AdminPage() {
  return (
    <div>
      <h1 className="mb-2 text-3xl font-bold">إدارة سوفت مومنت</h1>
      <p className="mb-8 text-salon-mauve">تقويم + جدول — إضافة حجوزات يدوية</p>
      <AdminPanel />
    </div>
  );
}
