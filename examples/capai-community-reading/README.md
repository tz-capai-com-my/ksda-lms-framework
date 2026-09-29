# Optional community reading example

This private example contains the current 28 English/Bahasa Melayu missions, 321 bilingual reading blocks, 56 approved illustrative photographs and 112 locale-to-photo bindings. It demonstrates narrative bridges, Knowledge/Skill/Desire/Action sections, reflection feedback, optional understanding checks and temporary private notes.

It derives from the exact remotely verified CAPAi recovery release [`capai-live-v57-20260929`](https://github.com/tz-capai-com-my/final-working-code-capai-lms/releases/tag/capai-live-v57-20260929), release commit `28780a22677f740776abd2251ce84015c522ca48`, verified content commit `e19f2e255aad00ddf4045cabe0a0b68b2c156592`. The upstream published application was `2ca24e39eaf36ece10bc0aa48086ce900a797043`. These are provenance references, not instructions to connect to CAPAi production.

## Rights and review status

The owner authorized these readings and photographs as a **private example in `tz-capai-com-my/ksda-lms-framework` only**. This is not an unrestricted redistribution or public-publication licence. Additional distribution, rebranding or publication requires rights review. Attribution and source references remain in the package. Protected ebooks, paid MANISME material, real learner records and production course UUIDs are excluded.

Professional review remains **PENDING**: 13 focused decisions and 28 mission review rows. This package does not create clinical, fire-safety, Bahasa Melayu or competency approval. Software tests and completion records do not establish professional competence. Five held sections remain absent from active payloads and are listed in every signed manifest.

## Derivative changes

- All teaching text, questions, feedback, safe practice boundaries, stable section/block identifiers and 56 photograph bytes are preserved. Twenty-seven revision files are byte-identical to upstream. In `fire-m01` only `video_link` and `video_embed` change to `null`.
- All 28 framework video positions start empty and remain optional. CAPAi's working video and 27 pending positions remain unchanged upstream. Use the blank [video register](VIDEO-LINKS.md) and framework video configuration after independent approval.
- Import resolves course UUIDs from the target installation's database slugs. No production account or connection is included.
- Content, source, asset and code identities belong to this derivative. CAPAi production approval is not inherited.

[Provenance verification](provenance-verification.json) records the semantic comparison. [Source index](source-index.json) records original/revised revision hashes, rights, course mappings and photograph hashes. [Release identity](release-identity.json) records current package identity and counts.

## Local validation and optional installation

Run from the repository root:

```sh
node scripts/validate-reading-package.mjs examples/capai-community-reading
node scripts/generate-reading-install.mjs --package examples/capai-community-reading --out work/community-reading-import.sql
```

SQL generation is local and opens no database connection. Default import seals content for review without approval or publication. Follow [database setup](../../docs/DATABASE.md) and the [reading installation guide](../../docs/READING-INSTALL.md) before reviewing/applying SQL to your own independent backend. Preserve existing accounts and progress. Never apply this package to CAPAi production.

The example is optional; checked-in fallback definitions remain usable without it. Choose either rights-approved use of this example or your own reviewed course material. Replace catalogue, fallback definitions and optional reading package together, preserving consistent course IDs/order/counts.

After reviewed runtime changes, regenerate code identity before package bindings:

```sh
node scripts/generate-reading-code-identity.mjs
node scripts/build-reading-example.mjs
node scripts/validate-reading-package.mjs examples/capai-community-reading
```

The builder verifies reviewed teaching and photograph hashes. It does not authorize changes or publish. For an already imported package, create a new release ID/version; never overwrite an installed immutable release. See [module authoring](../../docs/MODULES.md).

For a successor example, edit `source_id` and `delivery_id` in `source-index.json` before rebuilding, keeping them distinct and framework-owned (for example `ksda-community-example-20261001-r02-content` and `ksda-community-example-20261001-r02`). The builder reads these fields; no engine code edit is needed. Record reviewed input changes and provenance in the successor index, preserve the old package/release for recovery, and regenerate SQL for the new package. Merely changing IDs does not approve altered teaching or grant publication rights.

## Package files

| File | Purpose |
| --- | --- |
| `revisions/` | Exact UTF-8 payload files; revision hash covers complete file bytes. |
| `assets/` | Approved local WebP bytes, never fetched from CAPAi. |
| `source-index.json` | Reviewed inputs, upstream mapping, rights and exclusions. |
| `source-manifest.json` | Framework source identity. |
| `asset-manifest.json` | Framework asset identity and EN/MS bindings. |
| `code-manifest.json` | Generated runtime file list bound to this package. |
| `physical-content-manifest.json` | Source release and signed mission/asset/exclusion metadata. |
| `content-manifest.json` | Delivery alias, source release ID and parent content hash. |
| `bundle.json` | Installer entry point; each `manifest_text` is the exact hashed content text. |

Source and asset identities use compact JSON with recursively sorted object keys; preserve array order. Runtime code identity hashes its generated JSON array exactly. Revision files are hashed without reformatting. Local validation does not claim a fresh hosted Supabase restore or a public release test.
