import Link from "next/link";
import { SECTIONS } from "@/lib/sections";

export default function HomePage() {
  const cards = [
    SECTIONS.makeup,
    SECTIONS.hair,
    SECTIONS["nails-massage"],
  ];

  return (
    <div className="mx-auto max-w-wide px-6 py-16 md:px-10 md:py-24">
      <div className="mx-auto max-w-page text-center">
        <h1 className="page-title">احجزي خدمة مع</h1>
        <p className="page-subtitle">اختيار القسم ثم الخدمة والموعد</p>
      </div>

      <div className="mx-auto mt-16 grid max-w-page gap-6 md:mt-20">
        {cards.map((section) => (
          <Link
            key={section.slug}
            href={`/book/${section.slug}`}
            className="card-hover group text-center"
          >
            <h2 className="text-2xl font-light md:text-3xl">{section.title}</h2>
            <p className="mt-2 text-sm text-sm-muted group-hover:text-sm-text">
              {section.subtitle}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
