// Regenerates a local draft package after reviewed source/runtime changes.
// Never reads credentials, connects to a provider, installs or activates content.
import {readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {canonical, canonicalText, sha256, loadReadingPackage} from './validate-reading-package.mjs';
const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const dir = resolve(root, 'examples/capai-community-reading');
const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
const writeJson = (name, value) => writeFile(resolve(dir, name), JSON.stringify(value, null, 2) + '\n');
const index = await readJson(resolve(dir, 'source-index.json'));
const codeManifest = await readJson(resolve(root, 'content/reading-code-manifest.json'));
const codeHash = sha256(JSON.stringify(codeManifest));
const baselineCommit = 'e9e10d359d2e3005ea39730b9dae1cc8c238a65a';
const revisions = [], missions = [], assets = [];
for (const input of index.missions) {
  const bytes = await readFile(resolve(dir, input.file));
  if (sha256(bytes) !== input.derivative_revision_sha256) throw new Error(`Reviewed example bytes changed: ${input.mission_id}; record a new reviewed source index/release.`);
  const payload = JSON.parse(bytes), blocks = payload.sections.flatMap(section => section.block_ids);
  if (payload.video_link || payload.video_embed) throw new Error('Default example video positions must remain empty; configure a reviewed independent successor.');
  const teaching = {...payload}; delete teaching.video_link; delete teaching.video_embed;
  if (sha256(canonicalText(teaching)) !== input.upstream_teaching_sha256) throw new Error(`Teaching differs from verified upstream: ${input.mission_id}`);
  const row = {mission_id: input.mission_id, course_key: input.course_key, database_slug: input.database_slug, revision_hash: sha256(bytes), file: input.file, block_ids: blocks};
  revisions.push(row);
  missions.push({mission_id: row.mission_id, course_key: row.course_key, database_slug: row.database_slug, revision_hash: row.revision_hash, block_count: blocks.length, section_ids: payload.sections.map(section => section.id), question_ids: payload.questions.map(question => question.id), title: payload.title});
}
for (const photo of index.photos) {
  const bytes = await readFile(resolve(dir, photo.file));
  if (sha256(bytes) !== photo.sha256 || bytes.length !== photo.bytes) throw new Error(`Approved photograph changed: ${photo.asset_id}`);
  for (const locale of ['en', 'ms']) assets.push({visual_id: photo.asset_id, mission_id: photo.mission_id, locale, format: photo.mime, width: photo.width, height: photo.height, sha256: photo.sha256, bytes: photo.bytes});
}
const sourceManifest = canonical({format: 'ksda-example-source-manifest-v1', source_id: index.source_id, upstream: index.upstream, rights: index.rights, review: index.review, excluded_section_ids: index.excluded_section_ids, derivative_changes: index.derivative_changes, courses: index.courses, missions: index.missions});
const assetManifest = canonical({format: 'ksda-reading-asset-manifest-v1', source_id: index.source_id, assets});
const sourceHash = sha256(canonicalText(sourceManifest)), assetHash = sha256(canonicalText(assetManifest));
const sourceDocument = canonical({format: 'ksda-reading-content-manifest-v1', presentation: 'editorial-photos-v1', release_id: index.source_id, baseline_commit: baselineCommit, source_manifest_hash: sourceHash, asset_manifest_hash: assetHash, code_manifest_hash: codeHash, status: 'draft', publication_approved: false, progress_scope: 'independent-installation', excluded_section_ids: index.excluded_section_ids, missions, assets, upstream: index.upstream, rights: index.rights, review: index.review});
const sourceText = canonicalText(sourceDocument), contentHash = sha256(sourceText);
const deliveryDocument = canonical({...sourceDocument, release_id: index.delivery_id, content_release_id: index.source_id, parent_content_hash: contentHash, presentation: {kind: 'editorial-photographs', local_notes: 'temporary-browser-state', knowledge_checks: 'optional-unscored', videos: 'optional-empty-by-default'}});
const deliveryText = canonicalText(deliveryDocument);
const release = (id, manifest_text) => ({id, baseline_commit: baselineCommit, source_hash: sourceHash, content_hash: sha256(manifest_text), asset_hash: assetHash, code_hash: codeHash, manifest_text});
const bundle = {format: 'ksda-local-reading-bundle-v1', publication: false, source_id: index.source_id, delivery_id: index.delivery_id, releases: [release(index.source_id, sourceText), release(index.delivery_id, deliveryText)], revisions, photos: index.photos};
await writeJson('source-manifest.json', sourceManifest);
await writeJson('asset-manifest.json', assetManifest);
await writeJson('code-manifest.json', codeManifest);
await writeJson('physical-content-manifest.json', sourceDocument);
await writeJson('content-manifest.json', deliveryDocument);
await writeJson('bundle.json', bundle);
const checked = await loadReadingPackage(dir);
await writeJson('release-identity.json', {...checked.identity, ...checked.counts, status: 'draft', publication: false, upstream: index.upstream});
console.log(JSON.stringify({status: 'DRAFT_PACKAGE_GENERATED_AND_VALIDATED', identity: checked.identity, counts: checked.counts, database_connections: 0}, null, 2));
