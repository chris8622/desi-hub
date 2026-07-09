import type { MetadataRoute } from "next";

// Landing + Rechtsseiten dürfen indexiert werden; App-/Admin-/API-Bereiche nicht.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/impressum", "/datenschutz", "/agb", "/avv"],
      disallow: ["/admin", "/settings", "/api/", "/content", "/research", "/editor", "/planner", "/email", "/trends", "/hashtags", "/captions", "/vision", "/analytics", "/ideen", "/repurpose"],
    },
  };
}
