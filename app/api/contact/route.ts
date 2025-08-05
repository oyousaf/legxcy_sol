import { NextResponse } from "next/server";
import { Resend } from "resend";
import { RateLimiterMemory } from "rate-limiter-flexible";

const resend = new Resend(process.env.RESEND_API_KEY);
const limiter = new RateLimiterMemory({ points: 3, duration: 900 }); // 3 requests per 15 min

// Simple sanitiser
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
  const firstName = sanitize(name).split(" ")[0];

  // Honeypot
  if (website) {
    return NextResponse.json({ error: "Bot detected" }, { status: 400 });
  }

  // Required fields
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

  // Rate limit
  try {
    await limiter.consume(ip);
  } catch {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    // 📩 Send notification to you
    const data = await resend.emails.send({
      from: `Legxcy Solutions <${process.env.RESEND_FROM_EMAIL!}>`,
      to: process.env.RESEND_TO_EMAIL!,
      subject: `New Contact Form Submission from ${sanitize(name)} (${sanitize(email)})`,
      replyTo: email,
      html: `
        <div style="background-color:#0f2f23;padding:20px;font-family:Inter,Arial,sans-serif;color:#ffffff;">
          <table width="100%" cellspacing="0" cellpadding="0" border="0" 
                 style="max-width:600px;margin:auto;background-color:#1b3a2c;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="text-align:center;padding:20px;">
                <img src="https://legxcysol.dev/logo.webp" alt="Legxcy Solutions Logo"
                     style="max-width:150px;height:auto;margin-bottom:20px;" />
              </td>
            </tr>
            <tr>
              <td style="padding:30px;">
                <h2 style="color:#59ae6a;margin-bottom:20px;font-weight:600;">New Contact Form Submission</h2>
                <p><strong>Name:</strong> ${sanitize(name)}</p>
                <p><strong>Email:</strong> ${sanitize(email)}</p>
                <p style="margin-top:20px;line-height:1.6;">
                  <strong>Message:</strong><br/>
                  <span style="background:#0f2f23;display:inline-block;padding:15px;border-radius:8px;color:#e6e6e6;">
                    ${sanitize(message)}
                  </span>
                </p>
                <p style="font-size:14px;color:#a3a3a3;margin-top:30px;">Sent via Legxcy Solutions Website</p>
              </td>
            </tr>
          </table>
        </div>
      `,
    });

    // 📩 Send auto-reply to the user
    await resend.emails.send({
      from: `Legxcy Solutions <${process.env.RESEND_FROM_EMAIL!}>`,
      to: email,
      subject: "Thanks for contacting Legxcy Solutions",
      replyTo: process.env.RESEND_TO_EMAIL!,
      text: `
Hi ${firstName},

Thank you for contacting Legxcy Solutions. We’ve successfully received your message and will be in touch with you shortly.

In the meantime, we’d be delighted if you could share a few details regarding your project objectives, anticipated budget, and preferred timeline. This will allow us to craft a tailored proposal aligned with your vision and ensure we can initiate your project efficiently and effectively.

Best regards,
Legxcy Solutions
      `,
      html: `
        <div style="background-color:#0f2f23;padding:20px;font-family:Inter,Arial,sans-serif;color:#ffffff;">
          <table width="100%" cellspacing="0" cellpadding="0" border="0"
                 style="max-width:600px;margin:auto;background-color:#1b3a2c;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="text-align:center;padding:20px;">
                <img src="https://legxcysol.dev/logo.webp" alt="Legxcy Solutions Logo"
                     style="max-width:100px;height:auto;margin-bottom:10px;" />
              </td>
            </tr>
            <tr>
              <td style="padding:30px;">
                <h2 style="color:#59ae6a;margin-bottom:20px;font-weight:600;">Thank You for Contacting Us</h2>
                <p style="font-size:16px;line-height:1.6;">Hi ${firstName},</p>
                <p style="font-size:16px;line-height:1.6;">
                  Thank you for reaching out to <strong>Legxcy Solutions</strong>. 
                  We have successfully received your message and will be in touch with you shortly.
                </p>
                <p style="font-size:16px;line-height:1.6;">
                  In the meantime, we would be delighted if you could share a few details regarding your 
                  <strong>project objectives</strong>, <strong>anticipated budget</strong>, and 
                  <strong>preferred timeline</strong>. This will enable us to craft a tailored proposal 
                  aligned with your vision and ensure we can initiate your project efficiently and effectively.
                </p>
                <table width="100%" style="margin-top:30px;text-align:center;">
                  <tr>
                    <td>
                      <p style="font-size:14px;color:#a3a3a3;margin-bottom:10px;">
                        Best regards,
                      </p>
                      <img src="https://legxcysol.dev/banner.webp" alt="Legxcy Solutions Banner"
                           style="max-width:150px;height:auto;border-radius:6px;" />
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </div>
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
