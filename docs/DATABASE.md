# Independent framework database and v0.1.0 upgrade

The **fresh path** is for a new, isolated Supabase project. The **upgrade path** below applies only to an existing independent framework v0.1.0 installation. Neither path is a migration of CAPAi production. The original `20260920000000_fresh_ksda.sql` is preserved unchanged: it creates the four base application tables and fails if they already exist. The new `20260929091809_independent_interactive_reading.sql` is additive and preserves those tables and their progress guards.

## Install and configure

1. Create a separate Supabase project for this installation. Supabase already provides `auth.users`, `auth.uid()` and the `anon`, `authenticated` and `service_role` roles. Do not install the auth mocks from the test file.
2. Review `supabase/migrations/20260920000000_fresh_ksda.sql`, then apply it to the new project through your normal Supabase migration workflow or authenticated SQL editor. Next apply `supabase/migrations/20260929091809_independent_interactive_reading.sql`. Each file is a transaction. No production endpoint or credential is embedded. The reading migration checks that the framework's existing progress/course guard functions and `mission_count` column exist, then creates a new private reading schema. It fails if that reading schema already exists.
3. Edit `config/course-catalogue.json` for this installation. Every `databaseSlug` must be unique and match the application mapping. `missions` must match the number and order of the actual local learning topics, between 1 and 128.
4. Run `node scripts/generate-course-seed.mjs`, review `supabase/seed.sql`, and apply that seed to the new project. New records are published/free catalogue metadata; this is not professional approval of the teaching content. An existing course's access/status is preserved on reseeding. Seed changes never delete removed catalogue rows automatically.
5. Store this project's `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` in the application's environment. Keep privileged service credentials inside approved server/provider settings. Configure Supabase email OTP, a six-digit Token email template, sender/SMTP, site URL, expiry and rate controls separately. No Auth users or mail credentials are seeded.
6. Configure the owner-report function and owner sign-in through the framework's deployment instructions. This schema provides **no learner-editable administrator role**. Owner authorization is separate from learner OTP authentication.
7. Before opening registration, test two real accounts in the isolated project: OTP, onboarding, enrolment, one completion, sign-out/sign-in retention, and attempts to read/write the other account. Local database tests do not replace provider/PostgREST, email or browser integration checks.

## Load the optional current reading examples

Review the optional bundle's rights, hold list and professional-review limits before enabling it. The bundle is supplied as data and actual photographs; it does not borrow CAPAi's database, users, code approval or external video. The default video slots are empty. The four catalogue records must exist first, because reading mission rows refer to **this installation's** course UUIDs resolved by `database_slug`.

After any final runtime/configuration change, regenerate the framework code identity and the example package in that order:

```sh
node scripts/generate-reading-code-identity.mjs
node scripts/build-reading-example.mjs
node scripts/validate-reading-package.mjs examples/capai-community-reading
node scripts/generate-reading-install.mjs --package examples/capai-community-reading --out /tmp/ksda-reading-import.sql
```

The generator checks the package's current framework code hash and writes SQL locally; it never connects to a database. Review its target/source IDs and apply the generated import through the **independent installation's** normal owner migration workflow. This example produces about 14 MB of SQL containing actual image bytes: use a file-capable client such as `psql` with the independently verified connection/TLS settings and stop-on-error enabled, as shown in [READING-INSTALL.md](READING-INSTALL.md). Do not paste the large import into a browser SQL editor. Imported releases are sealed and `in_review`; no reviewer, approval or publication is created. Existing course UUIDs, users, profiles, enrolments, progress and reading markers are not changed. The package's mission count must match the corresponding configured database course count. A duplicate release is rejected rather than overwritten.

When the independent operator has reviewed this exact package, generate a separate activation transaction. The example below requires an initially empty reading pointer; substitute the exact current framework release ID when intentionally replacing an existing release:

```sh
node scripts/generate-reading-install.mjs --package examples/capai-community-reading --out /tmp/ksda-reading-activate.sql --activate-only --expected-release none --approval-reference 'Independent operator review reference'
```

