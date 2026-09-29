# v0.2.0 validation — 29 September 2026

Status: local source/build verification. This is not a hosted Supabase deployment or a professional training endorsement. Historical v0.1.0 evidence remains in VALIDATION.md.

## Commands and observed results

| Check | Result |
|---|---|
| Fresh locked dependency installation | PASS: npm ci, 516 packages, Node 24.19.0/npm 12.1.0 on macOS. Official registry package and integrity checked. Eight lifecycle scripts remained blocked under npm defaults; no security switch was weakened. Build succeeded using this fresh dependency tree. |
| node scripts/validate-content.mjs | PASS: four configured courses, 28 topics, 163 fallback sections. |
| node scripts/build.mjs | PASS from fresh installed dependencies, after final reading/schema identity rebind. |
| npm run typecheck | PASS: tsc --noEmit --incremental false. |
| npm run lint | PASS: zero errors, four warnings. Three intentional private image tags and one existing internal navigation warning. |
| node --test tests/*.test.mjs | PASS: 123 tests, zero failures/skips. |
| Reading package validation | PASS: 28 missions, 321 bilingual blocks, 56 exact photographs, 112 locale bindings. |
| Independent review | One physical-seal validation gap fixed before release; negative reseal tests now reject missing/unknown format, wrong photo digest, held sections and wrong course mapping. See KSDA-INDEPENDENT-REVIEW.md. |
| Runtime/content compatibility | All 83 runtime manifest files verified; framework-owned hashes and IDs, no reuse of CAPAi publication approval. |

The 123 tests include seven current authentication/callback checks; verified identity and admin allowlist boundaries; feature-off behaviour; invalid methods, cross-origin and foreign learner requests; private no-store delivery; optional video/check semantics; per-mission assets; required reflections and sequential completion; 26 database checks including fresh reconstruction, additive upgrade, synthetic record preservation, all 28 readings and 112 photo responses; and seven package/tamper/generic-course checks. Tests use synthetic accounts and block external provider access.

The auth tests caught a derivative callback header conflict; the callback now retains no-referrer and its own private headers. Framework-specific administrator return routes remain protected by the independent allowlist. No live source was changed.

## Local browser scope

The actual built worker was exercised through tests/fixture-server.mjs with synthetic identity and in-memory RPC responses. No provider login, real mail delivery, production database, real learner or durable progress was used. Browser observations and final result are recorded in the release report. This fixture is a local test entry point, not a route installed in the deployed application.

## Limits

Fresh database reconstruction and v0.1.0 upgrade were exercised in local PGlite with synthetic Supabase-compatible auth/provider stubs. This proves the supplied SQL and application contracts within that environment; it is not a newly provisioned managed Supabase project. SMTP, actual email/Google/password delivery, OAuth provider configuration, hosted Edge Function execution, independent deployment and recovery from operational backups remain operator acceptance work. No speed improvement or new clinical/BM/safety approval is claimed.

Source upload, merge and tag verification are separate and documented in the release report. No runtime credentials, learner exports or protected standalone ebook files belong in this repository.
