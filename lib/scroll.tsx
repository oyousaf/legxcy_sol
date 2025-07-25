"use client";

import { useEffect } from "react";
import Lenis from "@studio-freight/lenis";

type LenisInstance = {
  raf: (time: number) => void;
  destroy: () => void;
};

declare global {
  interface Window {
    lenis?: LenisInstance;
  }
}

export default function LenisProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    });

    window.lenis = lenis;

    const raf = (time: number) => {
      lenis.raf(time);
      requestAnimationFrame(raf);
    };

    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
      delete window.lenis;
    };
  }, []);

  return <>{children}</>;
}