Review and apply that transaction to the same independent installation. It checks the imported sealed content/source/asset/code hashes, records the operator reference and switches the pointer only if the expected prior value still matches. The reference records an operational release decision; it does not invent professional, safety, clinical, language or redistribution approval. A one-transaction first import plus activation is also available through `--activate` with the same explicit expected pointer and review reference; it is never the default.

Enable `KSDA_READING_DELIVERY_ENABLED` in the application's independent environment only after the compatible schema, catalogue, exact package and activation are ready. Disabling the reading feature restores the existing fallback reading path without deleting earned course progress. Changing hash-bound runtime/configuration files requires a newly generated compatible content delivery identity; do not reuse a CAPAi or stale framework code hash or bypass validation.

## Upgrade an existing independent v0.1.0 installation

1. Take the installation's normal private provider backup and record its deployed application version. Keep accounts, enrolments, progress and credentials outside Git. Identify the existing four base tables, guard functions and configured course slugs/counts; stop if they differ from the supported v0.1.0 contract.
2. Keep the reading feature disabled while preparing the upgrade. **Do not replay** `20260920000000_fresh_ksda.sql`, reset the database or seed synthetic Auth users.
3. Apply only the new additive `20260929091809_independent_interactive_reading.sql` through the installation's existing migration process. It creates 11 private reading tables, an asset-delivery view and 16 reading/helper functions. All private tables have RLS and no client/service-role direct grants; permitted authenticated RPCs enforce identity, active onboarding, release approval and course progress.
4. Use the existing course catalogue and its existing UUIDs. Review any regenerated catalogue metadata before applying it; a reseed is unnecessary when the catalogue is already compatible. Never change an enrolled course's count/order or slug in place. The original guard functions continue to reject structural changes, skips and resets.
5. Generate, inspect and import the optional package as described above. The importer resolves local course IDs and rejects missing courses, unpublished/non-free courses or mismatched counts. It never rewrites learner progress to make an import pass.
6. Record the independent operator's exact release approval, activate with an expected current pointer and then enable the compatible reader runtime. Reading markers start empty for a new release/revision; earned course progress remains where the learner left it. Old reading-release marker rows are retained if later releases are installed; they are not silently reassigned.
7. Run the local checks and the independent provider/browser acceptance checks before broad use. If a release needs to be withdrawn, disable the feature or make a separately reviewed expected-pointer switch; retain sealed releases and learner records. There is no automatic destructive down migration.

No cloud database, domain, secret, Auth setting or deployment was created by this repository update. A real hosted upgrade must use the installation operator's independently authorized workflow.

## Current application contract

| Table | Purpose and write boundary |
|---|---|
| `profiles` | One row per Auth UUID. A learner can read their own account state, insert their own profile, and update their display name/language/onboarding while active. Only a privileged server operator can change `account_status`. Onboarding cannot reset after completion. |
| `courses` | Project-wide catalogue. Anonymous and authenticated users can read published metadata. Learners cannot insert/update/delete catalogue records. Slug and `mission_count` are immutable once anyone is enrolled. |
| `module_enrolments` | Unique learner/course membership. Learners may insert only their own active membership after active onboarding, for a published free course. They cannot change status, owner, or delete it. Completion leaves the enrolment active, matching the existing app. |
| `module_progress` | Unique learner/course aggregate. Active learners can see only their own rows. New progress must start at mission `"1"`, zero percent and no completion timestamp, against an active enrolment in a published free course. Updates advance at most one topic; resets/skips fail. |

All application tables have RLS. Private tables have no anonymous read permission. Restricted column grants prevent a learner from supplying account status, timestamps on profiles/enrolments, database identifiers or ownership changes. Table-owner/service-role operations are privileged; keep their credentials off the client.

The current API uses lowercase catalogue/status values and `TEXT` for `current_mission`. For `N` topics, after `k` completions the database requires `current_mission = String(k + 1)` and `progress_percentage = floor(100 * k / N)`. At completion the value is `N + 1` and 100 percent. Activity/completion timestamps are assigned by the database. Same-progress retries preserve timestamps; stale optimistic updates match no row rather than overwriting progress.

These controls preserve ownership and aggregate sequencing. They **do not prove that a learner read a topic or completed an assessment**: an authenticated learner with the publishable client can submit successive permitted updates directly. The supplied pilot is based on self-reported completion. Strong assessment validation would require reviewed answers and a server-authorized/RPC completion design; do not claim anti-cheat or certification guarantees from this schema.

