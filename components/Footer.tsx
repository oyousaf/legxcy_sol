import Link from "next/link";
import {
  FaFacebookF,
  FaInstagram,
  FaLinkedinIn,
  FaTelegramPlane,
  FaWhatsapp,
} from "react-icons/fa";
import { socials } from "@/lib/site";

const socialLinks = [
  { label: "LinkedIn", href: socials.linkedin, Icon: FaLinkedinIn },
  { label: "Facebook", href: socials.facebook, Icon: FaFacebookF },
  { label: "Instagram", href: socials.instagram, Icon: FaInstagram },
  { label: "Telegram", href: socials.telegram, Icon: FaTelegramPlane },
  { label: "WhatsApp", href: socials.whatsapp, Icon: FaWhatsapp },
];

export default function Footer() {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer-top">
          <Link href="/" className="brand">
            <span>legxcy</span>
            <span>solutions</span>
          </Link>
          <p>A legxcy of innovation, one pixel at a time.</p>
          <a href="mailto:info@legxcysol.dev" className="btn">
            info@legxcysol.dev ↗
          </a>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Legxcy Solutions</span>
          <div className="footer-links">
            {socialLinks.map(({ label, href, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                title={label}
              >
                <Icon aria-hidden="true" />
              </a>
            ))}
          </div>
          <span>Designed & developed in the UK</span>
        </div>
      </div>
    </footer>
  );
}
