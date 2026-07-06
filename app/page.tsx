import Link from "next/link";
import { SECTIONS } from "@/lib/sections";

const HOME_CARDS = [
  { slug: "makeup" as const, label: "ميكاب ارتست — خلود الهداب" },
  { slug: "hair" as const, label: "هير ستايل — سارة الهداب" },
  { slug: "nails-massage" as const, label: "خدمات الأظافر والمساج" },
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-wide px-6 py-16 md:px-10 md:py-24">
      <div className="mx-auto max-w-page text-center">
        <h1 className="page-title">Soft Moments</h1>
      </div>

      <div className="mx-auto mt-16 grid max-w-page gap-6 md:mt-20">
        {HOME_CARDS.map(({ slug, label }) => (
          <Link
            key={slug}
            href={`/book/${slug}`}
            className="card-hover group text-center"
          >
            <h2 className="text-2xl font-light md:text-3xl">{label}</h2>
          </Link>
        ))}
      </div>
    </div>
  );
}
