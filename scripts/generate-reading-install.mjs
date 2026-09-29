// Generate reviewed SQL locally. This tool never opens a database or network connection.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadReadingPackage} from './validate-reading-package.mjs';

const quote=value=>value==null?'NULL':"'"+String(value).replaceAll("'","''")+"'";
const array=values=>'ARRAY['+values.map(quote).join(',')+']::text[]';

export function renderReadingActivation(data,{expectedRelease=null,approvalReference}={}) {
  const releases=data.releases||data.bundle.releases;
  const delivery=releases.find(x=>x.id===data.bundle.delivery_id);
  if(!delivery||!/^ksda-[a-z0-9-]{8,100}$/.test(delivery.id))throw new Error('INDEPENDENT_DELIVERY_REQUIRED');
  if(!approvalReference||!String(approvalReference).trim())throw new Error('EXPLICIT_OPERATOR_APPROVAL_REFERENCE_REQUIRED');
  if(expectedRelease!==null&&!/^ksda-[a-z0-9-]{8,100}$/.test(expectedRelease))throw new Error('INVALID_EXPECTED_FRAMEWORK_RELEASE');
  return [
    '-- Independent target only: approve/activate an already imported exact sealed release.',
    '-- No users, course progress or reading markers are changed; expected prior pointer is checked.',
    'begin;',
    `do $ksda_activate$ begin if not exists(select 1 from ksda_reading_private.releases where id=${quote(delivery.id)} and sealed_at is not null and content_hash=${quote(delivery.content_hash)} and asset_hash=${quote(delivery.asset_hash)} and source_hash=${quote(delivery.source_hash)} and code_hash=${quote(delivery.code_hash)}) then raise exception 'EXACT_IMPORTED_RELEASE_REQUIRED'; end if; end $ksda_activate$;`,
    `update ksda_reading_private.releases set status='approved',approved_at=now() where id=${quote(delivery.id)};`,
    `insert into ksda_reading_private.release_approvals(release_id,content_hash,asset_hash,source_hash,code_hash,approval_reference) select id,content_hash,asset_hash,source_hash,code_hash,${quote(approvalReference)} from ksda_reading_private.releases where id=${quote(delivery.id)};`,
    `select ksda_reading_private.select_publication(${quote(expectedRelease)},${quote(delivery.id)},${quote(delivery.code_hash)});`,
    `update ksda_reading_private.releases set status='published',published_at=now() where id=${quote(delivery.id)};`,
    'commit;'
  ].join('\n\n')+'\n';
}

