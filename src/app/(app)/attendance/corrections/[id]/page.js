import { notFound } from "next/navigation";
import CorrectionDetailClient from "./CorrectionDetailClient";

export default async function CorrectionDetailPage({ params }) {
  const { id } = await params;
  if (!Number.isInteger(Number(id))) notFound();
  return <CorrectionDetailClient id={id} />;
}
