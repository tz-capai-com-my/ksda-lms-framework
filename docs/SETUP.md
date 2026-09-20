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
