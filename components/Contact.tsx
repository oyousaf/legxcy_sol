"use client";

import { useForm, SubmitHandler } from "react-hook-form";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import Script from "next/script";
import { trackFormSubmit } from "@/lib/gtag";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!;

type ContactFormData = {
  name: string;
  email: string;
  message: string;
  website?: string; // honeypot
};

export default function Contact() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormData>();

  const [sent, setSent] = useState(false);
  const [token, setToken] = useState("");
  const [loadScript, setLoadScript] = useState(false);
  const widgetId = useRef<string | null>(null);
  const sentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const formRef = useRef<HTMLFormElement | null>(null);
  const widgetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setLoadScript(true);
        observer.disconnect();
      }
    });
    if (formRef.current) observer.observe(formRef.current);
    return () => {
      observer.disconnect();
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = null;
      if (sentTimer.current) clearTimeout(sentTimer.current);
    };
  }, []);

  const renderWidget = () => {
    if (
      !window.turnstile ||
      !widgetRef.current ||
      widgetId.current ||
      !TURNSTILE_SITE_KEY
    )
      return;
    widgetId.current = window.turnstile.render(widgetRef.current, {
      sitekey: TURNSTILE_SITE_KEY,
      callback: (value: string) => setToken(value),
      "expired-callback": () => setToken(""),
      "error-callback": () => {
        setToken("");
        toast.error("Verification failed. Please try again.");
      },
    });
  };

  // Handle form submission
  const onSubmit: SubmitHandler<ContactFormData> = async (data) => {
    if (data.website) return; // honeypot
    if (!token) return toast.error("Please complete the verification.");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, token }),
      });

      if (!res.ok) throw new Error("Failed to send message");

      // 🔥 Unified GA4 + Ads conversion tracking
      trackFormSubmit();

      toast.success("Message sent successfully!");
      setSent(true);
      reset();
      setToken("");
      sentTimer.current = setTimeout(() => setSent(false), 3000);
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
  };

  return (
    <section
      id="contact"
      className="contact-redesign relative min-h-[60vh] px-6 sm:px-12 py-24 text-center overflow-hidden"
    >
      {loadScript && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          onReady={renderWidget}
          onError={() =>
            toast.error(
              "Could not load verification. Please reload and try again.",
            )
          }
        />
      )}
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-linear-to-b from-(--mossy-bg)/95 via-(--mossy-bg)/85 to-(--dark-mint)/95 -z-10" />

      {/* Heading */}
      <motion.h2
        id="contact-heading"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true }}
        className="text-4xl sm:text-6xl font-bold mb-6 bg-linear-to-r from-(--accent-green) to-teal-200 bg-clip-text text-transparent leading-[1.2]"
      >
        Have something in mind?
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.6 }}
        viewport={{ once: true }}
        className="text-lg max-w-2xl mx-auto mb-10 text-(--foreground)"
      >
        Tell us a little about your project. Whether you have a brief or just an
        idea, we’d love to hear from you.
      </motion.p>

      {/* Contact form */}
      <form
        ref={formRef}
        onSubmit={(event) => {
          void handleSubmit(onSubmit)(event);
        }}
        className="max-w-xl mx-auto grid gap-4 text-left"
        aria-label="Contact Form"
      >
        {/* Honeypot */}
        <input
          type="text"
          id="website"
          {...register("website")}
          autoComplete="off"
          tabIndex={-1}
          style={{ display: "none" }}
          aria-hidden="true"
        />

        {/* Name */}
        <motion.div>
          <label htmlFor="name" className="sr-only">
            Your Name
          </label>
          <input
            type="text"
            id="name"
            {...register("name", { required: true })}
            autoComplete="name"
            placeholder="Your Name"
            className="w-full px-4 py-3 rounded-md bg-white/10 border border-white/10 placeholder-(--accent-green) focus:outline-none focus:ring-2 focus:ring-(--accent-green)"
          />
          {errors.name && (
            <span className="text-red-400 text-sm">Name is required</span>
          )}
        </motion.div>

        {/* Email */}
        <motion.div>
          <label htmlFor="email" className="sr-only">
            Your Email
          </label>
          <input
            type="email"
            id="email"
            {...register("email", { required: true })}
            autoComplete="email"
            placeholder="Your Email"
            className="w-full px-4 py-3 rounded-md bg-white/10 border border-white/10 placeholder-(--accent-green) focus:outline-none focus:ring-2 focus:ring-(--accent-green)"
          />
          {errors.email && (
            <span className="text-red-400 text-sm">
              Valid email is required
            </span>
          )}
        </motion.div>

        {/* Message */}
        <motion.div>
          <label htmlFor="message" className="sr-only">
            Your Message
          </label>
          <textarea
            id="message"
            {...register("message", { required: true })}
            rows={5}
            placeholder="Your Message"
            className="w-full px-4 py-3 rounded-md bg-white/10 border border-white/10 text-white placeholder-(--accent-green) focus:outline-none focus:ring-2 focus:ring-(--accent-green) resize-none"
          />
          {errors.message && (
            <span className="text-red-400 text-sm">Message is required</span>
          )}
        </motion.div>

        {/* Turnstile */}
        <div ref={widgetRef} className="text-center min-h-17.5" />

        {/* Submit button */}
        <motion.button
          type="submit"
          disabled={isSubmitting || sent}
          whileTap={{ scale: 0.97 }}
          className="w-full mt-2 px-6 py-3 text-white bg-(--dark-mint) cursor-pointer rounded-md font-semibold shadow-md transition focus:outline-none focus:ring-2 focus:ring-(--accent-green) focus:ring-offset-2 disabled:opacity-50"
        >
          {isSubmitting ? "Sending..." : sent ? "Sent!" : "Send Message"}
        </motion.button>
      </form>
    </section>
  );
}
