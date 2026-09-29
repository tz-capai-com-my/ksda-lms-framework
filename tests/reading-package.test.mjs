import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,cp,readFile,writeFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadReadingPackage,canonicalText,sha256} from '../scripts/validate-reading-package.mjs';

const source=resolve(fileURLToPath(new URL('../examples/capai-community-reading',import.meta.url)));
const json=async path=>JSON.parse(await readFile(path,'utf8'));
const save=(path,value)=>writeFile(path,JSON.stringify(value,null,2)+'\n');
async function fixture(t){const dir=await mkdtemp(join(tmpdir(),'ksda-package-'));await cp(source,dir,{recursive:true});t.after(()=>rm(dir,{recursive:true,force:true}));return dir;}
async function resign(dir,mutate){
 const bundle=await json(join(dir,'bundle.json'));
 const physical=bundle.releases.find(r=>r.id===bundle.source_id),delivery=bundle.releases.find(r=>r.id===bundle.delivery_id);
 const p=JSON.parse(physical.manifest_text),d=JSON.parse(delivery.manifest_text);
 await mutate(bundle,p,d);
 const assets=await json(join(dir,'asset-manifest.json'));assets.assets=p.assets;
 await save(join(dir,'asset-manifest.json'),assets);
 for(const release of [physical,delivery])release.asset_hash=sha256(canonicalText(assets));
 p.asset_manifest_hash=d.asset_manifest_hash=physical.asset_hash;
 physical.manifest_text=canonicalText(p);physical.content_hash=sha256(physical.manifest_text);
 d.parent_content_hash=physical.content_hash;delivery.manifest_text=canonicalText(d);delivery.content_hash=sha256(delivery.manifest_text);
 await save(join(dir,'bundle.json'),bundle);
}

test('complete reviewed example preserves upstream teaching hashes, photos, video defaults and holds',async()=>{
 const data=await loadReadingPackage(source),index=await json(join(source,'source-index.json'));
 assert.deepEqual(data.counts,{missions:28,blocks:321,photos:56,photo_bytes:6669998,locale_bindings:112});
 assert.equal(index.missions.filter(m=>m.upstream_revision_sha256===m.derivative_revision_sha256).length,27);
 assert.equal(data.manifest.excluded_section_ids.length,5);
 for(const row of data.revisions){const teaching={...row.payload};delete teaching.video_link;delete teaching.video_embed;
  assert.equal(sha256(canonicalText(teaching)),index.missions.find(m=>m.mission_id===row.mission_id).upstream_teaching_sha256);
  assert.equal(row.payload.video_link,null);assert.equal(row.payload.video_embed,null);
 }
});
test('generic validator accepts a one-mission course package without the example count',async t=>{
 const dir=await fixture(t);
 await resign(dir,(b,p,d)=>{b.revisions=b.revisions.slice(0,1);const id=b.revisions[0].mission_id;b.photos=b.photos.filter(x=>x.mission_id===id);p.missions=d.missions=p.missions.slice(0,1);p.assets=d.assets=p.assets.filter(x=>x.mission_id===id);});
 const data=await loadReadingPackage(dir);assert.equal(data.counts.missions,1);assert.equal(data.counts.photos,2);
});
test('changed revision bytes fail before installation',async t=>{
 const dir=await fixture(t),bundle=await json(join(dir,'bundle.json')),path=join(dir,bundle.revisions[0].file);
 await writeFile(path,(await readFile(path,'utf8'))+' ');
 await assert.rejects(loadReadingPackage(dir),/revision hash/);
});
test('changed photo bytes fail before installation',async t=>{
 const dir=await fixture(t),bundle=await json(join(dir,'bundle.json')),path=join(dir,bundle.photos[0].file),bytes=await readFile(path);
 bytes[bytes.length-1]^=1;await writeFile(path,bytes);
 await assert.rejects(loadReadingPackage(dir),/photo bytes/);
});
test('path traversal and symlinks cannot import files outside the package',async t=>{
 const dir=await fixture(t),bundle=await json(join(dir,'bundle.json')),entry=bundle.revisions[0],original=entry.file;
 entry.file='../outside.json';await save(join(dir,'bundle.json'),bundle);
 await assert.rejects(loadReadingPackage(dir),/unsafe package path/);
 entry.file='linked.json';await symlink(join(dir,original),join(dir,entry.file));await save(join(dir,'bundle.json'),bundle);
 await assert.rejects(loadReadingPackage(dir),/symlinks not accepted/);
});
test('a newly excluded active section fails even with valid regenerated manifest hashes',async t=>{
 const dir=await fixture(t);
 await resign(dir,(_b,p,d)=>{p.excluded_section_ids=d.excluded_section_ids=[...p.excluded_section_ids,p.missions[0].section_ids[0]];});
 await assert.rejects(loadReadingPackage(dir),/held\/invalid section/);
});
test('signed course/database mapping mismatch is rejected',async t=>{
 const dir=await fixture(t),bundle=await json(join(dir,'bundle.json'));bundle.revisions[0].database_slug='another-independent-course';await save(join(dir,'bundle.json'),bundle);
 await assert.rejects(loadReadingPackage(dir),/ordered metadata/);
});
