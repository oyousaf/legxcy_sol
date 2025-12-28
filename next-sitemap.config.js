/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: "https://legxcysol.dev",
  generateRobotsTxt: true,

  sitemapSize: 5000,

  changefreq: "weekly",
  priority: 0.7,

  exclude: ["/api/*", "/outreach", "/outreach/*"],

  robotsTxtOptions: {
    policies: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api", "/api/*", "/outreach", "/outreach/*"],
      },
    ],
  },

  additionalPaths: async () => [
    {
      loc: "/",
      changefreq: "weekly",
      priority: 1.0,
    },
  ],
};
