/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: "https://legxcysol.dev",
  generateRobotsTxt: true,
  sitemapSize: 7000,
  changefreq: "weekly",
  priority: 0.7,
  exclude: ["/api/*", "/outreach"],
  robotsTxtOptions: {
    policies: [
      {
        userAgent: "*",
        allow: "/",
      },
    ],
  },
};
