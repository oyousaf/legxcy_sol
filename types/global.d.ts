/**
 * Global ambient type augmentations.
 *
 * NOTE on `lenis`:
 *   The `lenis` package itself declares a global `window.lenis` of an
 *   unhelpful shape (`{ version?, horizontal?, snap?, touch? }`) for its
 *   CDN/UMD build. We don't use that — we keep our own instance on
 *   `window.__lenis` instead, typed as the real `Lenis` class. This avoids
 *   declaration-merging conflicts with the package.
 */
import type Lenis from "lenis";

declare global {
  interface Window {
    /** Strongly-typed handle to the singleton Lenis instance. */
    __lenis?: Lenis;
    gtag?: (...args: unknown[]) => void;
    dataLayer?: Record<string, unknown>[];
    turnstile?: {
      render: (
        el: HTMLElement,
        options: Record<string, unknown>
      ) => string;
      reset: (id: string) => void;
      remove: (id: string) => void;
    };
  }
}

export {};
