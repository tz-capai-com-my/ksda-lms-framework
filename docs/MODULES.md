# Configure or replace modules

Three files form one content contract:

1. `config/course-catalogue.json`: public metadata, unique site `slug`, database `databaseSlug`, display number, EN/BM title/outcome/style/duration, topic count (`missions`), local image and alt text.
2. `content/ksda/free-topics.json`: matching course slug/title and ordered topics. Each topic has stable unique ID, EN/BM title/summary/notes prompt, optional video, and reflection question IDs/options/feedback. Option order must match across languages.
3. `content/ksda/course-details.json`: matching course/topic IDs in the same order and detailed sections with stable IDs, EN/BM titles/body arrays, kind, source pages and review state.

Run `npm run content:validate` before every build. `npm run seed:generate` produces database catalogue rows from this metadata, including mission_count. Store images in public/ and reference their local paths. Use HTTPS for external video/reference URLs. Configure shopUrl only if you provide optional supporting materials.

The method keeps Knowledge, Skill, Desire, Action and After Action Review. In the current self-study topic UI, knowledge/practice/action sections and private reflection questions implement the cycle. Keep personal relevance/desire and review explicit in your authored content. No automatic educational validation or medical/safety approval is implied.

Existing `reviewState: REVIEW` sections stay hidden. Review and approve newly authored content before changing its release state. The separate legacy courses-12/courses-34 draft assets and approvedRules remain gated; they are not the current self-study authoring path and do not grant new graded assessment features.

## Preserve existing progress

Topic position and count are part of the saved progress contract. Never reorder/remove/insert topics in a course already used by learners. Publish a new course with a new site/database slug (for example `workplace-readiness-v2`), preserving the old course/content for existing enrolments. Translation or typo corrections that keep meaning and topic boundaries can retain the course identity. Database guards prevent changing mission_count after enrolment; versioning is still required for same-count reorderings.

Catalogue titles are public. Full lesson data is loaded on authenticated routes, not public catalogue bundles. Questions are reflection prompts; they are not graded answers. Keep sensitive or licensed materials out of public/.
