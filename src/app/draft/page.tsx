import type { Metadata } from "next";
import { DraftRoom } from "@/components/draft/DraftRoom";

export const metadata: Metadata = { title: "드래프트" };

export default function DraftPage() {
  return <DraftRoom />;
}
