// Exact private bytes only: no external URLs or browser-decoded SVG content in photos.
import {validPhotoBytes} from './photo-format.ts';
export type PrivateAsset = {body:string; encoding?:string; hash:string; expected_hash:string; mime:string; width:number; height:number; code_hash?:string};
export async function verifiedAsset(data:PrivateAsset, expectedCode?:string):Promise<{body:Uint8Array<ArrayBuffer>;mime:string}> {
 if(!data || expectedCode && data.code_hash!==expectedCode || !/^[a-f0-9]{64}$/.test(data.hash) || data.hash!==data.expected_hash
  || !Number.isInteger(data.width) || !Number.isInteger(data.height) || data.width<1 || data.height<1 || data.width>8192 || data.height>8192) throw new Error('ASSET_INTEGRITY_ERROR');
 let bytes:Uint8Array<ArrayBuffer>; let mime:string;
 if((data.mime==='image/png'||data.mime==='image/webp') && data.encoding==='base64') {
  const maxEncodedLength=4*Math.ceil((data.mime==='image/webp'?262_144:10_485_760)/3);
  if(typeof data.body!=='string' || data.body.length>maxEncodedLength || data.body.length%4!==0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(data.body)) throw new Error('ASSET_INTEGRITY_ERROR');
  const binary=atob(data.body);bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);mime=data.mime;
  if(!validPhotoBytes(bytes,mime,data.width,data.height))throw new Error('ASSET_INTEGRITY_ERROR');
 } else if(data.mime==='image/svg+xml' && (!data.encoding || data.encoding==='utf8')) {
  if(typeof data.body!=='string' || data.body.length>122880 || /<\s*(?:script|foreignObject|image|use|a)\b|\bon[a-z]+\s*=|(?:href|url)\s*[=(]/i.test(data.body)) throw new Error('ASSET_INTEGRITY_ERROR');
  bytes=new TextEncoder().encode(data.body);mime='image/svg+xml; charset=utf-8';
 } else throw new Error('ASSET_INTEGRITY_ERROR');
 const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
 if(digest!==data.hash) throw new Error('ASSET_INTEGRITY_ERROR');
 return {body:bytes,mime};
}
