export const GA_TRACKING_ID = process.env.NEXT_PUBLIC_GA_ID!;

type GAEventParams = Record<string, string | number | boolean | undefined>;

// Track pageviews
export const pageview = (url: string): void => {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("config", GA_TRACKING_ID, {
      page_path: url,
    });
  }
};

// Track GA4 custom events
export const event = ({
  action,
  params = {},
}: {
  action: string;
  params?: GAEventParams;
}): void => {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", action, params);
  }
};
