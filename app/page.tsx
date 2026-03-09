import { resolveBrokerageSlugFromHost } from "@/lib/services/brokerageService";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

function normalizeHost(value: string): string {
  return value.split(":")[0].trim().toLowerCase();
}

function getPrimaryHosts(): Set<string> {
  const hosts = new Set<string>(["localhost", "127.0.0.1"]);
  const sources = [process.env.DEFAULT_PORTAL_BASE_URL, process.env.NEXT_PUBLIC_APP_BASE_URL];
  sources.forEach((source) => {
    if (!source) return;
    try {
      hosts.add(normalizeHost(new URL(source).host));
    } catch {
      // ignore invalid url values
    }
  });
  hosts.add("app.beesold.hpp-cloud.com");
  return hosts;
}

export default async function HomePage() {
  const host = normalizeHost(headers().get("x-forwarded-host") ?? headers().get("host") ?? "");
  const primaryHosts = getPrimaryHosts();
  if (host && !primaryHosts.has(host)) {
    const slug = await resolveBrokerageSlugFromHost(host);
    if (slug) {
      redirect(`/portal/${slug}`);
    }
  }
  redirect("/mission-control");
}
