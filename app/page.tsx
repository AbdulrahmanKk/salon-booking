import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center gap-10 py-12 text-center">
      <div className="card max-w-2xl border-soft-blush">
        <p className="mb-2 text-sm text-soft-accent font-medium">الرياض — خدمات منزلية</p>
        <h1 className="mb-4 text-4xl font-bold leading-relaxed text-salon-text">
          سوفت مومنت
        </h1>
        <p className="mb-2 text-lg text-soft-accent">لحظة هدوء وجمال في بيتكِ</p>
        <p className="mb-8 text-salon-mauve leading-8">
          أظافر · مساج · مكياج · شعر — فريق محترف يزوركِ في منزلكِ براحة وخصوصية.
        </p>
        <Link href="/book" className="btn-primary text-lg">
          احجزي الآن
        </Link>
      </div>

      <div className="grid w-full max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: "💅", title: "الأظافر", desc: "منيكير · بديكير · ألوان" },
          { icon: "💆", title: "المساج", desc: "سويدي · استرخاء · إضافات" },
          { icon: "💄", title: "المكياج", desc: "عروس · سهرة · بكجات" },
          { icon: "💇‍♀️", title: "الشعر", desc: "عروس · سهرة · بكجات" },
        ].map((item) => (
          <div key={item.title} className="card text-center">
            <div className="mb-2 text-3xl">{item.icon}</div>
            <h3 className="font-semibold">{item.title}</h3>
            <p className="text-sm text-salon-mauve">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
