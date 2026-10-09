export const site = {
  url: "https://legxcysol.dev",
  name: "Legxcy Solutions",
  title: "Web Design & Development for UK Businesses",
  description:
    "Bespoke web design, development and website redesign for UK businesses. Explore Legxcy Solutions’ work and discuss your next website or digital tool.",
};

export const socials = {
  linkedin: "https://www.linkedin.com/company/legxcy-solutions/",
  facebook: "https://www.facebook.com/legxcysol",
  instagram: "https://www.instagram.com/legxcysol",
  telegram: "https://t.me/kufiii",
  whatsapp: "https://wa.me/447597866002",
};

export const homeStructuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${site.url}/#organization`,
      name: site.name,
      url: `${site.url}/`,
      logo: `${site.url}/logo.webp`,
      image: `${site.url}/og-image.jpg`,
      email: "info@legxcysol.dev",
      telephone: "+447597866002",
      sameAs: [socials.linkedin, socials.facebook, socials.instagram],
    },
    {
      "@type": "WebSite",
      "@id": `${site.url}/#website`,
      url: `${site.url}/`,
      name: site.name,
      inLanguage: "en-GB",
      publisher: { "@id": `${site.url}/#organization` },
    },
    {
      "@type": "Service",
      "@id": `${site.url}/#service`,
      name: "Web design and development",
      serviceType: "Web design, web development and website redesign",
      description: site.description,
      url: `${site.url}/`,
      areaServed: { "@type": "Country", name: "United Kingdom" },
      provider: { "@id": `${site.url}/#organization` },
    },
  ],
};
