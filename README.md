# KSDA LMS Framework

A private reusable foundation derived from CAPAi LMS Sites version 47. Configure another brand and connect a separate Supabase project while retaining Knowledge, Skill, Desire, Action and private reflection.

This is **one independent installation per brand/database**. Shared multi-tenancy, CAPAi account linking, billing, subscriptions and a visual module authoring CMS are not implemented. Those decisions remain open; see [architecture](docs/ARCHITECTURE.md).

## Included

- Bilingual EN/BM catalogue, full topic readings, activities, local reflection answers and notes.
- Email-code sign-in, learner onboarding/profile, enrolment, sequential self-reported topic progress.
- Private Supabase-authenticated administrator overview, learner register and CSV export.
- Configurable logo, name, colors, support details, optional shop, public URL, locale and report time zone.
- Data-driven module catalogue and lesson content with build-time validation.
- Fresh-project Supabase migration, generated example course seed, read-only reporting Edge Function and database isolation tests.

The original four CAPAi modules remain **example content**, with their existing wording and review restrictions. Replace them only with material you are entitled to use and have reviewed. Protected PDFs, commerce, community enquiries, CAPAi production identifiers and the original Sites administrator identity adapter are excluded. No new open-source licence is granted.

## Start

Requires Node.js >=22.13.0 and npm. Build scripts support macOS/Linux without modifying HOME.

```sh
npm ci
cp .env.example .env.local
npm run content:validate
npm run dev
```

Configure a **new** Supabase project using [DATABASE.md](docs/DATABASE.md), its email OTP sender/template and the environment example. Missing configuration fails closed. It does not connect to CAPAi by default.

```sh
npm test
npm run typecheck
npm run lint
```

## Configure your installation

1. Edit [`config/brand.json`](config/brand.json). Use your actual public URL, logo, operator and support address. Check contrast in light and dark modes.
2. Edit [`config/course-catalogue.json`](config/course-catalogue.json), [`content/ksda/free-topics.json`](content/ksda/free-topics.json), and [`content/ksda/course-details.json`](content/ksda/course-details.json). See [MODULES.md](docs/MODULES.md).
3. Run `npm run content:validate` and `npm run seed:generate`. Apply the schema/seed only to your new database. Once learners start, create a new course version for changed topic ordering or counts.
4. Set Supabase settings and the server-only `LMS_ADMIN_EMAILS` allowlist. Configure the optional signed read-only reporting function for the admin register. See [SETUP.md](docs/SETUP.md).
5. Review the privacy page and operator-specific retention/support arrangements before accepting real learners.

## Deploy

This remains a Vinext/Cloudflare application. Build with `npm run build`. The generic `.openai/hosting.json` intentionally contains no Sites project ID and no CAPAi D1 binding. Create a new hosting project and configure its own environment; do not point it at CAPAi's production project. Hosting on another runtime requires its supported Vinext adapter and equivalent secret/session handling.

This repository is a reusable code deposit, not an already provisioned service. No new hosting project or database has been created for it.

## Provenance

Derived from source commit `088d495b4eeb7978be7030964065e45b13a5934a`, CAPAi Sites version 47, 20 September 2026. The separate **Final Working Code - CAPAi LMS** repository preserves the exact CAPAi recovery snapshot. This framework contains intentional changes and must not be used as a CAPAi rollback image.
