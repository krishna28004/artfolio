import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://artfolio.luxury";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/exhibition", "/exhibition/accessible", "/artwork/", "/commission", "/saved"],
        disallow: ["/admin/", "/checkout/", "/api/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
