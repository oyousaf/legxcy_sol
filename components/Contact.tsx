"use client";

import { useForm, SubmitHandler } from "react-hook-form";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import Script from "next/script";
import { FaTelegramPlane, FaEnvelope, FaWhatsapp } from "react-icons/fa";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!;

type ContactFormData = {
  name: string;
  email: string;
  message: string;
  website?: string;
};

declare global {
  interface Window {
    turnstile?: {
      render: (id: string, options: any) => void;
      reset: (id: string) => void;
    };
    turnstileCallback?: (token: string) => void;
  }
}

export default function Contact() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormData>();

  const [sent, setSent] = useState(false);
  const [token, setToken] = useState("");

  // Ref to widget
  const widgetId = "cf-turnstile-widget";

  useEffect(() => {
    window.turnstileCallback = (token: string) => setToken(token);

    // Fallback script loader
    if (!document.querySelector("script[src*='turnstile']")) {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }

    // Auto-refresh token every 110 seconds
    const refreshInterval = setInterval(() => {
      if (window.turnstile && document.getElementById(widgetId)) {
        window.turnstile.reset(widgetId);
        setToken("");
      }
    }, 110000);

    return () => clearInterval(refreshInterval);
  }, []);

  const onSubmit: SubmitHandler<ContactFormData> = async (data) => {
    if (data.website) return;
    if (!token) {
      toast.error("Please complete the verification again.");
      return;
    }

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, token }),
      });

      if (!res.ok) throw new Error("Failed to send message");

      toast.success("Message sent successfully!");
      setSent(true);
      reset();
      setToken("");
      setTimeout(() => setSent(false), 3000);
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
  };

  return (
    <section
      id="contact"
      className="min-h-[60vh] px-6 sm:px-12 py-24 text-center bg-[color:var(--mossy-bg)] text-[color:var(--foreground)]"
    >
      {/* Turnstile Script */}
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="lazyOnload"
        async
        defer
      />

      <motion.h2
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true }}
        className="text-3xl sm:text-5xl font-bold mb-6"
      >
        Let’s Build Something Remarkable
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.6 }}
        viewport={{ once: true }}
        className="text-lg max-w-2xl mx-auto mb-10"
      >
        Whether you’re ready to launch a project or simply exploring ideas, we’d
        love to hear from you.
      </motion.p>

      <form
        onSubmit={handleSubmit(onSubmit)}
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
        />

        {/* Name Field */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          viewport={{ once: true }}
        >
          <label htmlFor="name" className="sr-only">
            Your Name
          </label>
          <input
            type="text"
            id="name"
            {...register("name", { required: true })}
            autoComplete="name"
            placeholder="Your Name"
            className="w-full px-4 py-3 rounded-md bg-white/10 border border-white/10 text-white placeholder-gray-400 focus:outline-none"
          />
          {errors.name && (
            <motion.span
              role="alert"
              aria-live="polite"
              className="text-red-400 text-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              Name is required
            </motion.span>
          )}
        </motion.div>

        {/* Email Field */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          viewport={{ once: true }}
        >
          <label htmlFor="email" className="sr-only">
            Your Email
          </label>
          <input
            type="email"
            id="email"
            {...register("email", { required: true })}
            autoComplete="email"
            placeholder="Your Email"
            className="w-full px-4 py-3 rounded-md bg-white/10 border border-white/10 text-white placeholder-gray-400 focus:outline-none"
          />
          {errors.email && (
            <motion.span
              role="alert"
              aria-live="polite"
              className="text-red-400 text-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              Valid email is required
            </motion.span>
          )}
        </motion.div>

        {/* Message Field */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          viewport={{ once: true }}
        >
          <label htmlFor="message" className="sr-only">
            Your Message
          </label>
          <textarea
            id="message"
            {...register("message", { required: true })}
            rows={5}
            autoComplete="on"
            placeholder="Your Message"
            className="w-full px-4 py-3 rounded-md bg-white/10 border border-white/10 text-white placeholder-gray-400 focus:outline-none resize-none"
          />
          {errors.message && (
            <motion.span
              role="alert"
              aria-live="polite"
              className="text-red-400 text-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              Message is required
            </motion.span>
          )}
        </motion.div>

        {/* Turnstile Widget */}
        <div
          id={widgetId}
          className="cf-turnstile mx-auto"
          data-sitekey={TURNSTILE_SITE_KEY}
          data-callback="turnstileCallback"
        />

        <motion.button
          type="submit"
          aria-label="Send contact form message"
          disabled={isSubmitting || sent}
          whileTap={{ scale: 0.97 }}
          className="w-full mt-2 px-6 py-3 cursor-pointer bg-[color:var(--accent-green)] text-white rounded-md font-semibold shadow-md transition hover:brightness-110 disabled:opacity-50"
        >
          {isSubmitting ? "Sending..." : sent ? "Sent!" : "Send Message"}
        </motion.button>
      </form>

      {/* Contact Icons */}
      <motion.div
        className="flex justify-center items-center gap-6 mt-10"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        viewport={{ once: true }}
      >
        <motion.a
          whileHover={{ scale: 1.1, rotate: 2 }}
          whileTap={{ scale: 0.95 }}
          href="mailto:info@legxcysol.dev"
          aria-label="Send email to Legxcy Solutions"
          className="p-4 rounded-full bg-[color:var(--accent-green)] text-white shadow-lg hover:shadow-xl transition"
        >
          <FaEnvelope size={24} />
        </motion.a>
        <motion.a
          whileHover={{ scale: 1.1, rotate: 2 }}
          whileTap={{ scale: 0.95 }}
          href="https://t.me/kufiii"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Contact Legxcy Solutions on Telegram"
          className="p-4 rounded-full bg-[color:var(--accent-green)] text-white shadow-lg hover:shadow-xl transition"
        >
          <FaTelegramPlane size={24} />
        </motion.a>
        <motion.a
          whileHover={{ scale: 1.1, rotate: 2 }}
          whileTap={{ scale: 0.95 }}
          href="https://wa.me/447597866002"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Contact Legxcy Solutions on WhatsApp"
          className="p-4 rounded-full bg-[color:var(--accent-green)] text-white shadow-lg hover:shadow-xl transition"
        >
          <FaWhatsapp size={24} />
        </motion.a>
      </motion.div>
    </section>
  );
}
