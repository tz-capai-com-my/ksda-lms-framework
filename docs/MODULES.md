# Configure and author learning modules

Course metadata, fallback definitions and optional interactive reading packages form one versioned content contract. The engine does not require the example's four subjects or 28 missions. Configure new subjects through data; this repository does not claim a graphical CMS.

## Catalogue and fallback definitions

1. `config/course-catalogue.json`: public metadata, unique site `slug`, independent `databaseSlug`, display number, EN/BM title/outcome/style/duration, ordered topic count (`missions`), local image and alt text.
2. `content/ksda/free-topics.json`: matching course slugs and ordered stable topic IDs, bilingual summaries/notes prompts and reflection IDs/options/feedback. Option order matches between languages.
3. `content/ksda/course-details.json`: matching ordered course/topic IDs and detailed sections with stable IDs, EN/BM titles/body arrays, kind, source pages and review state.
4. `content/ksda/topic-video-links.json`: optional reviewed links mapped by stable mission ID. Default is empty. Video positions remain visible and never block reading or completion.

Run `npm run content:validate` before builds. `npm run seed:generate` generates independent database catalogue rows and mission counts. Public catalogue images belong in `public/`; authenticated or licensed full lessons do not. Use the runtime's supported safe video/link formats. Configured supporting-material links are optional and never become completion requirements.

The four fallback JSON datasets are byte-identical to Task 1's published application. Older gated `courses-12.json`/`courses-34.json` material remains for compatibility; it does not become newly approved content or introduce grading. `reviewState: REVIEW` sections remain hidden.

## Optional interactive reading package

The [owner-authorized private example](../examples/capai-community-reading/README.md) demonstrates the complete current method. Its `bundle.json` contains an immutable physical source release and delivery alias, mission revisions and photograph paths/hashes. A stable `mission_id` and site `course_key` map to a target `database_slug`; import resolves independent UUIDs. No production UUID or credential belongs in authored content.

| Revision field | Requirement |
| --- | --- |
| `mission_id`, `course_key`, `title` | Stable IDs and bilingual title matching the configured ordered course. |
| `bridge` | Bilingual narrative introduction and personal relevance. |
| `sections` | Ordered unique `id`, `type`, `ksda_stage`, bilingual title, `paragraphs: [{en,ms}]`, and one stable `block_ids` entry per paragraph. |
| `questions`, `reflection_feedback` | Required reflection choices with matching EN/BM option order and aligned feedback; not scored assessments. |
| `knowledge_check` | Optional understanding/rehearsal prompt and feedback; never gates completion. |
| `notes_prompt`, `declaration` | Bilingual private reflection/AAR prompt and completion declaration. |
| `pilot_spoken_prompt` | Optional speak-aloud invitation where appropriate, without disclosure of sensitive information. |
| `editorial_photos.opening`, `.closer` | Stable photo IDs, dimensions, bilingual alt/captions and closer placement. The current photo contract uses WebP files with explicit EN/MS bindings. |
| `video_link`, `video_embed` | Optional safe configuration; empty by default in the independent example. |
| `source_map`, `review_holds` | Source dispositions and review boundaries; passing software checks does not imply clinical, safety or translation approval. |

Keep Knowledge, Skill, Desire, Action and After Action Review explicit in the teaching: understandable situations, safe fictional rehearsal, personal relevance and a useful next step. The renderer's `knowledge`, `practice`, `review`, `action` section types and `ksda_stage` label present the authored sequence. No automatic pedagogy validator supplies missing teaching. AAR uses reflections and private notes, not a scored competency claim.

Reading coverage uses stable block identity. Required reflections and the declaration govern completion; coverage, video, optional knowledge checks/practice ticks and purchases add no requirements. Personal notes and answer text stay in the current component, are not uploaded, and clear on navigation/refresh. Copying notes is an explicit learner action. Do not request addresses, health details, passwords or other sensitive information in examples.

## Validate and version

`scripts/validate-reading-package.mjs` validates generic course/mission counts, exact payload/photo bytes, bilingual paragraph/block alignment, signed mission order, source/asset/code relationships, locale bindings and explicit `excluded_section_ids`. It rejects path traversal and symlinks. Each package signs its own exclusions; fixed CAPAi subject counts or held IDs do not belong in the engine.

Create framework-owned source/asset identities and bind the exact runtime hash; the delivery manifest references the physical source hash. The example builder is deliberately example-specific and preserves its reviewed input hashes. For another course, create a reviewed package rather than bypassing those checks. Reusing photograph bytes does not transfer rights or upstream approval.

After reviewed runtime/configuration changes, regenerate code identity, rebuild package bindings, and run validation/tests. See [reading installation](READING-INSTALL.md) for local SQL generation and independent installation. Default import seals content for review; approval and activation are separate operator decisions. Generation and validation do not connect to production.

## Preserve progress

Topic position/count and stable block IDs carry progress semantics. Never reorder/remove/insert topics in a course already used by learners. Publish a new course with new site/database slugs for structural changes, preserving old courses for existing enrolments. Mission-count guards cannot make same-count reordering safe.

Minor wording/translation corrections that preserve meaning and boundaries may retain IDs, but still require a new immutable release. Materially changed reading blocks need new IDs and an explicit progress decision. Create successor release/delivery bindings; do not edit installed immutable releases or silently reinterpret saved markers.
