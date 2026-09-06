"use client";
import { useRouter } from "next/navigation";
export default function SectionLink({
  id,
  children,
  className,
  onNavigate,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  return (
    <button
      className={className}
      onClick={() => {
        onNavigate?.();
        const el = document.getElementById(id);
        if (el) {
          if (window.__lenis) window.__lenis.scrollTo(el, { offset: -90 });
          else
            el.scrollIntoView({
              behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                .matches
                ? "instant"
                : "smooth",
            });
        } else {
          sessionStorage.setItem("scroll-section", id);
          router.push("/");
        }
      }}
    >
      {children}
    </button>
  );
}
