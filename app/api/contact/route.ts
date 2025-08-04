import { NextResponse } from "next/server";
import { Resend } from "resend";
import { RateLimiterMemory } from "rate-limiter-flexible";

const resend = new Resend(process.env.RESEND_API_KEY);
const limiter = new RateLimiterMemory({ points: 3, duration: 900 }); // 3 requests per 15 min

// Simple sanitiser to prevent script injection
const sanitize = (str: string) =>
  String(str).replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "unknown";

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, email, message, website, token } = body;

  // 🐝 Honeypot check
  if (website) {
    return NextResponse.json({ error: "Bot detected" }, { status: 400 });
  }

  // Missing fields check
  if (!name || !email || !message || !token) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Verify Turnstile
  const captchaRes = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `secret=${process.env.TURNSTILE_SECRET_KEY}&response=${token}`,
    }
  );

  const captchaData = await captchaRes.json();
  if (!captchaData.success) {
    return NextResponse.json(
      { error: "Failed captcha verification" },
      { status: 403 }
    );
  }

  // Rate limiting
  try {
    await limiter.consume(ip);
  } catch {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    // Send to your inbox
    const data = await resend.emails.send({
      from: `Legxcy Solutions <${process.env.RESEND_FROM_EMAIL!}>`,
      to: process.env.RESEND_TO_EMAIL!,
      subject: `New Contact Form Submission from ${sanitize(name)} (${sanitize(email)})`,
      replyTo: email,
      text: `
        New Message

        Name: ${sanitize(name)}
        Email: ${sanitize(email)}
        Message:
        ${sanitize(message)}
      `,
      html: `
        <h2>New Message</h2>
        <p><strong>Name:</strong> ${sanitize(name)}</p>
        <p><strong>Email:</strong> ${sanitize(email)}</p>
        <p><strong>Message:</strong><br/>${sanitize(message)}</p>
      `,
    });

    // Send an auto‑reply to the user
    await resend.emails.send({
      from: `Legxcy Solutions <${process.env.RESEND_FROM_EMAIL!}>`,
      to: email,
      subject: "Thanks for contacting Legxcy Solutions",
      html: `
        <p>Hi ${sanitize(name)},</p>
        <p>Thanks for reaching out! We’ve received your message and will get back to you shortly.</p>
        <p>Best regards,<br/>Legxcy Solutions Team</p>
      `,
    });

    return NextResponse.json({
      success: true,
      message: "Thanks for reaching out! We’ll get back to you shortly.",
      data,
    });
  } catch (err) {
    console.error("Email send failed:", err);
    return NextResponse.json({ error: "Email failed" }, { status: 500 });
  }
}
