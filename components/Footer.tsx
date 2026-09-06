import Link from "next/link";
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
            <a
              href="https://www.linkedin.com/company/legxcy-solutions/"
              target="_blank"
              rel="noopener noreferrer"
            >
              LinkedIn ↗
            </a>
            <a
              href="https://t.me/kufiii"
              target="_blank"
              rel="noopener noreferrer"
            >
              Telegram ↗
            </a>
            <a
              href="https://wa.me/447597866002"
              target="_blank"
              rel="noopener noreferrer"
            >
              WhatsApp ↗
            </a>
          </div>
          <span>Designed & developed in the UK</span>
        </div>
      </div>
    </footer>
  );
}
