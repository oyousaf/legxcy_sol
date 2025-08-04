import { NextResponse } from "next/server";
import { Resend } from "resend";
import { RateLimiterMemory } from "rate-limiter-flexible";

const resend = new Resend(process.env.RESEND_API_KEY);
const limiter = new RateLimiterMemory({ points: 3, duration: 900 }); // 3 requests per 15 min

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const { name, email, message, website, token } = await req.json();

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
    const data = await resend.emails.send({
      from: `Legxcy Solutions <${process.env.RESEND_FROM_EMAIL!}>`,
      to: process.env.RESEND_TO_EMAIL!,
      subject: `New Contact Form Submission from ${name}`,
      replyTo: email,
      html: `
        <h2>New Message</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Message:</strong><br/>${message}</p>
      `,
    });

    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ error: "Email failed" }, { status: 500 });
  }
}
