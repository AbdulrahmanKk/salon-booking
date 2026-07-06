import type { ScheduleGroup, ServiceCategory } from "./types";

export type SectionSlug = "makeup" | "hair" | "nails-massage";

export interface SectionConfig {
  slug: SectionSlug;
  scheduleGroup: ScheduleGroup;
  title: string;
  subtitle: string;
  artist?: string;
  categories: ServiceCategory[];
  footnote: string;
}

export const SECTIONS: Record<SectionSlug, SectionConfig> = {
  makeup: {
    slug: "makeup",
    scheduleGroup: "khulood",
    title: "مكياج",
    subtitle: "خلود الهداب",
    artist: "خلود الهداب",
    categories: ["makeup"],
    footnote:
      "الأسعار مكياج فقط — الشعر عند الطلب. زيادة 200 ريال لبعض أحياء الرياض (جنوب · شرق · غرب).",
  },
  hair: {
    slug: "hair",
    scheduleGroup: "sarah",
    title: "هير ستايل",
    subtitle: "سارة الهداب",
    artist: "سارة الهداب",
    categories: ["hair"],
    footnote:
      "الأسعار شعر فقط. تختلف حسب العمر وطول الشعر — التأكيد النهائي مع الأرتست. زيادة 100 ريال لبعض أحياء الرياض.",
  },
  "nails-massage": {
    slug: "nails-massage",
    scheduleGroup: "nails-massage",
    title: "أظافر ومساج",
    subtitle: "خدمات منزلية",
    categories: ["nails", "massage"],
    footnote: "رسوم توصيل 50 ريال تُضاف على الإجمالي.",
  },
};

export function sectionFromSlug(slug: string): SectionConfig | null {
  return SECTIONS[slug as SectionSlug] ?? null;
}
