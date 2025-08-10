export const GA_TRACKING_ID = process.env.NEXT_PUBLIC_GA_ID!;

// Track pageviews
export const pageview = (url: string) => {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("config", GA_TRACKING_ID, {
      page_path: url,
    });
  }
};

// Track custom events
export const event = ({
  action,
  params = {},
}: {
  action: string;
  params?: Record<string, any>;
}) => {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", action, params);
  }
};
