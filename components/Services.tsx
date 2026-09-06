import { FiArrowUpRight } from "react-icons/fi";
const services = [
  [
    "Websites with identity",
    "Bespoke business websites, portfolios and personal brands. Designed around your story and your customers.",
  ],
  [
    "Digital tools that work",
    "Custom web experiences that simplify bookings, content and the everyday work behind your business.",
  ],
  [
    "A fresh start",
    "Thoughtful redesigns that bring an outdated website up to speed, without losing what makes you recognisable.",
  ],
  [
    "Performance & visibility",
    "Fast pages, responsive layouts and technical SEO foundations that help people find their way to you.",
  ],
  [
    "Accessible by design",
    "Clear navigation, readable content and considered interactions across devices and input methods.",
  ],
  [
    "Care beyond launch",
    "Ongoing maintenance, updates and support to keep your website moving with your business.",
  ],
];
export default function Services() {
  return (
    <section id="services" className="section">
      <div className="wrap">
        <div className="section-head">
          <div>
            <span className="eyebrow">02 / What we do</span>
            <h2>
              From first idea
              <br />
              to what’s next.
            </h2>
          </div>
          <p>
            Design, development and ongoing care. Everything your next digital
            chapter needs.
          </p>
        </div>
        <div className="service-grid">
          {services.map(([title, copy], i) => (
            <article className="service-card" key={title}>
              <div className="service-num">
                <span>0{i + 1}</span>
                <FiArrowUpRight size={20} />
              </div>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
