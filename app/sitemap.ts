import type { MetadataRoute } from "next";

const BASE = "https://www.raumo.eu";

// Nur öffentliche, indexierbare Seiten. App-/Admin-Bereiche bleiben draußen.
export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/impressum", "/datenschutz", "/agb", "/avv"];
  return routes.map((path) => ({
    url: `${BASE}${path}`,
    changeFrequency: path === "" ? "weekly" : "yearly",
    priority: path === "" ? 1 : 0.3,
  }));
}
