import type { Metadata } from "next";
import { TeamsView } from "@/components/TeamsView";
import { getPublicState } from "@/lib/repo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "참가 팀" };

export default async function TeamsPage() {
  return <TeamsView s={await getPublicState()} />;
}
