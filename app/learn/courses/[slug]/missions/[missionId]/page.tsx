import { brand } from "@/config/brand";
import { TopicRoute } from "../../../../TopicRoute";
export const dynamic = "force-dynamic";
export const metadata = { title: `Topic | ${brand.name}`, robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ slug: string; missionId: string }> }) {
  return <TopicRoute {...await params} />;
}
