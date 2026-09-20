import { brand } from "@/config/brand";
import { TopicRoute } from "../../TopicRoute";
export const dynamic = "force-dynamic";
export const metadata = { title: `Programme | ${brand.name}`, robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  return <TopicRoute {...await params} />;
}
