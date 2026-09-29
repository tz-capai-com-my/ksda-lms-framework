# New installation setup

## Brand and privacy

Edit config/brand.json and replace the neutral SVG logo. Set a real HTTPS siteUrl, legalName and supportEmail. The included privacy page explains the implemented data flow; add your retention/deletion process and required operator information before launch. Do not publish another organisation's logo or course material without permission.

## Supabase

Use a new project. Follow DATABASE.md for the schema and generated catalogue seed. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in the hosting runtime; only these public values may reach the browser. They are not admin credentials.

Configure email OTP sign-in with a six-digit Token email template, the new site's URL/allowed redirects and your sender/SMTP settings in Supabase Auth. Configure delivery/rate limits for the intended learners. Provider secrets belong in Supabase settings, not GitHub.

## Administrator access

Set LMS_ADMIN_EMAILS to comma-separated verified email addresses on this installation. Empty means nobody can access administration. Sign in through the normal email-code screen, then visit /admin. The server verifies the Supabase user and confirmed email before checking the allowlist; client labels and forwarded identity headers do not grant access.

For the learner register/export, deploy supabase/functions/admin-learner-report/index.mjs as a Supabase Edge Function with its custom HMAC verification. Configure that function's gateway with verify_jwt = false because it validates signed server-to-server requests itself. Set the same strong random LMS_LEARNER_REPORT_SECRET in the Site runtime and function secrets, plus LMS_LEARNER_REPORT_URL in the Site runtime pointing to the function's HTTPS endpoint on your Supabase project. The function uses SUPABASE_URL and Supabase's server-only service role/secret key to read records. Never expose those privileged keys to clients or commit them.

Without the report connection, administration displays a connection-pending state; it does not claim there are no learners. Enquiry management from the CAPAi marketing website is outside this framework.

## Release verification

Run npm test, npm run typecheck and npm run lint. Test both languages, phone/desktop views, email delivery, session persistence, onboarding, two separate learner accounts, topic sequencing, sign-out, denied non-admin access and admin export in an isolated deployment. Automated Auth/Edge tests use fixtures; actual provider setup requires this staging smoke test.

Back up database/Auth data separately and store secrets in a password/secret manager. A GitHub source checkpoint alone cannot recover learner records or mail configuration.

## v0.2.0 authentication and reading setup

The updated auth UI supports email OTP, password sign-in/settings/recovery and optional Google OAuth using the verified upstream client flow. All methods verify identity and account state with the server. Set the new site's exact `/learn/auth/callback` URL in its independent Supabase redirect allowlist. Recovery links use PKCE and must be opened in the same browser that requested them. Never paste provider secrets into source files.

Google is hidden by default (`config/brand.json` → `features.googleLogin=false`). Configure your independent provider before enabling it. Password setup is a journey step for new email users; existing onboarded v0.1.0 users keep access. Password policy and reauthentication are enforced by Supabase; configure a policy consistent with the UI guidance (at least eight characters, upper/lower case, number and symbol). No cross-installation account sharing is implemented.

Read [BRANDING.md](BRANDING.md), [DATABASE.md](DATABASE.md), [MODULES.md](MODULES.md) and [SECURITY-BACKUP.md](SECURITY-BACKUP.md). Fresh installation and upgrade are separate database procedures. The new optional content does not appear merely by copying the renderer; import, review and activate its locally verified release, then enable `KSDA_READING_DELIVERY_ENABLED` only in that independent runtime.

Reference API guidance checked 29 September 2026: [Supabase password auth](https://supabase.com/docs/guides/auth/passwords), [Google OAuth](https://supabase.com/docs/guides/auth/social-login/auth-google), and [changelog](https://supabase.com/changelog). No provider setting was changed by this repository task.
