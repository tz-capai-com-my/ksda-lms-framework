// Generic local package validation. No network, database connection or publication.
import {readFile, realpath, lstat} from 'node:fs/promises';
import {resolve, relative, isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

export const sha256 = value => createHash('sha256').update(value).digest('hex');
export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
export const canonicalText = value => JSON.stringify(canonical(value));
const hashPattern = /^[a-f0-9]{64}$/;
const idPattern = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,159}$/;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const fail = message => { throw new Error(`READING_PACKAGE_INVALID: ${message}`); };
const requireValue = (condition, message) => { if (!condition) fail(message); };
const bilingual = value => value && typeof value.en === 'string' && value.en.trim() && typeof value.ms === 'string' && value.ms.trim();

async function readInside(dir, name) {
  requireValue(typeof name === 'string' && name && !isAbsolute(name) && !name.includes('\\') && !name.split('/').some(part => part === '..' || part === '.' || !part), 'unsafe package path');
  const root = await realpath(dir), path = resolve(root, name), actual = await realpath(path);
  requireValue(relative(root, actual) && !relative(root, actual).startsWith('..') && !isAbsolute(relative(root, actual)), 'file outside package');
  let part = root;
  for (const component of name.split('/')) { part = resolve(part, component); requireValue(!(await lstat(part)).isSymbolicLink(), 'symlinks not accepted'); }
  return readFile(actual);
}

