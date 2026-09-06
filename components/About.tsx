export default function About() {
  return (
    <section id="about" className="section">
      <div className="wrap about-grid">
        <div>
          <span className="eyebrow">01 / The studio</span>
          <h2>
            Small studio.
            <br />
            Considered work.
          </h2>
        </div>
        <div>
          <p className="about-copy">
            Your website should feel like your business at its best. We bring
            design and development together to create a digital presence that’s
            easy to use, built with care, and unmistakably yours.
          </p>
          <div className="principles">
            {[
              [
                "Clarity first",
                "A clear path from first impression to enquiry.",
              ],
              [
                "Made for every screen",
                "Responsive layouts that give mobile the attention it deserves.",
              ],
              [
                "Built for the long term",
                "Maintainable code, sensible foundations, room to grow.",
              ],
              [
                "The details matter",
                "Performance, accessibility and technical SEO from the start.",
              ],
            ].map(([title, copy]) => (
              <div key={title}>
                <h3>{title}</h3>
                <p>{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
