# Project context for Codex

Read this first when starting work in this repository. Use it to orient yourself, then inspect only the files relevant to the current task. Check `git status --short` and recent commits before editing; do not rescan the whole directory by default. This is a handoff, not a substitute for checking the code when making changes.

## Project and file map

- Legxcy Solutions: public web design/development studio website and a private business outreach dashboard.
- Existing stack: Next.js App Router, React, TypeScript, Tailwind/CSS, Framer Motion, Lenis; keep the existing architecture unless asked to change it.
- Public homepage: `app/page.tsx`, `components/`, `app/globals.css`.
- Shared metadata and structured data: `lib/site.ts`, `app/layout.tsx`; sitemap configuration: `next-sitemap.config.js`.
- Outreach UI: `app/outreach/`; business/lead logic: `lib/leads/`; endpoints: `app/api/`.
- Outreach authentication: `lib/outreachAuth.ts` and `proxy.ts`.
- Contact form: `components/Contact.tsx` and `app/api/contact/` (Turnstile and Resend).
- Environment secrets belong in `.env.local`. Never print or copy their values into responses, logs, or this file.

## User preferences and product decisions

- Preserve the forest-green visual direction with complementary soft fern/mint accents.
- Section navigation must not add `#` fragments to the browser URL.
- Preserve the footer wording: “A legxcy of innovation, one pixel at a time.”
- Outreach should support manual entry, CSV imports, and persistent contact statuses.
- Geoapify is the selected discovery provider, initially targeting Ossett/Wakefield. The user previously added its API key locally; check configuration presence without exposing values if needed.
- Missing website data means **website unknown**, never automatically “has no website.”
- No nightly refresh. Website performance checks run only when requested.
- Avoid enabling Google Places billing or introducing automatic paid API usage; the user is concerned about unexpected bills.
- Keep responses concise. Complete authorized work without repeated confirmation requests.

## Last verified state — 7 September 2026

- Latest commit when this handoff was written: `ee6f005` (`SEO optimised`). Working tree was clean before adding this file.
- Redesign and outreach work preceded the SEO pass. Do not assume every outreach flow has been freshly retested.
- SEO pass added branded homepage metadata, server-rendered Organization/WebSite/Service JSON-LD, and private outreach/API noindex controls.
- UI source fixes covered narrow-screen wrapping, dashboard sizing, mobile menu behaviour, contact labels/errors, compact Turnstile and verification reset, and reduced-motion scrolling.
- Lint, TypeScript, production build, and targeted rendered-HTML/HTTP SEO checks passed in the preceding session.
- Public production baseline then returned successful homepage/robots/sitemap responses, with HTTP and www redirecting to the canonical `https://legxcysol.dev` domain.
- Deployment of the SEO changes was not verified. A commit does not establish deployment status.
- The user intentionally removed `AUDIT.md`; do not recreate it unless asked. Maintain this concise handoff instead.

## Remaining work

- Actual browser visual/interaction review is pending. The previous session's browser tool reported no connected browsers; recheck availability when resuming rather than assuming the blocker persists.
- Review homepage and outreach on desktop/mobile (including 320px width): overflow, readability/contrast, keyboard focus, navigation, forms, dialogs, table scrolling, and reduced motion.
- Do not send real contact emails while testing. Do not claim source-level inspection is a completed browser review.
- Core Web Vitals and Search Console indexing have not been measured or verified.

## Validation and maintenance

- Available checks: `npm run lint`, `npm run typecheck`, `npm run build` (includes sitemap generation).
- `npm test` targets `tests/*.test.mjs`; check whether test files exist before relying on it.
- Run checks appropriate to the change; avoid unnecessary repeat builds or broad scans.
- After meaningful work, update the last verified state and remaining work here. Keep entries short, remove stale blockers, and distinguish completed implementation from unverified runtime/deployment behaviour.
