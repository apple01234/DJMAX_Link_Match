import { HomeView } from "@/components/HomeView";
import { getPublicState } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function Home() {
  return <HomeView s={await getPublicState()} />;
}
