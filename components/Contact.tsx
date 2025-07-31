"use client";

import { useForm, SubmitHandler } from "react-hook-form";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { FaTelegramPlane, FaEnvelope, FaWhatsapp } from "react-icons/fa";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, options: Record<string, unknown>) => void;
    };
  }
}

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!;

type ContactFormData = {
  name: string;
  email: string;
  message: string;
  website?: string;
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
  const [scriptLoaded, setScriptLoaded] = useState(false);

  const formRef = useRef<HTMLFormElement | null>(null);
  const widgetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !scriptLoaded) {
          const script = document.createElement("script");
          script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
          script.async = true;
          script.defer = true;
          script.onload = () => {
            setScriptLoaded(true);
            if (window.turnstile && widgetRef.current) {
              window.turnstile.render(widgetRef.current, {
                sitekey: TURNSTILE_SITE_KEY,
                callback: (t: string) => setToken(t),
              });
            }
          };
          document.body.appendChild(script);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    if (formRef.current) observer.observe(formRef.current);

    return () => observer.disconnect();
  }, [scriptLoaded]);

  const onSubmit: SubmitHandler<ContactFormData> = async (data) => {
    if (data.website) return;
    if (!token) {
      toast.error("Please complete the verification.");
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
      aria-labelledby="contact-heading"
    >
      <motion.h2
        id="contact-heading"
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
        ref={formRef}
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
            className="w-full px-4 py-3 rounded-md bg-white/10 border border-white/10 text-white placeholder-gray-400 
                       focus:outline-none focus:ring-2 focus:ring-green-400"
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
            className="w-full px-4 py-3 rounded-md bg-white/10 border border-white/10 text-white placeholder-gray-400 
                       focus:outline-none focus:ring-2 focus:ring-green-400"
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
            className="w-full px-4 py-3 rounded-md bg-white/10 border border-white/10 text-white placeholder-gray-400 
                       focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
          />
          {errors.message && (
            <span className="text-red-400 text-sm">Message is required</span>
          )}
        </motion.div>

        {/* Turnstile placeholder */}
        <div ref={widgetRef} className="text-center min-h-[70px]" />

        <motion.button
          type="submit"
          disabled={isSubmitting || sent}
          whileTap={{ scale: 0.97 }}
          className="w-full mt-2 px-6 py-3 text-white bg-[color:var(--dark-mint)] cursor-pointer rounded-md font-semibold shadow-md 
                     transition focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-green)] focus:ring-offset-2
                     disabled:opacity-50"
        >
          {isSubmitting ? "Sending..." : sent ? "Sent!" : "Send Message"}
        </motion.button>
      </form>

      <div className="flex justify-center gap-6 mt-10">
        <a
          href="mailto:info@legxcysol.dev"
          aria-label="Send us an email"
          className="text-white hover:[color:var(--accent-green)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-green)] rounded-full p-2"
        >
          <FaEnvelope size={24} />
        </a>
        <a
          href="https://t.me/kufiii"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chat with us on Telegram"
          className="text-white hover:text-[color:var(--accent-green)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-green)] rounded-full p-2"
        >
          <FaTelegramPlane size={24} />
        </a>
        <a
          href="https://wa.me/447597866002"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Message us on WhatsApp"
          className="text-white hover:text-[color:var(--accent-green)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-green)] rounded-full p-2"
        >
          <FaWhatsapp size={24} />
        </a>
      </div>
    </section>
  );
}
