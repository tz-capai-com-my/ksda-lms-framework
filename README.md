# KSDA LMS Framework v0.2.0

An independent, privately maintained white-label learning application derived from the verified [CAPAi v57 recovery release](https://github.com/tz-capai-com-my/final-working-code-capai-lms/releases/tag/capai-live-v57-20260929), commit `28780a22677f740776abd2251ce84015c522ca48`. The current reading method supplements the existing lessons with bilingual stories, K/S/D/A blocks, optional practice/feedback, editorial photographs and private temporary reflection.

This is one installation per brand and Supabase project. It is not connected to CAPAi production, and it has not been deployed by this release task. The existing framework v0.1.0 history is preserved. See [FEATURE-PARITY.md](docs/FEATURE-PARITY.md) and the [release report](KSDA_Framework_WhiteLabel_Release_Report.md) for exact validation and remote status.

## Start with your own configuration

Requires Node.js >=22.13.0 and npm. Dependencies are pinned in package-lock.json. Use your own independent database and provider settings; missing configuration fails closed.

```sh
npm ci
cp .env.example .env.local
npm run content:validate
npm run dev
```

1. Edit [config/brand.json](config/brand.json). Use your name, logo, colours, operator, contact and URL. [Branding guidance](docs/BRANDING.md) explains feature switches and sender setup.
2. Follow [SETUP.md](docs/SETUP.md) and [DATABASE.md](docs/DATABASE.md). Choose **fresh install** or **upgrade from v0.1.0**; never rerun the initial schema against an existing installation.
3. The four original course definitions remain examples. The complete updated reading package is opt-in under [examples/capai-community-reading](examples/capai-community-reading/README.md), outside public assets. Review rights and professional/language review status before use. Import, verify and explicitly activate the package in your independent database; copying UI code alone does not install readings.
4. Set `KSDA_READING_DELIVERY_ENABLED=true` only after installing a matching sealed release. Keep new hashes coupled to the exact runtime and content. [MODULES.md](docs/MODULES.md) explains how another compatible course uses data/configuration without a new React page.
5. Configure this installation's administrator allowlist and optional signed reporting function. No Sites trusted identity headers are accepted.

## Learning and identity

Email-code sign-in remains available. Password sign-in, settings and recovery use Supabase identity checks. Google is hidden by default until configured for the independent project. Existing completed profiles and earned progress are preserved by the additive upgrade. Accounts are not shared across installations.

Readings and photographs are fetched privately on demand. Notes, choices and practice answers remain temporary page state; completion and reading markers are stored separately. Missing videos and optional checks are not new completion gates. Course completion records self-study, not professional competence.

All framework video slots are empty by default and configurable in [topic-video-links.json](content/ksda/topic-video-links.json). Placeholder behaviour is retained. Task 1 preserves the actual CAPAi fire-m01 video unchanged. See [video maintenance](docs/README-VIDEO-LINKS.md).

## Validation and recovery

```sh
npm run build
npm run typecheck
npm run lint
node --test tests/*.test.mjs
```

The exact commands, current results and unperformed hosted-provider checks are recorded in the release report and [validation evidence](docs/VALIDATION-v0.2.0.md). No public caching of learner content is used. No new loading-speed claim is made without measurement.

Keep operational backups separate from GitHub; see [SECURITY-BACKUP.md](docs/SECURITY-BACKUP.md). Source does not contain real learners, passwords, progress exports, purchased ebook grants or provider settings. The included `.openai/hosting.json` has no project ID or production binding. Deployment requires independent services and their own acceptance tests.

## Rights and boundaries

All existing notices and [LICENSE](LICENSE) remain in force. This private repository grants no unrestricted redistribution licence. The optional community reading examples retain their educational wording and ownership; protected standalone ebooks and MAN-ISME paid material are excluded. No visual authoring CMS, billing system or shared multi-tenancy is claimed. [Provenance](UPSTREAM.json) identifies the exact verified upstream; this adapted framework is not a CAPAi rollback image.