export function renderReadingInstall(data,{activate=false,expectedRelease=null,approvalReference=null}={}) {
  const {bundle,revisions,photos}=data;
  const releases=data.releases||bundle.releases;
  if(bundle.publication!==false)throw new Error('PACKAGE_MUST_NOT_AUTO_PUBLISH');
  if(activate&&(!approvalReference||!String(approvalReference).trim()))throw new Error('EXPLICIT_OPERATOR_APPROVAL_REFERENCE_REQUIRED');
  if(expectedRelease!==null&&!/^ksda-[a-z0-9-]{8,100}$/.test(expectedRelease))throw new Error('INVALID_EXPECTED_FRAMEWORK_RELEASE');
  const physical=releases.find(x=>x.id===bundle.source_id),delivery=releases.find(x=>x.id===bundle.delivery_id);
  if(!physical||!delivery||physical.id===delivery.id)throw new Error('SOURCE_AND_DELIVERY_REQUIRED');
  if(!releases.every(x=>/^ksda-[a-z0-9-]{8,100}$/.test(x.id)))throw new Error('INDEPENDENT_RELEASE_ID_REQUIRED');
  const courseCounts=new Map();
  for(const revision of revisions) {
    if(!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(revision.database_slug))throw new Error('INVALID_DATABASE_SLUG');
    courseCounts.set(revision.database_slug,(courseCounts.get(revision.database_slug)||0)+1);
  }
  const sql=[
    '-- Independent KSDA reading package import; generated locally, never applied by this tool.',
    '-- Apply only to the independently configured framework installation after reviewing its identity.',
    '-- Existing users, profiles, course UUIDs, progress, entitlements and markers are preserved.',
    '-- Rights/professional content review remains separate from the operator release approval below.',
    'begin;',
    "set local search_path=public,pg_catalog;",
    'lock table public.courses in share mode;',
    `do $ksda_preflight$ begin
      if to_regnamespace('ksda_reading_private') is null or to_regprocedure('public.ksda_progress_guard()') is null then raise exception 'FRAMEWORK_READING_SCHEMA_REQUIRED'; end if;
      if exists(select 1 from ksda_reading_private.releases where id in (${quote(physical.id)},${quote(delivery.id)})) then raise exception 'RELEASE_ALREADY_EXISTS_USE_NEW_VERSION'; end if;
      ${[...courseCounts].map(([slug,count])=>`if not exists(select 1 from public.courses where slug=${quote(slug)} and mission_count=${count} and status='published' and access_type='free') then raise exception 'COURSE_MAPPING_OR_COUNT_MISMATCH'; end if;`).join('\n')}
    end $ksda_preflight$;`,
  ];
  const insertRelease=release=>`insert into ksda_reading_private.releases(id,baseline_commit,source_hash,content_hash,asset_hash,code_hash,manifest_text) values(${['id','baseline_commit','source_hash','content_hash','asset_hash','code_hash','manifest_text'].map(key=>quote(release[key])).join(',')});`;
  sql.push(insertRelease(physical));
  for(const revision of revisions) {
    const text=revision.text??revision.payload_text;
    if(typeof text!=='string')throw new Error('EXACT_REVISION_TEXT_REQUIRED');
    sql.push(`insert into ksda_reading_private.mission_revisions(release_id,mission_id,course_id,course_key,revision_hash,payload_text,block_ids) values(${quote(physical.id)},${quote(revision.mission_id)},(select id from public.courses where slug=${quote(revision.database_slug)}),${quote(revision.course_key)},${quote(revision.revision_hash)},${quote(text)},${array(revision.block_ids)});`);
  }
  for(const photo of photos) {
    if(!Buffer.isBuffer(photo.body))throw new Error('VALIDATED_PHOTO_BYTES_REQUIRED');
    if(!Number.isInteger(photo.width)||!Number.isInteger(photo.height))throw new Error('PHOTO_DIMENSIONS_REQUIRED');
    sql.push(`insert into ksda_reading_private.photos(release_id,asset_id,mission_id,mime,width,height,asset_hash,body) values(${quote(physical.id)},${quote(photo.asset_id)},${quote(photo.mission_id)},${quote(photo.mime)},${photo.width},${photo.height},${quote(photo.sha256)},decode(${quote(photo.body.toString('hex'))},'hex'));`);
  }
  sql.push(`update ksda_reading_private.releases set sealed_at=now(),status='in_review' where id=${quote(physical.id)};`);
  sql.push(insertRelease(delivery));
  sql.push(`insert into ksda_reading_private.release_sources(release_id,content_release_id) values(${quote(delivery.id)},${quote(physical.id)});`);
  sql.push(`update ksda_reading_private.releases set sealed_at=now(),status='in_review' where id=${quote(delivery.id)};`);
  if(activate) {
    sql.push(`update ksda_reading_private.releases set status='approved',approved_at=now() where id=${quote(delivery.id)};`);
    sql.push(`insert into ksda_reading_private.release_approvals(release_id,content_hash,asset_hash,source_hash,code_hash,approval_reference) select id,content_hash,asset_hash,source_hash,code_hash,${quote(approvalReference)} from ksda_reading_private.releases where id=${quote(delivery.id)};`);
    sql.push(`select ksda_reading_private.select_publication(${quote(expectedRelease)},${quote(delivery.id)},${quote(delivery.code_hash)});`);
    sql.push(`update ksda_reading_private.releases set status='published',published_at=now() where id=${quote(delivery.id)};`);
  } else sql.push('-- Import remains sealed/in_review. No approval or publication pointer is written.');
  sql.push('commit;');
  return sql.join('\n\n')+'\n';
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2),options={};
  for(let n=0;n<args.length;n++) {
    const key=args[n];
    if(key==='--activate')options.activate=true;
    else if(key==='--activate-only')options.activateOnly=true;
    else if(['--package','--out','--expected-release','--approval-reference'].includes(key)) {
      if(!args[n+1]||args[n+1].startsWith('--'))throw new Error('VALUE_REQUIRED_FOR_'+key);
      options[key.slice(2)]=args[++n];
    } else throw new Error('UNKNOWN_ARGUMENT_'+key);
  }
  if(!options.package||!options.out)throw new Error('Usage: node scripts/generate-reading-install.mjs --package DIR --out FILE [--activate|--activate-only --expected-release none|ksda-ID --approval-reference TEXT]');
  if(options.activate&&options.activateOnly)throw new Error('CHOOSE_IMPORT_OR_ACTIVATE_ONLY');
  if((options.activate||options.activateOnly)&&!Object.hasOwn(options,'expected-release'))throw new Error('EXPECTED_CURRENT_PUBLICATION_REQUIRED');
  const data=await loadReadingPackage(resolve(options.package));
  const code=await readFile(new URL('../app/learn/reading-build.ts',import.meta.url),'utf8');
  const hash=code.match(/READING_CODE_HASH\s*=\s*["']([a-f0-9]{64})["']/)?.[1];
  if(!hash||!(data.releases||data.bundle.releases).every(release=>release.code_hash===hash))throw new Error('RUNTIME_CODE_IDENTITY_MISMATCH_REBUILD_PACKAGE');
  const render=options.activateOnly?renderReadingActivation:renderReadingInstall;
  const sql=render(data,{activate:!!options.activate,expectedRelease:options['expected-release']==='none'?null:options['expected-release']??null,approvalReference:options['approval-reference']??null});
  const out=resolve(options.out);await mkdir(dirname(out),{recursive:true});await writeFile(out,sql,{mode:0o600});
  console.log(JSON.stringify({output:out,source_id:data.bundle.source_id,delivery_id:data.bundle.delivery_id,activate:!!options.activate||!!options.activateOnly,activation_only:!!options.activateOnly,sql_bytes:Buffer.byteLength(sql),database_connection:false}));
}