export async function loadReadingPackage(dir) {
  const bundle = JSON.parse(await readInside(dir, 'bundle.json'));
  requireValue(bundle.format === 'ksda-local-reading-bundle-v1' && bundle.publication === false, 'unsupported format/publication flag');
  requireValue(idPattern.test(bundle.source_id) && idPattern.test(bundle.delivery_id) && bundle.source_id !== bundle.delivery_id, 'release identifiers');
  requireValue(Array.isArray(bundle.releases) && bundle.releases.length === 2, 'one physical source and one delivery alias required');
  const source = bundle.releases.find(row => row.id === bundle.source_id), delivery = bundle.releases.find(row => row.id === bundle.delivery_id);
  requireValue(source && delivery, 'missing release');
  const releaseDocuments = new Map();
  for (const release of bundle.releases) {
    for (const key of ['source_hash', 'asset_hash', 'code_hash', 'content_hash']) requireValue(hashPattern.test(release[key]), `invalid ${key}`);
    requireValue(typeof release.manifest_text === 'string' && sha256(release.manifest_text) === release.content_hash, 'manifest byte hash');
    const document = JSON.parse(release.manifest_text);
    requireValue(document.release_id === release.id && document.baseline_commit === release.baseline_commit && document.source_manifest_hash === release.source_hash && document.asset_manifest_hash === release.asset_hash && document.code_manifest_hash === release.code_hash, 'release binding');
    requireValue(document.status === 'draft' && document.publication_approved === false, 'draft approval boundary');
    requireValue(Array.isArray(document.excluded_section_ids) && document.excluded_section_ids.every(id => idPattern.test(id)), 'explicit excluded section list required');
    releaseDocuments.set(release.id, document);
  }
  const sourceDocument = releaseDocuments.get(source.id), manifest = releaseDocuments.get(delivery.id);
  requireValue(manifest.content_release_id === source.id && manifest.parent_content_hash === source.content_hash, 'source/delivery relationship');
  for (const key of ['missions', 'assets', 'excluded_section_ids']) requireValue(canonicalText(sourceDocument[key]) === canonicalText(manifest[key]), `source/delivery ${key} mismatch`);
  for (const [name, expected] of [['source-manifest.json', source.source_hash], ['asset-manifest.json', source.asset_hash]]) {
    requireValue(sha256(canonicalText(JSON.parse(await readInside(dir, name)))) === expected, `${name} identity`);
  }
  const assetDocument = JSON.parse(await readInside(dir, 'asset-manifest.json'));
  requireValue(canonicalText(assetDocument.assets) === canonicalText(manifest.assets), 'asset document/binding mismatch');
  // Code array ordering is part of the runtime's code identity contract.
  const codeManifest = JSON.parse(await readInside(dir, 'code-manifest.json'));
  requireValue(Array.isArray(codeManifest) && codeManifest.length > 0 && codeManifest.every(row => row && typeof row.path === 'string' && hashPattern.test(row.sha256)), 'code manifest shape');
  requireValue(sha256(JSON.stringify(codeManifest)) === source.code_hash && source.code_hash === delivery.code_hash, 'framework code identity');
  requireValue(source.asset_hash === delivery.asset_hash && source.source_hash === delivery.source_hash, 'source manifest identity relationship');
  requireValue(Array.isArray(bundle.revisions) && bundle.revisions.length > 0 && Array.isArray(manifest.missions) && bundle.revisions.length === manifest.missions.length, 'mission manifest shape');
  requireValue(Array.isArray(bundle.photos) && Array.isArray(manifest.assets), 'asset manifest shape');
  const held = new Set(manifest.excluded_section_ids), missionIds = new Set(), globalBlocks = new Set(), revisions = [];
  for (let index = 0; index < bundle.revisions.length; index++) {
    const entry = bundle.revisions[index], signed = manifest.missions[index];
    requireValue(idPattern.test(entry.mission_id) && !missionIds.has(entry.mission_id) && slugPattern.test(entry.course_key) && slugPattern.test(entry.database_slug) && !('course_id' in entry), 'mission identifier/database mapping');
    missionIds.add(entry.mission_id);
    const bytes = await readInside(dir, entry.file), payload_text = bytes.toString('utf8'), payload = JSON.parse(payload_text);
    requireValue(sha256(bytes) === entry.revision_hash && signed.revision_hash === entry.revision_hash && signed.mission_id === entry.mission_id && signed.course_key === entry.course_key && signed.database_slug === entry.database_slug, 'revision hash or ordered metadata');
    requireValue(payload.mission_id === entry.mission_id && payload.course_key === entry.course_key && bilingual(payload.title) && bilingual(payload.bridge) && bilingual(payload.declaration) && bilingual(payload.notes_prompt), 'bilingual mission shape');
    requireValue(Array.isArray(payload.sections) && payload.sections.length > 0 && Array.isArray(payload.questions) && payload.questions.length > 0, 'sections/reflections required');
    const sectionIds = new Set(), blocks = [];
    for (const section of payload.sections) {
      requireValue(idPattern.test(section.id) && !sectionIds.has(section.id) && !held.has(section.id) && bilingual(section.title), 'duplicate/held/invalid section');
      sectionIds.add(section.id);
      requireValue(Array.isArray(section.paragraphs) && section.paragraphs.length > 0 && section.paragraphs.every(bilingual), 'bilingual paragraphs');
      requireValue(Array.isArray(section.block_ids) && section.block_ids.length === section.paragraphs.length, 'paragraph/block relationship');
      for (const id of section.block_ids) { requireValue(idPattern.test(id) && !globalBlocks.has(id) && !held.has(id), 'duplicate/held/invalid reading block'); globalBlocks.add(id); blocks.push(id); }
    }
    requireValue(canonicalText(blocks) === canonicalText(entry.block_ids) && signed.block_count === blocks.length && canonicalText(signed.section_ids) === canonicalText([...sectionIds]), 'ordered block/section mapping');
    for (const question of payload.questions) requireValue(idPattern.test(question.id) && typeof question.prompt === 'string' && typeof question.promptMs === 'string' && Array.isArray(question.options) && Array.isArray(question.optionsMs) && question.options.length === question.optionsMs.length && question.options.length > 1, 'reflection shape');
    requireValue(Array.isArray(payload.reflection_feedback) && payload.reflection_feedback.length === payload.questions.length, 'reflection feedback count');
    for (const position of ['opening', 'closer']) {
      const photo = payload.editorial_photos?.[position];
      requireValue(photo && idPattern.test(photo.asset_id) && bilingual(photo.alt) && bilingual(photo.caption) && Number.isInteger(photo.width) && Number.isInteger(photo.height), 'editorial photograph/copy');
    }
    revisions.push({...entry, text: payload_text, payload_text, payload});
  }
  const photos = [], photoIds = new Set();
  for (const entry of bundle.photos) {
    requireValue(idPattern.test(entry.asset_id) && !photoIds.has(entry.asset_id) && missionIds.has(entry.mission_id) && hashPattern.test(entry.sha256), 'photo metadata');
    photoIds.add(entry.asset_id);
    const body = await readInside(dir, entry.file);
    requireValue(body.length === entry.bytes && sha256(body) === entry.sha256 && entry.mime === 'image/webp' && body.subarray(0, 4).toString() === 'RIFF' && body.subarray(8, 12).toString() === 'WEBP', 'photo bytes/type');
    for (const locale of ['en', 'ms']) {
      const bindings = manifest.assets.filter(asset => asset.visual_id === entry.asset_id && asset.mission_id === entry.mission_id && asset.locale === locale);
      requireValue(bindings.length === 1 && bindings[0].sha256 === entry.sha256 && bindings[0].bytes === entry.bytes && bindings[0].width === entry.width && bindings[0].height === entry.height && bindings[0].format === entry.mime, 'locale photo binding');
    }
    photos.push({...entry, body});
  }
  requireValue(manifest.assets.length === photos.length * 2, 'unexpected locale asset bindings');
  for (const revision of revisions) for (const photo of Object.values(revision.payload.editorial_photos)) requireValue(photos.some(entry => entry.asset_id === photo.asset_id && entry.mission_id === revision.mission_id && entry.width === photo.width && entry.height === photo.height), 'unbound editorial photograph');
  const identity = {release_id: delivery.id, content_release_id: source.id, content_hash: delivery.content_hash, parent_content_hash: source.content_hash, code_hash: delivery.code_hash, source_hash: delivery.source_hash, asset_hash: delivery.asset_hash};
  return {bundle, releases: bundle.releases, source, delivery, sourceDocument, manifest, codeManifest, revisions, photos, identity, counts: {missions: revisions.length, blocks: globalBlocks.size, photos: photos.length, photo_bytes: photos.reduce((sum, row) => sum + row.bytes, 0), locale_bindings: manifest.assets.length}};
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const dir = resolve(process.argv[2] || 'examples/capai-community-reading');
  const result = await loadReadingPackage(dir);
  console.log(JSON.stringify({status: 'PASS', identity: result.identity, counts: result.counts, database_connections: 0}, null, 2));
}
