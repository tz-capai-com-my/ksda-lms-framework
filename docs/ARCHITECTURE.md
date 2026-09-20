# Deployment and tenancy boundary

The framework runs one brand/catalogue against one Supabase project. That project stores Auth identities and four application tables. Each installation supplies its own public site URL, email settings, database connection, administrator allowlist and report signing secret.

No requests are routed to CAPAi. No original Sites project ID, admin allowlist or live Supabase credentials are included. The copied learning material is example content, not a shared data connection.

## What can change now

- Branding and public support/operator settings through config/brand.json.
- Course slugs, metadata, images, bilingual lessons, questions and module counts through the documented content files.
- Database and report endpoint through environment settings.
- Administrator identities through a server-only allowlist checked against verified Supabase users.

## What remains a future decision

**Independent installations:** simplest current boundary. Separate Supabase projects isolate users, admin reports and data, with separate deployment operations.

**Shared multi-tenancy:** would require tenant-aware database keys, tenant membership and administrator roles, RLS on every tenant-owned row, tenant-scoped reporting/export, host routing, content ownership/versioning and cross-tenant tests. A brand ID in the UI alone is not tenant isolation. This repository does not claim that support.

**CAPAi integration:** would require an explicit identity/linking agreement, scoped APIs, ownership/consent decisions and a migration plan. Do not reuse CAPAi's database or service role key merely to obtain a connection.

The current administrator panel supports learner records and CSV export. Modules are edited in source and deployed; there is no visual module builder or learner impersonation tool.

Learner progress is self-reported completion, not a professional qualification or proof that a person performed an activity. Reflection writing remains private to the page and is never sent with progress requests.