After learners enrol, do not change a course's topic count/order in place. Use a new course slug/content version with a deliberate learner migration policy. The database freezes the count and slug; the application/content workflow must also preserve topic order and meaning.

## Local PostgreSQL checks

Run after installing dependencies:

```sh
node scripts/generate-course-seed.mjs
node --test tests/database-schema.test.mjs
node --test tests/reading-database.test.mjs
```

The tests execute this migration and seed in [PGlite](https://pglite.dev/docs/api), a local PostgreSQL runtime. Only the test harness mocks the Supabase Auth schema/roles and `auth.uid()` claim. It exercises real SQL privileges, RLS, triggers, foreign keys and constraints as `anon`, two separate learners and a service role. No network calls, OTPs or external database changes occur. The seed must match the checked-in catalogue exactly.

Coverage includes anonymous isolation; cross-user reads/writes; profile/account boundaries; onboarding and catalogue enrolment gates; duplicate enrolment; zero-only initialization; percentage/sequence/ownership tampering; optimistic retries; completion timestamps; withdrawal/suspension/publication gates; stable course structure; and Auth-user deletion cascades.

The new reading test exercises both a fresh local fixture and a versioned upgrade containing synthetic existing learners and earned progress. It imports the actual optional package, resolves all current mission envelopes and localized photo bytes, verifies explicit approval/hash binding, rejects sealed reimports and malformed physical packages (missing/unsupported presentation, photo bindings, held sections or course mapping), denies anonymous/reviewer/direct-table/activation bypass, checks separate-user reading markers and locked mission/assets, and compares existing profiles/enrolments/progress/course IDs before and after the upgrade. PGlite uses synthetic Auth roles/tables and does not reproduce Supabase's managed API/Auth/Edge runtime. A passing local test is **local fresh/upgrade reconstruction verified**, not a claim that a hosted Supabase installation or browser/email acceptance has occurred.

## Reading package database contract

`ksda_reading_private.releases`, `release_sources`, `mission_revisions` and `photos` hold immutable, hash-bound reading material and a separate delivery alias. `publication` selects one approved delivery. `release_approvals` binds that decision to exact content/source/asset/code hashes. The `asset_delivery` view provides EN/BM bindings for one stored photo byte sequence. `delivery_progress` stores only released block IDs, review-marker values and the last block—not free text, reflections or private notes. Preview helpers are retained for compatible private workflows, but the reviewer table is empty by default and the supplied application does not enable a review route.

The learner RPCs are `ksda_reading_delivery(p_scope,p_release,p_mission)`, `ksda_reading_delivery_asset(p_scope,p_release,p_asset,p_locale)` and `ksda_reading_delivery_progress(p_scope,p_release,p_mission,p_revision,p_reviewed,p_last)`. The app uses `p_scope='learner'`. All procedures preserve authenticated identity; no user-ID parameter can impersonate another reader. Security-definer helpers use a fixed empty search path and explicit auth checks; private schema functions and tables are not callable/readable by browser roles. Operational activation is owner-only.

The generic migration does not hard-code 28 missions, four subjects, production UUIDs or fixed technical hold IDs. It validates arbitrary installed course mappings against the signed manifest and existing course count; explicit `excluded_section_ids` remain bound across physical and delivery manifests. Core v0.1.0 course counts support 1–128 missions. Learning content approval and compatibility remain the operator's responsibility.

## Operations and isolation

- Use a separate Supabase project for each installation while tenancy remains undecided. There is no tenant column or shared multi-brand isolation contract here; the owner report covers its entire project.
- There are no application Storage buckets in this setup. Public files ship with the application. Add reviewed bucket policies separately if future modules introduce uploads.
- Back up actual application data and Supabase Auth through the provider's approved backup/export workflow. Keep those backups and all credentials outside Git. A source repository and this seed cannot recover real accounts or progress.
- Record deployed Edge Function versions, Auth/email settings, runtime secret names, project/domain bindings and restoration steps without committing secret values. Test restoration in an isolated environment before calling it a complete recovery backup.
