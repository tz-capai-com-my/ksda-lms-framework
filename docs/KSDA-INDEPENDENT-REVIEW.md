# Independent local Task 2 review

Reviewed 29 September 2026. Scope: `work/github-handover-20260929/ksda` runtime/content/database contracts, privacy, default external connections and installation claims. Root-owned final release reports, final hash sealing and remote operations were still in progress and are outside this review. No remote or production request was made.

## Finding corrected before sealing

**P1 — physical photo-source seal skipped its validation for the generated example.** At review, `scripts/build-reading-example.mjs` created a physical `sourceDocument` without a `presentation` field. `supabase/migrations/20260929091809_independent_interactive_reading.sql`, function `ksda_reading_private.validate_photo_source()`, returned immediately unless that field equalled `editorial-photos-v1`. The supplied package therefore imported without running that physical source's intended mission/block, course mapping, photograph count/reference and excluded-section checks. Revision-byte and table constraints still ran, and the delivery seal checked several relationships; those checks do not make the silently skipped physical validation intentional.

The finding was sent immediately to root and the schema agent. The builder now declares `presentation: 'editorial-photos-v1'` on the physical manifest. The schema checks alias mapping first, then rejects a missing/unsupported physical marker. New negative tests recompute manifest content hashes before testing wrong photo digests, held sections and incorrect course mapping, proving that these deeper guards run rather than relying only on the outer hash. Code identity and package bindings were regenerated after the fix. **Status: RESOLVED, independently rechecked with all 33 combined database/package tests passing.**

## Checks without additional actionable findings

- Default configuration uses `https://learning.example.com`, a neutral logo, empty support/shop/admin connections and an empty video mapping. No CAPAi production URL, project reference, SMTP host, owner or QA email appeared in the scanned 249 non-generated files. Credential-like hits were placeholders or synthetic tests; UUID hits were build/test fixtures. Canva URLs occur only in video tests. Original paid ebook directories and learner data are absent.
- The private example's 28 missions contain 321 bilingual reading blocks, 56 photos (6,669,998 bytes) and 112 locale bindings. The package validator passed during review. Teaching hash checks preserve verified Task 1 meaning; only the independent example's `fire-m01` video fields differ. All 28 framework video defaults are empty. Source identity, rights limits and pending professional-review status are explicit.
- Top-level `LICENSE` grants no open-source redistribution right. Example rights are limited to the owner-authorized private framework derivative. Attributions/provenance are preserved. Inherited unused marketing CSS identifiers are not paid content or production links; they were not treated as a defect.
- The local reading-package contract supports a variable mission count; its one-mission fixture passes. Catalogue/fallback validation uses configurable slugs, counts and order. The database installer resolves target course UUIDs by configured slugs and checks free/published status and expected counts. No fixed production UUID, fixed 28-mission requirement or CAPAi held-section list is embedded in the runtime/schema.
- The API requires verified identity, explicit learner scope and same-origin JSON writes. Private response headers disable public caching. Runtime checks bind manifest/revision bytes to code/source/asset hashes and reject held sections. Asset delivery rechecks mission eligibility and exact photo bytes/dimensions; SQL repeats learner status, enrolment and sequence checks. Private tables/functions are revoked from public/anon/authenticated access except the explicit authenticated RPC surface, whose identity guards remain in place.
- Installer output is local SQL. Default mode seals to review state without a publication/approval write. Explicit activation requires an operator reference and expected previous publication, checks exact imported hashes and preserves course/learner/progress rows. The migration is additive; upgrade documentation says not to replay the fresh schema or reset an existing installation.
- `docs/READING-INSTALL.md`, `docs/FEATURE-PARITY.md` and the example README distinguish local PGlite/software checks from hosted Supabase/Auth/SMTP/OAuth/browser acceptance. They do not infer professional, clinical, language or competency approval. Missing videos remain optional. Final report/navigation files being prepared by root were not called missing defects.
- Generated `dist/`, dependencies, work/output folders and environment secrets are ignored. The final upload manifest still needs root's explicit exclusion check; this review does not describe generated local build artifacts as remote deliverables.

## Validation observed

`node scripts/validate-reading-package.mjs examples/capai-community-reading` passed with the coverage counts above. `node scripts/validate-content.mjs` passed: four configured courses, 28 topics, 163 fallback sections.

After remediation, `node --test tests/database-schema.test.mjs tests/reading-database.test.mjs tests/reading-package.test.mjs` passed **33/33** (26 database checks including test groups, seven package checks), zero failures. Five negative sealing cases passed: missing presentation, unsupported presentation, rehashed wrong photo digest, rehashed held section and rehashed wrong course slug. Failed transactions left no release rows and preserved base learner/course/progress snapshots. Valid complete imports, fresh schema, v0.1.0 additive upgrade, anonymous/cross-user restrictions, sequence locks and all 28 mission/112 localized photo resolutions also passed.

Final local rebind identity:

- Runtime code hash, verified against all 83 listed files: `3c2df639c9dfb85d6cda755ffd86e457f430a0ef7829cdc9ce172ba11aac2f3d`.
- Delivery `ksda-community-example-20260929-r01`: `55431f45d83de386403c28c237d6280d2dbc27929b5cbee8f577a9c58fcef676`.
- Physical source `ksda-community-example-20260929-r01-content`: `ab1db150c3216f205e6e3cfdbea923bd2d7e852cd758318385cc8b9783d26389`.
- Source manifest: `a826beb23a0ccedfde0fdd09dbcfc13733018a314447ae77b9dd6c36a9c680ea`.
- Asset manifest: `9e1d6d861f192e04d84bd4040af146b9536e6e25eb9eaf04a5d1a69b097c8b69`.

The installer CLI generated 14,218,713 bytes of SQL at `/private/tmp/ksda-reading-import-final.sql` with `activate:false` and no database connection. It is outside the staged repository. [Machine evidence](KSDA-REBIND-VERIFICATION.json) records commands, identities and hashes of the corrected implementation/tests. Any subsequent runtime/schema change requires another rebind and relevant validation.

This is a local review, not an upload, merge, remote-release readback, fresh hosted Supabase installation, clinical approval or new performance measurement.
