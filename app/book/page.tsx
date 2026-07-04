import BookingForm from "@/components/BookingForm";

export const metadata = {
  title: "احجزي الآن — سوفت مومنت",
};

export default function BookPage() {
  return (
    <div>
      <h1 className="mb-2 text-3xl font-bold">احجزي موعدكِ</h1>
      <p className="mb-8 text-salon-mauve">
        اختاري القسم — أظافر · مكياج · شعر · مساج — ثم أكّدي موعدكِ
      </p>
      <BookingForm />
    </div>
  );
}
