// GA4 Measurement ID
export const GA_TRACKING_ID = process.env.NEXT_PUBLIC_GA_ID!;

// Google Ads Conversion ID & Labels
export const ADS_CONVERSION_ID = "AW-17399690522";
export const FORM_LABEL = "fhQiCOzcxYcbEJrq6OhA";
export const WHATSAPP_LABEL = "q0VoCOnIuYcbEJrq6OhA";

type GAEventParams = Record<string, string | number | boolean | undefined>;

// ✅ Track GA4 pageviews
export const pageview = (url: string): void => {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("config", GA_TRACKING_ID, { page_path: url });
  }
};

// ✅ Track GA4 custom events
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

// ✅ Google Ads conversion
export const adsConversion = (
  label: string,
  value = 1.0,
  currency = "GBP",
  url?: string
): void => {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    const callback = () => {
      if (url) window.location.href = url;
    };
    window.gtag("event", "conversion", {
      send_to: `${ADS_CONVERSION_ID}/${label}`,
      value,
      currency,
      event_callback: callback,
    });
  }
};

// ✅ Form Submit tracking (GA4 + Ads)
export const trackFormSubmit = (redirectUrl?: string): void => {
  // GA4
  event({
    action: "form_submit",
    params: { category: "Contact", label: "Contact Form", value: 1 },
  });

  // Ads
  adsConversion(FORM_LABEL, 1.0, "GBP", redirectUrl);
};

// ✅ WhatsApp Click tracking (GA4 + Ads)
export const trackWhatsAppClick = (redirectUrl?: string): void => {
  // GA4
  event({
    action: "whatsapp_click",
    params: { category: "Engagement", label: "WhatsApp Chat Bubble", value: 1 },
  });

  // Ads
  adsConversion(WHATSAPP_LABEL, 1.0, "GBP", redirectUrl);
};
