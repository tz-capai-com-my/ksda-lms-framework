# KSDA Framework White-Label Release Report

29 September 2026, Asia/Kuala_Lumpur.

**WHITE-LABEL SOURCE READY — source, tests and uploaded content remotely verified. Final merge/tag references are recorded in the private GitHub release and final handover report. No deployment was performed.**

## Exact upstream and derivative

- Private repository: https://github.com/tz-capai-com-my/ksda-lms-framework
- Derived only after the CAPAi recovery release was merged and verified: `capai-live-v57-20260929`, commit `28780a22677f740776abd2251ce84015c522ca48` in `tz-capai-com-my/final-working-code-capai-lms`.
- Actual published CAPAi source: `2ca24e39eaf36ece10bc0aa48086ce900a797043` (Sites v57).
- Preserved framework predecessor: `e9e10d359d2e3005ea39730b9dae1cc8c238a65a`, release v0.1.0.
- New framework version: v0.2.0. Exact uploaded/merged/tag commits are recorded in REMOTE-RELEASE.json and the GitHub release. Do not substitute an unverified local commit.

## Included, adapted and excluded

The current bilingual mission reader, K/S/D/A story blocks, optional checks and feedback, practice, speak-aloud invitations, temporary notes, reading markers, per-mission private images, sequential progress, video slots and independent authentication are integrated. Brand configuration controls name/logo/colours/operator/support/public and shop URLs/locale/timezone/sender guidance and feature switches. Google is hidden by default; supported email-code and password flows remain. The existing Supabase-verified administrator register/report flow is preserved; Sites trusted identity headers are not imported.

The optional example contains all 28 updated missions (6/7/7/8), 321 EN/BM reading blocks and 56 unchanged photos (6,669,998 bytes), with 112 locale bindings. Twenty-seven revision files are byte-identical to upstream. The remaining fire-m01 revision differs only in the two video fields, emptied for independence; all teaching-content hashes match. Four legacy/fallback course definitions are preserved byte-for-byte. Five held sections remain excluded.

All 28 framework video slots are empty and optional. The CAPAi recovery's working fire-m01 link and 27 intentional placeholders are unchanged. See [video maintenance and register](docs/README-VIDEO-LINKS.md).

The examples are restricted to this owner-authorized private derivative; no unrestricted redistribution licence is granted. Required provenance, copyright and review status remain. Protected standalone ebooks, MAN-ISME paid curriculum and real learner records are excluded. Generic paid reader and owner review dashboard are not ported; exact boundaries are in [FEATURE-PARITY.md](docs/FEATURE-PARITY.md). No visual CMS, commerce system, account sharing or multi-tenancy is claimed.

## Independent installation and verification

Separate fresh-install and v0.1.0-upgrade instructions provide compatible base/additive schema, guards/RLS/grants, catalogue mapping, local import generation, validation and explicit expected-pointer activation. The original fresh migration is unchanged. Upgrade preserves users, profile/course UUIDs and earned progress. Default import creates a review-state release without activation; the default environment flag disables delivery until an operator independently installs and approves it. No CAPAi backend endpoint/key/owner identity/hosting binding is an active default.

Fresh locked dependencies, build and typecheck passed. Lint has zero errors/four documented warnings. The full suite passed 123 tests, including local fresh/upgrade reconstruction, access isolation, integrity/tamper rejection, all mission/photo delivery, current auth boundaries and generic one-mission course packaging. Details: [VALIDATION-v0.2.0.md](docs/VALIDATION-v0.2.0.md). Independent review found and resolved one installer seal gap before release.

Framework-owned release bindings are in [release-identity.json](examples/capai-community-reading/release-identity.json); all83runtime manifest entries were verified. This package's draft/review labels are intentional and do not borrow CAPAi publication approval.

Local browser checks passed for fire-m01, m02-m03, m03.m03 and M04-M08, including EN/BM switching, light/dark controls, 390px mobile width without horizontal overflow, loaded photographs, optional wrong-answer feedback/retry, note clearing and saved reading markers. After reloading the final build, fire-m01 completed with zero reading coverage and no optional knowledge-check answer or video, saved 16% course progress and unlocked fire-m02. An initial fixture-only completion error was traced to an old process importing a removed build chunk; restarting the fixture resolved it without an application change. The synthetic fixture prevents external network calls and keeps records in memory. Remote retrieval proof is recorded separately. Fresh hosted Supabase installation, actual SMTP/OAuth provider acceptance and a new deployment were not performed. Existing pending professional/clinical/BM review is carried forward. No new performance improvement is claimed.

## Operational boundary

LIVE application changed/published: NO. Production database/data/security/pointers changed: NO. SMTP/Auth/DNS changed: NO. CAPAi video source altered: NO. Original history/tags rewritten: NO. No third repository or AI-engine preparation was started; pre-existing unrelated work was left unchanged.

## Remote retrieval evidence

Uploaded branch `release/ksda-v0.2.0-20260929`, verified content commit `02e12d81bb9cb6170f83cfb984509ea9f34fe4d1`, tree `1be1ed8ed7343d0fe8dc53babcfc82a3286f2328`. All 251 remote file hashes/modes match the staged package; all 108 historical paths remain. All 95 example files (7,806,539 bytes) were independently retrieved and byte-verified, including every mission revision and photograph. Eleven further critical source/configuration/document files were retrieved and hash-verified. See [readback evidence](REMOTE-CONTENT-VERIFICATION.md) and [release references](REMOTE-RELEASE.json).

[PR #1](https://github.com/tz-capai-com-my/ksda-lms-framework/pull/1) uses the normal merge route. No mandatory review requirement was observed or bypassed, and no Actions run was triggered. This report deliberately identifies the content commit separately from the subsequent metadata/merge commits. The v0.2.0 release records the final merged default-branch commit; prior v0.1.0 remains at `e9e10d359d2e3005ea39730b9dae1cc8c238a65a`.
