import test from 'node:test';import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verifiedAsset} from '../app/reading-review/asset.ts';
import {validPhotoBytes} from '../app/reading-review/photo-format.ts';
import {lossy,lossless,extended,malformed} from './fixtures/reading-webp.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex'),code='e'.repeat(64);
const item=b=>({body:b.toString('base64'),encoding:'base64',hash:hash(b),expected_hash:hash(b),mime:'image/webp',width:2,height:3,code_hash:code});
test('WebP transport supports exact opaque VP8, VP8L and VP8X still bytes',async()=>{
 for(const bytes of [lossy,lossless,extended]){
  const result=await verifiedAsset(item(bytes),code);assert.equal(result.mime,'image/webp');assert.deepEqual(Buffer.from(result.body),bytes);
 }
 for(const change of [{mime:'image/png'},{width:3},{height:4},{encoding:'utf8'},{hash:'a'.repeat(64)},{expected_hash:'b'.repeat(64)},{code_hash:'f'.repeat(64)}])await assert.rejects(verifiedAsset({...item(lossy),...change},code),/ASSET_INTEGRITY_ERROR/);
 assert.equal(validPhotoBytes(Buffer.alloc(10_485_761),'image/webp',2,3),false);
});
test('WebP malformed containers and unsupported features fail even with a matching forged hash',async t=>{
 for(const [name,bytes]of malformed)await t.test(name,async()=>assert.rejects(verifiedAsset(item(bytes),code),/ASSET_INTEGRITY_ERROR/));
});
