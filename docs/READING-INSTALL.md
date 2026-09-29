# Independent reading installation

Use an independent framework Supabase project and application configuration. These scripts generate local SQL; they never connect, create a project or publish a site. See [DATABASE.md](DATABASE.md) for schema/security details and the [optional example bundle](../examples/capai-community-reading/README.md) for rights and review limits.

## Fresh independent installation

1. Review and apply `supabase/migrations/20260920000000_fresh_ksda.sql` to the new empty project's application schema using its normal owner migration workflow.
2. Apply `supabase/migrations/20260929091809_independent_interactive_reading.sql` next. This creates the private reading schema with no reviewers or active release.
3. Review the brand/course configuration, generate `supabase/seed.sql` with `node scripts/generate-course-seed.mjs` and apply it to the same project. The catalogue generates installation-owned UUIDs. Keep each course's `databaseSlug`, mission count and ordering aligned with the content package.
4. Generate the current code identity, build and validate the optional package, then generate its import:

```sh
node scripts/generate-reading-code-identity.mjs
node scripts/build-reading-example.mjs
node scripts/validate-reading-package.mjs examples/capai-community-reading
node scripts/generate-reading-install.mjs --package examples/capai-community-reading --out /tmp/ksda-reading-import.sql
```

5. Review the SQL and apply it through the independent project's owner workflow. The complete image-byte import is about 14 MB for this example; use a file-capable database client such as `psql`, rather than pasting it into a browser SQL editor. Use the independent project's verified connection and its required TLS certificate settings; enter its password privately when prompted. For example, with a separately configured connection service named `ksda-independent`:

```sh
psql 'service=ksda-independent' --password --set=ON_ERROR_STOP=1 --file /tmp/ksda-reading-import.sql
```

The connection service is operator configuration, not supplied production credentials. The import transaction seals the complete reading/image bytes as `in_review`. Course UUIDs are looked up locally by slug; users, profiles, enrolments, earned progress and reading markers are untouched. The import rejects missing/non-free/unpublished courses, count mismatches and duplicate release IDs. Stop on any SQL error; inspect its cause before retrying. Do not work around identity failures by disabling constraints.
6. After the independent operator approves the exact package, create the separate activation transaction:

```sh
node scripts/generate-reading-install.mjs --package examples/capai-community-reading --out /tmp/ksda-reading-activate.sql --activate-only --expected-release none --approval-reference 'Independent operator review reference'
```

7. Review/apply that transaction to the same independent project, deploy the matching framework source through a separately authorized deployment and enable `KSDA_READING_DELIVERY_ENABLED`. Configure this installation's Auth, sender, administrator and secrets independently, then perform provider/browser acceptance.

`none` means the expected current reading pointer is empty. For a deliberate successor, use the exact current framework release ID. A changed pointer fails the transaction instead of overwriting somebody else's activation. `--activate` combines a first import and explicit activation into one generated transaction; the default always imports without activation.

The operator reference is an operational decision. It does not substitute for the bundle's unresolved professional, safety, language or redistribution review. Videos and optional checks remain optional; course completion remains self-reported learning progress.

## Upgrade from framework v0.1.0

Back up the independent installation through its approved private backup workflow. Keep the original four base tables and their data. **Apply only `20260929091809_independent_interactive_reading.sql`; never replay the fresh base migration or reset an existing database.** Existing course IDs, users, enrolments and earned progress are preserved.

Continue with steps 4–7 above using the existing compatible catalogue. Reseeding is unnecessary if its mapping/counts already match. The original framework course guard prevents changing an enrolled course's slug/count; preserve mission ordering as well. New reading releases have independent block-marker state, while earned course progress remains unchanged. Use a new course/version and a separately reviewed migration policy for incompatible teaching structure changes.

Do not import the historical CAPAi schema, its fixed UUID catalogue, production credentials, or the large private installer into this framework. The included migration and package are the compatible independent path.

## Verification and release versioning

```sh
node --test tests/database-schema.test.mjs tests/reading-database.test.mjs
```

The local PGlite checks cover fresh reconstruction and a v0.1.0 upgrade with synthetic existing learners/progress, all current reading envelopes/photo bindings, sealed identity checks, anonymous/cross-user boundaries and sequence locks. Managed Supabase, SMTP, real Auth, Edge runtime and browser acceptance remain separate. No hosted installation is claimed by these local tests.

Sealed release IDs are immutable: reimporting the same ID fails. After changing runtime/configuration or content, generate a **new framework-owned source/delivery identity** and compatible hashes, validate it and activate through an explicit expected-pointer transaction. Retain prior releases and marker records. Never change a sealed row, reuse CAPAi's approval/hash or disable digest validation to make a changed package load.
