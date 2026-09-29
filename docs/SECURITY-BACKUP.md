# Security and backup boundary

Each installation has its own Supabase project, identities, Auth providers, email sender, administrator allowlist, report secret, hosting and operational backups. Do not connect a derivative to CAPAi production. Public keys also identify a backend; they must be this installation's values.

Server identity comes from Supabase `auth.getUser()`. The preserved administrator flow also requires confirmed email and the server-only `LMS_ADMIN_EMAILS` allowlist. Forwarded identity headers and client metadata never grant administrator access. The signed report function must use its own same-project endpoint and secret. Empty/unavailable settings fail closed.

Learner APIs use private/no-store responses and authenticated ownership checks. Reading/asset access and markers remain private. Personal notes, reflection choices and practice answers are temporary page state, not server payloads or durable learning evidence. Saved completion is self-reporting, not competency certification. Do not add analytics that collect these private fields.

The optional reading importer is an operator command, not a browser endpoint. Validate its local manifests and hashes, run it only against a disposable/independent target, review content and activate explicitly. Do not expose importer functions or service-role credentials to learners. Feature flags are display/rollout controls, not replacements for database authorization.

Keep database/Auth backups encrypted outside GitHub. Include schema/migrations, content releases/assets, user/progress data, deployment configuration and provider settings in a separately controlled recovery process. Practise restoring to an isolated destination. Source archives do not back up accounts, email delivery, external video bytes, sessions or provider secrets.

Never commit `.env.local`, `.dev.vars`, access tokens, service keys, real learner exports, session cookies, private notes, generated database dumps or browser traces. Use synthetic data for tests. Production provider acceptance and professional content review require their own evidence; local tests do not certify either.
