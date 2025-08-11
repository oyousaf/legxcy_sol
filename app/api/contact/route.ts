import { NextResponse } from "next/server";
import { Resend } from "resend";
import { RateLimiterMemory } from "rate-limiter-flexible";

const resend = new Resend(process.env.RESEND_API_KEY);
const limiter = new RateLimiterMemory({ points: 3, duration: 900 }); // 3 req / 15 min

// Robust sanitizer for text contexts
const sanitize = (str: string) =>
  String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export async function POST(req: Request) {
  const xff = req.headers.get("x-forwarded-for");
  const ip = xff ? xff.split(",")[0].trim() : "unknown";

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, email, message, website, token } = body ?? {};
  const safeName = sanitize(name ?? "");
  const safeEmail = sanitize(email ?? "");
  const safeMessage = sanitize(message ?? "");
  const firstName = safeName.split(/\s+/)[0] || "there";

  // Honeypot
  if (website) {
    return NextResponse.json({ error: "Bot detected" }, { status: 400 });
  }

  // Required fields
  if (!safeName || !safeEmail || !safeMessage || !token) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Verify Turnstile
  const captchaRes = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `secret=${encodeURIComponent(process.env.TURNSTILE_SECRET_KEY || "")}&response=${encodeURIComponent(token)}`,
    }
  );

  const captchaData = await captchaRes.json();
  if (!captchaData?.success) {
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

  // Common HTML parts
  const PREHEADER_NOTIFY =
    "New contact form submission received from your website.";
  const PREHEADER_REPLY =
    "We’ve received your message — here’s what happens next.";

  const wrapperTop = (preheader: string) => `
<!doctype html>
<html lang="en">
<head>
  <meta charSet="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Legxcy Solutions</title>
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <style>
    /* Preheader hide */
    .preheader { display:none!important; visibility:hidden; opacity:0; color:transparent; height:0; width:0; overflow:hidden; mso-hide:all; }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#0f2f23;">
  <div class="preheader">${sanitize(preheader)}</div>
  <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" border="0" style="background-color:#0f2f23;">
    <tr>
      <td align="center" style="padding:16px;">
        <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" border="0" style="max-width:600px;background-color:#1b3a2c;border-radius:12px;overflow:hidden;">
`;
  const wrapperBottom = `
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const headerBlock = `
<tr>
  <td align="center" style="padding:16px 20px 10px 20px;">
    <a href="https://legxcysol.dev" target="_blank" rel="noreferrer noopener" style="text-decoration:none;">
      <img src="https://legxcysol.dev/logo.webp" width="120" height="120" alt="Legxcy Solutions logo"
           style="display:block;max-width:120px;height:auto;margin:0 auto 10px auto;border:0;" />
    </a>
    <h2 style="color:#59ae6a;margin:10px 0;font-weight:600;font-size:20px;font-family:Inter,Arial,sans-serif;">
      Legxcy Solutions
    </h2>
  </td>
</tr>`;

  const hr = `<tr><td style="padding:0 20px;"><hr style="border:none;border-top:1px solid #2d5440;margin:20px 0;" /></td></tr>`;

  try {
    // --- Owner notification ---
    const notifyHtml = `
${wrapperTop(PREHEADER_NOTIFY)}
  ${headerBlock}
  <tr>
    <td style="padding:0 20px 10px 20px;">
      <h3 style="color:#59ae6a;margin:0 0 10px 0;font-family:Inter,Arial,sans-serif;">New Contact Form Submission</h3>
      <p style="margin:10px 0;font-size:16px;line-height:1.5;color:#e6e6e6;font-family:Inter,Arial,sans-serif;">
        <strong style="color:#59ae6a;">Name:</strong><br/>${safeName}
      </p>
      <p style="margin:10px 0;font-size:16px;line-height:1.5;color:#e6e6e6;font-family:Inter,Arial,sans-serif;">
        <strong style="color:#59ae6a;">Email:</strong><br/>${safeEmail}
      </p>
      <p style="margin:10px 0;font-size:16px;line-height:1.6;color:#e6e6e6;font-family:Inter,Arial,sans-serif;">
        <strong style="color:#59ae6a;">Message:</strong><br/>
        <span style="background:#0f2f23;display:block;padding:15px;border-radius:8px;color:#e6e6e6;white-space:pre-wrap;">
${safeMessage}
        </span>
      </p>
    </td>
  </tr>
  ${hr}
  <tr>
    <td style="padding:0 20px 20px 20px;text-align:center;color:#a3a3a3;font-size:14px;font-family:Inter,Arial,sans-serif;">
      Sent via Legxcy Solutions Website
    </td>
  </tr>
${wrapperBottom}
`;

    await resend.emails.send({
      from: `Legxcy Solutions <${process.env.RESEND_FROM_EMAIL!}>`,
      to: process.env.RESEND_TO_EMAIL!,
      subject: `New Contact Form: ${safeName} <${safeEmail}>`,
      replyTo: safeEmail,
      text: `New contact form submission\n\nName: ${safeName}\nEmail: ${safeEmail}\n\nMessage:\n${safeMessage}\n\nSent via Legxcy Solutions Website`,
      html: notifyHtml,
      headers: {
        "Auto-Submitted": "auto-generated",
      },
    });

    // --- Auto-reply to user ---
    const replyHtml = `
${wrapperTop(PREHEADER_REPLY)}
  ${headerBlock}
  <tr>
    <td style="padding:0 20px 10px 20px;">
      <p style="font-size:16px;line-height:1.6;color:#e6e6e6;font-family:Inter,Arial,sans-serif;">Hi ${firstName},</p>
      <p style="font-size:16px;line-height:1.6;color:#e6e6e6;font-family:Inter,Arial,sans-serif;">
        Thank you for reaching out to <strong>Legxcy Solutions</strong>. We’ve received your message and will be in touch shortly.
      </p>
      <p style="font-size:16px;line-height:1.6;color:#e6e6e6;font-family:Inter,Arial,sans-serif;">
        In the meantime, feel free to share your <strong>project goals</strong>, key <strong>features</strong>, and rough
        <strong>page count</strong>. This helps us prepare a tailored proposal quickly.
      </p>
      <div style="text-align:center;margin-top:24px;">
        <a href="https://legxcysol.dev" target="_blank" rel="noreferrer noopener" style="text-decoration:none;">
          <img src="https://legxcysol.dev/banner.webp" width="300" height="120" alt="Visit Legxcy Solutions"
               style="display:inline-block;max-width:300px;height:auto;border-radius:6px;border:0;" />
        </a>
      </div>
    </td>
  </tr>
  ${hr}
  <tr>
    <td style="padding:0 20px 20px 20px;text-align:center;color:#a3a3a3;font-size:13px;font-family:Inter,Arial,sans-serif;">
      You’re receiving this because you contacted Legxcy Solutions.<br/>
      If this wasn’t you, just ignore this email.
    </td>
  </tr>
${wrapperBottom}
`;

    await resend.emails.send({
      from: `Legxcy Solutions <${process.env.RESEND_FROM_EMAIL!}>`,
      to: email,
      subject: "Thanks for contacting Legxcy Solutions",
      replyTo: process.env.RESEND_TO_EMAIL!,
      text: `Hi ${firstName},

Thank you for contacting Legxcy Solutions. We’ve received your message and will be in touch shortly.

If you can, share your project goals, features, and rough page count so we can prepare a tailored proposal.

Best regards,
Legxcy Solutions
https://legxcysol.dev`,
      html: replyHtml,
      headers: {
        "Auto-Submitted": "auto-replied",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Thanks for reaching out! We’ll get back to you shortly.",
    });
  } catch (err) {
    console.error("Email send failed:", err);
    return NextResponse.json({ error: "Email failed" }, { status: 500 });
  }
}
