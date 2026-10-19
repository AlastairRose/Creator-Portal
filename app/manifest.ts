import type { MetadataRoute } from "next";

// Lets creators "Add to Home Screen" so the portal opens like an app — which
// iPhones require before they'll allow notifications from a website.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Creator Portal",
    short_name: "Creator Portal",
    description: "Creator content planning, tracking, and reporting",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#111114",
    theme_color: "#111114",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
