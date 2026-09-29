// Configured external links are HTTPS only. Arbitrary links are never framed.
export function videoLink(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2000) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    return url.href;
  } catch { return null; }
}

// Only a full validated Canva viewer URL can become an iframe.
export function canvaVideoEmbed(value: unknown): string | null {
  const link = videoLink(value);
  if (!link) return null;
  const url = new URL(link);
  if (!["www.canva.com", "canva.com"].includes(url.hostname) || !/^\/design\/[A-Za-z0-9_-]+\/(?:[A-Za-z0-9_-]+\/)?(?:watch|view)\/?$/.test(url.pathname)) return null;
  url.hostname = "www.canva.com";
  url.search = "?embed";
  url.hash = "";
  return url.href;
}
