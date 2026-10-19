// Turns a normal YouTube / Vimeo / Loom share link into a URL that can be
// embedded in an iframe, so the welcome video plays inside the portal.
// Returns null for anything else.
export function toEmbedUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");

  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0` : null;
  }
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const id =
      url.searchParams.get("v") ||
      url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/)?.[1] ||
      null;
    return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0` : null;
  }
  if (host === "vimeo.com") {
    const [id, hash] = url.pathname.split("/").filter(Boolean);
    if (!id || !/^\d+$/.test(id)) return null;
    const h = hash || url.searchParams.get("h");
    return `https://player.vimeo.com/video/${id}${h ? `?h=${h}` : ""}`;
  }
  if (host === "player.vimeo.com") return url.toString();
  if (host === "loom.com") {
    const id = url.pathname.match(/^\/(?:share|embed)\/([a-zA-Z0-9]+)/)?.[1];
    return id ? `https://www.loom.com/embed/${id}` : null;
  }
  return null;
}
