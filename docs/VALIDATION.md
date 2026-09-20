# Framework deposit validation — 20 September 2026

- Production Vinext build: passed.
- TypeScript: passed.
- ESLint: zero errors; one inherited navigation warning in the gated legacy MissionExperience component.
- Automated tests: 47 passed, zero failures. Includes verified administrator allowlist and CSV access tests, signed read-only Edge report tests, authentication/progress guards, generic configurable-content checks and all current topic routes.
- Real PostgreSQL via PGlite 0.5.8: fresh schema, seed, RLS ownership, anonymous access, account escalation, enrolment restrictions, immutable course count and progress sequence/completion tests passed (10 database checks).
- 24 browser layout checks passed across public/learning/help/privacy and one topic per example module at 320, 768 and 1440px in BM. No page-level overflow, missing headings or CAPAi-domain links.
- Phone visual inspection: 390px reading layout, bilingual navigation and menu contrast checked in the final build.
- No production database calls, real OTP sends or learner-data writes were made. Browser preview used fictional read-only fixtures.

Supabase email delivery, deployed Edge configuration and actual hosting/session behavior must be smoke-tested in the new installation's staging environment. No new production service is provisioned by this deposit.

This is a single-installation foundation, not shared multi-tenancy or CAPAi account linking. The current module editor is source/JSON, not a visual admin CMS.
