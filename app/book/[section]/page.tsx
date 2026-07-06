import { notFound } from "next/navigation";
import SectionBookingForm from "@/components/SectionBookingForm";
import { sectionFromSlug } from "@/lib/sections";

interface Props {
  params: { section: string };
}

export default function SectionBookPage({ params }: Props) {
  const section = sectionFromSlug(params.section);
  if (!section) notFound();
  return <SectionBookingForm section={section} />;
}
