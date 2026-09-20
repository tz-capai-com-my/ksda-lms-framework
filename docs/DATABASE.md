# Fresh framework database

This setup is for a **new, isolated Supabase project**. Do not run it against the existing CAPAi project or any database with learner data. It deliberately creates four application tables and fails if they already exist. It is neither a CAPAi backup nor a migration of that production database.

## Install and configure

1. Create a separate Supabase project for this installation. Supabase already provides `auth.users`, `auth.uid()` and the `anon`, `authenticated` and `service_role` roles. Do not install the auth mocks from the test file.
2. Review `supabase/migrations/20260920000000_fresh_ksda.sql`, then apply it to the new project through your normal Supabase migration workflow or authenticated SQL editor. The file is a single transaction. No production endpoint or credential is embedded.
3. Edit `config/course-catalogue.json` for this installation. Every `databaseSlug` must be unique and match the application mapping. `missions` must match the number and order of the actual local learning topics, between 1 and 128.
4. Run `node scripts/generate-course-seed.mjs`, review `supabase/seed.sql`, and apply that seed to the new project. New records are published/free catalogue metadata; this is not professional approval of the teaching content. An existing course's access/status is preserved on reseeding. Seed changes never delete removed catalogue rows automatically.
5. Store this project's `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` in the application's environment. Keep privileged service credentials inside approved server/provider settings. Configure Supabase email OTP, a six-digit Token email template, sender/SMTP, site URL, expiry and rate controls separately. No Auth users or mail credentials are seeded.
6. Configure the owner-report function and owner sign-in through the framework's deployment instructions. This schema provides **no learner-editable administrator role**. Owner authorization is separate from learner OTP authentication.
7. Before opening registration, test two real accounts in the isolated project: OTP, onboarding, enrolment, one completion, sign-out/sign-in retention, and attempts to read/write the other account. Local database tests do not replace provider/PostgREST, email or browser integration checks.

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
```

The tests execute this migration and seed in [PGlite](https://pglite.dev/docs/api), a local PostgreSQL runtime. Only the test harness mocks the Supabase Auth schema/roles and `auth.uid()` claim. It exercises real SQL privileges, RLS, triggers, foreign keys and constraints as `anon`, two separate learners and a service role. No network calls, OTPs or external database changes occur. The seed must match the checked-in catalogue exactly.

Coverage includes anonymous isolation; cross-user reads/writes; profile/account boundaries; onboarding and catalogue enrolment gates; duplicate enrolment; zero-only initialization; percentage/sequence/ownership tampering; optimistic retries; completion timestamps; withdrawal/suspension/publication gates; stable course structure; and Auth-user deletion cascades.

## Operations and isolation

- Use a separate Supabase project for each installation while tenancy remains undecided. There is no tenant column or shared multi-brand isolation contract here; the owner report covers its entire project.
- There are no application Storage buckets in this setup. Public files ship with the application. Add reviewed bucket policies separately if future modules introduce uploads.
- Back up actual application data and Supabase Auth through the provider's approved backup/export workflow. Keep those backups and all credentials outside Git. A source repository and this seed cannot recover real accounts or progress.
- Record deployed Edge Function versions, Auth/email settings, runtime secret names, project/domain bindings and restoration steps without committing secret values. Test restoration in an isolated environment before calling it a complete recovery backup.
